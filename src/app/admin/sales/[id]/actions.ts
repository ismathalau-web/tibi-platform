'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';

function actorLabel(user: { displayName: string | null; email: string | null }): string {
  return user.displayName ?? user.email ?? 'staff';
}

async function logAudit(
  saleId: string,
  action: 'created' | 'edited' | 'returned' | 'exchanged' | 'voided' | 'reopened',
  actor: string,
  details: Record<string, unknown> | null,
) {
  const supabase = createAdminClient();
  await supabase.from('sale_audit_log').insert({
    sale_id: saleId,
    action,
    actor,
    details: details ?? null,
  });
}

// ----------------------------------------------------------------------------
// RETURN : partial qty per sale_item
// ----------------------------------------------------------------------------
const returnSchema = z.object({
  sale_id: z.string().uuid(),
  lines: z.array(z.object({
    sale_item_id: z.string().uuid(),
    qty: z.number().int().positive(),
  })).min(1),
  reason: z.string().trim().min(1, 'Reason required'),
  refund_method: z.enum(['cash', 'card', 'mobile_money', 'store_credit', 'other']),
  seller_name: z.string().trim().min(1, 'Seller required'),
  notes: z.string().trim().optional().nullable(),
});

export async function processReturn(input: z.infer<typeof returnSchema>): Promise<{ ok: boolean; error?: string; refund_xof?: number; batch_id?: string; credit_note_no?: number }> {
  const user = await requireUser();
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const v = parsed.data;
  const supabase = createAdminClient();

  // Load the referenced sale_items with enough info
  const { data: items } = await supabase
    .from('sale_items')
    .select('id, qty, unit_price_xof, variant_id, brand_id, sale_id, commission_xof')
    .in('id', v.lines.map((l) => l.sale_item_id));
  if (!items || items.length === 0) return { ok: false, error: 'Items not found' };

  // Existing returns for these items
  const existingReturnsRes = await supabase
    .from('returns')
    .select('sale_item_id, qty')
    .in('sale_item_id', v.lines.map((l) => l.sale_item_id));
  const alreadyReturned = new Map<string, number>();
  for (const r of ((existingReturnsRes.data ?? []) as Array<{ sale_item_id: string; qty: number }>)) {
    alreadyReturned.set(r.sale_item_id, (alreadyReturned.get(r.sale_item_id) ?? 0) + r.qty);
  }

  // Compute total refund first (to save on the batch)
  let totalRefund = 0;
  const detailLines: Array<{ item_id: string; qty: number; refund: number }> = [];

  for (const line of v.lines) {
    const item = items.find((i: any) => i.id === line.sale_item_id);
    if (!item) return { ok: false, error: 'Item mismatch' };
    const alreadyQty = alreadyReturned.get(line.sale_item_id) ?? 0;
    const remainingQty = item.qty - alreadyQty;
    if (line.qty > remainingQty) {
      return { ok: false, error: `Only ${remainingQty} unit(s) left to return for this item` };
    }
    const refund = line.qty * item.unit_price_xof;
    totalRefund += refund;
    detailLines.push({ item_id: item.id, qty: line.qty, refund });
  }

  // Create the return batch (one credit note per batch — all returned items share the same CN number)
  const { data: batch, error: batchErr } = await supabase
    .from('return_batches')
    .insert({
      sale_id: v.sale_id,
      total_refund_xof: totalRefund,
      refund_method: v.refund_method,
      reason: v.reason,
      notes: v.notes ?? null,
      seller_name: v.seller_name,
    })
    .select('id, credit_note_no')
    .single();
  if (batchErr || !batch) return { ok: false, error: batchErr?.message ?? 'Could not open return batch' };

  // Insert the returns rows + restock + reverse commissions + update movements
  for (const line of v.lines) {
    const item = items.find((i: any) => i.id === line.sale_item_id)!;
    const alreadyQty = alreadyReturned.get(line.sale_item_id) ?? 0;

    await supabase.from('returns').insert({
      sale_item_id: item.id,
      batch_id: batch.id,
      reason: v.reason,
      refund_xof: line.qty * item.unit_price_xof,
      seller_name: v.seller_name,
      qty: line.qty,
      refund_method: v.refund_method,
      notes: v.notes ?? null,
    });

    // Restock the variant
    const { data: va } = await supabase.from('variants').select('stock_qty').eq('id', item.variant_id).single();
    await supabase.from('variants').update({ stock_qty: (va?.stock_qty ?? 0) + line.qty }).eq('id', item.variant_id);

    // Reverse commission proportionally (zero out only if fully returned)
    const fullyReturned = alreadyQty + line.qty >= item.qty;
    if (fullyReturned) {
      await supabase.from('sale_items').update({ commission_xof: 0 }).eq('id', item.id);
    }

    // Reverse stock_movement qty_sold (best-effort, per cycle)
    const { data: sale } = await supabase.from('sales').select('cycle_id').eq('id', item.sale_id).single();
    if (sale?.cycle_id) {
      const { data: mv } = await supabase
        .from('stock_movements')
        .select('id, qty_sold, qty_returned')
        .eq('variant_id', item.variant_id)
        .eq('cycle_id', sale.cycle_id)
        .maybeSingle();
      if (mv) {
        await supabase
          .from('stock_movements')
          .update({
            qty_sold: Math.max(0, mv.qty_sold - line.qty),
            qty_returned: mv.qty_returned + line.qty,
          })
          .eq('id', mv.id);
      }
    }
  }

  await logAudit(v.sale_id, 'returned', actorLabel(user), {
    batch_id: batch.id,                  // for UI to build download link
    credit_note_no: batch.credit_note_no,
    seller_name: v.seller_name,
    reason: v.reason,
    refund_method: v.refund_method,
    total_refund_xof: totalRefund,
    lines: detailLines,
    notes: v.notes ?? null,
  });

  revalidatePath(`/admin/sales/${v.sale_id}`);
  revalidatePath(`/pos/sales/${v.sale_id}`);
  revalidatePath('/admin');
  revalidatePath('/admin/reports');
  revalidatePath('/pos/returns');
  revalidatePath('/pos/sales');
  return { ok: true, refund_xof: totalRefund, batch_id: batch.id, credit_note_no: batch.credit_note_no };
}

// ----------------------------------------------------------------------------
// EDIT : update payment method, customer info, notes
// ----------------------------------------------------------------------------
const editSchema = z.object({
  sale_id: z.string().uuid(),
  payment_method: z.enum(['cash', 'card', 'mobile_money', 'other']).optional(),
  payment_other: z.string().trim().optional().nullable(),
  customer_name: z.string().trim().optional().nullable(),
  customer_email: z.string().trim().optional().nullable(),
  customer_phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export async function editSale(input: z.infer<typeof editSchema>): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const v = parsed.data;
  const supabase = createAdminClient();

  const { data: before } = await supabase
    .from('sales')
    .select('payment_method, payment_other, customer_name, customer_email, customer_phone, notes, voided_at')
    .eq('id', v.sale_id)
    .maybeSingle();
  if (!before) return { ok: false, error: 'Sale not found' };
  if ((before as any).voided_at) return { ok: false, error: 'Cannot edit a voided sale' };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changed: Record<string, { before: unknown; after: unknown }> = {};

  for (const field of ['payment_method', 'payment_other', 'customer_name', 'customer_email', 'customer_phone', 'notes'] as const) {
    const next = (v as any)[field];
    if (next !== undefined && next !== (before as any)[field]) {
      patch[field] = next;
      changed[field] = { before: (before as any)[field], after: next };
    }
  }
  // Keep legacy customer_contact in sync when email/phone changes
  if ('customer_email' in patch || 'customer_phone' in patch) {
    const email = (v.customer_email ?? (before as any).customer_email ?? '').trim() || null;
    const phone = (v.customer_phone ?? (before as any).customer_phone ?? '').trim() || null;
    patch.customer_contact = email ?? phone ?? null;
  }

  if (Object.keys(changed).length === 0) return { ok: true }; // nothing to update

  const { error } = await supabase.from('sales').update(patch).eq('id', v.sale_id);
  if (error) return { ok: false, error: error.message };

  await logAudit(v.sale_id, 'edited', actorLabel(user), { changed });

  revalidatePath(`/admin/sales/${v.sale_id}`);
  revalidatePath(`/pos/sales/${v.sale_id}`);
  revalidatePath('/admin/reports');
  revalidatePath('/pos/sales');
  return { ok: true };
}

// ----------------------------------------------------------------------------
// VOID : cancel a sale entirely
// ----------------------------------------------------------------------------
const voidSchema = z.object({
  sale_id: z.string().uuid(),
  reason: z.string().trim().min(3, 'Reason required'),
});

export async function voidSale(input: z.infer<typeof voidSchema>): Promise<{ ok: boolean; error?: string; cancellation_note_no?: number }> {
  const user = await requireUser();
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const v = parsed.data;
  const supabase = createAdminClient();

  const { data: sale } = await supabase
    .from('sales')
    .select('id, voided_at, cycle_id')
    .eq('id', v.sale_id)
    .maybeSingle();
  if (!sale) return { ok: false, error: 'Sale not found' };
  if ((sale as any).voided_at) return { ok: false, error: 'Already voided' };

  // Load items to restock and reverse commissions
  const { data: items } = await supabase
    .from('sale_items')
    .select('id, variant_id, qty, commission_xof')
    .eq('sale_id', v.sale_id);
  const list = (items ?? []) as Array<{ id: string; variant_id: string; qty: number; commission_xof: number }>;

  // Sum already-returned to avoid double-counting stock
  const alreadyReturnedMap = new Map<string, number>();
  if (list.length > 0) {
    const { data: rs } = await supabase
      .from('returns')
      .select('sale_item_id, qty')
      .in('sale_item_id', list.map((x) => x.id));
    for (const r of ((rs ?? []) as Array<{ sale_item_id: string; qty: number }>)) {
      alreadyReturnedMap.set(r.sale_item_id, (alreadyReturnedMap.get(r.sale_item_id) ?? 0) + r.qty);
    }
  }

  const restockedLines: Array<{ sale_item_id: string; variant_id: string; qty: number }> = [];

  for (const it of list) {
    const alreadyQty = alreadyReturnedMap.get(it.id) ?? 0;
    const remainingQty = Math.max(0, it.qty - alreadyQty);
    if (remainingQty > 0) {
      const { data: va } = await supabase.from('variants').select('stock_qty').eq('id', it.variant_id).single();
      await supabase.from('variants').update({ stock_qty: (va?.stock_qty ?? 0) + remainingQty }).eq('id', it.variant_id);
      restockedLines.push({ sale_item_id: it.id, variant_id: it.variant_id, qty: remainingQty });
    }
    // Zero commission on all items
    if (it.commission_xof !== 0) {
      await supabase.from('sale_items').update({ commission_xof: 0 }).eq('id', it.id);
    }
    // Reverse stock_movement qty_sold for this cycle
    if ((sale as any).cycle_id) {
      const { data: mv } = await supabase
        .from('stock_movements')
        .select('id, qty_sold, qty_returned')
        .eq('variant_id', it.variant_id)
        .eq('cycle_id', (sale as any).cycle_id)
        .maybeSingle();
      if (mv) {
        await supabase
          .from('stock_movements')
          .update({
            qty_sold: Math.max(0, mv.qty_sold - remainingQty),
            qty_returned: mv.qty_returned,
          })
          .eq('id', mv.id);
      }
    }
  }

  // Get next cancellation note number from the sequence
  const { data: seqRes, error: seqErr } = await supabase.rpc('nextval_cancellation_note');
  if (seqErr) return { ok: false, error: 'Could not allocate cancellation note number' };
  const cancellationNoteNo: number = Number(seqRes);

  // Mark sale voided
  const { error } = await supabase
    .from('sales')
    .update({
      voided_at: new Date().toISOString(),
      voided_reason: v.reason,
      cancellation_note_no: cancellationNoteNo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', v.sale_id);
  if (error) return { ok: false, error: error.message };

  await logAudit(v.sale_id, 'voided', actorLabel(user), {
    cancellation_note_no: cancellationNoteNo,
    reason: v.reason,
    restocked: restockedLines,
  });

  revalidatePath(`/admin/sales/${v.sale_id}`);
  revalidatePath(`/pos/sales/${v.sale_id}`);
  revalidatePath('/admin');
  revalidatePath('/admin/reports');
  revalidatePath('/pos/sales');
  return { ok: true, cancellation_note_no: cancellationNoteNo };
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';
import { getResend, resendConfig } from '@/lib/resend';
import { render } from '@react-email/render';
import InvoiceEmail from '@/emails/invoice';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePdf } from '@/lib/pdf/invoice-pdf';

const saleItemSchema = z.object({
  variant_id: z.string().uuid(),
  qty: z.number().int().positive(),
  unit_price_xof: z.number().int().nonnegative(),
});

const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  discount_xof: z.number().int().nonnegative().default(0),
  discount_reason: z.string().trim().optional().nullable(),
  payment_method: z.enum(['cash', 'card', 'mobile_money', 'other']),
  payment_other: z.string().trim().optional().nullable(),
  seller_name: z.string().trim().min(1),
  customer_name: z.string().trim().optional().nullable(),
  customer_email: z.string().trim().optional().nullable(),
  customer_phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export interface CreateSaleResult {
  ok: boolean;
  error?: string;
  saleId?: string;
  invoiceNo?: number;
  total_xof?: number;
}

export async function createSale(input: z.infer<typeof saleSchema>): Promise<CreateSaleResult> {
  await requireUser();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const v = parsed.data;

  const supabase = createAdminClient();

  // Fetch variants to resolve brand, cost, commission, stock.
  const variantIds = v.items.map((it) => it.variant_id);
  const { data: variants, error: varErr } = await supabase
    .from('variants')
    .select('id, brand_id, stock_qty, brands!inner(id, name, type, commission_pct)')
    .in('id', variantIds);
  if (varErr || !variants) return { ok: false, error: varErr?.message ?? 'Variants not found' };
  if (variants.length !== v.items.length) return { ok: false, error: 'Some items are no longer available' };

  const variantMap = new Map<string, any>();
  for (const va of variants) variantMap.set(va.id, va);

  // Stock check
  for (const it of v.items) {
    const va = variantMap.get(it.variant_id);
    if (!va) return { ok: false, error: 'Variant missing' };
    if (va.stock_qty < it.qty) return { ok: false, error: `Out of stock: ${va.brands.name}` };
  }

  const subtotal = v.items.reduce((s, it) => s + it.qty * it.unit_price_xof, 0);
  const total = Math.max(0, subtotal - v.discount_xof);

  // Active cycle
  const { data: cycle } = await supabase.from('cycles').select('id').eq('is_active', true).maybeSingle();

  // Upsert customer (dedup by email first, then by phone)
  let customerId: string | null = null;
  const email = (v.customer_email ?? '').trim() || null;
  const phone = (v.customer_phone ?? '').trim() || null;
  if (email || phone || v.customer_name) {
    let existing: { id: string } | null = null;
    if (email) {
      const { data } = await supabase.from('customers').select('id').eq('email', email).maybeSingle();
      existing = data as { id: string } | null;
    }
    if (!existing && phone) {
      const { data } = await supabase.from('customers').select('id').eq('phone', phone).maybeSingle();
      existing = data as { id: string } | null;
    }
    if (existing) {
      customerId = existing.id;
      await supabase.from('customers').update({
        name: v.customer_name ?? undefined,
        email: email ?? undefined,
        phone: phone ?? undefined,
      }).eq('id', existing.id);
    } else {
      const { data } = await supabase
        .from('customers')
        .insert({ name: v.customer_name, email, phone })
        .select('id')
        .single();
      customerId = (data as { id: string } | null)?.id ?? null;
    }
  }

  // Insert sale
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      cycle_id: cycle?.id ?? null,
      subtotal_xof: subtotal,
      discount_xof: v.discount_xof,
      discount_reason: v.discount_reason,
      total_xof: total,
      payment_method: v.payment_method,
      payment_other: v.payment_other,
      seller_name: v.seller_name,
      customer_id: customerId,
      customer_name: v.customer_name,
      customer_email: email,
      customer_phone: phone,
      // customer_contact kept for back-compat: mirror whichever is set
      customer_contact: email ?? phone ?? null,
      notes: v.notes,
    })
    .select('id, invoice_no, created_at')
    .single();
  if (saleErr || !sale) return { ok: false, error: saleErr?.message ?? 'Could not create sale' };

  // Insert sale_items + decrement stock + stock_movement
  for (const it of v.items) {
    const va = variantMap.get(it.variant_id)!;
    const commissionPct = va.brands.type === 'consignment' ? va.brands.commission_pct ?? 0 : 0;
    const commissionXof = Math.round(it.qty * it.unit_price_xof * (commissionPct / 100));

    const { error: siErr } = await supabase.from('sale_items').insert({
      sale_id: sale.id,
      variant_id: it.variant_id,
      brand_id: va.brand_id,
      qty: it.qty,
      unit_price_xof: it.unit_price_xof,
      commission_pct: va.brands.type === 'consignment' ? commissionPct : null,
      commission_xof: commissionXof,
      item_type: va.brands.type,
    });
    if (siErr) return { ok: false, error: siErr.message };

    await supabase
      .from('variants')
      .update({ stock_qty: va.stock_qty - it.qty })
      .eq('id', it.variant_id);

    if (cycle) {
      const { data: mv } = await supabase
        .from('stock_movements')
        .select('id, qty_sold')
        .eq('variant_id', it.variant_id)
        .eq('cycle_id', cycle.id)
        .maybeSingle();
      if (mv) {
        await supabase.from('stock_movements').update({ qty_sold: mv.qty_sold + it.qty }).eq('id', mv.id);
      } else {
        await supabase.from('stock_movements').insert({
          variant_id: it.variant_id,
          brand_id: va.brand_id,
          cycle_id: cycle.id,
          qty_sent: 0,
          qty_confirmed: 0,
          qty_sold: it.qty,
          qty_returned: 0,
        });
      }
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/brands');
  revalidatePath('/admin/stock');

  return { ok: true, saleId: sale.id, invoiceNo: sale.invoice_no, total_xof: total };
}

export async function sendInvoiceEmail(params: {
  saleId: string;
  to?: string;
}): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'Resend not configured' };

  const supabase = createAdminClient();
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, invoice_no, created_at, subtotal_xof, discount_xof, discount_reason, total_xof, payment_method, seller_name, customer_name, customer_contact')
    .eq('id', params.saleId)
    .maybeSingle();
  if (saleErr || !sale) return { ok: false, error: 'Sale not found' };

  const { data: items } = await supabase
    .from('sale_items')
    .select('qty, unit_price_xof, variants!inner(sku, products!inner(name)), brands!inner(name)')
    .eq('sale_id', params.saleId);

  const formatted = (items ?? []).map((it: any) => ({
    name: it.variants.products.name,
    brand: it.brands.name,
    sku: it.variants.sku,
    qty: it.qty,
    unit_price_xof: it.unit_price_xof,
    line_total_xof: it.qty * it.unit_price_xof,
  }));

  const formattedDate = new Date(sale.created_at).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });

  const itemCount = formatted.reduce((s, it) => s + it.qty, 0);
  const [html, pdfBuffer] = await Promise.all([
    render(
      InvoiceEmail({
        invoiceNo: sale.invoice_no,
        date: formattedDate,
        itemCount,
        total: sale.total_xof,
        customerName: (sale as any).customer_name ?? null,
      }),
    ),
    renderToBuffer(
      InvoicePdf({
        invoiceNo: sale.invoice_no,
        date: formattedDate,
        items: formatted,
        subtotal: sale.subtotal_xof,
        discount: sale.discount_xof,
        discountReason: sale.discount_reason,
        total: sale.total_xof,
        paymentMethod: sale.payment_method,
        sellerName: sale.seller_name,
        customerName: (sale as any).customer_name ?? null,
      }) as any,
    ),
  ]);

  const toList = [resendConfig.adminNotify];
  if (params.to) toList.push(params.to);

  try {
    await getResend().emails.send({
      from: resendConfig.from,
      to: toList,
      subject: `Thank you for your purchase at Tibi Concept Store — Invoice #${sale.invoice_no}`,
      html,
      attachments: [
        {
          filename: `tibi-invoice-${sale.invoice_no}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Send failed' };
  }
}

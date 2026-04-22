'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';

const schema = z.object({
  variant_id: z.string().uuid(),
  new_qty: z.coerce.number().int().nonnegative(),
  reason: z.enum(['damaged', 'lost', 'theft', 'correction', 'other']),
  notes: z.string().trim().optional().nullable(),
});

export type AdjustResult = { ok: true; new_stock: number } | { ok: false; error: string };

export async function adjustVariantStock(input: z.infer<typeof schema>): Promise<AdjustResult> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const v = parsed.data;

  const supabase = createAdminClient();

  const { data: variant, error: vErr } = await supabase
    .from('variants')
    .select('id, stock_qty')
    .eq('id', v.variant_id)
    .maybeSingle();
  if (vErr || !variant) return { ok: false, error: 'Variant not found' };

  const delta = v.new_qty - variant.stock_qty;

  const { error: adjErr } = await supabase.from('stock_adjustments').insert({
    variant_id: v.variant_id,
    delta_qty: delta,
    reason: v.reason,
    notes: v.notes ?? null,
    created_by: user.displayName ?? user.email ?? 'admin',
  });
  if (adjErr) return { ok: false, error: adjErr.message };

  const { error: updErr } = await supabase
    .from('variants')
    .update({ stock_qty: v.new_qty })
    .eq('id', v.variant_id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/stock');
  revalidatePath('/admin');

  return { ok: true, new_stock: v.new_qty };
}

export interface AdjustmentRow {
  id: string;
  delta_qty: number;
  reason: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export async function listAdjustmentsForVariant(variantId: string): Promise<AdjustmentRow[]> {
  await requireUser();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('stock_adjustments')
    .select('id, delta_qty, reason, notes, created_by, created_at')
    .eq('variant_id', variantId)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []) as AdjustmentRow[];
}

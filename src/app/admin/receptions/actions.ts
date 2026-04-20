'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';

export async function confirmReception(movementId: string, qtyConfirmed: number) {
  await requireUser();
  if (!Number.isInteger(qtyConfirmed) || qtyConfirmed < 0) {
    return { ok: false as const, error: 'Invalid quantity' };
  }
  const supabase = createAdminClient();

  const { data: mv, error: mvErr } = await supabase
    .from('stock_movements')
    .select('id, variant_id, qty_sent, qty_confirmed')
    .eq('id', movementId)
    .maybeSingle();
  if (mvErr || !mv) return { ok: false as const, error: 'Movement not found' };

  const delta = qtyConfirmed - mv.qty_confirmed;

  const { error: updErr } = await supabase
    .from('stock_movements')
    .update({ qty_confirmed: qtyConfirmed })
    .eq('id', movementId);
  if (updErr) return { ok: false as const, error: updErr.message };

  // Increment variant stock by the delta (not absolute — might have partial confirms)
  const { data: v } = await supabase
    .from('variants')
    .select('stock_qty')
    .eq('id', mv.variant_id)
    .single();
  const newStock = Math.max(0, (v?.stock_qty ?? 0) + delta);
  await supabase.from('variants').update({ stock_qty: newStock }).eq('id', mv.variant_id);

  revalidatePath('/admin');
  revalidatePath('/admin/receptions');
  revalidatePath('/stock');
  return { ok: true as const };
}

export async function confirmAllPendingForBrand(brandId: string) {
  await requireUser();
  const supabase = createAdminClient();

  const { data: allMovements } = await supabase
    .from('stock_movements')
    .select('id, variant_id, qty_sent, qty_confirmed')
    .eq('brand_id', brandId);

  if (!allMovements) return { ok: false as const, error: 'Query failed' };
  const pending = (allMovements as Array<{ id: string; variant_id: string; qty_sent: number; qty_confirmed: number }>)
    .filter((m) => m.qty_confirmed < m.qty_sent);

  for (const mv of pending) {
    const delta = mv.qty_sent - mv.qty_confirmed;
    await supabase.from('stock_movements').update({ qty_confirmed: mv.qty_sent }).eq('id', mv.id);
    const { data: v } = await supabase.from('variants').select('stock_qty').eq('id', mv.variant_id).single();
    await supabase.from('variants').update({ stock_qty: (v?.stock_qty ?? 0) + delta }).eq('id', mv.variant_id);
  }

  revalidatePath('/admin');
  revalidatePath('/admin/receptions');
  revalidatePath('/stock');
  return { ok: true as const, count: pending.length };
}

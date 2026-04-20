'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

export async function updateRate(currency: string, rate: number) {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from('exchange_rates')
    .update({ rate_to_xof: rate, updated_at: new Date().toISOString() })
    .eq('currency_code', currency);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/settings');
  return { ok: true };
}

const cycleSchema = z.object({
  name: z.string().trim().min(1),
  start_date: z.string(),
  end_date: z.string(),
});

export async function createCycle(input: z.infer<typeof cycleSchema>) {
  await requireAdmin();
  const v = cycleSchema.parse(input);
  const supabase = createClient();
  const { error } = await supabase.from('cycles').insert({ ...v, is_active: false });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function activateCycle(id: string) {
  await requireAdmin();
  const supabase = createClient();
  // Single-active constraint: first deactivate all, then activate target.
  await supabase.from('cycles').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('cycles').update({ is_active: true }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin');
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function updateSetting(key: string, value: unknown) {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function createEmployee(name: string) {
  await requireAdmin();
  if (!name.trim()) return { ok: false, error: 'Name required' };
  const supabase = createClient();
  const { error } = await supabase.from('employees').insert({ name: name.trim() });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function setEmployeeActive(id: string, isActive: boolean) {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from('employees').update({ is_active: isActive }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/settings');
  return { ok: true };
}

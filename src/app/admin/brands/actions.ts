'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import type { BrandType } from '@/lib/supabase/types';

const brandSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  country: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  instagram: z.string().trim().optional().nullable(),
  currency: z.enum(['XOF', 'NGN', 'GHS', 'MAD', 'USD', 'EUR']),
  commission_pct: z
    .string()
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (!Number.isNaN(v) && v >= 0 && v <= 100), 'Commission must be 0–100'),
  type: z.enum(['consignment', 'wholesale', 'own_label']),
  notes: z.string().trim().optional().nullable(),
});

function valuesFromForm(fd: FormData) {
  return {
    name: fd.get('name')?.toString() ?? '',
    country: fd.get('country')?.toString() || null,
    category: fd.get('category')?.toString() || null,
    email: fd.get('email')?.toString() || '',
    instagram: fd.get('instagram')?.toString() || null,
    currency: (fd.get('currency')?.toString() ?? 'XOF') as 'XOF' | 'NGN' | 'GHS' | 'MAD' | 'USD' | 'EUR',
    commission_pct: fd.get('commission_pct')?.toString() ?? '',
    type: (fd.get('type')?.toString() ?? 'consignment') as BrandType,
    notes: fd.get('notes')?.toString() || null,
  };
}

export interface FormState {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ReturnType<typeof valuesFromForm>, string>>;
}

export async function createBrand(_prev: FormState, fd: FormData): Promise<FormState & { redirectTo?: string }> {
  await requireAdmin();
  const parsed = brandSchema.safeParse(valuesFromForm(fd));
  if (!parsed.success) {
    const fieldErrors: FormState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0] as keyof ReturnType<typeof valuesFromForm>;
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Check the form', fieldErrors };
  }
  const v = parsed.data;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('brands')
    .insert({
      name: v.name,
      country: v.country,
      category: v.category,
      email: v.email || null,
      instagram: v.instagram,
      currency: v.currency,
      commission_pct: v.commission_pct,
      commission_status: v.commission_pct != null ? 'confirmed' : 'pending',
      type: v.type,
      has_dashboard: v.type === 'consignment',
      notes: v.notes,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  revalidatePath('/admin/brands');
  return { ok: true, redirectTo: `/admin/brands/${data.id}` };
}

export async function updateBrand(brandId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = brandSchema.safeParse(valuesFromForm(fd));
  if (!parsed.success) {
    const fieldErrors: FormState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0] as keyof ReturnType<typeof valuesFromForm>;
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Check the form', fieldErrors };
  }
  const v = parsed.data;
  const supabase = createClient();
  const { error } = await supabase
    .from('brands')
    .update({
      name: v.name,
      country: v.country,
      category: v.category,
      email: v.email || null,
      instagram: v.instagram,
      currency: v.currency,
      commission_pct: v.commission_pct,
      type: v.type,
      has_dashboard: v.type === 'consignment',
      notes: v.notes,
    })
    .eq('id', brandId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  revalidatePath('/admin/brands');
  revalidatePath(`/admin/brands/${brandId}`);
  return { ok: true };
}

export async function setCommissionPct(brandId: string, pct: number | null): Promise<FormState> {
  await requireAdmin();
  if (pct !== null && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
    return { ok: false, error: 'Commission must be 0–100' };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('brands')
    .update({ commission_pct: pct, commission_status: pct != null ? 'confirmed' : 'pending' })
    .eq('id', brandId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/brands/${brandId}`);
  revalidatePath('/admin/brands');
  return { ok: true };
}

export async function setActive(brandId: string, isActive: boolean): Promise<FormState> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from('brands').update({ is_active: isActive }).eq('id', brandId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/brands');
  revalidatePath(`/admin/brands/${brandId}`);
  return { ok: true };
}

export async function recordBrandPayment(params: {
  brandId: string;
  cycleId: string;
  amount_xof: number;
  notes: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!Number.isInteger(params.amount_xof) || params.amount_xof <= 0) {
    return { ok: false, error: 'Amount must be positive' };
  }
  const supabase = createClient();
  const { error } = await supabase.from('brand_payments').insert({
    brand_id: params.brandId,
    cycle_id: params.cycleId,
    amount_xof: params.amount_xof,
    notes: params.notes,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/brands/${params.brandId}`);
  revalidatePath('/admin');
  revalidatePath('/admin/reports');
  return { ok: true };
}

export async function regenerateShareToken(brandId: string): Promise<FormState> {
  await requireAdmin();
  const supabase = createClient();
  // Use pgcrypto via a simple UUID-like token client-side.
  const token = crypto.randomUUID().replace(/-/g, '');
  const { error } = await supabase.from('brands').update({ share_token: token }).eq('id', brandId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/brands/${brandId}`);
  return { ok: true };
}

/**
 * Close the current cycle for a brand by marking selected variants as
 * returned to the brand. Those variants:
 *  - get returned_at = now() (hidden from POS + brand dashboard stock)
 *  - keep historical sales intact (sale_items reference the row)
 * The variants that AREN'T included in this call stay active → they
 * automatically roll over into the next cycle (no action needed).
 */
export async function returnVariantsToBrand(params: {
  brand_id: string;
  variant_ids: string[];
}): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireAdmin();
  if (params.variant_ids.length === 0) {
    return { ok: false, error: 'Select at least one variant.' };
  }
  const supabase = createClient();

  // Safety: only allow returning variants that belong to the brand
  const { data: check } = await supabase
    .from('variants')
    .select('id, brand_id, stock_qty')
    .eq('brand_id', params.brand_id)
    .in('id', params.variant_ids);
  const safe = (check ?? []) as Array<{ id: string; brand_id: string; stock_qty: number }>;
  if (safe.length !== params.variant_ids.length) {
    return { ok: false, error: 'Some variants do not belong to this brand.' };
  }

  const { error } = await supabase
    .from('variants')
    .update({ returned_at: new Date().toISOString(), stock_qty: 0 })
    .in('id', params.variant_ids);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/brands/${params.brand_id}`);
  revalidatePath('/admin');
  revalidatePath('/stock');
  revalidatePath('/pos');
  return { ok: true, count: params.variant_ids.length };
}

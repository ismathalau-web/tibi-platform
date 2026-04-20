'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';
import type { PreorderStatus } from '@/lib/supabase/types';
import { buildSku } from '@/lib/sku';

const itemSchema = z.object({
  variant_id: z.string().uuid(),
  qty: z.number().int().positive(),
  unit_price_xof: z.number().int().nonnegative(),
});

const createSchema = z.object({
  customer_name: z.string().trim().min(1, 'Customer name required'),
  customer_email: z.string().trim().email('Valid email required'),
  customer_phone: z.string().trim().min(4, 'Phone required'),
  deposit_xof: z.coerce.number().int().nonnegative().default(0),
  notes: z.string().trim().optional().nullable(),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
});

/**
 * Minimum deposit ratio on pre-orders. At 30% a reservation feels committed
 * enough that customers actually come back to collect.
 */
const MIN_DEPOSIT_PCT = 30;

export async function createPreorder(input: z.infer<typeof createSchema>) {
  await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const v = parsed.data;

  const supabase = createAdminClient();

  const total = v.items.reduce((s, it) => s + it.qty * it.unit_price_xof, 0);
  const minDeposit = Math.ceil(total * (MIN_DEPOSIT_PCT / 100));
  if (v.deposit_xof < minDeposit) {
    return {
      ok: false as const,
      error: `Deposit must be at least ${MIN_DEPOSIT_PCT}% of the total (${minDeposit.toLocaleString('en').replace(/,/g, ' ')} XOF).`,
    };
  }
  const balance = Math.max(0, total - v.deposit_xof);

  // Upsert customer
  let existing: { id: string } | null = null;
  {
    const { data } = await supabase.from('customers').select('id').eq('email', v.customer_email).maybeSingle();
    existing = data as { id: string } | null;
  }
  if (!existing) {
    const { data } = await supabase.from('customers').select('id').eq('phone', v.customer_phone).maybeSingle();
    existing = data as { id: string } | null;
  }
  if (existing) {
    await supabase.from('customers').update({
      name: v.customer_name,
      email: v.customer_email,
      phone: v.customer_phone,
    }).eq('id', existing.id);
  } else {
    await supabase.from('customers').insert({
      name: v.customer_name,
      email: v.customer_email,
      phone: v.customer_phone,
    });
  }

  // Store legacy variant_id = first item's variant so old code paths still work
  const firstVariantId = v.items[0].variant_id;

  const { data: preorder, error: poErr } = await supabase
    .from('preorders')
    .insert({
      variant_id: firstVariantId,
      customer_name: v.customer_name,
      customer_email: v.customer_email,
      customer_phone: v.customer_phone,
      customer_contact: v.customer_phone,
      deposit_xof: v.deposit_xof,
      balance_xof: balance,
      total_xof: total,
      status: 'pending',
      notes: v.notes,
    })
    .select('id')
    .single();
  if (poErr || !preorder) return { ok: false as const, error: poErr?.message ?? 'Save failed' };

  const { error: itemsErr } = await supabase.from('preorder_items').insert(
    v.items.map((it) => ({
      preorder_id: preorder.id,
      variant_id: it.variant_id,
      qty: it.qty,
      unit_price_xof: it.unit_price_xof,
    })),
  );
  if (itemsErr) return { ok: false as const, error: itemsErr.message };

  revalidatePath('/admin/preorders');
  return { ok: true as const, preorderId: preorder.id };
}

export async function setPreorderStatus(id: string, status: PreorderStatus) {
  await requireUser();
  const supabase = createAdminClient();
  const { error } = await supabase.from('preorders').update({ status }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/preorders');
  return { ok: true };
}

/**
 * Quick-add — create a product + variant on the fly so sellers can
 * pre-order something that does not exist in the catalog yet.
 * stock_qty is set to 0 (the item hasn't physically arrived).
 */
const quickAddSchema = z.object({
  brand_id: z.string().uuid(),
  product_name: z.string().trim().min(1),
  category: z.string().trim().optional().nullable(),
  size: z.string().trim().optional().nullable(),
  color: z.string().trim().optional().nullable(),
  retail_price_xof: z.coerce.number().int().nonnegative(),
});

export async function quickAddVariant(input: z.infer<typeof quickAddSchema>) {
  await requireUser();
  const v = quickAddSchema.parse(input);
  const supabase = createAdminClient();

  const { data: brand } = await supabase.from('brands').select('id, name').eq('id', v.brand_id).maybeSingle();
  if (!brand) return { ok: false as const, error: 'Brand not found' };

  const { count } = await supabase
    .from('variants')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brand.id);
  const seq = (count ?? 0) + 1;

  const { data: product, error: prodErr } = await supabase
    .from('products')
    .insert({ brand_id: brand.id, name: v.product_name, category: v.category })
    .select('id')
    .single();
  if (prodErr || !product) return { ok: false as const, error: prodErr?.message ?? 'Product save failed' };

  const sku = buildSku({ brandName: brand.name, num: seq, size: v.size ?? null, color: v.color ?? null });
  const { data: variant, error: varErr } = await supabase
    .from('variants')
    .insert({
      product_id: product.id,
      brand_id: brand.id,
      sku,
      size: v.size ?? null,
      color: v.color ?? null,
      retail_price_xof: v.retail_price_xof,
      stock_qty: 0,
      status: 'active',
    })
    .select('id, sku, retail_price_xof')
    .single();
  if (varErr || !variant) return { ok: false as const, error: varErr?.message ?? 'Variant save failed' };

  revalidatePath('/stock');
  revalidatePath('/admin');

  return {
    ok: true as const,
    variant: {
      variant_id: variant.id,
      sku: variant.sku,
      retail_price_xof: variant.retail_price_xof,
      product_name: v.product_name,
      brand_name: brand.name,
      size: v.size ?? null,
      color: v.color ?? null,
    },
  };
}

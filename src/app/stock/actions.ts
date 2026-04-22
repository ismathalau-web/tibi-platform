'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireUser } from '@/lib/auth';
import { nextBrandSkuSeq } from '@/lib/data/variants';
import { buildSku } from '@/lib/sku';

const variantSchema = z.object({
  size: z.string().trim().optional().nullable(),
  color: z.string().trim().optional().nullable(),
  retail_price_xof: z.coerce.number().int().nonnegative(),
  wholesale_cost_xof: z
    .string()
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (!Number.isNaN(v) && v >= 0), 'Invalid cost'),
  stock_qty: z.coerce.number().int().nonnegative().default(0),
});

const createItemSchema = z.object({
  brand_id: z.string().uuid(),
  product_name: z.string().trim().min(1),
  category: z.string().trim().optional().nullable(),
  variants: z.array(variantSchema).min(1),
});

export interface FormState { ok: boolean; error?: string; redirectTo?: string }

export async function createItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();

  const variantsRaw: Array<{ size: string; color: string; retail_price_xof: string; wholesale_cost_xof: string; stock_qty: string }> = [];
  for (let i = 0; ; i++) {
    const size = fd.get(`variants[${i}].size`);
    if (size === null) break;
    variantsRaw.push({
      size: size.toString(),
      color: fd.get(`variants[${i}].color`)?.toString() ?? '',
      retail_price_xof: fd.get(`variants[${i}].retail_price_xof`)?.toString() ?? '',
      wholesale_cost_xof: fd.get(`variants[${i}].wholesale_cost_xof`)?.toString() ?? '',
      stock_qty: fd.get(`variants[${i}].stock_qty`)?.toString() ?? '0',
    });
  }

  const parsed = createItemSchema.safeParse({
    brand_id: fd.get('brand_id')?.toString() ?? '',
    product_name: fd.get('product_name')?.toString() ?? '',
    category: fd.get('category')?.toString() || null,
    variants: variantsRaw.map((v) => ({
      size: v.size || null,
      color: v.color || null,
      retail_price_xof: v.retail_price_xof,
      wholesale_cost_xof: v.wholesale_cost_xof,
      stock_qty: v.stock_qty || '0',
    })),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const v = parsed.data;

  const supabase = createClient();

  const { data: brand, error: brandErr } = await supabase
    .from('brands')
    .select('id, name, type')
    .eq('id', v.brand_id)
    .maybeSingle();
  if (brandErr || !brand) return { ok: false, error: 'Brand not found' };

  const { data: product, error: prodErr } = await supabase
    .from('products')
    .insert({ brand_id: brand.id, name: v.product_name, category: v.category })
    .select('id')
    .single();
  if (prodErr) return { ok: false, error: prodErr.message };

  // Generate SKUs sequentially starting from current count+1
  let seq = await nextBrandSkuSeq(brand.id);
  const toInsert = v.variants.map((variant) => {
    const sku = buildSku({ brandName: brand.name, num: seq++, size: variant.size ?? null, color: variant.color ?? null });
    return {
      product_id: product.id,
      brand_id: brand.id,
      sku,
      size: variant.size,
      color: variant.color,
      retail_price_xof: variant.retail_price_xof,
      wholesale_cost_xof:
        brand.type === 'consignment' || user.role !== 'admin'
          ? null
          : variant.wholesale_cost_xof,
      stock_qty: variant.stock_qty,
      status: 'active' as const,
    };
  });

  const { error: variantsErr } = await supabase.from('variants').insert(toInsert);
  if (variantsErr) return { ok: false, error: variantsErr.message };

  revalidatePath('/stock');
  revalidatePath('/admin');
  revalidatePath(`/admin/brands/${brand.id}`);
  return { ok: true, redirectTo: '/stock' };
}

export async function setVariantStatus(variantId: string, status: 'active' | 'out_of_stock' | 'discontinued') {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from('variants').update({ status }).eq('id', variantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/stock');
  return { ok: true };
}

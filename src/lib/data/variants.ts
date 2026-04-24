import { createClient } from '@/lib/supabase/server';
import type { Brand, Product, Variant } from '@/lib/supabase/types';

export interface VariantRow extends Variant {
  product: Pick<Product, 'name' | 'category'>;
  brand: Pick<Brand, 'id' | 'name' | 'type'>;
}

export async function listVariants(filters?: {
  brandId?: string;
  category?: string;
  type?: Brand['type'];
  status?: Variant['status'];
}): Promise<VariantRow[]> {
  const supabase = createClient();
  let q = supabase
    .from('variants')
    .select('*, product:products(name, category), brand:brands!inner(id, name, type)')
    .is('returned_at', null) // hide end-of-cycle returned variants from active stock
    .order('created_at', { ascending: false });
  if (filters?.brandId) q = q.eq('brand_id', filters.brandId);
  if (filters?.category) q = q.eq('product.category', filters.category);
  if (filters?.type) q = q.eq('brand.type', filters.type);
  if (filters?.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as VariantRow[];
}

export async function nextBrandSkuSeq(brandId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('variants')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId);
  if (error) throw error;
  return (count ?? 0) + 1;
}

// Re-export pure helpers so existing imports keep working. Client components
// should import from '@/lib/sku' directly.
export { brandCode, tokenize, buildSku } from '@/lib/sku';

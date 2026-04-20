import { createClient } from '@/lib/supabase/server';
import type { Employee, Variant } from '@/lib/supabase/types';

export interface PosItem {
  variant_id: string;
  product_id: string;
  brand_id: string;
  product_name: string;
  category: string | null;
  brand_name: string;
  brand_type: 'consignment' | 'wholesale' | 'own_label';
  commission_pct: number | null;
  sku: string;
  size: string | null;
  color: string | null;
  retail_price_xof: number;
  stock_qty: number;
}

/**
 * Flat list of all catalog variants shown in the POS. Sold-out items are
 * included so sellers see the item exists — the UI marks them non-sellable.
 * Discontinued items are excluded entirely.
 */
export async function loadPosCatalog(): Promise<PosItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('variants')
    .select(
      'id, product_id, brand_id, sku, size, color, retail_price_xof, stock_qty, status, products!inner(name, category), brands!inner(name, type, is_active, commission_pct)',
    )
    .eq('status', 'active')
    .eq('brands.is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    variant_id: row.id,
    product_id: row.product_id,
    brand_id: row.brand_id,
    product_name: row.products.name,
    category: row.products.category,
    brand_name: row.brands.name,
    brand_type: row.brands.type,
    commission_pct: row.brands.commission_pct,
    sku: row.sku,
    size: row.size,
    color: row.color,
    retail_price_xof: row.retail_price_xof,
    stock_qty: row.stock_qty,
  }));
}

export async function listActiveEmployees(): Promise<Employee[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Employee[];
}

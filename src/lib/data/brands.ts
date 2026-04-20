import { createClient } from '@/lib/supabase/server';
import type { Brand, BrandType, CommissionStatus, Cycle } from '@/lib/supabase/types';

export async function listBrands(): Promise<Brand[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('is_active', true)
    .order('type', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Brand[];
}

export async function getBrand(id: string): Promise<Brand | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from('brands').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Brand) ?? null;
}

export async function getActiveCycle(): Promise<Cycle | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return (data as Cycle) ?? null;
}

/**
 * Per-brand stats for current cycle:
 *   stock   — items confirmed in cycle
 *   sold    — items sold in cycle
 *   balance — unpaid balance due (consignment only)
 */
export interface BrandRow {
  brand: Brand;
  stock: number;
  sold: number;
  balance_due_xof: number;
}

export async function listBrandsWithStats(): Promise<BrandRow[]> {
  const supabase = createClient();
  const [brandsRes, cycleRes] = await Promise.all([
    supabase.from('brands').select('*').eq('is_active', true).order('type', { ascending: false }).order('name'),
    supabase.from('cycles').select('*').eq('is_active', true).maybeSingle(),
  ]);
  if (brandsRes.error) throw brandsRes.error;
  const brands = (brandsRes.data ?? []) as Brand[];
  const cycle = cycleRes.data as Cycle | null;

  if (!cycle) {
    return brands.map((b) => ({ brand: b, stock: 0, sold: 0, balance_due_xof: 0 }));
  }

  const [variantsRes, saleItemsRes, paymentsRes] = await Promise.all([
    supabase.from('variants').select('brand_id, stock_qty').eq('status', 'active'),
    // Exclude voided sales from brand stats
    supabase
      .from('sale_items')
      .select('id, brand_id, qty, unit_price_xof, commission_xof, item_type, sales!inner(cycle_id, voided_at)')
      .eq('sales.cycle_id', cycle.id)
      .is('sales.voided_at', null)
      .eq('item_type', 'consignment'),
    supabase.from('brand_payments').select('brand_id, amount_xof').eq('cycle_id', cycle.id),
  ]);

  // Net sold per sale_item: subtract quantity returned
  const saleItemsList = (saleItemsRes.data ?? []) as any[];
  const returnedByItem = new Map<string, number>();
  if (saleItemsList.length > 0) {
    const { data: rs } = await supabase
      .from('returns')
      .select('sale_item_id, qty')
      .in('sale_item_id', saleItemsList.map((it) => it.id));
    for (const r of ((rs ?? []) as Array<{ sale_item_id: string; qty: number }>)) {
      returnedByItem.set(r.sale_item_id, (returnedByItem.get(r.sale_item_id) ?? 0) + r.qty);
    }
  }

  const stockByBrand = new Map<string, { stock: number; sold: number }>();
  for (const v of (variantsRes.data ?? []) as Array<{ brand_id: string; stock_qty: number }>) {
    const prev = stockByBrand.get(v.brand_id) ?? { stock: 0, sold: 0 };
    stockByBrand.set(v.brand_id, { stock: prev.stock + v.stock_qty, sold: prev.sold });
  }
  for (const si of saleItemsList as Array<{ id: string; brand_id: string; qty: number }>) {
    const returned = returnedByItem.get(si.id) ?? 0;
    const netQty = Math.max(0, si.qty - returned);
    const prev = stockByBrand.get(si.brand_id) ?? { stock: 0, sold: 0 };
    stockByBrand.set(si.brand_id, { stock: prev.stock, sold: prev.sold + netQty });
  }

  const balanceByBrand = new Map<string, number>();
  for (const si of saleItemsList as Array<{ id: string; brand_id: string; unit_price_xof: number; qty: number; commission_xof: number }>) {
    const returned = returnedByItem.get(si.id) ?? 0;
    const netQty = Math.max(0, si.qty - returned);
    // Brand is owed: net revenue - commission. Commission is already zeroed for fully-returned items.
    const gross = si.unit_price_xof * netQty - si.commission_xof;
    balanceByBrand.set(si.brand_id, (balanceByBrand.get(si.brand_id) ?? 0) + gross);
  }
  for (const p of (paymentsRes.data ?? []) as Array<{ brand_id: string; amount_xof: number }>) {
    balanceByBrand.set(p.brand_id, (balanceByBrand.get(p.brand_id) ?? 0) - p.amount_xof);
  }

  return brands.map((b) => {
    const s = stockByBrand.get(b.id);
    return {
      brand: b,
      stock: s?.stock ?? 0,
      sold: s?.sold ?? 0,
      balance_due_xof: Math.max(0, balanceByBrand.get(b.id) ?? 0),
    };
  });
}

export interface DashboardStats {
  active_brands: number;
  items_in_stock: number;
  cycle_gmv_xof: number;
  tibi_revenue_xof: number;
  total_due_to_brands_xof: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createClient();
  const [brandsRes, cycleRes] = await Promise.all([
    supabase.from('brands').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('cycles').select('*').eq('is_active', true).maybeSingle(),
  ]);

  const activeBrands = brandsRes.count ?? 0;
  const cycle = cycleRes.data as Cycle | null;
  if (!cycle) {
    return { active_brands: activeBrands, items_in_stock: 0, cycle_gmv_xof: 0, tibi_revenue_xof: 0, total_due_to_brands_xof: 0 };
  }

  const [variantsRes, salesRes, allItemsRes, paymentsRes] = await Promise.all([
    supabase.from('variants').select('stock_qty').eq('status', 'active'),
    // Exclude voided sales from cycle GMV
    supabase.from('sales').select('total_xof, voided_at').eq('cycle_id', cycle.id).is('voided_at', null),
    supabase
      .from('sale_items')
      .select('id, unit_price_xof, qty, commission_xof, item_type, sales!inner(cycle_id, voided_at)')
      .eq('sales.cycle_id', cycle.id)
      .is('sales.voided_at', null),
    supabase.from('brand_payments').select('amount_xof').eq('cycle_id', cycle.id),
  ]);

  const itemsInStock = ((variantsRes.data ?? []) as Array<{ stock_qty: number }>).reduce(
    (sum, v) => sum + v.stock_qty,
    0,
  );
  const grossCycleGmv = ((salesRes.data ?? []) as Array<{ total_xof: number }>).reduce((s, r) => s + r.total_xof, 0);

  // Deduct refunds that happened during this cycle from GMV
  const { data: cycleRefunds } = await supabase
    .from('returns')
    .select('refund_xof, sale_items!inner(sales!inner(cycle_id))')
    .eq('sale_items.sales.cycle_id', cycle.id);
  const cycleRefundsTotal = ((cycleRefunds ?? []) as Array<{ refund_xof: number }>)
    .reduce((s, r) => s + r.refund_xof, 0);
  const gmv = Math.max(0, grossCycleGmv - cycleRefundsTotal);

  // Net sold per sale_item for consignment/tibi revenue
  const itemsList = (allItemsRes.data ?? []) as any[];
  const returnedByItem = new Map<string, number>();
  if (itemsList.length > 0) {
    const { data: rs } = await supabase
      .from('returns')
      .select('sale_item_id, qty')
      .in('sale_item_id', itemsList.map((it) => it.id));
    for (const r of ((rs ?? []) as Array<{ sale_item_id: string; qty: number }>)) {
      returnedByItem.set(r.sale_item_id, (returnedByItem.get(r.sale_item_id) ?? 0) + r.qty);
    }
  }

  let consignmentOwed = 0;
  let tibiRevenue = 0;
  for (const it of itemsList as Array<{ id: string; unit_price_xof: number; qty: number; commission_xof: number; item_type: string }>) {
    const returned = returnedByItem.get(it.id) ?? 0;
    const netQty = Math.max(0, it.qty - returned);
    const netLine = it.unit_price_xof * netQty;
    if (it.item_type === 'consignment') {
      consignmentOwed += netLine - it.commission_xof;
      tibiRevenue += it.commission_xof;
    } else {
      // wholesale + own_label: Tibi keeps the full net price
      tibiRevenue += netLine;
    }
  }
  const paid = ((paymentsRes.data ?? []) as Array<{ amount_xof: number }>).reduce((s, p) => s + p.amount_xof, 0);

  return {
    active_brands: activeBrands,
    items_in_stock: Math.max(0, itemsInStock),
    cycle_gmv_xof: gmv,
    tibi_revenue_xof: tibiRevenue,
    total_due_to_brands_xof: Math.max(0, consignmentOwed - paid),
  };
}

export function brandTypeLabel(t: BrandType) {
  return t === 'consignment' ? 'Consignment' : t === 'wholesale' ? 'Wholesale' : 'Own Label';
}

export function commissionLabel(status: CommissionStatus) {
  return status === 'pending' ? 'Commission pending' : 'Commission confirmed';
}

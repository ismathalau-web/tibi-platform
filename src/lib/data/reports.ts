import { createClient } from '@/lib/supabase/server';
import type { Cycle } from '@/lib/supabase/types';

export type TimeBucket = 'day' | 'week' | 'month' | 'cycle' | 'year';

function cycleRange(cycle: Cycle | null): { since: Date; until: Date } {
  const now = new Date();
  if (!cycle) return { since: new Date(now.getFullYear(), 0, 1), until: now };
  return { since: new Date(cycle.start_date), until: new Date(cycle.end_date + 'T23:59:59') };
}

function bucketRange(b: TimeBucket, cycle: Cycle | null): { since: Date; until: Date } {
  const now = new Date();
  if (b === 'cycle') return cycleRange(cycle);
  if (b === 'year') return { since: new Date(now.getFullYear(), 0, 1), until: now };
  if (b === 'month') return { since: new Date(now.getFullYear(), now.getMonth(), 1), until: now };
  if (b === 'week') {
    const d = new Date(now);
    const day = d.getDay() || 7;
    if (day !== 1) d.setHours(-24 * (day - 1));
    d.setHours(0, 0, 0, 0);
    return { since: d, until: now };
  }
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return { since: d, until: now };
}

// ----------------------------------------------------------------------------
// SALES
// ----------------------------------------------------------------------------
export interface SalesReport {
  bucket: TimeBucket;
  since: string;
  until: string;
  /** Net GMV after refunds in the period */
  gmv_xof: number;
  /** Gross GMV (sum of non-voided sales total_xof) before refunds */
  gross_gmv_xof: number;
  /** Total refunded in the period (independent of sale date) */
  refunds_xof: number;
  refunds_count: number;
  /** Voided sales that occurred in this period */
  voided_xof: number;
  voided_count: number;
  tx_count: number;
  average_basket_xof: number;
  tibi_revenue_xof: number;
  gmv_series: Array<{ label: string; gmv_xof: number }>;
  by_payment: Array<{ method: string; total_xof: number }>;
  by_hour: Array<{ hour: number; total_xof: number }>;
  by_weekday: Array<{ weekday: number; total_xof: number }>;
  by_seller: Array<{ seller: string; tx: number; total_xof: number }>;
  top_items: Array<{ product: string; brand: string; qty: number; total_xof: number }>;
  /** Brands ranked by net GMV during the period — most useful "who sells" metric */
  top_brands: Array<{ brand: string; qty: number; total_xof: number }>;
  dormant: Array<{ variant_id: string; product: string; brand: string; sku: string; stock_qty: number; last_sale_days: number | null }>;
}

export async function getSalesReport(bucket: TimeBucket): Promise<SalesReport> {
  const supabase = createClient();
  const { data: cycle } = await supabase.from('cycles').select('*').eq('is_active', true).maybeSingle();
  const { since, until } = bucketRange(bucket, cycle);

  // Exclude voided sales from GMV and all stats — a voided sale did not happen.
  const { data: sales } = await supabase
    .from('sales')
    .select('id, total_xof, payment_method, seller_name, created_at, voided_at')
    .gte('created_at', since.toISOString())
    .lte('created_at', until.toISOString())
    .is('voided_at', null);

  const safeSales = (sales ?? []) as Array<{ id: string; total_xof: number; payment_method: string; seller_name: string; created_at: string }>;
  const grossGmv = safeSales.reduce((s, x) => s + x.total_xof, 0);
  const tx = safeSales.length;
  const avg = tx > 0 ? Math.round(grossGmv / tx) : 0;

  // Refunds that happened within the period (regardless of when the sale was created)
  const { data: refundsData } = await supabase
    .from('returns')
    .select('refund_xof, created_at')
    .gte('created_at', since.toISOString())
    .lte('created_at', until.toISOString());
  const refundsTotal = ((refundsData ?? []) as Array<{ refund_xof: number }>)
    .reduce((s, r) => s + r.refund_xof, 0);
  const refundsCount = (refundsData ?? []).length;

  // Voided sales that occurred within the period (for separate visibility)
  const { data: voidedData } = await supabase
    .from('sales')
    .select('id, total_xof, voided_at')
    .gte('voided_at', since.toISOString())
    .lte('voided_at', until.toISOString())
    .not('voided_at', 'is', null);
  const voidedTotal = ((voidedData ?? []) as Array<{ total_xof: number }>)
    .reduce((s, r) => s + r.total_xof, 0);
  const voidedCount = (voidedData ?? []).length;

  // Net GMV = gross sales - refunds in the period
  const netGmv = Math.max(0, grossGmv - refundsTotal);

  const byPayment = new Map<string, number>();
  const byHour = new Map<number, number>();
  const byWeekday = new Map<number, number>();
  const bySeller = new Map<string, { tx: number; total: number }>();
  const bySeries = new Map<string, number>();

  for (const s of safeSales) {
    byPayment.set(s.payment_method, (byPayment.get(s.payment_method) ?? 0) + s.total_xof);
    const d = new Date(s.created_at);
    byHour.set(d.getHours(), (byHour.get(d.getHours()) ?? 0) + s.total_xof);
    byWeekday.set(d.getDay(), (byWeekday.get(d.getDay()) ?? 0) + s.total_xof);
    const cur = bySeller.get(s.seller_name) ?? { tx: 0, total: 0 };
    bySeller.set(s.seller_name, { tx: cur.tx + 1, total: cur.total + s.total_xof });
    const key = bucket === 'day' || bucket === 'week'
      ? d.toISOString().slice(0, 10)
      : bucket === 'month'
        ? d.toISOString().slice(0, 10)
        : bucket === 'year'
          ? d.toISOString().slice(0, 7)
          : d.toISOString().slice(0, 10);
    bySeries.set(key, (bySeries.get(key) ?? 0) + s.total_xof);
  }

  // Top items (net of returns — if an item was returned, don't count those units)
  const saleIds = safeSales.map((s) => s.id);
  const topItems: SalesReport['top_items'] = [];
  let tibiRevenue = 0;
  if (saleIds.length > 0) {
    const { data: items } = await supabase
      .from('sale_items')
      .select('id, qty, unit_price_xof, commission_xof, item_type, variants!inner(products!inner(name)), brands!inner(name)')
      .in('sale_id', saleIds);
    const itemList = ((items ?? []) as any[]);

    // Fetch per-item returns to net out qty and revenue
    const returnedByItem = new Map<string, number>();
    if (itemList.length > 0) {
      const { data: rs } = await supabase
        .from('returns')
        .select('sale_item_id, qty')
        .in('sale_item_id', itemList.map((it) => it.id));
      for (const r of ((rs ?? []) as Array<{ sale_item_id: string; qty: number }>)) {
        returnedByItem.set(r.sale_item_id, (returnedByItem.get(r.sale_item_id) ?? 0) + r.qty);
      }
    }

    const byProduct = new Map<string, { product: string; brand: string; qty: number; total: number }>();
    const byBrand = new Map<string, { brand: string; qty: number; total: number }>();
    for (const it of itemList) {
      const returned = returnedByItem.get(it.id) ?? 0;
      const netQty = Math.max(0, (it.qty as number) - returned);
      const netLine = netQty * (it.unit_price_xof as number);
      const key = `${it.variants.products.name}__${it.brands.name}`;
      const cur = byProduct.get(key) ?? { product: it.variants.products.name, brand: it.brands.name, qty: 0, total: 0 };
      cur.qty += netQty;
      cur.total += netLine;
      byProduct.set(key, cur);
      const bcur = byBrand.get(it.brands.name) ?? { brand: it.brands.name, qty: 0, total: 0 };
      bcur.qty += netQty;
      bcur.total += netLine;
      byBrand.set(it.brands.name, bcur);
      // Tibi revenue: consignment = commission (already zeroed on full returns in processReturn);
      // wholesale / own_label = full net line
      if (it.item_type === 'consignment') tibiRevenue += it.commission_xof ?? 0;
      else tibiRevenue += netLine;
    }
    for (const [, v] of byProduct) {
      if (v.qty > 0) topItems.push({ product: v.product, brand: v.brand, qty: v.qty, total_xof: v.total });
    }
    // Sort by revenue (Tibi reality: low qty per variant, so revenue is the
    // meaningful ranking — a 100k boubou sold 1× tops a 5k accessory sold 3×)
    topItems.sort((a, b) => b.total_xof - a.total_xof);
  }

  // Top brands by net GMV — useful when low qty per variant makes per-item rankings noisy
  let topBrands: SalesReport['top_brands'] = [];
  if (saleIds.length > 0) {
    // Re-collect by brand from the same data
    const { data: items2 } = await supabase
      .from('sale_items')
      .select('id, qty, unit_price_xof, brands!inner(name)')
      .in('sale_id', saleIds);
    const itemList2 = ((items2 ?? []) as any[]);
    const returnedByItem2 = new Map<string, number>();
    if (itemList2.length > 0) {
      const { data: rs } = await supabase
        .from('returns')
        .select('sale_item_id, qty')
        .in('sale_item_id', itemList2.map((it) => it.id));
      for (const r of ((rs ?? []) as Array<{ sale_item_id: string; qty: number }>)) {
        returnedByItem2.set(r.sale_item_id, (returnedByItem2.get(r.sale_item_id) ?? 0) + r.qty);
      }
    }
    const byBrand = new Map<string, { brand: string; qty: number; total: number }>();
    for (const it of itemList2) {
      const returned = returnedByItem2.get(it.id) ?? 0;
      const netQty = Math.max(0, (it.qty as number) - returned);
      const netLine = netQty * (it.unit_price_xof as number);
      const cur = byBrand.get(it.brands.name) ?? { brand: it.brands.name, qty: 0, total: 0 };
      cur.qty += netQty;
      cur.total += netLine;
      byBrand.set(it.brands.name, cur);
    }
    topBrands = Array.from(byBrand.values())
      .filter((b) => b.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((b) => ({ brand: b.brand, qty: b.qty, total_xof: b.total }));
  }

  // Dormant stock
  const { data: allVariants } = await supabase
    .from('variants')
    .select('id, stock_qty, sku, products!inner(name), brands!inner(name)')
    .eq('status', 'active')
    .gt('stock_qty', 0);
  const variantLastSold = new Map<string, string>();
  if ((allVariants ?? []).length > 0) {
    const { data: sis } = await supabase
      .from('sale_items')
      .select('variant_id, sales!inner(created_at)')
      .order('sales(created_at)', { ascending: false });
    for (const si of (sis ?? []) as any[]) {
      if (!variantLastSold.has(si.variant_id)) variantLastSold.set(si.variant_id, si.sales.created_at);
    }
  }
  const dormant: SalesReport['dormant'] = [];
  const dormancyDays = 30;
  const now = Date.now();
  for (const v of (allVariants ?? []) as any[]) {
    const lastStr = variantLastSold.get(v.id);
    const lastSaleDays = lastStr ? Math.floor((now - new Date(lastStr).getTime()) / 86400000) : null;
    if (lastSaleDays === null || lastSaleDays > dormancyDays) {
      dormant.push({
        variant_id: v.id,
        product: v.products.name,
        brand: v.brands.name,
        sku: v.sku,
        stock_qty: v.stock_qty,
        last_sale_days: lastSaleDays,
      });
    }
  }

  return {
    bucket,
    since: since.toISOString(),
    until: until.toISOString(),
    gmv_xof: netGmv,
    gross_gmv_xof: grossGmv,
    refunds_xof: refundsTotal,
    refunds_count: refundsCount,
    voided_xof: voidedTotal,
    voided_count: voidedCount,
    tx_count: tx,
    average_basket_xof: avg,
    tibi_revenue_xof: tibiRevenue,
    gmv_series: Array.from(bySeries.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, gmv_xof]) => ({ label, gmv_xof })),
    by_payment: Array.from(byPayment, ([method, total_xof]) => ({ method, total_xof })),
    by_hour: Array.from({ length: 24 }, (_, h) => ({ hour: h, total_xof: byHour.get(h) ?? 0 })),
    by_weekday: Array.from({ length: 7 }, (_, d) => ({ weekday: d, total_xof: byWeekday.get(d) ?? 0 })),
    by_seller: Array.from(bySeller, ([seller, v]) => ({ seller, tx: v.tx, total_xof: v.total })).sort((a, b) => b.total_xof - a.total_xof),
    top_items: topItems.slice(0, 10),
    top_brands: topBrands.slice(0, 10),
    dormant: dormant.slice(0, 50),
  };
}

// ----------------------------------------------------------------------------
// BRANDS report
// ----------------------------------------------------------------------------
export interface BrandsReport {
  cycle_label: string;
  rows: Array<{
    brand_id: string;
    name: string;
    type: 'consignment' | 'wholesale' | 'own_label';
    gmv_xof: number;
    units_sold: number;
    units_sent: number;
    sell_through_pct: number;
    commission_xof: number;
    avg_days_to_sell: number | null;
    stock_value_xof: number;
  }>;
}

export async function getBrandsReport(): Promise<BrandsReport> {
  const supabase = createClient();
  const { data: cycle } = await supabase.from('cycles').select('*').eq('is_active', true).maybeSingle();

  const [brandsRes, saleItemsRes, movementsRes, variantsRes] = await Promise.all([
    supabase.from('brands').select('id, name, type').eq('is_active', true),
    // Exclude voided sales — a voided sale was never truly sold.
    supabase
      .from('sale_items')
      .select('id, brand_id, qty, unit_price_xof, commission_xof, variant_id, sales!inner(cycle_id, created_at, voided_at)')
      .eq('sales.cycle_id', cycle?.id ?? '')
      .is('sales.voided_at', null),
    cycle
      ? supabase.from('stock_movements').select('brand_id, qty_confirmed').eq('cycle_id', cycle.id)
      : Promise.resolve({ data: [] as Array<{ brand_id: string; qty_confirmed: number }> } as const),
    supabase.from('variants').select('brand_id, stock_qty, retail_price_xof').eq('status', 'active'),
  ]);

  const brands = (brandsRes.data ?? []) as Array<{ id: string; name: string; type: BrandsReport['rows'][number]['type'] }>;
  const items = (saleItemsRes.data ?? []) as any[];
  const movements = (movementsRes.data ?? []) as Array<{ brand_id: string; qty_confirmed: number }>;
  const variants = (variantsRes.data ?? []) as Array<{ brand_id: string; stock_qty: number; retail_price_xof: number }>;

  // Returns per sale_item — to compute NET sold (gross minus returned)
  const saleItemIds = items.map((it: any) => it.id as string);
  const returnedByItem = new Map<string, number>();
  if (saleItemIds.length > 0) {
    const { data: rs } = await supabase
      .from('returns')
      .select('sale_item_id, qty')
      .in('sale_item_id', saleItemIds);
    for (const r of ((rs ?? []) as Array<{ sale_item_id: string; qty: number }>)) {
      returnedByItem.set(r.sale_item_id, (returnedByItem.get(r.sale_item_id) ?? 0) + r.qty);
    }
  }

  const metricsByBrand = new Map<string, {
    gmv: number; units: number; commission: number;
    daysSum: number; daysCount: number;
  }>();
  const variantFirstMovement = new Map<string, string>(); // variant_id -> stock_movement.created_at

  for (const it of items) {
    const returned = returnedByItem.get(it.id as string) ?? 0;
    const netQty = Math.max(0, (it.qty as number) - returned);
    const netLine = netQty * (it.unit_price_xof as number);
    const m = metricsByBrand.get(it.brand_id) ?? { gmv: 0, units: 0, commission: 0, daysSum: 0, daysCount: 0 };
    m.gmv += netLine;
    m.units += netQty;
    // commission_xof is zeroed out for fully-returned items by processReturn, so no double-count
    m.commission += (it.commission_xof as number) ?? 0;
    metricsByBrand.set(it.brand_id, m);
  }

  // Avg days to sell — approximate: first stock_movement.created_at to sale.created_at
  if (cycle) {
    const { data: mvs } = await supabase
      .from('stock_movements')
      .select('variant_id, created_at')
      .eq('cycle_id', cycle.id);
    for (const mv of (mvs ?? []) as Array<{ variant_id: string; created_at: string }>) {
      if (!variantFirstMovement.has(mv.variant_id)) variantFirstMovement.set(mv.variant_id, mv.created_at);
    }
    for (const it of items) {
      const first = variantFirstMovement.get(it.variant_id);
      if (!first) continue;
      const days = Math.max(0, Math.floor((new Date(it.sales.created_at).getTime() - new Date(first).getTime()) / 86400000));
      const m = metricsByBrand.get(it.brand_id)!;
      m.daysSum += days;
      m.daysCount += 1;
    }
  }

  const sentByBrand = new Map<string, number>();
  for (const m of movements) sentByBrand.set(m.brand_id, (sentByBrand.get(m.brand_id) ?? 0) + m.qty_confirmed);

  const stockValueByBrand = new Map<string, number>();
  for (const v of variants) {
    stockValueByBrand.set(v.brand_id, (stockValueByBrand.get(v.brand_id) ?? 0) + v.stock_qty * v.retail_price_xof);
  }

  const rows: BrandsReport['rows'] = brands.map((b) => {
    const m = metricsByBrand.get(b.id) ?? { gmv: 0, units: 0, commission: 0, daysSum: 0, daysCount: 0 };
    const sent = sentByBrand.get(b.id) ?? 0;
    return {
      brand_id: b.id,
      name: b.name,
      type: b.type,
      gmv_xof: m.gmv,
      units_sold: m.units,
      units_sent: sent,
      sell_through_pct: sent > 0 ? (m.units / sent) * 100 : 0,
      commission_xof: m.commission,
      avg_days_to_sell: m.daysCount > 0 ? Math.round(m.daysSum / m.daysCount) : null,
      stock_value_xof: stockValueByBrand.get(b.id) ?? 0,
    };
  }).sort((a, b) => b.gmv_xof - a.gmv_xof);

  return { cycle_label: cycle?.name ?? 'All time', rows };
}

// ----------------------------------------------------------------------------
// INVENTORY report
// ----------------------------------------------------------------------------
export interface InventoryReport {
  cycle_label: string;
  total_stock_value_xof: number;
  total_items_in_stock: number;
  total_balance_due_xof: number;
  alerts_count: number;
  alert_threshold: number;
  /** Brands whose total stock (across all variants) is at or below the threshold.
   * Per-variant stock is too noisy for Tibi's model (1-2 units per variant by design). */
  low_stock: Array<{ brand: string; total_stock: number }>;
  projection: { current_sell_rate_per_day: number; days_left: number; projected_end_of_cycle_gmv_xof: number } | null;
  cycle_vs_previous: { current: { name: string; gmv_xof: number }; previous: { name: string; gmv_xof: number } | null } | null;
}

export async function getInventoryReport(): Promise<InventoryReport> {
  const supabase = createClient();
  const { data: cycles } = await supabase.from('cycles').select('*').order('start_date', { ascending: false });
  const allCycles = (cycles ?? []) as Cycle[];
  const activeCycle = allCycles.find((c) => c.is_active) ?? null;

  const [variantsRes, salesRes, paymentsRes, settingRes] = await Promise.all([
    supabase
      .from('variants')
      .select('stock_qty, retail_price_xof, sku, products!inner(name), brands!inner(name)')
      .eq('status', 'active'),
    activeCycle
      ? supabase.from('sales').select('total_xof, created_at, voided_at').eq('cycle_id', activeCycle.id).is('voided_at', null)
      : Promise.resolve({ data: [] as Array<{ total_xof: number; created_at: string }> } as const),
    activeCycle
      ? supabase.from('brand_payments').select('amount_xof').eq('cycle_id', activeCycle.id)
      : Promise.resolve({ data: [] as Array<{ amount_xof: number }> } as const),
    supabase.from('settings').select('value').eq('key', 'alert_threshold').maybeSingle(),
  ]);

  const variants = (variantsRes.data ?? []) as any[];
  const threshold = Number((settingRes.data as any)?.value ?? 4);

  const total_stock_value_xof = variants.reduce((s, v) => s + v.stock_qty * v.retail_price_xof, 0);
  const total_items_in_stock = variants.reduce((s, v) => s + v.stock_qty, 0);

  // Per-brand total stock (across all variants of that brand). A brand drops
  // below the threshold when its TOTAL drops, not when individual variants do
  // — Tibi typically receives 1-2 units per variant so per-variant alerting
  // would always fire.
  const stockByBrand = new Map<string, number>();
  for (const v of variants) {
    stockByBrand.set(v.brands.name, (stockByBrand.get(v.brands.name) ?? 0) + v.stock_qty);
  }
  const low_stock: InventoryReport['low_stock'] = Array.from(stockByBrand.entries())
    .filter(([, total]) => total > 0 && total <= threshold)
    .map(([brand, total_stock]) => ({ brand, total_stock }))
    .sort((a, b) => a.total_stock - b.total_stock);

  // Balance due = consignment gross − commissions − brand_payments (across active cycle)
  let balance_due_xof = 0;
  if (activeCycle) {
    const { data: items } = await supabase
      .from('sale_items')
      .select('unit_price_xof, qty, commission_xof, item_type, sales!inner(cycle_id)')
      .eq('sales.cycle_id', activeCycle.id)
      .eq('item_type', 'consignment');
    const gross = ((items ?? []) as any[]).reduce((s, it) => s + (it.unit_price_xof * it.qty - (it.commission_xof ?? 0)), 0);
    const paid = ((paymentsRes.data ?? []) as Array<{ amount_xof: number }>).reduce((s, p) => s + p.amount_xof, 0);
    balance_due_xof = Math.max(0, gross - paid);
  }

  // Projection + cycle vs previous
  let projection: InventoryReport['projection'] = null;
  let cycle_vs_previous: InventoryReport['cycle_vs_previous'] = null;
  if (activeCycle) {
    const salesArr = (salesRes.data ?? []) as Array<{ total_xof: number; created_at: string }>;
    const gmv = salesArr.reduce((s, x) => s + x.total_xof, 0);
    const start = new Date(activeCycle.start_date);
    const end = new Date(activeCycle.end_date);
    const now = new Date();
    const elapsed = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000));
    const daysLeft = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 86400000));
    const rate = gmv / elapsed;
    projection = {
      current_sell_rate_per_day: rate,
      days_left: daysLeft,
      projected_end_of_cycle_gmv_xof: Math.round(gmv + rate * daysLeft),
    };

    const prev = allCycles.find((c) => !c.is_active && new Date(c.end_date) <= start) ?? null;
    let prevGmv = 0;
    if (prev) {
      const { data: prevSales } = await supabase.from('sales').select('total_xof').eq('cycle_id', prev.id);
      prevGmv = ((prevSales ?? []) as Array<{ total_xof: number }>).reduce((s, x) => s + x.total_xof, 0);
    }
    cycle_vs_previous = {
      current: { name: activeCycle.name, gmv_xof: gmv },
      previous: prev ? { name: prev.name, gmv_xof: prevGmv } : null,
    };
  }

  return {
    cycle_label: activeCycle?.name ?? 'All time',
    total_stock_value_xof,
    total_items_in_stock,
    total_balance_due_xof: balance_due_xof,
    alerts_count: low_stock.length,
    alert_threshold: threshold,
    low_stock: low_stock.slice(0, 50),
    projection,
    cycle_vs_previous,
  };
}

// ----------------------------------------------------------------------------
// WHOLESALE / OWN LABEL report
// ----------------------------------------------------------------------------
export interface WholesaleReport {
  cycle_label: string;
  wholesale: { stock_value_cost_xof: number; stock_value_retail_xof: number; sales_xof: number; cogs_xof: number; gross_margin_xof: number; gross_margin_pct: number };
  own_label: { stock_value_cost_xof: number; stock_value_retail_xof: number; sales_xof: number; cogs_xof: number; gross_margin_xof: number; gross_margin_pct: number };
  profit_total_xof: number;
  by_brand: Array<{ brand: string; type: 'wholesale' | 'own_label'; sales: number; cogs: number; margin: number; margin_pct: number }>;
}

export async function getWholesaleReport(): Promise<WholesaleReport> {
  const supabase = createClient();
  const { data: cycle } = await supabase.from('cycles').select('*').eq('is_active', true).maybeSingle();

  const { data: variantsData } = await supabase
    .from('variants')
    .select('brand_id, stock_qty, retail_price_xof, wholesale_cost_xof, brands!inner(name, type)')
    .eq('status', 'active')
    .neq('brands.type', 'consignment');

  const variants = (variantsData ?? []) as any[];

  const { data: itemsData } = cycle
    ? await supabase
        .from('sale_items')
        .select('brand_id, qty, unit_price_xof, item_type, variants!inner(wholesale_cost_xof), brands!inner(name, type), sales!inner(cycle_id)')
        .eq('sales.cycle_id', cycle.id)
        .in('item_type', ['wholesale', 'own_label'])
    : { data: [] as any[] };

  const items = (itemsData ?? []) as any[];

  function buckets() {
    return { stock_value_cost_xof: 0, stock_value_retail_xof: 0, sales_xof: 0, cogs_xof: 0 };
  }
  const wholesale = buckets();
  const own_label = buckets();

  for (const v of variants) {
    const bucket = v.brands.type === 'own_label' ? own_label : wholesale;
    bucket.stock_value_retail_xof += v.stock_qty * v.retail_price_xof;
    bucket.stock_value_cost_xof += v.stock_qty * (v.wholesale_cost_xof ?? 0);
  }

  const byBrand = new Map<string, { brand: string; type: 'wholesale' | 'own_label'; sales: number; cogs: number }>();
  for (const it of items) {
    const line = it.qty * it.unit_price_xof;
    const cost = it.qty * (it.variants?.wholesale_cost_xof ?? 0);
    if (it.item_type === 'own_label') { own_label.sales_xof += line; own_label.cogs_xof += cost; }
    else if (it.item_type === 'wholesale') { wholesale.sales_xof += line; wholesale.cogs_xof += cost; }
    const key = `${it.brands.name}__${it.brands.type}`;
    const cur = byBrand.get(key) ?? { brand: it.brands.name, type: it.brands.type, sales: 0, cogs: 0 };
    cur.sales += line;
    cur.cogs += cost;
    byBrand.set(key, cur);
  }

  const wmargin = wholesale.sales_xof - wholesale.cogs_xof;
  const omargin = own_label.sales_xof - own_label.cogs_xof;

  return {
    cycle_label: cycle?.name ?? 'All time',
    wholesale: {
      ...wholesale,
      gross_margin_xof: wmargin,
      gross_margin_pct: wholesale.sales_xof > 0 ? (wmargin / wholesale.sales_xof) * 100 : 0,
    },
    own_label: {
      ...own_label,
      gross_margin_xof: omargin,
      gross_margin_pct: own_label.sales_xof > 0 ? (omargin / own_label.sales_xof) * 100 : 0,
    },
    profit_total_xof: wmargin + omargin,
    by_brand: Array.from(byBrand.values()).map((b) => ({
      ...b,
      margin: b.sales - b.cogs,
      margin_pct: b.sales > 0 ? ((b.sales - b.cogs) / b.sales) * 100 : 0,
    })).sort((a, b) => b.margin - a.margin),
  };
}

// ----------------------------------------------------------------------------
// TODAY close (unchanged)
// ----------------------------------------------------------------------------
export interface TodayClose {
  date: string;
  tx_count: number;
  gmv_xof: number;
  average_basket_xof: number;
  by_payment: Array<{ method: string; total_xof: number }>;
  by_seller: Array<{ seller: string; tx: number; total_xof: number }>;
  returns_count: number;
  returns_total_xof: number;
}

export async function getTodayClose(): Promise<TodayClose> {
  const supabase = createClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const until = new Date();

  const { data: sales } = await supabase
    .from('sales')
    .select('total_xof, payment_method, seller_name')
    .gte('created_at', since.toISOString())
    .lte('created_at', until.toISOString());

  const safe = (sales ?? []) as Array<{ total_xof: number; payment_method: string; seller_name: string }>;
  const gmv = safe.reduce((s, x) => s + x.total_xof, 0);
  const tx = safe.length;
  const avg = tx > 0 ? Math.round(gmv / tx) : 0;
  const byPayment = new Map<string, number>();
  const bySeller = new Map<string, { tx: number; total: number }>();
  for (const s of safe) {
    byPayment.set(s.payment_method, (byPayment.get(s.payment_method) ?? 0) + s.total_xof);
    const cur = bySeller.get(s.seller_name) ?? { tx: 0, total: 0 };
    bySeller.set(s.seller_name, { tx: cur.tx + 1, total: cur.total + s.total_xof });
  }

  const { data: returns } = await supabase
    .from('returns')
    .select('refund_xof')
    .gte('created_at', since.toISOString())
    .lte('created_at', until.toISOString());
  const safeReturns = (returns ?? []) as Array<{ refund_xof: number }>;
  const returnsTotal = safeReturns.reduce((s, r) => s + r.refund_xof, 0);

  return {
    date: since.toISOString(),
    tx_count: tx,
    gmv_xof: gmv,
    average_basket_xof: avg,
    by_payment: Array.from(byPayment, ([method, total_xof]) => ({ method, total_xof })),
    by_seller: Array.from(bySeller, ([seller, v]) => ({ seller, tx: v.tx, total_xof: v.total })).sort((a, b) => b.total_xof - a.total_xof),
    returns_count: safeReturns.length,
    returns_total_xof: returnsTotal,
  };
}

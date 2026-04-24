import { createClient } from '@/lib/supabase/server';
import type { Cycle } from '@/lib/supabase/types';

export interface AccountingReport {
  scope: { type: 'cycle' | 'month'; label: string; since: string; until: string };
  consignment: {
    gross_collected_xof: number;
    commissions_xof: number;
    due_to_brands_xof: number;
    paid_to_brands_xof: number;
    balance_due_xof: number;
  };
  wholesale: {
    sales_xof: number;
    cogs_xof: number;
    gross_margin_xof: number;
  };
  own_label: {
    sales_xof: number;
    cogs_xof: number;
    gross_margin_xof: number;
  };
  tibi_taxable_revenue_xof: number;
  /** Operating expenses incurred during the period, grouped by division */
  expenses: {
    boutique_xof: number;
    cafe_xof: number;
    shared_xof: number;
    total_xof: number;
  };
  /** Net profit = taxable revenue − total expenses */
  net_profit_xof: number;
}

export type Scope = { type: 'cycle'; cycleId?: string } | { type: 'month'; year: number; month: number };

async function resolveRange(scope: Scope): Promise<{ since: string; until: string; label: string }> {
  const supabase = createClient();
  if (scope.type === 'cycle') {
    let cycle: Cycle | null = null;
    if (scope.cycleId) {
      const { data } = await supabase.from('cycles').select('*').eq('id', scope.cycleId).maybeSingle();
      cycle = (data as Cycle) ?? null;
    } else {
      const { data } = await supabase.from('cycles').select('*').eq('is_active', true).maybeSingle();
      cycle = (data as Cycle) ?? null;
    }
    if (!cycle) {
      const now = new Date();
      return { since: new Date(now.getFullYear(), 0, 1).toISOString(), until: now.toISOString(), label: 'No active cycle' };
    }
    return {
      since: new Date(cycle.start_date).toISOString(),
      until: new Date(cycle.end_date + 'T23:59:59').toISOString(),
      label: cycle.name,
    };
  }
  const since = new Date(scope.year, scope.month - 1, 1).toISOString();
  const until = new Date(scope.year, scope.month, 0, 23, 59, 59).toISOString();
  const label = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(scope.year, scope.month - 1, 1));
  return { since, until, label };
}

export async function getAccountingReport(scope: Scope): Promise<AccountingReport> {
  const supabase = createClient();
  const { since, until, label } = await resolveRange(scope);

  // Sale items by type (consignment / wholesale / own_label)
  // Exclude voided sales from accounting — a voided sale has no fiscal impact.
  const { data: items } = await supabase
    .from('sale_items')
    .select('id, qty, unit_price_xof, commission_xof, item_type, variants!inner(wholesale_cost_xof), sales!inner(created_at, voided_at)')
    .gte('sales.created_at', since)
    .lte('sales.created_at', until)
    .is('sales.voided_at', null);

  // Net qty: subtract returns per sale_item
  const itemsList = (items ?? []) as any[];
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

  let consignGross = 0; // net collected on consignment items
  let consignCommission = 0;
  let wholesaleSales = 0;
  let wholesaleCogs = 0;
  let ownLabelSales = 0;
  let ownLabelCogs = 0;

  for (const it of itemsList) {
    const returned = returnedByItem.get(it.id as string) ?? 0;
    const netQty = Math.max(0, (it.qty as number) - returned);
    const netLine = netQty * (it.unit_price_xof as number);
    const cost = ((it.variants?.wholesale_cost_xof as number) ?? 0) * netQty;
    if (it.item_type === 'consignment') {
      consignGross += netLine;
      // commission_xof is already zero for fully-returned items (processReturn handles it)
      consignCommission += (it.commission_xof as number) ?? 0;
    } else if (it.item_type === 'wholesale') {
      wholesaleSales += netLine;
      wholesaleCogs += cost;
    } else if (it.item_type === 'own_label') {
      ownLabelSales += netLine;
      ownLabelCogs += cost;
    }
  }

  const dueToBrands = consignGross - consignCommission;

  // Payments made to brands within this range
  const { data: payments } = await supabase
    .from('brand_payments')
    .select('amount_xof, paid_at')
    .gte('paid_at', since)
    .lte('paid_at', until);
  const paidToBrands = ((payments ?? []) as Array<{ amount_xof: number }>).reduce((s, p) => s + p.amount_xof, 0);

  const taxable =
    consignCommission + wholesaleSales + ownLabelSales;

  // Operating expenses for the period — grouped by division
  const sinceDate = since.slice(0, 10);
  const untilDate = until.slice(0, 10);
  const { data: expensesData } = await supabase
    .from('expenses')
    .select('amount_xof, division')
    .gte('incurred_on', sinceDate)
    .lte('incurred_on', untilDate);
  const expensesList = (expensesData ?? []) as Array<{ amount_xof: number; division: 'boutique' | 'cafe' | 'shared' }>;
  const expenseTotals = { boutique_xof: 0, cafe_xof: 0, shared_xof: 0, total_xof: 0 };
  for (const e of expensesList) {
    expenseTotals[`${e.division}_xof` as keyof typeof expenseTotals] += e.amount_xof;
    expenseTotals.total_xof += e.amount_xof;
  }

  const netProfit = taxable - expenseTotals.total_xof;

  return {
    scope: { type: scope.type, label, since, until },
    consignment: {
      gross_collected_xof: consignGross,
      commissions_xof: consignCommission,
      due_to_brands_xof: dueToBrands,
      paid_to_brands_xof: paidToBrands,
      balance_due_xof: Math.max(0, dueToBrands - paidToBrands),
    },
    wholesale: {
      sales_xof: wholesaleSales,
      cogs_xof: wholesaleCogs,
      gross_margin_xof: wholesaleSales - wholesaleCogs,
    },
    own_label: {
      sales_xof: ownLabelSales,
      cogs_xof: ownLabelCogs,
      gross_margin_xof: ownLabelSales - ownLabelCogs,
    },
    tibi_taxable_revenue_xof: taxable,
    expenses: expenseTotals,
    net_profit_xof: netProfit,
  };
}

export async function listCyclesForAccounting() {
  const supabase = createClient();
  const { data } = await supabase.from('cycles').select('id, name, start_date, end_date, is_active').order('start_date', { ascending: false });
  return (data ?? []) as Array<{ id: string; name: string; start_date: string; end_date: string; is_active: boolean }>;
}

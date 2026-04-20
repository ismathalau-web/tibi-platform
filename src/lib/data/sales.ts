import { createAdminClient } from '@/lib/supabase/admin';

export interface SaleItemDetail {
  id: string;
  variant_id: string;
  brand_id: string;
  item_type: 'consignment' | 'wholesale' | 'own_label';
  qty: number;
  unit_price_xof: number;
  commission_xof: number;
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  brand_name: string;
  qty_returned: number; // sum of returns for this sale_item
}

export interface SaleDetail {
  id: string;
  invoice_no: number;
  created_at: string;
  updated_at: string;
  subtotal_xof: number;
  discount_xof: number;
  discount_reason: string | null;
  total_xof: number;
  payment_method: string;
  payment_other: string | null;
  seller_name: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_contact: string | null; // legacy, kept for back-compat
  notes: string | null;
  is_locked: boolean;
  voided_at: string | null;
  voided_reason: string | null;
  cancellation_note_no: number | null;
  cycle_id: string | null;
  items: SaleItemDetail[];
  // Derived
  total_items_qty: number;
  total_returned_qty: number;
  status: 'completed' | 'partially_returned' | 'fully_returned' | 'voided';
}

/**
 * Full sale detail with joined items, brands, variants, product name, and
 * the quantity already returned per item (so the UI can offer a partial return
 * without double-counting).
 */
export async function loadSaleDetail(id: string): Promise<SaleDetail | null> {
  const supabase = createAdminClient();
  const { data: sale, error } = await supabase
    .from('sales')
    .select(
      `
      id, invoice_no, created_at, updated_at,
      subtotal_xof, discount_xof, discount_reason, total_xof,
      payment_method, payment_other, seller_name,
      customer_id, customer_name, customer_email, customer_phone, customer_contact, notes,
      is_locked, voided_at, voided_reason, cancellation_note_no, cycle_id,
      sale_items (
        id, variant_id, brand_id, item_type, qty, unit_price_xof, commission_xof,
        brands!inner(name),
        variants!inner(sku, size, color, products!inner(name))
      )
      `,
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !sale) return null;

  const s: any = sale;
  const saleItemIds = (s.sale_items ?? []).map((it: any) => it.id);

  // Fetch return qtys per sale_item in one query
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

  const items: SaleItemDetail[] = (s.sale_items ?? []).map((it: any) => ({
    id: it.id,
    variant_id: it.variant_id,
    brand_id: it.brand_id,
    item_type: it.item_type,
    qty: it.qty,
    unit_price_xof: it.unit_price_xof,
    commission_xof: it.commission_xof ?? 0,
    product_name: it.variants.products.name,
    sku: it.variants.sku,
    size: it.variants.size,
    color: it.variants.color,
    brand_name: it.brands.name,
    qty_returned: returnedByItem.get(it.id) ?? 0,
  }));

  const total_items_qty = items.reduce((acc, it) => acc + it.qty, 0);
  const total_returned_qty = items.reduce((acc, it) => acc + it.qty_returned, 0);

  let status: SaleDetail['status'];
  if (s.voided_at) status = 'voided';
  else if (total_returned_qty === 0) status = 'completed';
  else if (total_returned_qty >= total_items_qty) status = 'fully_returned';
  else status = 'partially_returned';

  return {
    id: s.id,
    invoice_no: s.invoice_no,
    created_at: s.created_at,
    updated_at: s.updated_at,
    subtotal_xof: s.subtotal_xof,
    discount_xof: s.discount_xof,
    discount_reason: s.discount_reason,
    total_xof: s.total_xof,
    payment_method: s.payment_method,
    payment_other: s.payment_other ?? null,
    seller_name: s.seller_name,
    customer_id: s.customer_id ?? null,
    customer_name: s.customer_name ?? null,
    customer_email: s.customer_email ?? null,
    customer_phone: s.customer_phone ?? null,
    customer_contact: s.customer_contact ?? null,
    notes: s.notes ?? null,
    is_locked: s.is_locked,
    voided_at: s.voided_at ?? null,
    voided_reason: s.voided_reason ?? null,
    cancellation_note_no: s.cancellation_note_no ?? null,
    cycle_id: s.cycle_id ?? null,
    items,
    total_items_qty,
    total_returned_qty,
    status,
  };
}

export interface SaleAuditEntry {
  id: string;
  sale_id: string;
  action: 'created' | 'edited' | 'returned' | 'exchanged' | 'voided' | 'reopened';
  actor: string;
  created_at: string;
  details: Record<string, unknown> | null;
}

export async function loadSaleAuditLog(saleId: string): Promise<SaleAuditEntry[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('sale_audit_log')
    .select('id, sale_id, action, actor, created_at, details')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false });
  return (data ?? []) as SaleAuditEntry[];
}

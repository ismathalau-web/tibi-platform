// Hand-written domain types — replace with `supabase gen types typescript` once a project exists.

export type BrandType = 'consignment' | 'wholesale' | 'own_label';
export type ItemType = 'consignment' | 'wholesale' | 'own_label';
export type VariantStatus = 'active' | 'out_of_stock' | 'discontinued';
export type PreorderStatus = 'pending' | 'ready' | 'collected' | 'cancelled';
export type UserRole = 'admin' | 'seller';
export type CommissionStatus = 'pending' | 'confirmed';

export interface Brand {
  id: string;
  name: string;
  country: string | null;
  category: string | null;
  email: string | null;
  instagram: string | null;
  currency: string;
  commission_pct: number | null;
  commission_status: CommissionStatus;
  type: BrandType;
  has_dashboard: boolean;
  is_active: boolean;
  notes: string | null;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  brand_id: string;
  name: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface Variant {
  id: string;
  product_id: string;
  brand_id: string;
  sku: string;
  size: string | null;
  color: string | null;
  retail_price_xof: number;
  wholesale_cost_xof: number | null;
  stock_qty: number;
  status: VariantStatus;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Cycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface StockMovement {
  id: string;
  variant_id: string;
  brand_id: string;
  cycle_id: string;
  qty_sent: number;
  qty_confirmed: number;
  qty_sold: number;
  qty_returned: number;
}

export interface Employee {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Sale {
  id: string;
  invoice_no: number;
  cycle_id: string | null;
  created_at: string;
  subtotal_xof: number;
  discount_xof: number;
  discount_reason: string | null;
  total_xof: number;
  payment_method: string;
  payment_other: string | null;
  notes: string | null;
  seller_name: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  is_locked: boolean;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  variant_id: string;
  brand_id: string;
  qty: number;
  unit_price_xof: number;
  commission_pct: number | null;
  commission_xof: number;
  item_type: ItemType;
}

export interface Preorder {
  id: string;
  variant_id: string;
  customer_name: string;
  customer_contact: string;
  deposit_xof: number;
  balance_xof: number;
  status: PreorderStatus;
  notes: string | null;
  created_at: string;
}

export interface BrandPayment {
  id: string;
  brand_id: string;
  cycle_id: string;
  amount_xof: number;
  paid_at: string;
  notes: string | null;
}

export interface ExchangeRate {
  id: string;
  currency_code: string;
  rate_to_xof: number;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  role: UserRole;
  display_name: string | null;
  employee_id: string | null;
}

// RPC return shapes
export interface BrandSummary {
  brand: {
    id: string;
    name: string;
    country: string | null;
    category: string | null;
    currency: string;
    commission_pct: number | null;
    commission_status: CommissionStatus;
  };
  cycle: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  } | null;
  stats: {
    sent: number;
    sold: number;      // net sold (after returns)
    returned: number;  // units returned in current cycle
    remaining: number;
    balance_due_xof: number;
    paid_xof: number;
  };
}

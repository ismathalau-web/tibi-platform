-- ============================================================================
-- Row-Level Security
--   admin   — full access on everything
--   seller  — read brands/products/variants/employees/cycles, write sales/sale_items/returns/preorders/customers
--   anon    — read brand share-token row + related variants/stock_movements/brand_payments via RPC
-- The brand-share view is implemented as a SECURITY DEFINER function, so
-- direct table policies for anon stay locked-down.
-- ============================================================================

-- helper: is_admin() / is_seller()
create or replace function public.tibi_role() returns user_role
language sql stable as $$
  select role from public.user_profiles where user_id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce((select role = 'admin' from public.user_profiles where user_id = auth.uid()), false)
$$;

create or replace function public.is_authed() returns boolean
language sql stable as $$
  select auth.uid() is not null
$$;

-- enable RLS everywhere
alter table brands enable row level security;
alter table products enable row level security;
alter table variants enable row level security;
alter table cycles enable row level security;
alter table stock_movements enable row level security;
alter table customers enable row level security;
alter table employees enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table returns enable row level security;
alter table preorders enable row level security;
alter table brand_payments enable row level security;
alter table exchange_rates enable row level security;
alter table settings enable row level security;
alter table user_profiles enable row level security;

-- ---------- ADMIN: full access ----------
create policy admin_all_brands on brands for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_products on products for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_variants on variants for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_cycles on cycles for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_stock_movements on stock_movements for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_customers on customers for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_employees on employees for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_sales on sales for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_sale_items on sale_items for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_returns on returns for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_preorders on preorders for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_brand_payments on brand_payments for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_exchange_rates on exchange_rates for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_settings on settings for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_all_user_profiles on user_profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- SELLER: scoped POS access ----------
-- read needed for browsing/search
create policy seller_read_brands on brands for select to authenticated
  using (tibi_role() = 'seller' and is_active);
create policy seller_read_products on products for select to authenticated
  using (tibi_role() = 'seller');
create policy seller_read_variants on variants for select to authenticated
  using (tibi_role() = 'seller' and status = 'active');
create policy seller_read_cycles on cycles for select to authenticated
  using (tibi_role() = 'seller');
create policy seller_read_employees on employees for select to authenticated
  using (tibi_role() = 'seller' and is_active);
create policy seller_read_exchange_rates on exchange_rates for select to authenticated
  using (tibi_role() = 'seller');

-- write: sales + sale_items + returns + preorders + customers
create policy seller_insert_sales on sales for insert to authenticated
  with check (tibi_role() = 'seller');
create policy seller_select_sales_today on sales for select to authenticated
  using (tibi_role() = 'seller');
create policy seller_insert_sale_items on sale_items for insert to authenticated
  with check (tibi_role() = 'seller');
create policy seller_select_sale_items on sale_items for select to authenticated
  using (tibi_role() = 'seller');
create policy seller_insert_returns on returns for insert to authenticated
  with check (tibi_role() = 'seller');
create policy seller_insert_preorders on preorders for insert to authenticated
  with check (tibi_role() = 'seller');
create policy seller_select_preorders on preorders for select to authenticated
  using (tibi_role() = 'seller');
create policy seller_insert_customers on customers for insert to authenticated
  with check (tibi_role() = 'seller');
create policy seller_select_customers on customers for select to authenticated
  using (tibi_role() = 'seller');

-- own profile
create policy own_profile_read on user_profiles for select to authenticated
  using (user_id = auth.uid());

-- ---------- ANON: brand share-link RPC only (no direct table access) ----------
-- Anonymous brand dashboard access goes through SECURITY DEFINER functions
-- that take a share_token argument. No anon SELECT policies are added.

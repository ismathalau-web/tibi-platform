-- ============================================================================
-- Tibi Retail Platform — initial schema
-- All monetary values stored as XOF (West African CFA franc), bigint, integer.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type brand_type as enum ('consignment', 'wholesale', 'own_label');
create type variant_status as enum ('active', 'out_of_stock', 'discontinued');
create type item_type as enum ('consignment', 'wholesale', 'own_label');
create type preorder_status as enum ('pending', 'ready', 'collected', 'cancelled');
create type user_role as enum ('admin', 'seller');
create type commission_status as enum ('pending', 'confirmed');

-- ----------------------------------------------------------------------------
-- BRANDS
-- ----------------------------------------------------------------------------
create table brands (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  country       text,
  category      text,
  email         text,
  instagram     text,
  currency      text not null default 'XOF',
  commission_pct numeric(5,2),
  commission_status commission_status not null default 'pending',
  type          brand_type not null default 'consignment',
  has_dashboard boolean not null default true,
  is_active     boolean not null default true,
  notes         text,
  share_token   text unique default encode(gen_random_bytes(18), 'hex'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index brands_type_idx on brands(type);
create index brands_active_idx on brands(is_active);
create index brands_share_token_idx on brands(share_token);

-- ----------------------------------------------------------------------------
-- PRODUCTS + VARIANTS
-- ----------------------------------------------------------------------------
create table products (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  name        text not null,
  category    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index products_brand_idx on products(brand_id);

create table variants (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references products(id) on delete cascade,
  brand_id            uuid not null references brands(id) on delete cascade,
  sku                 text not null unique,
  size                text,
  color               text,
  retail_price_xof    integer not null check (retail_price_xof >= 0),
  wholesale_cost_xof  integer check (wholesale_cost_xof >= 0),
  stock_qty           integer not null default 0 check (stock_qty >= 0),
  status              variant_status not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index variants_brand_idx on variants(brand_id);
create index variants_product_idx on variants(product_id);
create index variants_sku_idx on variants(sku);
create index variants_status_idx on variants(status);

-- ----------------------------------------------------------------------------
-- CYCLES
-- ----------------------------------------------------------------------------
create table cycles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now()
);

create unique index cycles_one_active on cycles(is_active) where is_active = true;

-- ----------------------------------------------------------------------------
-- STOCK MOVEMENTS  (per-cycle ledger of qty in/out per variant per brand)
-- ----------------------------------------------------------------------------
create table stock_movements (
  id              uuid primary key default gen_random_uuid(),
  variant_id      uuid not null references variants(id) on delete cascade,
  brand_id        uuid not null references brands(id) on delete cascade,
  cycle_id        uuid not null references cycles(id) on delete cascade,
  qty_sent        integer not null default 0,
  qty_confirmed   integer not null default 0,
  qty_sold        integer not null default 0,
  qty_returned    integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (variant_id, cycle_id)
);

create index stock_movements_brand_idx on stock_movements(brand_id);
create index stock_movements_cycle_idx on stock_movements(cycle_id);

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
create table customers (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now()
);

create unique index customers_email_idx on customers(email) where email is not null;
create unique index customers_phone_idx on customers(phone) where phone is not null;

-- ----------------------------------------------------------------------------
-- EMPLOYEES (sellers — name only, no auth account by default)
-- ----------------------------------------------------------------------------
create table employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- SALES + SALE ITEMS + RETURNS
-- ----------------------------------------------------------------------------
create sequence sales_invoice_seq start 1001;

create table sales (
  id              uuid primary key default gen_random_uuid(),
  invoice_no      integer not null unique default nextval('sales_invoice_seq'),
  cycle_id        uuid references cycles(id) on delete set null,
  created_at      timestamptz not null default now(),
  subtotal_xof    integer not null check (subtotal_xof >= 0),
  discount_xof    integer not null default 0 check (discount_xof >= 0),
  discount_reason text,
  total_xof       integer not null check (total_xof >= 0),
  payment_method  text not null,
  payment_other   text,
  notes           text,
  seller_name     text not null,
  customer_id     uuid references customers(id) on delete set null,
  customer_name   text,
  customer_contact text,
  is_locked       boolean not null default false
);

create index sales_cycle_idx on sales(cycle_id);
create index sales_created_at_idx on sales(created_at desc);
create index sales_seller_idx on sales(seller_name);

create table sale_items (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references sales(id) on delete cascade,
  variant_id      uuid not null references variants(id),
  brand_id        uuid not null references brands(id),
  qty             integer not null check (qty > 0),
  unit_price_xof  integer not null check (unit_price_xof >= 0),
  commission_pct  numeric(5,2),
  commission_xof  integer not null default 0 check (commission_xof >= 0),
  item_type       item_type not null
);

create index sale_items_sale_idx on sale_items(sale_id);
create index sale_items_variant_idx on sale_items(variant_id);
create index sale_items_brand_idx on sale_items(brand_id);

create table returns (
  id              uuid primary key default gen_random_uuid(),
  sale_item_id    uuid not null references sale_items(id) on delete cascade,
  reason          text not null,
  refund_xof      integer not null check (refund_xof >= 0),
  created_at      timestamptz not null default now(),
  seller_name     text not null
);

create index returns_sale_item_idx on returns(sale_item_id);

-- ----------------------------------------------------------------------------
-- PRE-ORDERS
-- ----------------------------------------------------------------------------
create table preorders (
  id                uuid primary key default gen_random_uuid(),
  variant_id        uuid not null references variants(id) on delete cascade,
  customer_name     text not null,
  customer_contact  text not null,
  deposit_xof       integer not null default 0 check (deposit_xof >= 0),
  balance_xof       integer not null default 0 check (balance_xof >= 0),
  status            preorder_status not null default 'pending',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index preorders_status_idx on preorders(status);
create index preorders_variant_idx on preorders(variant_id);

-- ----------------------------------------------------------------------------
-- BRAND PAYMENTS (cycle payouts to consignment brands)
-- ----------------------------------------------------------------------------
create table brand_payments (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  cycle_id    uuid not null references cycles(id) on delete cascade,
  amount_xof  integer not null check (amount_xof >= 0),
  paid_at     timestamptz not null default now(),
  notes       text
);

create index brand_payments_brand_idx on brand_payments(brand_id);
create index brand_payments_cycle_idx on brand_payments(cycle_id);

-- ----------------------------------------------------------------------------
-- EXCHANGE RATES (manual, edited from Settings)
-- ----------------------------------------------------------------------------
create table exchange_rates (
  id            uuid primary key default gen_random_uuid(),
  currency_code text not null unique,
  rate_to_xof   numeric(14, 6) not null check (rate_to_xof > 0),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- SETTINGS (key/value)
-- ----------------------------------------------------------------------------
create table settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- USER PROFILES (auth.users → role mapping)
-- ----------------------------------------------------------------------------
create table user_profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'seller',
  display_name text,
  employee_id uuid references employees(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger brands_set_updated_at before update on brands
  for each row execute function set_updated_at();
create trigger products_set_updated_at before update on products
  for each row execute function set_updated_at();
create trigger variants_set_updated_at before update on variants
  for each row execute function set_updated_at();
create trigger stock_movements_set_updated_at before update on stock_movements
  for each row execute function set_updated_at();
create trigger preorders_set_updated_at before update on preorders
  for each row execute function set_updated_at();
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
-- ============================================================================
-- Brand share-link RPCs
-- Anonymous callers pass a brand share_token. Functions are SECURITY DEFINER
-- and only ever return data scoped to that one brand.
-- ============================================================================

create or replace function public.brand_summary(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand brands%rowtype;
  v_cycle cycles%rowtype;
  v_sent int;
  v_sold int;
  v_remaining int;
  v_balance bigint;
  v_paid bigint;
begin
  select * into v_brand from brands where share_token = p_token and is_active and has_dashboard;
  if not found then
    raise exception 'invalid token';
  end if;

  select * into v_cycle from cycles where is_active limit 1;

  select coalesce(sum(qty_confirmed),0), coalesce(sum(qty_sold),0)
    into v_sent, v_sold
    from stock_movements
    where brand_id = v_brand.id and (v_cycle.id is null or cycle_id = v_cycle.id);

  v_remaining := greatest(v_sent - v_sold, 0);

  -- balance due = sum( unit_price * qty * (1 - commission_pct/100) ) for items in active cycle
  select coalesce(sum( si.qty * si.unit_price_xof - si.commission_xof ), 0)
    into v_balance
    from sale_items si
    join sales s on s.id = si.sale_id
    where si.brand_id = v_brand.id
      and si.item_type = 'consignment'
      and (v_cycle.id is null or s.cycle_id = v_cycle.id);

  select coalesce(sum(amount_xof), 0) into v_paid
    from brand_payments
    where brand_id = v_brand.id and (v_cycle.id is null or cycle_id = v_cycle.id);

  return jsonb_build_object(
    'brand', jsonb_build_object(
      'id', v_brand.id,
      'name', v_brand.name,
      'country', v_brand.country,
      'category', v_brand.category,
      'currency', v_brand.currency,
      'commission_pct', v_brand.commission_pct,
      'commission_status', v_brand.commission_status
    ),
    'cycle', case when v_cycle.id is not null then jsonb_build_object(
      'id', v_cycle.id, 'name', v_cycle.name,
      'start_date', v_cycle.start_date, 'end_date', v_cycle.end_date
    ) else null end,
    'stats', jsonb_build_object(
      'sent', v_sent,
      'sold', v_sold,
      'remaining', v_remaining,
      'balance_due_xof', v_balance - v_paid,
      'paid_xof', v_paid
    )
  );
end;
$$;

revoke all on function public.brand_summary(text) from public;
grant execute on function public.brand_summary(text) to anon, authenticated;


create or replace function public.brand_stock(p_token text)
returns table (
  variant_id uuid,
  product_name text,
  sku text,
  size text,
  color text,
  retail_price_xof int,
  qty_sent int,
  qty_sold int,
  qty_remaining int,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_cycle_id uuid;
begin
  select id into v_brand_id from brands where share_token = p_token and is_active and has_dashboard;
  if v_brand_id is null then raise exception 'invalid token'; end if;

  select id into v_cycle_id from cycles where is_active limit 1;

  return query
  select v.id,
         p.name,
         v.sku,
         v.size,
         v.color,
         v.retail_price_xof,
         coalesce(sm.qty_confirmed, 0) as qty_sent,
         coalesce(sm.qty_sold, 0) as qty_sold,
         greatest(coalesce(sm.qty_confirmed, 0) - coalesce(sm.qty_sold, 0), 0) as qty_remaining,
         case
           when coalesce(sm.qty_confirmed, 0) - coalesce(sm.qty_sold, 0) <= 0 then 'sold'
           else 'in_stock'
         end as status
    from variants v
    join products p on p.id = v.product_id
    left join stock_movements sm on sm.variant_id = v.id and sm.cycle_id = v_cycle_id
   where v.brand_id = v_brand_id
   order by p.name, v.size, v.color;
end;
$$;

revoke all on function public.brand_stock(text) from public;
grant execute on function public.brand_stock(text) to anon, authenticated;


create or replace function public.brand_payment_history(p_token text)
returns table (
  cycle_name text,
  start_date date,
  end_date date,
  amount_xof int,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
begin
  select id into v_brand_id from brands where share_token = p_token and is_active and has_dashboard;
  if v_brand_id is null then raise exception 'invalid token'; end if;

  return query
  select c.name, c.start_date, c.end_date, bp.amount_xof, bp.paid_at
    from brand_payments bp
    join cycles c on c.id = bp.cycle_id
   where bp.brand_id = v_brand_id
   order by bp.paid_at desc;
end;
$$;

revoke all on function public.brand_payment_history(text) from public;
grant execute on function public.brand_payment_history(text) to anon, authenticated;
-- ============================================================================
-- Tibi seed data — idempotent
-- Source: Tibi cs — Dossier de présentation — Cotonou 2026 (23 brands, 5 countries).
-- Country/category are best-guess placeholders to be confirmed by Ismath in admin.
-- Commission left null (pending confirmation) per brand-onboarding flow.
-- ============================================================================

-- ----- exchange rates (manual, edited from Settings) -----
insert into exchange_rates (currency_code, rate_to_xof) values
  ('NGN', 0.42),
  ('GHS', 38.00),
  ('MAD', 65.00),
  ('USD', 605.00),
  ('EUR', 655.957),
  ('XOF', 1.00)
on conflict (currency_code) do nothing;

-- ----- settings -----
insert into settings (key, value) values
  ('alert_threshold', '5'::jsonb),
  ('label_size', '"40x30"'::jsonb),
  ('label_barcode', '"code128"'::jsonb),
  ('label_content', '"sku_name_price"'::jsonb),
  ('admin_notify_email', '"hello@ismathlauriano.com"'::jsonb),
  ('platform_version', '"0.1.0"'::jsonb)
on conflict (key) do nothing;

-- ----- cycles -----
-- Pop-up Dec 2025 → Jan 2026 (closed, kept for historical payment records)
insert into cycles (name, start_date, end_date, is_active) values
  ('Pop-up Dec 2025 – Jan 2026', '2025-12-08', '2026-01-10', false)
on conflict do nothing;

-- Current planning cycle (pre-opening). Will be replaced by Q4 launch cycle.
insert into cycles (name, start_date, end_date, is_active) values
  ('Cycle 1 — Pre-launch 2026', '2026-04-01', '2026-12-31', true)
on conflict do nothing;

-- ----- employees -----
insert into employees (name) values ('Vendeuse 1'), ('Vendeuse 2')
on conflict do nothing;

-- ----- brands -----
-- Tibi Editions (own label, never delete)
insert into brands (name, country, category, currency, type, has_dashboard, commission_status, is_active)
values ('Tibi Editions', 'Bénin', 'Editions', 'XOF', 'own_label', false, 'confirmed', true)
on conflict (name) do nothing;

-- 23 consignment brands from the dossier
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('Desirée Iyama',     null::text, null::text),
      ('Dye Lab',           null,       null),
      ('Oriré',             null,       null),
      ('Abah',              null,       null),
      ('FARE',              null,       null),
      ('MòYE',              null,       null),
      ('Claic',             null,       null),
      ('Oshara',            null,       null),
      ('Olooh Concept',     null,       null),
      ('Kwaleo',            null,       null),
      ('Tabuk',             null,       null),
      ('KADIJU',            null,       null),
      ('Studio Bonnitta',   null,       null),
      ('Arami',             null,       null),
      ('NG Couture',        null,       null),
      ('Maison Ile Ife',    null,       null),
      ('Aduscent',          null,       null),
      ('Mon Boubou',        null,       null),
      ('Unrefyned',         null,       null),
      ('Primaire Studio',   null,       null),
      ('NCE Style',         null,       null),
      ('Omannoir',          null,       null),
      ('Emigrants',         null,       null)
    ) as t(name, country, category)
  loop
    insert into brands (name, country, category, currency, type, has_dashboard, commission_status, is_active)
    values (rec.name, rec.country, rec.category, 'XOF', 'consignment', true, 'pending', true)
    on conflict (name) do nothing;
  end loop;
end $$;

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

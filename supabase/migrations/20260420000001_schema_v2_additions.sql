-- =============================================================================
-- SCHEMA ADDITIONS v2 (2026-04-20)
-- =============================================================================
-- Captures changes applied to the live Supabase project after the initial
-- schema was committed (20260417). Safe to re-run — every DDL is guarded
-- with IF NOT EXISTS / DO blocks so re-applying is a no-op.
-- -----------------------------------------------------------------------------
-- What this migration adds:
--   1. variants.photo_url           — optional product photo per variant
--   2. preorders.customer_email     — contact split (email)
--   3. preorders.customer_phone     — contact split (phone)
--   4. preorders.total_xof          — stored total (sum of all items)
--   5. preorder_items               — multi-item pre-orders
--   6. stock_adjustments            — audit trail for manual stock corrections
-- =============================================================================

-- 1. variants.photo_url
alter table variants
  add column if not exists photo_url text;

-- 2-4. preorders new columns (customer contact split + total)
alter table preorders
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists total_xof integer;

-- Back-compat: total_xof should be set on existing rows when null.
-- deposit_xof + balance_xof is the historical total. Safe if both are 0.
update preorders
   set total_xof = coalesce(total_xof, deposit_xof + balance_xof)
 where total_xof is null;

-- 5. preorder_items — supports multiple items per pre-order.
create table if not exists preorder_items (
  id              uuid primary key default gen_random_uuid(),
  preorder_id    uuid not null references preorders(id) on delete cascade,
  variant_id     uuid not null references variants(id) on delete restrict,
  qty            integer not null check (qty > 0),
  unit_price_xof integer not null check (unit_price_xof >= 0),
  created_at     timestamptz not null default now()
);

create index if not exists preorder_items_preorder_idx on preorder_items(preorder_id);
create index if not exists preorder_items_variant_idx  on preorder_items(variant_id);

-- 6. stock_adjustments — audit trail for manual corrections.
-- Used when admin edits a variant's stock (lost, damaged, recount, correction).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'stock_adjustment_reason') then
    create type stock_adjustment_reason as enum ('lost', 'damaged', 'recount', 'correction', 'other');
  end if;
end $$;

create table if not exists stock_adjustments (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references variants(id) on delete cascade,
  delta_qty   integer not null, -- signed: negative = decrement, positive = increment
  reason      stock_adjustment_reason not null,
  notes       text,
  created_by  text,             -- user display name or email (not FK — history)
  created_at  timestamptz not null default now()
);

create index if not exists stock_adjustments_variant_idx on stock_adjustments(variant_id);
create index if not exists stock_adjustments_created_idx on stock_adjustments(created_at desc);

-- =============================================================================
-- RLS policies for new tables
-- =============================================================================
alter table preorder_items enable row level security;
alter table stock_adjustments enable row level security;

-- preorder_items: same access model as preorders (admin write, seller read)
drop policy if exists preorder_items_admin_all on preorder_items;
create policy preorder_items_admin_all on preorder_items
  for all
  using (tibi_role() = 'admin')
  with check (tibi_role() = 'admin');

drop policy if exists preorder_items_seller_read on preorder_items;
create policy preorder_items_seller_read on preorder_items
  for select
  using (tibi_role() in ('admin', 'seller'));

-- stock_adjustments: admin only
drop policy if exists stock_adjustments_admin_all on stock_adjustments;
create policy stock_adjustments_admin_all on stock_adjustments
  for all
  using (tibi_role() = 'admin')
  with check (tibi_role() = 'admin');

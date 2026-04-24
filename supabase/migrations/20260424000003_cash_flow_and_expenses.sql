-- =============================================================================
-- CASH FLOW + EXPENSES (2026-04-24)
-- =============================================================================
-- 3 things:
-- 1. sales.cash_received_xof — for cash sales, the amount the customer gave,
--    so the POS can compute the change + reconciliation has real data.
-- 2. expenses — manual operating expenses (bags, transport, utilities, rent,
--    salaries, etc.) with a Division tag (Boutique / Café / Shared).
-- 3. cash_closes — end-of-day drawer reconciliation history.
-- =============================================================================

-- 1. Cash received on sales
alter table sales
  add column if not exists cash_received_xof integer;

-- 2. Expenses table
do $$
begin
  if not exists (select 1 from pg_type where typname = 'expense_division') then
    create type expense_division as enum ('boutique', 'cafe', 'shared');
  end if;
  if not exists (select 1 from pg_type where typname = 'expense_category') then
    create type expense_category as enum (
      'supplies', 'transport', 'utilities', 'rent',
      'salary', 'maintenance', 'other'
    );
  end if;
end $$;

create table if not exists expenses (
  id              uuid primary key default gen_random_uuid(),
  incurred_on     date not null default current_date,
  amount_xof      integer not null check (amount_xof > 0),
  division        expense_division not null default 'shared',
  category        expense_category not null default 'other',
  payment_method  text not null default 'cash',  -- cash | card | mobile_money | bank_transfer | other
  description     text,
  recorded_by     text,  -- seller name or admin email
  created_at      timestamptz not null default now()
);

create index if not exists expenses_date_idx     on expenses(incurred_on desc);
create index if not exists expenses_division_idx on expenses(division);
create index if not exists expenses_category_idx on expenses(category);

alter table expenses enable row level security;

-- Staff (admin + seller) can read + create expenses.
-- Only admin can update/delete — controlled in server actions.
drop policy if exists expenses_staff_read on expenses;
create policy expenses_staff_read on expenses
  for select using (tibi_role() in ('admin', 'seller'));

drop policy if exists expenses_staff_insert on expenses;
create policy expenses_staff_insert on expenses
  for insert with check (tibi_role() in ('admin', 'seller'));

drop policy if exists expenses_admin_write on expenses;
create policy expenses_admin_write on expenses
  for update using (tibi_role() = 'admin') with check (tibi_role() = 'admin');

drop policy if exists expenses_admin_delete on expenses;
create policy expenses_admin_delete on expenses
  for delete using (tibi_role() = 'admin');

-- 3. Cash closes history
create table if not exists cash_closes (
  id              uuid primary key default gen_random_uuid(),
  close_date      date not null default current_date,
  opening_xof     integer not null default 0,
  cash_sales_xof  integer not null default 0,
  cash_refunds_xof integer not null default 0,
  cash_expenses_xof integer not null default 0,
  expected_xof    integer not null default 0,
  counted_xof     integer not null,
  variance_xof    integer not null,
  notes           text,
  closed_by       text,
  created_at      timestamptz not null default now()
);

create index if not exists cash_closes_date_idx on cash_closes(close_date desc);

alter table cash_closes enable row level security;

drop policy if exists cash_closes_staff_all on cash_closes;
create policy cash_closes_staff_all on cash_closes
  for all using (tibi_role() in ('admin', 'seller'))
  with check (tibi_role() in ('admin', 'seller'));

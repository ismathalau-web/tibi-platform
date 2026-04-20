-- =============================================================================
-- SALES VOID + AUDIT LOG + RETURN QTY (2026-04-20)
-- =============================================================================
-- Adds void capability on sales + full audit log for all sale-level actions
-- (edit, return, exchange, void, reopen). Used by the new Sale detail page
-- hub that replaces the scattered return / invoice flows.
--
-- Also extends the returns table to support partial returns (qty) and
-- per-return refund method / notes.
-- =============================================================================

-- Void columns on sales
alter table sales
  add column if not exists voided_at      timestamptz,
  add column if not exists voided_reason  text,
  add column if not exists updated_at     timestamptz not null default now();

-- Extend returns table for partial + structured data
alter table returns
  add column if not exists qty            integer not null default 1 check (qty > 0),
  add column if not exists refund_method  text,
  add column if not exists notes          text;

-- Sale audit action enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sale_audit_action') then
    create type sale_audit_action as enum ('created', 'edited', 'returned', 'exchanged', 'voided', 'reopened');
  end if;
end $$;

-- Audit log table: one row per action taken on a sale
create table if not exists sale_audit_log (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references sales(id) on delete cascade,
  action     sale_audit_action not null,
  actor      text not null, -- display name or email
  details    jsonb,         -- free-form diff / context (what changed, amounts, etc.)
  created_at timestamptz not null default now()
);

create index if not exists sale_audit_log_sale_idx    on sale_audit_log(sale_id);
create index if not exists sale_audit_log_created_idx on sale_audit_log(created_at desc);

-- RLS: both admin and seller can read + write audit entries
alter table sale_audit_log enable row level security;

drop policy if exists sale_audit_log_staff_all on sale_audit_log;
create policy sale_audit_log_staff_all on sale_audit_log
  for all
  using (tibi_role() in ('admin', 'seller'))
  with check (tibi_role() in ('admin', 'seller'));

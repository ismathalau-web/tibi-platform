-- =============================================================================
-- CREDIT NOTES + CANCELLATION NOTES (2026-04-20)
-- =============================================================================
-- When a customer returns items, we generate a Credit Note (note d'avoir).
-- When an entire sale is voided, we generate a Cancellation Note.
-- Both are separate documents from the original invoice (which stays intact).
--
-- Design:
--   - return_batches: 1 row per return operation (may group multiple items)
--   - returns.batch_id: links each returned line to its batch
--   - credit_note_seq + cancellation_note_seq: separate numeric sequences
--   - sales.cancellation_note_no: set when a sale is voided
-- =============================================================================

-- Sequences for the 2 document types (separate from invoice_no)
create sequence if not exists credit_note_seq       start 1;
create sequence if not exists cancellation_note_seq start 1;

-- return_batches: one row per return operation
create table if not exists return_batches (
  id                uuid primary key default gen_random_uuid(),
  credit_note_no    integer not null unique default nextval('credit_note_seq'),
  sale_id           uuid not null references sales(id) on delete cascade,
  total_refund_xof  integer not null check (total_refund_xof >= 0),
  refund_method     text not null,
  reason            text not null,
  notes             text,
  seller_name       text not null, -- physical person who processed the return
  created_at        timestamptz not null default now()
);

create index if not exists return_batches_sale_idx    on return_batches(sale_id);
create index if not exists return_batches_cn_idx      on return_batches(credit_note_no);

-- Link each returns row to its batch
alter table returns
  add column if not exists batch_id uuid references return_batches(id) on delete set null;

create index if not exists returns_batch_idx on returns(batch_id);

-- Cancellation note number on sales (nullable, set on void)
alter table sales
  add column if not exists cancellation_note_no integer unique;

-- RLS for return_batches (both admin + seller)
alter table return_batches enable row level security;

drop policy if exists return_batches_staff_all on return_batches;
create policy return_batches_staff_all on return_batches
  for all
  using (tibi_role() in ('admin', 'seller'))
  with check (tibi_role() in ('admin', 'seller'));

-- Helper RPC so the app can grab the next cancellation note number
-- without raw SQL access. Returned as bigint for PostgREST compat.
create or replace function public.nextval_cancellation_note()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('cancellation_note_seq');
$$;

grant execute on function public.nextval_cancellation_note() to anon, authenticated, service_role;

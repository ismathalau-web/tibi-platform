-- =============================================================================
-- variants.returned_at — End-of-cycle return to brand
-- =============================================================================
-- When a cycle ends and unsold consignment items are physically returned to
-- the brand, we mark the variant with returned_at = now() and set stock_qty
-- to 0. The variant stays in the DB (so historical sales reports still work)
-- but is hidden from the POS catalog + brand dashboard stock list.
-- =============================================================================

alter table variants
  add column if not exists returned_at timestamptz;

create index if not exists variants_returned_at_idx on variants(returned_at);

-- =============================================================================
-- Split customer_contact into customer_email + customer_phone on sales
-- =============================================================================
-- The legacy single `customer_contact` field forced sellers to pick email OR
-- phone. In practice you want both (one for invoice, one for WhatsApp).
-- We add two new columns and keep customer_contact around for backward compat.
-- =============================================================================

alter table sales
  add column if not exists customer_email text,
  add column if not exists customer_phone text;

-- Backfill from legacy customer_contact
update sales
   set customer_email = customer_contact
 where customer_contact like '%@%'
   and customer_email is null;

update sales
   set customer_phone = customer_contact
 where customer_contact is not null
   and customer_contact not like '%@%'
   and customer_phone is null;

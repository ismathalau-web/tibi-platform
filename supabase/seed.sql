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

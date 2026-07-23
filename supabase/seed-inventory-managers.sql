-- Hospitality Inventory Management — real locations & guard-manager
-- assignments. Run AFTER schema.sql, in the Supabase SQL Editor. Idempotent.
--
-- Access-architecture change (2026-07): Inventory is no longer a separate
-- inventory_staff role/account. It's an additional capability granted to
-- existing guards via an active inventory_location_staff assignment — the
-- guard keeps their normal Field Ops access and gains Inventory as an
-- addition. See get_my_inventory_location_ids() in schema.sql.
--
-- Location `type` is deliberately 'other_facility' for all five — nothing
-- in the available data indicates the actual facility kind (warehouse/
-- resort/forest office/etc.), and no parent-range relationship is set
-- either, per the explicit instruction not to invent facility
-- relationships when that information is unavailable.
--
-- Guards are matched by exact profile email, resolved against the live
-- database during the original access-architecture migration (not
-- hardcoded UUIDs, so this file stays correct if profile ids ever differ
-- across environments). One identity ambiguity existed during resolution:
-- "Santosh Singh" had two plausible candidate profiles; the one used below
-- (santosh.singh@ptr.in, designation "Forester — Betla Beat In-charge")
-- was confirmed directly by the director, not guessed.

-- ─────────────────────────────────────────────
-- Locations
-- ─────────────────────────────────────────────
insert into inventory_locations (name, type, active) values
  ('Betla', 'other_facility', true),
  ('New Complex', 'other_facility', true),
  ('Buxa', 'other_facility', true),
  ('Kechki', 'other_facility', true),
  ('Barwadih', 'other_facility', true)
on conflict (name) do nothing;

-- ─────────────────────────────────────────────
-- Guard-location assignments (8 total; Santosh Kumar Singh holds two)
-- ─────────────────────────────────────────────
insert into inventory_location_staff (location_id, user_id, active, assignment_type)
select l.id, p.id, true, 'location_manager'
from (values
  ('Betla',       'santosh.singh@ptr.in'),
  ('Betla',       'niranjan@ptr.in'),
  ('New Complex', 'santosh.singh@ptr.in'),
  ('New Complex', 'sukeshi@ptr.in'),
  ('Buxa',        'nandlal.sahu@ptr.in'),
  ('Buxa',        'subhash.kumar@ptr.in'),
  ('Kechki',      'deepak.mishra@ptr.in'),
  ('Barwadih',    'shravan.gupta@ptr.in')
) as v(location_name, user_email)
join inventory_locations l on l.name = v.location_name
join profiles p on p.email = v.user_email
on conflict (user_id, location_id) where active do nothing;

-- PTR North Division (Medininagar) — real ranges & beats
-- Source: "Posting of FG" staffing chart (11 beats, 69 sub-beats).
-- Run AFTER schema.sql, in the Supabase SQL Editor. Idempotent.
--
-- Ranges use fixed UUIDs so scripts/provision-users.mjs can reference them,
-- BUT everything below also matches on name, so it's safe to re-run against
-- a database where "Betla Range" already exists from seed.sql (the existing
-- row is kept; only missing rows are inserted).

-- ─────────────────────────────────────────────
-- Ranges
-- ─────────────────────────────────────────────
insert into ranges (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Betla Range'),
  ('00000000-0000-0000-0000-000000000004', 'Chhipadohar East Range'),
  ('00000000-0000-0000-0000-000000000005', 'Chhipadohar West Range'),
  ('00000000-0000-0000-0000-000000000006', 'Kutku Range')
on conflict (name) do nothing;

-- ─────────────────────────────────────────────
-- Beats as areas (11 beats)
-- Matched on (range_id, name), looked up by range NAME so this works even
-- if a range row pre-exists with a different UUID.
-- ─────────────────────────────────────────────
insert into areas (range_id, name)
select r.id, b.beat
from (values
  ('Betla Range',            'Betla Beat'),
  ('Betla Range',            'Kila Beat'),
  ('Chhipadohar East Range', 'Chhipadohar Beat'),
  ('Chhipadohar East Range', 'Ked Beat'),
  ('Chhipadohar East Range', 'Amwatikar Beat'),
  ('Chhipadohar West Range', 'Barwadih Beat'),
  ('Chhipadohar West Range', 'Morwai Beat'),
  ('Chhipadohar West Range', 'Mandal Beat'),
  ('Chhipadohar West Range', 'Lat Beat'),
  ('Kutku Range',            'Kutku Beat'),
  ('Kutku Range',            'Madgari Beat')
) as b(range_name, beat)
join ranges r on r.name = b.range_name
on conflict (range_id, name) do nothing;

-- PTR Tiger Cell — Seed Data
-- Run AFTER schema.sql
-- Creates auth users via Supabase Auth and matching profile rows

-- ─────────────────────────────────────────────
-- Ranges
-- ─────────────────────────────────────────────
insert into ranges (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Betla Range'),
  ('00000000-0000-0000-0000-000000000002', 'Latehar Range'),
  ('00000000-0000-0000-0000-000000000003', 'Kechki Range')
on conflict do nothing;

-- ─────────────────────────────────────────────
-- Areas
-- ─────────────────────────────────────────────
insert into areas (id, range_id, name) values
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Betla Core'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'Betla Buffer'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000002', 'Latehar North'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000002', 'Latehar South'),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000003', 'Kechki East'),
  ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000003', 'Kechki West'),
  ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0000-000000000003', 'Kechki South')
on conflict do nothing;

-- ─────────────────────────────────────────────
-- Demo users
-- Use the Supabase Dashboard → Authentication → Users to create these
-- OR use the create-user Edge Function
-- OR run this block ONLY if using the Supabase CLI with local dev
-- ─────────────────────────────────────────────
-- Choose a strong unique password per user when creating them. Never
-- commit a real password (even a "demo" one) to this file — anything in
-- git history must be assumed public.

-- To create via SQL (local dev only — service role bypasses auth):
-- DO $$ BEGIN
--   PERFORM auth.create_user(
--     '{"email":"director@ptr.gov.in","password":"<choose-a-strong-password>","email_confirm":true}'::jsonb
--   );
-- END $$;

-- Profile rows are inserted by the create-user Edge Function automatically.
-- For local dev you can insert them directly after creating the auth users:
--
-- insert into profiles (id, name, role, email, phone, avatar_initials, designation, range_id) values
--   ('<auth-uid>', 'Rajesh Kumar', 'director', 'director@ptr.gov.in', '+91-9801234567', 'RK', 'Field Director', null),
--   ('<auth-uid>', 'Amit Singh', 'range_officer', 'officer.betla@ptr.gov.in', '+91-9812345678', 'AS', 'Range Officer', '00000000-0000-0000-0000-000000000001'),
--   ...

-- ─────────────────────────────────────────────
-- Note: Tasks are created through the application UI after login.
-- ─────────────────────────────────────────────

-- PTR Tiger Cell — Seed Data
-- Run AFTER schema.sql
-- Creates auth users via Supabase Auth and matching profile rows

-- ─────────────────────────────────────────────
-- Ranges & areas
-- The real PTR North Division ranges/beats live in seed-north-division.sql
-- (Betla, Chhipadohar East, Chhipadohar West, Kutku) — run that file
-- instead of inserting placeholder ranges here.
-- ─────────────────────────────────────────────

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

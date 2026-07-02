-- Minimal Supabase-compatible shim for local RLS/load testing on vanilla Postgres.
-- Provides just enough of auth.*, storage.*, extensions.uuid_generate_v4, and net.http_post
-- for supabase/schema.sql to apply and for RLS policies to be exercised with SET LOCAL.

do $$ begin
  create role anon noinherit;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated noinherit;
exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role noinherit bypassrls;
exception when duplicate_object then null; end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

create extension if not exists pgcrypto;

-- auth.users: real Supabase manages this via GoTrue; we only need id + a row to FK against.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- auth.uid(): real Supabase reads the JWT's `sub` claim via PostgREST's request.jwt.claims
-- GUC. We emulate it with a session-local setting so tests can `select set_config('app.uid', ...)`.
create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('app.uid', true), '')::uuid
$$;

-- storage.buckets / storage.objects: minimal stand-ins so the storage policies in
-- schema.sql (which reference storage.objects) have a table to attach to.
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid
);
alter table storage.objects enable row level security;

-- pg_net: real Supabase ships this as a background-worker extension that queues async
-- HTTP requests. Not installable outside Supabase's Postgres image, so we stub the one
-- function schema.sql calls (net.http_post) as a no-op that just logs the call — the
-- push-notification *delivery* isn't what we're load/RLS-testing here, the database is.
create schema if not exists net;
create table if not exists net.http_post_log (
  id bigserial primary key,
  url text,
  body jsonb,
  called_at timestamptz default now()
);
create or replace function net.http_post(url text, headers jsonb default '{}'::jsonb, body jsonb default '{}'::jsonb)
returns bigint language plpgsql as $$
begin
  insert into net.http_post_log(url, body) values (url, body);
  return currval(pg_get_serial_sequence('net.http_post_log', 'id'));
end;
$$;

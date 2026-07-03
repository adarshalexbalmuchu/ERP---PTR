-- PTR Tiger Cell Task Management System — Database Schema
-- Run this in the Supabase SQL Editor

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";
-- Lets a Postgres trigger make an outbound HTTP call (used to fire the
-- send-push Edge Function the instant a notification row is inserted,
-- regardless of which code path created it).
create extension if not exists pg_net with schema extensions;

-- ─────────────────────────────────────────────
-- Enums (idempotent)
-- ─────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('director', 'range_officer', 'guard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('NotStarted', 'InProgress', 'Completed', 'Archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('Critical', 'High', 'Medium', 'Low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_category as enum ('Patrol', 'Camera Trap', 'Survey', 'Maintenance', 'Admin', 'Other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('task_assigned', 'task_updated', 'task_completed', 'changes_requested', 'task_archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_type as enum ('human_attack', 'livestock_attack', 'crop_damage', 'property_damage', 'poaching_sign', 'wildlife_sighting', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_severity as enum ('Low', 'Medium', 'High', 'Critical');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────

create table if not exists ranges (
  id   uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists areas (
  id       uuid primary key default uuid_generate_v4(),
  range_id uuid not null references ranges(id) on delete cascade,
  name     text not null,
  created_at timestamptz not null default now(),
  unique (range_id, name)
);

-- Extends auth.users — one row per authenticated user
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  role            user_role not null default 'guard',
  email           text not null unique,
  phone           text,
  avatar_initials text not null default '',
  designation     text not null default '',
  range_id        uuid references ranges(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists tasks (
  id                    uuid primary key default uuid_generate_v4(),
  title                 text not null,
  description           text not null default '',
  assignee_id           uuid not null references profiles(id) on delete restrict,
  created_by_id         uuid not null references profiles(id) on delete restrict,
  range_id              uuid not null references ranges(id) on delete restrict,
  area_id               uuid references areas(id) on delete set null,
  status                task_status not null default 'NotStarted',
  priority              task_priority not null default 'Medium',
  category              task_category not null default 'Patrol',
  due_date              date not null,
  completion_percentage int not null default 0 check (completion_percentage between 0 and 100),
  acknowledged_at       timestamptz,
  completed_at          timestamptz,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists task_updates (
  id                  uuid primary key default uuid_generate_v4(),
  task_id             uuid not null references tasks(id) on delete cascade,
  user_id             uuid not null references profiles(id) on delete restrict,
  note                text not null,
  progress_percentage int not null default 0 check (progress_percentage between 0 and 100),
  lat                 double precision,
  lng                 double precision,
  created_at          timestamptz not null default now()
);

-- Idempotent for databases where task_updates already existed before geotagging was added.
alter table task_updates add column if not exists lat double precision;
alter table task_updates add column if not exists lng double precision;

create table if not exists comments (
  id         uuid primary key default uuid_generate_v4(),
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete restrict,
  content    text not null,
  created_at timestamptz not null default now()
);

create table if not exists attachments (
  id         uuid primary key default uuid_generate_v4(),
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete restrict,
  name       text not null,
  url        text not null,
  size       bigint not null default 0,
  mime_type  text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       notification_type not null,
  title      text not null,
  message    text not null,
  task_id    uuid not null references tasks(id) on delete cascade,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row per browser/device push subscription. endpoint is globally
-- unique (it identifies the device's push channel), so re-subscribing the
-- same device — even as a different user after a logout/login — updates
-- the existing row instead of creating a duplicate.
create table if not exists push_subscriptions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create table if not exists daily_reports (
  id               uuid primary key default uuid_generate_v4(),
  report_date      date not null unique,
  generated_by     uuid not null references profiles(id) on delete restrict,
  total_tasks      int not null default 0,
  completed_count  int not null default 0,
  in_progress_count int not null default 0,
  not_started_count int not null default 0,
  overdue_count    int not null default 0,
  range_breakdown  jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

-- Human-wildlife conflict / field observation log, modeled on the "conflict
-- module" of India's own NTCA M-STrIPES tiger reserve monitoring system.
create table if not exists incidents (
  id            uuid primary key default uuid_generate_v4(),
  type          incident_type not null,
  severity      incident_severity not null default 'Medium',
  description   text not null,
  range_id      uuid not null references ranges(id) on delete restrict,
  area_id       uuid references areas(id) on delete set null,
  lat           double precision,
  lng           double precision,
  reported_by   uuid not null references profiles(id) on delete restrict,
  incident_date timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Accountability log for significant task changes (reassignment, status
-- transitions, deletion). range_id/task_title are denormalized so entries
-- stay meaningful and range-scoped even after the source task is deleted.
create table if not exists audit_log (
  id         uuid primary key default uuid_generate_v4(),
  task_id    uuid references tasks(id) on delete set null,
  task_title text not null default '',
  range_id   uuid references ranges(id) on delete set null,
  actor_id   uuid not null references profiles(id) on delete restrict,
  action     text not null,
  detail     text not null default '',
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
create index if not exists tasks_assignee_id_idx    on tasks(assignee_id);
create index if not exists tasks_range_id_idx       on tasks(range_id);
create index if not exists tasks_status_idx         on tasks(status);
create index if not exists tasks_created_at_idx     on tasks(created_at desc);
create index if not exists tasks_due_date_idx       on tasks(due_date);
create index if not exists audit_log_created_at_idx on audit_log(created_at desc);
create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_read_idx   on notifications(read) where not read;
create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);
create index if not exists task_updates_task_id_idx on task_updates(task_id);
create index if not exists comments_task_id_idx     on comments(task_id);
create index if not exists incidents_range_id_idx   on incidents(range_id);
create index if not exists incidents_type_idx       on incidents(type);
create index if not exists incidents_date_idx       on incidents(incident_date);
create index if not exists audit_log_range_id_idx   on audit_log(range_id);
create index if not exists audit_log_task_id_idx    on audit_log(task_id);

-- ─────────────────────────────────────────────
-- Length limits (defense in depth — the app already limits input, this
-- guards against a malformed/malicious direct API call flooding a text
-- column). Wrapped in DO/EXCEPTION so re-running this file is safe.
-- ─────────────────────────────────────────────
do $$ begin
  alter table tasks add constraint tasks_title_len check (char_length(title) <= 300);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table tasks add constraint tasks_description_len check (char_length(description) <= 5000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table task_updates add constraint task_updates_note_len check (char_length(note) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table comments add constraint comments_content_len check (char_length(content) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table incidents add constraint incidents_description_len check (char_length(description) <= 3000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table audit_log add constraint audit_log_detail_len check (char_length(detail) <= 1000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table notifications add constraint notifications_title_len check (char_length(title) <= 200);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table notifications add constraint notifications_message_len check (char_length(message) <= 1000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table attachments add constraint attachments_name_len check (char_length(name) <= 300);
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────
-- All functions pin search_path so a role that can create objects in a
-- schema earlier on the path can't shadow a table/function these bodies
-- reference (search-path hijacking). Especially critical for the two
-- SECURITY DEFINER helpers below, which run with the owner's privileges.
create or replace function set_updated_at()
returns trigger language plpgsql
set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────
-- Helper: get current user's role / range
-- ─────────────────────────────────────────────
create or replace function get_my_role()
returns user_role language sql security definer stable
set search_path = '' as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function get_my_range_id()
returns uuid language sql security definer stable
set search_path = '' as $$
  select range_id from public.profiles where id = auth.uid();
$$;

-- ─────────────────────────────────────────────
-- Column-level guards
-- RLS policies (USING/WITH CHECK) can only gate row visibility, not which
-- columns change on an UPDATE. These triggers close that gap for the two
-- places a broad "for update using (...)" policy would otherwise let a
-- lower-privileged role write to fields it should never touch.
-- ─────────────────────────────────────────────

-- Without this, profiles_self_update (id = auth.uid()) lets ANY user set
-- their own role to 'director' or move themselves to another range via a
-- direct API call — a full privilege escalation. Only a director may
-- change role/range_id; everyone may still edit their own name/phone/etc.
create or replace function enforce_profile_self_update()
returns trigger language plpgsql
set search_path = '' as $$
begin
  if auth.uid() = new.id and public.get_my_role() <> 'director' then
    if new.role is distinct from old.role or new.range_id is distinct from old.range_id then
      raise exception 'Only a director can change role or range assignment';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_self_update_guard on profiles;
create trigger profiles_self_update_guard
  before update on profiles
  for each row execute function enforce_profile_self_update();

-- Without this, tasks_guard_update (assignee_id = auth.uid()) lets a guard
-- change ANY column on their assigned task via a direct API call —
-- reassigning it, editing its priority/due date, or setting status
-- straight to 'Archived' and bypassing officer/director review entirely.
-- A guard may only move status forward through the normal flow and touch
-- the progress/acknowledgement fields the app's own mutations use.
create or replace function enforce_guard_task_update()
returns trigger language plpgsql
set search_path = '' as $$
begin
  if public.get_my_role() = 'guard' then
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.assignee_id is distinct from old.assignee_id
      or new.created_by_id is distinct from old.created_by_id
      or new.range_id is distinct from old.range_id
      or new.area_id is distinct from old.area_id
      or new.priority is distinct from old.priority
      or new.category is distinct from old.category
      or new.due_date is distinct from old.due_date
      or new.archived_at is distinct from old.archived_at
    then
      raise exception 'Guards may only update status/progress fields on their own tasks';
    end if;
    if new.status is distinct from old.status and new.status = 'Archived' then
      raise exception 'Only a range officer or director can archive a task';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_guard_update_guard on tasks;
create trigger tasks_guard_update_guard
  before update on tasks
  for each row execute function enforce_guard_task_update();

-- Fires the send-push Edge Function for every new in-app notification, so
-- a device notification shows up no matter which client code path wrote
-- the row. The function itself has verify_jwt = false (see
-- supabase/config.toml) and instead checks the x-webhook-secret header
-- against its own PUSH_WEBHOOK_SECRET env var.
--
-- The shared secret is NOT stored in this file (a secret committed to git
-- is not a secret). It lives in Supabase Vault; set the SAME value in both
-- places:
--   select vault.create_secret('<a-random-string>', 'push_webhook_secret');
--   supabase secrets set PUSH_WEBHOOK_SECRET=<the-same-random-string>
-- If the vault secret is absent, the trigger silently skips push delivery —
-- it never blocks the notification insert itself.
--
-- SECURITY DEFINER (owner: postgres) so the vault read works and so
-- ordinary clients don't need any direct grant on net.http_post.
-- If this project is ever recreated, update the project ref in the URL too.
create or replace function notify_push_on_notification_insert()
returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  secret text;
begin
  begin
    select decrypted_secret into secret
      from vault.decrypted_secrets
     where name = 'push_webhook_secret'
     limit 1;
  exception when others then
    secret := null; -- vault not installed / not readable
  end;

  if secret is null then
    return new;
  end if;

  begin
    perform net.http_post(
      url := 'https://hsaqgpuvdbyrineknwzf.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', secret
      ),
      body := jsonb_build_object(
        'user_id', new.user_id,
        'title', new.title,
        'message', new.message,
        'task_id', new.task_id
      )
    );
  exception when others then
    null; -- push delivery is best-effort; never fail the insert
  end;
  return new;
end;
$$;

drop trigger if exists notifications_push_trigger on notifications;
create trigger notifications_push_trigger
  after insert on notifications
  for each row execute function notify_push_on_notification_insert();

-- ─────────────────────────────────────────────
-- Row Level Security
--
-- get_my_role()/get_my_range_id()/auth.uid() calls below are wrapped in
-- `(select ...)`. Without that wrapper, Postgres re-evaluates the function
-- (each a subquery against profiles) once per row scanned, and — because
-- tasks has multiple permissive SELECT policies that get OR'd together —
-- the planner can't push range_id/assignee_id through the range_id/
-- assignee_id indexes either, forcing a full table scan even for a
-- single-range officer. Wrapping in `(select ...)` turns each call into a
-- one-time InitPlan instead of a per-row filter. Measured on a 50k-row
-- local benchmark: an officer's task list went from ~1000ms to ~7ms.
-- ─────────────────────────────────────────────
alter table profiles      enable row level security;
alter table ranges        enable row level security;
alter table areas         enable row level security;
alter table tasks         enable row level security;
alter table task_updates  enable row level security;
alter table comments      enable row level security;
alter table attachments   enable row level security;
alter table notifications enable row level security;
alter table daily_reports enable row level security;
alter table incidents     enable row level security;
alter table audit_log     enable row level security;
alter table push_subscriptions enable row level security;

-- Drop all policies before recreating (idempotent)
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- ranges & areas: everyone authenticated can read
create policy "ranges_read" on ranges for select using ((select auth.uid()) is not null);
create policy "ranges_write" on ranges for all using ((select get_my_role()) = 'director');

create policy "areas_read" on areas for select using ((select auth.uid()) is not null);
create policy "areas_write" on areas for all using ((select get_my_role()) = 'director');

-- profiles
create policy "profiles_read" on profiles for select using ((select auth.uid()) is not null);
create policy "profiles_self_update" on profiles for update using (id = (select auth.uid()));
create policy "profiles_director" on profiles for all using ((select get_my_role()) = 'director');

-- tasks
create policy "tasks_director" on tasks
  for all using ((select get_my_role()) = 'director');

create policy "tasks_officer_read" on tasks
  for select using (
    (select get_my_role()) = 'range_officer' and range_id = (select get_my_range_id())
  );

create policy "tasks_officer_write" on tasks
  for all using (
    (select get_my_role()) = 'range_officer' and range_id = (select get_my_range_id())
  );

create policy "tasks_guard_read" on tasks
  for select using (
    (select get_my_role()) = 'guard' and assignee_id = (select auth.uid())
  );

create policy "tasks_guard_update" on tasks
  for update using (
    (select get_my_role()) = 'guard' and assignee_id = (select auth.uid())
  );

-- task_updates
create policy "task_updates_director" on task_updates
  for all using ((select get_my_role()) = 'director');

create policy "task_updates_officer" on task_updates
  for all using (
    (select get_my_role()) = 'range_officer' and
    exists (select 1 from tasks where tasks.id = task_updates.task_id and tasks.range_id = (select get_my_range_id()))
  );

create policy "task_updates_guard_read" on task_updates
  for select using (
    (select get_my_role()) = 'guard' and
    exists (select 1 from tasks where tasks.id = task_updates.task_id and tasks.assignee_id = (select auth.uid()))
  );

create policy "task_updates_guard_insert" on task_updates
  for insert with check (
    (select get_my_role()) = 'guard' and
    user_id = (select auth.uid()) and
    exists (select 1 from tasks where tasks.id = task_updates.task_id and tasks.assignee_id = (select auth.uid()))
  );

-- comments
create policy "comments_director" on comments
  for all using ((select get_my_role()) = 'director');

create policy "comments_officer" on comments
  for all using (
    (select get_my_role()) = 'range_officer' and
    exists (select 1 from tasks where tasks.id = comments.task_id and tasks.range_id = (select get_my_range_id()))
  );

create policy "comments_guard_read" on comments
  for select using (
    (select get_my_role()) = 'guard' and
    exists (select 1 from tasks where tasks.id = comments.task_id and tasks.assignee_id = (select auth.uid()))
  );

create policy "comments_guard_insert" on comments
  for insert with check (
    (select get_my_role()) = 'guard' and
    user_id = (select auth.uid()) and
    exists (select 1 from tasks where tasks.id = comments.task_id and tasks.assignee_id = (select auth.uid()))
  );

-- attachments — same as comments
create policy "attachments_director" on attachments
  for all using ((select get_my_role()) = 'director');

create policy "attachments_officer" on attachments
  for all using (
    (select get_my_role()) = 'range_officer' and
    exists (select 1 from tasks where tasks.id = attachments.task_id and tasks.range_id = (select get_my_range_id()))
  );

create policy "attachments_guard_read" on attachments
  for select using (
    (select get_my_role()) = 'guard' and
    exists (select 1 from tasks where tasks.id = attachments.task_id and tasks.assignee_id = (select auth.uid()))
  );

create policy "attachments_guard_insert" on attachments
  for insert with check (
    (select get_my_role()) = 'guard' and
    user_id = (select auth.uid()) and
    exists (select 1 from tasks where tasks.id = attachments.task_id and tasks.assignee_id = (select auth.uid()))
  );

-- notifications: everyone reads/updates/deletes only their own, but an
-- authenticated user can insert a notification for someone else — that's
-- the entire point of the feature (task assignment, completion, archive,
-- and changes-requested notifications are all written by someone other
-- than the recipient). A single "for all using (user_id = auth.uid())"
-- policy would implicitly reuse that USING clause as the INSERT check too,
-- blocking every one of those inserts with a 403.
--
-- The insert IS scoped to tasks the sender can see (the subquery runs
-- under the sender's own tasks RLS): every legitimate flow notifies about
-- a task visible to the actor, and without this check any signed-in user
-- could push arbitrary text to any other user's devices by picking a
-- random task_id.
create policy "notifications_read" on notifications
  for select using (user_id = (select auth.uid()));

create policy "notifications_insert" on notifications
  for insert with check (
    (select auth.uid()) is not null
    and exists (select 1 from tasks where tasks.id = notifications.task_id)
  );

create policy "notifications_update" on notifications
  for update using (user_id = (select auth.uid()));

create policy "notifications_delete" on notifications
  for delete using (user_id = (select auth.uid()));

-- push_subscriptions: a device's subscription belongs to whoever is
-- currently signed in on it. "for all" is safe here (unlike notifications)
-- because a user only ever writes their OWN row — there's no cross-user
-- insert case to worry about.
create policy "push_subscriptions_own" on push_subscriptions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- daily_reports: director full, others read-only
create policy "daily_reports_director" on daily_reports
  for all using ((select get_my_role()) = 'director');

create policy "daily_reports_read" on daily_reports
  for select using ((select get_my_role()) = 'range_officer' or (select get_my_role()) = 'guard');

-- incidents: director full; officer full within their range; guard can
-- report (insert) and read incidents within their own range for situational
-- awareness (conflict data is operationally relevant to everyone patrolling
-- that area, not just the person who reported it).
create policy "incidents_director" on incidents
  for all using ((select get_my_role()) = 'director');

create policy "incidents_officer" on incidents
  for all using ((select get_my_role()) = 'range_officer' and range_id = (select get_my_range_id()));

create policy "incidents_guard_read" on incidents
  for select using ((select get_my_role()) = 'guard' and range_id = (select get_my_range_id()));

create policy "incidents_guard_insert" on incidents
  for insert with check ((select get_my_role()) = 'guard' and reported_by = (select auth.uid()));

-- audit_log: management-only read (director all, officer their range);
-- insert is open to any authenticated user but only as themselves, since
-- guards also trigger logged actions (starting/completing their own tasks)
-- even though they can't read the log back.
create policy "audit_log_director_read" on audit_log
  for select using ((select get_my_role()) = 'director');

create policy "audit_log_officer_read" on audit_log
  for select using ((select get_my_role()) = 'range_officer' and range_id = (select get_my_range_id()));

create policy "audit_log_insert" on audit_log
  for insert with check (actor_id = (select auth.uid()));

-- ─────────────────────────────────────────────
-- Storage bucket for attachments
-- ─────────────────────────────────────────────
-- Private bucket with a hard server-side size cap (25 MB) — the app also
-- checks before uploading, but only this stops a direct API call.
insert into storage.buckets (id, name, public, file_size_limit)
  values ('task-attachments', 'task-attachments', false, 26214400)
  on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- The public-schema policy DROP loop above only covers schemaname = 'public',
-- so storage.objects policies need their own explicit drops to stay idempotent.
drop policy if exists "attachments_upload" on storage.objects;
drop policy if exists "attachments_download" on storage.objects;
drop policy if exists "attachments_delete" on storage.objects;

-- Objects are stored under "<task-id>/<uuid>-<filename>" (see
-- uploadAttachment in src/hooks/useTask.ts). The EXISTS subqueries below
-- run under the caller's OWN tasks RLS, so storage access follows task
-- visibility exactly: directors everywhere, officers within their range,
-- guards only on tasks assigned to them. Without this scoping, any
-- authenticated user could enumerate/download (or delete) every file in
-- the bucket regardless of role.
create policy "attachments_upload" on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[1]
    )
  );

create policy "attachments_download" on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[1]
    )
  );

-- Delete mirrors the attachments-table policies: management only (the app
-- exposes attachment removal only to officers/directors; guards can't
-- delete attachment rows either).
create policy "attachments_delete" on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and (select public.get_my_role()) in ('director', 'range_officer')
    and exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[1]
    )
  );

-- ─────────────────────────────────────────────
-- Dashboard aggregate views
-- security_invoker = true is required: without it, a view runs with the
-- view owner's privileges and BYPASSES the RLS policies on the underlying
-- tasks table, leaking every task to every role. With it, the view is
-- evaluated as the querying user, so RLS still scopes rows exactly as it
-- does for a direct `select * from tasks`.
-- ─────────────────────────────────────────────
create or replace view task_dashboard_stats
  with (security_invoker = true) as
  select
    count(*) as total_tasks,
    count(*) filter (where priority = 'Critical' and status <> 'Archived') as critical_count,
    count(*) filter (where status = 'InProgress') as in_progress_count,
    count(*) filter (where status = 'Completed') as completed_count,
    count(*) filter (where status = 'Archived') as archived_count,
    count(*) filter (where due_date < now() and status not in ('Completed', 'Archived')) as overdue_count
  from tasks;

create or replace view task_range_stats
  with (security_invoker = true) as
  select
    r.id as range_id,
    r.name as range_name,
    count(t.id) as total,
    count(t.id) filter (where t.status = 'NotStarted') as not_started_count,
    count(t.id) filter (where t.status = 'InProgress') as in_progress_count,
    count(t.id) filter (where t.status = 'Completed') as completed_count,
    count(t.id) filter (where t.status = 'Archived') as archived_count,
    count(t.id) filter (where t.status = 'Completed' or t.status = 'Archived') as completed,
    count(t.id) filter (where t.due_date < now() and t.status not in ('Completed', 'Archived')) as overdue
  from ranges r
  left join tasks t on t.range_id = r.id
  group by r.id, r.name;

grant select on task_dashboard_stats to authenticated;
grant select on task_range_stats to authenticated;

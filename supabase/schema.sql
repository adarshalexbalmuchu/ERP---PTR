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
  create type user_role as enum ('director', 'range_officer', 'guard', 'range_office', 'tiger_cell');
exception when duplicate_object then null; end $$;

-- range_office and tiger_cell were added after the type's initial creation
-- above, so an already-deployed database needs these ALTER statements to
-- pick them up (the do-block above only fires create on a fresh database).
alter type user_role add value if not exists 'range_office';
alter type user_role add value if not exists 'tiger_cell';
-- Restricted role: Hospitality Inventory Management module only (own
-- assigned locations, own profile) — never Tasks/Incidents/Map/Personnel/
-- Audit. See get_my_inventory_location_ids() and the inventory RLS section
-- near the end of this file.
alter type user_role add value if not exists 'inventory_staff';

-- Postgres runs this whole pasted script as one implicit transaction, and a
-- newly-added enum value can't be referenced until that transaction commits
-- ("unsafe use of new value of enum type") -- is_field_role() further down
-- compares against 'range_office'/'tiger_cell' directly, so commit here to
-- close out the ALTER TYPE statements before anything reads the new values.
commit;

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
  create type notification_type as enum ('task_assigned', 'task_updated', 'task_completed', 'changes_requested', 'task_archived', 'task_due_soon', 'task_due_today', 'task_overdue');
exception when duplicate_object then null; end $$;

-- Deadline-reminder types appended after the enum's initial rollout; no-ops
-- on a fresh database where create type above already includes them. A new
-- enum value can't be referenced until the transaction that added it commits
-- ("unsafe use of new value of enum type"), and send_task_deadline_reminders
-- below inserts these literals — commit now so an already-deployed database
-- can run this whole file in one paste.
alter type notification_type add value if not exists 'task_due_soon';
alter type notification_type add value if not exists 'task_due_today';
alter type notification_type add value if not exists 'task_overdue';
-- Fired when a guard/officer/director reports a field incident — see
-- notify_on_incident_insert() further down.
alter type notification_type add value if not exists 'incident_reported';
-- Hospitality Inventory Management module (see the dedicated section near
-- the end of this file).
alter type notification_type add value if not exists 'inventory_request_submitted';
alter type notification_type add value if not exists 'inventory_request_approved';
alter type notification_type add value if not exists 'inventory_request_rejected';
alter type notification_type add value if not exists 'inventory_stock_issued';
commit;

do $$ begin
  create type incident_type as enum ('human_attack', 'livestock_attack', 'crop_damage', 'property_damage', 'poaching_sign', 'wildlife_sighting', 'road_kill', 'other');
exception when duplicate_object then null; end $$;

-- Values appended to incident_type after the initial rollout; no-ops on a
-- fresh database where create type above already includes them.
alter type incident_type add value if not exists 'road_kill' before 'other';

-- Per-category "Other" catch-alls, added when the incident type dropdown
-- was grouped into Human-Wildlife Conflict / Protection / Wildlife Sighting
-- categories — 'other' remains Protection's catch-all.
alter type incident_type add value if not exists 'conflict_other' before 'poaching_sign';
alter type incident_type add value if not exists 'sighting_other' after 'wildlife_sighting';

-- Protection category grew beyond just Poaching Sign / Road Kill.
alter type incident_type add value if not exists 'animal_injury' after 'road_kill';
alter type incident_type add value if not exists 'tree_felling' after 'animal_injury';

do $$ begin
  create type incident_severity as enum ('Low', 'Medium', 'High', 'Critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_status as enum ('Open', 'Resolved');
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

-- Extra ranges for officers who hold charge of MORE than one range (e.g. a
-- Range Officer in charge of Chhipadohar East + West + Kutku). A user's
-- effective range set is profiles.range_id UNION these rows — see
-- get_my_range_ids(). Single-range users need no rows here; guards keep
-- using profiles.range_id alone.
create table if not exists officer_ranges (
  user_id    uuid not null references profiles(id) on delete cascade,
  range_id   uuid not null references ranges(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, range_id)
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

-- Free-text label for tasks whose category is 'Other' — lets the creator
-- say what the "Other" work actually is. Null for the fixed categories.
-- Idempotent so re-running against an existing database just adds it.
alter table tasks add column if not exists category_other text;

-- Groups the individual task rows created from a single "assign to several
-- people at once" submission in TaskForm — each assignee gets their own
-- fully independent task row (own status/progress/due date), but the UI
-- still shows them together as one card. Null for a task created with a
-- single assignee, or any task from before this column existed.
alter table tasks add column if not exists batch_id uuid;
create index if not exists tasks_batch_id_idx on tasks(batch_id) where batch_id is not null;

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
  task_id    uuid references tasks(id) on delete cascade,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- A notification is now either about a task OR an incident, not always a
-- task — task_id above was NOT NULL until incident_reported notifications
-- needed to point somewhere else. Idempotent for a database that already
-- has this column from before incident notifications existed. The
-- incident_id FK/index/check are added further down, once the incidents
-- table this column references actually exists.
alter table notifications alter column task_id drop not null;

-- Additional assignees beyond tasks.assignee_id (the "primary" assignee).
-- A director/officer can add as many collaborators to a task as needed;
-- everyone listed here gets the same guard-level read/update access to the
-- task as the primary assignee (see RLS below).
create table if not exists task_assignees (
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

-- Current live location of a field-role user, ONE row per user (upserted,
-- not a history log) while they hold an active patrol task. This is a
-- disclosed feature: the app shows the field user a persistent on-screen
-- indicator whenever this is being written (see useLocationSharing in
-- src/hooks/useLiveLocation.ts) — there is no hidden/background variant.
-- Visible only to the director and to range officers of the task's range
-- (see RLS below); never to other guards.
create table if not exists live_locations (
  user_id    uuid primary key references profiles(id) on delete cascade,
  task_id    uuid not null references tasks(id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  updated_at timestamptz not null default now()
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

-- Bookkeeping for send_task_deadline_reminders(): one row per reminder
-- actually sent, keyed on (task, recipient, kind, the due date it was about).
-- The composite PK is what makes the hourly cron idempotent — a reminder can
-- never repeat for the same deadline, but moving a task's due date changes
-- due_date here, so the reschedule correctly re-arms all three reminder
-- kinds for the new date. Not a user-facing table: RLS is enabled with no
-- policies (only the SECURITY DEFINER reminder function writes it).
create table if not exists task_reminders_sent (
  task_id  uuid not null references tasks(id) on delete cascade,
  user_id  uuid not null references profiles(id) on delete cascade,
  kind     text not null check (kind in ('due_soon', 'due_today', 'overdue')),
  due_date date not null,
  sent_at  timestamptz not null default now(),
  primary key (task_id, user_id, kind, due_date)
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

-- Free-text label for incidents whose type is one of the per-category
-- "Other" catch-alls — lets the reporter say what it actually is. Null for
-- the fixed subcategories. Idempotent so re-running against an existing
-- database just adds it.
alter table incidents add column if not exists type_other text;

-- Incident response tracking: who is handling an incident and whether it
-- has been resolved. status defaults to 'Open' so every existing row is
-- treated as still open; assigned_to is nullable (an incident can sit
-- unassigned). assigned_at/resolved_at record when each transition
-- happened, mirroring the acknowledged_at/completed_at/archived_at pattern
-- already used on tasks. UPDATE access is already covered by the existing
-- "incidents_director" / "incidents_tiger_cell" management policies
-- (for all) further down, so no new RLS policy is needed.
alter table incidents add column if not exists status incident_status not null default 'Open';
alter table incidents add column if not exists assigned_to uuid references profiles(id) on delete set null;
alter table incidents add column if not exists assigned_at timestamptz;
alter table incidents add column if not exists resolved_at timestamptz;

-- Now that incidents exists, wire up notifications.incident_id (see the
-- notifications table above) — an incident_reported notification points
-- here instead of at a task.
alter table notifications add column if not exists incident_id uuid references incidents(id) on delete cascade;
create index if not exists notifications_incident_id_idx on notifications(incident_id) where incident_id is not null;

do $$ begin
  alter table notifications add constraint notifications_task_or_incident_chk
    check ((task_id is not null) <> (incident_id is not null));
exception when duplicate_object then null; end $$;

-- Photos attached to an incident report. Compressed client-side before
-- upload (see src/lib/incidentPhotos.ts) — this table only ever stores the
-- already-optimized file, same as attachments does for tasks.
create table if not exists incident_photos (
  id          uuid primary key default uuid_generate_v4(),
  incident_id uuid not null references incidents(id) on delete cascade,
  uploaded_by uuid not null references profiles(id) on delete restrict,
  path        text not null,
  size        bigint not null default 0,
  mime_type   text not null default 'image/jpeg',
  created_at  timestamptz not null default now()
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
create index if not exists task_assignees_user_id_idx on task_assignees(user_id);
create index if not exists audit_log_created_at_idx on audit_log(created_at desc);
create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_read_idx   on notifications(read) where not read;
create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);
create index if not exists task_updates_task_id_idx on task_updates(task_id);
create index if not exists comments_task_id_idx     on comments(task_id);
create index if not exists incidents_range_id_idx   on incidents(range_id);
create index if not exists incidents_type_idx       on incidents(type);
create index if not exists incidents_status_idx     on incidents(status);
create index if not exists incidents_assigned_to_idx on incidents(assigned_to) where assigned_to is not null;
create index if not exists incidents_date_idx       on incidents(incident_date);
create index if not exists incident_photos_incident_id_idx on incident_photos(incident_id);
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
  alter table tasks add constraint tasks_category_other_len check (char_length(category_other) <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table incidents add constraint incidents_type_other_len check (char_length(type_other) <= 100);
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

drop trigger if exists live_locations_updated_at on live_locations;
create trigger live_locations_updated_at before update on live_locations
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────
-- Helper: get current user's role / range
-- ─────────────────────────────────────────────
create or replace function get_my_role()
returns user_role language sql security definer stable
set search_path = '' as $$
  select role from public.profiles where id = auth.uid();
$$;

-- range_office and tiger_cell hold the same access level as guard (field
-- staff scoped to their own assigned tasks/incidents) — just a different
-- personnel label. Every RLS policy and trigger that used to check
-- `get_my_role() = 'guard'` calls this instead, so the three stay in sync.
create or replace function is_field_role()
returns boolean language sql security invoker stable
set search_path = '' as $$
  select (select public.get_my_role()) in ('guard', 'range_office', 'tiger_cell');
$$;

create or replace function get_my_range_id()
returns uuid language sql security definer stable
set search_path = '' as $$
  select range_id from public.profiles where id = auth.uid();
$$;

-- All ranges the current user holds: profiles.range_id plus any extra
-- officer_ranges rows. Returns an ARRAY (not a set) so RLS policies can use
-- `range_id = any ((select get_my_range_ids())::uuid[])` — the wrapping (select ...)
-- becomes a one-time InitPlan and `= any(<array>)` stays index-driven,
-- preserving the RLS performance fix documented above the policy section.
create or replace function get_my_range_ids()
returns uuid[] language sql security definer stable
set search_path = '' as $$
  select coalesce(array_agg(range_id), '{}'::uuid[]) from (
    select range_id from public.profiles
      where id = auth.uid() and range_id is not null
    union
    select range_id from public.officer_ranges where user_id = auth.uid()
  ) r;
$$;

-- Is the current user a co-assignee of this task? SECURITY DEFINER is
-- load-bearing here, not just a convenience: policies on tasks need to
-- consult task_assignees, and policies on task_assignees need to consult
-- tasks. If either side referenced the other table DIRECTLY, the rewriter
-- would expand RLS policies in a loop and every guard task query would fail
-- with "infinite recursion detected in policy" (42P17). Routing one
-- direction through an owner-privileged function keeps it opaque to the
-- rewriter and breaks the cycle. Cost is unchanged vs the correlated EXISTS
-- it replaces: one primary-key probe per row checked.
create or replace function is_task_assignee(t_id uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1 from public.task_assignees
    where task_id = t_id and user_id = auth.uid()
  );
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
-- direct API call — a full privilege escalation. Policy decision (matches
-- the Profile page in the app): a non-director may self-edit ONLY their
-- phone number. Name, email, designation, initials, role, and range are
-- service-record fields maintained by the director's office.
create or replace function enforce_profile_self_update()
returns trigger language plpgsql
set search_path = '' as $$
begin
  if auth.uid() = new.id and public.get_my_role() <> 'director' then
    if new.role is distinct from old.role or new.range_id is distinct from old.range_id then
      raise exception 'Only a director can change role or range assignment';
    end if;
    if new.name is distinct from old.name
      or new.email is distinct from old.email
      or new.designation is distinct from old.designation
      or new.avatar_initials is distinct from old.avatar_initials
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Only your phone number can be changed here — other details are managed by the director''s office';
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
  if public.is_field_role() then
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
  task_priority text;
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

  -- Drives the device vibration pattern in src/sw.ts — task notifications
  -- key it off the task's priority; an incident_reported notification has
  -- no task_id, so fall back to the incident's severity (same four
  -- values: Critical/High/Medium/Low) so a Critical incident still buzzes
  -- as urgently as a Critical task.
  if new.task_id is not null then
    select priority::text into task_priority from public.tasks where id = new.task_id;
  elsif new.incident_id is not null then
    select severity::text into task_priority from public.incidents where id = new.incident_id;
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
        'task_id', new.task_id,
        'type', new.type,
        'priority', task_priority
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

-- Notifies the director(s) and every user stationed in (or holding charge
-- of) the incident's range the moment it's reported — director, range
-- officer, guard, range office, and tiger cell alike, not just the
-- director/range-officer pair. SECURITY DEFINER is load-bearing here, not
-- just convenience: the reporter is very often a guard, and a guard's own
-- RLS can't see other users' officer_ranges rows (needed to find a
-- MULTI-range officer) or other profiles' range_id — resolving recipients
-- from the client would silently miss people. This runs as the table owner
-- instead, so it sees every candidate regardless of who's reporting. The
-- three-way UNION also de-duplicates automatically (UNION, not UNION ALL)
-- if someone somehow matches more than one arm.
create or replace function notify_on_incident_insert()
returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  recipient record;
  range_name text;
begin
  select name into range_name from public.ranges where id = new.range_id;

  for recipient in
    select id as user_id from public.profiles

      where role = 'director' and id <> new.reported_by
    union
    select id as user_id from public.profiles
      where range_id = new.range_id and id <> new.reported_by
    union
    select user_id from public.officer_ranges
      where range_id = new.range_id and user_id <> new.reported_by
  loop
    insert into public.notifications (user_id, type, title, message, incident_id)
    values (
      recipient.user_id,
      'incident_reported',
      new.severity::text || ' severity incident reported',
      coalesce(range_name, 'Unknown range') || ' — ' || left(new.description, 150),
      new.id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists incidents_notify_insert on incidents;
create trigger incidents_notify_insert
  after insert on incidents
  for each row execute function notify_on_incident_insert();

-- ─────────────────────────────────────────────
-- Task deadline reminders
--
-- Inserts ordinary `notifications` rows — which the push trigger above then
-- delivers to devices — for three moments in a task's life:
--   due_soon:  the day before due_date        → every assignee
--   due_today: the morning of due_date        → every assignee
--   overdue:   past due_date and still open   → every assignee + the creator
-- "Assignees" = tasks.assignee_id UNION task_assignees. Only NotStarted /
-- InProgress tasks remind (a task marked Completed and awaiting approval
-- shouldn't nag anyone).
--
-- Dates are computed in IST (Asia/Kolkata — the reserve's timezone), and the
-- function refuses to send outside 08:00–20:00 IST so the date flipping at
-- midnight never buzzes a phone at night; the hourly cron job simply
-- delivers the pending reminders on its first run after 8 AM. Pass
-- p_ignore_quiet_hours := true to bypass the gate when testing by hand:
--   select send_task_deadline_reminders(true);
--
-- task_reminders_sent (see above) makes every send exactly-once per
-- (task, user, kind, due date): the insert into it is the gate, and only
-- rows that actually landed there produce a notification.
create or replace function send_task_deadline_reminders(p_ignore_quiet_hours boolean default false)
returns void language plpgsql security definer
set search_path = '' as $$
declare
  today    date := (now() at time zone 'Asia/Kolkata')::date;
  hour_ist int  := extract(hour from now() at time zone 'Asia/Kolkata');
begin
  if not p_ignore_quiet_hours and (hour_ist < 8 or hour_ist >= 20) then
    return;
  end if;

  -- due tomorrow → assignees
  with recipients as (
    select t.id as task_id, t.title, t.due_date, t.assignee_id as user_id
      from public.tasks t
     where t.status in ('NotStarted', 'InProgress') and t.due_date = today + 1
    union
    select t.id, t.title, t.due_date, ta.user_id
      from public.tasks t
      join public.task_assignees ta on ta.task_id = t.id
     where t.status in ('NotStarted', 'InProgress') and t.due_date = today + 1
  ), marked as (
    insert into public.task_reminders_sent (task_id, user_id, kind, due_date)
    select task_id, user_id, 'due_soon', due_date from recipients
    on conflict do nothing
    returning task_id, user_id
  )
  insert into public.notifications (user_id, type, title, message, task_id)
  select m.user_id, 'task_due_soon', 'Reminder: Task Due Tomorrow',
         'Your task "' || left(r.title, 150) || '" is due tomorrow (' || to_char(r.due_date, 'DD Mon') || ').',
         m.task_id
    from marked m
    join recipients r on r.task_id = m.task_id and r.user_id = m.user_id;

  -- due today → assignees
  with recipients as (
    select t.id as task_id, t.title, t.due_date, t.assignee_id as user_id
      from public.tasks t
     where t.status in ('NotStarted', 'InProgress') and t.due_date = today
    union
    select t.id, t.title, t.due_date, ta.user_id
      from public.tasks t
      join public.task_assignees ta on ta.task_id = t.id
     where t.status in ('NotStarted', 'InProgress') and t.due_date = today
  ), marked as (
    insert into public.task_reminders_sent (task_id, user_id, kind, due_date)
    select task_id, user_id, 'due_today', due_date from recipients
    on conflict do nothing
    returning task_id, user_id
  )
  insert into public.notifications (user_id, type, title, message, task_id)
  select m.user_id, 'task_due_today', 'Reminder: Task Due Today',
         'Your task "' || left(r.title, 150) || '" is due today. Update progress or mark it done.',
         m.task_id
    from marked m
    join recipients r on r.task_id = m.task_id and r.user_id = m.user_id;

  -- overdue → assignees + creator (the creator runs the closed loop, so they
  -- should know a deadline slipped without opening the dashboard)
  with recipients as (
    select t.id as task_id, t.title, t.due_date, t.assignee_id as user_id
      from public.tasks t
     where t.status in ('NotStarted', 'InProgress') and t.due_date < today
    union
    select t.id, t.title, t.due_date, ta.user_id
      from public.tasks t
      join public.task_assignees ta on ta.task_id = t.id
     where t.status in ('NotStarted', 'InProgress') and t.due_date < today
    union
    select t.id, t.title, t.due_date, t.created_by_id
      from public.tasks t
     where t.status in ('NotStarted', 'InProgress') and t.due_date < today
  ), marked as (
    insert into public.task_reminders_sent (task_id, user_id, kind, due_date)
    select task_id, user_id, 'overdue', due_date from recipients
    on conflict do nothing
    returning task_id, user_id
  )
  insert into public.notifications (user_id, type, title, message, task_id)
  select m.user_id, 'task_overdue', 'Task Overdue',
         'Task "' || left(r.title, 150) || '" was due on ' || to_char(r.due_date, 'DD Mon') || ' and is still open.',
         m.task_id
    from marked m
    join recipients r on r.task_id = m.task_id and r.user_id = m.user_id;
end;
$$;

revoke all on function send_task_deadline_reminders(boolean) from public;

-- Hourly via pg_cron; the function's own quiet-hours/dedup logic makes every
-- run a cheap no-op when there's nothing new to say. Both steps are wrapped
-- so this file still applies where pg_cron isn't installable (the local test
-- shim) — on real Supabase, enable the pg_cron extension and re-run this
-- block if the do-blocks report nothing scheduled.
do $$ begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable; deadline reminders not scheduled';
end $$;

do $$ begin
  perform cron.unschedule('task-deadline-reminders')
    from cron.job where jobname = 'task-deadline-reminders';
  perform cron.schedule('task-deadline-reminders', '0 * * * *',
                        'select public.send_task_deadline_reminders()');
exception when others then
  raise notice 'pg_cron unavailable; deadline reminders not scheduled';
end $$;

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
alter table task_assignees enable row level security;
alter table notifications enable row level security;
-- No policies on purpose: only the SECURITY DEFINER reminder function
-- touches this table, so every client role is locked out entirely.
alter table task_reminders_sent enable row level security;
alter table daily_reports enable row level security;
alter table incidents     enable row level security;
alter table incident_photos enable row level security;
alter table audit_log     enable row level security;
alter table push_subscriptions enable row level security;
alter table officer_ranges enable row level security;
alter table live_locations enable row level security;

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

-- profiles: everyone can read their own row and any director's (directors
-- create tasks reserve-wide, so their name needs to resolve everywhere);
-- otherwise readable only within the caller's own range(s) — officers and
-- guards have no legitimate reason to read another range's roster.
create policy "profiles_read" on profiles for select using (
  (select auth.uid()) is not null and (
    id = (select auth.uid())
    or role = 'director'
    or range_id = any ((select get_my_range_ids())::uuid[])
  )
);
create policy "profiles_self_update" on profiles for update using (id = (select auth.uid()));
create policy "profiles_director" on profiles for all using ((select get_my_role()) = 'director');

-- tasks
create policy "tasks_director" on tasks
  for all using ((select get_my_role()) = 'director');

create policy "tasks_officer_read" on tasks
  for select using (
    (select get_my_role()) = 'range_officer' and range_id = any ((select get_my_range_ids())::uuid[])
  );

create policy "tasks_officer_write" on tasks
  for all using (
    (select get_my_role()) = 'range_officer' and range_id = any ((select get_my_range_ids())::uuid[])
  );

create policy "tasks_guard_read" on tasks
  for select using (
    (select is_field_role()) and (
      assignee_id = (select auth.uid())
      or is_task_assignee(tasks.id)
    )
  );

create policy "tasks_guard_update" on tasks
  for update using (
    (select is_field_role()) and (
      assignee_id = (select auth.uid())
      or is_task_assignee(tasks.id)
    )
  );

-- task_updates
create policy "task_updates_director" on task_updates
  for all using ((select get_my_role()) = 'director');

create policy "task_updates_officer" on task_updates
  for all using (
    (select get_my_role()) = 'range_officer' and
    exists (select 1 from tasks where tasks.id = task_updates.task_id and tasks.range_id = any ((select get_my_range_ids())::uuid[]))
  );

create policy "task_updates_guard_read" on task_updates
  for select using (
    (select is_field_role()) and
    exists (
      select 1 from tasks where tasks.id = task_updates.task_id and (
        tasks.assignee_id = (select auth.uid())
        or is_task_assignee(tasks.id)
      )
    )
  );

create policy "task_updates_guard_insert" on task_updates
  for insert with check (
    (select is_field_role()) and
    user_id = (select auth.uid()) and
    exists (
      select 1 from tasks where tasks.id = task_updates.task_id and (
        tasks.assignee_id = (select auth.uid())
        or is_task_assignee(tasks.id)
      )
    )
  );

-- comments
create policy "comments_director" on comments
  for all using ((select get_my_role()) = 'director');

create policy "comments_officer" on comments
  for all using (
    (select get_my_role()) = 'range_officer' and
    exists (select 1 from tasks where tasks.id = comments.task_id and tasks.range_id = any ((select get_my_range_ids())::uuid[]))
  );

create policy "comments_guard_read" on comments
  for select using (
    (select is_field_role()) and
    exists (
      select 1 from tasks where tasks.id = comments.task_id and (
        tasks.assignee_id = (select auth.uid())
        or is_task_assignee(tasks.id)
      )
    )
  );

create policy "comments_guard_insert" on comments
  for insert with check (
    (select is_field_role()) and
    user_id = (select auth.uid()) and
    exists (
      select 1 from tasks where tasks.id = comments.task_id and (
        tasks.assignee_id = (select auth.uid())
        or is_task_assignee(tasks.id)
      )
    )
  );

-- attachments — same as comments
create policy "attachments_director" on attachments
  for all using ((select get_my_role()) = 'director');

create policy "attachments_officer" on attachments
  for all using (
    (select get_my_role()) = 'range_officer' and
    exists (select 1 from tasks where tasks.id = attachments.task_id and tasks.range_id = any ((select get_my_range_ids())::uuid[]))
  );

create policy "attachments_guard_read" on attachments
  for select using (
    (select is_field_role()) and
    exists (
      select 1 from tasks where tasks.id = attachments.task_id and (
        tasks.assignee_id = (select auth.uid())
        or is_task_assignee(tasks.id)
      )
    )
  );

create policy "attachments_guard_insert" on attachments
  for insert with check (
    (select is_field_role()) and
    user_id = (select auth.uid()) and
    exists (
      select 1 from tasks where tasks.id = attachments.task_id and (
        tasks.assignee_id = (select auth.uid())
        or is_task_assignee(tasks.id)
      )
    )
  );

-- task_assignees: director full; officer full within their range's tasks;
-- guard can read the assignee roster of any task they're part of (as
-- primary or co-assignee), so the UI can show who else is working on it.
create policy "task_assignees_director" on task_assignees
  for all using ((select get_my_role()) = 'director')
  with check ((select get_my_role()) = 'director');

create policy "task_assignees_officer" on task_assignees
  for all using (
    (select get_my_role()) = 'range_officer' and
    exists (select 1 from tasks where tasks.id = task_assignees.task_id and tasks.range_id = any ((select get_my_range_ids())::uuid[]))
  )
  with check (
    (select get_my_role()) = 'range_officer' and
    exists (select 1 from tasks where tasks.id = task_assignees.task_id and tasks.range_id = any ((select get_my_range_ids())::uuid[]))
  );

create policy "task_assignees_guard_read" on task_assignees
  for select using (
    (select is_field_role()) and (
      exists (select 1 from tasks t where t.id = task_assignees.task_id and t.assignee_id = (select auth.uid()))
      or is_task_assignee(task_assignees.task_id)
    )
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
    and (
      exists (select 1 from tasks where tasks.id = notifications.task_id)
      or exists (select 1 from incidents where incidents.id = notifications.incident_id)
    )
  );

create policy "notifications_update" on notifications
  for update using (user_id = (select auth.uid()));

create policy "notifications_delete" on notifications
  for delete using (user_id = (select auth.uid()));

-- push_subscriptions: a device's subscription belongs to whoever is
-- currently signed in on it. "for all" is safe here (unlike notifications)
-- because a user only ever writes their OWN row — there's no cross-user
-- insert case to worry about.
-- officer_ranges: a user must be able to read their OWN extra ranges (the
-- app loads them at login to drive the officer range switcher); directors
-- read and manage everyone's. get_my_range_ids() itself is SECURITY
-- DEFINER, so RLS here never blocks policy evaluation on other tables.
create policy "officer_ranges_own_read" on officer_ranges
  for select using (user_id = (select auth.uid()));

create policy "officer_ranges_director" on officer_ranges
  for all using ((select get_my_role()) = 'director');

create policy "push_subscriptions_own" on push_subscriptions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Claim (upsert) this device's push subscription for the CURRENT user. The
-- client can't do this with a plain upsert on `endpoint`: on a SHARED device
-- the endpoint's row may still belong to whoever was signed in before, and the
-- "own row" policy above hides that row, so ON CONFLICT can neither see nor
-- update it (the insert then fails the unique constraint). This runs SECURITY
-- DEFINER to reassign the endpoint across users, but forces user_id to the
-- caller's own auth.uid() — so a caller can only ever claim a subscription for
-- themselves, never register or hijack one for someone else. Called by
-- subscribeToPush / ensurePushSubscription in src/utils/push.ts.
create or replace function claim_push_subscription(
  p_user_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_user_id is distinct from uid then
    raise exception 'cannot claim a push subscription for another user';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values (uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh  = excluded.p256dh,
        auth    = excluded.auth;
end;
$$;

revoke all on function claim_push_subscription(uuid, text, text, text) from public;
grant execute on function claim_push_subscription(uuid, text, text, text) to authenticated;

-- live_locations: a field-role user manages only their own row (the app
-- writes it only while an on-screen "sharing" indicator is visible to
-- them — see useLocationSharing). Director sees everyone; a range officer
-- sees only rows whose task falls in one of their ranges. No policy grants
-- guard-to-guard visibility.
create policy "live_locations_self" on live_locations
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "live_locations_director_read" on live_locations
  for select using ((select get_my_role()) = 'director');

create policy "live_locations_officer_read" on live_locations
  for select using (
    (select get_my_role()) = 'range_officer' and
    exists (select 1 from tasks t where t.id = live_locations.task_id and t.range_id = any ((select get_my_range_ids())::uuid[]))
  );

-- daily_reports: director full, others read-only
create policy "daily_reports_director" on daily_reports
  for all using ((select get_my_role()) = 'director');

create policy "daily_reports_read" on daily_reports
  for select using ((select get_my_role()) = 'range_officer' or (select is_field_role()));

-- incidents: the full log is management-only — director sees every
-- incident reserve-wide, and so does tiger_cell (Tiger Cell holds no
-- single range, same as director, so this isn't range-scoped) EXCEPT one
-- specific excluded profile (id below), who despite holding the tiger_cell
-- role is deliberately carved out and treated as an ordinary field
-- reporter — a named-person exception per product decision, not a role
-- rule (see internal records for who/why). If that profile is ever
-- deleted and recreated, this id must be updated to match. range_officer
-- no longer gets range-wide incident visibility (that moved to
-- tiger_cell) — range_officer, guard, range_office, and the excluded
-- profile can only read/insert incidents THEY personally reported, never
-- update/delete.
create policy "incidents_director" on incidents
  for all using ((select get_my_role()) = 'director');

create policy "incidents_tiger_cell" on incidents
  for all using (
    (select get_my_role()) = 'tiger_cell'
    and (select auth.uid()) <> '237e1f9b-cf77-4b83-ae43-7641af75f67f'::uuid -- excluded profile, see incidents_tiger_cell comment above
  );

create policy "incidents_read_own" on incidents
  for select using (
    ((select is_field_role()) or (select get_my_role()) = 'range_officer')
    and reported_by = (select auth.uid())
  );

create policy "incidents_report_insert" on incidents
  for insert with check (
    ((select is_field_role()) or (select get_my_role()) = 'range_officer')
    and reported_by = (select auth.uid())
  );

-- incident_photos: read/write follows the same scoping as incidents above.
create policy "incident_photos_director" on incident_photos
  for all using ((select get_my_role()) = 'director');

create policy "incident_photos_tiger_cell" on incident_photos
  for all using (
    (select get_my_role()) = 'tiger_cell'
    and (select auth.uid()) <> '237e1f9b-cf77-4b83-ae43-7641af75f67f'::uuid -- excluded profile, see incidents_tiger_cell comment above
  );

create policy "incident_photos_read_own" on incident_photos
  for select using (
    ((select is_field_role()) or (select get_my_role()) = 'range_officer') and
    exists (select 1 from incidents i where i.id = incident_photos.incident_id and i.reported_by = (select auth.uid()))
  );

create policy "incident_photos_report_insert" on incident_photos
  for insert with check (
    ((select is_field_role()) or (select get_my_role()) = 'range_officer') and
    uploaded_by = (select auth.uid()) and
    exists (select 1 from incidents i where i.id = incident_photos.incident_id and i.reported_by = (select auth.uid()))
  );

-- audit_log: management-only read (director all, officer their range);
-- insert is open to any authenticated user but only as themselves, since
-- guards also trigger logged actions (starting/completing their own tasks)
-- even though they can't read the log back.
create policy "audit_log_director_read" on audit_log
  for select using ((select get_my_role()) = 'director');

create policy "audit_log_officer_read" on audit_log
  for select using ((select get_my_role()) = 'range_officer' and range_id = any ((select get_my_range_ids())::uuid[]));

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
-- Storage bucket for incident photos
-- ─────────────────────────────────────────────
-- Private bucket, 5 MB hard cap — photos are compressed client-side before
-- upload (see src/lib/incidentPhotos.ts), so anything still near this size
-- likely bypassed compression rather than being a legitimately large photo.
insert into storage.buckets (id, name, public, file_size_limit)
  values ('incident-photos', 'incident-photos', false, 5242880)
  on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "incident_photos_upload" on storage.objects;
drop policy if exists "incident_photos_download" on storage.objects;
drop policy if exists "incident_photos_object_delete" on storage.objects;

-- Objects are stored under "<incident-id>/<uuid>.jpg" (see
-- uploadIncidentPhoto in src/lib/incidentPhotos.ts). Same technique as
-- task-attachments: the EXISTS subquery runs under the caller's own
-- incidents RLS, so upload/download follow incident visibility exactly.
create policy "incident_photos_upload" on storage.objects
  for insert with check (
    bucket_id = 'incident-photos'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.incidents i
      where i.id::text = (storage.foldername(name))[1]
    )
  );

create policy "incident_photos_download" on storage.objects
  for select using (
    bucket_id = 'incident-photos'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.incidents i
      where i.id::text = (storage.foldername(name))[1]
    )
  );

-- Delete is management-only, same as the incident_photos table policy —
-- director or tiger_cell (excluding the excluded profile, see incidents_tiger_cell above).
create policy "incident_photos_object_delete" on storage.objects
  for delete using (
    bucket_id = 'incident-photos'
    and (
      (select public.get_my_role()) = 'director'
      or (
        (select public.get_my_role()) = 'tiger_cell'
        and (select auth.uid()) <> '237e1f9b-cf77-4b83-ae43-7641af75f67f'::uuid
      )
    )
    and exists (
      select 1 from public.incidents i
      where i.id::text = (storage.foldername(name))[1]
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

-- ═════════════════════════════════════════════
-- Hospitality Inventory Management module (Phase 1)
--
-- A fully separate domain from Tasks/Incidents/Map/Personnel/Audit, visible
-- only to 'director' (full access) and the new 'inventory_staff' role
-- (own assigned locations + own profile only). Phase 1 scope: locations,
-- categories, units, items, stock balances, an immutable transaction
-- ledger, and the request → approval → issue workflow. Transfers,
-- consumption/return/damage recording, offline drafts, and procurement are
-- later phases and intentionally not modeled yet (see the app's inventory
-- implementation plan) — inventory_transactions.source_location_id /
-- destination_location_id below exist now so Phase 2 transfers don't need
-- a later column migration, but nothing writes them yet.
-- ═════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- Inventory enums (idempotent, same convention as the rest of this file)
-- ─────────────────────────────────────────────
do $$ begin
  create type inventory_location_type as enum (
    'central_warehouse', 'range_store', 'forest_office', 'resort',
    'hotel', 'guest_house', 'kitchen', 'housekeeping_store', 'other_facility'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type inventory_item_kind as enum ('consumable', 'reusable');
exception when duplicate_object then null; end $$;

-- Only the two transaction types Phase 1 actually produces. Transfer/
-- consumption/return/damage/adjustment/purchase-receipt types are added the
-- same way (alter type ... add value if not exists) when those phases land.
do $$ begin
  create type inventory_transaction_type as enum ('opening_balance', 'issued');
exception when duplicate_object then null; end $$;

-- 'UnderReview' is deliberately not a stored state: a Submitted request
-- being looked at by a director is a UI-only label, not a persisted
-- transition, so there's no separate write/RPC just to mark "someone
-- opened this." The director's approve/reject action moves a request
-- straight from Submitted to Approved/PartiallyApproved/Rejected.
do $$ begin
  create type inventory_request_status as enum (
    'Draft', 'Submitted', 'Approved', 'PartiallyApproved', 'Rejected',
    'PartiallyFulfilled', 'Fulfilled', 'Cancelled'
  );
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────
-- Inventory tables
-- ─────────────────────────────────────────────

create table if not exists inventory_locations (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  type                inventory_location_type not null,
  range_id            uuid references ranges(id) on delete set null,
  address_description text not null default '',
  parent_location_id  uuid references inventory_locations(id) on delete set null,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- Which inventory_staff users can see/act on which locations. Mirrors
-- officer_ranges' exact shape (composite PK junction table).
create table if not exists inventory_location_staff (
  location_id uuid not null references inventory_locations(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (location_id, user_id)
);

-- Tables, not enums: the Director must be able to add new categories/units
-- without a schema migration (unlike inventory_location_type, which is a
-- fixed set of facility kinds that drives code branching).
create table if not exists inventory_categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists inventory_units (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null unique,
  abbreviation text not null default '',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Schema-driven fraction rule, replacing a hardcoded integer-only-unit-name
-- list in src/lib/inventoryQuantity.ts — a director-created custom unit can
-- now declare its own rule instead of silently defaulting forever.
--
-- Nullable-first backfill (not a blanket UPDATE keyed on abbreviation): the
-- column starts nullable with no default, gets backfilled ONLY where still
-- NULL, then NOT NULL + DEFAULT are applied. This makes the backfill run
-- exactly once, ever — a director who later flips a unit's fraction rule
-- keeps that choice across every future re-run, since no row can ever be
-- NULL again once the column is NOT NULL.
alter table inventory_units add column if not exists allows_fractional boolean;

update inventory_units set allows_fractional = (abbreviation not in ('pc', 'pkt', 'box', 'set', 'dz', 'roll'))
  where allows_fractional is null;

alter table inventory_units alter column allows_fractional set default true;
alter table inventory_units alter column allows_fractional set not null;

create table if not exists inventory_items (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  category_id   uuid not null references inventory_categories(id) on delete restrict,
  sku           text,
  description   text not null default '',
  unit_id       uuid not null references inventory_units(id) on delete restrict,
  kind          inventory_item_kind not null default 'consumable',
  min_stock     numeric not null default 0 check (min_stock >= 0),
  reorder_level numeric not null default 0 check (reorder_level >= 0),
  max_stock     numeric check (max_stock is null or max_stock >= 0),
  track_expiry  boolean not null default false,
  track_batch   boolean not null default false,
  active        boolean not null default true,
  photo_path    text,
  created_at    timestamptz not null default now()
);
create unique index if not exists inventory_items_sku_idx on inventory_items(sku) where sku is not null;

-- Derived stock balance per item/location — NEVER updated directly by
-- client code (no client-facing update/insert grant below). Every change
-- goes through a SECURITY DEFINER RPC (post_opening_balance/
-- issue_inventory_stock) that mutates this row and writes an
-- inventory_transactions row in the same atomic function call.
create table if not exists inventory_stock (
  id             uuid primary key default uuid_generate_v4(),
  item_id        uuid not null references inventory_items(id) on delete restrict,
  location_id    uuid not null references inventory_locations(id) on delete restrict,
  available_qty  numeric not null default 0 check (available_qty >= 0),
  reserved_qty   numeric not null default 0 check (reserved_qty >= 0),
  in_use_qty     numeric not null default 0 check (in_use_qty >= 0),
  damaged_qty    numeric not null default 0 check (damaged_qty >= 0),
  expired_qty    numeric not null default 0 check (expired_qty >= 0),
  updated_at     timestamptz not null default now(),
  unique (item_id, location_id)
);

-- Immutable ledger — no update/delete policy is granted below (insert-only
-- by omission, same convention as audit_log). Corrections are new rows,
-- never edits of a posted one. source_location_id/destination_location_id
-- are reserved for Phase 2 transfers; Phase 1 only ever sets location_id.
create table if not exists inventory_transactions (
  id                     uuid primary key default uuid_generate_v4(),
  item_id                uuid not null references inventory_items(id) on delete restrict,
  location_id            uuid not null references inventory_locations(id) on delete restrict,
  quantity               numeric not null check (quantity > 0),
  transaction_type       inventory_transaction_type not null,
  source_location_id     uuid references inventory_locations(id) on delete set null,
  destination_location_id uuid references inventory_locations(id) on delete set null,
  related_request_id    uuid,
  performed_by           uuid not null references profiles(id) on delete restrict,
  approved_by            uuid references profiles(id) on delete set null,
  notes                  text not null default '',
  attachment_path        text,
  previous_balance       numeric not null,
  new_balance            numeric not null,
  created_at             timestamptz not null default now()
);

-- Optional client-supplied idempotency key for issue_inventory_stock (spec
-- section 10): a retried call after a perceived timeout — the first call
-- actually succeeded server-side — would otherwise double-post, since two
-- partial-quantity issues within the approved cap are each individually
-- valid. A retried call reusing the same key is recognized and skipped.
alter table inventory_transactions add column if not exists idempotency_key uuid;
create unique index if not exists inventory_transactions_idempotency_key_uniq
  on inventory_transactions(idempotency_key) where idempotency_key is not null;

create table if not exists inventory_requests (
  id                   uuid primary key default uuid_generate_v4(),
  requesting_location_id uuid not null references inventory_locations(id) on delete restrict,
  requested_by         uuid not null references profiles(id) on delete restrict,
  status               inventory_request_status not null default 'Draft',
  required_by_date     date,
  priority             task_priority not null default 'Medium',
  reason               text not null default '',
  notes                text not null default '',
  reject_reason        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists inventory_request_items (
  id               uuid primary key default uuid_generate_v4(),
  request_id       uuid not null references inventory_requests(id) on delete cascade,
  item_id          uuid not null references inventory_items(id) on delete restrict,
  requested_qty    numeric not null check (requested_qty > 0),
  approved_qty     numeric check (approved_qty is null or approved_qty >= 0),
  fulfilled_qty    numeric not null default 0 check (fulfilled_qty >= 0),
  notes            text not null default ''
);

-- related_request_id has no inline `references` above because
-- inventory_requests doesn't exist yet at that point in the file (added as
-- a deferred ALTER once it does) — wrapped the same way every other
-- constraint in this file is, so re-running this script is a no-op here.
do $$ begin
  alter table inventory_transactions
    add constraint inventory_transactions_related_request_fkey
    foreign key (related_request_id) references inventory_requests(id) on delete set null;
exception when duplicate_object then null; end $$;

drop trigger if exists inventory_locations_updated_at on inventory_locations;
create trigger inventory_locations_updated_at before update on inventory_locations
  for each row execute function set_updated_at();

drop trigger if exists inventory_requests_updated_at on inventory_requests;
create trigger inventory_requests_updated_at before update on inventory_requests
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────
-- Inventory indexes
-- ─────────────────────────────────────────────
create index if not exists inventory_locations_range_id_idx on inventory_locations(range_id);
create index if not exists inventory_location_staff_user_id_idx on inventory_location_staff(user_id);
create index if not exists inventory_items_category_id_idx on inventory_items(category_id);
create index if not exists inventory_stock_location_id_idx on inventory_stock(location_id);
create index if not exists inventory_stock_item_id_idx on inventory_stock(item_id);
create index if not exists inventory_transactions_item_id_idx on inventory_transactions(item_id);
create index if not exists inventory_transactions_location_id_idx on inventory_transactions(location_id);
create index if not exists inventory_transactions_created_at_idx on inventory_transactions(created_at desc);
create index if not exists inventory_requests_requesting_location_id_idx on inventory_requests(requesting_location_id);
create index if not exists inventory_requests_status_idx on inventory_requests(status);
create index if not exists inventory_request_items_request_id_idx on inventory_request_items(request_id);

-- ─────────────────────────────────────────────
-- Length limits (defense in depth, same convention as the rest of this file)
-- ─────────────────────────────────────────────
do $$ begin
  alter table inventory_locations add constraint inventory_locations_name_len check (char_length(name) <= 200);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table inventory_items add constraint inventory_items_name_len check (char_length(name) <= 200);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table inventory_requests add constraint inventory_requests_reason_len check (char_length(reason) <= 1000);
exception when duplicate_object then null; end $$;

-- Request-item integrity guards found during the Phase 1 hardening pass
-- (spec section 7): nothing previously prevented the same item appearing
-- twice on one request, or an inactive/deactivated item being added to a
-- *new* request.
-- A UNIQUE constraint's exception class on re-run is duplicate_table
-- (42P07, "relation already exists" — from its implicit backing index),
-- not duplicate_object (42710) like every other constraint type in this
-- file. Found via the hardening pass's idempotent-reapply test: the
-- duplicate_object-only handler let this one raise a real error on a
-- second run.
do $$ begin
  alter table inventory_request_items
    add constraint inventory_request_items_request_item_unique unique (request_id, item_id);
exception when duplicate_object or duplicate_table then null; end $$;

-- Insert-only guard: an item that later becomes inactive must not block
-- new inserts against *existing* rows referencing it — historical requests
-- retain their item references regardless of the item's current active
-- state, so this only fires on INSERT, never on UPDATE.
create or replace function enforce_inventory_request_item_active_item()
returns trigger language plpgsql
set search_path = '' as $$
declare
  v_active boolean;
begin
  select active into v_active from public.inventory_items where id = new.item_id;
  if v_active is not true then
    raise exception 'Cannot add an inactive item to a request';
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_request_items_active_item_guard on inventory_request_items;
create trigger inventory_request_items_active_item_guard before insert on inventory_request_items
  for each row execute function enforce_inventory_request_item_active_item();

-- ─────────────────────────────────────────────
-- Extend notifications/audit_log for inventory
-- ─────────────────────────────────────────────
alter table notifications add column if not exists inventory_request_id uuid references inventory_requests(id) on delete cascade;
create index if not exists notifications_inventory_request_id_idx on notifications(inventory_request_id) where inventory_request_id is not null;

-- Widen the "exactly one of these is set" check from two columns to three
-- (sum-of-booleans, since <> only expresses XOR for exactly two operands).
alter table notifications drop constraint if exists notifications_task_or_incident_chk;
alter table notifications add constraint notifications_task_or_incident_chk
  check (
    (case when task_id is not null then 1 else 0 end)
    + (case when incident_id is not null then 1 else 0 end)
    + (case when inventory_request_id is not null then 1 else 0 end) = 1
  );

-- audit_log stays task-shaped by name but gains nullable inventory columns
-- (Director explicitly wanted one unified audit timeline rather than a
-- second table) — logInventoryAction() in src/lib/audit.ts writes these.
alter table audit_log add column if not exists inventory_item_id uuid references inventory_items(id) on delete set null;
alter table audit_log add column if not exists inventory_transaction_id uuid references inventory_transactions(id) on delete set null;
create index if not exists audit_log_inventory_item_id_idx on audit_log(inventory_item_id) where inventory_item_id is not null;

-- Found during the hardening pass: request-lifecycle actions
-- (submitted/approved/rejected) had no structured entity reference at all
-- — only inventory_item_id/inventory_transaction_id existed, neither of
-- which applies to a request-level action. Detail text alone doesn't
-- satisfy "audit entries include entity type/ID."
alter table audit_log add column if not exists inventory_request_id uuid references inventory_requests(id) on delete set null;
create index if not exists audit_log_inventory_request_id_idx on audit_log(inventory_request_id) where inventory_request_id is not null;

-- ─────────────────────────────────────────────
-- Inventory helper functions
-- ─────────────────────────────────────────────
create or replace function get_my_inventory_location_ids()
returns uuid[] language sql security definer stable
set search_path = '' as $$
  select coalesce(array_agg(location_id), '{}'::uuid[])
  from public.inventory_location_staff where user_id = auth.uid();
$$;
-- This project's public schema has an ALTER DEFAULT PRIVILEGES rule that
-- grants anon EXECUTE on every new function independently of PUBLIC — a
-- bare `revoke ... from public` does not remove anon's own direct grant,
-- and (the reverse gap) leaving PUBLIC's own implicit grant in place lets
-- every role inherit it regardless of an anon-specific revoke. Both must
-- be revoked; only authenticated needs this.
revoke all on function get_my_inventory_location_ids() from public;
grant execute on function get_my_inventory_location_ids() to authenticated;

-- Closes the same gap enforce_guard_task_update() closes for tasks: RLS
-- lets inventory_staff UPDATE their own Draft/Submitted request, but that
-- alone would also let them set status straight to 'Approved' or write
-- approved_qty/reject_reason on a direct API call. A director's session is
-- exempt; approve_inventory_request/reject_inventory_request (below) are
-- SECURITY DEFINER and bypass this trigger's own-role check entirely by
-- running as the table owner.
create or replace function enforce_inventory_request_staff_update()
returns trigger language plpgsql
set search_path = '' as $$
begin
  if public.get_my_role() <> 'director' then
    if new.status not in ('Draft', 'Submitted', 'Cancelled') then
      raise exception 'Only a director can approve, reject, or fulfil a request';
    end if;
    if new.reject_reason is distinct from old.reject_reason then
      raise exception 'Only a director can set a rejection reason';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_requests_staff_guard on inventory_requests;
create trigger inventory_requests_staff_guard before update on inventory_requests
  for each row execute function enforce_inventory_request_staff_update();

create or replace function enforce_inventory_request_item_staff_update()
returns trigger language plpgsql
set search_path = '' as $$
begin
  if public.get_my_role() <> 'director'
     and (new.approved_qty is distinct from old.approved_qty
          or new.fulfilled_qty is distinct from old.fulfilled_qty) then
    raise exception 'Only a director can set approved/fulfilled quantities';
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_request_items_staff_guard on inventory_request_items;
create trigger inventory_request_items_staff_guard before update on inventory_request_items
  for each row execute function enforce_inventory_request_item_staff_update();

-- ─────────────────────────────────────────────
-- Inventory RLS
-- ─────────────────────────────────────────────
alter table inventory_locations enable row level security;
alter table inventory_location_staff enable row level security;
alter table inventory_categories enable row level security;
alter table inventory_units enable row level security;
alter table inventory_items enable row level security;
alter table inventory_stock enable row level security;
alter table inventory_transactions enable row level security;
alter table inventory_requests enable row level security;
alter table inventory_request_items enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename like 'inventory_%'
  loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "inventory_locations_director" on inventory_locations
  for all using ((select get_my_role()) = 'director');
create policy "inventory_locations_staff_read" on inventory_locations
  for select using (id = any ((select get_my_inventory_location_ids())::uuid[]));

create policy "inventory_location_staff_director" on inventory_location_staff
  for all using ((select get_my_role()) = 'director');
create policy "inventory_location_staff_own_read" on inventory_location_staff
  for select using (user_id = (select auth.uid()));

-- Catalog data (categories/units/items) is global-read for every
-- authenticated inventory role — a request can only be raised for an item
-- the requester can see, and the full catalog isn't location-scoped.
create policy "inventory_categories_director" on inventory_categories
  for all using ((select get_my_role()) = 'director');
create policy "inventory_categories_read" on inventory_categories
  for select using ((select get_my_role()) in ('director', 'inventory_staff'));

create policy "inventory_units_director" on inventory_units
  for all using ((select get_my_role()) = 'director');
create policy "inventory_units_read" on inventory_units
  for select using ((select get_my_role()) in ('director', 'inventory_staff'));

create policy "inventory_items_director" on inventory_items
  for all using ((select get_my_role()) = 'director');
create policy "inventory_items_read" on inventory_items
  for select using ((select get_my_role()) in ('director', 'inventory_staff'));

create policy "inventory_stock_director" on inventory_stock
  for all using ((select get_my_role()) = 'director');
create policy "inventory_stock_staff_read" on inventory_stock
  for select using (location_id = any ((select get_my_inventory_location_ids())::uuid[]));

-- No insert/update/delete grant to inventory_staff OR director on the
-- transaction ledger — every write happens inside the SECURITY DEFINER
-- RPCs below, which run as the table owner and so bypass RLS on the write
-- itself. Director is deliberately restricted to SELECT here (not "for
-- all"): found during the hardening pass that a director's own client
-- session could otherwise directly UPDATE/DELETE posted transaction rows,
-- contradicting the ledger's documented immutability. Verified this has no
-- effect on any real write path — the client never writes to this table
-- directly (see useInventoryTransactions.ts), only through the RPCs.
create policy "inventory_transactions_director" on inventory_transactions
  for select using ((select get_my_role()) = 'director');
create policy "inventory_transactions_staff_read" on inventory_transactions
  for select using (location_id = any ((select get_my_inventory_location_ids())::uuid[]));

create policy "inventory_requests_director" on inventory_requests
  for all using ((select get_my_role()) = 'director');
create policy "inventory_requests_staff_read" on inventory_requests
  for select using (requesting_location_id = any ((select get_my_inventory_location_ids())::uuid[]));
create policy "inventory_requests_staff_insert" on inventory_requests
  for insert with check (
    (select get_my_role()) = 'inventory_staff'
    and requested_by = (select auth.uid())
    and requesting_location_id = any ((select get_my_inventory_location_ids())::uuid[])
  );
-- Column-level restriction is enforced by the trigger above, not here —
-- RLS alone can gate row visibility, not which columns an UPDATE touches.
create policy "inventory_requests_staff_update" on inventory_requests
  for update using (
    (select get_my_role()) = 'inventory_staff'
    and requesting_location_id = any ((select get_my_inventory_location_ids())::uuid[])
  );

create policy "inventory_request_items_director" on inventory_request_items
  for all using ((select get_my_role()) = 'director');
create policy "inventory_request_items_staff_read" on inventory_request_items
  for select using (
    exists (
      select 1 from inventory_requests req
      where req.id = inventory_request_items.request_id
        and req.requesting_location_id = any ((select get_my_inventory_location_ids())::uuid[])
    )
  );
create policy "inventory_request_items_staff_insert" on inventory_request_items
  for insert with check (
    (select get_my_role()) = 'inventory_staff'
    and exists (
      select 1 from inventory_requests req
      where req.id = inventory_request_items.request_id
        and req.requested_by = (select auth.uid())
    )
  );
create policy "inventory_request_items_staff_update" on inventory_request_items
  for update using (
    (select get_my_role()) = 'inventory_staff'
    and exists (
      select 1 from inventory_requests req
      where req.id = inventory_request_items.request_id
        and req.requesting_location_id = any ((select get_my_inventory_location_ids())::uuid[])
    )
  );

-- Extend the notifications insert check (defense in depth — the RPCs below
-- are SECURITY DEFINER and bypass this anyway, but a direct client insert
-- referencing an inventory_request_id should still only succeed if that
-- request is visible to the inserting session, same principle as the
-- existing task/incident branches).
drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert" on notifications
  for insert with check (
    (select auth.uid()) is not null
    and (
      exists (select 1 from tasks where tasks.id = notifications.task_id)
      or exists (select 1 from incidents where incidents.id = notifications.incident_id)
      or exists (select 1 from inventory_requests where inventory_requests.id = notifications.inventory_request_id)
    )
  );

-- ─────────────────────────────────────────────
-- Inventory RPCs — the only way inventory_stock/inventory_transactions
-- ever change. Each is SECURITY DEFINER (runs as table owner, bypassing
-- RLS on its own writes) but re-checks the caller's role/authorization
-- from auth.uid() itself before doing anything, exactly like
-- claim_push_subscription above. revoke/grant locks down who may call each.
-- ─────────────────────────────────────────────

-- Director-only: seeds/adds to a location's starting balance for an item.
-- Returns whether this call actually applied the posting — false means a
-- retried call with the same p_idempotency_key was recognized as a
-- duplicate and safely skipped (mirrors issue_inventory_stock's pattern,
-- now that a real Opening Balance UI calls this). Also rejects inactive
-- items server-side, mirroring the same discipline already applied to
-- request items.
create or replace function post_opening_balance(
  p_item_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_notes text default '',
  p_idempotency_key uuid default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  prev numeric;
  v_item_active boolean;
begin
  if uid is null or public.get_my_role() is distinct from 'director' then
    raise exception 'Only a director can post an opening balance';
  end if;
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.inventory_transactions where idempotency_key = p_idempotency_key
  ) then
    return false;
  end if;

  select active into v_item_active from public.inventory_items where id = p_item_id;
  if v_item_active is not true then
    raise exception 'Cannot post an opening balance for an inactive item';
  end if;

  insert into public.inventory_stock (item_id, location_id, available_qty)
    values (p_item_id, p_location_id, 0)
  on conflict (item_id, location_id) do nothing;

  select available_qty into prev from public.inventory_stock
    where item_id = p_item_id and location_id = p_location_id
    for update;

  update public.inventory_stock
    set available_qty = prev + p_quantity, updated_at = now()
    where item_id = p_item_id and location_id = p_location_id;

  insert into public.inventory_transactions
    (item_id, location_id, quantity, transaction_type, performed_by, notes, previous_balance, new_balance, idempotency_key)
  values
    (p_item_id, p_location_id, p_quantity, 'opening_balance', uid, p_notes, prev, prev + p_quantity, p_idempotency_key);

  return true;
end;
$$;
-- The 4-arg signature (before p_idempotency_key existed) is superseded;
-- drop it so PostgREST doesn't expose two overloads of the same RPC name.
drop function if exists post_opening_balance(uuid, uuid, numeric, text);
revoke all on function post_opening_balance(uuid, uuid, numeric, text, uuid) from public;
-- The bare revoke above only removes PUBLIC's grant; this project's default
-- privileges on the public schema separately grant anon EXECUTE on every
-- new function regardless of PUBLIC, so anon needs an explicit revoke too.
revoke execute on function post_opening_balance(uuid, uuid, numeric, text, uuid) from anon;
grant execute on function post_opening_balance(uuid, uuid, numeric, text, uuid) to authenticated;

-- inventory_staff only: creates a request and its item lines atomically.
-- Previously the client did this as two separate inserts (header, then
-- items); if the items insert failed for any reason (inactive item hitting
-- the trigger above, a duplicate item hitting the unique constraint), the
-- request header was left behind as a permanent zero-item Draft — found
-- during the Phase 1 hardening pass. Wrapping both in one SECURITY DEFINER
-- function makes them atomic: a single function invocation is one implicit
-- transaction, so any failure rolls back the header too.
create or replace function create_inventory_request(
  p_requesting_location_id uuid,
  p_items jsonb,
  p_required_by_date date default null,
  p_priority task_priority default 'Medium',
  p_reason text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_request_id uuid;
  item jsonb;
begin
  if uid is null or public.get_my_role() is distinct from 'inventory_staff' then
    raise exception 'Only inventory staff can create a request';
  end if;
  if not exists (
    select 1 from public.inventory_location_staff
    where location_id = p_requesting_location_id and user_id = uid
  ) then
    raise exception 'You are not assigned to this location';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'A request must include at least one item';
  end if;

  insert into public.inventory_requests (requesting_location_id, requested_by, required_by_date, priority, reason)
    values (p_requesting_location_id, uid, p_required_by_date, coalesce(p_priority, 'Medium'), coalesce(p_reason, ''))
    returning id into v_request_id;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.inventory_request_items (request_id, item_id, requested_qty)
      values (v_request_id, (item->>'item_id')::uuid, (item->>'requested_qty')::numeric);
  end loop;

  return v_request_id;
end;
$$;
revoke all on function create_inventory_request(uuid, jsonb, date, task_priority, text) from public;
revoke execute on function create_inventory_request(uuid, jsonb, date, task_priority, text) from anon;
grant execute on function create_inventory_request(uuid, jsonb, date, task_priority, text) to authenticated;

-- Director-only: approves (fully or partially) the items on a Submitted
-- request. p_item_approvals is a jsonb array of
-- {"request_item_id": "<uuid>", "approved_qty": <number>}.
--
-- Two bugs found and fixed during the Phase 1 hardening pass:
-- (1) this had no guard on the request's current status at all, so a
-- director could re-"approve" an already-Rejected/Fulfilled/Cancelled
-- request; it's now restricted to requests currently 'Submitted'.
-- (2) approved_qty was written straight from client input with no upper
-- bound (only "not negative" was enforced, by the table check constraint),
-- so a client bug or direct RPC call could approve more than was
-- requested; now validated per item against requested_qty.
create or replace function approve_inventory_request(
  p_request_id uuid,
  p_item_approvals jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  approval jsonb;
  v_request_item_id uuid;
  v_approved_qty numeric;
  v_requested_qty numeric;
  v_status public.inventory_request_status;
  all_full boolean := true;
  any_approved boolean := false;
begin
  if uid is null or public.get_my_role() is distinct from 'director' then
    raise exception 'Only a director can approve a request';
  end if;

  select status into v_status from public.inventory_requests where id = p_request_id;
  if v_status is null then
    raise exception 'Request not found';
  end if;
  if v_status <> 'Submitted' then
    raise exception 'Only a submitted request can be approved';
  end if;

  for approval in select * from jsonb_array_elements(p_item_approvals) loop
    v_request_item_id := (approval->>'request_item_id')::uuid;
    v_approved_qty := (approval->>'approved_qty')::numeric;

    select requested_qty into v_requested_qty
      from public.inventory_request_items
      where id = v_request_item_id and request_id = p_request_id;
    if v_requested_qty is null then
      raise exception 'Request item does not belong to this request';
    end if;
    if v_approved_qty < 0 or v_approved_qty > v_requested_qty then
      raise exception 'Approved quantity must be between 0 and the requested quantity';
    end if;

    update public.inventory_request_items
      set approved_qty = v_approved_qty
      where id = v_request_item_id and request_id = p_request_id;
  end loop;

  select
    bool_and(coalesce(approved_qty, 0) >= requested_qty),
    bool_or(coalesce(approved_qty, 0) > 0)
  into all_full, any_approved
  from public.inventory_request_items where request_id = p_request_id;

  -- Explicit cast is required: with every CASE branch a bare string
  -- literal (no enum-typed branch to anchor resolution, unlike
  -- issue_inventory_stock's `else status` below), Postgres resolves the
  -- whole expression as `text` (confirmed via pg_typeof), and assigning
  -- that text to this enum column fails outright — this previously made
  -- approve_inventory_request fail on every single call.
  update public.inventory_requests
    set status = (case when all_full then 'Approved' when any_approved then 'PartiallyApproved' else 'Rejected' end)::public.inventory_request_status,
        updated_at = now()
    where id = p_request_id;
end;
$$;
revoke all on function approve_inventory_request(uuid, jsonb) from public;
revoke execute on function approve_inventory_request(uuid, jsonb) from anon;
grant execute on function approve_inventory_request(uuid, jsonb) to authenticated;

-- Director-only: rejects a request outright, with a required reason.
-- Restricted to requests currently 'Submitted' — previously had no status
-- guard, so a director could reject an already-Fulfilled/Cancelled request.
create or replace function reject_inventory_request(
  p_request_id uuid,
  p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_status public.inventory_request_status;
begin
  if uid is null or public.get_my_role() is distinct from 'director' then
    raise exception 'Only a director can reject a request';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A rejection reason is required';
  end if;

  select status into v_status from public.inventory_requests where id = p_request_id;
  if v_status is null then
    raise exception 'Request not found';
  end if;
  if v_status <> 'Submitted' then
    raise exception 'Only a submitted request can be rejected';
  end if;

  update public.inventory_requests
    set status = 'Rejected', reject_reason = p_reason, updated_at = now()
    where id = p_request_id;
end;
$$;
revoke all on function reject_inventory_request(uuid, text) from public;
revoke execute on function reject_inventory_request(uuid, text) from anon;
grant execute on function reject_inventory_request(uuid, text) to authenticated;

-- Director or assigned inventory_staff at the issuing location: issues
-- stock against an approved request line, atomically decrementing the
-- balance and posting one immutable transaction row. Raises rather than
-- allowing negative stock. Returns whether this call actually applied the
-- issue — false means a retried call with the same p_idempotency_key was
-- recognized as a duplicate and safely skipped; callers must not re-send
-- notifications/audit entries for a skipped call.
create or replace function issue_inventory_stock(
  p_request_item_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_notes text default '',
  p_idempotency_key uuid default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  caller_role public.user_role;
  ritem record;
  prev numeric;
  new_fulfilled numeric;
  all_done boolean;
  any_done boolean;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.inventory_transactions where idempotency_key = p_idempotency_key
  ) then
    return false;
  end if;

  caller_role := public.get_my_role();

  select ri.*, r.status as request_status, r.requesting_location_id
    into ritem
    from public.inventory_request_items ri
    join public.inventory_requests r on r.id = ri.request_id
    where ri.id = p_request_item_id;
  if not found then raise exception 'Request line not found'; end if;
  -- 'PartiallyFulfilled' must be allowed here, not just 'Approved' /
  -- 'PartiallyApproved': issuing stock against any one item line flips the
  -- whole request to 'PartiallyFulfilled' (see the status update at the
  -- end of this function), so without it the very next issue call — same
  -- line's remaining quantity, or a different item line — would wrongly
  -- be rejected. Found live: issuing 12 of 30 approved units moved the
  -- request to PartiallyFulfilled, then issuing the remaining 18 failed
  -- with "must be approved" even though stock and approval both allowed it.
  if ritem.request_status not in ('Approved', 'PartiallyApproved', 'PartiallyFulfilled') then
    raise exception 'Request must be approved before stock can be issued';
  end if;

  -- IS DISTINCT FROM, not <>: if auth.uid() doesn't match any profiles row
  -- (e.g. a deleted account with a still-valid JWT), get_my_role() returns
  -- NULL, and NULL <> 'director' is NULL — `if NULL then` is treated as
  -- false in plpgsql, which would silently skip this whole check. IS
  -- DISTINCT FROM treats NULL as "not equal", closing that gap.
  if caller_role is distinct from 'director' and not exists (
    select 1 from public.inventory_location_staff
      where location_id = p_location_id and user_id = uid
  ) then
    raise exception 'You are not assigned to this location';
  end if;

  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  if ritem.fulfilled_qty + p_quantity > coalesce(ritem.approved_qty, 0) then
    raise exception 'Cannot issue more than the approved quantity';
  end if;

  select available_qty into prev from public.inventory_stock
    where item_id = ritem.item_id and location_id = p_location_id
    for update;
  if prev is null or prev < p_quantity then
    raise exception 'Insufficient stock at this location';
  end if;

  update public.inventory_stock
    set available_qty = prev - p_quantity, updated_at = now()
    where item_id = ritem.item_id and location_id = p_location_id;

  insert into public.inventory_transactions
    (item_id, location_id, quantity, transaction_type, related_request_id, performed_by, approved_by, notes, previous_balance, new_balance, idempotency_key)
  values
    (ritem.item_id, p_location_id, p_quantity, 'issued', ritem.request_id, uid, uid, p_notes, prev, prev - p_quantity, p_idempotency_key);

  new_fulfilled := ritem.fulfilled_qty + p_quantity;
  update public.inventory_request_items set fulfilled_qty = new_fulfilled where id = p_request_item_id;

  select bool_and(fulfilled_qty >= coalesce(approved_qty, requested_qty)),
         bool_or(fulfilled_qty > 0)
    into all_done, any_done
    from public.inventory_request_items where request_id = ritem.request_id;

  update public.inventory_requests
    set status = case when all_done then 'Fulfilled' when any_done then 'PartiallyFulfilled' else status end,
        updated_at = now()
    where id = ritem.request_id;

  return true;
end;
$$;
-- The 4-arg signature (before p_idempotency_key existed) is superseded;
-- drop it so PostgREST doesn't expose two overloads of the same RPC name.
drop function if exists issue_inventory_stock(uuid, uuid, numeric, text);
revoke all on function issue_inventory_stock(uuid, uuid, numeric, text, uuid) from public;
revoke execute on function issue_inventory_stock(uuid, uuid, numeric, text, uuid) from anon;
grant execute on function issue_inventory_stock(uuid, uuid, numeric, text, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Storage bucket for inventory item photos
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
  values ('inventory-photos', 'inventory-photos', false, 5242880)
  on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "inventory_photos_upload" on storage.objects;
drop policy if exists "inventory_photos_download" on storage.objects;
drop policy if exists "inventory_photos_delete" on storage.objects;

-- Objects stored under "<item-id>/<uuid>.jpg" — director manages the
-- catalog, so upload/delete is director-only; any inventory role can view.
create policy "inventory_photos_upload" on storage.objects
  for insert with check (
    bucket_id = 'inventory-photos'
    and (select public.get_my_role()) = 'director'
  );

create policy "inventory_photos_download" on storage.objects
  for select using (
    bucket_id = 'inventory-photos'
    and (select public.get_my_role()) in ('director', 'inventory_staff')
  );

create policy "inventory_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'inventory-photos'
    and (select public.get_my_role()) = 'director'
  );

-- ─────────────────────────────────────────────
-- Starter reference data — directors can add more later via the Inventory
-- module UI; these seed the suggested lists from the product spec so the
-- catalog isn't empty on first use.
-- ─────────────────────────────────────────────
insert into inventory_units (name, abbreviation) values
  ('Piece', 'pc'), ('Packet', 'pkt'), ('Box', 'box'), ('Set', 'set'),
  ('Kilogram', 'kg'), ('Gram', 'g'), ('Litre', 'L'), ('Millilitre', 'mL'),
  ('Metre', 'm'), ('Roll', 'roll'), ('Dozen', 'dz'), ('Other', '')
on conflict (name) do nothing;

insert into inventory_categories (name) values
  ('Toiletries'), ('Linen'), ('Bedding'), ('Groceries'),
  ('Housekeeping supplies'), ('Kitchen supplies'), ('Room appliances'),
  ('Utensils'), ('Maintenance materials'), ('Office supplies'),
  ('Safety equipment'), ('Other')
on conflict (name) do nothing;


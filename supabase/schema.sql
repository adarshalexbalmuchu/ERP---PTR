-- PTR Tiger Cell Task Management System — Database Schema
-- Run this in the Supabase SQL Editor

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

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
  created_at          timestamptz not null default now()
);

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

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
create index if not exists tasks_assignee_id_idx    on tasks(assignee_id);
create index if not exists tasks_range_id_idx       on tasks(range_id);
create index if not exists tasks_status_idx         on tasks(status);
create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_read_idx   on notifications(read) where not read;
create index if not exists task_updates_task_id_idx on task_updates(task_id);
create index if not exists comments_task_id_idx     on comments(task_id);

-- ─────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
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
returns user_role language sql security definer stable as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function get_my_range_id()
returns uuid language sql security definer stable as $$
  select range_id from profiles where id = auth.uid();
$$;

-- ─────────────────────────────────────────────
-- Row Level Security
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

-- Drop all policies before recreating (idempotent)
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- ranges & areas: everyone authenticated can read
create policy "ranges_read" on ranges for select using (auth.uid() is not null);
create policy "ranges_write" on ranges for all using (get_my_role() = 'director');

create policy "areas_read" on areas for select using (auth.uid() is not null);
create policy "areas_write" on areas for all using (get_my_role() = 'director');

-- profiles
create policy "profiles_read" on profiles for select using (auth.uid() is not null);
create policy "profiles_self_update" on profiles for update using (id = auth.uid());
create policy "profiles_director" on profiles for all using (get_my_role() = 'director');

-- tasks
create policy "tasks_director" on tasks
  for all using (get_my_role() = 'director');

create policy "tasks_officer_read" on tasks
  for select using (
    get_my_role() = 'range_officer' and range_id = get_my_range_id()
  );

create policy "tasks_officer_write" on tasks
  for all using (
    get_my_role() = 'range_officer' and range_id = get_my_range_id()
  );

create policy "tasks_guard_read" on tasks
  for select using (
    get_my_role() = 'guard' and assignee_id = auth.uid()
  );

create policy "tasks_guard_update" on tasks
  for update using (
    get_my_role() = 'guard' and assignee_id = auth.uid()
  );

-- task_updates
create policy "task_updates_director" on task_updates
  for all using (get_my_role() = 'director');

create policy "task_updates_officer" on task_updates
  for all using (
    get_my_role() = 'range_officer' and
    exists (select 1 from tasks where tasks.id = task_updates.task_id and tasks.range_id = get_my_range_id())
  );

create policy "task_updates_guard_read" on task_updates
  for select using (
    get_my_role() = 'guard' and
    exists (select 1 from tasks where tasks.id = task_updates.task_id and tasks.assignee_id = auth.uid())
  );

create policy "task_updates_guard_insert" on task_updates
  for insert with check (
    get_my_role() = 'guard' and
    user_id = auth.uid() and
    exists (select 1 from tasks where tasks.id = task_updates.task_id and tasks.assignee_id = auth.uid())
  );

-- comments
create policy "comments_director" on comments
  for all using (get_my_role() = 'director');

create policy "comments_officer" on comments
  for all using (
    get_my_role() = 'range_officer' and
    exists (select 1 from tasks where tasks.id = comments.task_id and tasks.range_id = get_my_range_id())
  );

create policy "comments_guard_read" on comments
  for select using (
    get_my_role() = 'guard' and
    exists (select 1 from tasks where tasks.id = comments.task_id and tasks.assignee_id = auth.uid())
  );

create policy "comments_guard_insert" on comments
  for insert with check (
    get_my_role() = 'guard' and
    user_id = auth.uid() and
    exists (select 1 from tasks where tasks.id = comments.task_id and tasks.assignee_id = auth.uid())
  );

-- attachments — same as comments
create policy "attachments_director" on attachments
  for all using (get_my_role() = 'director');

create policy "attachments_officer" on attachments
  for all using (
    get_my_role() = 'range_officer' and
    exists (select 1 from tasks where tasks.id = attachments.task_id and tasks.range_id = get_my_range_id())
  );

create policy "attachments_guard_read" on attachments
  for select using (
    get_my_role() = 'guard' and
    exists (select 1 from tasks where tasks.id = attachments.task_id and tasks.assignee_id = auth.uid())
  );

create policy "attachments_guard_insert" on attachments
  for insert with check (
    get_my_role() = 'guard' and
    user_id = auth.uid() and
    exists (select 1 from tasks where tasks.id = attachments.task_id and tasks.assignee_id = auth.uid())
  );

-- notifications: users see only their own
create policy "notifications_own" on notifications
  for all using (user_id = auth.uid());

-- daily_reports: director full, others read-only
create policy "daily_reports_director" on daily_reports
  for all using (get_my_role() = 'director');

create policy "daily_reports_read" on daily_reports
  for select using (get_my_role() = 'range_officer' or get_my_role() = 'guard');

-- ─────────────────────────────────────────────
-- Storage bucket for attachments
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('task-attachments', 'task-attachments', false)
  on conflict do nothing;

create policy "attachments_upload" on storage.objects
  for insert with check (bucket_id = 'task-attachments' and auth.uid() is not null);

create policy "attachments_download" on storage.objects
  for select using (bucket_id = 'task-attachments' and auth.uid() is not null);

create policy "attachments_delete" on storage.objects
  for delete using (bucket_id = 'task-attachments' and auth.uid() is not null);

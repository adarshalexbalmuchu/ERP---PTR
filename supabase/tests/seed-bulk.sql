-- Bulk seed to simulate a few years of production usage: ~40 field staff
-- across 6 ranges, ~50,000 tasks, ~120,000 task_updates/notifications —
-- roughly what PTR would accumulate after several years of real operation.
insert into ranges (id, name)
select gen_random_uuid(), 'Range ' || i
from generate_series(3, 6) i;

insert into areas (id, range_id, name)
select gen_random_uuid(), r.id, 'Area ' || gs
from ranges r, generate_series(1, 3) gs;

-- 40 more guards + 6 more officers, spread across all ranges
insert into auth.users (id, email)
select gen_random_uuid(), 'bulkuser' || i || '@ptr.gov.in'
from generate_series(1, 46) i;

insert into profiles (id, name, role, email, avatar_initials, designation, range_id)
select
  u.id,
  'Bulk User ' || rn,
  (case when rn <= 6 then 'range_officer' else 'guard' end)::user_role,
  u.email,
  'BU',
  case when rn <= 6 then 'Range Officer' else 'Forest Guard' end,
  (select id from ranges order by id offset (rn % (select count(*) from ranges)) limit 1)
from (select id, email, row_number() over () as rn from auth.users where email like 'bulkuser%') u;

-- 50,000 tasks spread over the last 3 years, assigned to guards, various
-- statuses. The picker subqueries MUST reference `i` (md5(i || id)) —
-- an uncorrelated `order by random() limit 1` is hoisted into an InitPlan
-- and evaluated ONCE for the whole insert, silently dumping all 50k tasks
-- into a single range on a single guard, which invalidates every officer/
-- guard-scoped benchmark run against this seed.
insert into tasks (id, title, assignee_id, created_by_id, range_id, status, priority, due_date, completion_percentage, created_at)
select
  gen_random_uuid(),
  'Bulk task ' || i,
  (select id from profiles where role = 'guard' order by md5(i::text || id::text) limit 1),
  (select id from profiles where role in ('range_officer','director') order by md5(i::text || id::text) limit 1),
  (select id from ranges order by md5(i::text || id::text) limit 1),
  (array['NotStarted','InProgress','Completed','Archived']::task_status[])[1 + floor(random()*4)],
  (array['Critical','High','Medium','Low']::task_priority[])[1 + floor(random()*4)],
  current_date - (random()*1095)::int + (random()*30)::int,
  (random()*100)::int,
  now() - make_interval(days => (random()*1095)::int)
from generate_series(1, 50000) i;

-- ~120k task_updates (field diary entries)
insert into task_updates (id, task_id, user_id, note, progress_percentage, created_at)
select
  gen_random_uuid(),
  t.id,
  t.assignee_id,
  'Progress update',
  (random()*100)::int,
  t.created_at + make_interval(days => (random()*10)::int)
from tasks t, generate_series(1, 2) gs
where random() < 0.6;

-- ~80k notifications (assignment/status-change events)
insert into notifications (id, user_id, type, title, message, task_id, read, created_at)
select
  gen_random_uuid(),
  t.assignee_id,
  'task_assigned',
  'Task assigned',
  t.title,
  t.id,
  random() < 0.7,
  t.created_at
from tasks t
where random() < 0.8;

analyze;

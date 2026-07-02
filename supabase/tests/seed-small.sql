-- Small, hand-crafted seed for RLS correctness testing (readable IDs, valid hex UUIDs).
insert into ranges (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Betla Range'),
  ('10000000-0000-0000-0000-000000000002', 'Kechki Range');

insert into areas (id, range_id, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Betla Core');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'director@ptr.gov.in'),
  ('a0000000-0000-0000-0000-000000000002', 'officer1@ptr.gov.in'),
  ('a0000000-0000-0000-0000-000000000003', 'officer2@ptr.gov.in'),
  ('a0000000-0000-0000-0000-000000000004', 'guard1@ptr.gov.in'),
  ('a0000000-0000-0000-0000-000000000005', 'guard2@ptr.gov.in');

insert into profiles (id, name, role, email, avatar_initials, designation, range_id) values
  ('a0000000-0000-0000-0000-000000000001', 'Director', 'director', 'director@ptr.gov.in', 'D', 'Field Director', null),
  ('a0000000-0000-0000-0000-000000000002', 'Officer Betla', 'range_officer', 'officer1@ptr.gov.in', 'OB', 'Range Officer', '10000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'Officer Kechki', 'range_officer', 'officer2@ptr.gov.in', 'OK', 'Range Officer', '10000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000004', 'Guard Betla', 'guard', 'guard1@ptr.gov.in', 'GB', 'Forest Guard', '10000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000005', 'Guard Kechki', 'guard', 'guard2@ptr.gov.in', 'GK', 'Forest Guard', '10000000-0000-0000-0000-000000000002');

insert into tasks (id, title, assignee_id, created_by_id, range_id, area_id, status, priority, due_date) values
  ('b0000000-0000-0000-0000-000000000001', 'Betla task (guard1)', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'InProgress', 'High', current_date + 3),
  ('b0000000-0000-0000-0000-000000000002', 'Kechki task (guard2)', 'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', null, 'NotStarted', 'Medium', current_date + 5);

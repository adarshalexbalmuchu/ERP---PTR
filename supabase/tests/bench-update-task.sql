\set pct random(0, 100)
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL app.uid = 'a0000000-0000-0000-0000-000000000004';
UPDATE tasks SET completion_percentage = :pct WHERE id = 'b0000000-0000-0000-0000-000000000001';
COMMIT;

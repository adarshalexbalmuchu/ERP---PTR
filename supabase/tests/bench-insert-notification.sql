BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL app.uid = 'a0000000-0000-0000-0000-000000000002';
INSERT INTO notifications (user_id, type, title, message, task_id)
VALUES ('a0000000-0000-0000-0000-000000000004', 'task_assigned', 'x', 'y', 'b0000000-0000-0000-0000-000000000001');
COMMIT;

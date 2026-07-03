import pg from 'pg';
const { Client } = pg;

const CONN = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/ptr_test';

const U = {
  director: 'a0000000-0000-0000-0000-000000000001',
  officerBetla: 'a0000000-0000-0000-0000-000000000002',
  officerKechki: 'a0000000-0000-0000-0000-000000000003',
  guardBetla: 'a0000000-0000-0000-0000-000000000004',
  guardKechki: 'a0000000-0000-0000-0000-000000000005',
};
const T = {
  betla: 'b0000000-0000-0000-0000-000000000001',
  kechki: 'b0000000-0000-0000-0000-000000000002',
};
const R = {
  betla: '10000000-0000-0000-0000-000000000001',
  kechki: '10000000-0000-0000-0000-000000000002',
};

let pass = 0, fail = 0;
const results = [];

async function asUser(uid, fn) {
  const client = new Client(CONN);
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE authenticated`);
    await client.query(`SET LOCAL app.uid = '${uid}'`);
    const ret = await fn(client);
    await client.query('ROLLBACK');
    return ret;
  } finally {
    await client.end();
  }
}

async function asAnon(fn) {
  const client = new Client(CONN);
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE anon`);
    const ret = await fn(client);
    await client.query('ROLLBACK');
    return ret;
  } finally {
    await client.end();
  }
}

function check(name, condition, detail = '') {
  if (condition) {
    pass++;
    results.push(`  PASS  ${name}`);
  } else {
    fail++;
    results.push(`  FAIL  ${name}${detail ? '  -- ' + detail : ''}`);
  }
}

async function expectError(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
}

async function run() {
  // 1. Director sees all tasks
  await asUser(U.director, async (c) => {
    const { rows } = await c.query('select id from tasks where id = any($1)', [[T.betla, T.kechki]]);
    check('director sees both seed tasks (of possibly more, if bulk-seeded)', rows.length === 2, `got ${rows.length}`);
  });

  // 2. Officer scoped to own range only
  await asUser(U.officerBetla, async (c) => {
    const { rows } = await c.query('select id from tasks order by id');
    const ids = rows.map((r) => r.id);
    check('officer(Betla) sees Betla task, not Kechki task', ids.includes(T.betla) && !ids.includes(T.kechki), JSON.stringify(rows.length));
  });
  await asUser(U.officerKechki, async (c) => {
    const { rows } = await c.query('select id from tasks order by id');
    const ids = rows.map((r) => r.id);
    check('officer(Kechki) sees Kechki task, not Betla task', ids.includes(T.kechki) && !ids.includes(T.betla), JSON.stringify(rows.length));
  });

  // 3. Guard scoped to own assigned tasks only
  await asUser(U.guardBetla, async (c) => {
    const { rows } = await c.query('select id, assignee_id from tasks');
    const ids = rows.map((r) => r.id);
    const allOwn = rows.every((r) => r.assignee_id === U.guardBetla);
    check('guard(Betla) sees own task and nothing not-own', ids.includes(T.betla) && allOwn, JSON.stringify(rows.length));
  });

  // 4. Guard cannot read another guard's task by ID directly
  await asUser(U.guardBetla, async (c) => {
    const { rows } = await c.query('select id from tasks where id = $1', [T.kechki]);
    check('guard(Betla) cannot read Kechki task by id', rows.length === 0, JSON.stringify(rows));
  });

  // 5. Officer cannot write a task into another officer's range (RLS write policy)
  await asUser(U.officerBetla, async (c) => {
    const err = await expectError(() =>
      c.query(
        `insert into tasks (title, assignee_id, created_by_id, range_id, status, priority, due_date)
         values ('cross-range attempt', $1, $2, $3, 'NotStarted', 'Low', current_date + 1)`,
        [U.guardKechki, U.officerBetla, R.kechki],
      ),
    );
    check('officer(Betla) blocked from inserting task into Kechki range', err !== null, err ?? 'no error raised');
  });

  // 6. Guard cannot escalate their own role to director
  await asUser(U.guardBetla, async (c) => {
    const err = await expectError(() =>
      c.query(`update profiles set role = 'director' where id = $1`, [U.guardBetla]),
    );
    check('guard cannot self-promote to director', err !== null, err ?? 'no error raised');
  });

  // 7. Guard cannot directly archive their own task (must go through officer/director)
  await asUser(U.guardBetla, async (c) => {
    const err = await expectError(() =>
      c.query(`update tasks set status = 'Archived' where id = $1`, [T.betla]),
    );
    check('guard cannot archive own task directly', err !== null, err ?? 'no error raised');
  });

  // 8. Guard CAN update their own task's status/progress (the allowed path)
  await asUser(U.guardBetla, async (c) => {
    const err = await expectError(() =>
      c.query(`update tasks set status = 'InProgress', completion_percentage = 50 where id = $1`, [T.betla]),
    );
    check('guard CAN update status/progress on own task', err === null, err ?? '');
  });

  // 9. Guard cannot reassign their own task to someone else
  await asUser(U.guardBetla, async (c) => {
    const err = await expectError(() =>
      c.query(`update tasks set assignee_id = $1 where id = $2`, [U.guardKechki, T.betla]),
    );
    check('guard cannot reassign own task', err !== null, err ?? 'no error raised');
  });

  // 10. Any authenticated user can insert a notification for someone else (task-assignment case)
  await asUser(U.officerBetla, async (c) => {
    const err = await expectError(() =>
      c.query(
        `insert into notifications (user_id, type, title, message, task_id) values ($1, 'task_assigned', 'x', 'y', $2)`,
        [U.guardBetla, T.betla],
      ),
    );
    check('officer can insert a notification for a guard', err === null, err ?? '');
  });

  // 11. A user cannot read another user's notifications
  await asUser(U.officerBetla, async (c) => {
    await c.query(
      `insert into notifications (user_id, type, title, message, task_id) values ($1, 'task_assigned', 'x', 'y', $2)`,
      [U.guardBetla, T.betla],
    );
    const { rows } = await c.query(`select id from notifications where user_id = $1`, [U.guardBetla]);
    check("officer cannot read guard's own notifications", rows.length === 0, JSON.stringify(rows));
  });

  // 12. A user cannot insert a notification about a task they can't see —
  // without this check, any signed-in user could push arbitrary text to any
  // other user's devices by picking a random task_id.
  await asUser(U.guardBetla, async (c) => {
    const err = await expectError(() =>
      c.query(
        `insert into notifications (user_id, type, title, message, task_id) values ($1, 'task_assigned', 'x', 'y', $2)`,
        [U.officerKechki, T.kechki],
      ),
    );
    check('guard cannot notify about a task outside their visibility', err !== null, err ?? 'no error raised');
  });

  // 13. …but a guard CAN still notify about their own task (the
  // task-completed flow: guard writes a notification for their officer).
  await asUser(U.guardBetla, async (c) => {
    const err = await expectError(() =>
      c.query(
        `insert into notifications (user_id, type, title, message, task_id) values ($1, 'task_completed', 'x', 'y', $2)`,
        [U.officerBetla, T.betla],
      ),
    );
    check('guard can notify about their own task', err === null, err ?? '');
  });

  // 14–17. Storage objects follow task visibility. Objects live under
  // "<task-id>/<file>"; seed one per range as superuser (bypasses RLS).
  {
    const client = new Client(CONN);
    await client.connect();
    await client.query(`delete from storage.objects where bucket_id = 'task-attachments'`);
    await client.query(
      `insert into storage.objects (bucket_id, name) values
         ('task-attachments', $1 || '/seed-betla.pdf'),
         ('task-attachments', $2 || '/seed-kechki.pdf')`,
      [T.betla, T.kechki],
    );
    await client.end();
  }

  await asUser(U.guardBetla, async (c) => {
    const { rows } = await c.query(`select name from storage.objects where bucket_id = 'task-attachments'`);
    check(
      'guard sees only storage objects for their own tasks',
      rows.length === 1 && rows[0].name.startsWith(T.betla),
      JSON.stringify(rows),
    );
  });

  await asUser(U.guardBetla, async (c) => {
    const err = await expectError(() =>
      c.query(
        `insert into storage.objects (bucket_id, name) values ('task-attachments', $1 || '/evil.pdf')`,
        [T.kechki],
      ),
    );
    check("guard cannot upload into another task's folder", err !== null, err ?? 'no error raised');
  });

  await asUser(U.guardBetla, async (c) => {
    const res = await c.query(`delete from storage.objects where bucket_id = 'task-attachments'`);
    check('guard cannot delete any storage object (management only)', res.rowCount === 0, `deleted ${res.rowCount}`);
  });

  await asUser(U.officerBetla, async (c) => {
    const res = await c.query(`delete from storage.objects where bucket_id = 'task-attachments'`);
    check('officer deletes only their own range\'s storage objects', res.rowCount === 1, `deleted ${res.rowCount}`);
  });

  // 18. Anonymous (unauthenticated) role cannot read tasks at all — RLS silently
  // filters to zero rows rather than throwing, since SELECT policies just gate
  // row visibility (no matching policy = no rows, no error).
  await asAnon(async (c) => {
    const { rows } = await c.query('select id from tasks');
    check('anon reads zero tasks', rows.length === 0, `got ${rows.length} rows — tasks may be PUBLICLY READABLE`);
  });

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Test harness error:', e);
  process.exit(1);
});

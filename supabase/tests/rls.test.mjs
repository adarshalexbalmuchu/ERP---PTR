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
const G = {
  betlaPatrol: 'c0000000-0000-0000-0000-000000000001',
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

  // ── Task Groups (Phase 1) ──────────────────────────────────────────
  // Seed: G.betlaPatrol is a Betla-range group created by officerBetla,
  // with guardBetla as its only active member. guardKechki and
  // officerKechki have no relationship to it at all.

  // 19. Director sees the group regardless of range.
  await asUser(U.director, async (c) => {
    const { rows } = await c.query('select id from task_groups where id = $1', [G.betlaPatrol]);
    check('director sees the Betla group', rows.length === 1);
  });

  // 20. Officer in the group's own range manages it; the other range's
  // officer can't see it at all (not just "can't write" — zero rows).
  await asUser(U.officerBetla, async (c) => {
    const { rows } = await c.query('select id from task_groups where id = $1', [G.betlaPatrol]);
    check('officer(Betla) sees their own range\'s group', rows.length === 1);
  });
  await asUser(U.officerKechki, async (c) => {
    const { rows } = await c.query('select id from task_groups where id = $1', [G.betlaPatrol]);
    check('officer(Kechki) cannot see Betla\'s group', rows.length === 0);
  });

  // 21. The member guard can read the group and its own membership row;
  // a non-member guard sees neither.
  await asUser(U.guardBetla, async (c) => {
    const g = await c.query('select id from task_groups where id = $1', [G.betlaPatrol]);
    const m = await c.query('select id from task_group_members where group_id = $1', [G.betlaPatrol]);
    check('member guard(Betla) sees the group and its roster', g.rows.length === 1 && m.rows.length === 1);
  });
  await asUser(U.guardKechki, async (c) => {
    const g = await c.query('select id from task_groups where id = $1', [G.betlaPatrol]);
    check('non-member guard(Kechki) cannot see the Betla group', g.rows.length === 0);
  });

  // 22. A guard (ordinary member, not director/officer) cannot manage
  // membership — RLS grants guards SELECT only on task_group_members.
  await asUser(U.guardBetla, async (c) => {
    const err = await expectError(() =>
      c.query(
        `insert into task_group_members (group_id, user_id, added_by) values ($1, $2, $3)`,
        [G.betlaPatrol, U.guardKechki, U.guardBetla],
      ),
    );
    check('member guard cannot add a new member to their own group', err !== null, err ?? 'no error raised');
  });

  // 23. Officer of a DIFFERENT range cannot add a member to this group
  // (their can_officer_manage_group() check fails — range mismatch).
  await asUser(U.officerKechki, async (c) => {
    const err = await expectError(() =>
      c.query(
        `insert into task_group_members (group_id, user_id, added_by) values ($1, $2, $3)`,
        [G.betlaPatrol, U.guardKechki, U.officerKechki],
      ),
    );
    check('officer(Kechki) cannot add a member to Betla\'s group', err !== null, err ?? 'no error raised');
  });

  // 23b. officerBetla legitimately manages the Betla group (group-range
  // check passes) but tries to add guardKechki, who is posted in a
  // DIFFERENT range — must still be rejected (member-range check).
  await asUser(U.officerBetla, async (c) => {
    const err = await expectError(() =>
      c.query(
        `insert into task_group_members (group_id, user_id, added_by) values ($1, $2, $3)`,
        [G.betlaPatrol, U.guardKechki, U.officerBetla],
      ),
    );
    check('officer(Betla) cannot add an out-of-range member (guardKechki) to their own group', err !== null, err ?? 'no error raised');
  });

  // 24. Duplicate ACTIVE membership is rejected at the database level
  // (task_group_members_active_uq), independent of any application check —
  // guardBetla is already an active member from the seed.
  await asUser(U.officerBetla, async (c) => {
    const err = await expectError(() =>
      c.query(
        `insert into task_group_members (group_id, user_id, added_by) values ($1, $2, $3)`,
        [G.betlaPatrol, U.guardBetla, U.officerBetla],
      ),
    );
    check('duplicate active membership is rejected', err !== null, err ?? 'no error raised');
  });

  // 25. Wrong-range officer is rejected by create_group_occurrence's own
  // authorization check (independent of, and in addition to, RLS).
  await asUser(U.officerKechki, async (c) => {
    const err = await expectError(() =>
      c.query(
        `select create_group_occurrence($1, 'Cross-range attempt', '', 'Patrol', 'Medium', now() + interval '1 day', $2)`,
        [G.betlaPatrol, R.kechki],
      ),
    );
    check('officer(Kechki) cannot create an assignment for Betla\'s group', err !== null, err ?? 'no error raised');
  });

  // 26–31. Everything from here on shares state (the occurrence
  // create_group_occurrence produces) across several different acting
  // users, which asUser()'s per-call BEGIN/ROLLBACK can't do — each call
  // is its own transaction, so anything written in one is gone by the
  // next. Run the whole sequence as manual role-switches inside ONE
  // transaction instead, rolling back only at the very end.
  {
    const client = new Client(CONN);
    await client.connect();
    const setUser = (uid) => client.query(`SET LOCAL ROLE authenticated; SET LOCAL app.uid = '${uid}'`);
    // A failed statement aborts the rest of the transaction until rolled
    // back — expectError() (used elsewhere, each in its own throwaway
    // transaction) doesn't need this, but this block reuses one
    // transaction across many statements, so an intentionally-failing
    // insert must roll back to a savepoint, not the whole transaction.
    let spCounter = 0;
    const expectErrorSp = async (fn) => {
      const sp = `sp_${spCounter++}`;
      await client.query(`SAVEPOINT ${sp}`);
      try {
        await fn();
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        return null;
      } catch (e) {
        await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        return e.message;
      }
    };
    try {
      await client.query('BEGIN');

      await setUser(U.director);
      const created = await client.query(
        `select create_group_occurrence($1, 'Weekly fire-line inspection', 'Check the whole line', 'Patrol', 'High', now() + interval '2 days', $2) as id`,
        [G.betlaPatrol, R.betla],
      );
      const occId = created.rows[0]?.id ?? null;
      check('director creates a one-time group occurrence', occId !== null);

      const tasksForOcc = await client.query('select id, assignee_id from tasks where occurrence_id = $1', [occId]);
      check(
        'occurrence fans out exactly one task, for the one active member',
        tasksForOcc.rows.length === 1 && tasksForOcc.rows[0].assignee_id === U.guardBetla,
        JSON.stringify(tasksForOcc.rows),
      );
      const fannedOutTaskId = tasksForOcc.rows[0]?.id;

      const conv = await client.query(`select id from task_conversations where occurrence_id = $1 and type = 'occurrence'`, [occId]);
      check('occurrence gets its own discussion conversation', conv.rows.length === 1);
      const occConvId = conv.rows[0]?.id;

      // notifications has no director bypass (confirmed by check #11
      // above — even the director can't read someone else's notification
      // row), so this has to be read as guardBetla themselves.
      await setUser(U.guardBetla);
      const notif = await client.query(
        `select id from notifications where user_id = $1 and type = 'group_task_assigned' and task_id = $2`,
        [U.guardBetla, fannedOutTaskId],
      );
      check('the assigned member gets exactly one group_task_assigned notification', notif.rows.length === 1);
      await setUser(U.director);

      // 27. The idempotency key (occurrence_id, assignee_id) rejects a
      // second task for the same member under the same occurrence —
      // exactly what a retried scheduler/RPC call would hit.
      const dupErr = await expectErrorSp(() =>
        client.query(
          `insert into tasks (title, assignee_id, created_by_id, range_id, status, priority, due_date, occurrence_id)
           values ('duplicate fan-out attempt', $1, $2, $3, 'NotStarted', 'High', current_date + 2, $4)`,
          [U.guardBetla, U.director, R.betla, occId],
        ),
      );
      check('a second task for the same member under the same occurrence is rejected (idempotency key)', dupErr !== null, dupErr ?? 'no error raised');

      // 28. Assigned member reads the occurrence and can post to its
      // discussion; a non-member guard can do neither.
      await setUser(U.guardBetla);
      const occAsMember = await client.query('select id from task_occurrences where id = $1', [occId]);
      check('assigned member reads the occurrence', occAsMember.rows.length === 1);
      const postErr = await expectErrorSp(() =>
        client.query(`insert into task_messages (conversation_id, sender_id, body) values ($1, $2, 'On my way')`, [occConvId, U.guardBetla]),
      );
      check('assigned member can post to the occurrence discussion', postErr === null, postErr ?? '');

      await setUser(U.guardKechki);
      const occAsOutsider = await client.query('select id from task_occurrences where id = $1', [occId]);
      check('non-member guard cannot see the occurrence', occAsOutsider.rows.length === 0);

      // 29. Group announcement posting respects members_can_reply=false:
      // an ordinary member is blocked, but a coordinator can still post.
      await setUser(U.director);
      await client.query(`update task_groups set members_can_reply = false where id = $1`, [G.betlaPatrol]);
      const groupConv = await client.query(`insert into task_conversations (type, group_id) values ('group', $1) returning id`, [G.betlaPatrol]);
      const groupConvId = groupConv.rows[0].id;

      await setUser(U.guardBetla);
      const blockedErr = await expectErrorSp(() =>
        client.query(`insert into task_messages (conversation_id, sender_id, body) values ($1, $2, 'hello')`, [groupConvId, U.guardBetla]),
      );
      check('ordinary member blocked from posting when members_can_reply=false', blockedErr !== null, blockedErr ?? 'no error raised');

      await setUser(U.officerBetla);
      await client.query(`update task_group_members set membership_role = 'coordinator' where group_id = $1 and user_id = $2`, [G.betlaPatrol, U.guardBetla]);

      await setUser(U.guardBetla);
      const coordErr = await expectError(() =>
        client.query(`insert into task_messages (conversation_id, sender_id, body) values ($1, $2, 'coordinator update')`, [groupConvId, U.guardBetla]),
      );
      check('coordinator CAN post even when members_can_reply=false', coordErr === null, coordErr ?? '');

      await client.query('ROLLBACK');
    } finally {
      await client.end();
    }
  }

  // 30. Anon cannot read task_groups at all.
  await asAnon(async (c) => {
    const { rows } = await c.query('select id from task_groups');
    check('anon reads zero task groups', rows.length === 0, `got ${rows.length} rows`);
  });

  // ── Recurring series generator (Phase 2) ───────────────────────────
  // generate_due_task_occurrences() is revoked from public/anon/
  // authenticated entirely — only pg_cron (running as the function owner
  // via SECURITY DEFINER) ever calls it, so these run as the plain
  // superuser connection, not an impersonated app role. All inserts use
  // creation_time='00:00' so the hour-gate always passes regardless of
  // when this suite runs, and weekday cases compute "today" dynamically
  // (extract(dow from current_date)) so they pass on any day of the week.
  {
    const client = new Client(CONN);
    await client.connect();
    try {
      await client.query('BEGIN');

      const S = {
        daily: 'e0000000-0000-0000-0000-000000000001',
        wrongWeekday: 'e0000000-0000-0000-0000-000000000002',
        todayWeekday: 'e0000000-0000-0000-0000-000000000003',
        paused: 'e0000000-0000-0000-0000-000000000004',
        monthlyClamped: 'e0000000-0000-0000-0000-000000000005',
      };
      const insertSeries = (id, recurrenceType, rule, startDaysAgo, status = 'active') =>
        client.query(
          `insert into task_series (id, group_id, title, category, priority, recurrence_type, recurrence_rule, start_date, creation_time, due_offset_days, status, created_by, range_id)
           values ($1, $2, $3, 'Patrol', 'Medium', $4, $5, current_date - $6::int, '00:00', 1, $7, $8, $9)`,
          [id, G.betlaPatrol, `Series ${id}`, recurrenceType, rule, startDaysAgo, status, U.officerBetla, R.betla],
        );

      await insertSeries(S.daily, 'daily', {}, 1);
      const first = await client.query('select out_outcome from generate_due_task_occurrences() where out_series_id = $1', [S.daily]);
      check('daily series due today: first run creates an occurrence', first.rows[0]?.out_outcome === 'created', JSON.stringify(first.rows));

      const dailyTasks = await client.query('select assignee_id from tasks where series_id = $1', [S.daily]);
      check('daily series fans out exactly one task, to the one active member', dailyTasks.rows.length === 1 && dailyTasks.rows[0].assignee_id === U.guardBetla, JSON.stringify(dailyTasks.rows));

      const second = await client.query('select out_outcome from generate_due_task_occurrences() where out_series_id = $1', [S.daily]);
      check('daily series: re-running the same cycle is idempotent (already_generated, no error)', second.rows[0]?.out_outcome === 'already_generated', JSON.stringify(second.rows));
      const dailyTasksAfter = await client.query('select count(*) from tasks where series_id = $1', [S.daily]);
      check('daily series: task count unchanged after the idempotent re-run', Number(dailyTasksAfter.rows[0].count) === 1);

      // Ask Postgres for "today" the exact same way the function itself
      // computes it (IST) rather than recomputing in JS (which would use
      // the test runner's own timezone/UTC and could disagree with the
      // function near a day boundary).
      const { rows: [{ ist_dow }] } = await client.query(
        `select extract(dow from (now() at time zone 'Asia/Kolkata')::date)::int as ist_dow`,
      );
      await insertSeries(S.wrongWeekday, 'weekly', { weekdays: [(ist_dow + 1) % 7] }, 1);
      await insertSeries(S.todayWeekday, 'weekly', { weekdays: [ist_dow] }, 7);
      await insertSeries(S.paused, 'daily', {}, 1, 'paused');
      await insertSeries(S.monthlyClamped, 'monthly', { day_of_month: 31 }, 40);

      const batch = await client.query(
        'select out_series_id, out_outcome from generate_due_task_occurrences() where out_series_id = any($1)',
        [[S.wrongWeekday, S.todayWeekday, S.paused, S.monthlyClamped]],
      );
      const outcomeOf = (id) => batch.rows.find((r) => r.out_series_id === id)?.out_outcome;
      check('weekly series NOT scheduled for today never fires', outcomeOf(S.wrongWeekday) === undefined, JSON.stringify(batch.rows));
      check('weekly series scheduled for today\'s actual weekday fires', outcomeOf(S.todayWeekday) === 'created', JSON.stringify(batch.rows));
      check('paused series is skipped entirely, even though it would otherwise be due', outcomeOf(S.paused) === undefined, JSON.stringify(batch.rows));
      // day_of_month=31 clamped to the real last day of the current month —
      // only fires if today happens to BE that last day, which this test
      // doesn't control, so it must simply not error and not appear unless
      // today is genuinely the last day of the month. Computed via the
      // same IST-based query the function itself uses, not JS Date.
      const { rows: [{ is_last_dom }] } = await client.query(
        `select extract(day from (now() at time zone 'Asia/Kolkata')::date) =
                extract(day from (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) + interval '1 month - 1 day'))
                as is_last_dom`,
      );
      check(
        'monthly series with day_of_month=31 only fires when today is genuinely the last day of the month (clamped, not skipped/errored)',
        is_last_dom ? outcomeOf(S.monthlyClamped) === 'created' : outcomeOf(S.monthlyClamped) === undefined,
        JSON.stringify(batch.rows),
      );

      await client.query('ROLLBACK');
    } finally {
      await client.end();
    }
  }

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Test harness error:', e);
  process.exit(1);
});

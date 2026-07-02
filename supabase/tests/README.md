# Local RLS & load testing

This directory lets you exercise `supabase/schema.sql` against a **real local
Postgres instance** — full RLS policies, triggers, and indexes — without
Docker and without touching the live Supabase project. No Supabase CLI /
Docker image pulls required; this only needs a local `postgresql` server.

It exists because RLS bugs are security bugs and RLS performance problems
only show up at realistic data volume — neither is visible from reading the
schema, and the live project isn't a safe place to load-test.

## What it does

`local-shim.sql` stands in for the pieces of the platform that Supabase
normally provides outside your own `schema.sql`: the `anon` / `authenticated`
/ `service_role` roles, a minimal `auth.users` table, an `auth.uid()` that
reads a session GUC (`app.uid`) instead of a real JWT, minimal `storage.*`
stand-ins, and a stub `net.http_post` that just logs calls instead of making
them (the push-notification *trigger firing* is tested; actual HTTP delivery
isn't — that's what `supabase/functions/send-push` is for).

## Setup (one-time per machine)

```bash
sudo apt-get install -y postgresql postgresql-contrib   # if not already installed
sudo service postgresql start
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
npm install pg   # only needed to run rls.test.mjs; not an app dependency
```

## Rebuild the test database

```bash
cd supabase/tests
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ptr_test;"
sudo -u postgres psql -c "CREATE DATABASE ptr_test;"
sudo -u postgres psql -d ptr_test -v ON_ERROR_STOP=1 -f local-shim.sql
sed -e '/create extension if not exists pg_net/d' ../schema.sql | \
  sudo -u postgres psql -d ptr_test -v ON_ERROR_STOP=1
sudo -u postgres psql -d ptr_test -v ON_ERROR_STOP=1 -f local-grants.sql
sudo -u postgres psql -d ptr_test -v ON_ERROR_STOP=1 -f seed-small.sql
```

## Run the RLS correctness suite

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/ptr_test node rls.test.mjs
```

Checks director/officer/guard read scoping, cross-range write blocking, the
guard column/status-update guard trigger, self-role-escalation blocking, and
notification visibility. All 13 checks should pass — if one fails after a
schema change, that's a real RLS regression.

## Run the load/scale test

```bash
sudo -u postgres psql -d ptr_test -v ON_ERROR_STOP=1 -f seed-bulk.sql   # ~50k tasks, ~100k child rows
PGPASSWORD=postgres pgbench -h localhost -U postgres -n -c 20 -j 4 -T 15 \
  -f bench-read-tasks.sql@70 -f bench-update-task.sql@20 -f bench-insert-notification.sql@10 \
  ptr_test
```

For a single-query look at a specific query's plan/timing at scale:

```bash
sudo -u postgres psql -d ptr_test <<'EOF'
begin;
set local role authenticated;
set local app.uid = 'a0000000-0000-0000-0000-000000000002'; -- seeded range officer
explain (analyze, buffers, timing)
select * from tasks order by created_at desc;
rollback;
EOF
```

## Baseline (as of the 2026-07-02 RLS performance fix)

Measured on a 50k-task / 60k-task_update / 40k-notification seed:

| Query | Before | After |
|---|---|---|
| Officer-scoped task list | ~1000ms, full seq scan | ~7ms |
| Director full task list | ~584ms | ~37ms |
| pgbench, 20 clients, 15s, realistic read/write mix | 4.3 TPS, 2.3s avg latency (10 clients) | 890 TPS, 11.7ms avg latency (20 clients) |

If a future change to `schema.sql` regresses these numbers significantly,
suspect a new RLS policy with an unwrapped `auth.uid()` / helper-function
call, or multiple permissive policies on the same table defeating index
pushdown (see the comment above the RLS section in `schema.sql`).

## Applying fixes found here to production

This only tests `schema.sql` locally. A fix proven here (e.g. the RLS
wrapping fix) still needs to be re-run against the live project — paste the
relevant `CREATE POLICY` / `CREATE INDEX` statements into the Supabase SQL
Editor, or re-run all of `schema.sql` (it's idempotent).

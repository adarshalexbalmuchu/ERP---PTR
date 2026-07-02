-- Supabase's platform grants broad table/schema privileges to anon/authenticated/
-- service_role automatically (outside the user's own schema.sql). Vanilla Postgres
-- doesn't, so RLS alone would 403 everything. Replicate those baseline grants here —
-- RLS policies still gate row visibility on top of this.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant select on task_dashboard_stats to authenticated;
grant select on task_range_stats to authenticated;

-- net.http_post (stubbed in local-shim.sql) is invoked by the
-- notifications_push_trigger trigger, which runs as the inserting role.
grant usage on schema net to anon, authenticated, service_role;
grant execute on function net.http_post to anon, authenticated, service_role;
grant insert on net.http_post_log to anon, authenticated, service_role;
grant usage, select on net.http_post_log_id_seq to anon, authenticated, service_role;

-- lets `sudo -u postgres psql` sessions exercise RLS via `set local role
-- authenticated` without a separate login role.
grant authenticated to postgres;
grant anon to postgres;

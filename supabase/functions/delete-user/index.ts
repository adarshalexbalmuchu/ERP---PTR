import { createClient } from 'npm:@supabase/supabase-js@2';

// JWT-authenticated endpoint, so a wildcard origin is not itself an auth
// bypass (no cookies are involved) — but set ALLOWED_ORIGIN to the app's
// deployed origin(s) to stop other websites from even initiating calls.
// Accepts a comma-separated list because the app may be served from more
// than one domain (e.g. two Vercel projects):
//   supabase secrets set ALLOWED_ORIGIN=https://app-a.example,https://app-b.example
// CORS only permits ONE origin per response, so we echo the request's
// Origin back when it's on the list (with Vary: Origin so caches don't
// serve one origin's preflight to another).
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGIN') ?? '*')
  .split(',').map((s) => s.trim()).filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes('*')
    ? '*'
    : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(req: Request, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return jsonResponse(req, { error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Call /auth/v1/user directly with fetch rather than the supabase-js
    // client's auth.getUser() — the client-side call fails unreliably here
    // (see create-user for the same fix). Failures are logged server-side
    // only so the response doesn't leak internals to the caller.
    const authCheckRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { authorization: authHeader, apikey: anonKey },
    });
    const authCheckText = await authCheckRes.text();
    if (!authCheckRes.ok) {
      console.error(`auth check failed: HTTP ${authCheckRes.status} — ${authCheckText.slice(0, 300)}`);
      return jsonResponse(req, { error: 'Unauthorized' }, 401);
    }
    let caller: { id: string } | undefined;
    try {
      caller = JSON.parse(authCheckText);
    } catch {
      console.error(`auth check returned non-JSON (HTTP ${authCheckRes.status})`);
      return jsonResponse(req, { error: 'Unauthorized' }, 401);
    }
    if (!caller?.id) return jsonResponse(req, { error: 'Unauthorized' }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (profileErr || callerProfile?.role !== 'director') {
      return jsonResponse(req, { error: 'Only directors can delete users' }, 403);
    }

    const { userId } = await req.json() as { userId: string };
    if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
      return jsonResponse(req, { error: 'A valid userId is required' }, 400);
    }

    // Prevent self-deletion
    if (userId === caller.id) {
      return jsonResponse(req, { error: 'Cannot delete your own account' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Prevent deleting the last director — that would permanently lock
    // everyone out of user management (only directors can create users).
    const { data: target, error: targetErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (targetErr || !target) {
      return jsonResponse(req, { error: 'User not found' }, 404);
    }
    if (target.role === 'director') {
      const { count, error: countErr } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'director');
      if (countErr) throw countErr;
      if ((count ?? 0) <= 1) {
        return jsonResponse(req, { error: 'Cannot delete the only remaining director' }, 400);
      }
    }

    // Every table below references profiles(id) ON DELETE RESTRICT, so the
    // deleteUser() call further down fails with an opaque FK error if this
    // user still owns any rows. Check proactively and return a clear,
    // actionable message instead of a generic 500.
    const ownedTables: Array<{ table: string; column: string; label: string }> = [
      { table: 'task_updates', column: 'user_id', label: 'task update' },
      { table: 'comments', column: 'user_id', label: 'comment' },
      { table: 'attachments', column: 'user_id', label: 'attachment' },
      { table: 'incident_photos', column: 'uploaded_by', label: 'incident photo' },
      { table: 'incidents', column: 'reported_by', label: 'incident' },
      { table: 'daily_reports', column: 'generated_by', label: 'report' },
      { table: 'audit_log', column: 'actor_id', label: 'audit log entry' },
    ];

    const [taskResult, ...ownedResults] = await Promise.all([
      admin
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .or(`assignee_id.eq.${userId},created_by_id.eq.${userId}`),
      ...ownedTables.map(({ table, column }) =>
        admin.from(table).select('id', { count: 'exact', head: true }).eq(column, userId)
      ),
    ]);

    const blockers: string[] = [];
    if (taskResult.error) throw taskResult.error;
    if ((taskResult.count ?? 0) > 0) {
      const n = taskResult.count!;
      blockers.push(`${n} task${n === 1 ? '' : 's'}`);
    }
    ownedResults.forEach((result, i) => {
      if (result.error) throw result.error;
      const n = result.count ?? 0;
      if (n > 0) blockers.push(`${n} ${ownedTables[i].label}${n === 1 ? '' : 's'}`);
    });

    if (blockers.length > 0) {
      const list = blockers.length === 1
        ? blockers[0]
        : `${blockers.slice(0, -1).join(', ')} and ${blockers[blockers.length - 1]}`;
      return jsonResponse(
        req,
        { error: `This user still has ${list} — delete or reassign them first.` },
        409,
      );
    }

    // Profile row is deleted automatically via CASCADE from auth.users
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return jsonResponse(req, { success: true }, 200);
  } catch (err) {
    // Never echo internal error detail (DB constraint names, stack info)
    // back to the caller — full detail goes to the function logs only.
    console.error('delete-user failed:', err instanceof Error ? err.message : err);
    return jsonResponse(req, { error: 'Internal error — check the function logs' }, 500);
  }
});

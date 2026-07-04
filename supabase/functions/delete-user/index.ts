import { createClient } from 'npm:@supabase/supabase-js@2';

// JWT-authenticated endpoint, so a wildcard origin is not itself an auth
// bypass (no cookies are involved) — but set ALLOWED_ORIGIN to the app's
// deployed origin to stop other websites from even initiating calls:
//   supabase secrets set ALLOWED_ORIGIN=https://your-app.example
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

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
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    let caller: { id: string } | undefined;
    try {
      caller = JSON.parse(authCheckText);
    } catch {
      console.error(`auth check returned non-JSON (HTTP ${authCheckRes.status})`);
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (!caller?.id) return jsonResponse({ error: 'Unauthorized' }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (profileErr || callerProfile?.role !== 'director') {
      return jsonResponse({ error: 'Only directors can delete users' }, 403);
    }

    const { userId } = await req.json() as { userId: string };
    if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
      return jsonResponse({ error: 'A valid userId is required' }, 400);
    }

    // Prevent self-deletion
    if (userId === caller.id) {
      return jsonResponse({ error: 'Cannot delete your own account' }, 400);
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
      return jsonResponse({ error: 'User not found' }, 404);
    }
    if (target.role === 'director') {
      const { count, error: countErr } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'director');
      if (countErr) throw countErr;
      if ((count ?? 0) <= 1) {
        return jsonResponse({ error: 'Cannot delete the only remaining director' }, 400);
      }
    }

    // Profile row is deleted automatically via CASCADE from auth.users
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    // Never echo internal error detail (DB constraint names, stack info)
    // back to the caller — full detail goes to the function logs only.
    console.error('delete-user failed:', err instanceof Error ? err.message : err);
    return jsonResponse({ error: 'Internal error — check the function logs' }, 500);
  }
});

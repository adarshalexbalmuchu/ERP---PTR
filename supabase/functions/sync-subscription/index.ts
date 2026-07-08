import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

interface SubKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function isSubKeys(v: unknown): v is SubKeys {
  const s = v as SubKeys | null;
  return !!s && typeof s.endpoint === 'string' && typeof s.p256dh === 'string' && typeof s.auth === 'string'
    && s.endpoint.length > 0 && s.p256dh.length > 0 && s.auth.length > 0;
}

// Called by the service worker's `pushsubscriptionchange` handler (see
// src/sw.ts) when the browser rotates a device's push subscription while the
// app is closed. The worker has no user JWT, so this has verify_jwt = false
// (see config.toml) and instead authorizes by proof of possession: the caller
// must present the OLD subscription's endpoint AND its p256dh/auth key pair,
// matching a stored row exactly. A push endpoint can leak, but the key pair is
// only ever held by the device that created the subscription — so matching all
// three is what lets us move that row to the new endpoint safely.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { old: oldSub, new: newSub } = await req.json() as { old?: unknown; new?: unknown };
    if (!isSubKeys(oldSub) || !isSubKeys(newSub)) {
      throw new Error('both `old` and `new` subscriptions (endpoint, p256dh, auth) are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: rows, error } = await admin
      .from('push_subscriptions')
      .select('id, user_id, p256dh, auth')
      .eq('endpoint', oldSub.endpoint)
      .limit(1);
    if (error) throw error;

    const row = rows?.[0];
    // No such row, or the presented keys don't match the stored ones: the
    // caller hasn't proven it owns the old subscription. Not a client error to
    // retry — just nothing we can (or should) move.
    if (!row || row.p256dh !== oldSub.p256dh || row.auth !== oldSub.auth) {
      return json(200, { moved: false });
    }

    // If a stale row already claims the NEW endpoint (unique column), clear it
    // first so the update below can't collide, then re-point this row at the
    // rotated subscription. user_id is preserved — the device still belongs to
    // the same signed-in user.
    await admin.from('push_subscriptions').delete().eq('endpoint', newSub.endpoint).neq('id', row.id);
    const { error: updateError } = await admin
      .from('push_subscriptions')
      .update({ endpoint: newSub.endpoint, p256dh: newSub.p256dh, auth: newSub.auth })
      .eq('id', row.id);
    if (updateError) throw updateError;

    return json(200, { moved: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return json(400, { error: message });
  }
});

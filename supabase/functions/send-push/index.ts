import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Compare two secrets without early exit: hashing both first means the
// byte-by-byte comparison always runs over equal-length digests, so
// response timing can't be used to guess the secret one byte at a time.
async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

// Called by the notifications_push_trigger Postgres trigger (see
// schema.sql) every time a row is inserted into `notifications` — not by
// the browser directly, so this has verify_jwt = false in config.toml and
// checks its own shared secret instead of a user JWT.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');
    if (!webhookSecret || !providedSecret || !(await secretsMatch(providedSecret, webhookSecret))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublicKey || !vapidPrivateKey) throw new Error('VAPID keys are not configured');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:ptr-tiger-cell@example.com';
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const { user_id, title, message, task_id } = await req.json() as {
      user_id: string;
      title: string;
      message: string;
      task_id: string | null;
    };
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user_id || typeof user_id !== 'string' || !UUID_RE.test(user_id)) {
      throw new Error('a valid user_id is required');
    }
    if (task_id != null && (typeof task_id !== 'string' || !UUID_RE.test(task_id))) {
      throw new Error('task_id must be a UUID when present');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user_id);
    if (error) throw error;

    const payload = JSON.stringify({
      title,
      body: message,
      url: task_id ? `/tasks/${task_id}` : '/',
    });

    const results = await Promise.allSettled(
      (subs ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (err) {
          // 404/410 = the browser/OS invalidated this subscription
          // (uninstalled, permission revoked, device reset) — stop trying it.
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('id', sub.id);
          }
          throw err;
        }
      }),
    );

    return new Response(
      JSON.stringify({
        sent: results.filter((r) => r.status === 'fulfilled').length,
        total: results.length,
        // Surfaced for operational debugging only — this endpoint is never
        // reachable without the shared webhook secret, so it's safe to
        // include failure detail here (no stack traces, just status/message).
        failures: results
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => r.status === 'rejected')
          .map(({ r, i }) => {
            const reason = (r as PromiseRejectedResult).reason;
            return {
              endpoint: subs![i].endpoint.slice(0, 60),
              statusCode: reason?.statusCode,
              message: reason?.body ?? reason?.message ?? String(reason),
            };
          }),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});

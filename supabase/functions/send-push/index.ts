import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { createECDH } from 'node:crypto';
import { Buffer } from 'node:buffer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

// Secrets pasted into the dashboard routinely pick up a trailing newline or
// space, which silently corrupts VAPID signatures — the push service then
// rejects every send with 403 "invalid JWT" while the keys *look* correct.
// Trimming here makes that entire failure class impossible.
function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

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

function b64urlDecode(value: string): Uint8Array | null {
  try {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

interface VapidDiag {
  configured: boolean;
  // 65 = valid uncompressed P-256 point; 32 = valid private scalar.
  publicKeyBytes: number | null;
  privateKeyBytes: number | null;
  // The definitive check: the public key derived from the configured private
  // key must equal the configured public key, or every push is rejected with
  // 403 "invalid JWT" by FCM/APNs no matter how correct each key looks alone.
  // null = couldn't run the derivation (malformed private key).
  pairMatches: boolean | null;
  subjectSet: boolean;
}

// Reports whether the configured VAPID keys can possibly work, WITHOUT
// exposing any private key material (only byte lengths and a boolean).
function vapidDiag(publicKey?: string, privateKey?: string): VapidDiag {
  const subjectSet = !!env('VAPID_SUBJECT');
  if (!publicKey || !privateKey) {
    return { configured: false, publicKeyBytes: null, privateKeyBytes: null, pairMatches: null, subjectSet };
  }
  const pub = b64urlDecode(publicKey);
  const priv = b64urlDecode(privateKey);
  let pairMatches: boolean | null = null;
  if (pub && priv && priv.length === 32) {
    try {
      const ecdh = createECDH('prime256v1');
      ecdh.setPrivateKey(Buffer.from(priv));
      const derived = new Uint8Array(ecdh.getPublicKey());
      pairMatches = derived.length === pub.length && derived.every((byte, i) => byte === pub[i]);
    } catch {
      pairMatches = null;
    }
  }
  return {
    configured: true,
    publicKeyBytes: pub?.length ?? null,
    privateKeyBytes: priv?.length ?? null,
    pairMatches,
    subjectSet,
  };
}

interface SendOutcome {
  sent: number;
  total: number;
  failures: { endpoint: string; statusCode?: number; message?: string }[];
}

// Sends `payload` to every stored subscription for `userId`, pruning rows the
// push service reports as permanently gone (404/410).
async function sendToUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  payload: string,
): Promise<SendOutcome> {
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (error) throw error;

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

  const failures = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === 'rejected')
    .map(({ r, i }) => {
      const reason = (r as PromiseRejectedResult).reason as {
        statusCode?: number;
        body?: string;
        message?: string;
      };
      return {
        endpoint: subs![i].endpoint.slice(0, 60),
        statusCode: reason?.statusCode,
        message: reason?.body ?? reason?.message ?? String(reason),
      };
    });
  for (const f of failures) {
    console.error(`[send-push] delivery failed status=${f.statusCode} endpoint=${f.endpoint} message=${f.message}`);
  }
  return { sent: results.filter((r) => r.status === 'fulfilled').length, total: results.length, failures };
}

// Two callers, two auth modes (verify_jwt = false in config.toml, so auth is
// enforced here):
//   1. The notifications_push_trigger Postgres trigger (see schema.sql) POSTs
//      with the shared x-webhook-secret header on every notification insert.
//      Body: { user_id, title, message, task_id, type?, priority? }.
//   2. A signed-in user POSTs { mode: 'test' } with their own Supabase JWT to
//      push a test notification to their OWN devices only — this powers the
//      in-app "Send test notification" button and returns per-device results
//      plus the VAPID diagnostics so misconfiguration is visible in the UI
//      instead of only in server logs.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const body = await req.json().catch(() => ({})) as {
      mode?: string;
      user_id?: string;
      title?: string;
      message?: string;
      task_id?: string | null;
      type?: string | null;
      priority?: string | null;
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const vapidPublicKey = env('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = env('VAPID_PRIVATE_KEY');
    const diag = vapidDiag(vapidPublicKey, vapidPrivateKey);

    // ── Authenticated self-test mode ─────────────────────────────
    if (body.mode === 'test') {
      const authHeader = req.headers.get('authorization') ?? '';
      const jwt = authHeader.replace(/^Bearer\s+/i, '');
      if (!jwt) return json(401, { error: 'Sign in to send a test notification', vapid: diag });
      const { data: userData, error: userError } = await admin.auth.getUser(jwt);
      const userId = userData?.user?.id;
      if (userError || !userId) return json(401, { error: 'Invalid session', vapid: diag });

      if (!vapidPublicKey || !vapidPrivateKey) {
        return json(200, { sent: 0, total: 0, failures: [], vapid: diag, error: 'VAPID keys are not configured on the server' });
      }
      if (diag.pairMatches === false) {
        // Don't bother contacting the push service: every send would 403.
        return json(200, {
          sent: 0,
          total: 0,
          failures: [],
          vapid: diag,
          error: 'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not a matching pair — regenerate one pair and set both from the same generation',
        });
      }
      webpush.setVapidDetails(env('VAPID_SUBJECT') ?? 'mailto:ptr-tiger-cell@example.com', vapidPublicKey, vapidPrivateKey);

      const payload = JSON.stringify({
        title: 'Test notification',
        body: 'Push notifications are working on this device.',
        url: '/',
        type: 'task_updated',
      });
      const outcome = await sendToUser(admin, userId, payload);
      console.info(`[send-push] test user=${userId} sent=${outcome.sent}/${outcome.total}`);
      return json(200, { ...outcome, vapid: diag });
    }

    // ── Trigger (webhook) mode ───────────────────────────────────
    const webhookSecret = env('PUSH_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');
    if (!webhookSecret || !providedSecret || !(await secretsMatch(providedSecret, webhookSecret))) {
      return json(401, { error: 'Unauthorized' });
    }

    if (!vapidPublicKey || !vapidPrivateKey) throw new Error('VAPID keys are not configured');
    webpush.setVapidDetails(env('VAPID_SUBJECT') ?? 'mailto:ptr-tiger-cell@example.com', vapidPublicKey, vapidPrivateKey);

    const { user_id, title, message, task_id, type, priority } = body;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user_id || typeof user_id !== 'string' || !UUID_RE.test(user_id)) {
      throw new Error('a valid user_id is required');
    }
    if (task_id != null && (typeof task_id !== 'string' || !UUID_RE.test(task_id))) {
      throw new Error('task_id must be a UUID when present');
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: task_id ? `/tasks/${task_id}` : '/',
      type: type ?? undefined,
      priority: priority ?? undefined,
    });

    const outcome = await sendToUser(admin, user_id, payload);
    // The trigger discards this response, but pg_net records it in
    // net._http_response — including the pair check makes a key
    // misconfiguration diagnosable straight from that table.
    return json(200, { ...outcome, vapid: { pairMatches: diag.pairMatches } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error(`[send-push] error: ${message}`);
    return json(400, { error: message });
  }
});

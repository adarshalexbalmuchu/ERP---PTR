import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Called by the notifications_push_trigger Postgres trigger (see
// schema.sql) every time a row is inserted into `notifications` — not by
// the browser directly, so this has verify_jwt = false in config.toml and
// checks its own shared secret instead of a user JWT.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    if (!webhookSecret || req.headers.get('x-webhook-secret') !== webhookSecret) {
      throw new Error('Unauthorized');
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
    if (!user_id) throw new Error('user_id is required');

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

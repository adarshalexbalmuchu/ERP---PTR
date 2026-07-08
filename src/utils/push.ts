import { supabase } from '../lib/supabase';

// Web Push requires the VAPID public key as a raw Uint8Array, but it's
// distributed/stored as a base64url string.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// iOS Safari only exposes PushManager/Notification once the site has been
// added to the Home Screen (iOS 16.4+) — in a regular Safari tab
// isPushSupported() above is correctly false, but that reads to the user
// as "notifications aren't available here" rather than "install first."
// This flags that specific case so the UI can say the right thing.
export function isIOSBrowserTab(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && !isStandalone;
}

export type PushStatus = 'subscribed' | 'unsubscribed' | 'unsupported';

export async function getPushSubscriptionStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'unsubscribed';
}

function getVapidKey(): string | undefined {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
}

// Store (or refresh) the row the send-push Edge Function reads to reach this
// device. Goes through the claim_push_subscription routine (see schema.sql)
// rather than a direct upsert: on a shared device the endpoint's row may still
// belong to the previous user, which the "own row" RLS policy hides — so a
// plain upsert on `endpoint` would fail. The routine re-points the row at
// whoever is signed in now, which is exactly what that hand-off needs.
async function saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Push subscription is missing required fields.');
  }
  // Called through a narrow shim rather than the typed client: this project's
  // hand-written database.types.ts models Functions as an empty map (its loose
  // relationship types can't coexist with enumerated RPCs), so the typed
  // `supabase.rpc` doesn't know this function. The cast is confined to this
  // one call and stays honest about the argument and error shapes.
  const rpc = (supabase as unknown as {
    rpc: (fn: string, args: Record<string, string>) => PromiseLike<{ error: { message: string } | null }>;
  }).rpc;
  const { error } = await rpc('claim_push_subscription', {
    p_user_id: userId,
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
  });
  if (error) throw error;
}

// True when an existing subscription was created against a *different* VAPID
// application server key than the one this build ships — i.e. the key pair
// was rotated on the server. Such a subscription can no longer be delivered
// to (send-push signs with the new key), so it must be torn down and remade.
function isStaleForVapid(subscription: PushSubscription, vapidPublicKey: string): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const expected = urlBase64ToUint8Array(vapidPublicKey);
  const actual = new Uint8Array(current);
  if (actual.byteLength !== expected.byteLength) return true;
  for (let i = 0; i < actual.byteLength; i++) if (actual[i] !== expected[i]) return true;
  return false;
}

async function createSubscription(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<PushSubscription> {
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
}

// Prompts for OS/browser notification permission, subscribes this device
// to Web Push, and stores the subscription so the send-push Edge Function
// can reach it. Re-subscribing an already-subscribed device is a no-op
// beyond re-syncing the row (upsert on endpoint).
export async function subscribeToPush(userId: string): Promise<void> {
  if (!isPushSupported()) throw new Error('This device/browser does not support push notifications.');

  const vapidPublicKey = getVapidKey();
  if (!vapidPublicKey) throw new Error('Push notifications are not configured for this deployment.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && isStaleForVapid(subscription, vapidPublicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) subscription = await createSubscription(registration, vapidPublicKey);

  await saveSubscription(userId, subscription);
}

// Best-effort "keep push alive" pass, safe to run on every app load once a
// user is signed in. Unlike subscribeToPush it NEVER prompts — it acts only
// when permission was already granted, silently repairing the common ways a
// device quietly stops receiving push even though the user once enabled it:
//   • the browser rotated or expired the subscription (getSubscription() → null)
//   • the row was pruned server-side after the push service returned 404/410
//   • a *different* user signed in on a shared device, so the stored row still
//     points this device's endpoint at the previous user
//   • the VAPID key pair was rotated, invalidating the old subscription
// Returns true if a live subscription is now stored for this user. Swallows
// every error: this is a background health check, not a user-facing action.
export async function ensurePushSubscription(userId: string): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;
    if (Notification.permission !== 'granted') return false;
    const vapidPublicKey = getVapidKey();
    if (!vapidPublicKey) return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (subscription && isStaleForVapid(subscription, vapidPublicKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    if (!subscription) subscription = await createSubscription(registration, vapidPublicKey);

    await saveSubscription(userId, subscription);
    return true;
  } catch (err) {
    console.warn('[push] ensurePushSubscription failed', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

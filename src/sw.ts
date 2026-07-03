/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
cleanupOutdatedCaches();

// App shell (JS/CSS/HTML) is precached so the app itself opens offline.
precacheAndRoute(self.__WB_MANIFEST);

// Supabase API responses are cached separately at runtime (GET only —
// Workbox never caches mutating requests) so a guard can still see their
// last-loaded tasks with no signal.
registerRoute(
  ({ url }) => url.pathname.startsWith('/rest/v1/'),
  new NetworkFirst({
    cacheName: 'ptr-api-cache',
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 })],
  }),
);

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
}

// Only ever navigate to a same-origin path. The send-push Edge Function
// builds relative "/tasks/<uuid>" URLs, but the push payload is still
// external input to this worker — never let it steer a notification click
// to another origin ("//evil.example" would otherwise parse as
// protocol-relative).
function sanitizeNotificationUrl(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

// Fired when the send-push Edge Function delivers a message — this is
// what makes a notification show up on the device/OS even when the app
// isn't open in a tab.
self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title ?? 'PTR Tiger Cell';
  const url = sanitizeNotificationUrl(payload.url);

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? '',
      icon: '/notification-icon.png',
      badge: '/notification-icon.png',
      data: { url },
      tag: url, // a second notification for the same task replaces the first
    }),
  );
});

// Focuses an already-open tab (navigating it to the task) instead of
// always spawning a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          void (client as WindowClient).navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

import { useCallback, useEffect, useState } from 'react';
import useStore from '../store/useStore';
import {
  getPushSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  ensurePushSubscription,
  isIOSBrowserTab,
  type PushStatus,
} from '../utils/push';

export function usePushNotifications() {
  const currentUser = useStore((s) => s.currentUser);
  const [status, setStatus] = useState<PushStatus | 'checking'>('checking');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setStatus(await getPushSubscriptionStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Silently keep this device's subscription alive on every load once a user
  // is signed in. If they'd already granted permission, this re-creates a
  // subscription the browser rotated/expired (or re-points a shared device at
  // the current user) so notifications keep arriving without the user ever
  // having to re-enable them. It never prompts, so it's safe to run eagerly.
  useEffect(() => {
    if (!currentUser) return;
    void ensurePushSubscription(currentUser.id).then((ok) => {
      if (ok) setStatus('subscribed');
    });
  }, [currentUser]);

  const enable = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      await subscribeToPush(currentUser.id);
      setStatus('subscribed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const disable = useCallback(async () => {
    setLoading(true);
    try {
      await unsubscribeFromPush();
      setStatus('unsubscribed');
    } finally {
      setLoading(false);
    }
  }, []);

  const permission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  const needsIOSInstall = status === 'unsupported' && typeof window !== 'undefined' && isIOSBrowserTab();

  return { status, error, loading, enable, disable, permission, needsIOSInstall };
}

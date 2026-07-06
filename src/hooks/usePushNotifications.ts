import { useCallback, useEffect, useState } from 'react';
import useStore from '../store/useStore';
import {
  getPushSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
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

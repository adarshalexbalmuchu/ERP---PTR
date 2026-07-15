import { useEffect, useState } from 'react';
import { useMutationState, useIsFetching } from '@tanstack/react-query';

export type SyncState = 'offline' | 'syncing' | 'synced' | 'sync-failed';

const LAST_SYNCED_KEY = 'ptr-last-synced';

function readLastSynced(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SYNCED_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

// Single source of truth for the "am I online, and is anything waiting to
// sync" question — the mobile top bar's status pill and the desktop
// OfflineBanner both read from the same signals (navigator.onLine, paused
// mutations, in-flight queries) so they never disagree.
export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSynced, setLastSynced] = useState<number | null>(readLastSynced);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Paused mutations = queued changes waiting for a connection (task status
  // updates, comments, incident reports — see queryClient.ts's networkMode).
  const pendingCount = useMutationState({
    filters: { status: 'pending' },
    select: (m) => m.state.isPaused,
  }).filter(Boolean).length;

  const failedCount = useMutationState({
    filters: { status: 'error' },
    select: () => true,
  }).length;

  const fetching = useIsFetching();

  // Stamp "last synced" whenever a fetch completes while online and nothing
  // is queued — the simplest honest signal that the visible data is current.
  useEffect(() => {
    if (isOnline && fetching === 0 && pendingCount === 0) {
      const now = Date.now();
      setLastSynced(now);
      try { localStorage.setItem(LAST_SYNCED_KEY, String(now)); } catch { /* ignore */ }
    }
  }, [isOnline, fetching, pendingCount]);

  let state: SyncState;
  if (!isOnline) state = 'offline';
  else if (failedCount > 0) state = 'sync-failed';
  else if (fetching > 0 || pendingCount > 0) state = 'syncing';
  else state = 'synced';

  return { state, isOnline, pendingCount, failedCount, lastSynced };
}

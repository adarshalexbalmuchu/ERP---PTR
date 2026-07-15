import { useEffect, useState } from 'react';
import { useMutationState } from '@tanstack/react-query';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  // Mutations paused by TanStack Query's default networkMode while offline
  // (progress updates, start/complete, etc.) — resumed automatically once
  // back online (see App.tsx's onSuccess / resumePausedMutations).
  const pendingCount = useMutationState({
    filters: { status: 'pending' },
    select: (m) => m.state.isPaused,
  }).filter(Boolean).length;

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      role="status"
      className={`px-4 py-1.5 text-13 font-medium flex items-center justify-center gap-2 ${
        isOnline ? 'bg-signal-amber text-white' : 'bg-signal-red text-white'
      }`}
    >
      {isOnline ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Syncing {pendingCount} change{pendingCount === 1 ? '' : 's'}…
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          Offline — {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} queued, will sync when reconnected` : 'changes are saved locally and will sync automatically'}
        </>
      )}
    </div>
  );
}

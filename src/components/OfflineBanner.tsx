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
      className={`px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 ${
        isOnline ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'
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
          You're offline — {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} will sync when reconnected` : 'changes will be saved and synced automatically'}
        </>
      )}
    </div>
  );
}

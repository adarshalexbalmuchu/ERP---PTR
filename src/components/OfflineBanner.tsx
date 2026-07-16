import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';

export default function OfflineBanner() {
  const { state, pendingCount, failedCount } = useSyncStatus();

  if (state === 'synced') return null;

  return (
    <div
      role="status"
      className={`px-4 py-1.5 text-13 font-medium flex items-center justify-center gap-2 ${
        state === 'syncing' ? 'bg-signal-amber text-white' : 'bg-signal-red text-white'
      }`}
    >
      {state === 'sync-failed' ? (
        <>
          <AlertCircle className="w-3.5 h-3.5" />
          Sync failed — {failedCount} change{failedCount === 1 ? '' : 's'} could not be sent
        </>
      ) : state === 'syncing' ? (
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

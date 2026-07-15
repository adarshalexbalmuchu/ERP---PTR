import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { loadQueue, subscribeQueue, processQueue, type DraftIncident } from '../lib/offlineIncidentQueue';

// Bridges the offline incident draft queue (plain localStorage, outside
// TanStack Query) into a component-friendly hook, and re-invalidates the
// real incidents list once a draft successfully submits so it appears
// without a manual refresh.
export function useIncidentQueue() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<DraftIncident[]>(() => loadQueue());

  useEffect(() => {
    const unsubscribe = subscribeQueue(() => {
      setItems(loadQueue());
      if (loadQueue().every((i) => i.status !== 'submitting')) {
        void queryClient.invalidateQueries({ queryKey: ['incidents'] });
      }
    });
    return unsubscribe;
  }, [queryClient]);

  return { queued: items, retry: () => void processQueue() };
}

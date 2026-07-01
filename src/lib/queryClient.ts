import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60_000, // 24h — long enough that a field guard's
      // cached tasks/queued mutations survive being offline for a full shift.
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Default networkMode ('online') means calling .mutate() while offline
      // pauses the mutation instead of failing it; it auto-resumes when the
      // browser comes back online. Combined with the persister below, a
      // guard's progress update/start/complete actions survive both a
      // dropped connection AND a page reload while offline.
      retry: 0,
    },
  },
});

export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'ptr-query-cache',
  throttleTime: 1000,
});

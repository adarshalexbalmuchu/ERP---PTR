import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Store } from '../types';

// Auth state only — all task/user/range/notification data now lives in
// Supabase and is fetched via TanStack Query hooks (see src/hooks/).
const useStore = create<Store>()(
  persist(
    (set) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),
    }),
    {
      name: 'ptr-store-v2',
    }
  )
);

export default useStore;

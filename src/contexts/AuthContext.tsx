import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import useStore from '../store/useStore';
import type { User } from '../types';
import type { Database } from '../lib/database.types';

// Must match the `key` passed to createSyncStoragePersister in queryClient.ts.
const QUERY_CACHE_STORAGE_KEY = 'ptr-query-cache';
// Must match the runtime cacheName in src/sw.ts.
const SW_API_CACHE_NAME = 'ptr-api-cache';

// Clears the in-memory query cache, its localStorage persistence, AND the
// service worker's runtime API cache so a signed-out session's
// task/incident/user data can't linger for the next person to use a shared
// device, and a subsequent login can't briefly rehydrate the previous
// user's stale cached data.
function clearPersistedCache() {
  queryClient.clear();
  try {
    window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private browsing etc.) — nothing to clear.
  }
  if ('caches' in window) {
    // Best-effort and async — the Supabase REST responses cached for
    // offline use are scoped to whoever was signed in when they were
    // fetched, so they must not survive into the next user's session.
    void window.caches.delete(SW_API_CACHE_NAME).catch(() => {});
  }
}

type ProfileRow = Database['public']['Tables']['profiles']['Row'] & {
  officer_ranges?: { range_id: string }[];
};

// The signed-in user's profile plus their full range set (profiles.range_id
// UNION officer_ranges) — officers in charge of several ranges get all of
// them here, which drives the range switcher in the officer pages.
const PROFILE_SELECT = '*, officer_ranges(range_id)';

function mapProfile(row: ProfileRow): User {
  const rangeIds = [...new Set([
    ...(row.range_id ? [row.range_id] : []),
    ...(row.officer_ranges ?? []).map((r) => r.range_id),
  ])];
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone ?? undefined,
    avatarInitials: row.avatar_initials,
    designation: row.designation,
    rangeId: row.range_id ?? undefined,
    rangeIds,
  };
}

interface AuthContextValue {
  loading: boolean;
  loginWithSupabase: (email: string, password: string) => Promise<void>;
  logoutFromSupabase: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const storeLogout = useStore((s) => s.logout);

  useEffect(() => {
    // Restore session on mount. If there's no valid session (expired/absent
    // refresh token — common after a long period offline or inactivity on
    // the mobile PWA), the zustand store's persisted `currentUser` from a
    // previous login must be cleared too. Otherwise the app keeps treating
    // the visitor as signed in (routes gate on `currentUser`, not on an
    // actual session) while every Supabase request goes out unauthenticated
    // — which surfaces downstream as opaque RLS violations on writes like
    // reporting an incident, instead of a clear "please sign in again".
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('id', session.user.id)
          .single();
        if (data) setCurrentUser(mapProfile(data));
      } else {
        storeLogout();
        clearPersistedCache();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('id', session.user.id)
          .single();
        if (data) setCurrentUser(mapProfile(data));
      } else if (event === 'SIGNED_OUT') {
        storeLogout();
        clearPersistedCache();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setCurrentUser, storeLogout]);

  async function loginWithSupabase(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function logoutFromSupabase() {
    await supabase.auth.signOut();
    storeLogout();
  }

  return (
    <AuthContext.Provider value={{ loading, loginWithSupabase, logoutFromSupabase }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

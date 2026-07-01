import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import useStore from '../store/useStore';
import type { User } from '../types';
import type { Database } from '../lib/database.types';

// Must match the `key` passed to createSyncStoragePersister in queryClient.ts.
const QUERY_CACHE_STORAGE_KEY = 'ptr-query-cache';

// Clears both the in-memory query cache and its localStorage persistence so
// a signed-out session's task/incident/user data can't linger for the next
// person to use a shared device, and a subsequent login can't briefly
// rehydrate the previous user's stale cached data.
function clearPersistedCache() {
  queryClient.clear();
  try {
    window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private browsing etc.) — nothing to clear.
  }
}

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone ?? undefined,
    avatarInitials: row.avatar_initials,
    designation: row.designation,
    rangeId: row.range_id ?? undefined,
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
    // Restore session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (data) setCurrentUser(mapProfile(data));
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
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

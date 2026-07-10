import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { mapProfile } from '../lib/mappers';
import type { User, Role } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Throws a clear, actionable error instead of silently sending an empty
// "Bearer " token when the session has expired or the refresh token was
// revoked (long-idle tab, signed out elsewhere, etc.) — that used to reach
// the edge function anyway and come back as an opaque generic "Unauthorized",
// which looked like a permissions bug rather than an expired session.
async function getAccessToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('Your session has expired — please sign out and sign in again.');
  }
  return session.access_token;
}

export function useUsers() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('name');
      if (error) throw error;
      return data.map(mapProfile);
    },
  });

  const createUser = useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      name: string;
      role: Role;
      phone?: string;
      avatarInitials: string;
      designation: string;
      rangeId?: string;
    }) => {
      const token = await getAccessToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to create user');
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, ...data }: Partial<User> & { id: string }) => {
      const patch: Database['public']['Tables']['profiles']['Update'] = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.role !== undefined) patch.role = data.role;
      if (data.phone !== undefined) patch.phone = data.phone;
      if (data.designation !== undefined) patch.designation = data.designation;
      if (data.avatarInitials !== undefined) patch.avatar_initials = data.avatarInitials;
      patch.range_id = data.rangeId ?? null;

      const { error } = await supabase.from('profiles').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const token = await getAccessToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete user');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return { users, isLoading, createUser, updateUser, deleteUser };
}

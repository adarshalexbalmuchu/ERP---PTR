import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapNotification } from '../lib/mappers';
import useStore from '../store/useStore';
import type { Notification } from '../types';

export function useNotifications() {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: async (): Promise<Notification[]> => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data.map(mapNotification);
    },
    enabled: !!currentUser,
  });

  // Realtime
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel(`notifications-${currentUser.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, () => {
        void queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUser?.id, queryClient]);

  const markRead = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notifId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!currentUser) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', currentUser.id)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] }),
  });

  return { notifications, markRead, markAllRead };
}

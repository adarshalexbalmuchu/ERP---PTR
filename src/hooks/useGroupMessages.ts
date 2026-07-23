import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapGroupMessage } from '../lib/mappers';
import useStore from '../store/useStore';

/** Messages for one conversation (a Task Group's announcement channel or
    one occurrence's discussion — both use the same task_conversations/
    task_messages tables, see schema.sql). Deliberately NOT used for
    private task discussion — that's still CommentThread.tsx +
    useTask(id).addComment, unchanged; this hook only exists for the two
    genuinely new conversation types. */
export function useGroupMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['group-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('task_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at');
      if (error) throw error;
      return data.map(mapGroupMessage);
    },
    enabled: !!conversationId,
  });

  const channelId = useRef(crypto.randomUUID()).current;
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`group-messages-${conversationId}-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_messages', filter: `conversation_id=eq.${conversationId}` },
        () => void queryClient.invalidateQueries({ queryKey: ['group-messages', conversationId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, queryClient, channelId]);

  const postMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!conversationId || !currentUser) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('task_messages')
        .insert({ conversation_id: conversationId, sender_id: currentUser.id, body });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['group-messages', conversationId] }),
  });

  return { messages, isLoading, postMessage };
}

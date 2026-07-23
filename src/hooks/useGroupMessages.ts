import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapGroupMessage } from '../lib/mappers';
import { setMessagePinned } from '../lib/taskGroupsRpc';
import useStore from '../store/useStore';
import type { Database } from '../lib/database.types';

// Same embed-typing workaround as useTaskGroups.ts's GroupListRow — this
// project's hand-written database.types.ts has no real FK metadata for
// supabase-js to resolve task_message_reads(user_id) against, so the
// query's inferred embed type collapses to `never` without an explicit cast.
type MessageRow = Database['public']['Tables']['task_messages']['Row'] & { task_message_reads: { user_id: string }[] };

/** Messages for one conversation (a Task Group's announcement channel or
    one occurrence's discussion — both use the same task_conversations/
    task_messages tables, see schema.sql). Deliberately NOT used for
    private task discussion — that's still CommentThread.tsx +
    useTask(id).addComment, unchanged; this hook only exists for the two
    genuinely new conversation types. Also handles read receipts
    ("message acknowledgements") and pin/redact (moderation). */
export function useGroupMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['group-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('task_messages')
        .select('*, task_message_reads(user_id)')
        .eq('conversation_id', conversationId)
        .order('created_at');
      if (error) throw error;
      return (data as unknown as MessageRow[]).map((row) => mapGroupMessage({ ...row, read_count: row.task_message_reads.length }));
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_message_reads' },
        () => void queryClient.invalidateQueries({ queryKey: ['group-messages', conversationId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, queryClient, channelId]);

  // Acknowledgement: mark every currently-loaded message as read by the
  // signed-in user. Upsert is idempotent (message_id, user_id is the
  // primary key), so re-running this on every message-list change is
  // cheap and never double-counts a read.
  useEffect(() => {
    if (!currentUser || messages.length === 0) return;
    void supabase
      .from('task_message_reads')
      .upsert(
        messages.map((m) => ({ message_id: m.id, user_id: currentUser.id })),
        { onConflict: 'message_id,user_id', ignoreDuplicates: true },
      );
    // Only the message id list should re-trigger this, not every field
    // change (e.g. a read-count update from someone ELSE reading would
    // otherwise cause this user to needlessly re-upsert their own rows).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, messages.map((m) => m.id).join(',')]);

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

  const setPinned = useMutation({
    mutationFn: ({ messageId, pinned }: { messageId: string; pinned: boolean }) => setMessagePinned(messageId, pinned),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['group-messages', conversationId] }),
  });

  // Redaction is a plain UPDATE (not an RPC) — task_messages_update_own
  // already correctly gates this at the row level (sender or director),
  // no column-level nuance needed the way pinning has.
  const redactMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!currentUser) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('task_messages')
        .update({ body: '', redacted_at: new Date().toISOString(), redacted_by: currentUser.id })
        .eq('id', messageId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['group-messages', conversationId] }),
  });

  return { messages, isLoading, postMessage, setPinned, redactMessage };
}

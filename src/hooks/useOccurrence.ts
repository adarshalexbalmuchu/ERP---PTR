import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapTask, mapTaskOccurrence } from '../lib/mappers';
import type { Task } from '../types';

/** One Assignment Occurrence's detail surface: the occurrence itself, the
    member tasks fanned out under it, and the id of its discussion
    conversation (for useGroupMessages). Progress is never read from a
    stored value — it's always this hook's own live aggregate over
    memberTasks, per the "no manually editable group completion
    percentage" rule. */
export function useOccurrence(id: string | undefined) {
  const queryClient = useQueryClient();

  const { data: occurrence, isLoading: occurrenceLoading } = useQuery({
    queryKey: ['occurrence', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('task_occurrences').select('*').eq('id', id).single();
      if (error) throw error;
      return mapTaskOccurrence(data);
    },
    enabled: !!id,
  });

  const { data: memberTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['occurrence-tasks', id],
    queryFn: async (): Promise<Task[]> => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_assignees(user_id)')
        .eq('occurrence_id', id)
        .order('created_at');
      if (error) throw error;
      return data.map((row) => mapTask(row));
    },
    enabled: !!id,
  });

  const { data: conversationId } = useQuery({
    queryKey: ['occurrence-conversation', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('task_conversations')
        .select('id')
        .eq('occurrence_id', id)
        .eq('type', 'occurrence')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    enabled: !!id,
  });

  const channelId = useRef(crypto.randomUUID()).current;
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`occurrence-${id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_occurrences', filter: `id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['occurrence', id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `occurrence_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['occurrence-tasks', id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, queryClient, channelId]);

  const cancelOccurrence = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No occurrence id');
      const { error } = await supabase
        .from('task_occurrences')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['occurrence', id] }),
  });

  // Four disjoint buckets summing to total — 'Completed' here means
  // "done by the assignee, awaiting director/officer review" (matches the
  // task lifecycle elsewhere in the app); only 'Archived' counts as
  // fully closed out.
  const progress = {
    total: memberTasks.length,
    completed: memberTasks.filter((t) => t.status === 'Archived').length,
    awaitingReview: memberTasks.filter((t) => t.status === 'Completed').length,
    inProgress: memberTasks.filter((t) => t.status === 'InProgress').length,
    notStarted: memberTasks.filter((t) => t.status === 'NotStarted').length,
  };

  return {
    occurrence,
    memberTasks,
    conversationId: conversationId ?? null,
    progress,
    isLoading: occurrenceLoading || tasksLoading,
    cancelOccurrence,
  };
}

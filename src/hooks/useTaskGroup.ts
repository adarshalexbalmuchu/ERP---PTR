import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapTaskGroup, mapTaskGroupMember, mapTaskOccurrence } from '../lib/mappers';
import { createGroupOccurrence } from '../lib/taskGroupsRpc';
import useStore from '../store/useStore';
import type { TaskCategory, TaskPriority } from '../types';

/** One Task Group's full detail surface: the group itself, its active
    roster, and its occurrences (past and current) — everything the
    Overview/Assignments/Members tabs need. Mirrors useTask(id)'s shape
    (one hook per detail page, own realtime channel, own mutations). */
export function useTaskGroup(id: string | undefined) {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['task-group', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('task_groups').select('*').eq('id', id).single();
      if (error) throw error;
      return mapTaskGroup(data);
    },
    enabled: !!id,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['task-group-members', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('task_group_members')
        .select('*')
        .eq('group_id', id)
        .eq('active', true)
        .order('joined_at');
      if (error) throw error;
      return data.map(mapTaskGroupMember);
    },
    enabled: !!id,
  });

  const { data: occurrences = [], isLoading: occurrencesLoading } = useQuery({
    queryKey: ['task-group-occurrences', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('task_occurrences')
        .select('*')
        .eq('group_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(mapTaskOccurrence);
    },
    enabled: !!id,
  });

  const { data: conversationId } = useQuery({
    queryKey: ['task-group-conversation', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('task_conversations')
        .select('id')
        .eq('group_id', id)
        .eq('type', 'group')
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
      .channel(`task-group-${id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_groups', filter: `id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['task-group', id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_group_members', filter: `group_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['task-group-members', id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_occurrences', filter: `group_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['task-group-occurrences', id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, queryClient, channelId]);

  const invalidateMembers = () => void queryClient.invalidateQueries({ queryKey: ['task-group-members', id] });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!id || !currentUser) throw new Error('No group id');
      const { error } = await supabase
        .from('task_group_members')
        .insert({ group_id: id, user_id: userId, added_by: currentUser.id });
      if (error) throw error;
    },
    onSuccess: invalidateMembers,
  });

  // Soft removal only — matches §21 of the spec: excluded from future
  // occurrences, existing tasks/messages stay exactly as they are. Never
  // a hard delete of the membership row (that would lose the join
  // history the Members tab shows).
  const removeMember = useMutation({
    mutationFn: async (memberRowId: string) => {
      const { error } = await supabase
        .from('task_group_members')
        .update({ active: false, removed_at: new Date().toISOString() })
        .eq('id', memberRowId);
      if (error) throw error;
    },
    onSuccess: invalidateMembers,
  });

  const setCoordinator = useMutation({
    mutationFn: async ({ memberRowId, isCoordinator }: { memberRowId: string; isCoordinator: boolean }) => {
      const { error } = await supabase
        .from('task_group_members')
        .update({ membership_role: isCoordinator ? 'coordinator' : 'member' })
        .eq('id', memberRowId);
      if (error) throw error;
    },
    onSuccess: invalidateMembers,
  });

  const createOneTimeAssignment = useMutation({
    mutationFn: async (data: {
      title: string; description?: string; category: TaskCategory; priority: TaskPriority; dueAt: string; rangeId: string;
    }) => {
      if (!id) throw new Error('No group id');
      return createGroupOccurrence({ groupId: id, ...data });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['task-group-occurrences', id] }),
  });

  return {
    group,
    members,
    occurrences,
    conversationId: conversationId ?? null,
    isLoading: groupLoading || membersLoading || occurrencesLoading,
    addMember,
    removeMember,
    setCoordinator,
    createOneTimeAssignment,
  };
}

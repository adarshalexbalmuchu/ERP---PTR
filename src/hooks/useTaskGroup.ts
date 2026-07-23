import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapTaskGroup, mapTaskGroupMember, mapTaskOccurrence, mapTaskSeries, recurrenceRuleToDb } from '../lib/mappers';
import { createGroupOccurrence } from '../lib/taskGroupsRpc';
import useStore from '../store/useStore';
import type { TaskCategory, TaskPriority, TaskSeriesRecurrence, TaskSeriesStatus, RecurrenceRule, TaskStatus } from '../types';

/** Recurring performance analytics — a per-series rollup of every task
    that series has ever generated. Computed client-side from the same
    `tasks` rows the Assignments/Overview tabs already read; no schema
    addition, no server-side aggregation function, since this is exactly
    the kind of read a Postgres index handles fine at this scale. */
export interface SeriesStats {
  total: number;
  completed: number;
  awaitingReview: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
}

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

  const { data: series = [], isLoading: seriesLoading } = useQuery({
    queryKey: ['task-group-series', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('task_series')
        .select('*')
        .eq('group_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(mapTaskSeries);
    },
    enabled: !!id,
  });

  const { data: seriesStats = {} } = useQuery({
    queryKey: ['task-group-series-stats', id],
    queryFn: async (): Promise<Record<string, SeriesStats>> => {
      if (!id) return {};
      const { data, error } = await supabase
        .from('tasks')
        .select('series_id, status')
        .eq('group_id', id)
        .not('series_id', 'is', null);
      if (error) throw error;
      const rows = data as unknown as { series_id: string; status: TaskStatus }[];
      const byStatus = rows.reduce<Record<string, TaskStatus[]>>((acc, r) => {
        (acc[r.series_id] ??= []).push(r.status);
        return acc;
      }, {});
      const out: Record<string, SeriesStats> = {};
      for (const [seriesId, statuses] of Object.entries(byStatus)) {
        const total = statuses.length;
        const completed = statuses.filter((s) => s === 'Archived').length;
        out[seriesId] = {
          total,
          completed,
          awaitingReview: statuses.filter((s) => s === 'Completed').length,
          inProgress: statuses.filter((s) => s === 'InProgress').length,
          notStarted: statuses.filter((s) => s === 'NotStarted').length,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      }
      return out;
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_series', filter: `group_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['task-group-series', id] });
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

  const invalidateSeries = () => void queryClient.invalidateQueries({ queryKey: ['task-group-series', id] });

  // Created as 'draft' — the caller activates it as a separate, explicit
  // step (matches the spec's "review members, THEN activate" workflow;
  // also gives a director a chance to fix a mistake before the scheduler
  // ever sees it, since generate_due_task_occurrences() only looks at
  // status='active' series).
  const createSeries = useMutation({
    mutationFn: async (data: {
      title: string; description?: string; category: TaskCategory; priority: TaskPriority;
      evidenceRequirements?: string; recurrenceType: TaskSeriesRecurrence; recurrenceRule: RecurrenceRule;
      startDate: string; endDate?: string; creationTime: string; dueOffsetDays: number; rangeId: string;
    }) => {
      if (!id || !currentUser) throw new Error('No group id');
      const { error } = await supabase.from('task_series').insert({
        group_id: id,
        title: data.title.trim(),
        description: data.description?.trim() ?? '',
        category: data.category,
        priority: data.priority,
        evidence_requirements: data.evidenceRequirements?.trim() ?? '',
        recurrence_type: data.recurrenceType,
        recurrence_rule: recurrenceRuleToDb(data.recurrenceRule),
        start_date: data.startDate,
        end_date: data.endDate ?? null,
        creation_time: data.creationTime,
        due_offset_days: data.dueOffsetDays,
        status: 'draft',
        created_by: currentUser.id,
        range_id: data.rangeId,
      });
      if (error) throw error;
    },
    onSuccess: invalidateSeries,
  });

  const setSeriesStatus = useMutation({
    mutationFn: async ({ seriesId, status }: { seriesId: string; status: TaskSeriesStatus }) => {
      const { error } = await supabase.from('task_series').update({ status }).eq('id', seriesId);
      if (error) throw error;
    },
    onSuccess: invalidateSeries,
  });

  return {
    group,
    members,
    occurrences,
    series,
    seriesStats,
    conversationId: conversationId ?? null,
    isLoading: groupLoading || membersLoading || occurrencesLoading || seriesLoading,
    addMember,
    removeMember,
    setCoordinator,
    createOneTimeAssignment,
    createSeries,
    setSeriesStatus,
  };
}

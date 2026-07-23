import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapTaskGroup } from '../lib/mappers';
import useStore from '../store/useStore';
import type { Database } from '../lib/database.types';
import type { TaskGroup, TaskGroupType, TaskGroupStatus } from '../types';

// supabase-js's embed-type inference can't resolve task_group_members(...)/
// task_occurrences(...) against this project's hand-written
// database.types.ts (Relationships is a generic shape, not real per-table
// FK metadata — see the comment above it in database.types.ts), so the
// query's inferred row type collapses those embedded fields to `never`.
// An explicit cast through the real shape (same fix pattern as the other
// hand-rolled RPC shims in this codebase) sidesteps that instead of fighting it.
type GroupListRow = Database['public']['Tables']['task_groups']['Row'] & {
  task_group_members: { active: boolean }[];
  task_occurrences: { status: string }[];
};

/** The Task Groups list — every group the signed-in user can see (RLS
    already scopes this: director sees all, an officer sees their range's
    groups, a member sees only groups they belong to). Member/occurrence
    counts are computed client-side from the embedded rows rather than a
    view — cheap at this scale, and avoids a DB view just for a list page. */
export function useTaskGroups() {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['task-groups'],
    queryFn: async (): Promise<TaskGroup[]> => {
      const { data, error } = await supabase
        .from('task_groups')
        .select('*, task_group_members(active), task_occurrences(status)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as GroupListRow[]).map((row) => mapTaskGroup({
        ...row,
        member_count: row.task_group_members.filter((m) => m.active).length,
        active_occurrence_count: row.task_occurrences.filter((o) => o.status === 'scheduled' || o.status === 'active').length,
      }));
    },
  });

  const channelId = useRef(crypto.randomUUID()).current;
  useEffect(() => {
    const channel = supabase
      .channel(`task-groups-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_groups' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['task-groups'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_group_members' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['task-groups'] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, channelId]);

  const createGroup = useMutation({
    mutationFn: async (data: {
      name: string; description?: string; groupType: TaskGroupType; rangeId?: string; membersCanReply?: boolean;
    }) => {
      if (!currentUser) throw new Error('Not authenticated');
      const { data: row, error } = await supabase
        .from('task_groups')
        .insert({
          name: data.name.trim(),
          description: data.description?.trim() ?? '',
          group_type: data.groupType,
          range_id: data.rangeId ?? null,
          created_by: currentUser.id,
          members_can_reply: data.membersCanReply ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      // Every group gets its one announcement conversation up front (not
      // lazily on first post) — the Discussion tab always has somewhere
      // to read from/post into, and task_conversations_group_uq already
      // guarantees at most one exists per group either way.
      const { error: convErr } = await supabase.from('task_conversations').insert({ type: 'group', group_id: row.id });
      if (convErr) throw convErr;
      return mapTaskGroup(row);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['task-groups'] }),
  });

  const setGroupStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskGroupStatus }) => {
      const patch: { status: TaskGroupStatus; archived_at?: string } = { status };
      if (status === 'archived') patch.archived_at = new Date().toISOString();
      const { error } = await supabase.from('task_groups').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['task-groups'] }),
  });

  return { groups, isLoading, createGroup, setGroupStatus };
}

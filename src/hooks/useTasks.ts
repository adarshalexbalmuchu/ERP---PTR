import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database, NotificationType } from '../lib/database.types';
import { mapTask } from '../lib/mappers';
import { logTaskChanges, logTaskDeletion } from '../lib/audit';
import { formatDate } from '../utils/formatters';
import useStore from '../store/useStore';
import type { Task } from '../types';

type CreateTaskData = Omit<Task, 'id' | 'createdAt' | 'comments' | 'attachments' | 'taskUpdates'>;

// One batched insert instead of a round-trip per recipient. Best-effort:
// the task mutation the user cares about has already succeeded by the time
// notifications are written, so a failure here is logged, not thrown.
async function insertNotifications(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  taskId: string,
) {
  if (userIds.length === 0) return;
  const { error } = await supabase.from('notifications').insert(
    userIds.map((userId) => ({ user_id: userId, type, title, message, task_id: taskId })),
  );
  if (error) console.error('notification insert failed', error);
}

export function useTasks() {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_assignees(user_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((t) => mapTask(t));
    },
  });

  // Realtime subscription — unique topic per mount avoids reusing a channel
  // that's still mid-teardown from a previous mount (removeChannel is async).
  const channelId = useRef(crypto.randomUUID()).current;
  useEffect(() => {
    const channel = supabase
      .channel(`tasks-list-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, channelId]);

  const createTask = useMutation({
    mutationFn: async (data: CreateTaskData) => {
      if (!currentUser) throw new Error('Not authenticated');
      // range_id is NOT NULL in the schema; an empty string here would reach
      // Postgres as an invalid UUID (22P02). The form guards this, but fail
      // with a clear message rather than a raw driver error if it slips through.
      if (!data.rangeId) throw new Error('A range is required for this task.');

      // Picking several people in the assignee field is a bulk-create
      // shortcut, NOT a shared/collaborative assignment — each selected
      // person gets their OWN independent task row (own status, own
      // progress, own completion), all seeded from the same title/
      // description/due date/etc. for speed. This intentionally does not
      // touch task_assignees (that table backs a separate "add a
      // collaborator to one existing task" feature on the task detail
      // page, left as-is).
      const assigneeIds = [...new Set([data.assigneeId, ...data.coAssigneeIds])];
      // Shared across every row spawned from this one submission so the
      // task list can still group them into a single card — null when
      // there's only one assignee, so a normal single-assignee task never
      // gets lumped in with anything else.
      const batchId = assigneeIds.length > 1 ? crypto.randomUUID() : null;

      const rows = await Promise.all(
        assigneeIds.map(async (assigneeId) => {
          const { data: row, error } = await supabase
            .from('tasks')
            .insert({
              title: data.title,
              description: data.description,
              assignee_id: assigneeId,
              created_by_id: currentUser.id,
              range_id: data.rangeId,
              area_id: data.areaId ?? null,
              status: 'NotStarted',
              priority: data.priority,
              category: data.category,
              category_other: data.category === 'Other' ? (data.categoryOther?.trim() || null) : null,
              due_date: data.dueDate,
              batch_id: batchId,
              completion_percentage: 0,
            })
            .select()
            .single();
          if (error) throw error;
          return row;
        }),
      );

      // Notify each assignee about THEIR OWN task (except whoever created it).
      await Promise.all(
        rows
          .filter((row) => row.assignee_id !== currentUser.id)
          .map((row) =>
            insertNotifications(
              [row.assignee_id],
              'task_assigned',
              `New Task: ${data.priority} Priority`,
              `${currentUser.name} assigned you "${data.title}" · Due ${formatDate(data.dueDate)}`,
              row.id,
            ),
          ),
      );

      return rows;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateTaskData>) => {
      const before = tasks.find((t) => t.id === id);
      const patch: Database['public']['Tables']['tasks']['Update'] = {};
      if (data.title !== undefined) patch.title = data.title;
      if (data.description !== undefined) patch.description = data.description;
      if (data.assigneeId !== undefined) patch.assignee_id = data.assigneeId;
      // Truthy check, not `!== undefined`: range_id is NOT NULL, so an empty
      // string must never reach the patch (it'd be an invalid UUID).
      if (data.rangeId) patch.range_id = data.rangeId;
      if (data.areaId !== undefined) patch.area_id = data.areaId ?? null;
      if (data.priority !== undefined) patch.priority = data.priority;
      if (data.category !== undefined) {
        patch.category = data.category;
        patch.category_other = data.category === 'Other' ? (data.categoryOther?.trim() || null) : null;
      }
      if (data.dueDate !== undefined) patch.due_date = data.dueDate;
      if (data.status !== undefined) patch.status = data.status;
      if (data.completionPercentage !== undefined) patch.completion_percentage = data.completionPercentage;

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from('tasks').update(patch).eq('id', id);
        if (error) throw error;
      }

      // Replace the co-assignee roster wholesale — simplest correct way to
      // reconcile an arbitrary add/remove set from the multi-select picker.
      let newCoAssignees: string[] = [];
      if (data.coAssigneeIds !== undefined) {
        const { error: delErr } = await supabase.from('task_assignees').delete().eq('task_id', id);
        if (delErr) throw delErr;
        const assigneeId = data.assigneeId ?? before?.assigneeId;
        const coAssigneeIds = [...new Set(data.coAssigneeIds)].filter((uid) => uid !== assigneeId);
        if (coAssigneeIds.length > 0) {
          const { error: insErr } = await supabase
            .from('task_assignees')
            .insert(coAssigneeIds.map((userId) => ({ task_id: id, user_id: userId })));
          if (insErr) throw insErr;
        }
        newCoAssignees = coAssigneeIds.filter((uid) => !before?.coAssigneeIds.includes(uid));
      }

      // Reassigning the primary assignee or adding a co-assignee previously
      // sent nothing — the person only found out by stumbling onto the task
      // later. Notify whoever is newly on the hook for it.
      if (before && currentUser) {
        const newAssignee =
          data.assigneeId !== undefined && data.assigneeId !== before.assigneeId ? data.assigneeId : null;
        const recipients = [...new Set([...(newAssignee ? [newAssignee] : []), ...newCoAssignees])]
          .filter((userId) => userId !== currentUser.id);
        if (recipients.length > 0) {
          await insertNotifications(
            recipients,
            'task_assigned',
            'Task Assigned To You',
            `${currentUser.name} assigned you "${data.title ?? before.title}" · Due ${formatDate(data.dueDate ?? before.dueDate)}`,
            id,
          );
        }
      }

      if (before && currentUser) await logTaskChanges(before, data, currentUser.id);
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['task', vars.id] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const before = tasks.find((t) => t.id === taskId);
      if (before && currentUser) await logTaskDeletion(before, currentUser.id);
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return { tasks, isLoading, createTask, updateTask, deleteTask };
}

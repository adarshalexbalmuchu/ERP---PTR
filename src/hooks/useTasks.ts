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

async function insertNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  taskId: string,
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    task_id: taskId,
  });
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
      const { data: row, error } = await supabase
        .from('tasks')
        .insert({
          title: data.title,
          description: data.description,
          assignee_id: data.assigneeId,
          created_by_id: currentUser.id,
          range_id: data.rangeId,
          area_id: data.areaId ?? null,
          status: 'NotStarted',
          priority: data.priority,
          category: data.category,
          due_date: data.dueDate,
          completion_percentage: 0,
        })
        .select()
        .single();
      if (error) throw error;

      // De-duplicate: the primary assignee already has the row above, so
      // task_assignees only needs anyone *additional*.
      const coAssigneeIds = [...new Set(data.coAssigneeIds)].filter((id) => id !== data.assigneeId);
      if (coAssigneeIds.length > 0) {
        const { error: coErr } = await supabase
          .from('task_assignees')
          .insert(coAssigneeIds.map((userId) => ({ task_id: row.id, user_id: userId })));
        if (coErr) throw coErr;
      }

      // Notify every assignee (primary + co-assignees) except whoever created it.
      const allAssigneeIds = [...new Set([data.assigneeId, ...coAssigneeIds])];
      for (const userId of allAssigneeIds) {
        if (userId === currentUser.id) continue;
        await insertNotification(
          userId,
          'task_assigned',
          `New Task: ${data.priority} Priority`,
          `${currentUser.name} assigned you "${data.title}" · Due ${formatDate(data.dueDate)}`,
          row.id,
        );
      }
      return row;
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
      if (data.rangeId !== undefined) patch.range_id = data.rangeId;
      if (data.areaId !== undefined) patch.area_id = data.areaId ?? null;
      if (data.priority !== undefined) patch.priority = data.priority;
      if (data.category !== undefined) patch.category = data.category;
      if (data.dueDate !== undefined) patch.due_date = data.dueDate;
      if (data.status !== undefined) patch.status = data.status;
      if (data.completionPercentage !== undefined) patch.completion_percentage = data.completionPercentage;

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from('tasks').update(patch).eq('id', id);
        if (error) throw error;
      }

      // Replace the co-assignee roster wholesale — simplest correct way to
      // reconcile an arbitrary add/remove set from the multi-select picker.
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

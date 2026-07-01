import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database, NotificationType } from '../lib/database.types';
import { mapTask } from '../lib/mappers';
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
        .select('*')
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
  }, [queryClient]);

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

      // Notify the assignee if different from creator
      if (data.assigneeId !== currentUser.id) {
        await insertNotification(
          data.assigneeId,
          'task_assigned',
          'New Task Assigned',
          `You have been assigned: ${data.title}`,
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

      const { error } = await supabase.from('tasks').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['task', vars.id] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return { tasks, isLoading, createTask, updateTask, deleteTask };
}

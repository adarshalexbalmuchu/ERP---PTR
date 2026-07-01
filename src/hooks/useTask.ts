import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database, NotificationType } from '../lib/database.types';
import { mapTask, mapComment, mapTaskUpdate, mapAttachment } from '../lib/mappers';
import useStore from '../store/useStore';
import type { Task } from '../types';

type CreateTaskData = Omit<Task, 'id' | 'createdAt' | 'comments' | 'attachments' | 'taskUpdates'>;

const ATTACHMENT_URL_TTL_SECONDS = 3600;

// attachments.url stores a bare storage path (the bucket is private); this
// swaps in a time-limited signed URL before the task reaches the UI.
async function resolveAttachmentUrls(task: Task): Promise<Task> {
  if (task.attachments.length === 0) return task;
  const paths = task.attachments.map((a) => a.path);
  const { data } = await supabase.storage
    .from('task-attachments')
    .createSignedUrls(paths, ATTACHMENT_URL_TTL_SECONDS);
  const signedByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return {
    ...task,
    attachments: task.attachments.map((a) => {
      const signedUrl = signedByPath.get(a.path) ?? a.url;
      return {
        ...a,
        url: signedUrl,
        previewUrl: a.type.startsWith('image/') ? signedUrl : undefined,
      };
    }),
  };
}

export function useTask(id: string | undefined) {
  const queryClient = useQueryClient();
  const currentUser = useStore((s) => s.currentUser);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: async (): Promise<Task | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_updates(*), comments(*), attachments(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return resolveAttachmentUrls(mapTask(data));
    },
    enabled: !!id,
  });

  // Realtime subscription for this specific task — unique topic per mount
  // avoids reusing a channel still mid-teardown from a previous mount.
  const channelId = useRef(crypto.randomUUID()).current;
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`task-${id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['task', id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `task_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['task', id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_updates', filter: `task_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['task', id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, queryClient]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['task', id] });
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const updateTask = useMutation({
    mutationFn: async (data: Partial<CreateTaskData>) => {
      if (!id) throw new Error('No task id');
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
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No task id');
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const startTask = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No task id');
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'InProgress', acknowledged_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const completeTask = useMutation({
    mutationFn: async () => {
      if (!id || !currentUser || !task) throw new Error('No task id');
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'Completed', completed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      // Notify creator/officers
      if (task.createdById !== currentUser.id) {
        await supabase.from('notifications').insert({
          user_id: task.createdById,
          type: 'task_completed' as NotificationType,
          title: 'Task Completed',
          message: `${currentUser.name} marked "${task.title}" as done`,
          task_id: id,
        });
      }
    },
    onSuccess: invalidate,
  });

  const archiveTask = useMutation({
    mutationFn: async () => {
      if (!id || !task) throw new Error('No task id');
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'Archived', archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      // Notify assignee
      await supabase.from('notifications').insert({
        user_id: task.assigneeId,
        type: 'task_archived' as NotificationType,
        title: 'Task Archived',
        message: `"${task.title}" has been approved and archived`,
        task_id: id,
      });
    },
    onSuccess: invalidate,
  });

  const requestChanges = useMutation({
    mutationFn: async (note: string) => {
      if (!id || !currentUser || !task) throw new Error('No task id');
      const { error: taskErr } = await supabase
        .from('tasks')
        .update({ status: 'InProgress' })
        .eq('id', id);
      if (taskErr) throw taskErr;

      const commentContent = note
        ? `[Changes Requested] ${note}`
        : '[Changes Requested] Please revise and resubmit.';
      const { error: commentErr } = await supabase.from('comments').insert({
        task_id: id,
        user_id: currentUser.id,
        content: commentContent,
      });
      if (commentErr) throw commentErr;

      await supabase.from('notifications').insert({
        user_id: task.assigneeId,
        type: 'changes_requested' as NotificationType,
        title: 'Changes Requested',
        message: `Revisions needed for "${task.title}"`,
        task_id: id,
      });
    },
    onSuccess: invalidate,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!id || !currentUser) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('comments')
        .insert({ task_id: id, user_id: currentUser.id, content })
        .select()
        .single();
      if (error) throw error;
      return mapComment(data);
    },
    onSuccess: invalidate,
  });

  const addTaskUpdate = useMutation({
    mutationFn: async ({ note, progressPercentage }: { note: string; progressPercentage: number }) => {
      if (!id || !currentUser) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('task_updates')
        .insert({ task_id: id, user_id: currentUser.id, note, progress_percentage: progressPercentage })
        .select()
        .single();
      if (error) throw error;
      // Also update the task completion_percentage
      await supabase.from('tasks').update({ completion_percentage: progressPercentage }).eq('id', id);
      return mapTaskUpdate(data);
    },
    onSuccess: invalidate,
  });

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      if (!id || !currentUser) throw new Error('Not authenticated');
      const path = `${id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('task-attachments')
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      // Store the bare storage path — the bucket is private, so viewing
      // requires a signed URL generated on demand (see resolveAttachmentUrls).
      const { data, error } = await supabase
        .from('attachments')
        .insert({
          task_id: id,
          user_id: currentUser.id,
          name: file.name,
          url: path,
          size: file.size,
          mime_type: file.type,
        })
        .select()
        .single();
      if (error) throw error;
      return mapAttachment(data);
    },
    onSuccess: invalidate,
  });

  const removeAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      const att = task?.attachments.find((a) => a.id === attachmentId);
      const { error } = await supabase.from('attachments').delete().eq('id', attachmentId);
      if (error) throw error;
      // Attempt to remove from storage (non-fatal if it fails)
      if (att?.path) {
        await supabase.storage.from('task-attachments').remove([att.path]);
      }
    },
    onSuccess: invalidate,
  });

  return {
    task: task ?? null,
    isLoading,
    updateTask,
    deleteTask,
    startTask,
    completeTask,
    archiveTask,
    requestChanges,
    addComment,
    addTaskUpdate,
    uploadAttachment,
    removeAttachment,
  };
}

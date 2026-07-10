import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database, NotificationType } from '../lib/database.types';
import { mapTask, mapComment, mapTaskUpdate } from '../lib/mappers';
import { uploadTaskAttachment } from '../lib/attachments';
import { getCurrentPosition } from '../utils/geolocation';
import { logTaskAction, logTaskChanges, logTaskDeletion } from '../lib/audit';
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
        .select('*, task_updates(*), comments(*), attachments(*), task_assignees(user_id)')
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
  }, [id, queryClient, channelId]);

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

      if (data.coAssigneeIds !== undefined) {
        const { error: delErr } = await supabase.from('task_assignees').delete().eq('task_id', id);
        if (delErr) throw delErr;
        const assigneeId = data.assigneeId ?? task?.assigneeId;
        const coAssigneeIds = [...new Set(data.coAssigneeIds)].filter((uid) => uid !== assigneeId);
        if (coAssigneeIds.length > 0) {
          const { error: insErr } = await supabase
            .from('task_assignees')
            .insert(coAssigneeIds.map((userId) => ({ task_id: id, user_id: userId })));
          if (insErr) throw insErr;
        }
      }

      if (task && currentUser) await logTaskChanges(task, data, currentUser.id);
    },
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No task id');
      if (task && currentUser) await logTaskDeletion(task, currentUser.id);
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const startTask = useMutation({
    mutationFn: async () => {
      if (!id || !task || !currentUser) throw new Error('No task id');
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'InProgress', acknowledged_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await logTaskAction(task, currentUser.id, 'status', 'Acknowledged & started');
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
      // Notify creator/officers (best-effort — the completion itself
      // already succeeded, so log rather than fail the mutation).
      if (task.createdById !== currentUser.id) {
        const { error: notifyErr } = await supabase.from('notifications').insert({
          user_id: task.createdById,
          type: 'task_completed' as NotificationType,
          title: 'Task Completed',
          message: `${currentUser.name} marked "${task.title}" as done · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
          task_id: id,
        });
        if (notifyErr) console.error('notification insert failed', notifyErr);
      }
      await logTaskAction(task, currentUser.id, 'status', 'Marked as done');
    },
    onSuccess: invalidate,
  });

  const archiveTask = useMutation({
    mutationFn: async () => {
      if (!id || !task || !currentUser) throw new Error('No task id');
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'Archived', archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      // Notify every assignee (primary + co-assignees, deduped, minus the
      // actor) in one batched insert instead of a round-trip per person.
      const archiveRecipients = [...new Set([task.assigneeId, ...task.coAssigneeIds])]
        .filter((userId) => userId !== currentUser.id);
      if (archiveRecipients.length > 0) {
        const { error: notifyErr } = await supabase.from('notifications').insert(
          archiveRecipients.map((userId) => ({
            user_id: userId,
            type: 'task_archived' as NotificationType,
            title: 'Task Archived',
            message: `${currentUser.name} approved and archived "${task.title}"`,
            task_id: id,
          })),
        );
        if (notifyErr) console.error('notification insert failed', notifyErr);
      }
      await logTaskAction(task, currentUser.id, 'status', 'Archived (approved)');
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

      // Notify every assignee (primary + co-assignees, deduped, minus the
      // actor) — include the actual revision note so the push/bell alone
      // tells them what to fix, without needing to open the task first.
      const reviseRecipients = [...new Set([task.assigneeId, ...task.coAssigneeIds])]
        .filter((userId) => userId !== currentUser.id);
      if (reviseRecipients.length > 0) {
        const { error: notifyErr } = await supabase.from('notifications').insert(
          reviseRecipients.map((userId) => ({
            user_id: userId,
            type: 'changes_requested' as NotificationType,
            title: `Changes Requested by ${currentUser.name}`,
            message: note ? `"${task.title}": ${note}` : `Please revise "${task.title}" and resubmit.`,
            task_id: id,
          })),
        );
        if (notifyErr) console.error('notification insert failed', notifyErr);
      }
      await logTaskAction(task, currentUser.id, 'status', `Changes requested${note ? `: ${note}` : ''}`);
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
      // Geotag the field entry (M-STrIPES style patrol log); silently
      // omitted if location is denied/unavailable, never blocks the update.
      const { coords } = await getCurrentPosition();
      const { data, error } = await supabase
        .from('task_updates')
        .insert({
          task_id: id,
          user_id: currentUser.id,
          note,
          progress_percentage: progressPercentage,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      // Also update the task completion_percentage — surfacing the error
      // matters here: silently dropping it would leave the task card's
      // progress out of sync with the update the guard just logged.
      const { error: progressErr } = await supabase
        .from('tasks')
        .update({ completion_percentage: progressPercentage })
        .eq('id', id);
      if (progressErr) throw progressErr;
      return mapTaskUpdate(data);
    },
    onSuccess: invalidate,
  });

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      if (!id || !currentUser) throw new Error('Not authenticated');
      await uploadTaskAttachment(id, currentUser.id, file);
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

import { supabase } from './supabase';
import type { Task } from '../types';

async function logAudit(params: {
  taskId: string;
  taskTitle: string;
  rangeId: string;
  actorId: string;
  action: string;
  detail: string;
}) {
  // Best-effort — a logging failure should never block the underlying
  // task mutation the user actually cares about.
  await supabase.from('audit_log').insert({
    task_id: params.taskId,
    task_title: params.taskTitle,
    range_id: params.rangeId,
    actor_id: params.actorId,
    action: params.action,
    detail: params.detail,
  }).then(({ error }) => {
    if (error) console.error('audit log insert failed', error);
  });
}

export async function logTaskAction(task: Task, actorId: string, action: string, detail: string) {
  await logAudit({ taskId: task.id, taskTitle: task.title, rangeId: task.rangeId, actorId, action, detail });
}

// Compares a patch against the task's current state and logs only the
// fields that actually change (reassignment, status, priority, due date).
export async function logTaskChanges(
  before: Task,
  patch: Partial<Pick<Task, 'assigneeId' | 'status' | 'priority' | 'dueDate'>>,
  actorId: string,
) {
  const entries: string[] = [];
  if (patch.assigneeId !== undefined && patch.assigneeId !== before.assigneeId) {
    entries.push('Reassigned');
  }
  if (patch.status !== undefined && patch.status !== before.status) {
    entries.push(`Status: ${before.status} → ${patch.status}`);
  }
  if (patch.priority !== undefined && patch.priority !== before.priority) {
    entries.push(`Priority: ${before.priority} → ${patch.priority}`);
  }
  if (patch.dueDate !== undefined && patch.dueDate !== before.dueDate) {
    entries.push('Due date changed');
  }
  if (entries.length === 0) return;
  await logTaskAction(before, actorId, 'update', entries.join('; '));
}

export async function logTaskDeletion(task: Task, actorId: string) {
  await logTaskAction(task, actorId, 'delete', `Task "${task.title}" deleted`);
}

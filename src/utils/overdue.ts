import type { Task } from '../types';

export function isOverdue(task: Task): boolean {
  if (task.status === 'Done' || task.status === 'Approved') return false;
  const due = new Date(task.dueDate);
  const now = new Date();
  // Compare date only (strip time)
  due.setHours(23, 59, 59, 999);
  return due < now;
}

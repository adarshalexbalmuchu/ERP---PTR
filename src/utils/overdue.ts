import type { Task } from '../types';

export function isOverdue(task: Task): boolean {
  if (task.status === 'Completed' || task.status === 'Archived') return false;
  const due = new Date(task.dueDate);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}

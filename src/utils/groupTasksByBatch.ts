import type { Task } from '../types';

export interface TaskGroup {
  /** task.batchId for a multi-assignee batch, otherwise the single task's own id. */
  key: string;
  tasks: Task[];
}

// Tasks created from one "assign to several people" submission share a
// batchId but are otherwise fully independent rows (own status/progress).
// Groups the already-filtered list back into one entry per batch (or per
// standalone task) so the task list can render them as a single card while
// each row inside still tracks/acts on its own task id. Order follows the
// order batchmates first appear in `tasks` (already created_at desc).
export function groupTasksByBatch(tasks: Task[]): TaskGroup[] {
  const groups: TaskGroup[] = [];
  const byBatch = new Map<string, TaskGroup>();
  for (const task of tasks) {
    if (task.batchId) {
      let group = byBatch.get(task.batchId);
      if (!group) {
        group = { key: task.batchId, tasks: [] };
        byBatch.set(task.batchId, group);
        groups.push(group);
      }
      group.tasks.push(task);
    } else {
      groups.push({ key: task.id, tasks: [task] });
    }
  }
  return groups;
}

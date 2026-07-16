import StatusBadge from '../StatusBadge';
import PriorityBadge from '../PriorityBadge';
import { formatDate, formatDueRelative } from '../../utils/formatters';
import { isOverdue } from '../../utils/overdue';
import type { Task } from '../../types';

export default function MobileTaskCard({
  task,
  locationLabel,
  assigneeName,
  onClick,
}: {
  task: Task;
  /** "Betla Range · Beat 4" style line — range name, plus area/beat when known. */
  locationLabel: string;
  assigneeName?: string;
  onClick: () => void;
}) {
  const done = task.status === 'Completed' || task.status === 'Archived';
  const due = formatDueRelative(task.dueDate, done);
  const overdue = isOverdue(task);
  const dueClass = due.tone === 'overdue' ? 'text-signal-red font-semibold' : due.tone === 'soon' ? 'text-signal-amber font-medium' : 'text-n-80';

  // Hierarchy: title, then range/assignee, then a single compact metadata
  // line (status · priority, due state right-aligned). Priority no longer
  // gets its own bold row — most tasks are High, so repeating that in a
  // loud standalone label added noise without adding information; the
  // shared PriorityBadge already reserves bold/red for Critical only.
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 border-b border-n-20 last:border-0 active:bg-n-10 transition-colors ${overdue ? 'bg-signal-red-bg/40' : 'bg-white'}`}
    >
      <div className="text-[15px] font-semibold text-n-100 leading-snug">{task.title}</div>
      <div className="text-13 text-n-80 mt-0.5 truncate">{locationLabel}{assigneeName ? ` · ${assigneeName}` : ''}</div>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <span className="flex items-center gap-2 min-w-0">
          <StatusBadge status={task.status} size="sm" />
          <PriorityBadge priority={task.priority} size="sm" />
        </span>
        <span className={`text-13 flex-shrink-0 ${dueClass}`}>{due.text || (done ? formatDate(task.dueDate) : `Due ${formatDate(task.dueDate)}`)}</span>
      </div>
    </button>
  );
}

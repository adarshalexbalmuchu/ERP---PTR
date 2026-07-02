import type { TaskStatus } from '../types';

interface Props {
  status: TaskStatus;
  size?: 'sm' | 'md';
}

// A neutral pill with a small status dot rather than a fully-colored
// background — keeps the palette calm while still color-coding at a
// glance. Only genuinely urgent states (handled by the separate
// "Overdue" flag elsewhere) get a loud color.
const CONFIG: Record<TaskStatus, { label: string; dot: string }> = {
  NotStarted: { label: 'Not Started', dot: 'bg-status-notstarted' },
  InProgress: { label: 'In Progress', dot: 'bg-status-progress' },
  Completed: { label: 'Completed', dot: 'bg-status-completed' },
  Archived: { label: 'Archived', dot: 'bg-status-archived' },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const config = CONFIG[status];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap bg-white border border-ptr-cream-dark text-ptr-brown ${sizeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
}

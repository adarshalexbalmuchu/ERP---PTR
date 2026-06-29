import type { TaskStatus } from '../types';

interface Props {
  status: TaskStatus;
  size?: 'sm' | 'md';
}

const CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  NotStarted: {
    label: 'Not Started',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
  InProgress: {
    label: 'In Progress',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  Completed: {
    label: 'Completed',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  Archived: {
    label: 'Archived',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const config = CONFIG[status];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full whitespace-nowrap ${config.className} ${sizeClass}`}
    >
      {config.label}
    </span>
  );
}

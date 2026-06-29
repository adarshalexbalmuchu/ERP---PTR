import type { TaskPriority } from '../types';

interface Props {
  priority: TaskPriority;
  size?: 'sm' | 'md';
}

const CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  Low: {
    label: 'Low',
    className: 'bg-gray-50 text-gray-500 border border-gray-200',
  },
  Medium: {
    label: 'Medium',
    className: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  },
  High: {
    label: 'High',
    className: 'bg-orange-50 text-orange-700 border border-orange-200',
  },
  Critical: {
    label: 'Critical',
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
};

export default function PriorityBadge({ priority, size = 'md' }: Props) {
  const config = CONFIG[priority];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full whitespace-nowrap ${config.className} ${sizeClass}`}
    >
      {config.label}
    </span>
  );
}

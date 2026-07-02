import type { TaskPriority } from '../types';

interface Props {
  priority: TaskPriority;
  size?: 'sm' | 'md';
}

// Neutral dot-indicator pills for Low/Medium/High, matching StatusBadge.
// Critical is the sole exception — a filled red pill, since it's the one
// state that genuinely needs to interrupt scanning (field safety).
const CONFIG: Record<TaskPriority, { label: string; className: string; dot?: string }> = {
  Low: {
    label: 'Low',
    className: 'bg-white border border-ptr-cream-dark text-ptr-brown',
    dot: 'bg-status-notstarted',
  },
  Medium: {
    label: 'Medium',
    className: 'bg-white border border-ptr-cream-dark text-ptr-brown',
    dot: 'bg-ptr-brown-light',
  },
  High: {
    label: 'High',
    className: 'bg-white border border-ptr-cream-dark text-ptr-brown',
    dot: 'bg-status-progress',
  },
  Critical: {
    label: 'Critical',
    className: 'bg-red-50 border border-red-200 text-red-700',
  },
};

export default function PriorityBadge({ priority, size = 'md' }: Props) {
  const config = CONFIG[priority];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap ${config.className} ${sizeClass}`}
    >
      {config.dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />}
      {config.label}
    </span>
  );
}

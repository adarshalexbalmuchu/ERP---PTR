import type { TaskPriority } from '../types';

interface Props {
  priority: TaskPriority;
  size?: 'sm' | 'md';
}

// Dot + plain label, matching StatusBadge. Critical is the one priority that
// turns red — the state that genuinely needs to interrupt scanning.
const CONFIG: Record<TaskPriority, { label: string; dot: string; text: string }> = {
  Low: { label: 'Low', dot: 'bg-n-50', text: 'text-n-80' },
  Medium: { label: 'Medium', dot: 'bg-n-70', text: 'text-n-90' },
  High: { label: 'High', dot: 'bg-signal-amber', text: 'text-n-90' },
  Critical: { label: 'Critical', dot: 'bg-signal-red', text: 'text-signal-red font-semibold' },
};

export default function PriorityBadge({ priority, size = 'md' }: Props) {
  const config = CONFIG[priority] ?? { label: String(priority ?? '—'), dot: 'bg-n-50', text: 'text-n-80' };
  const text = size === 'sm' ? 'text-xs' : 'text-13';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${config.text} ${text}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
}

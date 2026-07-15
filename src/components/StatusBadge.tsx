import type { TaskStatus } from '../types';

interface Props {
  status: TaskStatus;
  size?: 'sm' | 'md';
}

// A small status dot + plain label — no pill, no border. Colour is a quiet
// cue; the label carries the meaning. Only overdue (handled separately) is
// ever loud.
const CONFIG: Record<TaskStatus, { label: string; dot: string }> = {
  NotStarted: { label: 'Not started', dot: 'bg-n-60' },
  InProgress: { label: 'In progress', dot: 'bg-signal-amber' },
  Completed: { label: 'Completed', dot: 'bg-signal-green' },
  Archived: { label: 'Archived', dot: 'bg-n-50' },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const config = CONFIG[status] ?? { label: String(status ?? '—'), dot: 'bg-n-50' };
  const text = size === 'sm' ? 'text-xs' : 'text-13';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-n-90 ${text}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
}

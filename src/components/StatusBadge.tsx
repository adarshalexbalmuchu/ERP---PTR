import { Circle, CircleDashed, CheckCircle2, Archive, type LucideIcon } from 'lucide-react';
import type { TaskStatus } from '../types';

interface Props {
  status: TaskStatus;
  size?: 'sm' | 'md';
}

// Status is carried by an icon + label, never colour alone (accessibility).
// Colour is a secondary cue and stays quiet except where it matters.
const CONFIG: Record<TaskStatus, { label: string; Icon: LucideIcon; cls: string }> = {
  NotStarted: { label: 'Not started', Icon: Circle, cls: 'text-n-60' },
  InProgress: { label: 'In progress', Icon: CircleDashed, cls: 'text-signal-amber' },
  Completed: { label: 'Completed', Icon: CheckCircle2, cls: 'text-signal-green' },
  Archived: { label: 'Archived', Icon: Archive, cls: 'text-n-60' },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const config = CONFIG[status] ?? { label: String(status ?? '—'), Icon: Circle, cls: 'text-n-60' };
  const { Icon } = config;
  const text = size === 'sm' ? 'text-xs' : 'text-13';
  const ic = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-n-90 ${text}`}>
      <Icon className={`${ic} flex-shrink-0 ${config.cls}`} />
      {config.label}
    </span>
  );
}

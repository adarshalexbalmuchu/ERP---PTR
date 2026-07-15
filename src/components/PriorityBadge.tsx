import { AlertTriangle, ChevronUp, Minus, ChevronDown, type LucideIcon } from 'lucide-react';
import type { TaskPriority } from '../types';

interface Props {
  priority: TaskPriority;
  size?: 'sm' | 'md';
}

// Priority is carried by an icon shape + label (not colour alone): Critical
// alerts in red, High points up in amber, Medium is neutral, Low points down.
const CONFIG: Record<TaskPriority, { label: string; Icon: LucideIcon; cls: string; text: string }> = {
  Critical: { label: 'Critical', Icon: AlertTriangle, cls: 'text-signal-red', text: 'text-signal-red font-semibold' },
  High: { label: 'High', Icon: ChevronUp, cls: 'text-signal-amber', text: 'text-n-90' },
  Medium: { label: 'Medium', Icon: Minus, cls: 'text-n-60', text: 'text-n-90' },
  Low: { label: 'Low', Icon: ChevronDown, cls: 'text-n-50', text: 'text-n-80' },
};

export default function PriorityBadge({ priority, size = 'md' }: Props) {
  const config = CONFIG[priority] ?? { label: String(priority ?? '—'), Icon: Minus, cls: 'text-n-60', text: 'text-n-80' };
  const { Icon } = config;
  const text = size === 'sm' ? 'text-xs' : 'text-13';
  const ic = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${config.text} ${text}`}>
      <Icon className={`${ic} flex-shrink-0 ${config.cls}`} />
      {config.label}
    </span>
  );
}

import { AlertTriangle, ChevronUp, Minus, ChevronDown } from 'lucide-react';
import StatusBadge from '../StatusBadge';
import { formatDate, formatDueRelative } from '../../utils/formatters';
import { isOverdue } from '../../utils/overdue';
import type { Task } from '../../types';

const PRIORITY_CFG = {
  Critical: { label: 'CRITICAL', icon: AlertTriangle, cls: 'text-signal-red' },
  High: { label: 'HIGH', icon: ChevronUp, cls: 'text-signal-amber' },
  Medium: { label: 'MEDIUM', icon: Minus, cls: 'text-n-70' },
  Low: { label: 'LOW', icon: ChevronDown, cls: 'text-n-60' },
};

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
  const dueClass = due.tone === 'overdue' ? 'text-signal-red font-semibold' : due.tone === 'soon' ? 'text-signal-amber font-medium' : 'text-n-70';
  const p = PRIORITY_CFG[task.priority];
  const PIcon = p.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 border-b border-n-20 last:border-0 active:bg-n-10 transition-colors ${overdue ? 'bg-signal-red-bg/40' : 'bg-white'}`}
    >
      <div className={`flex items-center gap-1 text-[11px] font-bold tracking-wide ${p.cls}`}>
        <PIcon className="w-3 h-3" />
        {p.label}
      </div>
      <div className="text-[15px] font-semibold text-n-100 leading-snug mt-0.5">{task.title}</div>
      <div className="text-13 text-n-70 mt-0.5 truncate">{locationLabel}{assigneeName ? ` · ${assigneeName}` : ''}</div>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <StatusBadge status={task.status} size="sm" />
        <span className={`text-13 ${dueClass}`}>{due.text || (done ? formatDate(task.dueDate) : `Due ${formatDate(task.dueDate)}`)}</span>
      </div>
    </button>
  );
}

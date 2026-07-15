import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Eye, Pencil, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { isOverdue } from '../utils/overdue';
import { formatDate } from '../utils/formatters';
import type { Task, User, Range } from '../types';

type SortKey = 'title' | 'assignee' | 'priority' | 'status' | 'due';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const STATUS_ORDER: Record<string, number> = { NotStarted: 0, InProgress: 1, Completed: 2, Archived: 3 };

interface Props {
  tasks: Task[];
  users: User[];
  ranges?: Range[];
  onOpen: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showRange?: boolean;
  showProgress?: boolean;
}

function HeaderCell({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className = '',
  align = 'left',
}: {
  label: string;
  sortKey?: SortKey;
  active?: boolean;
  dir?: SortDir;
  onSort?: (k: SortKey) => void;
  className?: string;
  align?: 'left' | 'right';
}) {
  return (
    <th className={`px-3 h-9 text-xs font-semibold text-n-70 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {sortKey && onSort ? (
        <button
          onClick={() => onSort(sortKey)}
          className={`inline-flex items-center gap-1 hover:text-n-100 transition-colors ${align === 'right' ? 'flex-row-reverse' : ''}`}
        >
          {label}
          {active && (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

export default function TaskTable({
  tasks,
  users,
  ranges = [],
  onOpen,
  onEdit,
  onDelete,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  showRange = true,
  showProgress = true,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('due');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '—';
  const rangeName = (id: string) => ranges.find((r) => r.id === id)?.name ?? '—';

  const sorted = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'assignee': cmp = userName(a.assigneeId).localeCompare(userName(b.assigneeId)); break;
        case 'priority': cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]; break;
        case 'status': cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]; break;
        case 'due': cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sortKey, sortDir, users]);

  const allSelected = selectable && tasks.length > 0 && selectedIds.length === tasks.length;
  const someSelected = selectable && selectedIds.length > 0 && !allSelected;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : tasks.map((t) => t.id));
  };
  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const hasActions = !!(onEdit || onDelete);

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-n-30">
            {selectable && (
              <th className="w-9 pl-3 h-9">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 accent-ptr-green cursor-pointer align-middle"
                  aria-label="Select all"
                />
              </th>
            )}
            <HeaderCell label="Task" sortKey="title" active={sortKey === 'title'} dir={sortDir} onSort={toggleSort} />
            <HeaderCell label="Assignee" sortKey="assignee" active={sortKey === 'assignee'} dir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
            {showRange && <HeaderCell label="Range" className="hidden lg:table-cell" />}
            <HeaderCell label="Priority" sortKey="priority" active={sortKey === 'priority'} dir={sortDir} onSort={toggleSort} className="hidden sm:table-cell" />
            <HeaderCell label="Status" sortKey="status" active={sortKey === 'status'} dir={sortDir} onSort={toggleSort} />
            {showProgress && <HeaderCell label="Progress" className="hidden xl:table-cell" />}
            <HeaderCell label="Due" sortKey="due" active={sortKey === 'due'} dir={sortDir} onSort={toggleSort} align="right" />
            {hasActions && <th className="w-24 px-3 h-9" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const overdue = isOverdue(task);
            const selected = selectedIds.includes(task.id);
            return (
              <tr
                key={task.id}
                onClick={() => onOpen(task)}
                className={`group border-b border-n-20 cursor-pointer transition-colors ${
                  selected ? 'bg-ptr-accent/[0.07]' : 'hover:bg-n-10'
                }`}
              >
                {selectable && (
                  <td className="w-9 pl-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleOne(task.id)}
                      className="w-3.5 h-3.5 accent-ptr-green cursor-pointer align-middle"
                      aria-label={`Select ${task.title}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2 w-full">
                  <div className="flex items-center gap-2 max-w-[150px] sm:max-w-[240px] lg:max-w-[360px] xl:max-w-[520px]">
                    <span className="text-13 font-medium text-n-100 truncate">{task.title}</span>
                    {task.coAssigneeIds.length > 0 && (
                      <span className="text-[10px] font-medium text-n-70 bg-n-20 rounded px-1 py-0.5 flex-shrink-0">
                        +{task.coAssigneeIds.length}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-13 text-n-80 whitespace-nowrap hidden md:table-cell">{userName(task.assigneeId)}</td>
                {showRange && <td className="px-3 py-2 text-13 text-n-80 whitespace-nowrap hidden lg:table-cell">{rangeName(task.rangeId)}</td>}
                <td className="px-3 py-2 hidden sm:table-cell"><PriorityBadge priority={task.priority} size="sm" /></td>
                <td className="px-3 py-2"><StatusBadge status={task.status} size="sm" /></td>
                {showProgress && (
                  <td className="px-3 py-2 hidden xl:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="w-16 h-1.5 rounded-full bg-n-20 overflow-hidden">
                        <span className="block h-full bg-ptr-green" style={{ width: `${task.completionPercentage}%` }} />
                      </span>
                      <span className="text-xs text-n-70 tabular-nums w-8">{task.completionPercentage}%</span>
                    </div>
                  </td>
                )}
                <td className={`px-3 py-2 text-13 text-right whitespace-nowrap tabular-nums ${overdue ? 'text-signal-red font-semibold' : 'text-n-80'}`}>
                  {formatDate(task.dueDate)}
                </td>
                {hasActions && (
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onOpen(task)} className="w-7 h-7 flex items-center justify-center rounded text-n-70 hover:bg-n-20 hover:text-n-100 transition-colors" title="Open">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {onEdit && (
                        <button onClick={() => onEdit(task)} className="w-7 h-7 flex items-center justify-center rounded text-n-70 hover:bg-n-20 hover:text-n-100 transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(task)} className="w-7 h-7 flex items-center justify-center rounded text-n-70 hover:bg-signal-red-bg hover:text-signal-red transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

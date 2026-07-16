import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Eye, Pencil, Trash2, UserCog, MoreHorizontal, ClipboardList } from 'lucide-react';
import StatusBadge from './StatusBadge';
import PriorityBadge, { PRIORITY_ORDER } from './PriorityBadge';
import { Menu, MenuItem } from './ui/Menu';
import { isOverdue } from '../utils/overdue';
import { formatDate, formatDueRelative } from '../utils/formatters';
import type { Task, User, Range } from '../types';

type SortKey = 'title' | 'assignee' | 'priority' | 'status' | 'due';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<string, number> = { NotStarted: 0, InProgress: 1, Completed: 2, Archived: 3 };

interface Props {
  tasks: Task[];
  users: User[];
  ranges?: Range[];
  onOpen: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onReassign?: (task: Task) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showRange?: boolean;
  showProgress?: boolean;
  loading?: boolean;
  scroll?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}

function HeaderCell({
  label, sortKey, active, dir, onSort, className = '', align = 'left',
}: {
  label: string; sortKey?: SortKey; active?: boolean; dir?: SortDir; onSort?: (k: SortKey) => void; className?: string; align?: 'left' | 'right';
}) {
  return (
    <th className={`sticky top-0 z-10 bg-white px-3 h-9 text-xs font-semibold text-n-70 border-b border-n-30 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {sortKey && onSort ? (
        <button onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 hover:text-n-100 transition-colors ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          {label}
          {active && (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
        </button>
      ) : label}
    </th>
  );
}

function Initials({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-n-20 text-[10px] font-semibold text-n-80 flex-shrink-0" aria-hidden="true">
      {text || '—'}
    </span>
  );
}

export default function TaskTable({
  tasks, users, ranges = [], onOpen, onEdit, onDelete, onReassign,
  selectable = false, selectedIds = [], onSelectionChange,
  showRange = true, showProgress = true, loading = false, scroll = false,
  emptyTitle = 'No tasks found', emptyHint = 'Try adjusting your filters or create a new task.',
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('due');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  const userOf = (id: string) => users.find((u) => u.id === id);
  const userName = (id: string) => userOf(id)?.name ?? '—';
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
  const toggleAll = () => { if (onSelectionChange) onSelectionChange(allSelected ? [] : tasks.map((t) => t.id)); };
  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const hasRowMenu = !!(onEdit || onDelete);
  const colCount = 1 + (selectable ? 1 : 0) + 1 + (showRange ? 1 : 0) + 1 + 1 + (showProgress ? 1 : 0) + 1 + 1;

  const wrapperCls = scroll
    ? 'w-full overflow-auto max-h-[calc(100dvh-172px)]'
    : 'w-full overflow-x-auto';

  return (
    <div className={wrapperCls}>
      <table className="w-full border-collapse min-w-[640px]">
        <thead>
          <tr>
            {selectable && (
              <th className="sticky top-0 z-10 bg-white w-9 pl-3 h-9 border-b border-n-30">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 accent-ptr-green cursor-pointer align-middle"
                  aria-label="Select all tasks"
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
            <th className="sticky top-0 z-10 bg-white w-20 px-3 h-9 border-b border-n-30" />
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-n-20">
                <td colSpan={colCount} className="px-3 py-2.5">
                  <div className="flex items-center gap-4">
                    <div className="skeleton h-3.5 flex-1 max-w-[280px]" />
                    <div className="skeleton h-3.5 w-24 hidden md:block" />
                    <div className="skeleton h-3.5 w-16 hidden sm:block" />
                    <div className="skeleton h-3.5 w-20 ml-auto" />
                  </div>
                </td>
              </tr>
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={colCount}>
                <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                  <div className="w-11 h-11 rounded-full bg-n-20 flex items-center justify-center mb-3 text-n-70">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="text-13 font-semibold text-n-100">{emptyTitle}</div>
                  <div className="text-13 text-n-70 mt-0.5 max-w-xs">{emptyHint}</div>
                </div>
              </td>
            </tr>
          ) : (
            sorted.map((task) => {
              const overdue = isOverdue(task);
              const selected = selectedIds.includes(task.id);
              const done = task.status === 'Completed' || task.status === 'Archived';
              const due = formatDueRelative(task.dueDate, done);
              const dueClass = due.tone === 'overdue' ? 'text-signal-red font-semibold' : due.tone === 'soon' ? 'text-signal-amber font-medium' : 'text-n-80';
              const initials = userOf(task.assigneeId)?.avatarInitials ?? '';
              return (
                <tr
                  key={task.id}
                  tabIndex={0}
                  onClick={() => onOpen(task)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(task); } }}
                  className={`group border-b border-n-20 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ptr-accent/40 ${
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
                      {overdue && <span className="w-1.5 h-1.5 rounded-full bg-signal-red flex-shrink-0" aria-hidden="true" />}
                      <span className="text-13 font-medium text-n-100 truncate">{task.title}</span>
                      {task.coAssigneeIds.length > 0 && (
                        <span className="text-[10px] font-medium text-n-70 bg-n-20 rounded px-1 py-0.5 flex-shrink-0">+{task.coAssigneeIds.length}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <span className="flex items-center gap-2 text-13 text-n-90 whitespace-nowrap">
                      <Initials text={initials} />
                      {userName(task.assigneeId)}
                    </span>
                  </td>
                  {showRange && <td className="px-3 py-2 text-13 text-n-80 whitespace-nowrap hidden lg:table-cell">{rangeName(task.rangeId)}</td>}
                  <td className="px-3 py-2 hidden sm:table-cell"><PriorityBadge priority={task.priority} size="sm" /></td>
                  <td className="px-3 py-2"><StatusBadge status={task.status} size="sm" /></td>
                  {showProgress && (
                    <td className="px-3 py-2 hidden xl:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="w-16 h-1.5 rounded-full bg-n-20 overflow-hidden"><span className="block h-full bg-ptr-green" style={{ width: `${task.completionPercentage}%` }} /></span>
                        <span className="text-xs text-n-70 tabular-nums w-8">{task.completionPercentage}%</span>
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {due.text && <div className={`text-13 ${dueClass}`}>{due.text}</div>}
                    <div className={`text-xs tabular-nums ${due.text ? 'text-n-70' : 'text-n-80'}`}>{formatDate(task.dueDate)}</div>
                  </td>
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                      <button onClick={() => onOpen(task)} className="w-7 h-7 flex items-center justify-center rounded text-n-70 hover:bg-n-20 hover:text-n-100 transition-colors" title="Open" aria-label={`Open ${task.title}`}>
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {(hasRowMenu || onReassign) && (
                        <Menu
                          align="right"
                          width="w-44"
                          ariaLabel={`More actions for ${task.title}`}
                          buttonClassName="w-7 h-7 flex items-center justify-center rounded text-n-70 hover:bg-n-20 hover:text-n-100 transition-colors"
                          button={<MoreHorizontal className="w-3.5 h-3.5" />}
                        >
                          <MenuItem icon={<Eye className="w-4 h-4" />} label="Open" onClick={() => onOpen(task)} />
                          {onReassign && <MenuItem icon={<UserCog className="w-4 h-4" />} label="Reassign" onClick={() => onReassign(task)} />}
                          {onEdit && <MenuItem icon={<Pencil className="w-4 h-4" />} label="Edit" onClick={() => onEdit(task)} />}
                          {onDelete && <MenuItem icon={<Trash2 className="w-4 h-4" />} label="Delete" danger onClick={() => onDelete(task)} />}
                        </Menu>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

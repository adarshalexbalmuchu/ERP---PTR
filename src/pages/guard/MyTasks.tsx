import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import EmptyState from '../../components/EmptyState';
import type { Task } from '../../types';

type Tab = 'active' | 'completed' | 'all';

const TABS: { id: Tab; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All' },
];

// Matches the director dashboard's Overview cell — large numeral, small
// semibold uppercase label, muted context line — so every role reads the
// same institutional style.
function Metric({ label, value, sub, valueClass = 'text-n-100' }: { label: string; value: number | string; sub: string; valueClass?: string }) {
  return (
    <div className="px-4 py-3.5">
      <div className={`text-[26px] leading-none font-semibold tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-13 font-medium text-n-90 mt-1.5">{label}</div>
      <div className="text-xs text-n-70 mt-0.5">{sub}</div>
    </div>
  );
}

// One flat row in the task list — divided-list treatment, not a floating card.
function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task);
  const pct = task.completionPercentage;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-n-10 transition-colors"
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-13 font-semibold text-n-100 leading-snug">{task.title}</div>
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={task.status} size="sm" />
          <PriorityBadge priority={task.priority} size="sm" />
        </div>
        <div className="flex items-center gap-3">
          <span className="flex-1 h-1.5 rounded-full bg-n-20 overflow-hidden">
            <span className="block h-full bg-ptr-green rounded-full" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-xs font-semibold text-n-90 tabular-nums flex-shrink-0">{pct}%</span>
        </div>
        <div className={`text-xs ${overdue ? 'text-signal-red font-medium' : 'text-n-70'}`}>
          Due {formatDate(task.dueDate)}
          {overdue && ' · Overdue'}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0 mt-0.5" />
    </button>
  );
}

export default function GuardMyTasks() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks } = useTasks();

  const [tab, setTab] = useState<Tab>('active');

  const myTasks = tasks.filter((t) => t.assigneeId === currentUser?.id || t.coAssigneeIds.includes(currentUser?.id ?? ''));

  const filtered = myTasks.filter((t) => {
    if (tab === 'active') return t.status === 'NotStarted' || t.status === 'InProgress';
    if (tab === 'completed') return t.status === 'Completed' || t.status === 'Archived';
    return true;
  });

  const overdueCount = myTasks.filter(isOverdue).length;
  const activeCount = myTasks.filter((t) => t.status === 'NotStarted' || t.status === 'InProgress').length;

  return (
    <div className="px-4 sm:px-6 py-5 space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-n-100">My tasks</h1>
        <p className="text-13 text-n-80 mt-0.5">
          {activeCount} active &middot;{' '}
          {overdueCount > 0 ? <span className="text-signal-red font-medium">{overdueCount} overdue</span> : '0 overdue'}
        </p>
      </div>

      {/* Overview — one unified strip with dividers */}
      <div className="card grid grid-cols-3 divide-x divide-n-30">
        <Metric label="Total" value={myTasks.length} sub="Assigned to me" />
        <Metric label="Active" value={activeCount} sub="In progress / new" />
        <Metric label="Overdue" value={overdueCount} sub="Past due date" valueClass={overdueCount > 0 ? 'text-signal-red' : 'text-n-100'} />
      </div>

      {/* Tabs — flat underline bar */}
      <div className="flex gap-6 border-b border-n-30">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px pb-2.5 text-13 font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-ptr-green text-n-100' : 'border-transparent text-n-70 hover:text-n-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Task list — flat divided rows in one card */}
      {filtered.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'No active tasks' : tab === 'completed' ? 'No completed tasks yet' : 'No tasks assigned'}
          description={tab === 'active' ? 'All caught up! Check back later.' : ''}
        />
      ) : (
        <div className="card divide-y divide-n-20 overflow-hidden">
          {filtered
            .sort((a, b) => {
              const priority = { Critical: 0, High: 1, Medium: 2, Low: 3 };
              if (isOverdue(a) && !isOverdue(b)) return -1;
              if (!isOverdue(a) && isOverdue(b)) return 1;
              return priority[a.priority] - priority[b.priority];
            })
            .map((task) => (
              <TaskRow key={task.id} task={task} onClick={() => navigate(`/guard/tasks/${task.id}`)} />
            ))}
        </div>
      )}
    </div>
  );
}

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
function Metric({ label, value, sub, valueClass = 'text-ptr-brown' }: { label: string; value: number | string; sub: string; valueClass?: string }) {
  return (
    <div className="px-5 py-4">
      <div className={`text-2xl xl:text-3xl font-bold tracking-tight tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-[11px] text-ptr-brown font-semibold uppercase tracking-[0.06em] mt-1">{label}</div>
      <div className="text-[11px] text-ptr-brown-light mt-0.5">{sub}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-ptr-brown uppercase tracking-[0.08em]">{children}</h2>;
}

// One flat row in the task list — same divided-list treatment as the
// director dashboard's Range Status / Recent Tasks, not a floating card.
function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task);
  const pct = task.completionPercentage;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-ptr-cream transition-colors"
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-[13px] font-semibold text-ptr-brown leading-snug">{task.title}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={task.status} size="sm" />
          <PriorityBadge priority={task.priority} size="sm" />
        </div>
        <div className="flex items-center gap-3">
          <span className="flex-1 h-1 bg-ptr-brown/10 overflow-hidden">
            <span className="block h-full bg-ptr-green" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-xs font-semibold text-ptr-brown tabular-nums flex-shrink-0">{pct}%</span>
        </div>
        <div className={`text-xs ${overdue ? 'text-signal-crimson font-medium' : 'text-ptr-brown-light'}`}>
          Due {formatDate(task.dueDate)}
          {overdue && ' · Overdue'}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-ptr-brown-light flex-shrink-0 mt-0.5" />
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
    <div className="p-4 md:p-6 space-y-6">
      {/* Page header — institutional heading, matches director/officer */}
      <div className="border-b border-ptr-brown/10 pb-4">
        <h1 className="text-lg md:text-xl font-bold text-ptr-brown uppercase tracking-[0.06em]">My Tasks</h1>
        <p className="text-[13px] text-ptr-brown-light mt-1">
          {activeCount} active &middot;{' '}
          {overdueCount > 0 ? <span className="text-signal-crimson font-medium">{overdueCount} overdue</span> : '0 overdue'}
        </p>
      </div>

      {/* Overview — one unified strip with dividers (director style) */}
      <div className="card">
        <div className="px-5 py-3 border-b border-ptr-cream-dark">
          <SectionHeading>Overview</SectionHeading>
        </div>
        <div className="grid grid-cols-3 divide-x divide-ptr-cream-dark">
          <Metric label="Total" value={myTasks.length} sub="Assigned to me" />
          <Metric label="Active" value={activeCount} sub="In progress or new" />
          <Metric
            label="Overdue"
            value={overdueCount}
            sub="Past due date"
            valueClass={overdueCount > 0 ? 'text-signal-crimson' : 'text-ptr-brown'}
          />
        </div>
      </div>

      {/* Tabs — flat underline bar */}
      <div className="flex gap-6 border-b border-ptr-cream-dark">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px pb-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-ptr-green text-ptr-brown' : 'border-transparent text-ptr-brown-light hover:text-ptr-brown'
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
        <div className="card divide-y divide-ptr-cream-dark overflow-hidden">
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

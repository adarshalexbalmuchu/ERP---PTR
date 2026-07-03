
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

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task);
  const pct = task.completionPercentage;

  const accentColor = overdue
    ? 'bg-red-500'
    : task.priority === 'Critical' || task.priority === 'High'
    ? 'bg-amber-500'
    : task.status === 'Completed'
    ? 'bg-ptr-green'
    : 'bg-ptr-brown/30';

  return (
    <button
      onClick={onClick}
      className="w-full card pl-5 p-4 text-left hover:shadow-md transition-shadow flex items-start gap-3 relative overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-sm text-ptr-brown leading-snug">{task.title}</div>
          <ChevronRight className="w-4 h-4 text-ptr-brown-light flex-shrink-0 mt-0.5" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={task.status} size="sm" />
          <PriorityBadge priority={task.priority} size="sm" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ptr-brown-light">Progress</span>
            <span className="font-medium text-ptr-brown">{pct}%</span>
          </div>
          <div className="h-1.5 bg-ptr-brown/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-ptr-green" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-ptr-brown-light'}`}>
          Due: {formatDate(task.dueDate)}
          {overdue && ' · Overdue'}
        </div>
      </div>
    </button>
  );
}

export default function GuardMyTasks() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks } = useTasks();

  const [tab, setTab] = useState<Tab>('active');

  const myTasks = tasks.filter((t) => t.assigneeId === currentUser?.id);

  const filtered = myTasks.filter((t) => {
    if (tab === 'active') return t.status === 'NotStarted' || t.status === 'InProgress';
    if (tab === 'completed') return t.status === 'Completed' || t.status === 'Archived';
    return true;
  });

  const overdueCount = myTasks.filter(isOverdue).length;
  const activeCount = myTasks.filter((t) => t.status === 'NotStarted' || t.status === 'InProgress').length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ptr-brown tracking-tight">My Tasks</h1>
        <p className="text-sm text-ptr-brown-light">
          {activeCount} active · {overdueCount > 0 ? <span className="text-red-600 font-medium">{overdueCount} overdue</span> : '0 overdue'}
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: myTasks.length, accent: 'bg-ptr-green', valueColor: 'text-ptr-brown' },
          { label: 'Active', value: activeCount, accent: 'bg-ptr-brown/40', valueColor: 'text-ptr-brown' },
          { label: 'Overdue', value: overdueCount, accent: overdueCount > 0 ? 'bg-red-500' : 'bg-ptr-brown/20', valueColor: overdueCount > 0 ? 'text-red-600' : 'text-ptr-brown-light' },
        ].map((m) => (
          <div key={m.label} className="card pl-4 p-3 relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${m.accent}`} />
            <div className={`text-2xl font-bold tabular-nums tracking-tight ${m.valueColor}`}>{m.value}</div>
            <div className="text-xs text-ptr-brown-light font-semibold uppercase tracking-wide mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ptr-cream rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              tab === t.id
                ? 'bg-white text-ptr-brown shadow-sm'
                : 'text-ptr-brown-light hover:text-ptr-brown'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'No active tasks' : tab === 'completed' ? 'No completed tasks yet' : 'No tasks assigned'}
          description={tab === 'active' ? 'All caught up! Check back later.' : ''}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered
            .sort((a, b) => {
              const priority = { Critical: 0, High: 1, Medium: 2, Low: 3 };
              if (isOverdue(a) && !isOverdue(b)) return -1;
              if (!isOverdue(a) && isOverdue(b)) return 1;
              return priority[a.priority] - priority[b.priority];
            })
            .map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => navigate(`/guard/tasks/${task.id}`)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  ClipboardList,
  AlertCircle,
  Clock,
  CheckCircle,
  TrendingUp,
  Plus,
  MapPin,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { supabase } from '../../lib/supabase';
import { mapTask } from '../../lib/mappers';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';
import TaskForm from '../../components/TaskForm';
import EmptyState from '../../components/EmptyState';
import type { Task } from '../../types';

function MetricCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-ptr-brown">{value}</div>
        <div className="text-xs text-ptr-brown-light font-medium">{label}</div>
        {sub && <div className="text-xs text-ptr-brown-light/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function TaskRow({ task, assigneeName, onClick }: { task: Task; assigneeName: string; onClick: () => void }) {
  const overdue = isOverdue(task);
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-ptr-cream transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-ptr-brown truncate">{task.title}</div>
        <div className="text-xs text-ptr-brown-light">{assigneeName}</div>
      </div>
      <StatusBadge status={task.status} size="sm" />
      <span className={`text-xs flex-shrink-0 ${overdue ? 'text-red-600 font-medium' : 'text-ptr-brown-light'}`}>
        {formatDate(task.dueDate)}
      </span>
    </button>
  );
}

export default function DirectorDashboard() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { users } = useUsers();
  const { createTask } = useTasks();
  const { stats, rangeStats } = useDashboardStats();

  const [formOpen, setFormOpen] = useState(false);

  // Metrics come from Postgres aggregate views (task_dashboard_stats /
  // task_range_stats) instead of fetching every task row — stays fast
  // regardless of how many years of tasks accumulate.
  const totalTasks = stats?.totalTasks ?? 0;
  const critical = stats?.criticalCount ?? 0;
  const inProgress = stats?.inProgressCount ?? 0;
  const completed = stats?.completedCount ?? 0;
  const overdueCount = stats?.overdueCount ?? 0;
  const completionRate = totalTasks > 0
    ? Math.round((((stats?.completedCount ?? 0) + (stats?.archivedCount ?? 0)) / totalTasks) * 100)
    : 0;

  const chartData = rangeStats.map((r) => ({
    name: r.rangeName.replace(' Range', ''),
    'Not Started': r.notStartedCount,
    'In Progress': r.inProgressCount,
    Completed: r.completedCount,
    Archived: r.archivedCount,
  }));

  // Only the handful of rows these lists actually display — not the full
  // task table.
  const { data: recentTasks = [] } = useQuery({
    queryKey: ['dashboard-recent-tasks'],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data.map((t) => mapTask(t));
    },
  });

  const { data: completedPendingReview = [] } = useQuery({
    queryKey: ['dashboard-pending-review'],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from('tasks').select('*').eq('status', 'Completed');
      if (error) throw error;
      return data.map((t) => mapTask(t));
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ptr-brown">Director Dashboard</h1>
          <p className="text-sm text-ptr-brown-light">Palamu Tiger Reserve · All Ranges</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Task</span>
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Total Tasks"
          value={totalTasks}
          icon={<ClipboardList className="w-6 h-6 text-ptr-green" />}
          color="bg-ptr-green/10"
        />
        <MetricCard
          label="Critical"
          value={critical}
          icon={<AlertCircle className="w-6 h-6 text-red-500" />}
          color="bg-red-50"
        />
        <MetricCard
          label="In Progress"
          value={inProgress}
          icon={<Clock className="w-6 h-6 text-amber-500" />}
          color="bg-amber-50"
        />
        <MetricCard
          label="Overdue"
          value={overdueCount}
          icon={<TrendingUp className="w-6 h-6 text-orange-500" />}
          color="bg-orange-50"
        />
        <MetricCard
          label="Completion Rate"
          value={`${completionRate}%`}
          icon={<CheckCircle className="w-6 h-6 text-emerald-500" />}
          color="bg-emerald-50"
          sub={`${completed} completed`}
        />
      </div>

      {/* Range breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {rangeStats.map((range) => (
          <button
            key={range.rangeId}
            onClick={() => navigate('/director/tasks')}
            className="card p-4 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-ptr-green" />
              <span className="text-sm font-semibold text-ptr-brown">{range.rangeName}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-ptr-brown-light">
              <span>{range.total} tasks</span>
              {range.overdue > 0 && <span className="text-red-600 font-medium">{range.overdue} overdue</span>}
            </div>
            <div className="mt-2 h-1.5 bg-ptr-cream-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-ptr-green rounded-full"
                style={{
                  width: range.total > 0 ? `${Math.round((range.completed / range.total) * 100)}%` : '0%',
                }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Chart + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ptr-brown mb-4">Task Status by Range</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE7D6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B6356' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B6356' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #EFE7D6' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="Not Started" stackId="a" fill="#9CA3AF" />
              <Bar dataKey="In Progress" stackId="a" fill="#F59E0B" />
              <Bar dataKey="Completed" stackId="a" fill="#3B82F6" />
              <Bar dataKey="Archived" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ptr-brown">Recent Tasks</h2>
            <button onClick={() => navigate('/director/tasks')} className="text-xs text-ptr-green font-medium">
              View all →
            </button>
          </div>
          {recentTasks.length === 0 ? (
            <EmptyState title="No tasks yet" description="Create a task to get started." />
          ) : (
            <div className="space-y-1">
              {recentTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  assigneeName={users.find((u) => u.id === t.assigneeId)?.name ?? '—'}
                  onClick={() => navigate(`/director/tasks/${t.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending review */}
      {completedPendingReview.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ptr-brown mb-4">
            Completed — Awaiting Review ({completedPendingReview.length})
          </h2>
          <div className="space-y-1">
            {completedPendingReview.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                assigneeName={users.find((u) => u.id === t.assigneeId)?.name ?? '—'}
                onClick={() => navigate(`/director/tasks/${t.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {formOpen && currentUser && (
        <TaskForm
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={(data) => { createTask.mutate(data); setFormOpen(false); }}
          assignableUsers={users.filter((u) => u.role === 'guard')}
          initialData={null}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
}

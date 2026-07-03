import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  CheckCircle2,
  TrendingUp,
  Plus,
  AlertTriangle,
  ClipboardCheck,
  Clock,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { supabase } from '../../lib/supabase';
import { mapTask } from '../../lib/mappers';
import { uploadTaskAttachment } from '../../lib/attachments';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import TaskForm from '../../components/TaskForm';
import EmptyState from '../../components/EmptyState';
import type { Task } from '../../types';

// One cell of the unified Overview strip — large numeral, small semibold
// label, muted context line. Hierarchy is carried by type, not color.
function Metric({
  label,
  value,
  sub,
  valueClass = 'text-ptr-brown',
}: {
  label: string;
  value: number | string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="px-5 py-4">
      <div className={`text-2xl xl:text-3xl font-bold tracking-tight tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-[11px] text-ptr-brown font-semibold uppercase tracking-[0.06em] mt-1">{label}</div>
      <div className="text-[11px] text-ptr-brown-light mt-0.5">{sub}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-ptr-brown uppercase tracking-[0.08em]">{children}</h2>
  );
}

// A single row in the Operational Alerts panel. Muted by default; the
// count turns the row into an actionable item.
function AlertRow({
  icon,
  label,
  clearLabel,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  clearLabel: string;
  count: number;
  onClick?: () => void;
}) {
  const active = count > 0;
  const row = (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={active ? 'text-signal-crimson' : 'text-ptr-brown-light/60'}>{icon}</span>
      <span className={`flex-1 text-[13px] ${active ? 'text-ptr-brown font-medium' : 'text-ptr-brown-light'}`}>
        {active ? label : clearLabel}
      </span>
      {active && (
        <span className="text-[13px] font-bold tabular-nums text-signal-crimson">{count}</span>
      )}
    </div>
  );
  if (active && onClick) {
    return (
      <button onClick={onClick} className="w-full text-left hover:bg-ptr-cream transition-colors">
        {row}
      </button>
    );
  }
  return row;
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

  // Real 7-day trend from the daily_reports history (generated from the
  // Reports page) rather than fabricated data — shows a graceful message
  // instead of a chart if there isn't enough history yet.
  const { data: trendData = [] } = useQuery({
    queryKey: ['dashboard-trend'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('report_date, completed_count, in_progress_count, not_started_count, overdue_count')
        .order('report_date', { ascending: true })
        .limit(7);
      if (error) throw error;
      return data.map((r) => ({
        date: formatDate(r.report_date),
        Completed: r.completed_count,
        'In Progress': r.in_progress_count,
        'Not Started': r.not_started_count,
        Overdue: r.overdue_count,
      }));
    },
  });

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
      {/* Page header — official system heading, no greeting */}
      <div className="flex items-end justify-between gap-4 border-b border-ptr-brown/10 pb-4">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-ptr-brown uppercase tracking-[0.06em]">
            Field Operations Dashboard
          </h1>
          <p className="text-[13px] text-ptr-brown-light mt-1">
            Palamu Tiger Reserve &middot; All Ranges &middot;{' '}
            <span className="tabular-nums">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </p>
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary flex-shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Task</span>
        </button>
      </div>

      {/* Overview — one unified strip instead of five floating cards */}
      <div className="card">
        <div className="px-5 py-3 border-b border-ptr-cream-dark">
          <SectionHeading>Overview</SectionHeading>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-ptr-cream-dark">
          <Metric label="Total Tasks" value={totalTasks} sub="All ranges" />
          <Metric label="Critical" value={critical} sub="Open, critical priority" valueClass={critical > 0 ? 'text-signal-crimson' : 'text-ptr-brown'} />
          <Metric label="In Progress" value={inProgress} sub="Currently active" />
          <Metric label="Overdue" value={overdueCount} sub="Past due date" valueClass={overdueCount > 0 ? 'text-signal-crimson' : 'text-ptr-brown'} />
          <Metric label="Completion Rate" value={`${completionRate}%`} sub={`${completed} tasks completed`} valueClass="text-ptr-green" />
        </div>
      </div>

      {/* Range status — one container, one row per range */}
      <div className="card">
        <div className="px-5 py-3 border-b border-ptr-cream-dark">
          <SectionHeading>Range Status</SectionHeading>
        </div>
        <div className="divide-y divide-ptr-cream-dark">
          {rangeStats.map((range) => {
            const pct = range.total > 0 ? Math.round((range.completed / range.total) * 100) : 0;
            return (
              <button
                key={range.rangeId}
                onClick={() => navigate('/director/tasks')}
                className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-ptr-cream transition-colors"
              >
                <span className="w-28 md:w-36 text-[13px] font-semibold text-ptr-brown truncate flex-shrink-0">
                  {range.rangeName}
                </span>
                <span className="hidden sm:flex items-center gap-4 text-xs text-ptr-brown-light tabular-nums flex-shrink-0">
                  <span><span className="font-semibold text-ptr-brown">{range.inProgressCount}</span> active</span>
                  <span><span className="font-semibold text-ptr-brown">{range.completed}</span> completed</span>
                  <span>
                    <span className={`font-semibold ${range.overdue > 0 ? 'text-signal-crimson' : 'text-ptr-brown'}`}>
                      {range.overdue}
                    </span>{' '}
                    overdue
                  </span>
                </span>
                {/* thin, flat progress indicator */}
                <span className="flex-1 h-1 bg-ptr-brown/10 overflow-hidden">
                  <span className="block h-full bg-ptr-green" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-10 text-right text-xs font-semibold text-ptr-brown tabular-nums flex-shrink-0">
                  {pct}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Trend chart — enterprise reporting style */}
      <div className="card">
        <div className="px-5 py-3 border-b border-ptr-cream-dark">
          <SectionHeading>Task Status Trend</SectionHeading>
        </div>
        <div className="p-5">
          {trendData.length < 2 ? (
            <EmptyState
              icon={<TrendingUp className="w-7 h-7" />}
              title="Not enough history yet"
              description="Generate a daily report from the Reports page each day to build a trend here."
            />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#F3EEE2" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B6356' }} tickLine={false} axisLine={{ stroke: '#EFE7D6' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B6356' }} allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4, border: '1px solid #EFE7D6', boxShadow: 'none', padding: '6px 10px' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconSize={10} />
                <Line type="monotone" dataKey="Not Started" stroke="#9CA3AF" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="In Progress" stroke="#8A7F5C" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Completed" stroke="#1A4731" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Overdue" stroke="#9F1D1D" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent tasks table + Operational alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-ptr-cream-dark">
            <SectionHeading>Recent Tasks</SectionHeading>
            <button onClick={() => navigate('/director/tasks')} className="text-xs text-ptr-green font-semibold hover:underline">
              View registry &rarr;
            </button>
          </div>
          {recentTasks.length === 0 ? (
            <EmptyState title="No tasks yet" description="Create a task to get started." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-ptr-cream-dark">
                    <th className="pl-5 pr-2 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ptr-brown-light">Task</th>
                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ptr-brown-light">Assigned To</th>
                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ptr-brown-light">Priority</th>
                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ptr-brown-light">Status</th>
                    <th className="pl-2 pr-5 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ptr-brown-light text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ptr-cream-dark/60">
                  {recentTasks.map((t) => {
                    const overdue = isOverdue(t);
                    return (
                      <tr
                        key={t.id}
                        onClick={() => navigate(`/director/tasks/${t.id}`)}
                        className="hover:bg-ptr-cream cursor-pointer transition-colors"
                      >
                        <td className="pl-5 pr-2 py-2.5 text-xs font-medium text-ptr-brown">
                          <div className="truncate max-w-[150px]">{t.title}</div>
                        </td>
                        <td className="px-2 py-2.5 text-xs text-ptr-brown-light whitespace-nowrap">
                          {users.find((u) => u.id === t.assigneeId)?.name ?? '—'}
                          {t.coAssigneeIds.length > 0 && ` +${t.coAssigneeIds.length}`}
                        </td>
                        <td className="px-2 py-2.5"><PriorityBadge priority={t.priority} size="sm" /></td>
                        <td className="px-2 py-2.5"><StatusBadge status={t.status} size="sm" /></td>
                        <td className={`pl-2 pr-5 py-2.5 text-xs text-right whitespace-nowrap tabular-nums ${overdue ? 'text-signal-crimson font-semibold' : 'text-ptr-brown-light'}`}>
                          {new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Operational alerts — always shows system state, never a large
            empty card */}
        <div className="card">
          <div className="px-5 py-3 border-b border-ptr-cream-dark">
            <SectionHeading>Operational Alerts</SectionHeading>
          </div>
          <div className="divide-y divide-ptr-cream-dark/60">
            <AlertRow
              icon={<ClipboardCheck className="w-4 h-4" />}
              label="Completed tasks awaiting review"
              clearLabel="No completed tasks awaiting review"
              count={completedPendingReview.length}
              onClick={() => navigate('/director/tasks')}
            />
            <AlertRow
              icon={<Clock className="w-4 h-4" />}
              label="Tasks past their due date"
              clearLabel="No overdue tasks"
              count={overdueCount}
              onClick={() => navigate('/director/tasks')}
            />
            <AlertRow
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Open critical-priority tasks"
              clearLabel="No open critical-priority tasks"
              count={critical}
              onClick={() => navigate('/director/tasks')}
            />
            {completedPendingReview.length === 0 && overdueCount === 0 && critical === 0 && (
              <div className="flex items-center gap-3 px-4 py-3 text-[13px] text-ptr-brown-light">
                <CheckCircle2 className="w-4 h-4 text-ptr-green/70" />
                All operational checks clear
              </div>
            )}
          </div>
        </div>
      </div>

      {formOpen && currentUser && (
        <TaskForm
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={async (data, files) => {
            const row = await createTask.mutateAsync(data);
            for (const file of files) {
              try {
                await uploadTaskAttachment(row.id, currentUser.id, file);
              } catch (err) {
                alert(err instanceof Error ? err.message : `Failed to upload "${file.name}"`);
              }
            }
            setFormOpen(false);
          }}
          assignableUsers={users.filter((u) => u.role === 'guard')}
          initialData={null}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
}

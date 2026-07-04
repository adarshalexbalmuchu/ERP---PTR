import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { useOfficerRanges } from '../../hooks/useOfficerRanges';
import { uploadTaskAttachment } from '../../lib/attachments';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import TaskForm from '../../components/TaskForm';
import EmptyState from '../../components/EmptyState';

// One cell of the unified Overview strip — large numeral, small semibold
// label, muted context line. Hierarchy is carried by type, not color.
function MetricCard({
  label, value, sub, valueClass = 'text-ptr-brown',
}: { label: string; value: number | string; sub?: string; valueClass?: string }) {
  return (
    <div className="px-5 py-4">
      <div className={`text-2xl xl:text-3xl font-bold tracking-tight tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-[11px] text-ptr-brown font-semibold uppercase tracking-[0.06em] mt-1">{label}</div>
      {sub && <div className="text-[11px] text-ptr-brown-light mt-0.5">{sub}</div>}
    </div>
  );
}

export default function OfficerDashboard() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks, createTask } = useTasks();
  const { users } = useUsers();
  const { ranges, areas } = useRanges();
  const { activeRangeId, rangeIds, setActiveRangeId, isMultiRange } = useOfficerRanges();

  const [formOpen, setFormOpen] = useState(false);

  const myRange = ranges.find((r) => r.id === activeRangeId);
  const myTasks = tasks.filter((t) => t.rangeId === activeRangeId);
  const myGuards = users.filter((u) => u.role === 'guard' && u.rangeId === activeRangeId);
  const myAreas = areas.filter((a) => a.rangeId === activeRangeId);

  // Metrics are computed from the already-fetched task list, scoped to the
  // ACTIVE range — for an officer holding several ranges, the RLS-scoped
  // task_dashboard_stats view would blend all their ranges together, which
  // is exactly what the range switcher exists to avoid.
  const totalTasks = myTasks.length;
  const critical = myTasks.filter((t) => t.priority === 'Critical' && t.status !== 'Archived').length;
  const inProgress = myTasks.filter((t) => t.status === 'InProgress').length;
  const overdueCount = myTasks.filter(isOverdue).length;
  const completed = myTasks.filter((t) => t.status === 'Completed').length;
  const archived = myTasks.filter((t) => t.status === 'Archived').length;
  const completionRate = totalTasks > 0
    ? Math.round(((completed + archived) / totalTasks) * 100)
    : 0;

  // Chart: tasks per guard
  const guardChartData = myGuards.map((g) => {
    const gt = myTasks.filter((t) => t.assigneeId === g.id || t.coAssigneeIds.includes(g.id));
    return {
      name: g.name.split(' ')[0],
      'Not Started': gt.filter((t) => t.status === 'NotStarted').length,
      'In Progress': gt.filter((t) => t.status === 'InProgress').length,
      Completed: gt.filter((t) => t.status === 'Completed').length,
    };
  });

  // Priority tasks
  const priorityTasks = myTasks
    .filter((t) => (t.priority === 'Critical' || t.priority === 'High') && t.status !== 'Archived' && t.status !== 'Completed')
    .sort((a, b) => {
      const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 6);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header — official system heading */}
      <div className="flex items-end justify-between gap-4 border-b border-ptr-brown/10 pb-4">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-ptr-brown uppercase tracking-[0.06em]">
            Range Operations Dashboard
          </h1>
          <p className="text-[13px] text-ptr-brown-light mt-1">
            {myRange?.name ?? 'Range'} &middot; {myGuards.length} staff &middot; {myAreas.length} areas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isMultiRange && (
            <select
              value={activeRangeId}
              onChange={(e) => setActiveRangeId(e.target.value)}
              className="input-field select-field !w-auto text-sm"
              aria-label="Switch range"
            >
              {rangeIds.map((id) => {
                const r = ranges.find((rr) => rr.id === id);
                return <option key={id} value={id}>{r?.name ?? 'Range'}</option>;
              })}
            </select>
          )}
          <button onClick={() => setFormOpen(true)} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      {/* Overview — one unified strip instead of five floating cards */}
      <div className="card">
        <div className="px-5 py-3 border-b border-ptr-cream-dark">
          <h2 className="text-xs font-bold text-ptr-brown uppercase tracking-[0.08em]">Overview</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-ptr-cream-dark">
          <MetricCard label="Total Tasks" value={totalTasks} sub="This range" />
          <MetricCard label="Critical" value={critical} sub="Open, critical priority" valueClass={critical > 0 ? 'text-signal-crimson' : 'text-ptr-brown'} />
          <MetricCard label="In Progress" value={inProgress} sub="Currently active" />
          <MetricCard label="Overdue" value={overdueCount} sub="Past due date" valueClass={overdueCount > 0 ? 'text-signal-crimson' : 'text-ptr-brown'} />
          <MetricCard label="Completion Rate" value={`${completionRate}%`} sub={`${completed} tasks completed`} valueClass="text-ptr-green" />
        </div>
      </div>

      {/* Chart + Priority Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ptr-brown mb-4">Workload by Staff</h2>
          {guardChartData.length === 0 ? (
            <EmptyState title="No staff in this range" description="" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={guardChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE7D6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B6356' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B6356' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #EFE7D6' }} />
                <Bar dataKey="Not Started" stackId="a" fill="#9CA3AF" />
                <Bar dataKey="In Progress" stackId="a" fill="#8A7F5C" />
                <Bar dataKey="Completed" stackId="a" fill="#1A4731" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ptr-brown">Priority Tasks</h2>
            <button onClick={() => navigate('/officer/tasks')} className="text-xs text-ptr-green font-medium">
              View all →
            </button>
          </div>
          {priorityTasks.length === 0 ? (
            <EmptyState title="No high-priority tasks" description="All critical work is under control." />
          ) : (
            <div className="space-y-2">
              {priorityTasks.map((t) => {
                const assignee = users.find((u) => u.id === t.assigneeId);
                const overdue = isOverdue(t);
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/officer/tasks/${t.id}`)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-ptr-cream transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-ptr-brown truncate">{t.title}</div>
                      <div className="text-xs text-ptr-brown-light">{assignee?.name ?? '—'}{t.coAssigneeIds.length > 0 && ` +${t.coAssigneeIds.length}`}</div>
                    </div>
                    <PriorityBadge priority={t.priority} size="sm" />
                    <span className={`text-xs flex-shrink-0 ${overdue ? 'text-red-600 font-medium' : 'text-ptr-brown-light'}`}>
                      {formatDate(t.dueDate)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Staff overview */}
      {myGuards.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ptr-brown mb-4">Staff Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myGuards.map((g) => {
              const gt = myTasks.filter((t) => t.assigneeId === g.id || t.coAssigneeIds.includes(g.id));
              const active = gt.filter((t) => t.status === 'InProgress').length;
              const ov = gt.filter(isOverdue).length;
              return (
                <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-ptr-cream/50">
                  <div className="w-9 h-9 rounded-full bg-ptr-green/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-ptr-green">{g.avatarInitials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-ptr-brown">{g.name}</div>
                    <div className="text-xs text-ptr-brown-light">{gt.length} tasks · {active} active</div>
                    {ov > 0 && <div className="text-xs text-red-600 font-medium">{ov} overdue</div>}
                  </div>
                  <StatusBadge
                    status={active > 0 ? 'InProgress' : gt.some((t) => t.status === 'NotStarted') ? 'NotStarted' : 'Completed'}
                    size="sm"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

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
          assignableUsers={myGuards}
          initialData={null}
          currentUserId={currentUser.id}
          defaultRangeId={activeRangeId}
        />
      )}
    </div>
  );
}

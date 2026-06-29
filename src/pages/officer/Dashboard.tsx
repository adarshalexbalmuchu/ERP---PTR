import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { ClipboardList, AlertCircle, Clock, CheckCircle, TrendingUp, Plus } from 'lucide-react';
import { useState } from 'react';
import useStore from '../../store/useStore';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import TaskForm from '../../components/TaskForm';
import EmptyState from '../../components/EmptyState';

function MetricCard({
  label, value, icon, color, sub,
}: { label: string; value: number | string; icon: React.ReactNode; color: string; sub?: string }) {
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

export default function OfficerDashboard() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const ranges = useStore((s) => s.ranges);
  const areas = useStore((s) => s.areas);
  const createTask = useStore((s) => s.createTask);

  const [formOpen, setFormOpen] = useState(false);

  const myRange = ranges.find((r) => r.id === currentUser?.rangeId);
  const myTasks = tasks.filter((t) => t.rangeId === currentUser?.rangeId);
  const myGuards = users.filter((u) => u.role === 'guard' && u.rangeId === currentUser?.rangeId);
  const myAreas = areas.filter((a) => a.rangeId === currentUser?.rangeId);

  const totalTasks = myTasks.length;
  const critical = myTasks.filter((t) => t.priority === 'Critical' && t.status !== 'Archived').length;
  const inProgress = myTasks.filter((t) => t.status === 'InProgress').length;
  const overdueCount = myTasks.filter(isOverdue).length;
  const completed = myTasks.filter((t) => t.status === 'Completed').length;
  const completionRate = totalTasks > 0
    ? Math.round((myTasks.filter((t) => t.status === 'Completed' || t.status === 'Archived').length / totalTasks) * 100)
    : 0;

  // Chart: tasks per guard
  const guardChartData = myGuards.map((g) => {
    const gt = myTasks.filter((t) => t.assigneeId === g.id);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ptr-brown">{myRange?.name ?? 'Range'} Dashboard</h1>
          <p className="text-sm text-ptr-brown-light">
            {myGuards.length} staff · {myAreas.length} areas
          </p>
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
                <Bar dataKey="In Progress" stackId="a" fill="#F59E0B" />
                <Bar dataKey="Completed" stackId="a" fill="#3B82F6" radius={[4, 4, 0, 0]} />
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
                      <div className="text-xs text-ptr-brown-light">{assignee?.name ?? '—'}</div>
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
              const gt = myTasks.filter((t) => t.assigneeId === g.id);
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
          onSave={(data) => { createTask(data); setFormOpen(false); }}
          assignableUsers={myGuards}
          initialData={null}
          currentUserId={currentUser.id}
          defaultRangeId={currentUser.rangeId}
        />
      )}
    </div>
  );
}

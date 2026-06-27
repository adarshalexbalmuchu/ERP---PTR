import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import { ClipboardList, AlertCircle, Clock, CheckCircle, TrendingUp, Plus } from 'lucide-react';
import useStore from '../../store/useStore';
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
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-ptr-brown">{value}</div>
        <div className="text-xs text-ptr-brown-light font-medium">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const createTask = useStore((s) => s.createTask);

  const [formOpen, setFormOpen] = useState(false);

  const staffUsers = users.filter((u) => u.role === 'staff');

  // Metrics
  const totalTasks = tasks.length;
  const unreadTasks = tasks.filter((t) => t.status === 'Unread').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'InProgress').length;
  const awaitingApproval = tasks.filter((t) => t.status === 'Done').length;
  const overdueTasks = tasks.filter(isOverdue).length;

  // Chart data: tasks per staff member
  const chartData = staffUsers.map((user) => {
    const userTasks = tasks.filter((t) => t.assigneeId === user.id);
    return {
      name: user.name.split(' ')[0],
      Unread: userTasks.filter((t) => t.status === 'Unread').length,
      'In Progress': userTasks.filter((t) => t.status === 'InProgress').length,
      Done: userTasks.filter((t) => t.status === 'Done').length,
      Approved: userTasks.filter((t) => t.status === 'Approved').length,
    };
  });

  // Recent tasks (last 5 by creation date)
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const handleCreateTask = (data: Parameters<typeof createTask>[0]) => {
    createTask(data);
    setFormOpen(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ptr-brown">Dashboard</h1>
          <p className="text-sm text-ptr-brown-light">Palamu Tiger Reserve · Field Operations</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Task</span>
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Total Tasks"
          value={totalTasks}
          icon={<ClipboardList className="w-6 h-6 text-ptr-green" />}
          color="bg-ptr-green/10"
        />
        <MetricCard
          label="Unread"
          value={unreadTasks}
          icon={<AlertCircle className="w-6 h-6 text-gray-500" />}
          color="bg-gray-100"
        />
        <MetricCard
          label="In Progress"
          value={inProgressTasks}
          icon={<Clock className="w-6 h-6 text-amber-500" />}
          color="bg-amber-50"
        />
        <MetricCard
          label="Awaiting Approval"
          value={awaitingApproval}
          icon={<CheckCircle className="w-6 h-6 text-blue-500" />}
          color="bg-blue-50"
        />
        <MetricCard
          label="Overdue"
          value={overdueTasks}
          icon={<TrendingUp className="w-6 h-6 text-red-500" />}
          color="bg-red-50"
        />
      </div>

      {/* Chart + Recent tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload chart */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ptr-brown mb-4">Staff Workload</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE7D6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B6356' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B6356' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 12,
                  border: '1px solid #EFE7D6',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="Unread" stackId="a" fill="#9CA3AF" />
              <Bar dataKey="In Progress" stackId="a" fill="#F59E0B" />
              <Bar dataKey="Done" stackId="a" fill="#3B82F6" />
              <Bar dataKey="Approved" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent tasks */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ptr-brown">Recent Tasks</h2>
            <button
              onClick={() => navigate('/admin/tasks')}
              className="text-xs text-ptr-green font-medium hover:text-ptr-green-light"
            >
              View all →
            </button>
          </div>
          {recentTasks.length === 0 ? (
            <EmptyState title="No tasks yet" description="Create a new task to get started." />
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <RecentTaskRow
                  key={task.id}
                  task={task}
                  assigneeName={users.find((u) => u.id === task.assigneeId)?.name ?? '—'}
                  onClick={() => navigate(`/admin/tasks/${task.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Awaiting Approval quick view */}
      {awaitingApproval > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ptr-brown mb-4">
            Awaiting Your Approval ({awaitingApproval})
          </h2>
          <div className="space-y-2">
            {tasks
              .filter((t) => t.status === 'Done')
              .map((task) => (
                <RecentTaskRow
                  key={task.id}
                  task={task}
                  assigneeName={users.find((u) => u.id === task.assigneeId)?.name ?? '—'}
                  onClick={() => navigate(`/admin/tasks/${task.id}`)}
                />
              ))}
          </div>
        </div>
      )}

      {formOpen && currentUser && (
        <TaskForm
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handleCreateTask}
          staffUsers={staffUsers}
          initialData={null}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
}

function RecentTaskRow({
  task,
  assigneeName,
  onClick,
}: {
  task: Task;
  assigneeName: string;
  onClick: () => void;
}) {
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
      <span
        className={`text-xs flex-shrink-0 ${overdue ? 'text-red-600 font-medium' : 'text-ptr-brown-light'}`}
      >
        {formatDate(task.dueDate)}
      </span>
    </button>
  );
}

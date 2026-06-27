import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import useStore from '../../store/useStore';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import TaskForm from '../../components/TaskForm';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import type { Task, TaskStatus, TaskPriority } from '../../types';

type SortKey = 'dueDate' | 'priority' | 'createdAt' | 'status';

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};
const STATUS_ORDER: Record<TaskStatus, number> = {
  Unread: 0,
  InProgress: 1,
  Done: 2,
  Approved: 3,
};

export default function AdminTaskList() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const createTask = useStore((s) => s.createTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);

  const staffUsers = users.filter((u) => u.role === 'staff');

  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | ''>('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = tasks
    .filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterAssignee && t.assigneeId !== filterAssignee) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterOverdue && !isOverdue(t)) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortKey) {
        case 'dueDate':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'priority':
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

  const handleCreate = (data: Parameters<typeof createTask>[0]) => {
    createTask(data);
    setFormOpen(false);
  };

  const handleEdit = (data: Parameters<typeof createTask>[0]) => {
    if (editingTask) updateTask(editingTask.id, data);
    setEditingTask(null);
  };

  const handleDelete = () => {
    if (deleteId) deleteTask(deleteId);
    setDeleteId(null);
  };

  const clearFilters = () => {
    setSearch('');
    setFilterAssignee('');
    setFilterStatus('');
    setFilterPriority('');
    setFilterOverdue(false);
  };

  const hasFilters =
    search || filterAssignee || filterStatus || filterPriority || filterOverdue;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ptr-brown">All Tasks</h1>
          <p className="text-sm text-ptr-brown-light">
            {filtered.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => { setEditingTask(null); setFormOpen(true); }} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Task</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-ptr-brown-light flex-shrink-0" />
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ptr-brown-light" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="input-field pl-9 py-2 text-sm"
            />
          </div>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="input-field py-2 text-sm w-auto min-w-[140px]"
          >
            <option value="">All Staff</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as TaskStatus | '')}
            className="input-field py-2 text-sm w-auto min-w-[120px]"
          >
            <option value="">All Status</option>
            <option value="Unread">Unread</option>
            <option value="InProgress">In Progress</option>
            <option value="Done">Done</option>
            <option value="Approved">Approved</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as TaskPriority | '')}
            className="input-field py-2 text-sm w-auto min-w-[120px]"
          >
            <option value="">All Priority</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-ptr-brown cursor-pointer min-h-[44px] px-2">
            <input
              type="checkbox"
              checked={filterOverdue}
              onChange={(e) => setFilterOverdue(e.target.checked)}
              className="w-4 h-4 accent-ptr-green"
            />
            Overdue only
          </label>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ptr-brown-light">Sort:</span>
          {(['dueDate', 'priority', 'status', 'createdAt'] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                sortKey === k
                  ? 'bg-ptr-green text-white'
                  : 'bg-ptr-cream text-ptr-brown-light hover:bg-ptr-cream-dark'
              }`}
            >
              {k === 'dueDate' ? 'Due Date' : k === 'createdAt' ? 'Created' : k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-red-600 hover:text-red-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No tasks match your filters' : 'No tasks yet'}
          description={hasFilters ? 'Try clearing filters to see all tasks.' : 'Create a new task to get started.'}
        />
      ) : (
        <div className="card overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ptr-cream-dark bg-ptr-cream/50">
                  <th className="text-left text-xs font-semibold text-ptr-brown-light px-4 py-3">
                    Task
                  </th>
                  <th className="text-left text-xs font-semibold text-ptr-brown-light px-4 py-3">
                    Assignee
                  </th>
                  <th className="text-left text-xs font-semibold text-ptr-brown-light px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-semibold text-ptr-brown-light px-4 py-3">
                    Priority
                  </th>
                  <th className="text-left text-xs font-semibold text-ptr-brown-light px-4 py-3">
                    Due Date
                  </th>
                  <th className="text-left text-xs font-semibold text-ptr-brown-light px-4 py-3">
                    Category
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => {
                  const assignee = users.find((u) => u.id === task.assigneeId);
                  const overdue = isOverdue(task);
                  return (
                    <tr
                      key={task.id}
                      onClick={() => navigate(`/admin/tasks/${task.id}`)}
                      className="border-b border-ptr-cream-dark last:border-0 hover:bg-ptr-cream/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {task.status === 'Unread' && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-ptr-brown line-clamp-1">
                            {task.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-ptr-brown-light">
                        {assignee?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={task.status} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={task.priority} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-ptr-brown-light'}`}
                        >
                          {overdue ? '⚠ ' : ''}
                          {formatDate(task.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-ptr-cream text-ptr-brown-light px-2 py-0.5 rounded-full border border-ptr-cream-dark">
                          {task.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => { setEditingTask(task); setFormOpen(true); }}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-ptr-cream-dark hover:bg-ptr-cream transition-colors text-ptr-brown-light"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteId(task.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-ptr-cream-dark">
            {filtered.map((task) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const overdue = isOverdue(task);
              return (
                <div
                  key={task.id}
                  className={`p-4 ${task.status === 'Unread' ? 'border-l-4 border-l-amber-400' : ''}`}
                >
                  <div
                    onClick={() => navigate(`/admin/tasks/${task.id}`)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-ptr-brown line-clamp-2">
                        {task.title}
                      </p>
                      <PriorityBadge priority={task.priority} size="sm" />
                    </div>
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <StatusBadge status={task.status} size="sm" />
                      <span className="text-xs text-ptr-brown-light">{assignee?.name}</span>
                      <span
                        className={`text-xs ml-auto ${overdue ? 'text-red-600 font-medium' : 'text-ptr-brown-light'}`}
                      >
                        {overdue ? '⚠ ' : ''}
                        {formatDate(task.dueDate)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => { setEditingTask(task); setFormOpen(true); }}
                      className="flex-1 text-xs py-2 rounded-xl border border-ptr-cream-dark text-ptr-brown-light hover:bg-ptr-cream transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(task.id)}
                      className="flex-1 text-xs py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {formOpen && currentUser && (
        <TaskForm
          isOpen={formOpen}
          onClose={() => { setFormOpen(false); setEditingTask(null); }}
          onSave={editingTask ? handleEdit : handleCreate}
          staffUsers={staffUsers}
          initialData={editingTask}
          currentUserId={currentUser.id}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Eye } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import TaskForm from '../../components/TaskForm';
import EmptyState from '../../components/EmptyState';
import type { Task, TaskStatus, TaskPriority } from '../../types';

export default function OfficerTaskList() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks, createTask, updateTask } = useTasks();
  const { users } = useUsers();
  const { areas } = useRanges();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterArea, setFilterArea] = useState('');

  const myRangeId = currentUser?.rangeId ?? '';
  const myTasks = tasks.filter((t) => t.rangeId === myRangeId);
  const myGuards = users.filter((u) => u.role === 'guard' && u.rangeId === myRangeId);
  const myAreas = areas.filter((a) => a.rangeId === myRangeId);

  const filtered = myTasks.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterArea && t.areaId !== filterArea) return false;
    if (search) {
      const q = search.toLowerCase();
      const title = t.title.toLowerCase();
      const assignee = users.find((u) => u.id === t.assigneeId)?.name.toLowerCase() ?? '';
      if (!title.includes(q) && !assignee.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ptr-brown tracking-tight">Range Tasks</h1>
          <p className="text-sm text-ptr-brown-light">{myTasks.length} tasks in your range</p>
        </div>
        <button onClick={() => { setEditingTask(null); setFormOpen(true); }} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Task</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2 lg:col-span-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ptr-brown-light" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field select-field">
          <option value="">All Statuses</option>
          {(['NotStarted', 'InProgress', 'Completed', 'Archived'] as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {s === 'NotStarted' ? 'Not Started' : s === 'InProgress' ? 'In Progress' : s}
            </option>
          ))}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="input-field select-field">
          <option value="">All Priorities</option>
          {(['Critical', 'High', 'Medium', 'Low'] as TaskPriority[]).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} className="input-field select-field">
          <option value="">All Areas</option>
          {myAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <p className="text-xs text-ptr-brown-light">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>

      {filtered.length === 0 ? (
        <EmptyState title="No tasks found" description="Try adjusting your filters or create a new task." />
      ) : (
        <div className="card divide-y divide-ptr-cream-dark overflow-hidden">
          {filtered.map((task) => {
            const assignee = users.find((u) => u.id === task.assigneeId);
            const area = myAreas.find((a) => a.id === task.areaId);
            const overdue = isOverdue(task);
            return (
              <div key={task.id} className="flex items-center gap-3 p-3 hover:bg-ptr-cream/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-ptr-brown truncate">{task.title}</span>
                    {overdue && (
                      <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5 font-medium flex-shrink-0">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-ptr-brown-light">
                    <span>{assignee?.name ?? '—'}</span>
                    {area && <><span>·</span><span>{area.name}</span></>}
                    <span>·</span>
                    <span className={overdue ? 'text-red-600 font-medium' : ''}>{formatDate(task.dueDate)}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1.5 h-1 w-32 bg-ptr-cream-dark rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ptr-green rounded-full"
                      style={{ width: `${task.completionPercentage}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <PriorityBadge priority={task.priority} size="sm" />
                  <StatusBadge status={task.status} size="sm" />
                  <div className="flex items-center gap-1 ml-1">
                    <button
                      onClick={() => navigate(`/officer/tasks/${task.id}`)}
                      className="p-1.5 rounded-lg hover:bg-ptr-cream text-ptr-brown-light hover:text-ptr-brown transition-colors"
                      title="View"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setEditingTask(task); setFormOpen(true); }}
                      className="p-1.5 rounded-lg hover:bg-ptr-cream text-ptr-brown-light hover:text-ptr-brown transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && currentUser && (
        <TaskForm
          isOpen={formOpen}
          onClose={() => { setFormOpen(false); setEditingTask(null); }}
          onSave={(data) => {
            if (editingTask) {
              updateTask.mutate({ id: editingTask.id, ...data });
            } else {
              createTask.mutate(data);
            }
            setFormOpen(false);
            setEditingTask(null);
          }}
          assignableUsers={myGuards}
          initialData={editingTask}
          currentUserId={currentUser.id}
          defaultRangeId={myRangeId}
        />
      )}
    </div>
  );
}

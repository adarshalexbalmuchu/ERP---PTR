import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { uploadTaskAttachment } from '../../lib/attachments';
import TaskForm from '../../components/TaskForm';
import TaskTable from '../../components/TaskTable';
import EmptyState from '../../components/EmptyState';
import { CommandBar, ContextPanel } from '../../components/layout/Slots';
import { Page, PageHeading } from '../../components/layout/Page';
import type { Task } from '../../types';
import { isFieldRole } from '../../types';

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'NotStarted', label: 'Not started' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Archived', label: 'Archived' },
];
const PRIORITY_OPTS: { value: string; label: string }[] = [
  { value: '', label: 'All priorities' },
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

function FilterGroup({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4">
      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-n-70">{label}</div>
      <div className="space-y-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value || 'all'}
              onClick={() => onChange(o.value)}
              className={`w-full text-left px-2.5 h-8 rounded text-13 flex items-center transition-colors ${
                active ? 'bg-ptr-green/10 text-ptr-green font-semibold' : 'text-n-90 hover:bg-n-20'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DirectorTaskList() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks, createTask, updateTask, deleteTask } = useTasks();
  const { users } = useUsers();
  const { ranges } = useRanges();

  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const filterStatus = params.get('status') ?? '';
  const filterPriority = params.get('priority') ?? '';
  const filterRange = params.get('range') ?? '';

  const setParam = (key: string, val: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set(key, val); else next.delete(key);
      return next;
    }, { replace: true });
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = tasks.filter((t) => {
    if (filterRange && t.rangeId !== filterRange) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (search) {
      const q = search.toLowerCase();
      const title = t.title.toLowerCase();
      const assignee = users.find((u) => u.id === t.assigneeId)?.name.toLowerCase() ?? '';
      if (!title.includes(q) && !assignee.includes(q)) return false;
    }
    return true;
  });

  const selectedTasks = filtered.filter((t) => selectedIds.includes(t.id));
  const hasFilters = !!(search || filterStatus || filterPriority || filterRange);

  const handleEdit = (task: Task) => { setEditingTask(task); setFormOpen(true); };
  const handleDelete = (task: Task) => {
    if (confirm(`Delete "${task.title}"? This cannot be undone.`)) deleteTask.mutate(task.id);
  };
  const handleBulkDelete = () => {
    if (selectedTasks.length === 0) return;
    if (confirm(`Delete ${selectedTasks.length} selected task${selectedTasks.length > 1 ? 's' : ''}? This cannot be undone.`)) {
      selectedTasks.forEach((t) => deleteTask.mutate(t.id));
      setSelectedIds([]);
    }
  };
  const clearFilters = () => setParams({}, { replace: true });

  return (
    <>
      <CommandBar>
        <button onClick={() => { setEditingTask(null); setFormOpen(true); }} className="btn-primary"><Plus className="w-4 h-4" />New task</button>
        <button
          onClick={() => selectedTasks.length === 1 && handleEdit(selectedTasks[0])}
          disabled={selectedTasks.length !== 1}
          className="btn-subtle"
        >
          <Pencil className="w-4 h-4" />Edit
        </button>
        <button onClick={handleBulkDelete} disabled={selectedTasks.length === 0} className="btn-subtle">
          <Trash2 className="w-4 h-4" />Delete
        </button>
        {selectedIds.length > 0 && (
          <>
            <span className="w-px h-5 bg-n-30 mx-1" />
            <span className="text-13 text-n-80 whitespace-nowrap">{selectedIds.length} selected</span>
            <button onClick={() => setSelectedIds([])} className="btn-subtle">Clear</button>
          </>
        )}
      </CommandBar>

      <ContextPanel>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-n-70" />
            <input
              value={search}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search tasks…"
              className="input-field pl-8 !min-h-[34px] text-13"
              style={{ fontSize: '16px' }}
            />
          </div>
        </div>
        <FilterGroup label="Status" options={STATUS_OPTS} value={filterStatus} onChange={(v) => setParam('status', v)} />
        <FilterGroup label="Priority" options={PRIORITY_OPTS} value={filterPriority} onChange={(v) => setParam('priority', v)} />
        <FilterGroup
          label="Range"
          options={[{ value: '', label: 'All ranges' }, ...ranges.map((r) => ({ value: r.id, label: r.name }))]}
          value={filterRange}
          onChange={(v) => setParam('range', v)}
        />
      </ContextPanel>

      <Page className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <PageHeading title="Task registry" meta={`${filtered.length} task${filtered.length !== 1 ? 's' : ''}${hasFilters ? ' · filtered' : ''}`} />
          {hasFilters && (
            <button onClick={clearFilters} className="btn-subtle flex-shrink-0"><X className="w-3.5 h-3.5" />Clear filters</button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No tasks found" description="Try adjusting your filters or create a new task." />
        ) : (
          <div className="card overflow-hidden">
            <TaskTable
              tasks={filtered}
              users={users}
              ranges={ranges}
              onOpen={(t) => navigate(`/director/tasks/${t.id}`)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </div>
        )}
      </Page>

      {formOpen && currentUser && (
        <TaskForm
          isOpen={formOpen}
          onClose={() => { setFormOpen(false); setEditingTask(null); }}
          onSave={async (data, files) => {
            if (editingTask) {
              updateTask.mutate({ id: editingTask.id, ...data });
            } else {
              const rows = await createTask.mutateAsync(data);
              for (const row of rows) {
                for (const file of files) {
                  try { await uploadTaskAttachment(row.id, currentUser.id, file); }
                  catch (err) { alert(err instanceof Error ? err.message : `Failed to upload "${file.name}"`); }
                }
              }
            }
            setFormOpen(false);
            setEditingTask(null);
          }}
          assignableUsers={users.filter((u) => isFieldRole(u.role))}
          initialData={editingTask}
          currentUserId={currentUser.id}
          ranges={ranges}
        />
      )}
    </>
  );
}

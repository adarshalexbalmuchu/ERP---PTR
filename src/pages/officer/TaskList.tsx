import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Search, X } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { useOfficerRanges } from '../../hooks/useOfficerRanges';
import { uploadTaskAttachment } from '../../lib/attachments';
import TaskForm from '../../components/TaskForm';
import TaskTable from '../../components/TaskTable';
import EmptyState from '../../components/EmptyState';
import Select from '../../components/Select';
import { CommandBar, ContextPanel } from '../../components/layout/Slots';
import { Page, PageHeading } from '../../components/layout/Page';
import type { Task } from '../../types';
import { isFieldRole } from '../../types';

const STATUS_OPTS = [
  { value: '', label: 'All statuses' },
  { value: 'NotStarted', label: 'Not started' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Archived', label: 'Archived' },
];
const PRIORITY_OPTS = [
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

export default function OfficerTaskList() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks, createTask, updateTask } = useTasks();
  const { users } = useUsers();
  const { ranges, areas } = useRanges();
  const { activeRangeId: myRangeId, rangeIds, setActiveRangeId, isMultiRange } = useOfficerRanges();

  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const filterStatus = params.get('status') ?? '';
  const filterPriority = params.get('priority') ?? '';
  const filterArea = params.get('area') ?? '';

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

  const myTasks = tasks.filter((t) => t.rangeId === myRangeId);
  const myGuards = users.filter((u) => isFieldRole(u.role) && u.rangeId === myRangeId);
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

  const selectedTasks = filtered.filter((t) => selectedIds.includes(t.id));
  const hasFilters = !!(search || filterStatus || filterPriority || filterArea);

  const handleEdit = (task: Task) => { setEditingTask(task); setFormOpen(true); };

  return (
    <>
      <CommandBar>
        <button onClick={() => { setEditingTask(null); setFormOpen(true); }} className="btn-primary"><Plus className="w-4 h-4" />New task</button>
        <button onClick={() => selectedTasks.length === 1 && handleEdit(selectedTasks[0])} disabled={selectedTasks.length !== 1} className="btn-subtle"><Pencil className="w-4 h-4" />Edit</button>
        {isMultiRange && (
          <>
            <span className="w-px h-5 bg-n-30 mx-1" />
            <Select value={myRangeId} onChange={(e) => setActiveRangeId(e.target.value)} className="input-field select-field !w-auto !min-h-[32px] text-13" aria-label="Switch range">
              {rangeIds.map((id) => {
                const r = ranges.find((rr) => rr.id === id);
                return <option key={id} value={id}>{r?.name ?? 'Range'}</option>;
              })}
            </Select>
          </>
        )}
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
            <input value={search} onChange={(e) => setParam('q', e.target.value)} placeholder="Search tasks…" className="input-field pl-8 !min-h-[34px] text-13" style={{ fontSize: '16px' }} />
          </div>
        </div>
        <FilterGroup label="Status" options={STATUS_OPTS} value={filterStatus} onChange={(v) => setParam('status', v)} />
        <FilterGroup label="Priority" options={PRIORITY_OPTS} value={filterPriority} onChange={(v) => setParam('priority', v)} />
        {myAreas.length > 0 && (
          <FilterGroup label="Area / zone" options={[{ value: '', label: 'All areas' }, ...myAreas.map((a) => ({ value: a.id, label: a.name }))]} value={filterArea} onChange={(v) => setParam('area', v)} />
        )}
      </ContextPanel>

      <Page className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <PageHeading title="Task registry" meta={`${filtered.length} task${filtered.length !== 1 ? 's' : ''} in ${ranges.find((r) => r.id === myRangeId)?.name ?? 'your range'}${hasFilters ? ' · filtered' : ''}`} />
          {hasFilters && <button onClick={() => setParams({}, { replace: true })} className="btn-subtle flex-shrink-0"><X className="w-3.5 h-3.5" />Clear filters</button>}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No tasks found" description="Try adjusting your filters or create a new task." />
        ) : (
          <div className="card overflow-hidden">
            <TaskTable
              tasks={filtered}
              users={users}
              ranges={ranges}
              onOpen={(t) => navigate(`/officer/tasks/${t.id}`)}
              onEdit={handleEdit}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              showRange={false}
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
          assignableUsers={myGuards}
          initialData={editingTask}
          currentUserId={currentUser.id}
          defaultRangeId={myRangeId}
        />
      )}
    </>
  );
}

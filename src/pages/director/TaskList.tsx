import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Trash2, Download, Search, X, ChevronDown, MoreHorizontal, UserCog, CircleDashed, CalendarClock,
  Inbox, UserCheck, PenLine, Circle, Clock, CheckCircle2, MapPin,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import { exportCsv } from '../../utils/exportCsv';
import { uploadTaskAttachment } from '../../lib/attachments';
import TaskForm from '../../components/TaskForm';
import TaskTable from '../../components/TaskTable';
import TaskDetailPanel from '../../components/TaskDetailPanel';
import { Menu, MenuItem, MenuLabel, MenuDivider, MenuPanel } from '../../components/ui/Menu';
import { CommandBar, ContextPanel } from '../../components/layout/Slots';
import { PanelSection, PanelItem } from '../../components/layout/PanelNav';
import { Page, PageHeading } from '../../components/layout/Page';
import type { Task, TaskStatus } from '../../types';
import { isFieldRole } from '../../types';

const STATUS_SET: { value: TaskStatus; label: string }[] = [
  { value: 'NotStarted', label: 'Not started' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Completed', label: 'Completed (awaiting review)' },
  { value: 'Archived', label: 'Approved & closed' },
];

export default function DirectorTaskList() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks, isLoading: tasksLoading, createTask, updateTask, deleteTask } = useTasks();
  const { users } = useUsers();
  const { ranges } = useRanges();

  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const priority = params.get('priority') ?? '';
  const range = params.get('range') ?? '';
  const assignee = params.get('assignee') ?? '';
  const creator = params.get('creator') ?? '';
  const view = params.get('view') ?? '';

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [panelTaskId, setPanelTaskId] = useState<string | null>(null);

  const me = currentUser?.id ?? '';
  const isMine = (t: Task) => t.assigneeId === me || t.coAssigneeIds.includes(me);

  const matches = (t: Task) => {
    if (view === 'overdue' && !((t.status === 'NotStarted' || t.status === 'InProgress') && isOverdue(t))) return false;
    if (view === 'review' && t.status !== 'Completed') return false;
    if (assignee === 'me' && !isMine(t)) return false;
    if (creator === 'me' && t.createdById !== me) return false;
    if (status && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (range && t.rangeId !== range) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = users.find((u) => u.id === t.assigneeId)?.name.toLowerCase() ?? '';
      if (!t.title.toLowerCase().includes(q) && !name.includes(q)) return false;
    }
    return true;
  };
  const filtered = tasks.filter(matches);
  const selectedTasks = filtered.filter((t) => selectedIds.includes(t.id));
  const hasSel = selectedTasks.length > 0;

  // Counts for the contextual nav.
  const c = {
    all: tasks.length,
    mine: tasks.filter(isMine).length,
    created: tasks.filter((t) => t.createdById === me).length,
    notStarted: tasks.filter((t) => t.status === 'NotStarted').length,
    inProgress: tasks.filter((t) => t.status === 'InProgress').length,
    review: tasks.filter((t) => t.status === 'Completed').length,
    overdue: tasks.filter((t) => (t.status === 'NotStarted' || t.status === 'InProgress') && isOverdue(t)).length,
    closed: tasks.filter((t) => t.status === 'Archived').length,
  };

  const applyView = (p: Record<string, string>) => setParams(p, { replace: true });
  const noViewFilter = !status && !view && !assignee && !creator && !range && !priority;

  const handleEdit = (task: Task) => { setEditingTask(task); setFormOpen(true); };
  const handleDelete = (task: Task) => { if (confirm(`Delete "${task.title}"? This cannot be undone.`)) deleteTask.mutate(task.id); };

  const bulkStatus = (s: TaskStatus) => { selectedTasks.forEach((t) => updateTask.mutate({ id: t.id, status: s })); setSelectedIds([]); };
  const bulkAssign = (userId: string) => { selectedTasks.forEach((t) => updateTask.mutate({ id: t.id, assigneeId: userId })); setSelectedIds([]); };
  const [dueDraft, setDueDraft] = useState('');
  const bulkDue = () => { if (!dueDraft) return; const iso = new Date(dueDraft + 'T00:00:00').toISOString(); selectedTasks.forEach((t) => updateTask.mutate({ id: t.id, dueDate: iso })); setSelectedIds([]); setDueDraft(''); };
  const bulkDelete = () => { if (confirm(`Delete ${selectedTasks.length} selected task${selectedTasks.length > 1 ? 's' : ''}? This cannot be undone.`)) { selectedTasks.forEach((t) => deleteTask.mutate(t.id)); setSelectedIds([]); } };

  const doExport = () => {
    const rows = filtered.map((t) => ({
      Task: t.title,
      Assignee: users.find((u) => u.id === t.assigneeId)?.name ?? '',
      Range: ranges.find((r) => r.id === t.rangeId)?.name ?? '',
      Priority: t.priority,
      Status: t.status,
      Due: formatDate(t.dueDate),
      Progress: `${t.completionPercentage}%`,
    }));
    exportCsv(`ptr-tasks-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const assignableUsers = users.filter((u) => isFieldRole(u.role));

  return (
    <>
      <CommandBar>
        <button onClick={() => { setEditingTask(null); setFormOpen(true); }} className="btn-primary"><Plus className="w-4 h-4" />New task</button>
        <span className="w-px h-5 bg-n-30 mx-1" />

        {/* Assign (bulk) */}
        {hasSel ? (
          <Menu ariaLabel="Assign selected" button={<><UserCog className="w-4 h-4" />Assign<ChevronDown className="w-3.5 h-3.5 opacity-60" /></>}>
            <MenuLabel>Reassign {selectedTasks.length} task{selectedTasks.length > 1 ? 's' : ''} to</MenuLabel>
            {assignableUsers.map((u) => <MenuItem key={u.id} label={u.name} onClick={() => bulkAssign(u.id)} />)}
          </Menu>
        ) : <button disabled className="btn-subtle"><UserCog className="w-4 h-4" />Assign</button>}

        {/* Change status (bulk) */}
        {hasSel ? (
          <Menu ariaLabel="Change status of selected" button={<><CircleDashed className="w-4 h-4" />Status<ChevronDown className="w-3.5 h-3.5 opacity-60" /></>}>
            <MenuLabel>Set status</MenuLabel>
            {STATUS_SET.map((s) => <MenuItem key={s.value} label={s.label} onClick={() => bulkStatus(s.value)} />)}
          </Menu>
        ) : <button disabled className="btn-subtle"><CircleDashed className="w-4 h-4" />Status</button>}

        {/* Set due date (bulk) */}
        {hasSel ? (
          <Menu ariaLabel="Set due date for selected" width="w-60" button={<><CalendarClock className="w-4 h-4" />Due date<ChevronDown className="w-3.5 h-3.5 opacity-60" /></>}>
            <MenuPanel>
              <label className="block text-xs text-n-70 mb-1">New due date for {selectedTasks.length} task{selectedTasks.length > 1 ? 's' : ''}</label>
              <input type="date" value={dueDraft} onChange={(e) => setDueDraft(e.target.value)} className="input-field !min-h-[34px]" style={{ fontSize: '16px' }} />
              <button onClick={bulkDue} disabled={!dueDraft} className="btn-primary w-full mt-2">Apply</button>
            </MenuPanel>
          </Menu>
        ) : <button disabled className="btn-subtle"><CalendarClock className="w-4 h-4" />Due date</button>}

        <button onClick={doExport} className="btn-subtle"><Download className="w-4 h-4" />Export</button>

        {/* More actions */}
        <Menu ariaLabel="More actions" align="right" button={<MoreHorizontal className="w-4 h-4" />}>
          <MenuItem icon={<Download className="w-4 h-4" />} label="Export all filtered" onClick={doExport} />
          <MenuDivider />
          <MenuItem icon={<Trash2 className="w-4 h-4" />} label={hasSel ? `Delete ${selectedTasks.length} selected` : 'Delete selected'} danger disabled={!hasSel} onClick={bulkDelete} />
        </Menu>

        {hasSel && (
          <>
            <span className="w-px h-5 bg-n-30 mx-1" />
            <span className="text-13 text-n-80 whitespace-nowrap">{selectedIds.length} selected</span>
            <button onClick={() => setSelectedIds([])} className="btn-subtle">Clear</button>
          </>
        )}
      </CommandBar>

      <ContextPanel>
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-n-70" />
            <input value={search} onChange={(e) => setParams((p) => { const n = new URLSearchParams(p); e.target.value ? n.set('q', e.target.value) : n.delete('q'); return n; }, { replace: true })} placeholder="Filter these results…" className="input-field pl-8 !min-h-[34px] text-13" style={{ fontSize: '16px' }} />
          </div>
        </div>

        <PanelSection label="Views">
          <PanelItem icon={<Inbox className="w-4 h-4" />} label="All tasks" active={noViewFilter} count={c.all} onClick={() => applyView({})} />
          <PanelItem icon={<UserCheck className="w-4 h-4" />} label="Assigned to me" active={assignee === 'me'} count={c.mine} onClick={() => applyView({ assignee: 'me' })} />
          <PanelItem icon={<PenLine className="w-4 h-4" />} label="Created by me" active={creator === 'me'} count={c.created} onClick={() => applyView({ creator: 'me' })} />
        </PanelSection>

        <PanelSection label="Status">
          <PanelItem icon={<Circle className="w-4 h-4" />} label="Not started" active={status === 'NotStarted'} count={c.notStarted} onClick={() => applyView({ status: 'NotStarted' })} />
          <PanelItem icon={<CircleDashed className="w-4 h-4" />} label="In progress" active={status === 'InProgress'} count={c.inProgress} onClick={() => applyView({ status: 'InProgress' })} />
          <PanelItem icon={<Clock className="w-4 h-4" />} label="Awaiting review" active={view === 'review'} count={c.review} countTone="amber" onClick={() => applyView({ view: 'review' })} />
          <PanelItem icon={<CalendarClock className="w-4 h-4" />} label="Overdue" active={view === 'overdue'} count={c.overdue} countTone="red" onClick={() => applyView({ view: 'overdue' })} />
          <PanelItem icon={<CheckCircle2 className="w-4 h-4" />} label="Completed" active={status === 'Archived'} count={c.closed} onClick={() => applyView({ status: 'Archived' })} />
        </PanelSection>

        <PanelSection label="Ranges">
          {ranges.map((r) => (
            <PanelItem key={r.id} icon={<MapPin className="w-4 h-4" />} label={r.name} active={range === r.id} count={tasks.filter((t) => t.rangeId === r.id).length} onClick={() => applyView({ range: r.id })} />
          ))}
        </PanelSection>
      </ContextPanel>

      <Page className="space-y-4 h-full flex flex-col">
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <PageHeading title="Task registry" meta={`${filtered.length} task${filtered.length !== 1 ? 's' : ''}${!noViewFilter || search ? ' · filtered' : ''}`} />
          {(!noViewFilter || search) && <button onClick={() => setParams({}, { replace: true })} className="btn-subtle flex-shrink-0"><X className="w-3.5 h-3.5" />Clear filters</button>}
        </div>

        <div className="card overflow-hidden flex-1 min-h-0">
          <TaskTable
            tasks={filtered}
            users={users}
            ranges={ranges}
            loading={tasksLoading && tasks.length === 0}
            scroll
            onOpen={(t) => setPanelTaskId(t.id)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReassign={handleEdit}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>
      </Page>

      <TaskDetailPanel taskId={panelTaskId} onClose={() => setPanelTaskId(null)} onOpenFull={(id) => navigate(`/director/tasks/${id}`)} />

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
          assignableUsers={assignableUsers}
          initialData={editingTask}
          currentUserId={currentUser.id}
          ranges={ranges}
        />
      )}
    </>
  );
}

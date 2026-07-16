import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Download, Search, X, ChevronDown, MoreHorizontal, UserCog, CircleDashed, CalendarClock,
  Inbox, UserCheck, PenLine, Circle, Clock, CheckCircle2, MapPin, Filter, RefreshCw,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { useIsMobile } from '../../hooks/useIsMobile';
import { usePanelToggle } from '../../contexts/PanelToggleContext';
import { isOverdue } from '../../utils/overdue';
import { matchesTaskSearch } from '../../utils/taskSearch';
import { formatDate } from '../../utils/formatters';
import { exportCsv } from '../../utils/exportCsv';
import { uploadTaskAttachment } from '../../lib/attachments';
import { describeBulkOutcome } from '../../lib/mutationVerification';
import TaskForm from '../../components/TaskForm';
import TaskTable from '../../components/TaskTable';
import TaskDetailPanel from '../../components/TaskDetailPanel';
import MobileTaskList from '../mobile/MobileTaskList';
import { Menu, MenuItem, MenuLabel, MenuDivider, MenuPanel } from '../../components/ui/Menu';
import { CommandBar, ContextPanel } from '../../components/layout/Slots';
import { PanelSection, PanelItem } from '../../components/layout/PanelNav';
import { Page, PageHeading } from '../../components/layout/Page';
import type { Task, TaskStatus } from '../../types';
import { isFieldRole } from '../../types';
import { getErrorMessage } from '../../lib/errors';

const STATUS_SET: { value: TaskStatus; label: string }[] = [
  { value: 'NotStarted', label: 'Not started' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Completed', label: 'Completed (awaiting review)' },
  { value: 'Archived', label: 'Approved & closed' },
];

export default function DirectorTaskList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks, isLoading: tasksLoading, createTask, updateTask, deleteTask, bulkUpdateTasks } = useTasks();
  const { users } = useUsers();
  const { ranges, areas } = useRanges();
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const panelToggle = usePanelToggle();

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
      const name = users.find((u) => u.id === t.assigneeId)?.name ?? '';
      if (!matchesTaskSearch(t.title, name, search)) return false;
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

  const runBulkUpdate = async (ids: string[], patch: Parameters<typeof bulkUpdateTasks.mutateAsync>[0]['patch']) => {
    setSelectedIds([]);
    try {
      const result = await bulkUpdateTasks.mutateAsync({ ids, patch });
      alert(describeBulkOutcome(result, ids.length, 'tasks'));
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to update the selected tasks.'));
    }
  };
  const bulkStatus = (s: TaskStatus) => void runBulkUpdate(selectedIds, { status: s });
  const bulkAssign = (userId: string) => void runBulkUpdate(selectedIds, { assigneeId: userId });
  const [dueDraft, setDueDraft] = useState('');
  const bulkDue = () => {
    if (!dueDraft) return;
    const iso = new Date(dueDraft + 'T00:00:00').toISOString();
    void runBulkUpdate(selectedIds, { dueDate: iso });
    setDueDraft('');
  };
  const bulkDelete = () => { if (confirm(`Delete ${selectedTasks.length} selected task${selectedTasks.length > 1 ? 's' : ''}? This cannot be undone.`)) { selectedTasks.forEach((t) => deleteTask.mutate(t.id)); setSelectedIds([]); } };

  const toExportRows = (rows: Task[]) => rows.map((t) => ({
    Task: t.title,
    Assignee: users.find((u) => u.id === t.assigneeId)?.name ?? '',
    Range: ranges.find((r) => r.id === t.rangeId)?.name ?? '',
    Priority: t.priority,
    Status: t.status,
    Due: formatDate(t.dueDate),
    Progress: `${t.completionPercentage}%`,
  }));
  const doExport = () => exportCsv(`ptr-tasks-${new Date().toISOString().slice(0, 10)}.csv`, toExportRows(filtered));
  const doExportSelected = () => exportCsv(`ptr-tasks-selected-${new Date().toISOString().slice(0, 10)}.csv`, toExportRows(selectedTasks));
  const doRefresh = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });

  const assignableUsers = users.filter((u) => isFieldRole(u.role));

  if (isMobile) {
    return (
      <>
        <MobileTaskList
          title="Task registry"
          tasks={tasks}
          users={users}
          ranges={ranges}
          areas={areas}
          loading={tasksLoading && tasks.length === 0}
          onOpen={(t) => navigate(`/director/tasks/${t.id}`)}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
          onNewTask={() => setMobileFormOpen(true)}
        />
        {mobileFormOpen && currentUser && (
          <TaskForm
            isOpen={mobileFormOpen}
            onClose={() => setMobileFormOpen(false)}
            onSave={async (data, files) => {
              const rows = await createTask.mutateAsync(data);
              for (const row of rows) {
                for (const file of files) {
                  try { await uploadTaskAttachment(row.id, currentUser.id, file); }
                  catch (err) { alert(getErrorMessage(err, `Failed to upload "${file.name}"`)); }
                }
              }
              setMobileFormOpen(false);
            }}
            assignableUsers={assignableUsers}
            initialData={null}
            currentUserId={currentUser.id}
            ranges={ranges}
          />
        )}
      </>
    );
  }

  return (
    <>
      <CommandBar>
        {hasSel ? (
          <>
            <span className="text-13 font-semibold text-n-90 whitespace-nowrap">{selectedIds.length} selected</span>
            <span className="w-px h-5 bg-n-30 mx-1" />

            <Menu ariaLabel="Assign selected" button={<><UserCog className="w-4 h-4" />Assign<ChevronDown className="w-3.5 h-3.5 opacity-60" /></>}>
              <MenuLabel>Reassign {selectedTasks.length} task{selectedTasks.length > 1 ? 's' : ''} to</MenuLabel>
              {assignableUsers.map((u) => <MenuItem key={u.id} label={u.name} onClick={() => bulkAssign(u.id)} />)}
            </Menu>

            <Menu ariaLabel="Change status of selected" button={<><CircleDashed className="w-4 h-4" />Status<ChevronDown className="w-3.5 h-3.5 opacity-60" /></>}>
              <MenuLabel>Set status</MenuLabel>
              {STATUS_SET.map((s) => <MenuItem key={s.value} label={s.label} onClick={() => bulkStatus(s.value)} />)}
            </Menu>

            <Menu ariaLabel="Set due date for selected" width="w-60" button={<><CalendarClock className="w-4 h-4" />Due date<ChevronDown className="w-3.5 h-3.5 opacity-60" /></>}>
              <MenuPanel>
                <label className="block text-xs text-n-70 mb-1">New due date for {selectedTasks.length} task{selectedTasks.length > 1 ? 's' : ''}</label>
                <input type="date" value={dueDraft} onChange={(e) => setDueDraft(e.target.value)} className="input-field !min-h-[34px]" style={{ fontSize: '16px' }} />
                <button onClick={bulkDue} disabled={!dueDraft} className="btn-primary w-full mt-2">Apply</button>
              </MenuPanel>
            </Menu>

            <button onClick={doExportSelected} className="btn-subtle"><Download className="w-4 h-4" />Export selected</button>
            <button onClick={() => setSelectedIds([])} className="btn-subtle">Clear selection</button>

            <Menu ariaLabel="More actions" align="right" button={<MoreHorizontal className="w-4 h-4" />}>
              <MenuItem icon={<Download className="w-4 h-4" />} label="Export all filtered" onClick={doExport} />
              <MenuDivider />
              <MenuItem icon={<Trash2 className="w-4 h-4" />} label={`Delete ${selectedTasks.length} selected`} danger onClick={bulkDelete} />
            </Menu>
          </>
        ) : (
          <>
            <button onClick={() => { setEditingTask(null); setFormOpen(true); }} className="btn-primary"><Plus className="w-4 h-4" />New task</button>
            <button onClick={() => panelToggle?.toggle()} className="btn-subtle"><Filter className="w-4 h-4" />Filter</button>
            <button onClick={doRefresh} className="btn-subtle"><RefreshCw className="w-4 h-4" />Refresh</button>
            <button onClick={doExport} className="btn-subtle"><Download className="w-4 h-4" />Export</button>

            <Menu ariaLabel="More actions" align="right" button={<MoreHorizontal className="w-4 h-4" />}>
              <MenuItem
                icon={<Trash2 className="w-4 h-4" />}
                label="Delete selected"
                danger
                disabled
                title="Select one or more tasks to delete them."
                onClick={() => {}}
              />
            </Menu>
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
                  catch (err) { alert(getErrorMessage(err, `Failed to upload "${file.name}"`)); }
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

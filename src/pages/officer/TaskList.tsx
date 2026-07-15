import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Download, Search, X, ChevronDown, UserCog, CircleDashed, CalendarClock,
  Inbox, UserCheck, PenLine, Circle, Clock, CheckCircle2, MapPin,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { useOfficerRanges } from '../../hooks/useOfficerRanges';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import { exportCsv } from '../../utils/exportCsv';
import { uploadTaskAttachment } from '../../lib/attachments';
import TaskForm from '../../components/TaskForm';
import TaskTable from '../../components/TaskTable';
import TaskDetailPanel from '../../components/TaskDetailPanel';
import Select from '../../components/Select';
import { Menu, MenuItem, MenuLabel, MenuPanel } from '../../components/ui/Menu';
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

export default function OfficerTaskList() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks, isLoading: tasksLoading, createTask, updateTask } = useTasks();
  const { users } = useUsers();
  const { ranges, areas } = useRanges();
  const { activeRangeId: myRangeId, rangeIds, setActiveRangeId, isMultiRange } = useOfficerRanges();

  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const priority = params.get('priority') ?? '';
  const area = params.get('area') ?? '';
  const assignee = params.get('assignee') ?? '';
  const creator = params.get('creator') ?? '';
  const view = params.get('view') ?? '';

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [panelTaskId, setPanelTaskId] = useState<string | null>(null);
  const [dueDraft, setDueDraft] = useState('');

  const me = currentUser?.id ?? '';
  const isMine = (t: Task) => t.assigneeId === me || t.coAssigneeIds.includes(me);
  const myTasks = tasks.filter((t) => t.rangeId === myRangeId);
  const myGuards = users.filter((u) => isFieldRole(u.role) && u.rangeId === myRangeId);
  const myAreas = areas.filter((a) => a.rangeId === myRangeId);

  const matches = (t: Task) => {
    if (view === 'overdue' && !((t.status === 'NotStarted' || t.status === 'InProgress') && isOverdue(t))) return false;
    if (view === 'review' && t.status !== 'Completed') return false;
    if (assignee === 'me' && !isMine(t)) return false;
    if (creator === 'me' && t.createdById !== me) return false;
    if (status && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (area && t.areaId !== area) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = users.find((u) => u.id === t.assigneeId)?.name.toLowerCase() ?? '';
      if (!t.title.toLowerCase().includes(q) && !name.includes(q)) return false;
    }
    return true;
  };
  const filtered = myTasks.filter(matches);
  const selectedTasks = filtered.filter((t) => selectedIds.includes(t.id));
  const hasSel = selectedTasks.length > 0;

  const cnt = {
    all: myTasks.length,
    mine: myTasks.filter(isMine).length,
    created: myTasks.filter((t) => t.createdById === me).length,
    notStarted: myTasks.filter((t) => t.status === 'NotStarted').length,
    inProgress: myTasks.filter((t) => t.status === 'InProgress').length,
    review: myTasks.filter((t) => t.status === 'Completed').length,
    overdue: myTasks.filter((t) => (t.status === 'NotStarted' || t.status === 'InProgress') && isOverdue(t)).length,
    closed: myTasks.filter((t) => t.status === 'Archived').length,
  };

  const applyView = (p: Record<string, string>) => setParams(p, { replace: true });
  const noViewFilter = !status && !view && !assignee && !creator && !area && !priority;

  const handleEdit = (task: Task) => { setEditingTask(task); setFormOpen(true); };
  const bulkStatus = (s: TaskStatus) => { selectedTasks.forEach((t) => updateTask.mutate({ id: t.id, status: s })); setSelectedIds([]); };
  const bulkAssign = (userId: string) => { selectedTasks.forEach((t) => updateTask.mutate({ id: t.id, assigneeId: userId })); setSelectedIds([]); };
  const bulkDue = () => { if (!dueDraft) return; const iso = new Date(dueDraft + 'T00:00:00').toISOString(); selectedTasks.forEach((t) => updateTask.mutate({ id: t.id, dueDate: iso })); setSelectedIds([]); setDueDraft(''); };
  const doExport = () => exportCsv(`ptr-tasks-${new Date().toISOString().slice(0, 10)}.csv`, filtered.map((t) => ({
    Task: t.title, Assignee: users.find((u) => u.id === t.assigneeId)?.name ?? '', Priority: t.priority, Status: t.status, Due: formatDate(t.dueDate), Progress: `${t.completionPercentage}%`,
  })));

  return (
    <>
      <CommandBar>
        <button onClick={() => { setEditingTask(null); setFormOpen(true); }} className="btn-primary"><Plus className="w-4 h-4" />New task</button>
        <span className="w-px h-5 bg-n-30 mx-1" />
        {hasSel ? (
          <Menu ariaLabel="Assign selected" button={<><UserCog className="w-4 h-4" />Assign<ChevronDown className="w-3.5 h-3.5 opacity-60" /></>}>
            <MenuLabel>Reassign {selectedTasks.length} task{selectedTasks.length > 1 ? 's' : ''} to</MenuLabel>
            {myGuards.map((u) => <MenuItem key={u.id} label={u.name} onClick={() => bulkAssign(u.id)} />)}
          </Menu>
        ) : <button disabled className="btn-subtle"><UserCog className="w-4 h-4" />Assign</button>}
        {hasSel ? (
          <Menu ariaLabel="Change status" button={<><CircleDashed className="w-4 h-4" />Status<ChevronDown className="w-3.5 h-3.5 opacity-60" /></>}>
            <MenuLabel>Set status</MenuLabel>
            {STATUS_SET.map((s) => <MenuItem key={s.value} label={s.label} onClick={() => bulkStatus(s.value)} />)}
          </Menu>
        ) : <button disabled className="btn-subtle"><CircleDashed className="w-4 h-4" />Status</button>}
        {hasSel ? (
          <Menu ariaLabel="Set due date" width="w-60" button={<><CalendarClock className="w-4 h-4" />Due date<ChevronDown className="w-3.5 h-3.5 opacity-60" /></>}>
            <MenuPanel>
              <label className="block text-xs text-n-70 mb-1">New due date for {selectedTasks.length} task{selectedTasks.length > 1 ? 's' : ''}</label>
              <input type="date" value={dueDraft} onChange={(e) => setDueDraft(e.target.value)} className="input-field !min-h-[34px]" style={{ fontSize: '16px' }} />
              <button onClick={bulkDue} disabled={!dueDraft} className="btn-primary w-full mt-2">Apply</button>
            </MenuPanel>
          </Menu>
        ) : <button disabled className="btn-subtle"><CalendarClock className="w-4 h-4" />Due date</button>}
        <button onClick={doExport} className="btn-subtle"><Download className="w-4 h-4" />Export</button>
        {isMultiRange && (
          <>
            <span className="w-px h-5 bg-n-30 mx-1" />
            <Select value={myRangeId} onChange={(e) => setActiveRangeId(e.target.value)} className="input-field select-field !w-auto !min-h-[32px] text-13" aria-label="Switch range">
              {rangeIds.map((id) => { const r = ranges.find((rr) => rr.id === id); return <option key={id} value={id}>{r?.name ?? 'Range'}</option>; })}
            </Select>
          </>
        )}
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
          <PanelItem icon={<Inbox className="w-4 h-4" />} label="All tasks" active={noViewFilter} count={cnt.all} onClick={() => applyView({})} />
          <PanelItem icon={<UserCheck className="w-4 h-4" />} label="Assigned to me" active={assignee === 'me'} count={cnt.mine} onClick={() => applyView({ assignee: 'me' })} />
          <PanelItem icon={<PenLine className="w-4 h-4" />} label="Created by me" active={creator === 'me'} count={cnt.created} onClick={() => applyView({ creator: 'me' })} />
        </PanelSection>
        <PanelSection label="Status">
          <PanelItem icon={<Circle className="w-4 h-4" />} label="Not started" active={status === 'NotStarted'} count={cnt.notStarted} onClick={() => applyView({ status: 'NotStarted' })} />
          <PanelItem icon={<CircleDashed className="w-4 h-4" />} label="In progress" active={status === 'InProgress'} count={cnt.inProgress} onClick={() => applyView({ status: 'InProgress' })} />
          <PanelItem icon={<Clock className="w-4 h-4" />} label="Awaiting review" active={view === 'review'} count={cnt.review} countTone="amber" onClick={() => applyView({ view: 'review' })} />
          <PanelItem icon={<CalendarClock className="w-4 h-4" />} label="Overdue" active={view === 'overdue'} count={cnt.overdue} countTone="red" onClick={() => applyView({ view: 'overdue' })} />
          <PanelItem icon={<CheckCircle2 className="w-4 h-4" />} label="Completed" active={status === 'Archived'} count={cnt.closed} onClick={() => applyView({ status: 'Archived' })} />
        </PanelSection>
        {myAreas.length > 0 && (
          <PanelSection label="Areas / zones">
            {myAreas.map((a) => (
              <PanelItem key={a.id} icon={<MapPin className="w-4 h-4" />} label={a.name} active={area === a.id} count={myTasks.filter((t) => t.areaId === a.id).length} onClick={() => applyView({ area: a.id })} />
            ))}
          </PanelSection>
        )}
      </ContextPanel>

      <Page className="space-y-4 h-full flex flex-col">
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <PageHeading title="Task registry" meta={`${filtered.length} task${filtered.length !== 1 ? 's' : ''} in ${ranges.find((r) => r.id === myRangeId)?.name ?? 'your range'}${!noViewFilter || search ? ' · filtered' : ''}`} />
          {(!noViewFilter || search) && <button onClick={() => setParams({}, { replace: true })} className="btn-subtle flex-shrink-0"><X className="w-3.5 h-3.5" />Clear filters</button>}
        </div>
        <div className="card overflow-hidden flex-1 min-h-0">
          <TaskTable
            tasks={filtered}
            users={users}
            ranges={ranges}
            loading={tasksLoading && tasks.length === 0}
            scroll
            showRange={false}
            onOpen={(t) => setPanelTaskId(t.id)}
            onEdit={handleEdit}
            onReassign={handleEdit}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>
      </Page>

      <TaskDetailPanel taskId={panelTaskId} onClose={() => setPanelTaskId(null)} onOpenFull={(id) => navigate(`/officer/tasks/${id}`)} />

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

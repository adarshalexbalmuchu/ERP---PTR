import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, CheckCircle2, PlayCircle, Send, Camera } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useRanges } from '../../hooks/useRanges';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import StatusBadge from '../../components/StatusBadge';
import { isOverdue } from '../../utils/overdue';
import { formatDate, formatDueRelative } from '../../utils/formatters';
import type { Task } from '../../types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-n-70 px-4 mb-1.5">{children}</div>;
}

function TaskLine({ task, onClick }: { task: Task; onClick: () => void }) {
  const done = task.status === 'Completed' || task.status === 'Archived';
  const due = formatDueRelative(task.dueDate, done);
  const dueClass = due.tone === 'overdue' ? 'text-signal-red font-semibold' : due.tone === 'soon' ? 'text-signal-amber font-medium' : 'text-n-70';
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-n-20 last:border-0 active:bg-n-10">
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium text-n-100 truncate">{task.title}</div>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge status={task.status} size="sm" />
          <span className={`text-xs ${dueClass}`}>{due.text || formatDate(task.dueDate)}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
    </button>
  );
}

export default function FieldHome() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks, isLoading } = useTasks();
  const { ranges } = useRanges();
  const { state: syncState } = useSyncStatus();

  const myTasks = tasks.filter((t) => t.assigneeId === currentUser?.id || t.coAssigneeIds.includes(currentUser?.id ?? ''));
  const overdueTasks = myTasks.filter((t) => (t.status === 'NotStarted' || t.status === 'InProgress') && isOverdue(t));
  const notStarted = myTasks.filter((t) => t.status === 'NotStarted');
  const inProgress = myTasks.filter((t) => t.status === 'InProgress');
  const awaitingSubmission = inProgress; // started but not yet submitted for review
  const todayTasks = myTasks.filter((t) => t.status !== 'Completed' && t.status !== 'Archived');

  // "Current task" — whatever's actively in progress, most urgent first;
  // otherwise the next not-started task waiting to be picked up.
  const byUrgency = (list: Task[]) => [...list].sort((a, b) => {
    const aOv = isOverdue(a), bOv = isOverdue(b);
    if (aOv !== bOv) return aOv ? -1 : 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
  const currentTask = byUrgency(inProgress)[0];
  const nextTask = byUrgency(notStarted)[0];
  const myRangeName = currentUser?.rangeId ? ranges.find((r) => r.id === currentUser.rangeId)?.name : undefined;

  const goToTask = (t: Task) => navigate(`/guard/tasks/${t.id}`);

  return (
    <div className="pb-4">
      {/* Greeting + sync status */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold text-n-100">{greeting()}, {currentUser?.name?.split(' ')[0]}</h1>
        <p className="text-13 text-n-70 mt-0.5">
          {myRangeName ? `${myRangeName} · ` : ''}
          {syncState === 'offline' ? 'Working offline — changes will sync automatically' : syncState === 'syncing' ? 'Syncing…' : 'Up to date'}
        </p>
      </div>

      {/* Primary action */}
      <div className="px-4 mb-4">
        {currentTask ? (
          <button onClick={() => goToTask(currentTask)} className="w-full bg-ptr-green text-white rounded-lg p-4 text-left">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/75"><PlayCircle className="w-3.5 h-3.5" />Continue task</div>
            <div className="text-[17px] font-semibold mt-1 truncate">{currentTask.title}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-13 text-white/80">{currentTask.completionPercentage}% complete</span>
              <span className="inline-flex items-center gap-1 text-13 font-medium">Submit when ready<Send className="w-3.5 h-3.5" /></span>
            </div>
          </button>
        ) : nextTask ? (
          <button onClick={() => goToTask(nextTask)} className="w-full bg-ptr-green text-white rounded-lg p-4 text-left">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/75"><CheckCircle2 className="w-3.5 h-3.5" />Start next task</div>
            <div className="text-[17px] font-semibold mt-1 truncate">{nextTask.title}</div>
            <div className="text-13 text-white/80 mt-2">Due {formatDate(nextTask.dueDate)} · Tap to accept &amp; start</div>
          </button>
        ) : (
          !isLoading && (
            <div className="w-full bg-n-10 border border-n-30 rounded-lg p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-signal-green mx-auto mb-1.5" />
              <div className="text-[15px] font-semibold text-n-100">All caught up</div>
              <div className="text-13 text-n-70 mt-0.5">No active tasks right now.</div>
            </div>
          )
        )}
      </div>

      {/* Quick report incident */}
      <div className="px-4 mb-5">
        <button
          onClick={() => navigate('/guard/incidents?report=1')}
          className="w-full flex items-center justify-center gap-2 h-12 rounded border border-signal-red/40 text-signal-red font-semibold text-[15px]"
        >
          <AlertTriangle className="w-4 h-4" />Report incident
        </button>
      </div>

      {/* My work today */}
      <div className="mb-4">
        <SectionLabel>My work today ({todayTasks.length})</SectionLabel>
        {todayTasks.length === 0 ? (
          <p className="text-13 text-n-70 px-4">Nothing assigned right now.</p>
        ) : (
          <div className="bg-white">
            {todayTasks.slice(0, 5).map((t) => <TaskLine key={t.id} task={t} onClick={() => goToTask(t)} />)}
          </div>
        )}
      </div>

      {/* Overdue */}
      {overdueTasks.length > 0 && (
        <div className="mb-4">
          <SectionLabel>Overdue ({overdueTasks.length})</SectionLabel>
          <div className="bg-signal-red-bg/50">
            {overdueTasks.map((t) => <TaskLine key={t.id} task={t} onClick={() => goToTask(t)} />)}
          </div>
        </div>
      )}

      {/* Awaiting submission */}
      {awaitingSubmission.length > 0 && (
        <div className="mb-4">
          <SectionLabel><span className="inline-flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" />Awaiting evidence / submission ({awaitingSubmission.length})</span></SectionLabel>
          <div className="bg-white">
            {awaitingSubmission.map((t) => <TaskLine key={t.id} task={t} onClick={() => goToTask(t)} />)}
          </div>
        </div>
      )}

      <div className="px-4 mt-2">
        <button onClick={() => navigate('/guard/tasks')} className="w-full h-11 flex items-center justify-center gap-1.5 text-13 font-medium text-ptr-accent border border-n-30 rounded">
          View all my tasks<ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

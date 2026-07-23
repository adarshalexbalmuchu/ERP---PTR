import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Ban, MoreHorizontal, UserCog, CalendarClock, X } from 'lucide-react';
import useStore from '../../store/useStore';
import { useOccurrence } from '../../hooks/useOccurrence';
import { useTaskGroup } from '../../hooks/useTaskGroup';
import { useGroupMessages } from '../../hooks/useGroupMessages';
import { useUsers } from '../../hooks/useUsers';
import { canManageTaskGroups } from '../../lib/permissions';
import { isFieldRole } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import MessageThread from '../../components/MessageThread';
import BottomSheet from '../../components/mobile/BottomSheet';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../utils/formatters';
import type { Task } from '../../types';

function ProgressBar({ progress }: { progress: { total: number; completed: number; awaitingReview: number; inProgress: number; notStarted: number } }) {
  if (progress.total === 0) return null;
  const seg = (n: number) => `${(n / progress.total) * 100}%`;
  return (
    <div className="space-y-2">
      <div className="h-2 rounded-full overflow-hidden bg-n-20 flex">
        <div style={{ width: seg(progress.completed) }} className="bg-ptr-green" />
        <div style={{ width: seg(progress.awaitingReview) }} className="bg-signal-amber" />
        <div style={{ width: seg(progress.inProgress) }} className="bg-ptr-accent" />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-13 text-n-80">
        <span>{progress.total} members</span>
        <span className="text-ptr-green font-medium">{progress.completed} done</span>
        <span className="text-signal-amber font-medium">{progress.awaitingReview} review</span>
        <span className="text-ptr-accent font-medium">{progress.inProgress} active</span>
        <span>{progress.notStarted} not started</span>
      </div>
    </div>
  );
}

export default function MobileOccurrenceDetail() {
  const { id, occId } = useParams<{ id: string; occId: string }>();
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const {
    occurrence, memberTasks, conversationId, progress, isLoading, cancelOccurrence,
    reassignMemberTask, extendMemberTaskDueDate, cancelMemberTask,
  } = useOccurrence(occId);
  const { group, members } = useTaskGroup(id);
  const { messages, postMessage, setPinned, redactMessage } = useGroupMessages(conversationId);
  const { users } = useUsers();

  const [actionsFor, setActionsFor] = useState<Task | null>(null);
  const [reassignSheetOpen, setReassignSheetOpen] = useState(false);
  const [dueSheetOpen, setDueSheetOpen] = useState(false);
  const [dueDraft, setDueDraft] = useState('');

  const canManage = canManageTaskGroups(currentUser?.role);
  const isParticipant = memberTasks.some((t) => t.assigneeId === currentUser?.id || t.coAssigneeIds.includes(currentUser?.id ?? ''));
  const isCoordinator = members.some((m) => m.userId === currentUser?.id && m.membershipRole === 'coordinator');

  if (isLoading) return <div className="p-4"><div className="skeleton h-40" /></div>;
  if (!occurrence) return <div className="p-6 text-center text-13 text-n-70">Assignment not found, or you don't have access to it.</div>;

  const taskRoute = currentUser?.role === 'director' ? '/director' : currentUser?.role === 'range_officer' ? '/officer' : '/guard';
  const assigneeName = (t: Task) => users.find((u) => u.id === t.assigneeId)?.name ?? '—';
  const closeActions = () => { setActionsFor(null); setReassignSheetOpen(false); setDueSheetOpen(false); };

  const runReassign = async (newAssigneeId: string) => {
    if (!actionsFor) return;
    const taskId = actionsFor.id;
    closeActions();
    try { await reassignMemberTask.mutateAsync({ taskId, newAssigneeId }); }
    catch (err) { alert(getErrorMessage(err, 'Failed to reassign this task.')); }
  };
  const runExtendDue = async () => {
    if (!actionsFor || !dueDraft) return;
    const taskId = actionsFor.id;
    closeActions();
    try { await extendMemberTaskDueDate.mutateAsync({ taskId, dueDate: dueDraft }); }
    catch (err) { alert(getErrorMessage(err, 'Failed to update the due date.')); }
  };
  const runCancelMemberTask = async () => {
    if (!actionsFor || !confirm(`Remove ${assigneeName(actionsFor)}'s task from this assignment?`)) return;
    const taskId = actionsFor.id;
    closeActions();
    try { await cancelMemberTask.mutateAsync(taskId); }
    catch (err) { alert(getErrorMessage(err, 'Failed to remove this task.')); }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-n-100">{occurrence.title}</h1>
          <p className="text-13 text-n-70 mt-0.5">{group?.name ?? 'Task Group'} · Due {formatDateTime(occurrence.dueAt)}</p>
        </div>
      </div>

      {occurrence.description && <p className="text-13 text-n-90">{occurrence.description}</p>}

      <div className="bg-white border border-n-30 rounded-lg p-3">
        <ProgressBar progress={progress} />
      </div>

      {canManage && occurrence.status !== 'cancelled' && occurrence.status !== 'completed' && (
        <button
          onClick={() => { if (confirm('Cancel this entire assignment?')) cancelOccurrence.mutate(); }}
          className="btn-secondary w-full !text-signal-red"
        >
          <Ban className="w-4 h-4" />Cancel assignment
        </button>
      )}

      <div>
        <div className="text-13 font-semibold text-n-90 mb-2">Member tasks</div>
        <div className="bg-white divide-y divide-n-20 -mx-4">
          {memberTasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <button onClick={() => navigate(`${taskRoute}/tasks/${t.id}`)} className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left active:opacity-70">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-n-100 truncate">{assigneeName(t)}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={t.status} size="sm" />
                    <PriorityBadge priority={t.priority} size="sm" />
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
              </button>
              {canManage && (
                <button
                  onClick={() => { setActionsFor(t); setDueDraft(t.dueDate.slice(0, 10)); }}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-n-70 active:bg-n-10 flex-shrink-0"
                  aria-label={`Actions for ${assigneeName(t)}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {currentUser && (
        <div>
          <div className="text-13 font-semibold text-n-90 mb-2">Discussion</div>
          <MessageThread
            messages={messages}
            users={users}
            currentUser={currentUser}
            canPost={canManage || isParticipant}
            disabledReason="Only assigned members and officers can post here."
            onSend={(body) => postMessage.mutateAsync(body)}
            emptyLabel="No messages yet."
            onPin={canManage || isCoordinator ? (messageId, pinned) => setPinned.mutateAsync({ messageId, pinned }) : undefined}
            onRedact={(messageId) => redactMessage.mutateAsync(messageId)}
          />
        </div>
      )}

      <BottomSheet open={!!actionsFor && !reassignSheetOpen && !dueSheetOpen} onClose={closeActions} title={actionsFor ? assigneeName(actionsFor) : undefined}>
        {actionsFor && (
          <div className="py-1 pb-3">
            <button onClick={() => setReassignSheetOpen(true)} className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10">
              <UserCog className="w-5 h-5 text-n-70" />Reassign this task
            </button>
            <button onClick={() => setDueSheetOpen(true)} className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10">
              <CalendarClock className="w-5 h-5 text-n-70" />Extend due date
            </button>
            <button onClick={() => void runCancelMemberTask()} className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-signal-red active:bg-signal-red-bg">
              <X className="w-5 h-5" />Remove from this assignment
            </button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={reassignSheetOpen} onClose={closeActions} title="Reassign to (this task only)">
        <div className="py-1 pb-3 max-h-[60dvh] overflow-y-auto">
          {users.filter((u) => isFieldRole(u.role) && u.id !== actionsFor?.assigneeId).map((u) => (
            <button key={u.id} onClick={() => void runReassign(u.id)} className="w-full flex items-center px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10 text-left">
              {u.name}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={dueSheetOpen} onClose={closeActions} title="Extend due date">
        <div className="p-4 space-y-3">
          <input type="date" value={dueDraft} onChange={(e) => setDueDraft(e.target.value)} className="input-field" style={{ fontSize: '16px' }} />
          <button onClick={() => void runExtendDue()} disabled={!dueDraft} className="btn-primary w-full">Save</button>
        </div>
      </BottomSheet>
    </div>
  );
}

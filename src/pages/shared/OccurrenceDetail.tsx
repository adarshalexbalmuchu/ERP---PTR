import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Ban, MoreHorizontal, X } from 'lucide-react';
import useStore from '../../store/useStore';
import { useOccurrence } from '../../hooks/useOccurrence';
import { useTaskGroup } from '../../hooks/useTaskGroup';
import { useGroupMessages } from '../../hooks/useGroupMessages';
import { useUsers } from '../../hooks/useUsers';
import { useIsMobile } from '../../hooks/useIsMobile';
import { canManageTaskGroups } from '../../lib/permissions';
import { isFieldRole } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import EmptyState from '../../components/EmptyState';
import MessageThread from '../../components/MessageThread';
import { Menu, MenuItem, MenuLabel, MenuDivider, MenuPanel } from '../../components/ui/Menu';
import { Page, PageHeading } from '../../components/layout/Page';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../utils/formatters';
import MobileOccurrenceDetail from '../mobile/MobileOccurrenceDetail';
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
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-13 text-n-80">
        <span>{progress.total} members</span>
        <span className="text-ptr-green font-medium">{progress.completed} completed</span>
        <span className="text-signal-amber font-medium">{progress.awaitingReview} awaiting review</span>
        <span className="text-ptr-accent font-medium">{progress.inProgress} in progress</span>
        <span>{progress.notStarted} not started</span>
      </div>
    </div>
  );
}

function MemberTaskRow({
  task, assigneeName, canManage, reassignChoices, onOpen, onReassign, onExtendDue, onCancel,
}: {
  task: Task;
  assigneeName: string;
  canManage: boolean;
  reassignChoices: { id: string; name: string }[];
  onOpen: () => void;
  onReassign: (newAssigneeId: string) => void;
  onExtendDue: (dueDate: string) => void;
  onCancel: () => void;
}) {
  const [dueDraft, setDueDraft] = useState(task.dueDate.slice(0, 10));
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5">
      <button onClick={onOpen} className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left hover:opacity-80">
        <div className="min-w-0">
          <div className="text-13 font-medium text-n-100 truncate">{assigneeName}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge status={task.status} size="sm" />
            <PriorityBadge priority={task.priority} size="sm" />
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
      </button>
      {canManage && (
        <Menu ariaLabel={`Actions for ${assigneeName}`} buttonClassName="w-8 h-8 flex items-center justify-center rounded text-n-70 hover:bg-n-20 flex-shrink-0" button={<MoreHorizontal className="w-4 h-4" />}>
          <MenuLabel>Reassign to (this task only)</MenuLabel>
          {reassignChoices.length === 0 ? (
            <MenuItem label="No other eligible members" disabled />
          ) : (
            reassignChoices.map((c) => <MenuItem key={c.id} label={c.name} onClick={() => onReassign(c.id)} />)
          )}
          <MenuDivider />
          <MenuPanel>
            <label className="block text-xs text-n-70 mb-1">Extend due date</label>
            <div className="flex gap-1.5">
              <input type="date" value={dueDraft} onChange={(e) => setDueDraft(e.target.value)} className="input-field !min-h-[34px] flex-1" style={{ fontSize: '16px' }} />
              <button onClick={() => onExtendDue(dueDraft)} disabled={!dueDraft} className="btn-primary !h-[34px] !px-2.5">Set</button>
            </div>
          </MenuPanel>
          <MenuDivider />
          <MenuItem icon={<X className="w-4 h-4" />} label="Remove from this assignment" danger onClick={onCancel} />
        </Menu>
      )}
    </div>
  );
}

export default function OccurrenceDetail() {
  const { id, occId } = useParams<{ id: string; occId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentUser = useStore((s) => s.currentUser);
  const {
    occurrence, memberTasks, conversationId, progress, isLoading, cancelOccurrence,
    reassignMemberTask, extendMemberTaskDueDate, cancelMemberTask,
  } = useOccurrence(occId);
  const { group, members } = useTaskGroup(id);
  const { messages, postMessage, setPinned, redactMessage } = useGroupMessages(conversationId);
  const { users } = useUsers();

  const canManage = canManageTaskGroups(currentUser?.role);
  const isParticipant = memberTasks.some((t) => t.assigneeId === currentUser?.id || t.coAssigneeIds.includes(currentUser?.id ?? ''));
  const isCoordinator = members.some((m) => m.userId === currentUser?.id && m.membershipRole === 'coordinator');

  if (isMobile) return <MobileOccurrenceDetail />;
  if (isLoading) return <Page><div className="skeleton h-40" /></Page>;
  if (!occurrence) return <Page><EmptyState title="Assignment not found" description="It may have been removed, or you don't have access to it." /></Page>;

  const taskRoute = (assigneeRole: string | undefined) => {
    if (assigneeRole === 'director') return '/director';
    if (assigneeRole === 'range_officer') return '/officer';
    return '/guard';
  };

  return (
    <Page className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <PageHeading title={occurrence.title} meta={`${group?.name ?? 'Task Group'} · Due ${formatDateTime(occurrence.dueAt)}`} />
        {canManage && occurrence.status !== 'cancelled' && occurrence.status !== 'completed' && (
          <button
            onClick={() => { if (confirm('Cancel this entire assignment? Member tasks remain but the assignment closes.')) cancelOccurrence.mutate(); }}
            className="btn-subtle flex-shrink-0 !text-signal-red"
          >
            <Ban className="w-4 h-4" />Cancel assignment
          </button>
        )}
      </div>

      {occurrence.description && <p className="text-13 text-n-90">{occurrence.description}</p>}

      <div className="card p-4">
        <ProgressBar progress={progress} />
      </div>

      <div>
        <div className="text-13 font-semibold text-n-90 mb-2">Member tasks</div>
        <div className="card divide-y divide-n-20">
          {memberTasks.map((t) => {
            const assignee = users.find((u) => u.id === t.assigneeId);
            const reassignChoices = users
              .filter((u) => isFieldRole(u.role) && u.id !== t.assigneeId)
              .map((u) => ({ id: u.id, name: u.name }));
            return (
              <MemberTaskRow
                key={t.id}
                task={t}
                assigneeName={assignee?.name ?? '—'}
                canManage={canManage}
                reassignChoices={reassignChoices}
                onOpen={() => navigate(`${taskRoute(currentUser?.role)}/tasks/${t.id}`)}
                onReassign={async (newAssigneeId) => {
                  try { await reassignMemberTask.mutateAsync({ taskId: t.id, newAssigneeId }); }
                  catch (err) { alert(getErrorMessage(err, 'Failed to reassign this task.')); }
                }}
                onExtendDue={async (dueDate) => {
                  try { await extendMemberTaskDueDate.mutateAsync({ taskId: t.id, dueDate }); }
                  catch (err) { alert(getErrorMessage(err, 'Failed to update the due date.')); }
                }}
                onCancel={async () => {
                  if (!confirm(`Remove ${assignee?.name ?? 'this member'}'s task from this assignment? This cannot be undone.`)) return;
                  try { await cancelMemberTask.mutateAsync(t.id); }
                  catch (err) { alert(getErrorMessage(err, 'Failed to remove this task.')); }
                }}
              />
            );
          })}
        </div>
      </div>

      {currentUser && (
        <div>
          <div className="text-13 font-semibold text-n-90 mb-2">Discussion</div>
          <div className="card p-4">
            <MessageThread
              messages={messages}
              users={users}
              currentUser={currentUser}
              canPost={canManage || isParticipant}
              disabledReason="Only assigned members and officers can post here."
              onSend={(body) => postMessage.mutateAsync(body)}
              emptyLabel="No messages yet — coordinate here about this assignment."
              onPin={canManage || isCoordinator ? (messageId, pinned) => setPinned.mutateAsync({ messageId, pinned }) : undefined}
              onRedact={(messageId) => redactMessage.mutateAsync(messageId)}
            />
          </div>
        </div>
      )}
    </Page>
  );
}

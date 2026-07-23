import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Ban } from 'lucide-react';
import useStore from '../../store/useStore';
import { useOccurrence } from '../../hooks/useOccurrence';
import { useTaskGroup } from '../../hooks/useTaskGroup';
import { useGroupMessages } from '../../hooks/useGroupMessages';
import { useUsers } from '../../hooks/useUsers';
import { canManageTaskGroups } from '../../lib/permissions';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import MessageThread from '../../components/MessageThread';
import { formatDateTime } from '../../utils/formatters';

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
  const { occurrence, memberTasks, conversationId, progress, isLoading, cancelOccurrence } = useOccurrence(occId);
  const { group } = useTaskGroup(id);
  const { messages, postMessage } = useGroupMessages(conversationId);
  const { users } = useUsers();

  const canManage = canManageTaskGroups(currentUser?.role);
  const isParticipant = memberTasks.some((t) => t.assigneeId === currentUser?.id || t.coAssigneeIds.includes(currentUser?.id ?? ''));

  if (isLoading) return <div className="p-4"><div className="skeleton h-40" /></div>;
  if (!occurrence) return <div className="p-6 text-center text-13 text-n-70">Assignment not found, or you don't have access to it.</div>;

  const taskRoute = currentUser?.role === 'director' ? '/director' : currentUser?.role === 'range_officer' ? '/officer' : '/guard';

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
          {memberTasks.map((t) => {
            const assignee = users.find((u) => u.id === t.assigneeId);
            return (
              <button key={t.id} onClick={() => navigate(`${taskRoute}/tasks/${t.id}`)} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left active:bg-n-10">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-n-100 truncate">{assignee?.name ?? '—'}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={t.status} size="sm" />
                    <PriorityBadge priority={t.priority} size="sm" />
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
              </button>
            );
          })}
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
          />
        </div>
      )}
    </div>
  );
}

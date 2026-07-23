import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Ban } from 'lucide-react';
import useStore from '../../store/useStore';
import { useOccurrence } from '../../hooks/useOccurrence';
import { useTaskGroup } from '../../hooks/useTaskGroup';
import { useGroupMessages } from '../../hooks/useGroupMessages';
import { useUsers } from '../../hooks/useUsers';
import { useIsMobile } from '../../hooks/useIsMobile';
import { canManageTaskGroups } from '../../lib/permissions';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import EmptyState from '../../components/EmptyState';
import MessageThread from '../../components/MessageThread';
import { Page, PageHeading } from '../../components/layout/Page';
import { formatDateTime } from '../../utils/formatters';
import MobileOccurrenceDetail from '../mobile/MobileOccurrenceDetail';

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

export default function OccurrenceDetail() {
  const { id, occId } = useParams<{ id: string; occId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentUser = useStore((s) => s.currentUser);
  const { occurrence, memberTasks, conversationId, progress, isLoading, cancelOccurrence } = useOccurrence(occId);
  const { group } = useTaskGroup(id);
  const { messages, postMessage } = useGroupMessages(conversationId);
  const { users } = useUsers();

  const canManage = canManageTaskGroups(currentUser?.role);
  const isParticipant = memberTasks.some((t) => t.assigneeId === currentUser?.id || t.coAssigneeIds.includes(currentUser?.id ?? ''));

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
            return (
              <button
                key={t.id}
                onClick={() => navigate(`${taskRoute(currentUser?.role)}/tasks/${t.id}`)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-n-10"
              >
                <div className="min-w-0">
                  <div className="text-13 font-medium text-n-100 truncate">{assignee?.name ?? '—'}</div>
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
          <div className="card p-4">
            <MessageThread
              messages={messages}
              users={users}
              currentUser={currentUser}
              canPost={canManage || isParticipant}
              disabledReason="Only assigned members and officers can post here."
              onSend={(body) => postMessage.mutateAsync(body)}
              emptyLabel="No messages yet — coordinate here about this assignment."
            />
          </div>
        </div>
      )}
    </Page>
  );
}

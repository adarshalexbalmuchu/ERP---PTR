import { History } from 'lucide-react';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useUsers } from '../../hooks/useUsers';
import EmptyState from '../../components/EmptyState';
import { formatDateTime } from '../../utils/formatters';

const ACTION_LABELS: Record<string, string> = {
  update: 'Updated',
  status: 'Status change',
  delete: 'Deleted',
};

export default function AuditLog() {
  const { entries, isLoading } = useAuditLog();
  const { users } = useUsers();

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ptr-brown">Audit Log</h1>
        <p className="text-sm text-ptr-brown-light">
          Who reassigned, changed, or deleted tasks {isLoading && '· loading…'}
        </p>
      </div>

      {!isLoading && entries.length === 0 ? (
        <EmptyState
          icon={<History className="w-7 h-7" />}
          title="No activity yet"
          description="Reassignments, status changes, and deletions will appear here."
        />
      ) : (
        <div className="card divide-y divide-ptr-cream-dark overflow-hidden">
          {entries.map((entry) => {
            const actor = users.find((u) => u.id === entry.actorId);
            return (
              <div key={entry.id} className="p-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-ptr-green/10 flex items-center justify-center text-xs font-semibold text-ptr-green flex-shrink-0 mt-0.5">
                  {actor?.avatarInitials ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium text-ptr-brown">
                      {actor?.name ?? 'Unknown'} · {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                    <span className="text-xs text-ptr-brown-light">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <div className="text-xs text-ptr-brown-light mt-0.5">"{entry.taskTitle}"</div>
                  <p className="text-sm text-ptr-brown mt-1">{entry.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

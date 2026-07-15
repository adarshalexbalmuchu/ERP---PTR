import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { useIncidents } from '../../hooks/useIncidents';
import { useOfficerRanges } from '../../hooks/useOfficerRanges';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import StatusBadge from '../../components/StatusBadge';
import { isOverdue } from '../../utils/overdue';
import { formatIncidentType } from '../../lib/incidentTypes';
import { formatRelative } from '../../utils/formatters';
import { isFieldRole } from '../../types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Metric({ label, value, tone = 'default', onClick }: { label: string; value: number | string; tone?: 'default' | 'red' | 'amber'; onClick: () => void }) {
  const cls = tone === 'red' ? 'text-signal-red' : tone === 'amber' ? 'text-signal-amber' : 'text-n-100';
  return (
    <button onClick={onClick} className="text-left bg-white border border-n-30 rounded-lg p-3.5">
      <div className={`text-2xl font-semibold tabular-nums ${cls}`}>{value}</div>
      <div className="text-13 text-n-80 mt-0.5">{label}</div>
    </button>
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 mb-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-n-70">{children}</div>
      {action}
    </div>
  );
}

export default function OfficerHome() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks } = useTasks();
  const { users } = useUsers();
  const { ranges } = useRanges();
  const { incidents } = useIncidents();
  const { activeRangeId } = useOfficerRanges();
  const { state: syncState } = useSyncStatus();

  const myRange = ranges.find((r) => r.id === activeRangeId);
  const myTasks = tasks.filter((t) => t.rangeId === activeRangeId);
  const myGuards = users.filter((u) => isFieldRole(u.role) && u.rangeId === activeRangeId);
  const myIncidents = incidents.filter((i) => i.rangeId === activeRangeId).slice(0, 4);

  const overdueTasks = myTasks.filter((t) => (t.status === 'NotStarted' || t.status === 'InProgress') && isOverdue(t));
  const awaitingReview = myTasks.filter((t) => t.status === 'Completed');
  const notStarted = myTasks.filter((t) => t.status === 'NotStarted');

  const guardWorkload = myGuards.map((g) => {
    const gt = myTasks.filter((t) => t.assigneeId === g.id || t.coAssigneeIds.includes(g.id));
    return { user: g, active: gt.filter((t) => t.status === 'InProgress').length, total: gt.length };
  }).sort((a, b) => a.active - b.active);

  return (
    <div className="pb-4">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold text-n-100">{greeting()}, {currentUser?.name?.split(' ')[0]}</h1>
        <p className="text-13 text-n-70 mt-0.5">
          {myRange?.name ?? 'Your range'} · {myGuards.length} staff · {syncState === 'offline' ? 'Offline' : syncState === 'syncing' ? 'Syncing…' : 'Up to date'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4 mb-5">
        <Metric label="Overdue" value={overdueTasks.length} tone={overdueTasks.length > 0 ? 'red' : 'default'} onClick={() => navigate('/officer/tasks?view=overdue')} />
        <Metric label="Awaiting review" value={awaitingReview.length} tone={awaitingReview.length > 0 ? 'amber' : 'default'} onClick={() => navigate('/officer/tasks?view=review')} />
        <Metric label="Not started" value={notStarted.length} onClick={() => navigate('/officer/tasks?status=NotStarted')} />
        <Metric label="Total tasks" value={myTasks.length} onClick={() => navigate('/officer/tasks')} />
      </div>

      {overdueTasks.length > 0 && (
        <div className="mb-5">
          <SectionLabel action={<button onClick={() => navigate('/officer/tasks?view=overdue')} className="text-13 font-medium text-ptr-accent">View all</button>}>
            Overdue tasks
          </SectionLabel>
          <div className="bg-white divide-y divide-n-20">
            {overdueTasks.slice(0, 4).map((t) => (
              <button key={t.id} onClick={() => navigate(`/officer/tasks/${t.id}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-n-10">
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-n-100 truncate">{t.title}</div>
                  <div className="mt-1"><StatusBadge status={t.status} size="sm" /></div>
                </div>
                <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {myIncidents.length > 0 && (
        <div className="mb-5">
          <SectionLabel action={<button onClick={() => navigate('/officer/incidents')} className="text-13 font-medium text-ptr-accent">View all</button>}>
            Recent incidents
          </SectionLabel>
          <div className="bg-white divide-y divide-n-20">
            {myIncidents.map((i) => (
              <button key={i.id} onClick={() => navigate('/officer/incidents')} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-n-10">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${i.severity === 'Critical' || i.severity === 'High' ? 'text-signal-red' : 'text-n-60'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-n-100 truncate">{formatIncidentType(i)}</div>
                  <div className="text-13 text-n-70">{i.severity} · {formatRelative(i.incidentDate)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {guardWorkload.length > 0 && (
        <div>
          <SectionLabel>Personnel availability</SectionLabel>
          <div className="bg-white divide-y divide-n-20">
            {guardWorkload.map(({ user, active, total }) => (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-ptr-green/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-ptr-green">{user.avatarInitials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-n-100 truncate">{user.name}</div>
                  <div className="text-13 text-n-70">{total} tasks · {active} active</div>
                </div>
                <span className={`text-13 font-medium ${active === 0 ? 'text-signal-green' : active >= 3 ? 'text-signal-amber' : 'text-n-70'}`}>
                  {active === 0 ? 'Available' : `${active} active`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

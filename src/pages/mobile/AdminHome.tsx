import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import useStore from '../../store/useStore';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { useTasks } from '../../hooks/useTasks';
import { useIncidents } from '../../hooks/useIncidents';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import StatusBadge from '../../components/StatusBadge';
import { formatIncidentType } from '../../lib/incidentTypes';
import { formatRelative } from '../../utils/formatters';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Metric({ label, value, tone = 'default', onClick }: { label: string; value: number | string; tone?: 'default' | 'red' | 'amber' | 'green'; onClick: () => void }) {
  const cls = tone === 'red' ? 'text-signal-red' : tone === 'amber' ? 'text-signal-amber' : tone === 'green' ? 'text-signal-green' : 'text-n-100';
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

function healthOf(total: number, overdue: number): { label: string; cls: string } {
  if (total === 0) return { label: 'No active work', cls: 'text-n-60' };
  if (overdue >= 3 || overdue / total >= 0.25) return { label: 'At risk', cls: 'text-signal-red' };
  if (overdue > 0) return { label: 'Needs attention', cls: 'text-signal-amber' };
  return { label: 'On track', cls: 'text-signal-green' };
}

export default function AdminHome() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { stats, rangeStats } = useDashboardStats();
  const { tasks } = useTasks();
  const { incidents } = useIncidents();
  const { state: syncState } = useSyncStatus();

  const totalTasks = stats?.totalTasks ?? 0;
  const overdueCount = stats?.overdueCount ?? 0;
  const awaitingReview = tasks.filter((t) => t.status === 'Completed').length;
  const completionRate = totalTasks > 0 ? Math.round((((stats?.completedCount ?? 0) + (stats?.archivedCount ?? 0)) / totalTasks) * 100) : 0;

  const needsAttention = [...rangeStats]
    .map((r) => ({ ...r, health: healthOf(r.total, r.overdue) }))
    .filter((r) => r.health.label !== 'On track' && r.health.label !== 'No active work')
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 4);

  const criticalIncidents = incidents.filter((i) => i.severity === 'Critical' || i.severity === 'High').slice(0, 4);
  const recentTasks = tasks.slice(0, 5);

  return (
    <div className="pb-4">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold text-n-100">{greeting()}, {currentUser?.name?.split(' ')[0]}</h1>
        <p className="text-13 text-n-70 mt-0.5">
          All ranges · {syncState === 'offline' ? 'Offline — showing last synced data' : syncState === 'syncing' ? 'Syncing…' : 'Up to date'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4 mb-5">
        <Metric label="Total tasks" value={totalTasks} onClick={() => navigate('/director/tasks')} />
        <Metric label="Overdue" value={overdueCount} tone={overdueCount > 0 ? 'red' : 'default'} onClick={() => navigate('/director/tasks?view=overdue')} />
        <Metric label="Awaiting review" value={awaitingReview} tone={awaitingReview > 0 ? 'amber' : 'default'} onClick={() => navigate('/director/tasks?view=review')} />
        <Metric label="Completion" value={`${completionRate}%`} tone="green" onClick={() => navigate('/director/tasks?status=Archived')} />
      </div>

      {needsAttention.length > 0 && (
        <div className="mb-5">
          <SectionLabel>Ranges needing attention</SectionLabel>
          <div className="bg-white divide-y divide-n-20">
            {needsAttention.map((r) => (
              <button key={r.rangeId} onClick={() => navigate(`/director/tasks?range=${r.rangeId}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-n-10">
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-n-100 truncate">{r.rangeName}</div>
                  <div className={`text-13 font-medium ${r.health.cls}`}>{r.health.label} · {r.overdue} overdue</div>
                </div>
                <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5">
        <SectionLabel action={<button onClick={() => navigate('/director/tasks?view=review')} className="text-13 font-medium text-ptr-accent">View all</button>}>
          Review bottlenecks
        </SectionLabel>
        <div className="px-4">
          {awaitingReview === 0 ? (
            <p className="text-13 text-n-70">Nothing waiting for approval.</p>
          ) : (
            <button onClick={() => navigate('/director/tasks?view=review')} className="w-full flex items-center gap-2.5 bg-signal-amber/10 border border-signal-amber/30 rounded-lg p-3 text-left">
              <Clock className="w-5 h-5 text-signal-amber flex-shrink-0" />
              <span className="text-13 text-n-90"><span className="font-semibold">{awaitingReview}</span> completed task{awaitingReview !== 1 ? 's' : ''} waiting for your review</span>
            </button>
          )}
        </div>
      </div>

      {criticalIncidents.length > 0 && (
        <div className="mb-5">
          <SectionLabel action={<button onClick={() => navigate('/director/incidents')} className="text-13 font-medium text-ptr-accent">View all</button>}>
            Critical incidents
          </SectionLabel>
          <div className="bg-white divide-y divide-n-20">
            {criticalIncidents.map((i) => (
              <button key={i.id} onClick={() => navigate('/director/incidents')} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-n-10">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${i.severity === 'Critical' ? 'text-signal-red' : 'text-signal-amber'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-n-100 truncate">{formatIncidentType(i)}</div>
                  <div className="text-13 text-n-70">{i.severity} · {formatRelative(i.incidentDate)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel action={<button onClick={() => navigate('/director/tasks')} className="text-13 font-medium text-ptr-accent">Registry →</button>}>
          Recent activity
        </SectionLabel>
        <div className="bg-white divide-y divide-n-20">
          {recentTasks.map((t) => (
            <button key={t.id} onClick={() => navigate(`/director/tasks/${t.id}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-n-10">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium text-n-100 truncate">{t.title}</div>
                <div className="mt-1"><StatusBadge status={t.status} size="sm" /></div>
              </div>
              <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Plus, MapPin, RefreshCw, WifiOff, AlertCircle, MoreHorizontal,
  UserCog, CircleDashed, CheckCircle2, RotateCcw, Image as ImageIcon,
} from 'lucide-react';
import PriorityBadge from '../../components/PriorityBadge';
import FilterChips from '../../components/mobile/FilterChips';
import PullToRefresh from '../../components/mobile/PullToRefresh';
import IncidentWizard from '../../components/mobile/IncidentWizard';
import BottomSheet from '../../components/mobile/BottomSheet';
import { useIncidents } from '../../hooks/useIncidents';
import { useRanges } from '../../hooks/useRanges';
import { useUsers } from '../../hooks/useUsers';
import { useIncidentQueue } from '../../hooks/useIncidentQueue';
import { useMobileOverlay } from '../../contexts/MobileOverlayContext';
import useStore from '../../store/useStore';
import { canManageIncidents } from '../../lib/permissions';
import { describeBulkOutcome } from '../../lib/mutationVerification';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime, formatRelative } from '../../utils/formatters';
import { formatIncidentType, isHighSeverity } from '../../lib/incidentTypes';
import { isFieldRole } from '../../types';
import type { Incident, IncidentSeverity } from '../../types';

type Chip = 'all' | 'unassigned' | 'open' | 'resolved' | 'mine' | 'high' | 'critical';

const EMPTY_STATE_COPY: Record<Chip, { title: string; hint: string }> = {
  all: { title: 'No incidents reported', hint: 'Tap the + button to report one.' },
  unassigned: { title: 'No unassigned incidents', hint: 'Everything currently has a responder.' },
  open: { title: 'No open incidents', hint: 'Everything reported has been resolved.' },
  resolved: { title: 'No resolved incidents', hint: 'Nothing has been marked resolved yet.' },
  mine: { title: "You haven't reported any incidents", hint: 'Switch to All to see every report.' },
  high: { title: 'No high-severity incidents', hint: 'Nothing meets this severity right now.' },
  critical: { title: 'No critical incidents', hint: 'Nothing meets this severity right now.' },
};

const SEVERITIES: IncidentSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

function statusLine(incident: Incident): string {
  if (incident.status === 'Resolved') {
    return incident.resolvedAt ? `Resolved · Closed ${formatRelative(incident.resolvedAt)}` : 'Resolved';
  }
  return incident.assigneeName ? `Open · Assigned to ${incident.assigneeName}` : 'Open · Unassigned';
}

export default function MobileIncidentList({
  currentUserId,
  defaultRangeId,
  lockRange,
  allowedRangeIds,
  autoOpenWizard = false,
}: {
  currentUserId: string;
  defaultRangeId: string;
  lockRange: boolean;
  allowedRangeIds?: string[];
  autoOpenWizard?: boolean;
}) {
  const currentUser = useStore((s) => s.currentUser);
  const queryClient = useQueryClient();
  const { incidents, isLoading, assignIncidents, changeSeverity, setStatus } = useIncidents();
  const { ranges, areas } = useRanges();
  const { users } = useUsers();
  const { queued, retry } = useIncidentQueue();
  const overlay = useMobileOverlay();
  const [chip, setChip] = useState<Chip>('all');
  const [wizardOpen, setWizardOpen] = useState(autoOpenWizard);
  const [actionsFor, setActionsFor] = useState<Incident | null>(null);
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [severityPickerOpen, setSeverityPickerOpen] = useState(false);
  const actionsTriggerRef = useRef<HTMLButtonElement | null>(null);

  const canManage = canManageIncidents(currentUser?.role, currentUser?.id);
  const responders = users.filter((u) => isFieldRole(u.role));

  const filtered = incidents.filter((i) => {
    if (chip === 'mine') return i.reportedBy === currentUserId;
    if (chip === 'high') return isHighSeverity(i.severity);
    if (chip === 'critical') return i.severity === 'Critical';
    if (chip === 'unassigned') return i.status === 'Open' && !i.assignedTo;
    if (chip === 'open') return i.status === 'Open';
    if (chip === 'resolved') return i.status === 'Resolved';
    return true;
  });
  const emptyCopy = EMPTY_STATE_COPY[chip];

  const openActions = (incident: Incident, trigger: HTMLButtonElement) => {
    actionsTriggerRef.current = trigger;
    setActionsFor(incident);
    overlay?.open('incident-preview', trigger);
  };
  const closeActions = () => { setActionsFor(null); setAssignPickerOpen(false); setSeverityPickerOpen(false); overlay?.close('incident-preview'); };

  const runAssign = async (userId: string) => {
    if (!actionsFor) return;
    const id = actionsFor.id;
    closeActions();
    try {
      const result = await assignIncidents.mutateAsync({ ids: [id], userId });
      if (result.outcome !== 'complete') alert(describeBulkOutcome(result, 1, 'incident'));
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to assign this incident.'));
    }
  };
  const runSeverity = async (severity: IncidentSeverity) => {
    if (!actionsFor) return;
    const id = actionsFor.id;
    closeActions();
    try {
      const result = await changeSeverity.mutateAsync({ ids: [id], severity });
      if (result.outcome !== 'complete') alert(describeBulkOutcome(result, 1, 'incident'));
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to update severity.'));
    }
  };
  const runToggleResolved = async () => {
    if (!actionsFor) return;
    const id = actionsFor.id;
    const nextStatus = actionsFor.status === 'Resolved' ? 'Open' : 'Resolved';
    const verb = nextStatus === 'Resolved' ? 'resolve' : 'reopen';
    if (!confirm(`Mark this incident as ${nextStatus.toLowerCase()}?`)) return;
    closeActions();
    try {
      const result = await setStatus.mutateAsync({ ids: [id], status: nextStatus });
      if (result.outcome !== 'complete') alert(describeBulkOutcome(result, 1, 'incident'));
    } catch (err) {
      alert(getErrorMessage(err, `Failed to ${verb} this incident.`));
    }
  };

  return (
    <div>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-n-100">Incidents</h1>
          <p className="text-13 text-n-70 mt-0.5">Human–wildlife conflict &amp; field observations</p>
        </div>
        {/* Same green as Task Registry's "New task" FAB — red reads as a
            destructive/danger action, which reporting an incident isn't. */}
        <button onClick={() => setWizardOpen(true)} className="w-12 h-12 flex items-center justify-center rounded-full bg-ptr-green text-white flex-shrink-0 active:bg-ptr-green-dark" aria-label="Report incident">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {queued.length > 0 && (
        <div className="mx-4 mb-3 rounded border border-signal-amber/40 bg-signal-amber/10 p-3 space-y-2">
          <div className="text-13 font-semibold text-signal-amber flex items-center gap-1.5"><WifiOff className="w-3.5 h-3.5" />{queued.length} report{queued.length !== 1 ? 's' : ''} waiting to sync</div>
          {queued.map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-2 text-13">
              <span className="text-n-90 truncate">{formatIncidentType(q)}</span>
              {q.status === 'submitting' ? (
                <span className="flex items-center gap-1 text-n-70 flex-shrink-0"><RefreshCw className="w-3.5 h-3.5 animate-spin" />Sending…</span>
              ) : q.status === 'failed' ? (
                <button onClick={retry} className="flex items-center gap-1 text-signal-red font-medium flex-shrink-0"><AlertCircle className="w-3.5 h-3.5" />Failed · Retry</button>
              ) : (
                <span className="text-n-70 flex-shrink-0">Queued</span>
              )}
            </div>
          ))}
        </div>
      )}

      <FilterChips
        chips={[
          { id: 'all', label: 'All', count: incidents.length },
          { id: 'unassigned', label: 'Unassigned', count: incidents.filter((i) => i.status === 'Open' && !i.assignedTo).length },
          { id: 'open', label: 'Open', count: incidents.filter((i) => i.status === 'Open').length },
          { id: 'resolved', label: 'Resolved', count: incidents.filter((i) => i.status === 'Resolved').length },
          { id: 'mine', label: 'Mine', count: incidents.filter((i) => i.reportedBy === currentUserId).length },
          { id: 'high', label: 'High severity', count: incidents.filter((i) => isHighSeverity(i.severity)).length },
          { id: 'critical', label: 'Critical', count: incidents.filter((i) => i.severity === 'Critical').length },
        ]}
        active={chip}
        onChange={(id) => setChip(id as Chip)}
      />

      <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: ['incidents'] })}>
        {isLoading ? (
          <div className="px-4 space-y-3 mt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2"><div className="skeleton h-4 w-1/2" /><div className="skeleton h-3 w-full" /></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-n-20 flex items-center justify-center mb-3 text-n-70"><AlertTriangle className="w-5 h-5" /></div>
            <div className="text-[15px] font-semibold text-n-100">{emptyCopy.title}</div>
            <div className="text-13 text-n-70 mt-1">{emptyCopy.hint}</div>
          </div>
        ) : (
          <div className="mt-1">
            {filtered.map((incident) => {
              const range = ranges.find((r) => r.id === incident.rangeId);
              const area = areas.find((a) => a.id === incident.areaId);
              const extraPhotos = incident.photos.length - 2;
              return (
                <div key={incident.id} className="px-4 py-3 border-b border-n-20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-semibold text-n-100">{formatIncidentType(incident)}</span>
                        <PriorityBadge priority={incident.severity} size="sm" />
                      </div>
                      <div className={`text-xs font-medium mt-0.5 ${incident.status === 'Resolved' ? 'text-n-70' : incident.assignedTo ? 'text-ptr-green' : 'text-signal-amber'}`}>
                        {statusLine(incident)}
                      </div>
                    </div>
                    {canManage && (
                      <button
                        onClick={(e) => openActions(incident, e.currentTarget)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-n-70 active:bg-n-10 flex-shrink-0"
                        aria-label={`More actions for ${formatIncidentType(incident)}`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-13 text-n-90 mt-1">{incident.description}</p>
                  <div className="flex items-center gap-1.5 text-xs text-n-80 mt-1.5">
                    <span>{range?.name ?? '—'}{area ? ` · ${area.name}` : ''}</span>
                    <span>·</span>
                    <span>{formatDateTime(incident.incidentDate)}</span>
                  </div>
                  {incident.photos.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {incident.photos.slice(0, 2).map((p, idx) => (
                        <div key={p.id} className="relative w-14 h-14 flex-shrink-0">
                          <img src={p.url} alt="" className="w-full h-full rounded object-cover border border-n-30" />
                          {idx === 1 && extraPhotos > 0 && (
                            <div className="absolute inset-0 rounded bg-black/50 flex items-center justify-center text-white text-13 font-semibold">
                              +{extraPhotos}
                            </div>
                          )}
                        </div>
                      ))}
                      {incident.photos.length === 1 && (
                        <span className="flex items-center gap-1 text-xs text-n-70"><ImageIcon className="w-3.5 h-3.5" />1 photo</span>
                      )}
                    </div>
                  )}
                  {incident.lat !== undefined && incident.lng !== undefined && (
                    <a
                      href={`https://www.google.com/maps?q=${incident.lat},${incident.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-13 text-ptr-accent font-medium mt-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5" />View on map
                    </a>
                  )}
                </div>
              );
            })}
            <div className="h-4" />
          </div>
        )}
      </PullToRefresh>

      <BottomSheet
        open={!!actionsFor && !assignPickerOpen && !severityPickerOpen}
        onClose={closeActions}
        title={actionsFor ? formatIncidentType(actionsFor) : undefined}
      >
        {actionsFor && (
          <div className="py-1 pb-3">
            <button onClick={() => setAssignPickerOpen(true)} className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10">
              <UserCog className="w-5 h-5 text-n-70" />Assign response
            </button>
            <button onClick={() => setSeverityPickerOpen(true)} className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10">
              <CircleDashed className="w-5 h-5 text-n-70" />Change severity
            </button>
            <button onClick={() => void runToggleResolved()} className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10">
              {actionsFor.status === 'Resolved' ? <RotateCcw className="w-5 h-5 text-n-70" /> : <CheckCircle2 className="w-5 h-5 text-n-70" />}
              {actionsFor.status === 'Resolved' ? 'Reopen' : 'Mark resolved'}
            </button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={assignPickerOpen} onClose={() => setAssignPickerOpen(false)} title="Assign response">
        <div className="py-1 pb-3 max-h-[60dvh] overflow-y-auto">
          {responders.map((u) => (
            <button key={u.id} onClick={() => void runAssign(u.id)} className="w-full flex items-center px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10 text-left">
              {u.name}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={severityPickerOpen} onClose={() => setSeverityPickerOpen(false)} title="Change severity">
        <div className="py-1 pb-3">
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => void runSeverity(s)} className="w-full flex items-center px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10 text-left">
              {s}
            </button>
          ))}
        </div>
      </BottomSheet>

      <IncidentWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        defaultRangeId={defaultRangeId}
        lockRange={lockRange}
        allowedRangeIds={allowedRangeIds}
      />
    </div>
  );
}

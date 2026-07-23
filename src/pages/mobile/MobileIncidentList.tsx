import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Plus, MapPin, RefreshCw, WifiOff, AlertCircle, MoreHorizontal,
  UserCog, CircleDashed, CheckCircle2, Circle, RotateCcw, Image as ImageIcon,
  ChevronLeft, ChevronRight, X, ClipboardPlus, Trash2, ListChecks, Download,
} from 'lucide-react';
import PriorityBadge from '../../components/PriorityBadge';
import TaskForm from '../../components/TaskForm';
import FilterChips from '../../components/mobile/FilterChips';
import PullToRefresh from '../../components/mobile/PullToRefresh';
import IncidentWizard from '../../components/mobile/IncidentWizard';
import BottomSheet from '../../components/mobile/BottomSheet';
import { useIncidents } from '../../hooks/useIncidents';
import { useRanges } from '../../hooks/useRanges';
import { useUsers } from '../../hooks/useUsers';
import { useTasks } from '../../hooks/useTasks';
import { useIncidentQueue } from '../../hooks/useIncidentQueue';
import { useMobileOverlay } from '../../contexts/MobileOverlayContext';
import useStore from '../../store/useStore';
import { canManageIncidents } from '../../lib/permissions';
import { describeBulkOutcome } from '../../lib/mutationVerification';
import { getErrorMessage } from '../../lib/errors';
import { uploadTaskAttachment } from '../../lib/attachments';
import { exportCsv } from '../../utils/exportCsv';
import { formatDate, formatDateTime, formatRelative } from '../../utils/formatters';
import { formatIncidentType, isHighSeverity } from '../../lib/incidentTypes';
import { isFieldRole } from '../../types';
import type { Incident, IncidentSeverity, TaskPriority } from '../../types';

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
const SEVERITY_TO_PRIORITY: Record<IncidentSeverity, TaskPriority> = {
  Low: 'Low', Medium: 'Medium', High: 'High', Critical: 'Critical',
};

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
  const { incidents, isLoading, deleteIncident, removePhoto, assignIncidents, changeSeverity, setStatus } = useIncidents();
  const { createTask } = useTasks();
  const { ranges, areas } = useRanges();
  const { users } = useUsers();
  const { queued, retry } = useIncidentQueue();
  const overlay = useMobileOverlay();
  const [chip, setChip] = useState<Chip>('all');
  const [wizardOpen, setWizardOpen] = useState(autoOpenWizard);
  const [actionsFor, setActionsFor] = useState<Incident | null>(null);
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [severityPickerOpen, setSeverityPickerOpen] = useState(false);
  const [photoViewer, setPhotoViewer] = useState<{ incident: Incident; index: number } | null>(null);
  const [followUpFor, setFollowUpFor] = useState<Incident | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSheet, setBulkSheet] = useState<'assign' | 'severity' | null>(null);
  const actionsTriggerRef = useRef<HTMLButtonElement | null>(null);

  const canManage = canManageIncidents(currentUser?.role, currentUser?.id);
  const canCreateTask = currentUser?.role === 'director' || currentUser?.role === 'range_officer';
  const responders = users.filter((u) => isFieldRole(u.role));
  const followUpAssignees = responders.filter((u) => !followUpFor || u.rangeId === followUpFor.rangeId);
  const exitSelection = () => { setSelectionMode(false); setSelectedIds([]); setBulkSheet(null); };
  const toggleSelect = (id: string) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

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
  const selectedIncidents = filtered.filter((i) => selectedIds.includes(i.id));
  const allSelectedResolved = selectedIncidents.length > 0 && selectedIncidents.every((i) => i.status === 'Resolved');

  const openActions = (incident: Incident, trigger: HTMLButtonElement) => {
    actionsTriggerRef.current = trigger;
    setActionsFor(incident);
    overlay?.open('incident-preview', trigger);
  };
  const closeActions = () => { setActionsFor(null); setAssignPickerOpen(false); setSeverityPickerOpen(false); overlay?.close('incident-preview'); };
  const openPhoto = (incident: Incident, index: number, trigger: HTMLButtonElement) => {
    setPhotoViewer({ incident, index });
    overlay?.open('incident-photo', trigger);
  };
  const closePhoto = () => {
    setPhotoViewer(null);
    overlay?.close('incident-photo');
  };
  const showAdjacentPhoto = (direction: -1 | 1) => {
    setPhotoViewer((current) => {
      if (!current) return null;
      const count = current.incident.photos.length;
      return { ...current, index: (current.index + direction + count) % count };
    });
  };

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
  const startFollowUp = (incident: Incident) => {
    closeActions();
    setFollowUpFor(incident);
  };
  const runDelete = async () => {
    if (!actionsFor || !confirm(`Delete "${formatIncidentType(actionsFor)}"? This cannot be undone.`)) return;
    const id = actionsFor.id;
    closeActions();
    try {
      await deleteIncident.mutateAsync(id);
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete this incident.'));
    }
  };
  const runRemovePhoto = async () => {
    if (!photoViewer || !confirm('Remove this photo? This cannot be undone.')) return;
    const photoId = photoViewer.incident.photos[photoViewer.index].id;
    closePhoto();
    try {
      await removePhoto.mutateAsync(photoId);
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to remove this photo.'));
    }
  };

  const toExportRows = (rows: Incident[]) => rows.map((i) => ({
    Type: formatIncidentType(i),
    Severity: i.severity,
    Status: i.status,
    Range: ranges.find((r) => r.id === i.rangeId)?.name ?? '',
    'Reported by': i.reporterName ?? '',
    'Assigned to': users.find((u) => u.id === i.assignedTo)?.name ?? '',
    Date: formatDate(i.incidentDate),
    Description: i.description,
  }));
  const runBulkAssign = async (userId: string) => {
    const ids = selectedIds;
    exitSelection();
    try {
      const result = await assignIncidents.mutateAsync({ ids, userId });
      alert(describeBulkOutcome(result, ids.length, 'incidents'));
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to assign the selected incidents.'));
    }
  };
  const runBulkSeverity = async (severity: IncidentSeverity) => {
    const ids = selectedIds;
    exitSelection();
    try {
      const result = await changeSeverity.mutateAsync({ ids, severity });
      alert(describeBulkOutcome(result, ids.length, 'incidents'));
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to update severity for the selected incidents.'));
    }
  };
  const runBulkToggleResolved = async () => {
    const ids = selectedIds;
    const nextStatus = allSelectedResolved ? 'Open' : 'Resolved';
    const verb = nextStatus === 'Resolved' ? 'resolve' : 'reopen';
    if (!confirm(`Mark ${ids.length} selected incident${ids.length > 1 ? 's' : ''} as ${nextStatus.toLowerCase()}?`)) return;
    exitSelection();
    try {
      const result = await setStatus.mutateAsync({ ids, status: nextStatus });
      alert(describeBulkOutcome(result, ids.length, 'incidents'));
    } catch (err) {
      alert(getErrorMessage(err, `Failed to ${verb} the selected incidents.`));
    }
  };
  const runBulkDelete = () => {
    if (!confirm(`Delete ${selectedIncidents.length} selected incident${selectedIncidents.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    selectedIncidents.forEach((i) => deleteIncident.mutate(i.id));
    exitSelection();
  };

  return (
    <div>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        {selectionMode ? (
          <>
            <span className="text-[15px] font-semibold text-n-100">{selectedIds.length} selected</span>
            <button onClick={exitSelection} className="flex items-center gap-1 text-13 font-medium text-n-80"><X className="w-4 h-4" />Cancel</button>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-semibold text-n-100">Incidents</h1>
              <p className="text-13 text-n-70 mt-0.5">Human–wildlife conflict &amp; field observations</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {canManage && (
                <button onClick={() => setSelectionMode(true)} className="w-10 h-10 flex items-center justify-center rounded-full border border-n-40 text-n-80" aria-label="Select incidents">
                  <ListChecks className="w-4.5 h-4.5" />
                </button>
              )}
              {/* Same green as Task Registry's "New task" FAB — red reads as a
                  destructive/danger action, which reporting an incident isn't. */}
              <button onClick={() => setWizardOpen(true)} className="w-12 h-12 flex items-center justify-center rounded-full bg-ptr-green text-white flex-shrink-0 active:bg-ptr-green-dark" aria-label="Report incident">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>

      {queued.length > 0 && (
        <div className="mx-4 mb-3 rounded border border-signal-amber/40 bg-signal-amber/10 p-3 space-y-2">
          <div className="text-13 font-semibold text-signal-amber flex items-center gap-1.5"><WifiOff className="w-3.5 h-3.5" />{queued.length} report{queued.length !== 1 ? 's' : ''} waiting to sync</div>
          {queued.map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-2 text-13">
              <div className="min-w-0">
                <span className="text-n-90 truncate block">{formatIncidentType(q)}</span>
                {q.status === 'failed' && q.error && <span className="text-signal-red text-[11px] block truncate">{q.error}</span>}
              </div>
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
              const selected = selectedIds.includes(incident.id);
              return (
                <div key={incident.id} className={`px-4 py-3 border-b border-n-20 flex items-start gap-3 ${selected ? 'bg-ptr-green/5' : ''}`}>
                  {selectionMode && (
                    <button
                      type="button"
                      onClick={() => toggleSelect(incident.id)}
                      className="flex-shrink-0 mt-0.5"
                      aria-label={selected ? 'Deselect incident' : 'Select incident'}
                    >
                      {selected ? <CheckCircle2 className="w-5 h-5 text-ptr-green" /> : <Circle className="w-5 h-5 text-n-40" />}
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
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
                    {canManage && !selectionMode && (
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
                        <button
                          key={p.id}
                          type="button"
                          onClick={(event) => openPhoto(incident, idx, event.currentTarget)}
                          className="relative w-14 h-14 flex-shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ptr-green focus-visible:ring-offset-2"
                          aria-label={`Open incident photo ${idx + 1} of ${incident.photos.length}`}
                        >
                          <img src={p.url} alt="" className="w-full h-full rounded object-cover border border-n-30" />
                          {idx === 1 && extraPhotos > 0 && (
                            <span className="pointer-events-none absolute inset-0 rounded bg-black/50 flex items-center justify-center text-white text-13 font-semibold">
                              +{extraPhotos}
                            </span>
                          )}
                        </button>
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
                </div>
              );
            })}
            <div className={selectionMode ? 'h-20' : 'h-4'} />
          </div>
        )}
      </PullToRefresh>

      {photoViewer && (!overlay || overlay.isOpen('incident-photo')) && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="Incident photos">
          <div className="flex-shrink-0 flex items-center justify-between h-14 px-2 text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <span className="pl-2 text-13 font-medium">
              {photoViewer.index + 1} of {photoViewer.incident.photos.length}
            </span>
            <div className="flex items-center">
              {canManage && (
                <button type="button" onClick={() => void runRemovePhoto()} className="w-11 h-11 flex items-center justify-center rounded-full text-red-300 active:bg-white/15" aria-label="Remove photo">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button type="button" onClick={closePhoto} className="w-11 h-11 flex items-center justify-center rounded-full active:bg-white/15" aria-label="Close photo viewer">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="relative flex-1 min-h-0 flex items-center justify-center px-3 pb-3">
            <img
              src={photoViewer.incident.photos[photoViewer.index].url}
              alt={`Incident photo ${photoViewer.index + 1} of ${photoViewer.incident.photos.length}`}
              className="max-w-full max-h-full object-contain"
            />
            {photoViewer.incident.photos.length > 1 && (
              <>
                <button type="button" onClick={() => showAdjacentPhoto(-1)} className="absolute left-2 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 text-white active:bg-black/80" aria-label="Previous photo">
                  <ChevronLeft className="w-7 h-7" />
                </button>
                <button type="button" onClick={() => showAdjacentPhoto(1)} className="absolute right-2 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 text-white active:bg-black/80" aria-label="Next photo">
                  <ChevronRight className="w-7 h-7" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <BottomSheet
        open={!!actionsFor && !assignPickerOpen && !severityPickerOpen}
        onClose={closeActions}
        title={actionsFor ? formatIncidentType(actionsFor) : undefined}
      >
        {actionsFor && (
          <div className="py-1 pb-3">
            {canCreateTask && (
              <button onClick={() => startFollowUp(actionsFor)} className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10">
                <ClipboardPlus className="w-5 h-5 text-n-70" />Create follow-up task
              </button>
            )}
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
            <button onClick={() => void runDelete()} className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-signal-red active:bg-signal-red-bg">
              <Trash2 className="w-5 h-5" />Delete incident
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

      {canManage && selectionMode && (
        <div
          className="fixed left-0 right-0 z-20 bg-white border-t border-n-30 flex items-center gap-1 px-3 overflow-x-auto"
          style={{ bottom: 'calc(var(--ptr-bottom-nav-h) + env(safe-area-inset-bottom))', height: '56px' }}
        >
          {selectedIds.length === 0 ? (
            <>
              <button onClick={() => setSelectedIds(filtered.map((i) => i.id))} className="btn-subtle flex-shrink-0">Select all ({filtered.length})</button>
              <button onClick={() => { exportCsv(`ptr-incidents-${new Date().toISOString().slice(0, 10)}.csv`, toExportRows(filtered)); exitSelection(); }} className="btn-subtle flex-shrink-0"><Download className="w-4 h-4" />Export all</button>
            </>
          ) : (
            <>
              <button onClick={() => setBulkSheet('assign')} className="btn-subtle flex-shrink-0"><UserCog className="w-4 h-4" />Assign</button>
              <button onClick={() => setBulkSheet('severity')} className="btn-subtle flex-shrink-0"><CircleDashed className="w-4 h-4" />Severity</button>
              <button onClick={() => void runBulkToggleResolved()} className="btn-subtle flex-shrink-0">
                {allSelectedResolved ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {allSelectedResolved ? 'Reopen' : 'Resolve'}
              </button>
              <button onClick={() => { exportCsv(`ptr-incidents-selected-${new Date().toISOString().slice(0, 10)}.csv`, toExportRows(selectedIncidents)); exitSelection(); }} className="btn-subtle flex-shrink-0"><Download className="w-4 h-4" />Export</button>
              <button onClick={runBulkDelete} className="btn-subtle flex-shrink-0 !text-signal-red"><Trash2 className="w-4 h-4" />Delete</button>
            </>
          )}
        </div>
      )}

      <BottomSheet open={bulkSheet === 'assign'} onClose={() => setBulkSheet(null)} title={`Assign ${selectedIds.length} incident${selectedIds.length > 1 ? 's' : ''} to`}>
        <div className="py-1 pb-3 max-h-[60dvh] overflow-y-auto">
          {responders.map((u) => (
            <button key={u.id} onClick={() => void runBulkAssign(u.id)} className="w-full flex items-center px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10 text-left">
              {u.name}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={bulkSheet === 'severity'} onClose={() => setBulkSheet(null)} title="Set severity">
        <div className="py-1 pb-3">
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => void runBulkSeverity(s)} className="w-full flex items-center px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10 text-left">
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

      {followUpFor && currentUser && (
        <TaskForm
          isOpen={!!followUpFor}
          onClose={() => setFollowUpFor(null)}
          onSave={async (data, files) => {
            const rows = await createTask.mutateAsync(data);
            for (const row of rows) {
              for (const file of files) {
                try { await uploadTaskAttachment(row.id, currentUser.id, file); }
                catch (err) { alert(getErrorMessage(err, `Failed to upload "${file.name}"`)); }
              }
            }
            setFollowUpFor(null);
          }}
          assignableUsers={followUpAssignees}
          initialData={null}
          currentUserId={currentUser.id}
          defaultRangeId={followUpFor.rangeId}
          prefill={{
            title: `Follow-up: ${formatIncidentType(followUpFor)}`,
            description: `Linked to incident reported ${formatDateTime(followUpFor.incidentDate)}:\n${followUpFor.description}`,
            priority: SEVERITY_TO_PRIORITY[followUpFor.severity],
          }}
        />
      )}
    </div>
  );
}

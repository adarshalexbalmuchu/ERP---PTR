import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, MapPin, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';
import PriorityBadge from '../../components/PriorityBadge';
import FilterChips from '../../components/mobile/FilterChips';
import PullToRefresh from '../../components/mobile/PullToRefresh';
import IncidentWizard from '../../components/mobile/IncidentWizard';
import { useIncidents } from '../../hooks/useIncidents';
import { useRanges } from '../../hooks/useRanges';
import { useIncidentQueue } from '../../hooks/useIncidentQueue';
import { formatDateTime } from '../../utils/formatters';
import { formatIncidentType } from '../../lib/incidentTypes';
import type { Incident } from '../../types';

type Chip = 'all' | 'mine' | 'high' | 'critical';

const EMPTY_STATE_COPY: Record<Chip, { title: string; hint: string }> = {
  all: { title: 'No incidents reported', hint: 'Tap the + button to report one.' },
  mine: { title: "You haven't reported any incidents", hint: 'Switch to All to see every report.' },
  high: { title: 'No high-severity incidents', hint: 'Nothing meets this severity right now.' },
  critical: { title: 'No critical incidents', hint: 'Nothing meets this severity right now.' },
};

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
  const queryClient = useQueryClient();
  const { incidents, isLoading } = useIncidents();
  const { ranges, areas } = useRanges();
  const { queued, retry } = useIncidentQueue();
  const [chip, setChip] = useState<Chip>('all');
  const [wizardOpen, setWizardOpen] = useState(autoOpenWizard);

  const isHigh = (i: Incident) => i.severity === 'High' || i.severity === 'Critical';
  const filtered = incidents.filter((i) => {
    if (chip === 'mine') return i.reportedBy === currentUserId;
    if (chip === 'high') return isHigh(i);
    if (chip === 'critical') return i.severity === 'Critical';
    return true;
  });
  const emptyCopy = EMPTY_STATE_COPY[chip];

  return (
    <div>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-n-100">Incidents</h1>
          <p className="text-13 text-n-70 mt-0.5">Human–wildlife conflict &amp; field observations</p>
        </div>
        {/* Same green as Task Registry's "New task" FAB — red reads as a
            destructive/danger action, which reporting an incident isn't. */}
        <button onClick={() => setWizardOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-ptr-green text-white flex-shrink-0" aria-label="Report incident">
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
          { id: 'mine', label: 'Mine', count: incidents.filter((i) => i.reportedBy === currentUserId).length },
          { id: 'high', label: 'High severity', count: incidents.filter(isHigh).length },
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
              return (
                <div key={incident.id} className="px-4 py-3 border-b border-n-20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-n-100">{formatIncidentType(incident)}</span>
                    <PriorityBadge priority={incident.severity} size="sm" />
                  </div>
                  <p className="text-13 text-n-90 mt-1">{incident.description}</p>
                  <div className="flex items-center gap-1.5 text-xs text-n-70 mt-1.5">
                    <span>{range?.name ?? '—'}{area ? ` · ${area.name}` : ''}</span>
                    <span>·</span>
                    <span>{formatDateTime(incident.incidentDate)}</span>
                  </div>
                  {incident.photos.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {incident.photos.slice(0, 4).map((p) => (
                        <img key={p.id} src={p.url} alt="" className="w-14 h-14 rounded object-cover border border-n-30" />
                      ))}
                    </div>
                  )}
                  {incident.lat !== undefined && incident.lng !== undefined && (
                    <a href={`https://www.google.com/maps?q=${incident.lat},${incident.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-13 text-ptr-accent font-medium mt-1.5">
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

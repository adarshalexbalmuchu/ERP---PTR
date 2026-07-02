import { useState, type FormEvent } from 'react';
import { AlertTriangle, Plus, X, MapPin, Trash2 } from 'lucide-react';
import useStore from '../../store/useStore';
import { useIncidents } from '../../hooks/useIncidents';
import { useRanges } from '../../hooks/useRanges';
import PriorityBadge from '../../components/PriorityBadge';
import EmptyState from '../../components/EmptyState';
import { formatDateTime } from '../../utils/formatters';
import type { IncidentType, IncidentSeverity } from '../../types';

const TYPE_LABELS: Record<IncidentType, string> = {
  human_attack: 'Attack on Human',
  livestock_attack: 'Livestock Attack',
  crop_damage: 'Crop Damage',
  property_damage: 'Property Damage',
  poaching_sign: 'Poaching Sign',
  wildlife_sighting: 'Wildlife Sighting',
  other: 'Other',
};

const TYPES = Object.keys(TYPE_LABELS) as IncidentType[];
const SEVERITIES: IncidentSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

function ReportForm({
  isOpen,
  onClose,
  defaultRangeId,
  lockRange,
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultRangeId: string;
  lockRange: boolean;
}) {
  const { ranges, areas } = useRanges();
  const { reportIncident } = useIncidents();

  const [type, setType] = useState<IncidentType>('wildlife_sighting');
  const [severity, setSeverity] = useState<IncidentSeverity>('Medium');
  const [description, setDescription] = useState('');
  const [rangeId, setRangeId] = useState(defaultRangeId);
  const [areaId, setAreaId] = useState('');
  const [error, setError] = useState('');

  const filteredAreas = areas.filter((a) => a.rangeId === rangeId);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { setError('Description is required'); return; }
    if (!rangeId) { setError('Please select a range'); return; }
    reportIncident.mutate(
      { type, severity, description: description.trim(), rangeId, areaId: areaId || undefined },
      {
        onSuccess: () => {
          setDescription('');
          setAreaId('');
          setSeverity('Medium');
          setType('wildlife_sighting');
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-ptr-cream-dark">
          <h2 className="text-lg font-semibold text-ptr-brown">Report Incident</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-ptr-cream transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-ptr-brown-light" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as IncidentType)} className="input-field">
              {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5">Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)} className="input-field">
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">Range</label>
              <select
                value={rangeId}
                onChange={(e) => { setRangeId(e.target.value); setAreaId(''); }}
                className="input-field"
                disabled={lockRange}
              >
                <option value="">Select range</option>
                {ranges.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">Area / Zone</label>
              <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="input-field" disabled={!rangeId}>
                <option value="">Unspecified</option>
                {filteredAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(''); }}
              placeholder="Describe what happened..."
              rows={4}
              maxLength={3000}
              className={`input-field resize-none ${error ? 'input-error' : ''}`}
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
          <p className="text-xs text-ptr-brown-light flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            Your location will be captured automatically if permitted.
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t border-ptr-cream-dark">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={reportIncident.isPending} className="btn-primary">
              {reportIncident.isPending ? 'Submitting…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function IncidentLog() {
  const currentUser = useStore((s) => s.currentUser);
  const { incidents, isLoading, deleteIncident } = useIncidents();
  const { ranges, areas } = useRanges();
  const [formOpen, setFormOpen] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const lockRange = currentUser?.role !== 'director';
  const canManage = currentUser?.role === 'director' || currentUser?.role === 'range_officer';

  const handleDelete = (id: string) => {
    if (confirm('Delete this incident report? This cannot be undone.')) {
      deleteIncident.mutate(id);
    }
  };

  const filtered = incidents.filter((i) => {
    if (filterType && i.type !== filterType) return false;
    if (filterSeverity && i.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ptr-brown">Incident Log</h1>
          <p className="text-sm text-ptr-brown-light">Human-wildlife conflict &amp; field observations</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Report Incident</span>
        </button>
      </div>

      <div className="card p-4 grid grid-cols-2 gap-3">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field">
          <option value="">All Types</option>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="input-field">
          <option value="">All Severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="w-7 h-7" />}
          title="No incidents reported"
          description="Report a human-wildlife conflict or field observation to get started."
        />
      ) : (
        <div className="card divide-y divide-ptr-cream-dark overflow-hidden">
          {filtered.map((incident) => {
            const range = ranges.find((r) => r.id === incident.rangeId);
            const area = areas.find((a) => a.id === incident.areaId);
            return (
              <div key={incident.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ptr-brown">{TYPE_LABELS[incident.type]}</span>
                    <PriorityBadge priority={incident.severity} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-ptr-brown-light">{formatDateTime(incident.incidentDate)}</span>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(incident.id)}
                        className="p-1 rounded-lg hover:bg-red-50 text-ptr-brown-light hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-ptr-brown">{incident.description}</p>
                <div className="flex items-center gap-2 flex-wrap text-xs text-ptr-brown-light">
                  <span>{range?.name ?? '—'}</span>
                  {area && <><span>·</span><span>{area.name}</span></>}
                  {incident.lat !== undefined && incident.lng !== undefined && (
                    <>
                      <span>·</span>
                      <a
                        href={`https://www.google.com/maps?q=${incident.lat},${incident.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-ptr-green font-medium hover:underline"
                      >
                        <MapPin className="w-3 h-3" />
                        View location
                      </a>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && currentUser && (
        <ReportForm
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          defaultRangeId={lockRange ? (currentUser.rangeId ?? '') : ''}
          lockRange={lockRange && !!currentUser.rangeId}
        />
      )}
    </div>
  );
}

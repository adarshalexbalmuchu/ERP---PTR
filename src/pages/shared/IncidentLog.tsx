import { useState, useEffect, useMemo, type ChangeEvent, type FormEvent } from 'react';
import { AlertTriangle, Plus, X, MapPin, Trash2, Camera, ImagePlus } from 'lucide-react';
import useStore from '../../store/useStore';
import { useIncidents } from '../../hooks/useIncidents';
import { useRanges } from '../../hooks/useRanges';
import { useOfficerRanges } from '../../hooks/useOfficerRanges';
import PriorityBadge from '../../components/PriorityBadge';
import EmptyState from '../../components/EmptyState';
import Select from '../../components/Select';
import { CommandBar, ContextPanel } from '../../components/layout/Slots';
import { PanelSection, PanelItem } from '../../components/layout/PanelNav';
import { Page, PageHeading } from '../../components/layout/Page';
import { formatDateTime } from '../../utils/formatters';
import { MAX_INCIDENT_PHOTOS } from '../../lib/incidentPhotos';
import { INCIDENT_CATEGORIES, formatIncidentType, isOtherIncidentType } from '../../lib/incidentTypes';
import type { IncidentType, IncidentSeverity } from '../../types';

const SEVERITIES: IncidentSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

function ReportForm({
  isOpen,
  onClose,
  defaultRangeId,
  lockRange,
  allowedRangeIds,
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultRangeId: string;
  lockRange: boolean;
  /** When set, the range picker only offers these ranges (a multi-range
      officer reports within their own ranges; directors see all). */
  allowedRangeIds?: string[];
}) {
  const { ranges, areas } = useRanges();
  const selectableRanges = allowedRangeIds?.length
    ? ranges.filter((r) => allowedRangeIds.includes(r.id))
    : ranges;
  const { reportIncident } = useIncidents();

  const [type, setType] = useState<IncidentType>('wildlife_sighting');
  const [typeOther, setTypeOther] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('Medium');
  const [description, setDescription] = useState('');
  const [rangeId, setRangeId] = useState(defaultRangeId);
  const [areaId, setAreaId] = useState('');
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [locationBlocked, setLocationBlocked] = useState(false);

  const isOther = isOtherIncidentType(type);

  // Browsers never re-prompt for geolocation once a user has denied it —
  // getCurrentPosition() would then just silently fail on every future
  // report. Check the permission state up front so we can tell the reporter
  // *why* GPS won't attach and that it needs a settings change, not a retry.
  useEffect(() => {
    if (!isOpen || !('permissions' in navigator)) return;
    let cancelled = false;
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (cancelled) return;
        setLocationBlocked(status.state === 'denied');
        status.onchange = () => setLocationBlocked(status.state === 'denied');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

  // Recomputed only when the file list itself changes (not on every
  // keystroke elsewhere in the form), and revoked on cleanup so preview
  // blobs don't pile up while the modal is open.
  const photoPreviews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => {
    return () => photoPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [photoPreviews]);

  const filteredAreas = areas.filter((a) => a.rangeId === rangeId);

  if (!isOpen) return null;

  const addPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incoming = Array.from(e.target.files);
      setPhotos((prev) => [...prev, ...incoming].slice(0, MAX_INCIDENT_PHOTOS));
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { setError('Description is required'); return; }
    if (!rangeId) { setError('Please select a range'); return; }
    if (isOther && !typeOther.trim()) { setError('Please specify the type'); return; }
    reportIncident.mutate(
      {
        type,
        typeOther: isOther ? typeOther.trim() : undefined,
        severity,
        description: description.trim(),
        rangeId,
        areaId: areaId || undefined,
        files: photos,
      },
      {
        onSuccess: () => {
          setDescription('');
          setAreaId('');
          setSeverity('Medium');
          setType('wildlife_sighting');
          setTypeOther('');
          setPhotos([]);
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
            <Select
              value={type}
              onChange={(e) => { setType(e.target.value as IncidentType); setTypeOther(''); setError(''); }}
              className="input-field select-field"
            >
              {INCIDENT_CATEGORIES.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.options.map((o) => <option key={o.type} value={o.type}>{o.label}</option>)}
                </optgroup>
              ))}
            </Select>
          </div>
          {isOther && (
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">
                Specify type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={typeOther}
                onChange={(e) => { setTypeOther(e.target.value); setError(''); }}
                placeholder="e.g. Snake bite, Fence damage"
                maxLength={100}
                className="input-field"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5">Severity</label>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)} className="input-field select-field">
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">Range</label>
              <Select
                value={rangeId}
                onChange={(e) => { setRangeId(e.target.value); setAreaId(''); }}
                className="input-field select-field"
                disabled={lockRange}
              >
                <option value="">Select range</option>
                {selectableRanges.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ptr-brown mb-1.5">Area / Zone</label>
              <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="input-field select-field" disabled={!rangeId}>
                <option value="">Unspecified</option>
                {filteredAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
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
          {locationBlocked ? (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              Location access is blocked for this app, so reports can't be submitted. Enable location for this site in your browser/phone settings, then reopen this form.
            </p>
          ) : (
            <p className="text-xs text-ptr-brown-light flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              GPS location is required and will be captured automatically — allow the location prompt if asked.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-ptr-brown mb-1.5">
              Photos <span className="text-ptr-brown-light font-normal">(optional, up to {MAX_INCIDENT_PHOTOS})</span>
            </label>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {photos.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="relative w-16 h-16 rounded-xl overflow-hidden border border-ptr-cream-dark flex-shrink-0">
                    <img src={photoPreviews[i]} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                      aria-label={`Remove photo ${i + 1}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < MAX_INCIDENT_PHOTOS && (
              <div className="flex gap-2">
                <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-ptr-cream-dark rounded-xl text-sm text-ptr-brown-light hover:bg-ptr-cream cursor-pointer transition-colors min-h-[44px]">
                  <Camera className="w-4 h-4" />
                  <span>Take Photo</span>
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={addPhotos} />
                </label>
                <label className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-ptr-cream-dark rounded-xl text-sm text-ptr-brown-light hover:bg-ptr-cream cursor-pointer transition-colors min-h-[44px]">
                  <ImagePlus className="w-4 h-4" />
                  <span>Gallery</span>
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} />
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-ptr-cream-dark">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={reportIncident.isPending || locationBlocked} className="btn-primary">
              {reportIncident.isPending ? 'Submitting…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Named-person exception, not a role rule — one specific profile holds the
// tiger_cell role but is deliberately excluded from full incident-log
// access (see incidents_tiger_cell in supabase/schema.sql; internal
// records have who/why). If that profile is ever deleted and recreated,
// this id must be updated to match.
const RESTRICTED_TIGER_CELL_USER_ID = '237e1f9b-cf77-4b83-ae43-7641af75f67f';

export default function IncidentLog() {
  const currentUser = useStore((s) => s.currentUser);
  const { incidents, isLoading, deleteIncident, removePhoto } = useIncidents();
  const { ranges, areas } = useRanges();
  const [formOpen, setFormOpen] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const { activeRangeId, rangeIds, isMultiRange } = useOfficerRanges();
  // Directors and Tiger Cell staff aren't posted to one range, so they pick
  // any range; multi-range officers pick among THEIR ranges (select stays
  // enabled, options limited below); everyone else is locked to their
  // single range.
  const hasNoFixedRange = currentUser?.role === 'director' || currentUser?.role === 'tiger_cell';
  const lockRange = !hasNoFixedRange && !isMultiRange;
  const canManage = currentUser?.role === 'director' ||
    (currentUser?.role === 'tiger_cell' && currentUser.id !== RESTRICTED_TIGER_CELL_USER_ID);

  const handleDelete = (id: string) => {
    if (confirm('Delete this incident report? This cannot be undone.')) {
      deleteIncident.mutate(id);
    }
  };

  const isHigh = (s: string) => s === 'High' || s === 'Critical';
  const filtered = incidents.filter((i) => {
    if (filterType && i.type !== filterType) return false;
    if (filterSeverity === 'high') { if (!isHigh(i.severity)) return false; }
    else if (filterSeverity && i.severity !== filterSeverity) return false;
    return true;
  });
  const highCount = incidents.filter((i) => isHigh(i.severity)).length;
  const criticalCount = incidents.filter((i) => i.severity === 'Critical').length;

  return (
    <>
      <CommandBar>
        <button onClick={() => setFormOpen(true)} className="btn-primary"><Plus className="w-4 h-4" />Report incident</button>
      </CommandBar>

      <ContextPanel>
        <PanelSection label="Views">
          <PanelItem label="All incidents" active={!filterSeverity && !filterType} count={incidents.length} onClick={() => { setFilterSeverity(''); setFilterType(''); }} />
          <PanelItem label="High severity" active={filterSeverity === 'high'} count={highCount} countTone="amber" onClick={() => setFilterSeverity('high')} />
          <PanelItem label="Critical" active={filterSeverity === 'Critical'} count={criticalCount} countTone="red" onClick={() => setFilterSeverity('Critical')} />
        </PanelSection>
        <PanelSection label="Severity">
          {SEVERITIES.map((s) => (
            <PanelItem key={s} label={s} active={filterSeverity === s} count={incidents.filter((i) => i.severity === s).length} onClick={() => setFilterSeverity(s)} />
          ))}
        </PanelSection>
        <div className="px-1">
          <div className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-n-70">Type</div>
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field select-field !min-h-[34px] text-13">
            <option value="">All types</option>
            {INCIDENT_CATEGORIES.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.options.map((o) => <option key={o.type} value={o.type}>{o.label}</option>)}
              </optgroup>
            ))}
          </Select>
        </div>
      </ContextPanel>

      <Page className="space-y-4">
        <PageHeading title="Incident reports" meta="Human–wildlife conflict & field observations" />

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="w-7 h-7" />}
          title="No incidents reported"
          description="Report a human-wildlife conflict or field observation to get started."
        />
      ) : (
        <div className="card divide-y divide-n-20 overflow-hidden">
          {filtered.map((incident) => {
            const range = ranges.find((r) => r.id === incident.rangeId);
            const area = areas.find((a) => a.id === incident.areaId);
            return (
              <div key={incident.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ptr-brown">{formatIncidentType(incident)}</span>
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
                {incident.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {incident.photos.map((photo) => (
                      <div key={photo.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-ptr-cream-dark flex-shrink-0 group">
                        <a href={photo.url} target="_blank" rel="noopener noreferrer">
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        </a>
                        {canManage && (
                          <button
                            onClick={() => { if (confirm('Remove this photo?')) removePhoto.mutate(photo.id); }}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white items-center justify-center hover:bg-red-600 transition-colors hidden group-hover:flex"
                            aria-label="Remove photo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap text-xs text-ptr-brown-light">
                  <span>Reported by {incident.reporterName ?? 'Unknown'}</span>
                  <span>·</span>
                  <span>{range?.name ?? '—'}</span>
                  {area && <><span>·</span><span>{area.name}</span></>}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-ptr-brown-light">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {incident.lat !== undefined && incident.lng !== undefined ? (
                    <>
                      <span className="tabular-nums">{incident.lat.toFixed(5)}, {incident.lng.toFixed(5)}</span>
                      <a
                        href={`https://www.google.com/maps?q=${incident.lat},${incident.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ptr-green font-medium hover:underline"
                      >
                        View on map
                      </a>
                    </>
                  ) : (
                    <span>No GPS location captured for this report</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </Page>

      {formOpen && currentUser && (
        <ReportForm
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          defaultRangeId={hasNoFixedRange ? '' : activeRangeId}
          lockRange={lockRange && !!activeRangeId}
          allowedRangeIds={hasNoFixedRange ? undefined : rangeIds}
        />
      )}
    </>
  );
}

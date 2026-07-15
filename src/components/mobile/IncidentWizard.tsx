import { useEffect, useState } from 'react';
import { ArrowLeft, X, MapPin, RefreshCw, CheckCircle2, WifiOff } from 'lucide-react';
import Select from '../Select';
import EvidenceCapture, { EMPTY_EVIDENCE, type CapturedEvidence } from './EvidenceCapture';
import PriorityBadge from '../PriorityBadge';
import { useRanges } from '../../hooks/useRanges';
import useStore from '../../store/useStore';
import { getCurrentPosition, type Coords } from '../../utils/geolocation';
import { enqueueIncident, loadQueue, processQueue } from '../../lib/offlineIncidentQueue';
import { INCIDENT_CATEGORIES, formatIncidentType } from '../../lib/incidentTypes';
import type { IncidentType, IncidentSeverity } from '../../types';

const SEVERITIES: { value: IncidentSeverity; label: string; hint: string }[] = [
  { value: 'Low', label: 'Low', hint: 'Worth recording, no immediate risk' },
  { value: 'Medium', label: 'Medium', hint: 'Needs attention soon' },
  { value: 'High', label: 'High', hint: 'Needs a prompt response' },
  { value: 'Critical', label: 'Critical', hint: 'Immediate danger or active threat' },
];

const STEPS = ['Type', 'Location', 'Evidence', 'Severity', 'Review'] as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultRangeId: string;
  lockRange: boolean;
  allowedRangeIds?: string[];
  /** Pre-fills the location step with a map-tapped point instead of asking
      the reporter to capture their own device GPS (e.g. "report an incident
      here" from the map). Skips straight past the capture button — the
      point is already known. */
  initialGps?: Coords | null;
}

export default function IncidentWizard({ isOpen, onClose, defaultRangeId, lockRange, allowedRangeIds, initialGps = null }: Props) {
  const currentUser = useStore((s) => s.currentUser);
  const { ranges, areas } = useRanges();
  const selectableRanges = allowedRangeIds?.length ? ranges.filter((r) => allowedRangeIds.includes(r.id)) : ranges;

  const [step, setStep] = useState(0);
  const [type, setType] = useState<IncidentType>('wildlife_sighting');
  const [typeOther, setTypeOther] = useState('');
  const [rangeId, setRangeId] = useState(defaultRangeId);
  const [areaId, setAreaId] = useState('');
  const [gps, setGps] = useState<Coords | null>(initialGps);
  const [gpsError, setGpsError] = useState('');
  const [locating, setLocating] = useState(false);
  const [evidence, setEvidence] = useState<CapturedEvidence>(EMPTY_EVIDENCE);
  const [severity, setSeverity] = useState<IncidentSeverity>('Medium');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'submitted' | 'queued' | null>(null);

  // Re-seeds every time the wizard opens (not just on first mount) — the
  // component instance can persist across opens, and a map tap picks a new
  // point each time.
  useEffect(() => {
    if (isOpen) setGps(initialGps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Escape dismisses the whole wizard, matching the X/back-out-of-step-0
  // button and every other mobile overlay (BottomSheet, search) in the app.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStep(0); setType('wildlife_sighting'); setTypeOther(''); setRangeId(defaultRangeId); setAreaId('');
        setGps(null); setGpsError(''); setEvidence(EMPTY_EVIDENCE); setSeverity('Medium'); setResult(null);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredAreas = areas.filter((a) => a.rangeId === rangeId);
  const isOther = type === 'conflict_other' || type === 'other' || type === 'sighting_other';

  const captureGps = async () => {
    setLocating(true);
    setGpsError('');
    const { coords, failureReason } = await getCurrentPosition();
    if (coords) setGps(coords);
    else setGpsError(failureReason === 'permission_denied' ? 'Location blocked — enable it in settings.' : 'Could not get a GPS fix — try again.');
    setLocating(false);
  };

  const reset = () => {
    setStep(0); setType('wildlife_sighting'); setTypeOther(''); setRangeId(defaultRangeId); setAreaId('');
    setGps(null); setGpsError(''); setEvidence(EMPTY_EVIDENCE); setSeverity('Medium'); setResult(null);
  };

  const canProceed = () => {
    if (step === 0) return !isOther || typeOther.trim().length > 0;
    if (step === 1) return !!gps && !!rangeId;
    return true;
  };

  const submit = async () => {
    if (!currentUser || !gps) return;
    setSubmitting(true);
    const draft = await enqueueIncident({
      type, typeOther: isOther ? typeOther.trim() : undefined, severity,
      description: evidence.note.trim() || `${formatIncidentType({ type, typeOther })} reported from the field.`,
      rangeId, areaId: areaId || undefined,
      lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy,
      photoFiles: evidence.photos,
      reportedBy: currentUser.id,
    });
    await processQueue();
    const stillQueued = loadQueue().some((i) => i.id === draft.id);
    setSubmitting(false);
    setResult(stillQueued ? 'queued' : 'submitted');
  };

  const close = () => { reset(); onClose(); };

  if (result) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6 text-center">
        {result === 'submitted' ? (
          <>
            <CheckCircle2 className="w-14 h-14 text-signal-green mb-4" />
            <h2 className="text-xl font-semibold text-n-100">Report submitted</h2>
            <p className="text-15 text-n-70 mt-1.5">Your incident report has been sent.</p>
          </>
        ) : (
          <>
            <WifiOff className="w-14 h-14 text-signal-amber mb-4" />
            <h2 className="text-xl font-semibold text-n-100">Saved offline</h2>
            <p className="text-15 text-n-70 mt-1.5">This incident will be submitted when a connection is available.</p>
          </>
        )}
        <button onClick={close} className="btn-primary h-12 px-8 mt-6 text-[15px]">Done</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-2 px-2 h-14 border-b border-n-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={() => (step === 0 ? close() : setStep((s) => s - 1))} className="w-11 h-11 flex items-center justify-center rounded-full text-n-90" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 text-center text-13 font-semibold text-n-70">Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>
        <button onClick={close} className="w-11 h-11 flex items-center justify-center rounded-full text-n-70" aria-label="Cancel">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-shrink-0 h-1 bg-n-20">
        <div className="h-full bg-ptr-green transition-all duration-200" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {step === 0 && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold text-n-100">What happened?</h1>
            {INCIDENT_CATEGORIES.map((group) => (
              <div key={group.id}>
                <div className="text-xs font-semibold uppercase tracking-wide text-n-70 mb-2">{group.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  {group.options.map((o) => (
                    <button
                      key={o.type}
                      onClick={() => { setType(o.type); setTypeOther(''); }}
                      className={`h-14 px-3 rounded border text-left text-[15px] font-medium transition-colors ${type === o.type ? 'border-ptr-green bg-ptr-green/10 text-ptr-green' : 'border-n-30 text-n-90'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {isOther && (
              <div>
                <label className="block text-13 font-medium text-n-90 mb-1.5">Specify type</label>
                <input value={typeOther} onChange={(e) => setTypeOther(e.target.value)} placeholder="e.g. Snake bite, fence damage" className="input-field" style={{ fontSize: '16px' }} maxLength={100} />
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold text-n-100">Where did this happen?</h1>
            <button onClick={captureGps} disabled={locating} className="w-full flex items-center gap-3 rounded border border-n-30 p-4">
              {locating ? <RefreshCw className="w-5 h-5 text-ptr-green animate-spin" /> : <MapPin className={`w-5 h-5 ${gps ? 'text-signal-green' : 'text-n-70'}`} />}
              <div className="flex-1 text-left">
                <div className="text-[15px] font-medium text-n-100">{gps ? 'Location captured' : locating ? 'Getting your location…' : 'Capture current GPS location'}</div>
                {gps && <div className="text-13 text-n-70 tabular-nums">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}{gps.accuracy ? ` · ±${Math.round(gps.accuracy)}m` : ''}</div>}
                {gpsError && <div className="text-13 text-signal-red">{gpsError}</div>}
              </div>
            </button>
            <div>
              <label className="block text-13 font-medium text-n-90 mb-1.5">Range</label>
              <Select value={rangeId} onChange={(e) => { setRangeId(e.target.value); setAreaId(''); }} className="input-field select-field" disabled={lockRange}>
                <option value="">Select range</option>
                {selectableRanges.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </div>
            {filteredAreas.length > 0 && (
              <div>
                <label className="block text-13 font-medium text-n-90 mb-1.5">Beat / area</label>
                <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="input-field select-field">
                  <option value="">Unspecified</option>
                  {filteredAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold text-n-100">Add evidence</h1>
            <EvidenceCapture value={evidence} onChange={setEvidence} photosOnly showGps={false} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-n-100 mb-2">How severe is it?</h1>
            {SEVERITIES.map((s) => (
              <button
                key={s.value}
                onClick={() => setSeverity(s.value)}
                className={`w-full flex items-center justify-between gap-3 rounded border p-4 text-left transition-colors ${severity === s.value ? 'border-ptr-green bg-ptr-green/10' : 'border-n-30'}`}
              >
                <div>
                  <PriorityBadge priority={s.value === 'Critical' ? 'Critical' : s.value === 'High' ? 'High' : s.value === 'Medium' ? 'Medium' : 'Low'} />
                  <div className="text-13 text-n-70 mt-1">{s.hint}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-n-100">Review &amp; submit</h1>
            <div className="rounded border border-n-30 divide-y divide-n-20">
              <div className="p-3"><div className="text-xs text-n-70">Type</div><div className="text-[15px] text-n-100 mt-0.5">{formatIncidentType({ type, typeOther })}</div></div>
              <div className="p-3"><div className="text-xs text-n-70">Location</div><div className="text-[15px] text-n-100 mt-0.5">{ranges.find((r) => r.id === rangeId)?.name ?? '—'}{areaId ? ` · ${areas.find((a) => a.id === areaId)?.name}` : ''}</div>{gps && <div className="text-13 text-n-70 tabular-nums">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</div>}</div>
              <div className="p-3"><div className="text-xs text-n-70">Severity</div><div className="mt-0.5"><PriorityBadge priority={severity} /></div></div>
              <div className="p-3"><div className="text-xs text-n-70">Evidence</div><div className="text-[15px] text-n-100 mt-0.5">{evidence.photos.length} photo{evidence.photos.length !== 1 ? 's' : ''}</div></div>
              {evidence.note && <div className="p-3"><div className="text-xs text-n-70">Note</div><p className="text-[15px] text-n-100 mt-0.5 whitespace-pre-wrap">{evidence.note}</p></div>}
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-n-30 p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} className="btn-primary w-full h-12 text-[15px]">Continue</button>
        ) : (
          <button onClick={submit} disabled={submitting} className="btn-primary w-full h-12 text-[15px]">{submitting ? 'Submitting…' : 'Submit report'}</button>
        )}
      </div>
    </div>
  );
}

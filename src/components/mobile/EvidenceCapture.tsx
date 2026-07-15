import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus, Video, Mic, Square, MapPin, X, FileText } from 'lucide-react';
import { getCurrentPosition, type Coords } from '../../utils/geolocation';

export interface CapturedEvidence {
  photos: File[];
  videos: File[];
  audio: File | null;
  note: string;
  gps: Coords | null;
}

const EMPTY: CapturedEvidence = { photos: [], videos: [], audio: null, note: '', gps: null };

function ActionButton({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 h-[76px] rounded border transition-colors ${
        active ? 'border-signal-red bg-signal-red-bg text-signal-red' : 'border-n-30 bg-n-10 text-n-90'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

// Capture-only UI: photo/gallery/video/voice-note/written-note/GPS, staged
// locally. The caller (task detail's evidence sheet, incident wizard step 3)
// owns persistence — upload targets differ (task attachments vs incident
// photos), so this component just hands back what was captured.
export default function EvidenceCapture({
  value,
  onChange,
  showNote = true,
  photosOnly = false,
  showGps = true,
}: {
  value: CapturedEvidence;
  onChange: (v: CapturedEvidence) => void;
  showNote?: boolean;
  /** Incident evidence only has a photos column server-side (no video/audio
      table for incidents) — hides those capture actions rather than collect
      media that has nowhere to be saved. */
  photosOnly?: boolean;
  showGps?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const canRecordAudio = !photosOnly && typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices;

  useEffect(() => () => { recorderRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const addPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    onChange({ ...value, photos: [...value.photos, ...Array.from(e.target.files)] });
    e.target.value = '';
  };
  const addVideo = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    onChange({ ...value, videos: [...value.videos, ...Array.from(e.target.files)] });
    e.target.value = '';
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        onChange({ ...value, audio: file });
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      alert('Microphone access is blocked — enable it in your browser/phone settings to record a voice note.');
    }
  };

  const captureGps = async () => {
    setGpsBusy(true);
    const { coords } = await getCurrentPosition();
    onChange({ ...value, gps: coords });
    setGpsBusy(false);
  };

  const itemCount = value.photos.length + value.videos.length + (value.audio ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <ActionButton icon={<Camera className="w-5 h-5" />} label="Take photo" onClick={() => photoInputRef.current?.click()} />
        <ActionButton icon={<ImagePlus className="w-5 h-5" />} label="Choose from gallery" onClick={() => galleryInputRef.current?.click()} />
        {!photosOnly && <ActionButton icon={<Video className="w-5 h-5" />} label="Record video" onClick={() => videoInputRef.current?.click()} />}
        {canRecordAudio && (
          <ActionButton
            icon={recording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            label={recording ? 'Stop recording' : 'Voice note'}
            active={recording}
            onClick={toggleRecording}
          />
        )}
        {showGps && (
          <ActionButton
            icon={<MapPin className="w-5 h-5" />}
            label={gpsBusy ? 'Locating…' : value.gps ? 'GPS captured' : 'Capture GPS'}
            active={!!value.gps}
            onClick={captureGps}
          />
        )}
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={addPhotos} />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} />
      <input ref={videoInputRef} type="file" accept="video/*" capture="environment" className="sr-only" onChange={addVideo} />

      {value.gps && (
        <div className="flex items-center gap-2 text-13 text-n-80 bg-n-10 rounded px-3 py-2">
          <MapPin className="w-3.5 h-3.5 text-signal-green flex-shrink-0" />
          <span className="tabular-nums">{value.gps.lat.toFixed(5)}, {value.gps.lng.toFixed(5)}</span>
          {value.gps.accuracy && <span className="text-n-70">· ±{Math.round(value.gps.accuracy)}m</span>}
          <button onClick={() => onChange({ ...value, gps: null })} className="ml-auto text-n-60"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {value.audio && (
        <div className="flex items-center gap-2 bg-n-10 rounded px-3 py-2">
          <Mic className="w-3.5 h-3.5 text-n-70 flex-shrink-0" />
          <audio controls src={URL.createObjectURL(value.audio)} className="h-8 flex-1 min-w-0" />
          <button onClick={() => onChange({ ...value, audio: null })} className="text-n-60 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {itemCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.photos.map((f, i) => (
            <div key={`p${i}`} className="relative w-16 h-16 rounded overflow-hidden border border-n-30 flex-shrink-0">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button onClick={() => onChange({ ...value, photos: value.photos.filter((_, x) => x !== i) })} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {value.videos.map((_, i) => (
            <div key={`v${i}`} className="relative w-16 h-16 rounded overflow-hidden border border-n-30 flex-shrink-0 bg-n-90 flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
              <button onClick={() => onChange({ ...value, videos: value.videos.filter((_, x) => x !== i) })} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showNote && (
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-n-70 mb-1.5">
            <FileText className="w-3.5 h-3.5" />Written note
          </label>
          <textarea
            value={value.note}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            placeholder="Describe what you observed…"
            rows={3}
            maxLength={2000}
            className="input-field resize-none"
            style={{ fontSize: '16px' }}
          />
        </div>
      )}
    </div>
  );
}

export { EMPTY as EMPTY_EVIDENCE };

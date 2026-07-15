import { supabase } from './supabase';
import { uploadIncidentPhoto } from './incidentPhotos';
import type { IncidentType, IncidentSeverity } from '../types';

// A dedicated, localStorage-backed draft queue for incident reports created
// offline — deliberately NOT routed through useIncidents' reportIncident
// mutation. That mutation (a) re-captures GPS at submit time, which is wrong
// for something drafted earlier at a different spot, and (b) hands raw
// File objects to TanStack Query's mutation cache, which the sync-storage
// persister JSON-serializes — File/Blob silently become "{}" across a
// reload, so photos attached to a paused offline mutation would be lost
// the moment the app restarts before reconnecting. Photos here are instead
// base64-encoded into the draft itself, so the whole record — coordinates,
// description, photos — survives a killed app/reload while offline.
export interface DraftIncident {
  id: string;
  type: IncidentType;
  typeOther?: string;
  severity: IncidentSeverity;
  description: string;
  rangeId: string;
  areaId?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  photos: string[]; // base64 data URLs, captured at draft time
  reportedBy: string;
  capturedAt: string;
  status: 'pending' | 'submitting' | 'failed';
  error?: string;
}

const KEY = 'ptr-incident-draft-queue';
const listeners = new Set<() => void>();

function notify() { listeners.forEach((l) => l()); }
export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadQueue(): DraftIncident[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DraftIncident[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: DraftIncident[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full/unavailable — best effort */ }
  notify();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToFile(dataUrl: string, name: string): File {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

export async function enqueueIncident(draft: {
  type: IncidentType;
  typeOther?: string;
  severity: IncidentSeverity;
  description: string;
  rangeId: string;
  areaId?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  photoFiles: File[];
  reportedBy: string;
}): Promise<DraftIncident> {
  const photos = await Promise.all(draft.photoFiles.map(fileToBase64));
  const item: DraftIncident = {
    id: crypto.randomUUID(),
    type: draft.type,
    typeOther: draft.typeOther,
    severity: draft.severity,
    description: draft.description,
    rangeId: draft.rangeId,
    areaId: draft.areaId,
    lat: draft.lat,
    lng: draft.lng,
    accuracy: draft.accuracy,
    photos,
    reportedBy: draft.reportedBy,
    capturedAt: new Date().toISOString(),
    status: 'pending',
  };
  saveQueue([item, ...loadQueue()]);
  return item;
}

export function removeFromQueue(id: string) {
  saveQueue(loadQueue().filter((i) => i.id !== id));
}

function patchQueue(id: string, patch: Partial<DraftIncident>) {
  saveQueue(loadQueue().map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

async function submitDraft(draft: DraftIncident): Promise<void> {
  const { data: row, error } = await supabase
    .from('incidents')
    .insert({
      type: draft.type,
      type_other: draft.typeOther ?? null,
      severity: draft.severity,
      description: draft.description,
      range_id: draft.rangeId,
      area_id: draft.areaId ?? null,
      reported_by: draft.reportedBy,
      lat: draft.lat,
      lng: draft.lng,
      incident_date: draft.capturedAt,
    })
    .select()
    .single();
  if (error) throw error;

  for (let i = 0; i < draft.photos.length; i++) {
    const file = base64ToFile(draft.photos[i], `field-photo-${i + 1}.jpg`);
    await uploadIncidentPhoto(row.id, draft.reportedBy, file);
  }
}

let processing = false;
/** Attempts every queued draft in order; stops at the first failure (keeps
    retry order stable) but leaves later drafts queued for the next attempt. */
export async function processQueue(): Promise<void> {
  if (processing || !navigator.onLine) return;
  processing = true;
  try {
    for (const draft of loadQueue()) {
      if (draft.status === 'submitting') continue;
      patchQueue(draft.id, { status: 'submitting', error: undefined });
      try {
        await submitDraft(draft);
        removeFromQueue(draft.id);
      } catch (err) {
        patchQueue(draft.id, { status: 'failed', error: err instanceof Error ? err.message : 'Submission failed' });
      }
    }
  } finally {
    processing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void processQueue(); });
}

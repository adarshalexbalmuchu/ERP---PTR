import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

// Must stay in sync with the incident-photos bucket's file_size_limit in
// supabase/schema.sql. Photos are compressed client-side first (see
// compressPhoto below), so anything still over this cap likely means
// compression failed rather than the photo being legitimately huge.
export const MAX_INCIDENT_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_INCIDENT_PHOTOS = 5;

// Phone camera photos are typically 3-8 MB. Resizing to a 1600px max edge
// at ~75% JPEG quality brings that down to roughly 150-400 KB with no
// visible quality loss for reviewing an incident — the single biggest
// lever for both storage cost and upload reliability on a weak field
// signal. Runs in a Web Worker so it doesn't block the UI, and handles
// EXIF orientation automatically (a phone photo's rotation tag is a common
// source of "why is my photo sideways" bugs if resized by hand).
async function compressPhoto(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      initialQuality: 0.75,
    });
  } catch {
    // If compression fails for any reason (unsupported format, worker
    // unavailable, etc.), fall back to the original file — still subject
    // to the hard size cap below, so nothing oversized slips through.
    return file;
  }
}

export async function uploadIncidentPhoto(incidentId: string, userId: string, file: File): Promise<void> {
  const compressed = await compressPhoto(file);
  if (compressed.size > MAX_INCIDENT_PHOTO_BYTES) {
    throw new Error(`"${file.name}" is too large even after compression \u2014 try a smaller photo`);
  }

  const path = `${incidentId}/${crypto.randomUUID()}.jpg`;
  const { error: uploadErr } = await supabase.storage
    .from('incident-photos')
    .upload(path, compressed, { contentType: compressed.type || 'image/jpeg' });
  if (uploadErr) throw uploadErr;

  const { error } = await supabase.from('incident_photos').insert({
    incident_id: incidentId,
    uploaded_by: userId,
    path,
    size: compressed.size,
    mime_type: compressed.type || 'image/jpeg',
  });
  if (error) throw error;
}

import { supabase } from './supabase';

// Must stay in sync with the bucket's file_size_limit in supabase/schema.sql
// — that server-side cap is what actually enforces this; checking here just
// gives a readable error instead of a storage 413.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

// Shared by the in-task attachment uploader (useTask.ts) and the "attach
// files while creating a task" flow in TaskForm — both need to land a file
// in the private task-attachments bucket and record it in the attachments
// table the same way.
export async function uploadTaskAttachment(taskId: string, userId: string, file: File): Promise<void> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" is too large — attachments are limited to 25 MB`);
  }
  const path = `${taskId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadErr } = await supabase.storage.from('task-attachments').upload(path, file);
  if (uploadErr) throw uploadErr;

  // Store the bare storage path — the bucket is private, so viewing
  // requires a signed URL generated on demand (see resolveAttachmentUrls).
  const { error } = await supabase.from('attachments').insert({
    task_id: taskId,
    user_id: userId,
    name: file.name,
    url: path,
    size: file.size,
    mime_type: file.type,
  });
  if (error) throw error;
}

import type { Database } from './database.types';
import type { User, Task, TaskUpdate, Comment, Attachment, Notification } from '../types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskUpdateRow = Database['public']['Tables']['task_updates']['Row'];
type CommentRow = Database['public']['Tables']['comments']['Row'];
type AttachmentRow = Database['public']['Tables']['attachments']['Row'];
type NotificationRow = Database['public']['Tables']['notifications']['Row'];

export function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone ?? undefined,
    avatarInitials: row.avatar_initials,
    designation: row.designation,
    rangeId: row.range_id ?? undefined,
  };
}

export function mapTaskUpdate(row: TaskUpdateRow): TaskUpdate {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    note: row.note,
    progressPercentage: row.progress_percentage,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapComment(row: CommentRow): Comment {
  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function mapAttachment(row: AttachmentRow): Attachment {
  // row.url stores the bare storage path; resolveAttachmentUrls() replaces
  // url/previewUrl with a time-limited signed URL before this reaches the UI.
  return {
    id: row.id,
    name: row.name,
    type: row.mime_type,
    size: row.size,
    path: row.url,
    url: row.url,
    previewUrl: undefined,
  };
}

export function mapTask(
  row: TaskRow & {
    task_updates?: TaskUpdateRow[];
    comments?: CommentRow[];
    attachments?: AttachmentRow[];
  },
): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assigneeId: row.assignee_id,
    createdById: row.created_by_id,
    rangeId: row.range_id,
    areaId: row.area_id ?? undefined,
    status: row.status,
    priority: row.priority,
    category: row.category,
    dueDate: row.due_date,
    completionPercentage: row.completion_percentage,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    taskUpdates: (row.task_updates ?? []).map(mapTaskUpdate),
    comments: (row.comments ?? []).map(mapComment),
    attachments: (row.attachments ?? []).map(mapAttachment),
  };
}

export function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    taskId: row.task_id,
    read: row.read,
    createdAt: row.created_at,
  };
}

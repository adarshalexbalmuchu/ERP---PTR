import type { Database } from './database.types';
import type { User, Task, TaskUpdate, Comment, Attachment, Notification, Incident, IncidentPhoto, AuditLogEntry, LiveLocation } from '../types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskUpdateRow = Database['public']['Tables']['task_updates']['Row'];
type CommentRow = Database['public']['Tables']['comments']['Row'];
type AttachmentRow = Database['public']['Tables']['attachments']['Row'];
type NotificationRow = Database['public']['Tables']['notifications']['Row'];
type IncidentRow = Database['public']['Tables']['incidents']['Row'];
type IncidentPhotoRow = Database['public']['Tables']['incident_photos']['Row'];
type AuditLogRow = Database['public']['Tables']['audit_log']['Row'];

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
    task_assignees?: { user_id: string }[];
  },
): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assigneeId: row.assignee_id,
    coAssigneeIds: (row.task_assignees ?? []).map((a) => a.user_id),
    createdById: row.created_by_id,
    rangeId: row.range_id,
    areaId: row.area_id ?? undefined,
    status: row.status,
    priority: row.priority,
    category: row.category,
    categoryOther: row.category_other ?? undefined,
    dueDate: row.due_date,
    completionPercentage: row.completion_percentage,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    batchId: row.batch_id ?? undefined,
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
    taskId: row.task_id ?? undefined,
    incidentId: row.incident_id ?? undefined,
    read: row.read,
    createdAt: row.created_at,
  };
}

export function mapIncidentPhoto(row: IncidentPhotoRow): IncidentPhoto {
  // row.path stores the bare storage path; resolveIncidentPhotoUrls() in
  // useIncidents.ts replaces url with a time-limited signed URL.
  return {
    id: row.id,
    path: row.path,
    url: row.path,
    size: row.size,
    type: row.mime_type,
  };
}

export function mapIncident(
  row: IncidentRow & {
    incident_photos?: IncidentPhotoRow[];
    profiles?: { name: string } | null;
  },
): Incident {
  return {
    id: row.id,
    type: row.type,
    typeOther: row.type_other ?? undefined,
    severity: row.severity,
    description: row.description,
    rangeId: row.range_id,
    areaId: row.area_id ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    reportedBy: row.reported_by,
    reporterName: row.profiles?.name ?? undefined,
    incidentDate: row.incident_date,
    createdAt: row.created_at,
    photos: (row.incident_photos ?? []).map(mapIncidentPhoto),
  };
}

type LiveLocationRow = Database['public']['Tables']['live_locations']['Row'];

export function mapLiveLocation(
  row: LiveLocationRow & {
    profiles: { name: string; avatar_initials: string; designation: string } | null;
    tasks: { title: string } | null;
  },
): LiveLocation {
  return {
    userId: row.user_id,
    userName: row.profiles?.name ?? 'Unknown',
    avatarInitials: row.profiles?.avatar_initials ?? '',
    designation: row.profiles?.designation ?? '',
    taskId: row.task_id,
    taskTitle: row.tasks?.title ?? 'Untitled task',
    lat: row.lat,
    lng: row.lng,
    updatedAt: row.updated_at,
  };
}

export function mapAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    taskId: row.task_id ?? undefined,
    taskTitle: row.task_title,
    rangeId: row.range_id ?? undefined,
    actorId: row.actor_id,
    action: row.action,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

export type Role = 'director' | 'range_officer' | 'guard' | 'range_office' | 'tiger_cell';

// range_office and tiger_cell hold the same access level as guard (field
// staff scoped to their own assigned tasks/incidents) — just a different
// personnel label. Anywhere the app branches on "is this a field-level
// user", check this instead of `role === 'guard'` directly.
export const FIELD_ROLES: Role[] = ['guard', 'range_office', 'tiger_cell'];
export function isFieldRole(role: Role | undefined): boolean {
  return role !== undefined && FIELD_ROLES.includes(role);
}

export type TaskStatus = 'NotStarted' | 'InProgress' | 'Completed' | 'Archived';

export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type TaskCategory =
  | 'Patrol'
  | 'Camera Trap'
  | 'Survey'
  | 'Maintenance'
  | 'Admin'
  | 'Other';

export interface Range {
  id: string;
  name: string;
}

export interface Area {
  id: string;
  rangeId: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  phone?: string;
  avatarInitials: string;
  designation: string;
  rangeId?: string;
  /** Every range this user holds: rangeId plus any officer_ranges rows.
      Only populated for the signed-in user (AuthContext); an officer with
      more than one entry gets a range switcher in their pages. */
  rangeIds?: string[];
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  /** Raw storage path (bucket-relative), used to generate/revoke signed URLs. */
  path: string;
  /** Time-limited signed URL for viewing/downloading. */
  url: string;
  previewUrl?: string;
}

export interface TaskUpdate {
  id: string;
  taskId: string;
  userId: string;
  note: string;
  progressPercentage: number;
  lat?: number;
  lng?: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  /** Additional collaborators beyond the primary assignee — same access as the assignee. */
  coAssigneeIds: string[];
  createdById: string;
  rangeId: string;
  areaId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  /** Free-text label when category is 'Other'; undefined otherwise. */
  categoryOther?: string;
  dueDate: string;
  completionPercentage: number;
  taskUpdates: TaskUpdate[];
  acknowledgedAt?: string;
  completedAt?: string;
  archivedAt?: string;
  createdAt: string;
  comments: Comment[];
  attachments: Attachment[];
}

export interface Notification {
  id: string;
  userId: string;
  type:
    | 'task_assigned'
    | 'task_updated'
    | 'task_completed'
    | 'changes_requested'
    | 'task_archived';
  title: string;
  message: string;
  taskId: string;
  read: boolean;
  createdAt: string;
}

export type IncidentType =
  | 'human_attack'
  | 'livestock_attack'
  | 'crop_damage'
  | 'property_damage'
  | 'conflict_other'
  | 'poaching_sign'
  | 'road_kill'
  | 'animal_injury'
  | 'tree_felling'
  | 'other'
  | 'wildlife_sighting'
  | 'sighting_other';

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface IncidentPhoto {
  id: string;
  path: string;
  url: string;
  size: number;
  type: string;
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  rangeId: string;
  areaId?: string;
  lat?: number;
  lng?: number;
  reportedBy: string;
  incidentDate: string;
  createdAt: string;
  photos: IncidentPhoto[];
}

// Current live location of a field-role user on an active patrol task —
// see useLocationSharing/useLiveLocations in src/hooks/useLiveLocation.ts.
export interface LiveLocation {
  userId: string;
  userName: string;
  avatarInitials: string;
  designation: string;
  taskId: string;
  taskTitle: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  taskId?: string;
  taskTitle: string;
  rangeId?: string;
  actorId: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface AppState {
  currentUser: User | null;
  /** Range a multi-range officer is currently working in.
      null = fall back to their first range. */
  activeRangeId: string | null;
}

export interface AppActions {
  setCurrentUser: (user: User | null) => void;
  setActiveRangeId: (rangeId: string | null) => void;
  logout: () => void;
}

export type Store = AppState & AppActions;

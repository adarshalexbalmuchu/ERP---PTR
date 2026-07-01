export type Role = 'director' | 'range_officer' | 'guard';

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
  createdById: string;
  rangeId: string;
  areaId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
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

export interface DailyReport {
  id: string;
  reportDate: string;
  generatedBy: string;
  totalTasks: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  overdueCount: number;
  rangeBreakdown: Array<{
    rangeId: string;
    rangeName: string;
    total: number;
    completed: number;
    overdue: number;
  }>;
  createdAt: string;
}

export type IncidentType =
  | 'human_attack'
  | 'livestock_attack'
  | 'crop_damage'
  | 'property_damage'
  | 'poaching_sign'
  | 'wildlife_sighting'
  | 'other';

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

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
  users: User[];
  ranges: Range[];
  areas: Area[];
  tasks: Task[];
  notifications: Notification[];
  reports: DailyReport[];
}

export interface AppActions {
  setCurrentUser: (user: User | null) => void;
  login: (email: string, password: string) => User | null;
  logout: () => void;
  createTask: (
    data: Omit<Task, 'id' | 'createdAt' | 'comments' | 'attachments' | 'taskUpdates'>
  ) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addComment: (taskId: string, content: string, userId: string) => void;
  addAttachment: (taskId: string, attachment: Attachment) => void;
  removeAttachment: (taskId: string, attachmentId: string) => void;
  addTaskUpdate: (
    taskId: string,
    note: string,
    progressPercentage: number,
    userId: string
  ) => void;
  startTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  archiveTask: (taskId: string) => void;
  requestChanges: (taskId: string, comment?: string) => void;
  createUser: (user: Omit<User, 'id'>) => User;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  generateDailyReport: () => DailyReport;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
}

export type Store = AppState & AppActions;

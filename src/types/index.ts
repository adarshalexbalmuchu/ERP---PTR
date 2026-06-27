export type Role = 'admin' | 'staff';

export type TaskStatus = 'Unread' | 'InProgress' | 'Done' | 'Approved';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TaskCategory =
  | 'Patrol'
  | 'Camera Trap'
  | 'Survey'
  | 'Maintenance'
  | 'Admin'
  | 'Other';

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  avatarInitials: string;
  designation: string;
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
  previewUrl?: string; // object URL — only kept in memory, NOT persisted
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  createdById: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string; // ISO string
  acknowledgedAt?: string;
  completedAt?: string;
  createdAt: string;
  comments: Comment[];
  attachments: Attachment[];
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  taskId: string;
  read: boolean;
  createdAt: string;
}

export interface AppState {
  // Auth
  currentUser: User | null;
  // Data
  users: User[];
  tasks: Task[];
  notifications: Notification[];
}

export interface AppActions {
  login: (email: string, password: string) => User | null;
  logout: () => void;
  createTask: (
    data: Omit<Task, 'id' | 'createdAt' | 'comments' | 'attachments'>
  ) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addComment: (taskId: string, content: string, userId: string) => void;
  addAttachment: (taskId: string, attachment: Attachment) => void;
  removeAttachment: (taskId: string, attachmentId: string) => void;
  acknowledgeTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  approveTask: (taskId: string) => void;
  requestChanges: (taskId: string, comment?: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
}

export type Store = AppState & AppActions;

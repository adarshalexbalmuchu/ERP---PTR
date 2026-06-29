import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isOverdue } from '../utils/overdue';
import type {
  Store,
  User,
  Task,
  Notification,
  Attachment,
  Range,
  Area,
  TaskUpdate,
  DailyReport,
} from '../types';

// ─── Seed: Ranges ─────────────────────────────────────────────────────────────

const SEED_RANGES: Range[] = [
  { id: 'range-betla', name: 'Betla Range' },
  { id: 'range-latehar', name: 'Latehar Range' },
  { id: 'range-kechki', name: 'Kechki Range' },
];

// ─── Seed: Areas ──────────────────────────────────────────────────────────────

const SEED_AREAS: Area[] = [
  { id: 'area-b1', rangeId: 'range-betla', name: 'North Core Zone' },
  { id: 'area-b2', rangeId: 'range-betla', name: 'South Core Zone' },
  { id: 'area-b3', rangeId: 'range-betla', name: 'Buffer Zone' },
  { id: 'area-l1', rangeId: 'range-latehar', name: 'Tiger Reserve Area' },
  { id: 'area-l2', rangeId: 'range-latehar', name: 'Corridor Zone' },
  { id: 'area-k1', rangeId: 'range-kechki', name: 'Core Area' },
  { id: 'area-k2', rangeId: 'range-kechki', name: 'Village Buffer' },
];

// ─── Seed: Users ──────────────────────────────────────────────────────────────

const SEED_USERS: User[] = [
  {
    id: 'user-1',
    name: 'Dr. Arvind Mishra',
    role: 'director',
    email: 'director@ptr.in',
    phone: '9431200001',
    avatarInitials: 'AM',
    designation: 'IFS — Director, PTR',
  },
  {
    id: 'user-2',
    name: 'Rajesh Kumar',
    role: 'range_officer',
    email: 'officer@ptr.in',
    phone: '9431200002',
    avatarInitials: 'RK',
    designation: 'Range Officer — Betla',
    rangeId: 'range-betla',
  },
  {
    id: 'user-3',
    name: 'Priya Oraon',
    role: 'range_officer',
    email: 'officer.latehar@ptr.in',
    phone: '9431200003',
    avatarInitials: 'PO',
    designation: 'Range Officer — Latehar',
    rangeId: 'range-latehar',
  },
  {
    id: 'user-4',
    name: 'Abhay Kumar',
    role: 'guard',
    email: 'guard@ptr.in',
    phone: '9431200004',
    avatarInitials: 'AK',
    designation: 'Forest Guard',
    rangeId: 'range-betla',
  },
  {
    id: 'user-5',
    name: 'Manish Singh',
    role: 'guard',
    email: 'manish@ptr.in',
    phone: '9431200005',
    avatarInitials: 'MS',
    designation: 'Anti-Poaching Watcher',
    rangeId: 'range-betla',
  },
  {
    id: 'user-6',
    name: 'Iqbal Ahmed',
    role: 'guard',
    email: 'iqbal@ptr.in',
    phone: '9431200006',
    avatarInitials: 'IA',
    designation: 'Forest Guard',
    rangeId: 'range-latehar',
  },
  {
    id: 'user-7',
    name: 'Vivek Sahu',
    role: 'guard',
    email: 'vivek@ptr.in',
    phone: '9431200007',
    avatarInitials: 'VS',
    designation: 'Tiger Cell Staff',
    rangeId: 'range-kechki',
  },
];

// ─── Seed: Tasks ──────────────────────────────────────────────────────────────

const SEED_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Retrieve camera-trap SD cards from Betla North Core',
    description:
      'Collect all SD cards from camera-trap stations in North Core Zone. Download footage, label each card by grid reference/date, and replace before sunset. Submit footage log to Range Officer.',
    assigneeId: 'user-4',
    createdById: 'user-2',
    rangeId: 'range-betla',
    areaId: 'area-b1',
    status: 'InProgress',
    priority: 'Medium',
    category: 'Camera Trap',
    dueDate: '2026-07-05',
    completionPercentage: 40,
    taskUpdates: [
      {
        id: 'tu-1-1',
        taskId: 'task-1',
        userId: 'user-4',
        note: 'Collected cards from stations B1 and B2. Footage downloaded. Heading to B3 tomorrow.',
        progressPercentage: 40,
        createdAt: '2026-06-25T11:00:00.000Z',
      },
    ],
    acknowledgedAt: '2026-06-20T09:00:00.000Z',
    createdAt: '2026-06-18T08:00:00.000Z',
    comments: [
      {
        id: 'c-1-1',
        userId: 'user-2',
        content: 'Label cards by grid reference, not just date. Follow the camera-trap SOP.',
        createdAt: '2026-06-18T09:30:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-2',
    title: 'Wildlife sign survey — Compartment 4, Kechki',
    description:
      'Conduct sign survey in Forest Compartment 4 near Kechki. Document pugmarks, scat, direct sightings. Fill standard survey form and submit photographs as evidence.',
    assigneeId: 'user-7',
    createdById: 'user-1',
    rangeId: 'range-kechki',
    areaId: 'area-k1',
    status: 'NotStarted',
    priority: 'High',
    category: 'Survey',
    dueDate: '2026-07-02',
    completionPercentage: 0,
    taskUpdates: [],
    createdAt: '2026-06-25T07:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-3',
    title: 'Repair patrol vehicle JH-12-PA-3456',
    description:
      'Vehicle has faulty cooling system and worn brake pads. Coordinate with divisional workshop for immediate repair. Obtain fitness certificate before weekend patrol deployment.',
    assigneeId: 'user-5',
    createdById: 'user-2',
    rangeId: 'range-betla',
    status: 'Completed',
    priority: 'High',
    category: 'Maintenance',
    dueDate: '2026-06-29',
    completionPercentage: 100,
    taskUpdates: [
      {
        id: 'tu-3-1',
        taskId: 'task-3',
        userId: 'user-5',
        note: 'Vehicle taken to workshop. Cooling system being inspected.',
        progressPercentage: 50,
        createdAt: '2026-06-22T10:00:00.000Z',
      },
      {
        id: 'tu-3-2',
        taskId: 'task-3',
        userId: 'user-5',
        note: 'Repair complete. Cooling system fixed, brake pads replaced. Fitness certificate obtained.',
        progressPercentage: 100,
        createdAt: '2026-06-27T14:00:00.000Z',
      },
    ],
    acknowledgedAt: '2026-06-22T08:30:00.000Z',
    completedAt: '2026-06-27T14:00:00.000Z',
    createdAt: '2026-06-21T10:00:00.000Z',
    comments: [
      {
        id: 'c-3-1',
        userId: 'user-2',
        content: 'Well done. Vehicle cleared for deployment.',
        createdAt: '2026-06-27T15:00:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-4',
    title: 'Monthly waste-management report — June 2026',
    description:
      'Compile data from all range offices on waste generated, disposed, and segregated in June 2026. Include photographs of disposal sites. Prepare summary in MoEFCC format for submission.',
    assigneeId: 'user-4',
    createdById: 'user-2',
    rangeId: 'range-betla',
    status: 'InProgress',
    priority: 'Medium',
    category: 'Admin',
    dueDate: '2026-07-01',
    completionPercentage: 60,
    taskUpdates: [
      {
        id: 'tu-4-1',
        taskId: 'task-4',
        userId: 'user-4',
        note: 'Data collected from Betla and Buffer zones. Latehar data pending.',
        progressPercentage: 60,
        createdAt: '2026-06-28T09:00:00.000Z',
      },
    ],
    acknowledgedAt: '2026-06-24T08:00:00.000Z',
    createdAt: '2026-06-23T09:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-5',
    title: 'Cattle-grazing report near Mandal — URGENT',
    description:
      'Illegal cattle grazing reported inside core zone near Mandal. Ground inspection required. Identify entry points, document with GPS coordinates and photos. Issue notices and report to Range Officer.',
    assigneeId: 'user-7',
    createdById: 'user-1',
    rangeId: 'range-kechki',
    areaId: 'area-k2',
    status: 'NotStarted',
    priority: 'Critical',
    category: 'Patrol',
    dueDate: '2026-06-25',
    completionPercentage: 0,
    taskUpdates: [],
    createdAt: '2026-06-22T11:00:00.000Z',
    comments: [
      {
        id: 'c-5-1',
        userId: 'user-1',
        content: 'CRITICAL. Cattle grazing escalating. Act immediately and report back by EOD.',
        createdAt: '2026-06-22T11:30:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-6',
    title: 'Install camera trap at Grid B-7, Betla North',
    description:
      'Set up new camera trap at Grid B-7 in Betla North Core Zone. Select tree with clear game trail view. Configure settings (day/night, burst mode), record GPS, submit installation report.',
    assigneeId: 'user-4',
    createdById: 'user-2',
    rangeId: 'range-betla',
    areaId: 'area-b1',
    status: 'NotStarted',
    priority: 'High',
    category: 'Camera Trap',
    dueDate: '2026-07-10',
    completionPercentage: 0,
    taskUpdates: [],
    createdAt: '2026-06-26T08:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-7',
    title: 'Wildlife census — Latehar Northern Zone',
    description:
      'Comprehensive wildlife census in Latehar Northern Zone. Use block counting method. Coordinate range staff for simultaneous counts. Submit data sheets to Director within 3 days.',
    assigneeId: 'user-6',
    createdById: 'user-3',
    rangeId: 'range-latehar',
    areaId: 'area-l1',
    status: 'InProgress',
    priority: 'High',
    category: 'Survey',
    dueDate: '2026-07-15',
    completionPercentage: 25,
    taskUpdates: [
      {
        id: 'tu-7-1',
        taskId: 'task-7',
        userId: 'user-6',
        note: 'Zone A census completed. Tiger sightings: 2 adults, 1 cub. Moving to Zone B tomorrow.',
        progressPercentage: 25,
        createdAt: '2026-06-26T17:00:00.000Z',
      },
    ],
    acknowledgedAt: '2026-06-25T07:30:00.000Z',
    createdAt: '2026-06-24T08:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-8',
    title: 'Repair boundary fence — Southern Perimeter, Latehar',
    description:
      'Boundary fence damaged by elephants. Repair all damaged sections using approved materials. Mark repaired sections with geo-tagged photographs.',
    assigneeId: 'user-6',
    createdById: 'user-3',
    rangeId: 'range-latehar',
    areaId: 'area-l2',
    status: 'Archived',
    priority: 'Medium',
    category: 'Maintenance',
    dueDate: '2026-06-20',
    completionPercentage: 100,
    taskUpdates: [
      {
        id: 'tu-8-1',
        taskId: 'task-8',
        userId: 'user-6',
        note: 'All 6 damaged sections repaired. Photographs submitted.',
        progressPercentage: 100,
        createdAt: '2026-06-19T16:00:00.000Z',
      },
    ],
    acknowledgedAt: '2026-06-12T08:00:00.000Z',
    completedAt: '2026-06-19T16:00:00.000Z',
    archivedAt: '2026-06-20T10:00:00.000Z',
    createdAt: '2026-06-10T09:00:00.000Z',
    comments: [
      {
        id: 'c-8-1',
        userId: 'user-3',
        content: 'Excellent work. Archived. Keep monitoring during monsoon.',
        createdAt: '2026-06-20T10:00:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-9',
    title: 'Anti-poaching patrol report — June 2026',
    description:
      'Compile and file monthly anti-poaching patrol report for June 2026. Include patrol routes, suspicious activity logs, seizures, staff attendance. Submit to Director by 3rd July.',
    assigneeId: 'user-5',
    createdById: 'user-2',
    rangeId: 'range-betla',
    status: 'NotStarted',
    priority: 'Low',
    category: 'Admin',
    dueDate: '2026-07-03',
    completionPercentage: 0,
    taskUpdates: [],
    createdAt: '2026-06-26T09:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-10',
    title: 'Monsoon patrol routes — Kechki Range',
    description:
      'Redesign patrol routes for monsoon season considering flooded tracks and tiger movement near water bodies. Prepare route maps, brief staff, upload routes to patrol management app.',
    assigneeId: 'user-7',
    createdById: 'user-1',
    rangeId: 'range-kechki',
    status: 'Completed',
    priority: 'High',
    category: 'Patrol',
    dueDate: '2026-06-28',
    completionPercentage: 100,
    taskUpdates: [
      {
        id: 'tu-10-1',
        taskId: 'task-10',
        userId: 'user-7',
        note: 'Monsoon routes finalized. 4 new routes added in North zone. Staff briefing done.',
        progressPercentage: 100,
        createdAt: '2026-06-27T12:00:00.000Z',
      },
    ],
    acknowledgedAt: '2026-06-23T08:00:00.000Z',
    completedAt: '2026-06-27T12:00:00.000Z',
    createdAt: '2026-06-22T08:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-11',
    title: 'Water monitoring sensors — Koel River, Latehar',
    description:
      'Install three IoT water level sensors at designated points along Koel River in buffer zone. Calibrate sensors, set alerts, verify data transmission to central dashboard.',
    assigneeId: 'user-6',
    createdById: 'user-3',
    rangeId: 'range-latehar',
    areaId: 'area-l1',
    status: 'InProgress',
    priority: 'Critical',
    category: 'Survey',
    dueDate: '2026-06-24',
    completionPercentage: 65,
    taskUpdates: [
      {
        id: 'tu-11-1',
        taskId: 'task-11',
        userId: 'user-6',
        note: 'Sensors 1 & 2 deployed. Site 3 inaccessible due to early flooding. Will deploy by 28th June.',
        progressPercentage: 65,
        createdAt: '2026-06-25T11:00:00.000Z',
      },
    ],
    acknowledgedAt: '2026-06-21T07:00:00.000Z',
    createdAt: '2026-06-20T09:00:00.000Z',
    comments: [
      {
        id: 'c-11-1',
        userId: 'user-3',
        content: 'Overdue. Provide update — monsoon sensors must be operational.',
        createdAt: '2026-06-25T09:00:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-12',
    title: 'Annual vehicle inspection documentation',
    description:
      'Complete annual inspection docs for all 8 reserve vehicles. Coordinate with transport officer, collect fitness certificates, update log books, submit report to Director.',
    assigneeId: 'user-5',
    createdById: 'user-2',
    rangeId: 'range-betla',
    status: 'NotStarted',
    priority: 'Low',
    category: 'Admin',
    dueDate: '2026-07-20',
    completionPercentage: 0,
    taskUpdates: [],
    createdAt: '2026-06-27T08:00:00.000Z',
    comments: [],
    attachments: [],
  },
];

// ─── Credentials ──────────────────────────────────────────────────────────────

const CREDENTIALS: Record<string, string> = {
  'director@ptr.in': 'demo123',
  'officer@ptr.in': 'demo123',
  'officer.latehar@ptr.in': 'demo123',
  'guard@ptr.in': 'demo123',
  'manish@ptr.in': 'demo123',
  'iqbal@ptr.in': 'demo123',
  'vivek@ptr.in': 'demo123',
};

// ─── Store ────────────────────────────────────────────────────────────────────

const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // State
      currentUser: null,
      users: SEED_USERS,
      ranges: SEED_RANGES,
      areas: SEED_AREAS,
      tasks: SEED_TASKS,
      notifications: [],
      reports: [],

      // Auth
      login: (email, password) => {
        const expected = CREDENTIALS[email.toLowerCase().trim()];
        if (!expected || expected !== password) return null;
        const user = get().users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase().trim()
        );
        if (!user) return null;
        set({ currentUser: user });
        return user;
      },

      logout: () => set({ currentUser: null }),

      // Tasks
      createTask: (data) => {
        const task: Task = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          comments: [],
          attachments: [],
          taskUpdates: [],
        };
        set((state) => ({ tasks: [task, ...state.tasks] }));

        const assignee = get().users.find((u) => u.id === data.assigneeId);
        if (assignee) {
          get().addNotification({
            userId: assignee.id,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `You have been assigned: "${task.title}"`,
            taskId: task.id,
            read: false,
          });
        }
        return task;
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          notifications: state.notifications.filter((n) => n.taskId !== id),
        }));
      },

      addComment: (taskId, content, userId) => {
        const comment = {
          id: crypto.randomUUID(),
          userId,
          content,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t
          ),
        }));
      },

      addAttachment: (taskId, attachment: Attachment) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, attachments: [...t.attachments, attachment] }
              : t
          ),
        }));
      },

      removeAttachment: (taskId, attachmentId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, attachments: t.attachments.filter((a) => a.id !== attachmentId) }
              : t
          ),
        }));
      },

      // Diary / progress update
      addTaskUpdate: (taskId, note, progressPercentage, userId) => {
        const update: TaskUpdate = {
          id: crypto.randomUUID(),
          taskId,
          userId,
          note,
          progressPercentage,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  completionPercentage: progressPercentage,
                  taskUpdates: [...t.taskUpdates, update],
                }
              : t
          ),
        }));

        // Notify range officer / director about update
        const task = get().tasks.find((t) => t.id === taskId);
        if (task) {
          const rangeOfficers = get().users.filter(
            (u) => u.role === 'range_officer' && u.rangeId === task.rangeId
          );
          const directors = get().users.filter((u) => u.role === 'director');
          [...rangeOfficers, ...directors].forEach((u) => {
            get().addNotification({
              userId: u.id,
              type: 'task_updated',
              title: 'Task Progress Update',
              message: `${progressPercentage}% — "${task.title}"`,
              taskId,
              read: false,
            });
          });
        }
      },

      // Guard starts task (NotStarted → InProgress)
      startTask: (taskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: 'InProgress' as const, acknowledgedAt: new Date().toISOString() }
              : t
          ),
        }));
      },

      // Guard marks task complete (InProgress → Completed)
      completeTask: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'Completed' as const,
                  completionPercentage: 100,
                  completedAt: new Date().toISOString(),
                }
              : t
          ),
        }));
        if (task) {
          const rangeOfficers = get().users.filter(
            (u) => u.role === 'range_officer' && u.rangeId === task.rangeId
          );
          const directors = get().users.filter((u) => u.role === 'director');
          [...rangeOfficers, ...directors].forEach((u) => {
            get().addNotification({
              userId: u.id,
              type: 'task_completed',
              title: 'Task Completed',
              message: `"${task.title}" marked complete — awaiting review.`,
              taskId,
              read: false,
            });
          });
        }
      },

      // Officer/Director archives completed task
      archiveTask: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: 'Archived' as const, archivedAt: new Date().toISOString() }
              : t
          ),
        }));
        if (task) {
          get().addNotification({
            userId: task.assigneeId,
            type: 'task_archived',
            title: 'Task Archived',
            message: `Your task "${task.title}" has been reviewed and archived.`,
            taskId,
            read: false,
          });
        }
      },

      // Officer/Director sends task back (Completed → InProgress)
      requestChanges: (taskId, comment) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: 'InProgress' as const, completedAt: undefined }
              : t
          ),
        }));
        if (comment) {
          const { currentUser } = get();
          if (currentUser) {
            get().addComment(taskId, `[Changes Requested] ${comment}`, currentUser.id);
          }
        }
        const task = get().tasks.find((t) => t.id === taskId);
        if (task) {
          get().addNotification({
            userId: task.assigneeId,
            type: 'changes_requested',
            title: 'Changes Requested',
            message: `Changes requested for "${task.title}".`,
            taskId,
            read: false,
          });
        }
      },

      // User management (director only)
      createUser: (userData) => {
        const user: User = { ...userData, id: crypto.randomUUID() };
        set((state) => ({ users: [...state.users, user] }));
        return user;
      },

      updateUser: (id, updates) => {
        set((state) => ({
          users: state.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
        }));
      },

      deleteUser: (id) => {
        set((state) => ({
          users: state.users.filter((u) => u.id !== id),
        }));
      },

      // Daily report generation
      generateDailyReport: () => {
        const { tasks, ranges, currentUser } = get();
        const now = new Date();
        const todayStr = now.toISOString().substring(0, 10);

        const rangeBreakdown = ranges.map((range) => {
          const rangeTasks = tasks.filter((t) => t.rangeId === range.id);
          return {
            rangeId: range.id,
            rangeName: range.name,
            total: rangeTasks.length,
            completed: rangeTasks.filter(
              (t) => t.status === 'Completed' || t.status === 'Archived'
            ).length,
            overdue: rangeTasks.filter(isOverdue).length,
          };
        });

        const report: DailyReport = {
          id: crypto.randomUUID(),
          reportDate: todayStr,
          generatedBy: currentUser?.id ?? 'system',
          totalTasks: tasks.length,
          completedCount: tasks.filter(
            (t) => t.status === 'Completed' || t.status === 'Archived'
          ).length,
          inProgressCount: tasks.filter((t) => t.status === 'InProgress').length,
          notStartedCount: tasks.filter((t) => t.status === 'NotStarted').length,
          overdueCount: tasks.filter(isOverdue).length,
          rangeBreakdown,
          createdAt: now.toISOString(),
        };

        set((state) => ({ reports: [report, ...state.reports] }));
        return report;
      },

      // Notifications
      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      markAllNotificationsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      addNotification: (notification) => {
        const newNotif: Notification = {
          ...notification,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          notifications: [newNotif, ...state.notifications],
        }));
      },
    }),
    {
      name: 'ptr-store-v2',
      partialize: (state) => ({
        currentUser: state.currentUser,
        users: state.users,
        ranges: state.ranges,
        areas: state.areas,
        tasks: state.tasks.map((task) => ({
          ...task,
          attachments: task.attachments.map(({ previewUrl: _ignored, ...rest }) => rest),
        })),
        notifications: state.notifications,
        reports: state.reports,
      }),
    }
  )
);

export default useStore;

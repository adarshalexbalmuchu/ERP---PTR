import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Store, User, Task, Notification, Attachment } from '../types';

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_USERS: User[] = [
  {
    id: 'user-1',
    name: 'Prajesh Kant Jena',
    role: 'admin',
    email: 'admin@ptr.in',
    avatarInitials: 'PJ',
    designation: 'IFS — Deputy Director',
  },
  {
    id: 'user-2',
    name: 'Abhay Kumar',
    role: 'staff',
    email: 'staff@ptr.in',
    avatarInitials: 'AK',
    designation: 'Forest Guard',
  },
  {
    id: 'user-3',
    name: 'Iqbal Ahmed',
    role: 'staff',
    email: 'iqbal@ptr.in',
    avatarInitials: 'IA',
    designation: 'Range Officer',
  },
  {
    id: 'user-4',
    name: 'Manish Oraon',
    role: 'staff',
    email: 'manish@ptr.in',
    avatarInitials: 'MO',
    designation: 'Forest Guard',
  },
  {
    id: 'user-5',
    name: 'Vivek Singh',
    role: 'staff',
    email: 'vivek@ptr.in',
    avatarInitials: 'VS',
    designation: 'Anti-Poaching Watcher',
  },
];

const SEED_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Retrieve camera-trap SD cards from Betla Range',
    description:
      'Collect all SD cards installed at camera-trap stations in Betla Range. Download footage to the central server, label each card with date/location, and replace them in the field before sunset.',
    assigneeId: 'user-3', // Iqbal Ahmed
    createdById: 'user-1',
    status: 'InProgress',
    priority: 'MEDIUM',
    category: 'Camera Trap',
    dueDate: '2026-07-05',
    acknowledgedAt: '2026-06-20T09:00:00.000Z',
    createdAt: '2026-06-18T08:00:00.000Z',
    comments: [
      {
        id: 'c-1-1',
        userId: 'user-1',
        content:
          'Please make sure to label cards by grid reference, not just date. Refer to the camera-trap SOP document.',
        createdAt: '2026-06-18T09:30:00.000Z',
      },
      {
        id: 'c-1-2',
        userId: 'user-3',
        content:
          'Understood, sir. Will follow the SOP and submit the footage log by EOD on 5th July.',
        createdAt: '2026-06-20T10:00:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-2',
    title: 'Sign survey — Compartment 4, Kechki',
    description:
      'Conduct a wildlife sign survey in Forest Compartment 4 near Kechki village. Document pugmarks, scat, and any direct sightings. Fill the standard survey form and submit photographs as evidence.',
    assigneeId: 'user-2', // Abhay Kumar
    createdById: 'user-1',
    status: 'Unread',
    priority: 'HIGH',
    category: 'Survey',
    dueDate: '2026-07-02',
    createdAt: '2026-06-25T07:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-3',
    title: 'Repair patrol vehicle JH-12-PA-3456 before weekend',
    description:
      'Vehicle JH-12-PA-3456 has been reported with a faulty cooling system and worn brake pads. Coordinate with the divisional workshop for immediate repair. Obtain a fitness certificate before the vehicle is deployed for weekend patrol.',
    assigneeId: 'user-4', // Manish Oraon
    createdById: 'user-1',
    status: 'Done',
    priority: 'HIGH',
    category: 'Maintenance',
    dueDate: '2026-06-29',
    completedAt: '2026-06-27T14:00:00.000Z',
    acknowledgedAt: '2026-06-22T08:30:00.000Z',
    createdAt: '2026-06-21T10:00:00.000Z',
    comments: [
      {
        id: 'c-3-1',
        userId: 'user-4',
        content:
          'Repair completed. Cooling system fixed and brake pads replaced. Fitness certificate obtained from workshop. Vehicle ready for deployment.',
        createdAt: '2026-06-27T14:00:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-4',
    title: 'Submit monthly waste-management report',
    description:
      'Compile data from all range offices on waste generated, disposed, and segregated in June 2026. Include photographs of waste disposal sites and prepare the summary in the prescribed MoEFCC format for submission.',
    assigneeId: 'user-2', // Abhay Kumar
    createdById: 'user-1',
    status: 'InProgress',
    priority: 'MEDIUM',
    category: 'Admin',
    dueDate: '2026-07-01',
    acknowledgedAt: '2026-06-24T08:00:00.000Z',
    createdAt: '2026-06-23T09:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-5',
    title: 'Investigate cattle-grazing report near Mandal',
    description:
      'Residents near Mandal have reported illegal cattle grazing inside the core zone boundary. Conduct a ground inspection, identify the entry points, document with GPS coordinates and photographs. Issue notices if required and report findings to the Range Officer.',
    assigneeId: 'user-5', // Vivek Singh
    createdById: 'user-1',
    status: 'Unread',
    priority: 'CRITICAL',
    category: 'Patrol',
    dueDate: '2026-06-25',
    createdAt: '2026-06-22T11:00:00.000Z',
    comments: [
      {
        id: 'c-5-1',
        userId: 'user-1',
        content:
          'This is CRITICAL. The cattle grazing has been escalating. Act immediately and report back by EOD today.',
        createdAt: '2026-06-22T11:30:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-6',
    title: 'Install new camera trap at Grid B-7, Betla',
    description:
      'Set up a new camera trap unit at Grid Reference B-7 in the Betla core zone. Select a suitable tree with a clear game trail view. Configure trap settings (day/night, burst mode), record GPS coordinates, and submit installation report.',
    assigneeId: 'user-3', // Iqbal Ahmed
    createdById: 'user-1',
    status: 'Unread',
    priority: 'HIGH',
    category: 'Camera Trap',
    dueDate: '2026-07-10',
    createdAt: '2026-06-26T08:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-7',
    title: 'Conduct wildlife census in Northern Zone',
    description:
      'Carry out a comprehensive wildlife census in the Northern Zone covering all major animal species. Use block counting method. Coordinate with range staff for simultaneous counts. Submit data sheets to the Director\'s office within 3 days of census.',
    assigneeId: 'user-2', // Abhay Kumar
    createdById: 'user-1',
    status: 'InProgress',
    priority: 'HIGH',
    category: 'Survey',
    dueDate: '2026-07-15',
    acknowledgedAt: '2026-06-25T07:30:00.000Z',
    createdAt: '2026-06-24T08:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-8',
    title: 'Repair boundary fence at southern perimeter',
    description:
      'Multiple sections of the boundary fence at the southern perimeter have been damaged by elephants. Repair all damaged sections using approved materials. Mark repaired sections with geo-tagged photographs.',
    assigneeId: 'user-4', // Manish Oraon
    createdById: 'user-1',
    status: 'Approved',
    priority: 'MEDIUM',
    category: 'Maintenance',
    dueDate: '2026-06-20',
    acknowledgedAt: '2026-06-12T08:00:00.000Z',
    completedAt: '2026-06-19T16:00:00.000Z',
    createdAt: '2026-06-10T09:00:00.000Z',
    comments: [
      {
        id: 'c-8-1',
        userId: 'user-4',
        content: 'All 6 damaged sections have been repaired. Photographs submitted.',
        createdAt: '2026-06-19T16:00:00.000Z',
      },
      {
        id: 'c-8-2',
        userId: 'user-1',
        content: 'Good work. Task approved. Keep monitoring this perimeter during monsoon.',
        createdAt: '2026-06-20T10:00:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-9',
    title: 'File anti-poaching patrol report for June',
    description:
      'Compile and file the monthly anti-poaching patrol report for June 2026. Include all patrol routes covered, suspicious activity logs, seizures (if any), and staff attendance. Submit to the Deputy Director by 3rd July.',
    assigneeId: 'user-5', // Vivek Singh
    createdById: 'user-1',
    status: 'Unread',
    priority: 'LOW',
    category: 'Admin',
    dueDate: '2026-07-03',
    createdAt: '2026-06-26T09:00:00.000Z',
    comments: [],
    attachments: [],
  },
  {
    id: 'task-10',
    title: 'Set up new patrol routes for monsoon season',
    description:
      'Redesign patrol routes for the monsoon season considering flooded forest tracks and increased tiger movement near water bodies. Prepare route maps, brief all field staff, and upload updated routes to the patrol management app.',
    assigneeId: 'user-2', // Abhay Kumar
    createdById: 'user-1',
    status: 'Done',
    priority: 'HIGH',
    category: 'Patrol',
    dueDate: '2026-06-28',
    acknowledgedAt: '2026-06-23T08:00:00.000Z',
    completedAt: '2026-06-27T12:00:00.000Z',
    createdAt: '2026-06-22T08:00:00.000Z',
    comments: [
      {
        id: 'c-10-1',
        userId: 'user-2',
        content:
          'Monsoon patrol routes have been finalized. 4 new routes added in the North zone. Staff briefing done on 26th June.',
        createdAt: '2026-06-27T12:00:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-11',
    title: 'Deploy water monitoring sensors at Koel River',
    description:
      'Install three IoT water level monitoring sensors at designated points along the Koel River within PTR buffer zone. Calibrate sensors, set up alerts, and verify data transmission to the central dashboard.',
    assigneeId: 'user-3', // Iqbal Ahmed
    createdById: 'user-1',
    status: 'InProgress',
    priority: 'CRITICAL',
    category: 'Survey',
    dueDate: '2026-06-24',
    acknowledgedAt: '2026-06-21T07:00:00.000Z',
    createdAt: '2026-06-20T09:00:00.000Z',
    comments: [
      {
        id: 'c-11-1',
        userId: 'user-1',
        content:
          'This is overdue. Please provide an update immediately. The monsoon season is approaching and we need these sensors operational.',
        createdAt: '2026-06-25T09:00:00.000Z',
      },
      {
        id: 'c-11-2',
        userId: 'user-3',
        content:
          'Two sensors deployed. Third location is inaccessible due to early flooding. Will deploy by 28th June when water recedes.',
        createdAt: '2026-06-25T11:00:00.000Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'task-12',
    title: 'Annual vehicle inspection documentation',
    description:
      'Complete annual vehicle inspection documentation for all 8 reserve vehicles. Coordinate with the transport officer for physical inspections, collect fitness certificates, update vehicle log books, and submit consolidated report to the Director\'s office.',
    assigneeId: 'user-4', // Manish Oraon
    createdById: 'user-1',
    status: 'Unread',
    priority: 'LOW',
    category: 'Admin',
    dueDate: '2026-07-20',
    createdAt: '2026-06-27T08:00:00.000Z',
    comments: [],
    attachments: [],
  },
];

// Credentials map (email → password)
const CREDENTIALS: Record<string, string> = {
  'admin@ptr.in': 'demo123',
  'staff@ptr.in': 'demo123',
};

// ─── Store ────────────────────────────────────────────────────────────────────

const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // State
      currentUser: null,
      users: SEED_USERS,
      tasks: SEED_TASKS,
      notifications: [],

      // Auth
      login: (email: string, password: string) => {
        const expectedPassword = CREDENTIALS[email.toLowerCase().trim()];
        if (!expectedPassword || expectedPassword !== password) return null;
        const user = get().users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase().trim()
        );
        if (!user) return null;
        set({ currentUser: user });
        return user;
      },

      logout: () => {
        set({ currentUser: null });
      },

      // Tasks
      createTask: (data) => {
        const task: Task = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          comments: [],
          attachments: [],
        };
        set((state) => ({ tasks: [task, ...state.tasks] }));

        // Notify assignee
        const assignee = get().users.find((u) => u.id === data.assigneeId);
        if (assignee) {
          get().addNotification({
            userId: assignee.id,
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
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
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
            t.id === taskId
              ? { ...t, comments: [...t.comments, comment] }
              : t
          ),
        }));
      },

      addAttachment: (taskId: string, attachment: Attachment) => {
        // Store attachment metadata but strip previewUrl before persisting
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, attachments: [...t.attachments, attachment] }
              : t
          ),
        }));
      },

      removeAttachment: (taskId: string, attachmentId: string) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  attachments: t.attachments.filter((a) => a.id !== attachmentId),
                }
              : t
          ),
        }));
      },

      acknowledgeTask: (taskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'InProgress' as const,
                  acknowledgedAt: new Date().toISOString(),
                }
              : t
          ),
        }));
      },

      completeTask: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'Done' as const,
                  completedAt: new Date().toISOString(),
                }
              : t
          ),
        }));

        // Notify admin
        const admins = get().users.filter((u) => u.role === 'admin');
        admins.forEach((admin) => {
          get().addNotification({
            userId: admin.id,
            title: 'Task Ready for Approval',
            message: `"${task?.title}" has been marked as Done and is awaiting your approval.`,
            taskId: taskId,
            read: false,
          });
        });
      },

      approveTask: (taskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'Approved' as const } : t
          ),
        }));

        // Notify assignee
        const task = get().tasks.find((t) => t.id === taskId);
        if (task) {
          get().addNotification({
            userId: task.assigneeId,
            title: 'Task Approved',
            message: `Your task "${task.title}" has been approved.`,
            taskId: taskId,
            read: false,
          });
        }
      },

      requestChanges: (taskId, comment) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'InProgress' as const } : t
          ),
        }));

        if (comment) {
          const { currentUser } = get();
          if (currentUser) {
            get().addComment(taskId, `[Changes Requested] ${comment}`, currentUser.id);
          }
        }

        // Notify assignee
        const task = get().tasks.find((t) => t.id === taskId);
        if (task) {
          get().addNotification({
            userId: task.assigneeId,
            title: 'Changes Requested',
            message: `Changes have been requested for your task "${task.title}".`,
            taskId: taskId,
            read: false,
          });
        }
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
        const newNotification: Notification = {
          ...notification,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          notifications: [newNotification, ...state.notifications],
        }));
      },
    }),
    {
      name: 'ptr-store',
      // Exclude previewUrls from persistence (object URLs don't survive page reloads)
      partialize: (state) => ({
        currentUser: state.currentUser,
        users: state.users,
        tasks: state.tasks.map((task) => ({
          ...task,
          attachments: task.attachments.map(({ previewUrl: _ignored, ...rest }) => rest),
        })),
        notifications: state.notifications,
      }),
    }
  )
);

export default useStore;

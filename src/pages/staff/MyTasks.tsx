import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { isOverdue } from '../../utils/overdue';
import TaskCard from '../../components/TaskCard';
import EmptyState from '../../components/EmptyState';
import type { TaskStatus } from '../../types';

const STATUS_TABS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Unread', label: 'Unread' },
  { value: 'InProgress', label: 'In Progress' },
  { value: 'Done', label: 'Done' },
  { value: 'Approved', label: 'Approved' },
];

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export default function StaffMyTasks() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);

  const [activeTab, setActiveTab] = useState<TaskStatus | 'all'>('all');

  const myTasks = tasks
    .filter((t) => t.assigneeId === currentUser?.id)
    .filter((t) => activeTab === 'all' || t.status === activeTab)
    .sort((a, b) => {
      // Overdue first
      const aOver = isOverdue(a) ? 0 : 1;
      const bOver = isOverdue(b) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      // Then by priority
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pDiff !== 0) return pDiff;
      // Then by due date
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const allMyTasks = tasks.filter((t) => t.assigneeId === currentUser?.id);
  const unreadCount = allMyTasks.filter((t) => t.status === 'Unread').length;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-ptr-brown">My Tasks</h1>
        <p className="text-sm text-ptr-brown-light">
          {currentUser?.name} · {currentUser?.designation}
        </p>
      </div>

      {/* Unread alert */}
      {unreadCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
          <span className="text-sm text-amber-800 font-medium">
            {unreadCount} new task{unreadCount > 1 ? 's' : ''} need{unreadCount === 1 ? 's' : ''} your acknowledgement
          </span>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.value === 'all'
              ? allMyTasks.length
              : allMyTasks.filter((t) => t.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-ptr-green text-white'
                  : 'bg-white border border-ptr-cream-dark text-ptr-brown-light hover:bg-ptr-cream'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.value ? 'bg-white/20' : 'bg-ptr-cream'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task list */}
      {myTasks.length === 0 ? (
        <EmptyState
          title={activeTab === 'all' ? 'No tasks assigned' : `No ${activeTab === 'InProgress' ? 'in progress' : activeTab.toLowerCase()} tasks`}
          description={
            activeTab === 'all'
              ? 'You have no assigned tasks right now.'
              : 'Switch tabs to see other tasks.'
          }
        />
      ) : (
        <div className="space-y-3">
          {myTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              users={users}
              showAssignee={false}
              onClick={() => navigate(`/staff/tasks/${task.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

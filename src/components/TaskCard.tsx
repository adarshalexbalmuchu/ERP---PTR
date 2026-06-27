import { Calendar } from 'lucide-react';
import type { Task, User } from '../types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { isOverdue } from '../utils/overdue';
import { formatDate } from '../utils/formatters';

interface Props {
  task: Task;
  users: User[];
  showAssignee?: boolean;
  onClick: () => void;
}

export default function TaskCard({ task, users, showAssignee = false, onClick }: Props) {
  const overdue = isOverdue(task);
  const assignee = users.find((u) => u.id === task.assigneeId);

  return (
    <div
      onClick={onClick}
      className={`card p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 ${
        task.status === 'Unread' ? 'border-l-4 border-l-amber-400' : ''
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {task.status === 'Unread' && (
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            )}
            <h3 className="text-sm font-semibold text-ptr-brown line-clamp-2 leading-snug">
              {task.title}
            </h3>
          </div>
          {showAssignee && assignee && (
            <p className="text-xs text-ptr-brown-light">{assignee.name}</p>
          )}
        </div>
        <PriorityBadge priority={task.priority} size="sm" />
      </div>
      <div className="flex items-center flex-wrap gap-2">
        <StatusBadge status={task.status} size="sm" />
        <span className="text-xs bg-ptr-cream text-ptr-brown-light px-2 py-0.5 rounded-full border border-ptr-cream-dark">
          {task.category}
        </span>
        <span
          className={`text-xs ml-auto flex items-center gap-1 ${
            overdue ? 'text-red-600 font-medium' : 'text-ptr-brown-light'
          }`}
        >
          <Calendar className="w-3 h-3" />
          {overdue ? 'Overdue · ' : ''}
          {formatDate(task.dueDate)}
        </span>
      </div>
    </div>
  );
}

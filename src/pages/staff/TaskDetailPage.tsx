import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, PlayCircle, Clock, Award, Calendar, User, Tag } from 'lucide-react';
import useStore from '../../store/useStore';
import { isOverdue } from '../../utils/overdue';
import { formatDate, formatDateTime } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import CommentThread from '../../components/CommentThread';
import AttachmentList from '../../components/AttachmentList';
import type { Attachment } from '../../types';

export default function StaffTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const currentUser = useStore((s) => s.currentUser);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const addComment = useStore((s) => s.addComment);
  const addAttachment = useStore((s) => s.addAttachment);
  const removeAttachment = useStore((s) => s.removeAttachment);
  const acknowledgeTask = useStore((s) => s.acknowledgeTask);
  const completeTask = useStore((s) => s.completeTask);

  const task = tasks.find((t) => t.id === id);

  if (!task || task.assigneeId !== currentUser?.id) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 text-center">
        <p className="text-ptr-brown font-medium mb-2">Task not found</p>
        <button onClick={() => navigate('/staff')} className="btn-secondary text-sm">
          ← Back to My Tasks
        </button>
      </div>
    );
  }

  const assignee = users.find((u) => u.id === task.assigneeId);
  const overdue = isOverdue(task);

  const handleUpload = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const attachment: Attachment = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      };
      addAttachment(task.id, attachment);
    });
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/staff')}
        className="flex items-center gap-2 text-sm text-ptr-brown-light hover:text-ptr-brown transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        My Tasks
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center flex-wrap gap-2 mb-2">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {overdue && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-200">
              Overdue
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-ptr-brown leading-snug">{task.title}</h1>
      </div>

      {/* Key action banner — prominent, mobile-first */}
      {task.status === 'Unread' && (
        <div className="card p-5 border-l-4 border-l-amber-400">
          <div className="flex items-start gap-3 mb-4">
            <span className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0 mt-1 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-ptr-brown">New Task — Action Required</p>
              <p className="text-xs text-ptr-brown-light mt-1">
                Acknowledge this task to confirm receipt and begin work.
              </p>
            </div>
          </div>
          <button
            onClick={() => acknowledgeTask(task.id)}
            className="w-full btn-primary justify-center text-base py-3"
          >
            <PlayCircle className="w-5 h-5" />
            Acknowledge &amp; Start
          </button>
        </div>
      )}

      {task.status === 'InProgress' && (
        <div className="card p-5 border-l-4 border-l-amber-400">
          <div className="flex items-start gap-3 mb-4">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-ptr-brown">In Progress</p>
              <p className="text-xs text-ptr-brown-light mt-1">
                Once you have completed this task, mark it as done for the officer to review.
              </p>
            </div>
          </div>
          <button
            onClick={() => completeTask(task.id)}
            className="w-full btn-primary justify-center text-base py-3"
          >
            <CheckCircle className="w-5 h-5" />
            Mark as Done
          </button>
        </div>
      )}

      {task.status === 'Done' && (
        <div className="card p-4 border-l-4 border-l-blue-400 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-700">Submitted for Approval</p>
            <p className="text-xs text-blue-600/70">
              Awaiting review by the officer.
            </p>
          </div>
        </div>
      )}

      {task.status === 'Approved' && (
        <div className="card p-4 border-l-4 border-l-emerald-400 flex items-center gap-3">
          <Award className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-700">Approved ✓</p>
            <p className="text-xs text-emerald-600/70">
              This task has been reviewed and approved.
            </p>
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="card p-4 grid grid-cols-2 gap-3">
        <MetaItem icon={<User className="w-4 h-4" />} label="Assigned to" value={assignee?.name ?? '—'} />
        <MetaItem
          icon={<Calendar className="w-4 h-4" />}
          label="Due Date"
          value={formatDate(task.dueDate)}
          valueClass={overdue ? 'text-red-600 font-medium' : undefined}
        />
        <MetaItem icon={<Tag className="w-4 h-4" />} label="Category" value={task.category} />
        {task.acknowledgedAt && (
          <MetaItem label="Acknowledged" value={formatDateTime(task.acknowledgedAt)} />
        )}
        {task.completedAt && (
          <MetaItem label="Completed" value={formatDateTime(task.completedAt)} />
        )}
      </div>

      {/* Description */}
      {task.description && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ptr-brown mb-3">Description</h3>
          <p className="text-sm text-ptr-brown leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        </div>
      )}

      {/* Attachments */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ptr-brown mb-3">
          Attachments ({task.attachments.length})
        </h3>
        <AttachmentList
          attachments={task.attachments}
          canUpload
          canRemove
          onUpload={handleUpload}
          onRemove={(attId) => removeAttachment(task.id, attId)}
        />
      </div>

      {/* Comments */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ptr-brown mb-4">
          Comments ({task.comments.length})
        </h3>
        {currentUser && (
          <CommentThread
            comments={task.comments}
            users={users}
            currentUser={currentUser}
            onAddComment={(content) => addComment(task.id, content, currentUser.id)}
          />
        )}
      </div>
    </div>
  );
}

function MetaItem({
  icon,
  label,
  value,
  valueClass,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-ptr-brown-light mt-0.5 flex-shrink-0">{icon}</span>}
      <div>
        <div className="text-xs text-ptr-brown-light font-medium">{label}</div>
        <div className={`text-sm font-medium text-ptr-brown mt-0.5 ${valueClass ?? ''}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

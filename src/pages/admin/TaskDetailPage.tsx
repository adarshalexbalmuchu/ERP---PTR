import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, CheckCircle, RotateCcw, Calendar, User, Tag } from 'lucide-react';
import useStore from '../../store/useStore';
import { isOverdue } from '../../utils/overdue';
import { formatDate, formatDateTime } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import CommentThread from '../../components/CommentThread';
import AttachmentList from '../../components/AttachmentList';
import TaskForm from '../../components/TaskForm';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { Attachment } from '../../types';

export default function AdminTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const currentUser = useStore((s) => s.currentUser);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const addComment = useStore((s) => s.addComment);
  const addAttachment = useStore((s) => s.addAttachment);
  const removeAttachment = useStore((s) => s.removeAttachment);
  const approveTask = useStore((s) => s.approveTask);
  const requestChanges = useStore((s) => s.requestChanges);

  const staffUsers = users.filter((u) => u.role === 'staff');

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [requestChangesNote, setRequestChangesNote] = useState('');

  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 text-center">
        <p className="text-ptr-brown font-medium mb-2">Task not found</p>
        <button onClick={() => navigate('/admin')} className="btn-secondary text-sm">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const assignee = users.find((u) => u.id === task.assigneeId);
  const overdue = isOverdue(task);

  const handleApprove = () => {
    approveTask(task.id);
  };

  const handleRequestChanges = () => {
    requestChanges(task.id, requestChangesNote.trim() || undefined);
    setShowRequestChanges(false);
    setRequestChangesNote('');
  };

  const handleDelete = () => {
    deleteTask(task.id);
    navigate('/admin');
  };

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
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Back + title */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-ptr-cream-dark transition-colors flex-shrink-0 mt-0.5"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-ptr-brown" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-ptr-brown leading-snug">{task.title}</h1>
          <div className="flex items-center flex-wrap gap-2 mt-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {overdue && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-200">
                Overdue
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setEditOpen(true)}
            className="p-2 rounded-xl hover:bg-ptr-cream transition-colors"
            title="Edit task"
          >
            <Edit2 className="w-4 h-4 text-ptr-brown-light" />
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="p-2 rounded-xl hover:bg-red-50 transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Meta info */}
      <div className="card p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetaItem icon={<User className="w-4 h-4" />} label="Assignee" value={assignee?.name ?? '—'} />
        <MetaItem
          icon={<Calendar className="w-4 h-4" />}
          label="Due Date"
          value={formatDate(task.dueDate)}
          valueClass={overdue ? 'text-red-600 font-medium' : undefined}
        />
        <MetaItem icon={<Tag className="w-4 h-4" />} label="Category" value={task.category} />
        <MetaItem
          icon={<Calendar className="w-4 h-4" />}
          label="Created"
          value={formatDate(task.createdAt)}
        />
        {task.acknowledgedAt && (
          <MetaItem label="Acknowledged" value={formatDateTime(task.acknowledgedAt)} />
        )}
        {task.completedAt && (
          <MetaItem label="Completed" value={formatDateTime(task.completedAt)} />
        )}
      </div>

      {/* Admin actions for Done tasks */}
      {task.status === 'Done' && (
        <div className="card p-5 border-l-4 border-l-blue-400">
          <h3 className="text-sm font-semibold text-ptr-brown mb-3">
            This task is awaiting your review
          </h3>
          {showRequestChanges ? (
            <div className="space-y-3">
              <textarea
                value={requestChangesNote}
                onChange={(e) => setRequestChangesNote(e.target.value)}
                placeholder="Optional: describe what needs to change…"
                rows={3}
                className="input-field resize-none text-sm"
              />
              <div className="flex gap-2">
                <button onClick={handleRequestChanges} className="btn-primary text-sm py-2 px-4">
                  <RotateCcw className="w-4 h-4" />
                  Send Back
                </button>
                <button
                  onClick={() => {
                    setShowRequestChanges(false);
                    setRequestChangesNote('');
                  }}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button onClick={handleApprove} className="btn-primary">
                <CheckCircle className="w-4 h-4" />
                Approve Task
              </button>
              <button
                onClick={() => setShowRequestChanges(true)}
                className="btn-secondary"
              >
                <RotateCcw className="w-4 h-4" />
                Request Changes
              </button>
            </div>
          )}
        </div>
      )}

      {task.status === 'Approved' && (
        <div className="card p-4 border-l-4 border-l-emerald-400 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="text-sm font-medium text-emerald-700">Task approved</span>
        </div>
      )}

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

      {editOpen && currentUser && (
        <TaskForm
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={(data) => { updateTask(task.id, data); setEditOpen(false); }}
          staffUsers={staffUsers}
          initialData={task}
          currentUserId={currentUser.id}
        />
      )}

      <ConfirmDialog
        isOpen={deleteOpen}
        title="Delete Task"
        message={`Delete "${task.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
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

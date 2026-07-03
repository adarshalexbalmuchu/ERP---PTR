import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  CheckCircle,
  RotateCcw,
  Archive,
  Calendar,
  User,
  Tag,
  MapPin,
  TrendingUp,
  Plus,
  Send,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useTask } from '../../hooks/useTask';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { isOverdue } from '../../utils/overdue';
import { formatDate, formatDateTime } from '../../utils/formatters';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import CommentThread from '../../components/CommentThread';
import AttachmentList from '../../components/AttachmentList';
import TaskForm from '../../components/TaskForm';
import ConfirmDialog from '../../components/ConfirmDialog';

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ptr-brown-light">Progress</span>
        <span className="text-xs font-bold text-ptr-brown">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-ptr-brown/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-ptr-green transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
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
        <div className={`text-sm font-medium text-ptr-brown mt-0.5 ${valueClass ?? ''}`}>{value}</div>
      </div>
    </div>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const currentUser = useStore((s) => s.currentUser);
  const {
    task,
    isLoading,
    updateTask,
    deleteTask,
    startTask,
    completeTask,
    archiveTask,
    requestChanges,
    addComment,
    addTaskUpdate,
    uploadAttachment,
    removeAttachment,
  } = useTask(id);
  const { users } = useUsers();
  const { ranges, areas } = useRanges();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [requestChangesNote, setRequestChangesNote] = useState('');
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateNote, setUpdateNote] = useState('');
  const [updatePct, setUpdatePct] = useState(0);

  const role = currentUser?.role;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <span className="text-ptr-brown-light text-sm">Loading task…</span>
      </div>
    );
  }

  if (!task) {
    const back = role === 'director' ? '/director' : role === 'range_officer' ? '/officer' : '/guard';
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 text-center">
        <p className="text-ptr-brown font-medium mb-2">Task not found</p>
        <button onClick={() => navigate(back)} className="btn-secondary text-sm">← Back</button>
      </div>
    );
  }

  const assignee = users.find((u) => u.id === task.assigneeId);
  const coAssignees = task.coAssigneeIds.map((id) => users.find((u) => u.id === id)).filter((u): u is (typeof users)[number] => !!u);
  const range = ranges.find((r) => r.id === task.rangeId);
  const area = areas.find((a) => a.id === task.areaId);
  const overdue = isOverdue(task);
  const isAssignee = currentUser?.id === task.assigneeId || task.coAssigneeIds.includes(currentUser?.id ?? '');
  const canManage = role === 'director' || role === 'range_officer';

  const assignableUsers = users.filter((u) => u.role === 'guard');

  const backPath =
    role === 'director'
      ? '/director/tasks'
      : role === 'range_officer'
      ? '/officer/tasks'
      : '/guard';

  const handleDelete = () => {
    deleteTask.mutate(undefined, {
      onSuccess: () => navigate(backPath),
    });
  };

  const handleUpload = (files: FileList) => {
    Array.from(files).forEach((file) => {
      uploadAttachment.mutate(file);
    });
  };

  const handleAddUpdate = () => {
    if (!updateNote.trim()) return;
    addTaskUpdate.mutate({ note: updateNote.trim(), progressPercentage: updatePct });
    setUpdateNote('');
    setUpdatePct(task.completionPercentage);
    setShowUpdateForm(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
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
        {canManage && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setEditOpen(true)} className="p-2 rounded-xl hover:bg-ptr-cream transition-colors" title="Edit">
              <Edit2 className="w-4 h-4 text-ptr-brown-light" />
            </button>
            <button onClick={() => setDeleteOpen(true)} className="p-2 rounded-xl hover:bg-red-50 transition-colors" title="Delete">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="card p-5">
        <ProgressBar value={task.completionPercentage} />
      </div>

      {/* Meta */}
      <div className="card p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetaItem
          icon={<User className="w-4 h-4" />}
          label={coAssignees.length > 0 ? 'Assignees' : 'Assignee'}
          value={[assignee?.name ?? '—', ...coAssignees.map((u) => u.name)].join(', ')}
        />
        <MetaItem
          icon={<Calendar className="w-4 h-4" />}
          label="Due Date"
          value={formatDate(task.dueDate)}
          valueClass={overdue ? 'text-red-600 font-medium' : undefined}
        />
        <MetaItem icon={<MapPin className="w-4 h-4" />} label="Range" value={range?.name ?? '—'} />
        <MetaItem icon={<Tag className="w-4 h-4" />} label="Category" value={task.category} />
        {area && <MetaItem label="Area / Zone" value={area.name} />}
        {task.acknowledgedAt && (
          <MetaItem label="Started" value={formatDateTime(task.acknowledgedAt)} />
        )}
        {task.completedAt && (
          <MetaItem label="Completed" value={formatDateTime(task.completedAt)} />
        )}
      </div>

      {/* Guard actions */}
      {isAssignee && role === 'guard' && (
        <div className="card p-5 border-l-4 border-l-amber-400 space-y-3">
          {task.status === 'NotStarted' && (
            <div>
              <p className="text-sm text-ptr-brown mb-3">Acknowledge this task to begin work.</p>
              <button onClick={() => startTask.mutate()} className="btn-primary">
                <CheckCircle className="w-4 h-4" />
                Acknowledge & Start
              </button>
            </div>
          )}
          {task.status === 'InProgress' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setShowUpdateForm((v) => !v); setUpdatePct(task.completionPercentage); }} className="btn-secondary text-sm">
                  <TrendingUp className="w-4 h-4" />
                  Add Progress Update
                </button>
                <button onClick={() => completeTask.mutate()} className="btn-primary text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Mark as Done
                </button>
              </div>
              {showUpdateForm && (
                <div className="bg-ptr-cream rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-ptr-brown mb-1">Progress %</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={updatePct}
                        onChange={(e) => setUpdatePct(Number(e.target.value))}
                        className="flex-1 accent-ptr-green"
                      />
                      <span className="text-sm font-bold text-ptr-brown w-10 text-right">{updatePct}%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ptr-brown mb-1">Field Note</label>
                    <textarea
                      value={updateNote}
                      onChange={(e) => setUpdateNote(e.target.value)}
                      placeholder="Describe what was done..."
                      rows={2}
                      maxLength={2000}
                      className="input-field resize-none text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddUpdate} disabled={!updateNote.trim()} className="btn-primary text-sm py-2 px-4">
                      <Send className="w-3 h-3" />
                      Submit Update
                    </button>
                    <button onClick={() => setShowUpdateForm(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {(task.status === 'Completed' || task.status === 'Archived') && (
            <div className="flex items-center gap-2 text-ptr-green">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">
                {task.status === 'Archived' ? 'Task archived — well done!' : 'Submitted for review'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Manager actions for Completed tasks */}
      {canManage && task.status === 'Completed' && (
        <div className="card p-5 border-l-4 border-l-status-progress">
          <h3 className="text-sm font-semibold text-ptr-brown mb-3">Task completed — awaiting your review</h3>
          {showRequestChanges ? (
            <div className="space-y-3">
              <textarea
                value={requestChangesNote}
                onChange={(e) => setRequestChangesNote(e.target.value)}
                placeholder="Describe what needs to be revised..."
                rows={3}
                maxLength={2000}
                className="input-field resize-none text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    requestChanges.mutate(requestChangesNote.trim());
                    setShowRequestChanges(false);
                    setRequestChangesNote('');
                  }}
                  className="btn-primary text-sm py-2 px-4"
                >
                  <RotateCcw className="w-4 h-4" />
                  Send Back
                </button>
                <button onClick={() => { setShowRequestChanges(false); setRequestChangesNote(''); }} className="btn-secondary text-sm py-2 px-4">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button onClick={() => archiveTask.mutate()} className="btn-primary">
                <Archive className="w-4 h-4" />
                Archive Task
              </button>
              <button onClick={() => setShowRequestChanges(true)} className="btn-secondary">
                <RotateCcw className="w-4 h-4" />
                Request Changes
              </button>
            </div>
          )}
        </div>
      )}

      {task.status === 'Archived' && canManage && (
        <div className="card p-4 border-l-4 border-l-status-archived flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-ptr-brown-light flex-shrink-0" />
          <span className="text-sm font-medium text-ptr-brown-light">Task archived</span>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ptr-brown mb-3">Description</h3>
          <p className="text-sm text-ptr-brown leading-relaxed whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

      {/* Diary / Progress Updates */}
      {task.taskUpdates.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ptr-brown mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-ptr-green" />
            Field Diary ({task.taskUpdates.length} {task.taskUpdates.length === 1 ? 'entry' : 'entries'})
          </h3>
          <div className="space-y-3">
            {[...task.taskUpdates].reverse().map((upd) => {
              const author = users.find((u) => u.id === upd.userId);
              return (
                <div key={upd.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-ptr-green/10 flex items-center justify-center text-xs font-semibold text-ptr-green flex-shrink-0 mt-0.5">
                    {author?.avatarInitials ?? '?'}
                  </div>
                  <div className="flex-1 bg-ptr-cream rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-ptr-brown">{author?.name ?? 'Unknown'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ptr-green">{upd.progressPercentage}%</span>
                        <span className="text-xs text-ptr-brown-light">{formatDateTime(upd.createdAt)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-ptr-brown">{upd.note}</p>
                    {upd.lat !== undefined && upd.lng !== undefined && (
                      <a
                        href={`https://www.google.com/maps?q=${upd.lat},${upd.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-ptr-green font-medium mt-1.5 hover:underline"
                      >
                        <MapPin className="w-3 h-3" />
                        View location
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Guard can add update from detail (quick link) */}
      {isAssignee && role === 'guard' && task.status === 'InProgress' && task.taskUpdates.length === 0 && (
        <button
          onClick={() => { setShowUpdateForm(true); setUpdatePct(0); }}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-ptr-cream-dark text-sm text-ptr-brown-light hover:border-ptr-green hover:text-ptr-green transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add first progress update
        </button>
      )}

      {/* Attachments */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ptr-brown mb-3">
          Attachments ({task.attachments.length})
        </h3>
        <AttachmentList
          attachments={task.attachments}
          canUpload={isAssignee || canManage}
          canRemove={canManage}
          onUpload={handleUpload}
          onRemove={(attId) => removeAttachment.mutate(attId)}
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
            onAddComment={(content) => addComment.mutate(content)}
          />
        )}
      </div>

      {editOpen && currentUser && (
        <TaskForm
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={(data) => { updateTask.mutate(data); setEditOpen(false); }}
          assignableUsers={assignableUsers}
          initialData={task}
          currentUserId={currentUser.id}
          onUploadAttachment={(file) => uploadAttachment.mutate(file)}
          onRemoveAttachment={(attId) => removeAttachment.mutate(attId)}
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

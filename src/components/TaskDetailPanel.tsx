import { useEffect, useState } from 'react';
import {
  X, ExternalLink, User, Calendar, MapPin, Tag, CheckCircle, RotateCcw, Archive, Send, Pencil, Navigation,
} from 'lucide-react';
import { useTask } from '../hooks/useTask';
import { useUsers } from '../hooks/useUsers';
import { useRanges } from '../hooks/useRanges';
import useStore from '../store/useStore';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import CommentThread from './CommentThread';
import { isOverdue } from '../utils/overdue';
import { formatDate, formatDateTime, formatDueRelative } from '../utils/formatters';
import { isFieldRole } from '../types';
import { canManageTasks } from '../lib/permissions';

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-n-60 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-n-70">{label}</div>
        <div className="text-13 text-n-100 mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

export default function TaskDetailPanel({
  taskId,
  onClose,
  onOpenFull,
}: {
  taskId: string | null;
  onClose: () => void;
  onOpenFull: (id: string) => void;
}) {
  const currentUser = useStore((s) => s.currentUser);
  const { users } = useUsers();
  const { ranges, areas } = useRanges();
  const { task, isLoading, startTask, completeTask, archiveTask, requestChanges, addComment } = useTask(taskId ?? undefined);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseNote, setReviseNote] = useState('');

  // Close on Escape.
  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, onClose]);

  useEffect(() => { setReviseOpen(false); setReviseNote(''); }, [taskId]);

  if (!taskId) return null;

  const role = currentUser?.role;
  const canManage = canManageTasks(role);
  const isAssignee = !!currentUser && (task?.assigneeId === currentUser.id || (task?.coAssigneeIds.includes(currentUser.id) ?? false));

  const assignee = task ? users.find((u) => u.id === task.assigneeId) : undefined;
  const coAssignees = task ? task.coAssigneeIds.map((id) => users.find((u) => u.id === id)?.name).filter(Boolean) : [];
  const range = task ? ranges.find((r) => r.id === task.rangeId) : undefined;
  const area = task ? areas.find((a) => a.id === task.areaId) : undefined;
  const overdue = task ? isOverdue(task) : false;
  const due = task ? formatDueRelative(task.dueDate, task.status === 'Completed' || task.status === 'Archived') : { text: '', tone: 'normal' as const };
  const latestGps = task?.taskUpdates.filter((u) => u.lat !== undefined && u.lng !== undefined).slice(-1)[0];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Task details">
      <div className="absolute inset-0 bg-black/30" style={{ animation: 'fadeIn 0.12s ease-out' }} onClick={onClose} />
      <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-[440px] bg-white border-l border-n-30 shadow-pop flex flex-col animate-drawer-right">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 h-11 border-b border-n-30 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-13 font-semibold text-n-100">Task details</span>
            {task && <span className="text-xs text-n-60 tabular-nums font-mono">#{task.id.slice(0, 8)}</span>}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {task && (
              <button onClick={() => onOpenFull(task.id)} className="btn-subtle" title="Open full page">
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Full page</span>
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded text-n-70 hover:bg-n-20 hover:text-n-100 transition-colors" aria-label="Close panel">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading || !task ? (
            <div className="p-4 space-y-3">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-24 w-full mt-4" />
            </div>
          ) : (
            <>
              <div className="p-4 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-n-100 leading-snug">{task.title}</h2>
                  <div className="flex items-center flex-wrap gap-3 mt-2">
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    {overdue && (
                      <span className="inline-flex items-center gap-1.5 text-13 font-semibold text-signal-red">
                        <span className="w-2 h-2 rounded-full bg-signal-red" />{due.text || 'Overdue'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Role-based actions */}
                {isAssignee && isFieldRole(role) && task.status === 'NotStarted' && (
                  <button onClick={() => startTask.mutate()} className="btn-primary w-full"><CheckCircle className="w-4 h-4" />Accept &amp; start</button>
                )}
                {isAssignee && isFieldRole(role) && task.status === 'InProgress' && (
                  <div className="flex gap-2">
                    <button onClick={() => completeTask.mutate()} className="btn-primary flex-1"><Send className="w-4 h-4" />Submit for review</button>
                    <button onClick={() => onOpenFull(task.id)} className="btn-secondary">Add update</button>
                  </div>
                )}
                {canManage && task.status === 'Completed' && !reviseOpen && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => archiveTask.mutate()} className="btn-primary flex-1"><Archive className="w-4 h-4" />Approve &amp; close</button>
                    <button onClick={() => setReviseOpen(true)} className="btn-secondary"><RotateCcw className="w-4 h-4" />Request changes</button>
                  </div>
                )}
                {canManage && task.status === 'Completed' && reviseOpen && (
                  <div className="space-y-2 border border-n-30 rounded-md p-3">
                    <textarea value={reviseNote} onChange={(e) => setReviseNote(e.target.value)} rows={2} placeholder="What needs to be revised?" className="input-field resize-none" style={{ fontSize: '16px' }} />
                    <div className="flex gap-2">
                      <button onClick={() => { requestChanges.mutate(reviseNote.trim()); setReviseOpen(false); setReviseNote(''); }} className="btn-primary flex-1">Send back</button>
                      <button onClick={() => { setReviseOpen(false); setReviseNote(''); }} className="btn-secondary">Cancel</button>
                    </div>
                  </div>
                )}
                {canManage && (task.status === 'NotStarted' || task.status === 'InProgress') && (
                  <button onClick={() => onOpenFull(task.id)} className="btn-secondary w-full"><Pencil className="w-4 h-4" />Edit task</button>
                )}

                {/* Meta */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                  <MetaRow icon={<User className="w-4 h-4" />} label={coAssignees.length ? 'Assignees' : 'Assignee'} value={[assignee?.name ?? '—', ...coAssignees].join(', ')} />
                  <MetaRow icon={<Calendar className="w-4 h-4" />} label="Due date" value={<span className={due.tone === 'overdue' ? 'text-signal-red font-medium' : due.tone === 'soon' ? 'text-signal-amber font-medium' : ''}>{formatDate(task.dueDate)}{due.text ? ` · ${due.text}` : ''}</span>} />
                  <MetaRow icon={<MapPin className="w-4 h-4" />} label="Range" value={range?.name ?? '—'} />
                  <MetaRow icon={<Tag className="w-4 h-4" />} label="Category" value={task.category === 'Other' && task.categoryOther ? task.categoryOther : task.category} />
                  {area && <MetaRow icon={<MapPin className="w-4 h-4" />} label="Beat / area" value={area.name} />}
                </div>

                {latestGps && (
                  <a href={`https://www.google.com/maps?q=${latestGps.lat},${latestGps.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-13 text-ptr-accent font-medium hover:underline">
                    <Navigation className="w-3.5 h-3.5" />Last field location · {latestGps.lat!.toFixed(4)}, {latestGps.lng!.toFixed(4)}
                  </a>
                )}

                {task.description && (
                  <div>
                    <div className="text-xs font-semibold text-n-70 uppercase tracking-wide mb-1">Description</div>
                    <p className="text-13 text-n-90 leading-relaxed whitespace-pre-wrap">{task.description}</p>
                  </div>
                )}
              </div>

              {/* Activity */}
              {task.taskUpdates.length > 0 && (
                <div className="px-4 py-3 border-t border-n-30">
                  <div className="text-xs font-semibold text-n-70 uppercase tracking-wide mb-2">Field activity</div>
                  <div className="space-y-2.5">
                    {[...task.taskUpdates].reverse().slice(0, 4).map((upd) => {
                      const author = users.find((u) => u.id === upd.userId);
                      return (
                        <div key={upd.id} className="text-13">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-n-90">{author?.name ?? 'Unknown'}</span>
                            <span className="text-xs text-n-70">{upd.progressPercentage}% · {formatDateTime(upd.createdAt)}</span>
                          </div>
                          <p className="text-n-80 mt-0.5">{upd.note}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div className="px-4 py-3 border-t border-n-30">
                <div className="text-xs font-semibold text-n-70 uppercase tracking-wide mb-2">Comments ({task.comments.length})</div>
                {currentUser && (
                  <CommentThread comments={task.comments} users={users} currentUser={currentUser} onAddComment={(c) => addComment.mutateAsync(c)} />
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

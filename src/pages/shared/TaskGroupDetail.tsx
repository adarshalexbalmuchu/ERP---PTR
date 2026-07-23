import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X, ChevronRight, Shield } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTaskGroup } from '../../hooks/useTaskGroup';
import { useGroupMessages } from '../../hooks/useGroupMessages';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { useIsMobile } from '../../hooks/useIsMobile';
import { canManageTaskGroups } from '../../lib/permissions';
import { isFieldRole } from '../../types';
import Select from '../../components/Select';
import EmptyState from '../../components/EmptyState';
import Tabs from '../../components/ui/Tabs';
import MessageThread from '../../components/MessageThread';
import { Page, PageHeading } from '../../components/layout/Page';
import { getErrorMessage } from '../../lib/errors';
import { formatDate, formatDateTime } from '../../utils/formatters';
import MobileTaskGroupDetail from '../mobile/MobileTaskGroupDetail';
import type { TaskCategory, TaskPriority } from '../../types';

const CATEGORIES: TaskCategory[] = ['Patrol', 'Camera Trap', 'Survey', 'Maintenance', 'Admin', 'Other'];
const PRIORITIES: TaskPriority[] = ['Critical', 'High', 'Medium', 'Low'];
const OCCURRENCE_STATUS_LABEL: Record<string, string> = { scheduled: 'Scheduled', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' };

function NewAssignmentForm({ groupId, defaultRangeId, onClose }: { groupId: string; defaultRangeId?: string; onClose: () => void }) {
  const { ranges } = useRanges();
  const { createOneTimeAssignment } = useTaskGroup(groupId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Patrol');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [rangeId, setRangeId] = useState(defaultRangeId ?? '');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!title.trim() || !dueDate || !rangeId) return;
    try {
      await createOneTimeAssignment.mutateAsync({
        title: title.trim(), description, category, priority, rangeId,
        dueAt: new Date(dueDate + 'T23:59:59').toISOString(),
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create the assignment.'));
    }
  };

  return (
    <div className="card p-4 space-y-3 max-w-xl">
      {error && <p className="text-13 text-signal-red">{error}</p>}
      <div>
        <label className="block text-13 font-medium text-n-90 mb-1.5">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Weekly fire-line inspection" />
      </div>
      <div>
        <label className="block text-13 font-medium text-n-90 mb-1.5">Details</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input-field resize-none" style={{ fontSize: '16px' }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-13 font-medium text-n-90 mb-1.5">Category</label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} className="input-field select-field">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <label className="block text-13 font-medium text-n-90 mb-1.5">Priority</label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="input-field select-field">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
        <div>
          <label className="block text-13 font-medium text-n-90 mb-1.5">Due date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" style={{ fontSize: '16px' }} />
        </div>
        <div>
          <label className="block text-13 font-medium text-n-90 mb-1.5">Range</label>
          <Select value={rangeId} onChange={(e) => setRangeId(e.target.value)} className="input-field select-field">
            <option value="">Select range</option>
            {ranges.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => void submit()} disabled={createOneTimeAssignment.isPending || !title.trim() || !dueDate || !rangeId} className="btn-primary">
          Create assignment
        </button>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}

export default function TaskGroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentUser = useStore((s) => s.currentUser);
  const { group, members, occurrences, conversationId, isLoading, addMember, removeMember, setCoordinator } = useTaskGroup(id);
  const { messages, postMessage } = useGroupMessages(conversationId);
  const { users } = useUsers();
  const { ranges } = useRanges();
  const [tab, setTab] = useState('overview');
  const [assignmentFormOpen, setAssignmentFormOpen] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');

  const canManage = canManageTaskGroups(currentUser?.role);
  const memberIds = new Set(members.map((m) => m.userId));
  const addableUsers = users.filter((u) => isFieldRole(u.role) && !memberIds.has(u.id));
  const rangeName = group?.rangeId ? ranges.find((r) => r.id === group.rangeId)?.name : 'Reserve-wide';

  if (isMobile) return <MobileTaskGroupDetail />;
  if (isLoading) return <Page><div className="skeleton h-40" /></Page>;
  if (!group) return <Page><EmptyState title="Group not found" description="It may have been removed, or you don't have access to it." /></Page>;

  const memberName = (uid: string) => users.find((u) => u.id === uid)?.name ?? '—';

  return (
    <Page className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <PageHeading title={group.name} meta={`${group.groupType === 'permanent' ? 'Permanent' : 'Temporary'} · ${rangeName}`} />
        {canManage && (
          <button onClick={() => setAssignmentFormOpen((o) => !o)} className="btn-primary flex-shrink-0"><Plus className="w-4 h-4" />New assignment</button>
        )}
      </div>

      {assignmentFormOpen && <NewAssignmentForm groupId={group.id} defaultRangeId={group.rangeId} onClose={() => setAssignmentFormOpen(false)} />}

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'assignments', label: 'Assignments', count: occurrences.length },
          { id: 'members', label: 'Members', count: members.length },
          { id: 'discussion', label: 'Discussion', count: messages.length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="space-y-3">
          {group.description && <p className="text-13 text-n-90">{group.description}</p>}
          <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><div className="text-xs text-n-70">Members</div><div className="text-xl font-semibold text-n-100">{members.length}</div></div>
            <div><div className="text-xs text-n-70">Active assignments</div><div className="text-xl font-semibold text-n-100">{occurrences.filter((o) => o.status === 'scheduled' || o.status === 'active').length}</div></div>
            <div><div className="text-xs text-n-70">Coordinators</div><div className="text-xl font-semibold text-n-100">{members.filter((m) => m.membershipRole === 'coordinator').length}</div></div>
            <div><div className="text-xs text-n-70">Status</div><div className="text-xl font-semibold text-n-100 capitalize">{group.status}</div></div>
          </div>
          {occurrences.length > 0 && (
            <div>
              <div className="text-13 font-semibold text-n-90 mb-2">Recent activity</div>
              <div className="card divide-y divide-n-20">
                {occurrences.slice(0, 5).map((o) => (
                  <button key={o.id} onClick={() => navigate(`occurrences/${o.id}`)} className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-n-10">
                    <div className="min-w-0">
                      <div className="text-13 font-medium text-n-100 truncate">{o.title}</div>
                      <div className="text-xs text-n-70">Due {formatDate(o.dueAt)} · {OCCURRENCE_STATUS_LABEL[o.status]}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'assignments' && (
        occurrences.length === 0 ? (
          <EmptyState title="No assignments yet" description={canManage ? 'Create a one-time assignment to give every member their own task.' : undefined} />
        ) : (
          <div className="card divide-y divide-n-20">
            {occurrences.map((o) => (
              <button key={o.id} onClick={() => navigate(`occurrences/${o.id}`)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-n-10">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-n-100 truncate">{o.title}</div>
                  <div className="text-13 text-n-70">Due {formatDateTime(o.dueAt)}</div>
                </div>
                <span className={`text-xs font-medium px-2 h-6 rounded-full flex items-center flex-shrink-0 ${o.status === 'cancelled' ? 'bg-n-20 text-n-70' : o.status === 'completed' ? 'bg-ptr-green/10 text-ptr-green' : 'bg-signal-amber/10 text-signal-amber'}`}>
                  {OCCURRENCE_STATUS_LABEL[o.status]}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {tab === 'members' && (
        <div className="space-y-3">
          {canManage && (
            <div className="card p-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <label className="block text-13 font-medium text-n-90 mb-1.5">Add member</label>
                <Select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} className="input-field select-field">
                  <option value="">Select a person</option>
                  {addableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </div>
              <button
                onClick={() => { if (addMemberId) { addMember.mutate(addMemberId); setAddMemberId(''); } }}
                disabled={!addMemberId || addMember.isPending}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />Add
              </button>
            </div>
          )}
          {members.length === 0 ? (
            <EmptyState title="No members yet" />
          ) : (
            <div className="card divide-y divide-n-20">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-13 font-medium text-n-100 truncate">{memberName(m.userId)}</span>
                    {m.membershipRole === 'coordinator' && (
                      <span className="text-xs font-medium px-1.5 h-5 rounded-full flex items-center bg-ptr-accent/10 text-ptr-accent flex-shrink-0"><Shield className="w-3 h-3 mr-0.5" />Coordinator</span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setCoordinator.mutate({ memberRowId: m.id, isCoordinator: m.membershipRole !== 'coordinator' })}
                        className="text-13 text-ptr-accent font-medium px-2 h-8 rounded hover:bg-n-20"
                      >
                        {m.membershipRole === 'coordinator' ? 'Remove as coordinator' : 'Make coordinator'}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Remove ${memberName(m.userId)} from this group?`)) removeMember.mutate(m.id); }}
                        className="w-8 h-8 flex items-center justify-center rounded text-n-70 hover:bg-signal-red-bg hover:text-signal-red"
                        aria-label={`Remove ${memberName(m.userId)}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'discussion' && currentUser && (
        <div className="card p-4">
          <MessageThread
            messages={messages}
            users={users}
            currentUser={currentUser}
            canPost={canManage || group.membersCanReply || members.some((m) => m.userId === currentUser.id && m.membershipRole === 'coordinator')}
            disabledReason="Only coordinators and officers can post announcements in this group."
            onSend={(body) => postMessage.mutateAsync(body)}
            emptyLabel="No announcements yet."
          />
        </div>
      )}
    </Page>
  );
}

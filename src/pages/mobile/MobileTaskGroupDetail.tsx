import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X, ChevronRight, Shield } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTaskGroup } from '../../hooks/useTaskGroup';
import { useGroupMessages } from '../../hooks/useGroupMessages';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { canManageTaskGroups } from '../../lib/permissions';
import { isFieldRole } from '../../types';
import Select from '../../components/Select';
import Tabs from '../../components/ui/Tabs';
import MessageThread from '../../components/MessageThread';
import BottomSheet from '../../components/mobile/BottomSheet';
import { getErrorMessage } from '../../lib/errors';
import { formatDate } from '../../utils/formatters';
import type { TaskCategory, TaskPriority } from '../../types';

const CATEGORIES: TaskCategory[] = ['Patrol', 'Camera Trap', 'Survey', 'Maintenance', 'Admin', 'Other'];
const PRIORITIES: TaskPriority[] = ['Critical', 'High', 'Medium', 'Low'];
const OCCURRENCE_STATUS_LABEL: Record<string, string> = { scheduled: 'Scheduled', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' };

function NewAssignmentSheet({ open, onClose, groupId, defaultRangeId }: { open: boolean; onClose: () => void; groupId: string; defaultRangeId?: string }) {
  const { ranges } = useRanges();
  const { createOneTimeAssignment } = useTaskGroup(groupId);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Patrol');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [rangeId, setRangeId] = useState(defaultRangeId ?? '');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!title.trim() || !dueDate || !rangeId) return;
    try {
      await createOneTimeAssignment.mutateAsync({ title: title.trim(), category, priority, rangeId, dueAt: new Date(dueDate + 'T23:59:59').toISOString() });
      setTitle(''); setDueDate('');
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create the assignment.'));
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="New assignment">
      <div className="p-4 space-y-3">
        {error && <p className="text-13 text-signal-red">{error}</p>}
        <div>
          <label className="block text-13 font-medium text-n-90 mb-1.5">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" style={{ fontSize: '16px' }} placeholder="Weekly fire-line inspection" />
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
        <button onClick={() => void submit()} disabled={!title.trim() || !dueDate || !rangeId} className="btn-primary w-full">Create assignment</button>
      </div>
    </BottomSheet>
  );
}

export default function MobileTaskGroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { group, members, occurrences, conversationId, isLoading, addMember, removeMember, setCoordinator } = useTaskGroup(id);
  const { messages, postMessage } = useGroupMessages(conversationId);
  const { users } = useUsers();
  const [tab, setTab] = useState('overview');
  const [assignmentSheetOpen, setAssignmentSheetOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');

  const canManage = canManageTaskGroups(currentUser?.role);
  const memberIds = new Set(members.map((m) => m.userId));
  const addableUsers = users.filter((u) => isFieldRole(u.role) && !memberIds.has(u.id));
  const memberName = (uid: string) => users.find((u) => u.id === uid)?.name ?? '—';

  if (isLoading) return <div className="p-4"><div className="skeleton h-40" /></div>;
  if (!group) return <div className="p-6 text-center text-13 text-n-70">Group not found, or you don't have access to it.</div>;

  return (
    <div>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-n-100 truncate">{group.name}</h1>
          <p className="text-13 text-n-70 mt-0.5">{group.groupType === 'permanent' ? 'Permanent' : 'Temporary'}</p>
        </div>
        {canManage && (
          <button onClick={() => setAssignmentSheetOpen(true)} className="w-11 h-11 flex items-center justify-center rounded-full bg-ptr-green text-white flex-shrink-0" aria-label="New assignment">
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-4">
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
      </div>

      <div className="p-4">
        {tab === 'overview' && (
          <div className="space-y-3">
            {group.description && <p className="text-13 text-n-90">{group.description}</p>}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white border border-n-30 rounded-lg p-2.5"><div className="text-xl font-semibold text-n-100">{members.length}</div><div className="text-13 text-n-80 mt-0.5">Members</div></div>
              <div className="bg-white border border-n-30 rounded-lg p-2.5"><div className="text-xl font-semibold text-n-100">{occurrences.filter((o) => o.status === 'scheduled' || o.status === 'active').length}</div><div className="text-13 text-n-80 mt-0.5">Active assignments</div></div>
            </div>
          </div>
        )}

        {tab === 'assignments' && (
          occurrences.length === 0 ? (
            <p className="text-13 text-n-70 text-center py-6">No assignments yet.</p>
          ) : (
            <div className="bg-white divide-y divide-n-20 -mx-4">
              {occurrences.map((o) => (
                <button key={o.id} onClick={() => navigate(`occurrences/${o.id}`)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left active:bg-n-10">
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium text-n-100 truncate">{o.title}</div>
                    <div className="text-13 text-n-70">Due {formatDate(o.dueAt)} · {OCCURRENCE_STATUS_LABEL[o.status]}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'members' && (
          <div className="space-y-3">
            {canManage && (
              <button onClick={() => setAddSheetOpen(true)} className="btn-secondary w-full"><Plus className="w-4 h-4" />Add member</button>
            )}
            {members.length === 0 ? (
              <p className="text-13 text-n-70 text-center py-6">No members yet.</p>
            ) : (
              <div className="bg-white divide-y divide-n-20 -mx-4">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[15px] font-medium text-n-100 truncate">{memberName(m.userId)}</span>
                      {m.membershipRole === 'coordinator' && <Shield className="w-3.5 h-3.5 text-ptr-accent flex-shrink-0" />}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => setCoordinator.mutate({ memberRowId: m.id, isCoordinator: m.membershipRole !== 'coordinator' })}
                          className={`w-9 h-9 flex items-center justify-center rounded-full active:bg-n-10 ${m.membershipRole === 'coordinator' ? 'text-ptr-accent' : 'text-n-70'}`}
                          aria-label={m.membershipRole === 'coordinator' ? 'Remove as coordinator' : 'Make coordinator'}
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (confirm(`Remove ${memberName(m.userId)}?`)) removeMember.mutate(m.id); }} className="w-9 h-9 flex items-center justify-center rounded-full text-n-70 active:bg-n-10" aria-label="Remove member">
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
          <MessageThread
            messages={messages}
            users={users}
            currentUser={currentUser}
            canPost={canManage || group.membersCanReply || members.some((m) => m.userId === currentUser.id && m.membershipRole === 'coordinator')}
            disabledReason="Only coordinators and officers can post announcements in this group."
            onSend={(body) => postMessage.mutateAsync(body)}
            emptyLabel="No announcements yet."
          />
        )}
      </div>

      <NewAssignmentSheet open={assignmentSheetOpen} onClose={() => setAssignmentSheetOpen(false)} groupId={group.id} defaultRangeId={group.rangeId} />

      <BottomSheet open={addSheetOpen} onClose={() => setAddSheetOpen(false)} title="Add member">
        <div className="p-4 space-y-3">
          <Select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} className="input-field select-field">
            <option value="">Select a person</option>
            {addableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <button
            onClick={() => { if (addMemberId) { addMember.mutate(addMemberId); setAddMemberId(''); setAddSheetOpen(false); } }}
            disabled={!addMemberId}
            className="btn-primary w-full"
          >
            Add to group
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

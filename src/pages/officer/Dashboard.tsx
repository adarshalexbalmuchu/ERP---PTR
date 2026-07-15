import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Plus } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { useOfficerRanges } from '../../hooks/useOfficerRanges';
import { isFieldRole } from '../../types';
import { uploadTaskAttachment } from '../../lib/attachments';
import { isOverdue } from '../../utils/overdue';
import Select from '../../components/Select';
import StatusBadge from '../../components/StatusBadge';
import TaskTable from '../../components/TaskTable';
import TaskForm from '../../components/TaskForm';
import EmptyState from '../../components/EmptyState';
import { CommandBar, ContextPanel } from '../../components/layout/Slots';
import { Page, PageHeading, SectionTitle } from '../../components/layout/Page';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Metric({ label, value, sub, tone = 'default' }: { label: string; value: number | string; sub: string; tone?: 'default' | 'red' | 'amber' | 'green' }) {
  const valueClass =
    tone === 'red' ? 'text-signal-red' : tone === 'amber' ? 'text-signal-amber' : tone === 'green' ? 'text-signal-green' : 'text-n-100';
  return (
    <div className="px-4 py-3.5">
      <div className={`text-[26px] leading-none font-semibold tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-13 font-medium text-n-90 mt-1.5">{label}</div>
      <div className="text-xs text-n-70 mt-0.5">{sub}</div>
    </div>
  );
}

export default function OfficerDashboard() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { tasks, createTask } = useTasks();
  const { users } = useUsers();
  const { ranges, areas } = useRanges();
  const { activeRangeId, rangeIds, setActiveRangeId, isMultiRange } = useOfficerRanges();

  const [formOpen, setFormOpen] = useState(false);

  const myRange = ranges.find((r) => r.id === activeRangeId);
  const myTasks = tasks.filter((t) => t.rangeId === activeRangeId);
  const myGuards = users.filter((u) => isFieldRole(u.role) && u.rangeId === activeRangeId);
  const myAreas = areas.filter((a) => a.rangeId === activeRangeId);

  const totalTasks = myTasks.length;
  const inProgress = myTasks.filter((t) => t.status === 'InProgress').length;
  const overdueCount = myTasks.filter(isOverdue).length;
  const completed = myTasks.filter((t) => t.status === 'Completed').length;
  const archived = myTasks.filter((t) => t.status === 'Archived').length;
  const awaitingReview = completed;
  const completionRate = totalTasks > 0 ? Math.round(((completed + archived) / totalTasks) * 100) : 0;

  const guardChartData = myGuards.map((g) => {
    const gt = myTasks.filter((t) => t.assigneeId === g.id || t.coAssigneeIds.includes(g.id));
    return {
      name: g.name.split(' ')[0],
      'Not started': gt.filter((t) => t.status === 'NotStarted').length,
      'In progress': gt.filter((t) => t.status === 'InProgress').length,
      Completed: gt.filter((t) => t.status === 'Completed').length,
    };
  });

  const priorityTasks = myTasks
    .filter((t) => (t.priority === 'Critical' || t.priority === 'High') && t.status !== 'Archived' && t.status !== 'Completed')
    .slice(0, 8);

  const rangeSwitcher = isMultiRange && (
    <Select value={activeRangeId} onChange={(e) => setActiveRangeId(e.target.value)} className="input-field select-field !w-auto !min-h-[32px] text-13" aria-label="Switch range">
      {rangeIds.map((id) => {
        const r = ranges.find((rr) => rr.id === id);
        return <option key={id} value={id}>{r?.name ?? 'Range'}</option>;
      })}
    </Select>
  );

  return (
    <>
      <CommandBar>
        <button onClick={() => setFormOpen(true)} className="btn-primary"><Plus className="w-4 h-4" />New task</button>
        {rangeSwitcher}
      </CommandBar>

      <ContextPanel>
        <nav className="space-y-0.5">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-n-70">Views</div>
          {[{ id: 'overview', label: 'Overview' }, { id: 'workload', label: 'Workload by staff' }, { id: 'priority', label: 'Priority tasks' }, { id: 'staff', label: 'Staff overview' }].map((it) => (
            <button key={it.id} onClick={() => scrollTo(it.id)} className="w-full text-left px-2.5 h-9 rounded text-13 text-n-90 hover:bg-n-20 transition-colors flex items-center">{it.label}</button>
          ))}
        </nav>
      </ContextPanel>

      <Page className="space-y-6">
        <PageHeading title="Range operations" meta={`${myRange?.name ?? 'Range'} · ${myGuards.length} staff · ${myAreas.length} areas`} />

        {/* Overview strip */}
        <section id="overview">
          <div className="card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-n-30">
            <Metric label="Total tasks" value={totalTasks} sub="This range" />
            <Metric label="In progress" value={inProgress} sub="Currently active" />
            <Metric label="Overdue" value={overdueCount} sub="Past due date" tone={overdueCount > 0 ? 'red' : 'default'} />
            <Metric label="Awaiting review" value={awaitingReview} sub="Completed, unreviewed" tone={awaitingReview > 0 ? 'amber' : 'default'} />
            <Metric label="Completion" value={`${completionRate}%`} sub={`${completed} completed`} tone="green" />
          </div>
        </section>

        {/* Chart + priority */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <section id="workload">
            <SectionTitle>Workload by staff</SectionTitle>
            <div className="card p-4">
              {guardChartData.length === 0 ? (
                <EmptyState title="No staff in this range" description="" />
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={guardChartData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#EDEBE9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#605E5C' }} axisLine={{ stroke: '#E1DFDD' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#605E5C' }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #EDEBE9', boxShadow: '0 4px 16px -4px rgba(32,31,30,0.18)' }} cursor={{ fill: '#FAF9F8' }} />
                    <Bar dataKey="Not started" stackId="a" fill="#C8C6C4" />
                    <Bar dataKey="In progress" stackId="a" fill="#B26A00" />
                    <Bar dataKey="Completed" stackId="a" fill="#1A7F4B" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section id="priority">
            <SectionTitle action={<button onClick={() => navigate('/officer/tasks')} className="text-13 font-medium text-ptr-accent hover:underline">View all →</button>}>Priority tasks</SectionTitle>
            <div className="card overflow-hidden">
              {priorityTasks.length === 0 ? (
                <EmptyState title="No high-priority tasks" description="All critical work is under control." />
              ) : (
                <TaskTable tasks={priorityTasks} users={users} onOpen={(t) => navigate(`/officer/tasks/${t.id}`)} showRange={false} showProgress={false} />
              )}
            </div>
          </section>
        </div>

        {/* Staff overview */}
        {myGuards.length > 0 && (
          <section id="staff">
            <SectionTitle>Staff overview</SectionTitle>
            <div className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-n-20">
              {myGuards.map((g, i) => {
                const gt = myTasks.filter((t) => t.assigneeId === g.id || t.coAssigneeIds.includes(g.id));
                const active = gt.filter((t) => t.status === 'InProgress').length;
                const ov = gt.filter(isOverdue).length;
                return (
                  <div key={g.id} className={`flex items-center gap-3 px-4 py-3 ${i % 3 !== 0 ? 'sm:border-l' : ''} border-n-20`}>
                    <div className="w-8 h-8 rounded-full bg-ptr-green/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-ptr-green">{g.avatarInitials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-13 font-medium text-n-100 truncate">{g.name}</div>
                      <div className="text-xs text-n-70">{gt.length} tasks · {active} active{ov > 0 && <span className="text-signal-red font-medium"> · {ov} overdue</span>}</div>
                    </div>
                    <StatusBadge status={active > 0 ? 'InProgress' : gt.some((t) => t.status === 'NotStarted') ? 'NotStarted' : 'Completed'} size="sm" />
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </Page>

      {formOpen && currentUser && (
        <TaskForm
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={async (data, files) => {
            const rows = await createTask.mutateAsync(data);
            for (const row of rows) {
              for (const file of files) {
                try { await uploadTaskAttachment(row.id, currentUser.id, file); }
                catch (err) { alert(err instanceof Error ? err.message : `Failed to upload "${file.name}"`); }
              }
            }
            setFormOpen(false);
          }}
          assignableUsers={myGuards}
          initialData={null}
          currentUserId={currentUser.id}
          defaultRangeId={activeRangeId}
        />
      )}
    </>
  );
}

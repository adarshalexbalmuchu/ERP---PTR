import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Download, MoreHorizontal, RefreshCw, CheckCircle2, ChevronRight,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { supabase } from '../../lib/supabase';
import { mapTask } from '../../lib/mappers';
import { uploadTaskAttachment } from '../../lib/attachments';
import { isOverdue } from '../../utils/overdue';
import { formatDate, formatDueRelative } from '../../utils/formatters';
import { exportCsv } from '../../utils/exportCsv';
import TaskForm from '../../components/TaskForm';
import TaskTable from '../../components/TaskTable';
import TaskDetailPanel from '../../components/TaskDetailPanel';
import { Menu, MenuItem } from '../../components/ui/Menu';
import { CommandBar, ContextPanel } from '../../components/layout/Slots';
import { PanelSection, PanelItem } from '../../components/layout/PanelNav';
import { Page, PageHeading, SectionTitle } from '../../components/layout/Page';
import { useIsMobile } from '../../hooks/useIsMobile';
import AdminHome from '../mobile/AdminHome';
import type { Task } from '../../types';
import { isFieldRole } from '../../types';
import { getErrorMessage } from '../../lib/errors';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Interactive overview cell — the whole tile is a button that opens the
// registry with the matching filter applied.
function Metric({ label, value, sub, tone = 'default', onClick }: { label: string; value: number | string; sub: string; tone?: 'default' | 'red' | 'amber' | 'green'; onClick: () => void }) {
  const valueClass = tone === 'red' ? 'text-signal-red' : tone === 'amber' ? 'text-signal-amber' : tone === 'green' ? 'text-signal-green' : 'text-n-100';
  return (
    <button onClick={onClick} className="group text-left px-4 py-3.5 hover:bg-n-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ptr-accent/40">
      <div className={`text-[26px] leading-none font-semibold tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-13 font-medium text-n-90 mt-1.5 flex items-center gap-1">{label}<ChevronRight className="w-3.5 h-3.5 text-n-50 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
      <div className="text-xs text-n-70 mt-0.5">{sub}</div>
    </button>
  );
}

// Row in the Action centre detail list.
function ActionRow({ task, assigneeName, rangeName, onOpen }: { task: Task; assigneeName: string; rangeName: string; onOpen: () => void }) {
  const done = task.status === 'Completed' || task.status === 'Archived';
  const due = formatDueRelative(task.dueDate, done);
  const urgency = due.text || (done ? 'Submitted' : `Due ${formatDate(task.dueDate)}`);
  const urgencyClass = due.tone === 'overdue' ? 'text-signal-red' : due.tone === 'soon' ? 'text-signal-amber' : 'text-n-70';
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-n-10 transition-colors border-b border-n-20 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-13 font-medium text-n-100 truncate">{task.title}</div>
        <div className="text-xs text-n-70 truncate">{assigneeName} · {rangeName}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-13 font-semibold ${urgencyClass}`}>{urgency}</div>
        <div className="text-xs text-n-60 tabular-nums">{formatDate(task.dueDate)}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
    </button>
  );
}

type ActionTab = 'overdue' | 'review' | 'critical';

function healthOf(total: number, overdue: number, active: number): { label: string; cls: string } {
  if (total === 0) return { label: 'No active work', cls: 'text-n-60' };
  if (overdue >= 3 || (total > 0 && overdue / total >= 0.25)) return { label: 'At risk', cls: 'text-signal-red' };
  if (overdue > 0) return { label: 'Needs attention', cls: 'text-signal-amber' };
  if (active === 0) return { label: 'No active work', cls: 'text-n-60' };
  return { label: 'On track', cls: 'text-signal-green' };
}

export default function DirectorDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const currentUser = useStore((s) => s.currentUser);
  const { users } = useUsers();
  const { ranges } = useRanges();
  const { createTask } = useTasks();
  const { stats, rangeStats } = useDashboardStats();

  const [formOpen, setFormOpen] = useState(false);
  const [panelTaskId, setPanelTaskId] = useState<string | null>(null);
  const [actionTab, setActionTab] = useState<ActionTab>('overdue');

  const totalTasks = stats?.totalTasks ?? 0;
  const inProgress = stats?.inProgressCount ?? 0;
  const overdueCount = stats?.overdueCount ?? 0;
  const completedClosed = (stats?.completedCount ?? 0) + (stats?.archivedCount ?? 0);
  const completionRate = totalTasks > 0 ? Math.round((completedClosed / totalTasks) * 100) : 0;

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? '—';
  const rangeNameOf = (id: string) => ranges.find((r) => r.id === id)?.name ?? '—';

  const { data: recentTasks = [] } = useQuery({
    queryKey: ['dashboard-recent-tasks'],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(8);
      if (error) throw error;
      return data.map((t) => mapTask(t));
    },
  });
  const { data: reviewTasks = [] } = useQuery({
    queryKey: ['dashboard-pending-review'],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from('tasks').select('*').eq('status', 'Completed');
      if (error) throw error;
      return data.map((t) => mapTask(t));
    },
  });
  const { data: overdueTasks = [] } = useQuery({
    queryKey: ['dashboard-overdue-tasks'],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from('tasks').select('*').in('status', ['NotStarted', 'InProgress']).order('due_date', { ascending: true }).limit(80);
      if (error) throw error;
      return data.map((t) => mapTask(t)).filter(isOverdue);
    },
  });
  const { data: criticalTasks = [] } = useQuery({
    queryKey: ['dashboard-critical-tasks'],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from('tasks').select('*').eq('priority', 'Critical').in('status', ['NotStarted', 'InProgress']).order('due_date', { ascending: true });
      if (error) throw error;
      return data.map((t) => mapTask(t));
    },
  });

  const awaitingReview = reviewTasks.length;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const TABS: { id: ActionTab; label: string; count: number; tone: 'red' | 'amber' }[] = [
    { id: 'overdue', label: 'Overdue', count: overdueTasks.length, tone: 'red' },
    { id: 'review', label: 'Awaiting review', count: awaitingReview, tone: 'amber' },
    { id: 'critical', label: 'Critical', count: criticalTasks.length, tone: 'red' },
  ];
  const activeList = actionTab === 'overdue' ? overdueTasks : actionTab === 'review' ? reviewTasks : criticalTasks;
  const emptyCopy: Record<ActionTab, { title: string; hint: string }> = {
    overdue: { title: 'No overdue tasks', hint: 'Everything is currently on schedule.' },
    review: { title: 'Nothing awaiting review', hint: 'No completed tasks are waiting for approval.' },
    critical: { title: 'No critical tasks', hint: 'All critical-priority work is currently under control.' },
  };

  const refresh = () => { void queryClient.invalidateQueries(); };
  const exportSummary = () => exportCsv(`ptr-range-summary-${new Date().toISOString().slice(0, 10)}.csv`, rangeStats.map((r) => ({
    Range: r.rangeName, Completed: r.completed, Active: r.inProgressCount, Overdue: r.overdue, Total: r.total,
    Progress: `${r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0}%`,
  })));

  if (isMobile) return <AdminHome />;

  return (
    <>
      <CommandBar>
        <button onClick={() => setFormOpen(true)} className="btn-primary"><Plus className="w-4 h-4" />New task</button>
        <button onClick={refresh} className="btn-subtle"><RefreshCw className="w-4 h-4" />Refresh</button>
        <Menu ariaLabel="More actions" align="right" button={<MoreHorizontal className="w-4 h-4" />}>
          <MenuItem icon={<Download className="w-4 h-4" />} label="Export range summary" onClick={exportSummary} />
        </Menu>
      </CommandBar>

      <ContextPanel>
        <PanelSection label="Dashboard">
          <PanelItem label="Overview" onClick={() => scrollTo('overview')} />
          <PanelItem label="Action centre" onClick={() => scrollTo('action-centre')} />
          <PanelItem label="Range performance" onClick={() => scrollTo('ranges')} />
          <PanelItem label="Recent tasks" onClick={() => scrollTo('recent')} />
        </PanelSection>
        <PanelSection label="Quick filters">
          <PanelItem label="High-priority work" count={criticalTasks.length} countTone="red" onClick={() => navigate('/director/tasks?priority=Critical')} />
          <PanelItem label="Overdue this week" count={overdueCount} countTone="red" onClick={() => navigate('/director/tasks?view=overdue')} />
          <PanelItem label="Awaiting my review" count={awaitingReview} countTone="amber" onClick={() => navigate('/director/tasks?view=review')} />
        </PanelSection>
      </ContextPanel>

      <Page className="space-y-6">
        <PageHeading title="Dashboard" meta={<>Palamau Tiger Reserve · All ranges · <span className="tabular-nums">{today}</span></>} />

        {/* Overview strip — every metric is a filter into the registry */}
        <section id="overview">
          <div className="card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-n-30 overflow-hidden">
            <Metric label="Total tasks" value={totalTasks} sub="All ranges" onClick={() => navigate('/director/tasks')} />
            <Metric label="In progress" value={inProgress} sub="Currently active" onClick={() => navigate('/director/tasks?status=InProgress')} />
            <Metric label="Overdue" value={overdueCount} sub="Open · past due" tone={overdueCount > 0 ? 'red' : 'default'} onClick={() => navigate('/director/tasks?view=overdue')} />
            <Metric label="Awaiting review" value={awaitingReview} sub="Completed, unreviewed" tone={awaitingReview > 0 ? 'amber' : 'default'} onClick={() => navigate('/director/tasks?view=review')} />
            <Metric label="Completion" value={`${completionRate}%`} sub={`${completedClosed} of ${totalTasks} tasks`} tone="green" onClick={() => navigate('/director/tasks?status=Archived')} />
          </div>
        </section>

        {/* Action centre — one interactive place for what needs attention */}
        <section id="action-centre">
          <SectionTitle>Action centre</SectionTitle>
          <div className="card overflow-hidden">
            <div className="flex items-stretch border-b border-n-30" role="tablist" aria-label="Action centre categories">
              {TABS.map((t) => {
                const active = actionTab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActionTab(t.id)}
                    className={`flex items-center gap-2 px-4 h-11 text-13 font-medium border-b-2 -mb-px transition-colors ${active ? 'border-ptr-green text-n-100' : 'border-transparent text-n-70 hover:text-n-100'}`}
                  >
                    {t.label}
                    {t.count > 0 && <span className={`text-xs font-semibold tabular-nums ${t.tone === 'red' ? 'text-signal-red' : 'text-signal-amber'}`}>{t.count}</span>}
                  </button>
                );
              })}
            </div>
            {activeList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <CheckCircle2 className="w-7 h-7 text-signal-green/70 mb-2" />
                <div className="text-13 font-semibold text-n-100">{emptyCopy[actionTab].title}</div>
                <div className="text-13 text-n-70 mt-0.5">{emptyCopy[actionTab].hint}</div>
              </div>
            ) : (
              <div>
                {activeList.slice(0, 6).map((t) => (
                  <ActionRow key={t.id} task={t} assigneeName={nameOf(t.assigneeId)} rangeName={rangeNameOf(t.rangeId)} onOpen={() => setPanelTaskId(t.id)} />
                ))}
                {activeList.length > 6 && (
                  <button onClick={() => navigate(actionTab === 'overdue' ? '/director/tasks?view=overdue' : actionTab === 'review' ? '/director/tasks?view=review' : '/director/tasks?priority=Critical')} className="w-full px-4 h-10 text-13 font-medium text-ptr-accent hover:bg-n-10 transition-colors text-left">
                    View all {activeList.length} →
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Range performance — compact comparison table */}
        <section id="ranges">
          <SectionTitle>Range performance</SectionTitle>
          <div className="card overflow-x-auto">
            <table className="w-full border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-n-30 text-left">
                  <th className="px-4 h-9 text-xs font-semibold text-n-70">Range</th>
                  <th className="px-3 h-9 text-xs font-semibold text-n-70 text-right">Completed</th>
                  <th className="px-3 h-9 text-xs font-semibold text-n-70 text-right">Active</th>
                  <th className="px-3 h-9 text-xs font-semibold text-n-70 text-right">Overdue</th>
                  <th className="px-3 h-9 text-xs font-semibold text-n-70 w-[280px]">Progress</th>
                  <th className="px-4 h-9 text-xs font-semibold text-n-70">Health</th>
                </tr>
              </thead>
              <tbody>
                {rangeStats.map((r) => {
                  const pct = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
                  const health = healthOf(r.total, r.overdue, r.inProgressCount);
                  return (
                    <tr key={r.rangeId} onClick={() => navigate(`/director/tasks?range=${r.rangeId}`)} className="border-b border-n-20 last:border-0 hover:bg-n-10 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5 text-13 font-medium text-n-100 whitespace-nowrap">{r.rangeName}</td>
                      <td className="px-3 py-2.5 text-13 text-n-90 text-right tabular-nums">{r.total === 0 ? '—' : r.completed}</td>
                      <td className="px-3 py-2.5 text-13 text-n-90 text-right tabular-nums">{r.total === 0 ? '—' : r.inProgressCount}</td>
                      <td className={`px-3 py-2.5 text-13 text-right tabular-nums ${r.overdue > 0 ? 'text-signal-red font-semibold' : 'text-n-90'}`}>{r.total === 0 ? '—' : r.overdue}</td>
                      <td className="px-3 py-2.5">
                        {r.total === 0 ? (
                          <span className="text-13 text-n-60">No tasks</span>
                        ) : (
                          <div className="flex items-center gap-2.5 max-w-[300px]">
                            <span className="flex-1 h-1.5 rounded-full bg-n-20 overflow-hidden"><span className="block h-full bg-ptr-green rounded-full" style={{ width: `${pct}%` }} /></span>
                            <span className="text-13 font-semibold text-n-90 tabular-nums w-9 text-right">{pct}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><span className={`text-13 font-medium ${health.cls}`}>{health.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent tasks */}
        <section id="recent">
          <SectionTitle action={<button onClick={() => navigate('/director/tasks')} className="text-13 font-medium text-ptr-accent hover:underline">View registry →</button>}>Recent tasks</SectionTitle>
          <div className="card overflow-hidden">
            <TaskTable tasks={recentTasks} users={users} ranges={ranges} onOpen={(t) => setPanelTaskId(t.id)} showProgress={false} />
          </div>
        </section>
      </Page>

      <TaskDetailPanel taskId={panelTaskId} onClose={() => setPanelTaskId(null)} onOpenFull={(id) => navigate(`/director/tasks/${id}`)} />

      {formOpen && currentUser && (
        <TaskForm
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={async (data, files) => {
            const rows = await createTask.mutateAsync(data);
            for (const row of rows) {
              for (const file of files) {
                try { await uploadTaskAttachment(row.id, currentUser.id, file); }
                catch (err) { alert(getErrorMessage(err, `Failed to upload "${file.name}"`)); }
              }
            }
            setFormOpen(false);
          }}
          assignableUsers={users.filter((u) => isFieldRole(u.role))}
          initialData={null}
          currentUserId={currentUser.id}
          ranges={ranges}
        />
      )}
    </>
  );
}

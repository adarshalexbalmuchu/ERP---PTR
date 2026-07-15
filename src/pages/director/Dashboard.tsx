import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, AlertTriangle, ClipboardCheck, Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTasks } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useRanges } from '../../hooks/useRanges';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { supabase } from '../../lib/supabase';
import { mapTask } from '../../lib/mappers';
import { uploadTaskAttachment } from '../../lib/attachments';
import { isOverdue } from '../../utils/overdue';
import { formatDate } from '../../utils/formatters';
import TaskForm from '../../components/TaskForm';
import TaskTable from '../../components/TaskTable';
import { CommandBar, ContextPanel } from '../../components/layout/Slots';
import { Page, PageHeading, SectionTitle } from '../../components/layout/Page';
import type { Task } from '../../types';
import { isFieldRole } from '../../types';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// One cell of the flat overview strip — big numeral, quiet label + context.
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

function AttentionRow({ icon, label, count, tone, onClick }: { icon: React.ReactNode; label: string; count: number; tone: 'red' | 'amber'; onClick: () => void }) {
  const active = count > 0;
  const countClass = tone === 'red' ? 'text-signal-red' : 'text-signal-amber';
  return (
    <button
      onClick={onClick}
      disabled={!active}
      className="w-full flex items-center gap-3 px-4 h-11 text-left hover:bg-n-10 disabled:hover:bg-transparent transition-colors border-b border-n-20 last:border-0 disabled:cursor-default"
    >
      <span className={active ? countClass : 'text-n-50'}>{icon}</span>
      <span className={`flex-1 text-13 ${active ? 'text-n-90 font-medium' : 'text-n-70'}`}>{label}</span>
      {active ? (
        <span className={`text-13 font-semibold tabular-nums ${countClass}`}>{count}</span>
      ) : (
        <CheckCircle2 className="w-4 h-4 text-signal-green/70" />
      )}
      {active && <ChevronRight className="w-4 h-4 text-n-50" />}
    </button>
  );
}

function PanelNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="space-y-0.5">
      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-n-70">Views</div>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => scrollTo(it.id)}
          className="w-full text-left px-2.5 h-9 rounded text-13 text-n-90 hover:bg-n-20 transition-colors flex items-center"
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}

export default function DirectorDashboard() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { users } = useUsers();
  const { ranges } = useRanges();
  const { createTask } = useTasks();
  const { stats, rangeStats } = useDashboardStats();

  const [formOpen, setFormOpen] = useState(false);

  const totalTasks = stats?.totalTasks ?? 0;
  const inProgress = stats?.inProgressCount ?? 0;
  const overdueCount = stats?.overdueCount ?? 0;
  const completed = stats?.completedCount ?? 0;
  const completionRate = totalTasks > 0
    ? Math.round((((stats?.completedCount ?? 0) + (stats?.archivedCount ?? 0)) / totalTasks) * 100)
    : 0;

  const { data: recentTasks = [] } = useQuery({
    queryKey: ['dashboard-recent-tasks'],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(8);
      if (error) throw error;
      return data.map((t) => mapTask(t));
    },
  });

  const { data: completedPendingReview = [] } = useQuery({
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
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .in('status', ['NotStarted', 'InProgress'])
        .order('due_date', { ascending: true })
        .limit(60);
      if (error) throw error;
      return data.map((t) => mapTask(t)).filter(isOverdue);
    },
  });

  const awaitingReview = completedPendingReview.length;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <CommandBar>
        <button onClick={() => setFormOpen(true)} className="btn-primary"><Plus className="w-4 h-4" />New task</button>
        <button onClick={() => window.print()} className="btn-subtle"><Download className="w-4 h-4" />Export</button>
      </CommandBar>

      <ContextPanel>
        <PanelNav
          items={[
            { id: 'overview', label: 'Overview' },
            { id: 'needs-attention', label: 'Needs attention' },
            { id: 'ranges', label: 'Range performance' },
            { id: 'recent', label: 'Recent tasks' },
          ]}
        />
      </ContextPanel>

      <Page className="space-y-6">
        <PageHeading title="Dashboard" meta={<>Palamau Tiger Reserve · All ranges · <span className="tabular-nums">{today}</span></>} />

        {/* Overview strip */}
        <section id="overview">
          <div className="card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-n-30">
            <Metric label="Total tasks" value={totalTasks} sub="All ranges" />
            <Metric label="In progress" value={inProgress} sub="Currently active" />
            <Metric label="Overdue" value={overdueCount} sub="Past due date" tone={overdueCount > 0 ? 'red' : 'default'} />
            <Metric label="Awaiting review" value={awaitingReview} sub="Completed, unreviewed" tone={awaitingReview > 0 ? 'amber' : 'default'} />
            <Metric label="Completion" value={`${completionRate}%`} sub={`${completed} completed`} tone="green" />
          </div>
        </section>

        {/* Needs attention */}
        <section id="needs-attention" className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="card overflow-hidden">
            <div className="px-4 h-11 flex items-center border-b border-n-30">
              <h2 className="text-13 font-semibold text-n-90">Needs attention</h2>
            </div>
            <AttentionRow icon={<Clock className="w-4 h-4" />} label="Tasks past their due date" count={overdueCount} tone="red" onClick={() => scrollTo('recent')} />
            <AttentionRow icon={<ClipboardCheck className="w-4 h-4" />} label="Completed tasks awaiting review" count={awaitingReview} tone="amber" onClick={() => navigate('/director/tasks?status=Completed')} />
            <AttentionRow icon={<AlertTriangle className="w-4 h-4" />} label="Open critical-priority tasks" count={stats?.criticalCount ?? 0} tone="red" onClick={() => navigate('/director/tasks?priority=Critical')} />
          </div>

          {/* Overdue detail list */}
          <div className="card overflow-hidden">
            <div className="px-4 h-11 flex items-center justify-between border-b border-n-30">
              <h2 className="text-13 font-semibold text-n-90">Overdue tasks</h2>
              <span className="text-xs text-n-70">{overdueTasks.length} shown</span>
            </div>
            {overdueTasks.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-5 text-13 text-n-70">
                <CheckCircle2 className="w-4 h-4 text-signal-green/70" /> No overdue tasks — all on schedule.
              </div>
            ) : (
              overdueTasks.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/director/tasks/${t.id}`)}
                  className="w-full flex items-center gap-3 px-4 h-11 text-left hover:bg-n-10 transition-colors border-b border-n-20 last:border-0"
                >
                  <span className="flex-1 min-w-0 text-13 text-n-100 truncate">{t.title}</span>
                  <span className="text-13 text-n-70 whitespace-nowrap hidden sm:block">{users.find((u) => u.id === t.assigneeId)?.name ?? '—'}</span>
                  <span className="text-13 font-semibold text-signal-red whitespace-nowrap tabular-nums">{formatDate(t.dueDate)}</span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Range performance */}
        <section id="ranges">
          <SectionTitle>Range performance</SectionTitle>
          <div className="card overflow-hidden">
            {rangeStats.map((range, i) => {
              const pct = range.total > 0 ? Math.round((range.completed / range.total) * 100) : 0;
              return (
                <button
                  key={range.rangeId}
                  onClick={() => navigate(`/director/tasks?range=${range.rangeId}`)}
                  className={`w-full flex items-center gap-4 px-4 h-14 text-left hover:bg-n-10 transition-colors ${i > 0 ? 'border-t border-n-20' : ''}`}
                >
                  <span className="w-28 md:w-40 text-13 font-medium text-n-100 truncate flex-shrink-0">{range.rangeName}</span>
                  <span className="hidden sm:flex items-center gap-4 text-xs text-n-70 tabular-nums flex-shrink-0">
                    <span><span className="font-semibold text-n-90">{range.inProgressCount}</span> active</span>
                    <span><span className="font-semibold text-n-90">{range.completed}</span> done</span>
                    <span className={range.overdue > 0 ? 'text-signal-red font-semibold' : ''}>{range.overdue} overdue</span>
                  </span>
                  <span className="flex-1 h-1.5 rounded-full bg-n-20 overflow-hidden min-w-[40px]">
                    <span className="block h-full bg-ptr-green rounded-full" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-10 text-right text-13 font-semibold text-n-90 tabular-nums flex-shrink-0">{pct}%</span>
                  <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </section>

        {/* Recent tasks */}
        <section id="recent">
          <SectionTitle action={<button onClick={() => navigate('/director/tasks')} className="text-13 font-medium text-ptr-accent hover:underline">View registry →</button>}>
            Recent tasks
          </SectionTitle>
          <div className="card overflow-hidden">
            <TaskTable tasks={recentTasks} users={users} ranges={ranges} onOpen={(t) => navigate(`/director/tasks/${t.id}`)} showProgress={false} />
          </div>
        </section>
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
          assignableUsers={users.filter((u) => isFieldRole(u.role))}
          initialData={null}
          currentUserId={currentUser.id}
          ranges={ranges}
        />
      )}
    </>
  );
}

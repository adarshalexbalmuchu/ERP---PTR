import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Plus, WifiOff } from 'lucide-react';
import useStore from '../../store/useStore';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import MobileTaskCard from '../../components/mobile/MobileTaskCard';
import FilterChips from '../../components/mobile/FilterChips';
import TaskFilterSheet, { EMPTY_TASK_FILTERS, type MobileTaskFilters } from '../../components/mobile/TaskFilterSheet';
import PullToRefresh from '../../components/mobile/PullToRefresh';
import { isOverdue } from '../../utils/overdue';
import type { Task, User, Range, Area } from '../../types';

const PAGE_SIZE = 20;
type Chip = 'all' | 'mine' | 'today' | 'overdue' | 'review';

function isDueToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function MobileTaskList({
  title,
  tasks,
  users,
  ranges,
  areas,
  onOpen,
  onRefresh,
  onNewTask,
  showAssignee = true,
  showRangeFilter = true,
  loading = false,
}: {
  title: string;
  tasks: Task[];
  users: User[];
  ranges: Range[];
  areas: Area[];
  onOpen: (task: Task) => void;
  onRefresh: () => Promise<unknown>;
  onNewTask?: () => void;
  showAssignee?: boolean;
  showRangeFilter?: boolean;
  loading?: boolean;
}) {
  const currentUser = useStore((s) => s.currentUser);
  const { isOnline } = useSyncStatus();
  const [chip, setChip] = useState<Chip>('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<MobileTaskFilters>(EMPTY_TASK_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? '—';
  const locationOf = (t: Task) => {
    const range = ranges.find((r) => r.id === t.rangeId)?.name ?? '—';
    const area = t.areaId ? areas.find((a) => a.id === t.areaId)?.name : undefined;
    return area ? `${range} · ${area}` : range;
  };

  const chipCounts = useMemo(() => ({
    all: tasks.length,
    mine: tasks.filter((t) => t.assigneeId === currentUser?.id || t.coAssigneeIds.includes(currentUser?.id ?? '')).length,
    today: tasks.filter((t) => isDueToday(t.dueDate)).length,
    overdue: tasks.filter((t) => (t.status === 'NotStarted' || t.status === 'InProgress') && isOverdue(t)).length,
    review: tasks.filter((t) => t.status === 'Completed').length,
  }), [tasks, currentUser?.id]);

  const filtered = tasks.filter((t) => {
    if (chip === 'mine' && !(t.assigneeId === currentUser?.id || t.coAssigneeIds.includes(currentUser?.id ?? ''))) return false;
    if (chip === 'today' && !isDueToday(t.dueDate)) return false;
    if (chip === 'overdue' && !((t.status === 'NotStarted' || t.status === 'InProgress') && isOverdue(t))) return false;
    if (chip === 'review' && t.status !== 'Completed') return false;
    if (filters.rangeId && t.rangeId !== filters.rangeId) return false;
    if (filters.areaId && t.areaId !== filters.areaId) return false;
    if (filters.assigneeId && !(t.assigneeId === filters.assigneeId || t.coAssigneeIds.includes(filters.assigneeId))) return false;
    if (filters.status && t.status !== filters.status) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !nameOf(t.assigneeId).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const aOverdue = isOverdue(a), bOverdue = isOverdue(b);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
  const visible = sorted.slice(0, visibleCount);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const resetPaging = () => setVisibleCount(PAGE_SIZE);

  return (
    <div>
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-n-100">{title}</h1>
          {onNewTask && (
            <button onClick={onNewTask} className="w-10 h-10 flex items-center justify-center rounded-full bg-ptr-green text-white flex-shrink-0" aria-label="New task">
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
        {!isOnline && (
          <div className="mt-1.5 flex items-center gap-1.5 text-13 text-signal-amber">
            <WifiOff className="w-3.5 h-3.5" />Offline — showing last synced data
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-n-70" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPaging(); }}
              placeholder="Search tasks…"
              className="input-field pl-9 !min-h-[40px]"
              style={{ fontSize: '16px' }}
            />
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center rounded border border-n-40 text-n-80"
            aria-label="Advanced filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-ptr-green text-white text-[10px] font-semibold flex items-center justify-center">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      <FilterChips
        chips={[
          { id: 'all', label: 'All', count: chipCounts.all },
          { id: 'mine', label: 'Mine', count: chipCounts.mine },
          { id: 'today', label: 'Today', count: chipCounts.today },
          { id: 'overdue', label: 'Overdue', count: chipCounts.overdue },
          { id: 'review', label: 'Awaiting review', count: chipCounts.review },
        ]}
        active={chip}
        onChange={(id) => { setChip(id as Chip); resetPaging(); }}
      />

      <PullToRefresh onRefresh={onRefresh}>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-n-20 flex items-center justify-center mb-3 text-n-70">
              <Search className="w-5 h-5" />
            </div>
            <div className="text-[15px] font-semibold text-n-100">No tasks match this view</div>
            <div className="text-13 text-n-70 mt-1">Try a different filter or check back later.</div>
          </div>
        ) : (
          <>
            {visible.map((t) => (
              <MobileTaskCard
                key={t.id}
                task={t}
                locationLabel={locationOf(t)}
                assigneeName={showAssignee ? nameOf(t.assigneeId) : undefined}
                onClick={() => onOpen(t)}
              />
            ))}
            {sorted.length > visible.length && (
              <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="w-full py-4 text-13 font-medium text-ptr-accent">
                Load more ({sorted.length - visible.length} remaining)
              </button>
            )}
            <div className="h-4" />
          </>
        )}
      </PullToRefresh>

      <TaskFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={(f) => { setFilters(f); resetPaging(); }}
        ranges={ranges}
        areas={areas}
        users={users}
        showRange={showRangeFilter}
      />
    </div>
  );
}

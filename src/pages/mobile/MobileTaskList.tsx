import { useMemo, useRef, useState } from 'react';
import {
  Search, SlidersHorizontal, Plus, WifiOff, ListChecks, X,
  UserCog, CircleDashed, CalendarClock, Trash2, Download,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useMobileOverlay } from '../../contexts/MobileOverlayContext';
import MobileTaskCard from '../../components/mobile/MobileTaskCard';
import FilterChips from '../../components/mobile/FilterChips';
import TaskFilterSheet, { EMPTY_TASK_FILTERS, type MobileTaskFilters } from '../../components/mobile/TaskFilterSheet';
import PullToRefresh from '../../components/mobile/PullToRefresh';
import BottomSheet from '../../components/mobile/BottomSheet';
import { isOverdue } from '../../utils/overdue';
import { PRIORITY_ORDER } from '../../components/PriorityBadge';
import { matchesTaskSearch } from '../../utils/taskSearch';
import type { Task, User, Range, Area, TaskStatus } from '../../types';

const PAGE_SIZE = 20;
type Chip = 'all' | 'mine' | 'today' | 'overdue' | 'review';

const STATUS_SET: { value: TaskStatus; label: string }[] = [
  { value: 'NotStarted', label: 'Not started' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Completed', label: 'Completed (awaiting review)' },
  { value: 'Archived', label: 'Approved & closed' },
];

/** Bulk actions for the task registry — mirrors the desktop selected-rows
    command bar (director/range_officer only; passed by the caller). Kept
    optional so plain field-role usages (guard's "My tasks") don't grow a
    selection UI they have no permission to use. */
export interface MobileTaskBulkActions {
  assignableUsers: User[];
  onAssign: (ids: string[], userId: string) => void;
  onStatus: (ids: string[], status: TaskStatus) => void;
  onDue: (ids: string[], dueDateInputValue: string) => void;
  /** Omit to hide delete — desktop only grants this to directors, not range_officer. */
  onDelete?: (ids: string[]) => void;
  onExportSelected: (tasks: Task[]) => void;
  onExportAll: (tasks: Task[]) => void;
}

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
  bulk,
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
  bulk?: MobileTaskBulkActions;
}) {
  const currentUser = useStore((s) => s.currentUser);
  const { isOnline } = useSyncStatus();
  const overlay = useMobileOverlay();
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [chip, setChip] = useState<Chip>('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<MobileTaskFilters>(EMPTY_TASK_FILTERS);
  const [filterOpenFallback, setFilterOpenFallback] = useState(false);
  const filterOpen = overlay?.isOpen('filters') ?? filterOpenFallback;
  const openFilters = () => (overlay ? overlay.open('filters', filterButtonRef.current) : setFilterOpenFallback(true));
  const closeFilters = () => (overlay ? overlay.close('filters') : setFilterOpenFallback(false));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSheet, setBulkSheet] = useState<'assign' | 'status' | 'due' | null>(null);
  const [dueDraft, setDueDraft] = useState('');
  const exitSelection = () => { setSelectionMode(false); setSelectedIds([]); setBulkSheet(null); setDueDraft(''); };
  const toggleSelect = (id: string) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

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
    if (search && !matchesTaskSearch(t.title, nameOf(t.assigneeId), search)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aOverdue = isOverdue(a), bOverdue = isOverdue(b);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
  const visible = sorted.slice(0, visibleCount);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const selectedTasks = tasks.filter((t) => selectedIds.includes(t.id));

  const resetPaging = () => setVisibleCount(PAGE_SIZE);

  const runBulkDue = () => {
    if (!dueDraft) return;
    bulk?.onDue(selectedIds, dueDraft);
    exitSelection();
  };
  const runBulkDelete = () => {
    if (!bulk?.onDelete) return;
    if (!confirm(`Delete ${selectedTasks.length} selected task${selectedTasks.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    bulk.onDelete(selectedIds);
    exitSelection();
  };

  return (
    <div>
      <div className="px-4 pt-3 pb-1">
        {selectionMode ? (
          <div className="flex items-center justify-between gap-2 h-10">
            <span className="text-[15px] font-semibold text-n-100">{selectedIds.length} selected</span>
            <button onClick={exitSelection} className="flex items-center gap-1 text-13 font-medium text-n-80"><X className="w-4 h-4" />Cancel</button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-n-100">{title}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              {bulk && (
                <button onClick={() => setSelectionMode(true)} className="w-10 h-10 flex items-center justify-center rounded-full border border-n-40 text-n-80" aria-label="Select tasks">
                  <ListChecks className="w-4.5 h-4.5" />
                </button>
              )}
              {onNewTask && (
                <button onClick={onNewTask} className="w-10 h-10 flex items-center justify-center rounded-full bg-ptr-green text-white flex-shrink-0" aria-label="New task">
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}
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
            ref={filterButtonRef}
            onClick={openFilters}
            className={`relative w-12 h-12 flex-shrink-0 flex items-center justify-center rounded border transition-colors ${
              activeFilterCount > 0 ? 'border-ptr-green bg-ptr-green/10 text-ptr-green' : 'border-n-40 text-n-80'
            }`}
            aria-label="Filter tasks"
            aria-expanded={filterOpen}
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
                selectionMode={selectionMode}
                selected={selectedIds.includes(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
              />
            ))}
            {sorted.length > visible.length && (
              <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="w-full py-4 text-13 font-medium text-ptr-accent">
                Load more ({sorted.length - visible.length} remaining)
              </button>
            )}
            <div className={selectionMode ? 'h-20' : 'h-4'} />
          </>
        )}
      </PullToRefresh>

      <TaskFilterSheet
        open={filterOpen}
        onClose={closeFilters}
        filters={filters}
        onChange={(f) => { setFilters(f); resetPaging(); }}
        ranges={ranges}
        areas={areas}
        users={users}
        showRange={showRangeFilter}
      />

      {bulk && selectionMode && (
        <div
          className="fixed left-0 right-0 z-20 bg-white border-t border-n-30 flex items-center gap-1 px-3 overflow-x-auto"
          style={{ bottom: 'calc(var(--ptr-bottom-nav-h) + env(safe-area-inset-bottom))', height: '56px' }}
        >
          {selectedIds.length === 0 ? (
            <>
              <button onClick={() => setSelectedIds(sorted.map((t) => t.id))} className="btn-subtle flex-shrink-0">Select all ({sorted.length})</button>
              <button onClick={() => { bulk.onExportAll(sorted); exitSelection(); }} className="btn-subtle flex-shrink-0"><Download className="w-4 h-4" />Export all</button>
            </>
          ) : (
            <>
              <button onClick={() => setBulkSheet('assign')} className="btn-subtle flex-shrink-0"><UserCog className="w-4 h-4" />Assign</button>
              <button onClick={() => setBulkSheet('status')} className="btn-subtle flex-shrink-0"><CircleDashed className="w-4 h-4" />Status</button>
              <button onClick={() => setBulkSheet('due')} className="btn-subtle flex-shrink-0"><CalendarClock className="w-4 h-4" />Due date</button>
              <button onClick={() => { bulk.onExportSelected(selectedTasks); exitSelection(); }} className="btn-subtle flex-shrink-0"><Download className="w-4 h-4" />Export</button>
              {bulk.onDelete && (
                <button onClick={runBulkDelete} className="btn-subtle flex-shrink-0 !text-signal-red"><Trash2 className="w-4 h-4" />Delete</button>
              )}
            </>
          )}
        </div>
      )}

      <BottomSheet open={bulkSheet === 'assign'} onClose={() => setBulkSheet(null)} title={`Reassign ${selectedIds.length} task${selectedIds.length > 1 ? 's' : ''} to`}>
        <div className="py-1 pb-3 max-h-[60dvh] overflow-y-auto">
          {bulk?.assignableUsers.map((u) => (
            <button key={u.id} onClick={() => { bulk.onAssign(selectedIds, u.id); exitSelection(); }} className="w-full flex items-center px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10 text-left">
              {u.name}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={bulkSheet === 'status'} onClose={() => setBulkSheet(null)} title="Set status">
        <div className="py-1 pb-3">
          {STATUS_SET.map((s) => (
            <button key={s.value} onClick={() => { bulk?.onStatus(selectedIds, s.value); exitSelection(); }} className="w-full flex items-center px-4 min-h-[48px] text-[15px] text-n-90 active:bg-n-10 text-left">
              {s.label}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={bulkSheet === 'due'} onClose={() => setBulkSheet(null)} title={`New due date for ${selectedIds.length} task${selectedIds.length > 1 ? 's' : ''}`}>
        <div className="p-4 space-y-3">
          <input type="date" value={dueDraft} onChange={(e) => setDueDraft(e.target.value)} className="input-field" style={{ fontSize: '16px' }} />
          <button onClick={runBulkDue} disabled={!dueDraft} className="btn-primary w-full">Apply</button>
        </div>
      </BottomSheet>
    </div>
  );
}

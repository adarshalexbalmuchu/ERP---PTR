import BottomSheet from './BottomSheet';
import type { Range, Area, User, TaskPriority, TaskStatus } from '../../types';

export interface MobileTaskFilters {
  rangeId: string;
  areaId: string;
  assigneeId: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
}

export const EMPTY_TASK_FILTERS: MobileTaskFilters = { rangeId: '', areaId: '', assigneeId: '', status: '', priority: '' };

const STATUS_OPTS: { value: TaskStatus; label: string }[] = [
  { value: 'NotStarted', label: 'Not started' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Completed', label: 'Awaiting review' },
  { value: 'Archived', label: 'Completed' },
];
const PRIORITY_OPTS: { value: TaskPriority; label: string }[] = [
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

function ChipRow<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | ''; onChange: (v: T | '') => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(active ? '' : o.value)}
            className={`h-9 px-3.5 rounded-full text-13 font-medium transition-colors ${active ? 'bg-ptr-green text-white' : 'bg-n-20 text-n-90'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TaskFilterSheet({
  open,
  onClose,
  filters,
  onChange,
  ranges,
  areas,
  users,
  showRange = true,
}: {
  open: boolean;
  onClose: () => void;
  filters: MobileTaskFilters;
  onChange: (next: MobileTaskFilters) => void;
  ranges: Range[];
  areas: Area[];
  users: User[];
  showRange?: boolean;
}) {
  const set = <K extends keyof MobileTaskFilters>(k: K, v: MobileTaskFilters[K]) => onChange({ ...filters, [k]: v });
  const areaOptions = areas.filter((a) => !filters.rangeId || a.rangeId === filters.rangeId);
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <BottomSheet open={open} onClose={onClose} title="Filters">
      <div className="p-4 space-y-5">
        {showRange && ranges.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-n-70 mb-2">Range</div>
            <ChipRow options={ranges.map((r) => ({ value: r.id, label: r.name }))} value={filters.rangeId} onChange={(v) => onChange({ ...filters, rangeId: v, areaId: '' })} />
          </div>
        )}
        {areaOptions.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-n-70 mb-2">Beat / area</div>
            <ChipRow options={areaOptions.map((a) => ({ value: a.id, label: a.name }))} value={filters.areaId} onChange={(v) => set('areaId', v)} />
          </div>
        )}
        {users.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-n-70 mb-2">Assignee</div>
            <ChipRow options={users.map((u) => ({ value: u.id, label: u.name.split(' ')[0] }))} value={filters.assigneeId} onChange={(v) => set('assigneeId', v)} />
          </div>
        )}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-n-70 mb-2">Status</div>
          <ChipRow options={STATUS_OPTS} value={filters.status} onChange={(v) => set('status', v)} />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-n-70 mb-2">Priority</div>
          <ChipRow options={PRIORITY_OPTS} value={filters.priority} onChange={(v) => set('priority', v)} />
        </div>
      </div>
      <div className="sticky bottom-0 bg-white border-t border-n-30 p-3 flex gap-2">
        <button onClick={() => onChange(EMPTY_TASK_FILTERS)} disabled={activeCount === 0} className="btn-secondary flex-1">Clear all</button>
        <button onClick={onClose} className="btn-primary flex-1">Show results</button>
      </div>
    </BottomSheet>
  );
}

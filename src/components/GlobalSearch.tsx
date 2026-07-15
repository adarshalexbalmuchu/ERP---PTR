import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ClipboardList, AlertTriangle, User, MapPin, CornerDownLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mapTask, mapIncident, mapProfile } from '../lib/mappers';
import { formatIncidentType } from '../lib/incidentTypes';
import type { Task, Incident, User as UserType, Range } from '../types';

interface Ranked {
  kind: 'task' | 'incident' | 'user' | 'range' | 'status';
  id: string;
  title: string;
  meta: string;
  onSelect: () => void;
}

const STATUS_SHORTCUTS: { match: string[]; label: string; view: string }[] = [
  { match: ['overdue'], label: 'Overdue tasks', view: 'view=overdue' },
  { match: ['awaiting review', 'review'], label: 'Tasks awaiting review', view: 'view=review' },
  { match: ['in progress'], label: 'Tasks in progress', view: 'status=InProgress' },
  { match: ['not started'], label: 'Tasks not started', view: 'status=NotStarted' },
  { match: ['completed', 'closed'], label: 'Completed tasks', view: 'status=Archived' },
  { match: ['critical'], label: 'Critical-priority tasks', view: 'priority=Critical' },
];

export default function GlobalSearch({ base }: { base: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<Ranked[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Ctrl/Cmd+K or "/" focuses search (ignored while typing elsewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const [taskRes, incidentRes, userRes, rangeRes] = await Promise.all([
          supabase.from('tasks').select('*').ilike('title', `%${q}%`).limit(5),
          supabase.from('incidents').select('*').or(`description.ilike.%${q}%,type.ilike.%${q}%`).limit(5),
          supabase.from('profiles').select('*').ilike('name', `%${q}%`).limit(5),
          supabase.from('ranges').select('*').ilike('name', `%${q}%`).limit(5),
        ]);

        const ranked: Ranked[] = [];

        const lower = q.toLowerCase();
        for (const s of STATUS_SHORTCUTS) {
          if (s.match.some((m) => m.includes(lower) || lower.includes(m))) {
            ranked.push({ kind: 'status', id: s.view, title: s.label, meta: 'Status filter', onSelect: () => navigate(`${base}/tasks?${s.view}`) });
          }
        }

        if (!taskRes.error && taskRes.data) {
          for (const row of taskRes.data) {
            const t: Task = mapTask(row);
            ranked.push({ kind: 'task', id: t.id, title: t.title, meta: `${t.status === 'InProgress' ? 'In progress' : t.status === 'NotStarted' ? 'Not started' : t.status} · Due ${new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, onSelect: () => navigate(`${base}/tasks/${t.id}`) });
          }
        }
        if (!incidentRes.error && incidentRes.data) {
          for (const row of incidentRes.data) {
            const inc: Incident = mapIncident(row);
            ranked.push({ kind: 'incident', id: inc.id, title: formatIncidentType(inc), meta: `${inc.severity} severity`, onSelect: () => navigate(`${base}/incidents?q=${encodeURIComponent(q)}`) });
          }
        }
        if (!userRes.error && userRes.data) {
          for (const row of userRes.data) {
            const u: UserType = mapProfile(row);
            ranked.push({ kind: 'user', id: u.id, title: u.name, meta: u.designation || u.role, onSelect: () => navigate(`${base}/tasks?q=${encodeURIComponent(u.name)}`) });
          }
        }
        if (!rangeRes.error && rangeRes.data) {
          for (const row of rangeRes.data as Range[]) {
            ranked.push({ kind: 'range', id: row.id, title: row.name, meta: 'Range', onSelect: () => navigate(`${base}/tasks?range=${row.id}`) });
          }
        }

        setResults(ranked);
        setActiveIndex(0);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, base, navigate]);

  const groups: { kind: Ranked['kind']; label: string; icon: React.ReactNode }[] = [
    { kind: 'status', label: 'Filters', icon: <Search className="w-3.5 h-3.5" /> },
    { kind: 'task', label: 'Tasks', icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { kind: 'incident', label: 'Incidents', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { kind: 'user', label: 'Personnel', icon: <User className="w-3.5 h-3.5" /> },
    { kind: 'range', label: 'Ranges', icon: <MapPin className="w-3.5 h-3.5" /> },
  ];
  const flatOrder = groups.flatMap((g) => results.filter((r) => r.kind === g.kind));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || flatOrder.length === 0) {
      if (e.key === 'Enter') { e.preventDefault(); navigate(`${base}/tasks${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`); setOpen(false); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, flatOrder.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = flatOrder[activeIndex]; if (r) { r.onSelect(); setOpen(false); setQuery(''); } }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 peer-focus:text-n-70 z-10" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder="Search tasks, incidents, personnel and ranges"
        aria-label="Search tasks, incidents, personnel and ranges"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
        autoComplete="off"
        className="peer w-full h-8 pl-8 pr-12 rounded bg-white/12 hover:bg-white/16 focus:bg-white text-13 text-white focus:text-n-100 placeholder:text-white/60 focus:placeholder:text-n-70 focus:outline-none focus:ring-2 focus:ring-white/40 transition-colors"
        style={{ fontSize: '16px' }}
      />
      <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 px-1.5 h-5 rounded border border-white/25 peer-focus:border-n-30 text-[10px] font-medium text-white/60 peer-focus:text-n-60 pointer-events-none select-none z-10">
        Ctrl K
      </kbd>

      {open && (
        <div id="global-search-results" role="listbox" className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-md shadow-pop border border-n-30 py-1.5 max-h-[70vh] overflow-y-auto z-50 animate-slide-down">
          {loading && results.length === 0 ? (
            <div className="px-3 py-6 text-center text-13 text-n-70">Searching…</div>
          ) : flatOrder.length === 0 ? (
            <div className="px-3 py-6 text-center text-13 text-n-70">No results for "{query}"</div>
          ) : (
            groups.map((g) => {
              const items = results.filter((r) => r.kind === g.kind);
              if (items.length === 0) return null;
              return (
                <div key={g.kind} className="mb-1 last:mb-0">
                  <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-n-70 flex items-center gap-1.5">{g.icon}{g.label}</div>
                  {items.map((r) => {
                    const idx = flatOrder.indexOf(r);
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={`${r.kind}-${r.id}`}
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => { r.onSelect(); setOpen(false); setQuery(''); }}
                        className={`w-full flex items-center justify-between gap-3 px-3 h-9 text-left transition-colors ${active ? 'bg-n-20' : 'hover:bg-n-10'}`}
                      >
                        <span className="text-13 text-n-100 truncate">{r.title}</span>
                        <span className="text-xs text-n-70 flex-shrink-0 flex items-center gap-1">
                          {r.meta}
                          {active && <CornerDownLeft className="w-3 h-3 text-n-50" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mapTask, mapIncident, mapProfile } from '../lib/mappers';
import { formatIncidentType } from '../lib/incidentTypes';
import type { Task, Incident, User as UserType, Range } from '../types';

export interface SearchResult {
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

export const SEARCH_GROUPS: { kind: SearchResult['kind']; label: string }[] = [
  { kind: 'status', label: 'Filters' },
  { kind: 'task', label: 'Tasks' },
  { kind: 'incident', label: 'Incidents' },
  { kind: 'user', label: 'Personnel' },
  { kind: 'range', label: 'Ranges' },
];

// Shared across the desktop header dropdown and the mobile full-screen
// search overlay — same debounce, same grouping/ranking, same status-term
// shortcuts, so both surfaces stay behaviourally identical.
export function useGlobalSearchResults(base: string, query: string) {
  const navigate = useNavigate();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const [taskRes, incidentRes, userRes, rangeRes] = await Promise.all([
          supabase.from('tasks').select('*').ilike('title', `%${q}%`).limit(5),
          supabase.from('incidents').select('*').or(`description.ilike.%${q}%,type.ilike.%${q}%`).limit(5),
          supabase.from('profiles').select('*').ilike('name', `%${q}%`).limit(5),
          supabase.from('ranges').select('*').ilike('name', `%${q}%`).limit(5),
        ]);

        const ranked: SearchResult[] = [];
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
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, base, navigate]);

  return { results, loading };
}

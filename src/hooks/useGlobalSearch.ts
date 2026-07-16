import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatIncidentType } from '../lib/incidentTypes';
import { formatShortDate } from '../utils/formatters';

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
          supabase.from('tasks').select('id, title, status, due_date').ilike('title', `%${q}%`).limit(5),
          supabase.from('incidents').select('id, type, type_other, severity').or(`description.ilike.%${q}%,type.ilike.%${q}%`).limit(5),
          supabase.from('profiles').select('id, name, designation, role').ilike('name', `%${q}%`).limit(5),
          supabase.from('ranges').select('id, name').ilike('name', `%${q}%`).limit(5),
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
            const statusLabel = row.status === 'InProgress' ? 'In progress' : row.status === 'NotStarted' ? 'Not started' : row.status;
            ranked.push({ kind: 'task', id: row.id, title: row.title, meta: `${statusLabel} · Due ${formatShortDate(new Date(row.due_date))}`, onSelect: () => navigate(`${base}/tasks/${row.id}`) });
          }
        }
        if (!incidentRes.error && incidentRes.data) {
          for (const row of incidentRes.data) {
            const title = formatIncidentType({ type: row.type, typeOther: row.type_other ?? undefined });
            ranked.push({ kind: 'incident', id: row.id, title, meta: `${row.severity} severity`, onSelect: () => navigate(`${base}/incidents?q=${encodeURIComponent(q)}`) });
          }
        }
        if (!userRes.error && userRes.data) {
          for (const row of userRes.data) {
            ranked.push({ kind: 'user', id: row.id, title: row.name, meta: row.designation || row.role, onSelect: () => navigate(`${base}/tasks?q=${encodeURIComponent(row.name)}`) });
          }
        }
        if (!rangeRes.error && rangeRes.data) {
          for (const row of rangeRes.data) {
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

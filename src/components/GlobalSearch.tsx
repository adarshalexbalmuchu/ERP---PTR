import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ClipboardList, AlertTriangle, User, MapPin, CornerDownLeft } from 'lucide-react';
import { useGlobalSearchResults, SEARCH_GROUPS, type SearchResult } from '../hooks/useGlobalSearch';

const GROUP_ICON: Record<SearchResult['kind'], React.ReactNode> = {
  status: <Search className="w-3.5 h-3.5" />,
  task: <ClipboardList className="w-3.5 h-3.5" />,
  incident: <AlertTriangle className="w-3.5 h-3.5" />,
  user: <User className="w-3.5 h-3.5" />,
  range: <MapPin className="w-3.5 h-3.5" />,
};

export default function GlobalSearch({ base }: { base: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const { results, loading } = useGlobalSearchResults(base, query);

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
    setActiveIndex(0);
    if (query.trim().length >= 2) setOpen(true);
    else setOpen(false);
  }, [query, results]);

  const flatOrder = SEARCH_GROUPS.flatMap((g) => results.filter((r) => r.kind === g.kind));

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
            SEARCH_GROUPS.map((g) => {
              const items = results.filter((r) => r.kind === g.kind);
              if (items.length === 0) return null;
              return (
                <div key={g.kind} className="mb-1 last:mb-0">
                  <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-n-70 flex items-center gap-1.5">{GROUP_ICON[g.kind]}{g.label}</div>
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

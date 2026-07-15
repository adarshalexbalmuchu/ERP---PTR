import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, X, ClipboardList, AlertTriangle, User, MapPin } from 'lucide-react';
import { useGlobalSearchResults, SEARCH_GROUPS, type SearchResult } from '../../hooks/useGlobalSearch';

const GROUP_ICON: Record<SearchResult['kind'], React.ReactNode> = {
  status: <Search className="w-4 h-4" />,
  task: <ClipboardList className="w-4 h-4" />,
  incident: <AlertTriangle className="w-4 h-4" />,
  user: <User className="w-4 h-4" />,
  range: <MapPin className="w-4 h-4" />,
};

export default function MobileSearchOverlay({ base, onClose }: { base: string; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, loading } = useGlobalSearchResults(base, query);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const flatOrder = SEARCH_GROUPS.flatMap((g) => results.filter((r) => r.kind === g.kind));

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-2 px-2 h-14 border-b border-n-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full text-n-90" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-n-70" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, incidents, personnel…"
            className="input-field pl-9 pr-9 !min-h-[40px]"
            style={{ fontSize: '16px' }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-n-60" aria-label="Clear">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.trim().length < 2 ? (
          <div className="px-4 py-10 text-center text-13 text-n-70">Type at least 2 characters to search.</div>
        ) : loading && results.length === 0 ? (
          <div className="px-4 py-10 text-center text-13 text-n-70">Searching…</div>
        ) : flatOrder.length === 0 ? (
          <div className="px-4 py-10 text-center text-13 text-n-70">No results for "{query}"</div>
        ) : (
          SEARCH_GROUPS.map((g) => {
            const items = results.filter((r) => r.kind === g.kind);
            if (items.length === 0) return null;
            return (
              <div key={g.kind}>
                <div className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-n-70 bg-n-10 flex items-center gap-1.5">{GROUP_ICON[g.kind]}{g.label}</div>
                {items.map((r) => (
                  <button
                    key={`${r.kind}-${r.id}`}
                    onClick={() => { r.onSelect(); onClose(); }}
                    className="w-full flex items-center justify-between gap-3 px-4 h-14 text-left border-b border-n-20 active:bg-n-10"
                  >
                    <span className="text-[15px] text-n-100 truncate">{r.title}</span>
                    <span className="text-13 text-n-70 flex-shrink-0">{r.meta}</span>
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

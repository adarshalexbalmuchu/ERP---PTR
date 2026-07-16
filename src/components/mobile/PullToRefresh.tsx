import { useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 64;

// Touch-tracked pull-to-refresh for a mobile list. `<main>` in MobileShell
// is the single scroll owner for every mobile page (see that component) —
// this no longer scrolls itself, it just watches the nearest `<main>`
// ancestor's scrollTop to decide whether a downward drag should engage the
// pull gesture (only at the very top) or fall through to a normal scroll.
// `onRefresh` should resolve once the refetch completes.
export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const dragging = useRef(false);

  const scrollOwner = () => wrapperRef.current?.closest('main');

  const onTouchStart = (e: React.TouchEvent) => {
    if ((scrollOwner()?.scrollTop ?? 0) > 0) { dragging.current = false; return; }
    startY.current = e.touches[0].clientY;
    dragging.current = true;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) { setPull(0); return; }
    setPull(Math.min(delta * 0.5, 100));
  };
  const onTouchEnd = async () => {
    dragging.current = false;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try { await onRefresh(); } finally { setRefreshing(false); setPull(0); }
    } else {
      setPull(0);
    }
  };

  return (
    <div
      ref={wrapperRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: pull }}
      >
        <RefreshCw className={`w-5 h-5 text-ptr-green ${refreshing || pull >= THRESHOLD ? 'animate-spin' : ''}`} style={{ opacity: Math.min(pull / THRESHOLD, 1) }} />
      </div>
      {children}
    </div>
  );
}

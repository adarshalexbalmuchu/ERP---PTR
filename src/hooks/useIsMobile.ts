import { useEffect, useState } from 'react';

// Matches the 768px breakpoint used throughout the mobile-first field UI —
// below this, pages render the compact bottom-nav shell / stacked cards /
// full-screen flows instead of the desktop layout. Reactive to viewport
// changes (tablet rotation, browser resize) via matchMedia rather than a
// one-off window.innerWidth check.
const QUERY = '(max-width: 767px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

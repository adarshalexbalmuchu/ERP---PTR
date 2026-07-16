import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { lockBodyScroll } from '../utils/scrollLock';

// Single coordinator for every blocking mobile overlay (More, Help, filter
// sheets, sync details, map marker/nearby panels, ...) so opening one always
// closes whichever was open before, instead of letting the app accumulate
// stacked sheets/popups with no shared notion of "what's on top".
export type MobileOverlayId =
  | 'more' | 'help' | 'filters' | 'nearby-expanded' | 'marker-popup'
  | 'incident-preview' | 'sync-details' | 'evidence';

interface MobileOverlayContextValue {
  active: MobileOverlayId | null;
  /** Opens `id`, replacing whatever overlay was previously active. Pass the
      trigger element so focus can return to it once the overlay closes. */
  open: (id: MobileOverlayId, trigger?: HTMLElement | null) => void;
  /** Closes the active overlay. If `id` is given, only closes when that
      overlay is actually the one currently open (a safe no-op otherwise —
      lets an unmounting component call this without checking first). */
  close: (id?: MobileOverlayId) => void;
  isOpen: (id: MobileOverlayId) => boolean;
}

const MobileOverlayContext = createContext<MobileOverlayContextValue | null>(null);

export function MobileOverlayProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<MobileOverlayId | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  // Tracks whether the currently-open overlay pushed a history entry, so we
  // only pop it (rather than double-popping) when closed via close()/Escape
  // rather than the Back gesture that already popped it for us.
  const pushedHistoryRef = useRef(false);

  const close = useCallback((id?: MobileOverlayId) => {
    setActive((current) => {
      if (id && current !== id) return current;
      if (current !== null && pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        history.back();
      }
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (trigger) window.requestAnimationFrame(() => trigger.focus());
      return null;
    });
  }, []);

  const open = useCallback((id: MobileOverlayId, trigger?: HTMLElement | null) => {
    triggerRef.current = trigger ?? null;
    history.pushState({ mobileOverlay: id }, '');
    pushedHistoryRef.current = true;
    setActive(id);
  }, []);

  // Android/browser Back closes the topmost overlay instead of navigating
  // away from the page underneath it.
  useEffect(() => {
    const onPopState = () => {
      pushedHistoryRef.current = false;
      setActive(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Escape closes the topmost overlay everywhere, without every consumer
  // needing its own listener.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);

  // Lock background scrolling only while a blocking overlay is open, and
  // restore the exact scroll position of <main> afterwards. Uses the
  // position:fixed body-lock technique (not a bare overflow:hidden) — iOS
  // Safari has a known bug where position:fixed descendants (like the sheet
  // itself) stop receiving touch events when scroll is locked via
  // overflow:hidden alone, even though everything still renders correctly.
  useEffect(() => {
    const main = document.querySelector('main');
    if (!active) return;
    const scrollTop = main?.scrollTop ?? 0;
    const unlock = lockBodyScroll();
    return () => {
      unlock();
      if (main) main.scrollTop = scrollTop;
    };
  }, [active]);

  const isOpen = useCallback((id: MobileOverlayId) => active === id, [active]);

  return (
    <MobileOverlayContext.Provider value={{ active, open, close, isOpen }}>
      {children}
    </MobileOverlayContext.Provider>
  );
}

// Fails soft (a local boolean fallback is used by callers) rather than
// throwing, so a component can still work in isolation/tests without the
// provider mounted.
export function useMobileOverlay(): MobileOverlayContextValue | null {
  return useContext(MobileOverlayContext);
}

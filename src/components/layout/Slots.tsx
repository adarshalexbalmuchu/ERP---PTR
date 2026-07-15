import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// The Fluent shell exposes two fixed regions that page content fills:
//   • the command bar (contextual actions, top-right of the workspace)
//   • the contextual navigation panel (section-specific views/filters, left)
// Pages render <CommandBar>…</CommandBar> / <ContextPanel>…</ContextPanel>
// anywhere in their tree; the content is portalled into the chrome via DOM
// slots, so page state stays local (no context re-registration churn).

interface SlotValue {
  commandEl: HTMLElement | null;
  panelEl: HTMLElement | null;
  setCommandEl: (el: HTMLElement | null) => void;
  setPanelEl: (el: HTMLElement | null) => void;
}

const SlotContext = createContext<SlotValue | null>(null);

export function SlotProvider({ children }: { children: ReactNode }) {
  const [commandEl, setCommandEl] = useState<HTMLElement | null>(null);
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null);
  return (
    <SlotContext.Provider value={{ commandEl, panelEl, setCommandEl, setPanelEl }}>
      {children}
    </SlotContext.Provider>
  );
}

// Fails soft (returns null) rather than throwing when there's no provider —
// a page written for the desktop admin shell (which always wraps
// SlotProvider) can still mount under the mobile shell (which doesn't; it
// has no command bar/contextual panel to portal into) without crashing the
// whole route. Pages should still add a proper mobile branch where the
// slot content actually matters, but a missed one degrades gracefully
// instead of white-screening.
function useSlots(): SlotValue | null {
  return useContext(SlotContext);
}

/** Registers the DOM node the command bar renders into (used by the shell). */
export function CommandBarSlot({ className }: { className?: string }) {
  const ctx = useSlots();
  if (!ctx) return null;
  return <div ref={ctx.setCommandEl} className={className} />;
}

/** Registers the DOM node the contextual panel renders into (used by the shell). */
export function ContextPanelSlot({ className }: { className?: string }) {
  const ctx = useSlots();
  if (!ctx) return null;
  return <div ref={ctx.setPanelEl} className={className} />;
}

/** Page-side: portal action buttons into the workspace command bar. */
export function CommandBar({ children }: { children: ReactNode }) {
  const ctx = useSlots();
  if (!ctx?.commandEl) return null;
  return createPortal(children, ctx.commandEl);
}

/** Page-side: portal views/filters into the contextual navigation panel. */
export function ContextPanel({ children }: { children: ReactNode }) {
  const ctx = useSlots();
  if (!ctx?.panelEl) return null;
  return createPortal(children, ctx.panelEl);
}

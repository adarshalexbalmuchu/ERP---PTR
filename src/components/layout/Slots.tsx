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

function useSlots() {
  const ctx = useContext(SlotContext);
  if (!ctx) throw new Error('Slot components must render inside <SlotProvider>');
  return ctx;
}

/** Registers the DOM node the command bar renders into (used by the shell). */
export function CommandBarSlot({ className }: { className?: string }) {
  const { setCommandEl } = useSlots();
  return <div ref={setCommandEl} className={className} />;
}

/** Registers the DOM node the contextual panel renders into (used by the shell). */
export function ContextPanelSlot({ className }: { className?: string }) {
  const { setPanelEl } = useSlots();
  return <div ref={setPanelEl} className={className} />;
}

/** Page-side: portal action buttons into the workspace command bar. */
export function CommandBar({ children }: { children: ReactNode }) {
  const { commandEl } = useSlots();
  if (!commandEl) return null;
  return createPortal(children, commandEl);
}

/** Page-side: portal views/filters into the contextual navigation panel. */
export function ContextPanel({ children }: { children: ReactNode }) {
  const { panelEl } = useSlots();
  if (!panelEl) return null;
  return createPortal(children, panelEl);
}

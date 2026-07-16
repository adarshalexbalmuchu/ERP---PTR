import { createContext, useContext } from 'react';

// Lets a page's command bar (rendered through the CommandBarSlot portal, far
// from AdminLayout in the tree) drive the same collapsible filter panel that
// AdminLayout already owns — so a page-level "Filter" button can open/close
// it without duplicating any filter UI.
export interface PanelToggle {
  collapsed: boolean;
  toggle: () => void;
}

export const PanelToggleContext = createContext<PanelToggle | null>(null);

export function usePanelToggle(): PanelToggle | null {
  return useContext(PanelToggleContext);
}

// Shared z-index scale for every layer that stacks above normal page
// content. Keeping these in one place is what makes "modals always beat
// dropdowns, toasts always beat modals" true everywhere instead of being an
// accident of DOM order.
export const Z = {
  header: 100,
  commandBar: 200,
  dropdown: 1000,
  popover: 1100,
  modalBackdrop: 1900,
  modal: 2000,
  toast: 3000,
} as const;

const EDGE_PADDING = 10;

/** Positions a floating panel under its trigger, flipping above when there's
    more room there and it doesn't fit below, then clamps the result inside
    the viewport with EDGE_PADDING on every side. Used by every portaled
    dropdown/select/popover so they behave identically near screen edges. */
export function computeFloatingPosition(
  trigger: DOMRect,
  content: { width: number; height: number },
  align: 'left' | 'right' = 'left',
  gap = 4,
): { top: number; left: number } {
  const spaceBelow = window.innerHeight - trigger.bottom;
  const spaceAbove = trigger.top;
  const flipAbove = content.height + gap + EDGE_PADDING > spaceBelow && spaceAbove > spaceBelow;
  let top = flipAbove ? trigger.top - content.height - gap : trigger.bottom + gap;
  top = Math.min(Math.max(top, EDGE_PADDING), Math.max(EDGE_PADDING, window.innerHeight - content.height - EDGE_PADDING));

  let left = align === 'right' ? trigger.right - content.width : trigger.left;
  left = Math.min(Math.max(left, EDGE_PADDING), Math.max(EDGE_PADDING, window.innerWidth - content.width - EDGE_PADDING));

  return { top, left };
}

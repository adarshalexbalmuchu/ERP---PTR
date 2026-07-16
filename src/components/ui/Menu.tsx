import { createContext, useContext, useLayoutEffect, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { computeFloatingPosition, Z } from '../../lib/floating';

// A compact Fluent-style dropdown used for command-bar overflow, bulk-action
// pickers and row menus. Portaled to document.body so it's never clipped by
// an ancestor's overflow/transform, positioned with viewport collision
// detection (flips above the trigger when there's no room below), and closes
// on outside-click, Escape, or item activation.

const MenuCloseContext = createContext<() => void>(() => {});

export function Menu({
  button,
  buttonClassName = 'btn-subtle',
  ariaLabel,
  align = 'left',
  width = 'w-56',
  children,
}: {
  button: ReactNode;
  buttonClassName?: string;
  ariaLabel?: string;
  align?: 'left' | 'right';
  width?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const update = () => {
      if (!triggerRef.current || !menuRef.current) return;
      const t = triggerRef.current.getBoundingClientRect();
      const c = menuRef.current.getBoundingClientRect();
      setPos(computeFloatingPosition(t, { width: c.width, height: c.height }, align));
    };
    update();
    const ro = new ResizeObserver(update);
    if (menuRef.current) ro.observe(menuRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden', zIndex: Z.dropdown }}
          className={`${width} max-h-[70vh] overflow-y-auto bg-white rounded-md shadow-pop border border-n-30 py-1 animate-slide-down`}
        >
          <MenuCloseContext.Provider value={() => setOpen(false)}>{children}</MenuCloseContext.Provider>
        </div>,
        document.body,
      )}
    </>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-n-70">{children}</div>;
}

export function MenuDivider() {
  return <div className="my-1 border-t border-n-30" />;
}

export function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
  keepOpen = false,
  title,
}: {
  icon?: ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  keepOpen?: boolean;
  /** Tooltip shown on hover/focus — mainly for explaining why a disabled item is disabled. */
  title?: string;
}) {
  const close = useContext(MenuCloseContext);
  return (
    <button
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={() => { onClick?.(); if (!keepOpen) close(); }}
      className={`w-full flex items-center gap-2.5 px-3 h-8 text-13 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? 'text-signal-red hover:bg-signal-red-bg' : 'text-n-90 hover:bg-n-20'
      }`}
    >
      {icon && <span className={danger ? 'text-signal-red' : 'text-n-70'}>{icon}</span>}
      <span className="flex-1">{label}</span>
    </button>
  );
}

/** Arbitrary content inside the menu (e.g. a date input) without closing. */
export function MenuPanel({ children }: { children: ReactNode }) {
  return <div className="px-3 py-2">{children}</div>;
}

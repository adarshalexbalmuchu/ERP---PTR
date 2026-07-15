import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

// A compact Fluent-style dropdown used for command-bar overflow, bulk-action
// pickers and row menus. Closes on outside-click, Escape, or item activation.

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full mt-1 ${align === 'right' ? 'right-0' : 'left-0'} ${width} bg-white rounded-md shadow-pop border border-n-30 py-1 z-50 animate-slide-down`}
        >
          <MenuCloseContext.Provider value={() => setOpen(false)}>{children}</MenuCloseContext.Provider>
        </div>
      )}
    </div>
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
}: {
  icon?: ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  keepOpen?: boolean;
}) {
  const close = useContext(MenuCloseContext);
  return (
    <button
      role="menuitem"
      disabled={disabled}
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

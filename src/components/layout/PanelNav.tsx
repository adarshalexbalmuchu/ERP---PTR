import type { ReactNode } from 'react';

/** Muted uppercase group label inside the contextual panel. */
export function PanelSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      {label && <div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-n-70">{label}</div>}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/** A single contextual-nav row — a filter/view link, not a section anchor. */
export function PanelItem({
  label,
  icon,
  active = false,
  count,
  countTone = 'default',
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  count?: number;
  countTone?: 'default' | 'red' | 'amber';
  onClick: () => void;
}) {
  const countClass =
    countTone === 'red' ? 'text-signal-red' : countTone === 'amber' ? 'text-signal-amber' : 'text-n-70';
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={`group w-full flex items-center gap-2.5 px-2.5 h-8 rounded text-13 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ptr-accent/40 ${
        active ? 'bg-ptr-green/10 text-ptr-green font-semibold' : 'text-n-90 hover:bg-n-20'
      }`}
    >
      {icon && <span className={`flex-shrink-0 ${active ? 'text-ptr-green' : 'text-n-70 group-hover:text-n-90'}`}>{icon}</span>}
      <span className="flex-1 text-left truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`text-xs font-semibold tabular-nums ${active ? 'text-ptr-green' : countClass}`}>{count}</span>
      )}
    </button>
  );
}

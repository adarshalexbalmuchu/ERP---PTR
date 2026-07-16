interface Chip {
  id: string;
  label: string;
  count?: number;
}

export default function FilterChips({
  chips,
  active,
  onChange,
}: {
  chips: Chip[];
  active: string;
  onChange: (id: string) => void;
}) {
  // The scrollable row lives inside an overflow-hidden, width-capped wrapper
  // so its own content can never inflate the page's scrollWidth — no
  // negative-margin "bleed" that isn't cancelled by a matching parent
  // padding (that was making the whole page ~16px wider than the viewport
  // on every screen under 768px). Left/right inset comes from padding on
  // the scrollable row itself, not from bleeding past the wrapper.
  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <div
        className="flex gap-2 overflow-x-auto overscroll-x-contain whitespace-nowrap px-4 py-2.5"
        style={{ scrollbarWidth: 'none' }}
      >
        {chips.map((chip) => {
          const isActive = chip.id === active;
          return (
            <button
              key={chip.id}
              onClick={() => onChange(chip.id)}
              aria-pressed={isActive}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-13 font-medium whitespace-nowrap transition-colors ${
                isActive ? 'bg-ptr-green text-white' : 'bg-n-20 text-n-90'
              }`}
            >
              {chip.label}
              {!!chip.count && (
                <span className={`text-xs font-semibold tabular-nums ${isActive ? 'text-white/90' : 'text-n-70'}`}>{chip.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

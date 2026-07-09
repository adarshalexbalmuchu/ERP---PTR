import { useEffect, useRef, useState, Children, isValidElement, type ReactNode, type ReactElement } from 'react';
import { ChevronDown } from 'lucide-react';

interface FlatOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Group {
  label?: string;
  options: FlatOption[];
}

// Reads a plain <option>/<optgroup> children tree — exactly what you'd pass
// to a native <select> — into groups, so callers can swap the `<select>` tag
// for `<Select>` without touching their existing option markup at all.
function readGroups(children: ReactNode): Group[] {
  const ungrouped: FlatOption[] = [];
  const groups: Group[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === 'optgroup') {
      const el = child as ReactElement<{ label?: string; children?: ReactNode }>;
      const options: FlatOption[] = [];
      Children.forEach(el.props.children, (opt) => {
        if (!isValidElement(opt)) return;
        const o = opt as ReactElement<{ value?: string; children?: ReactNode; disabled?: boolean }>;
        options.push({
          value: String(o.props.value ?? ''),
          label: typeof o.props.children === 'string' ? o.props.children : String(o.props.children ?? ''),
          disabled: o.props.disabled,
        });
      });
      groups.push({ label: el.props.label, options });
    } else if (child.type === 'option') {
      const o = child as ReactElement<{ value?: string; children?: ReactNode; disabled?: boolean }>;
      ungrouped.push({
        value: String(o.props.value ?? ''),
        label: typeof o.props.children === 'string' ? o.props.children : String(o.props.children ?? ''),
        disabled: o.props.disabled,
      });
    }
  });

  if (ungrouped.length > 0) groups.unshift({ options: ungrouped });
  return groups;
}

interface SelectProps {
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

// Drop-in replacement for a native <select> — same value/onChange/children
// shape, so existing call sites only need `<select>` renamed to `<Select>`.
//
// A native <select>'s popup direction (opening above vs. below the trigger)
// is decided entirely by the browser/OS based on viewport space, with no way
// for page CSS/JS to override it — on a phone, a field anywhere near the
// bottom half of the screen routinely pops its options upward, covering
// whatever's above it. This renders its own option list instead, always
// positioned below the trigger, so the direction is predictable everywhere.
export default function Select({ value, onChange, children, className = '', disabled, id, ...aria }: SelectProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const groups = readGroups(children);
  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // `select-field` painted a CSS background-image chevron on the native
  // element; this component renders its own chevron icon unconditionally
  // (including for callers that never had that class), so it's stripped
  // here to avoid drawing two arrows on top of each other.
  const cleanedClassName = className.replace(/\bselect-field\b/g, '').trim();

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        id={id}
        aria-label={aria['aria-label']}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        className={`${cleanedClassName} relative text-left pr-9 truncate disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {selected?.label ?? ''}
        <ChevronDown
          className={`w-4 h-4 text-ptr-brown-light absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-ptr-cream-dark rounded-xl shadow-lg">
          {groups.map((g, gi) => (
            <div key={g.label ?? `_${gi}`}>
              {g.label && (
                <div className="sticky top-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ptr-brown-light bg-ptr-cream/80">
                  {g.label}
                </div>
              )}
              {g.options.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  disabled={o.disabled}
                  onClick={() => { onChange({ target: { value: o.value } }); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-ptr-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    o.value === value ? 'bg-ptr-green/5 text-ptr-green font-medium' : 'text-ptr-brown'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// A small, generic tab strip — searched the codebase first (Menu.tsx,
// TaskTable.tsx, PanelNav.tsx) and nothing already provides this shape, so
// this is a genuinely new, reusable primitive rather than a duplicate.
// Used by both the desktop Task Group/Occurrence detail pages and the
// mobile equivalents (horizontally scrollable on narrow screens).
export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-n-30 overflow-x-auto" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 h-10 text-13 font-medium border-b-2 -mb-px transition-colors ${
              isActive ? 'border-ptr-green text-ptr-green' : 'border-transparent text-n-70 hover:text-n-100'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-[11px] font-semibold rounded-full px-1.5 min-w-[18px] text-center ${isActive ? 'bg-ptr-green/10 text-ptr-green' : 'bg-n-20 text-n-70'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

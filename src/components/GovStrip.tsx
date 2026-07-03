import jharkhandEmblem from '../assets/jharkhand-emblem.png';

export default function GovStrip() {
  return (
    <div className="bg-ptr-green flex-shrink-0">
      <div className="px-4 md:px-6 py-2 flex items-center justify-between text-white">
        <span className="flex items-center gap-2.5 min-w-0">
          <img src={jharkhandEmblem} alt="" className="w-6 h-6 flex-shrink-0" />
          <span className="text-[13px] font-bold tracking-[0.06em] uppercase whitespace-nowrap">
            Government of Jharkhand
          </span>
          <span className="hidden lg:inline text-xs text-white/70 border-l border-white/25 pl-2.5 ml-0.5 truncate">
            Department of Forest, Environment &amp; Climate Change
          </span>
        </span>
        <span className="hidden sm:inline text-[10px] uppercase tracking-[0.1em] text-white/50 flex-shrink-0">
          Authorized Personnel Only
        </span>
      </div>
    </div>
  );
}

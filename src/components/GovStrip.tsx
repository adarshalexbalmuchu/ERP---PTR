import jharkhandEmblem from '../assets/jharkhand-emblem.png';

export default function GovStrip() {
  return (
    <div className="bg-ptr-green flex-shrink-0">
      <div className="px-4 md:px-6 py-1 flex items-center gap-2 justify-between text-white">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide">
          <img src={jharkhandEmblem} alt="" className="w-3.5 h-3.5 flex-shrink-0" />
          Government of Jharkhand
        </span>
        <span className="hidden sm:inline text-xs text-white/75">
          Department of Forest, Environment &amp; Climate Change
        </span>
      </div>
    </div>
  );
}

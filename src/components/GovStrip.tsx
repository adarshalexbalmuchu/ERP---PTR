import jharkhandEmblem from '../assets/jharkhand-emblem.png';

export default function GovStrip() {
  return (
    <div className="bg-ptr-green flex-shrink-0">
      <div className="relative px-4 md:px-6 py-2 flex items-center justify-center text-white">
        <span className="flex items-center gap-2 text-sm font-bold tracking-wide">
          <img src={jharkhandEmblem} alt="" className="w-6 h-6 flex-shrink-0" />
          Government of Jharkhand
        </span>
        <span className="hidden sm:inline absolute right-4 md:right-6 text-xs text-white/75">
          Department of Forest, Environment &amp; Climate Change
        </span>
      </div>
    </div>
  );
}

import { TreePine } from 'lucide-react';

interface Props {
  compact?: boolean;
}

export default function GovHeader({ compact = false }: Props) {
  return (
    <div className="bg-white border-b border-ptr-cream-dark">
      {/* Official strip */}
      <div className="bg-ptr-green">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-1.5 flex items-center justify-between text-white">
          <span className="text-xs font-semibold tracking-wide">Government of Jharkhand</span>
          <span className="hidden sm:inline text-xs text-white/75">
            Department of Forest, Environment &amp; Climate Change
          </span>
        </div>
      </div>

      {/* Emblem + title */}
      <div className={`max-w-6xl mx-auto px-4 md:px-6 flex items-center gap-4 ${compact ? 'py-2.5' : 'py-4'}`}>
        <div
          className={`rounded-full border-2 border-ptr-green/15 bg-ptr-cream flex items-center justify-center flex-shrink-0 ${
            compact ? 'w-10 h-10' : 'w-14 h-14'
          }`}
        >
          <TreePine className={compact ? 'w-5 h-5 text-ptr-green' : 'w-7 h-7 text-ptr-green'} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h1 className={`font-bold text-ptr-brown tracking-tight leading-tight ${compact ? 'text-sm' : 'text-lg md:text-xl'}`}>
            Palamu Tiger Reserve
          </h1>
          <p className={`text-ptr-brown-light font-medium ${compact ? 'text-xs' : 'text-xs md:text-sm'}`}>
            Tiger Cell &middot; Task Management System
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Caps sheet height so a long list still leaves the scrim tappable to dismiss. */
  maxHeight?: string;
}

// Native-feeling bottom sheet: slides up from the bottom edge, drag-down-to-
// dismiss via a touch-tracked handle, backdrop tap/Escape also close it.
// Used for "More", advanced filters, and evidence capture on mobile.
export default function BottomSheet({ open, onClose, title, children, maxHeight = '85dvh' }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; currentY: number; dragging: boolean }>({ startY: 0, currentY: 0, dragging: false });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    dragState.current = { startY: e.touches[0].clientY, currentY: e.touches[0].clientY, dragging: true };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragState.current.dragging) return;
    dragState.current.currentY = e.touches[0].clientY;
    const delta = Math.max(0, dragState.current.currentY - dragState.current.startY);
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${delta}px)`;
  };
  const onTouchEnd = () => {
    const delta = dragState.current.currentY - dragState.current.startY;
    dragState.current.dragging = false;
    if (sheetRef.current) sheetRef.current.style.transform = '';
    if (delta > 90) onClose();
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/30" style={{ animation: 'fadeIn 0.15s ease-out' }} onClick={onClose} />
      <div
        ref={sheetRef}
        className="absolute left-0 right-0 bottom-0 bg-white rounded-t-xl shadow-pop flex flex-col animate-sheet-up"
        style={{ maxHeight, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div
          className="flex-shrink-0 flex flex-col items-center pt-2 pb-1 touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="w-9 h-1 rounded-full bg-n-40" aria-hidden="true" />
        </div>
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 pb-2 pt-1 border-b border-n-30">
            <h2 className="text-base font-semibold text-n-100">{title}</h2>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded text-n-70 hover:bg-n-20 transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

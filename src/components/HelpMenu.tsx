import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, ChevronLeft, ChevronRight, Mail, Info } from 'lucide-react';
import { Z } from '../lib/floating';
import { HELP_TOPICS, HELP_ABOUT_BODY, SUPPORT_MAILTO } from '../lib/helpContent';

export default function HelpMenu() {
  const [open, setOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number }>({ top: 0, right: 8 });

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPanelPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const close = () => { setOpen(false); setActiveTopic(null); triggerRef.current?.focus(); };
  const topicLabel = activeTopic === 'about' ? 'About this system' : HELP_TOPICS.find((t) => t.id === activeTopic)?.label;
  const topicBody = activeTopic === 'about' ? HELP_ABOUT_BODY : HELP_TOPICS.find((t) => t.id === activeTopic)?.body;
  const showTopic = activeTopic !== null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 hidden sm:flex items-center justify-center rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        title="Help and support"
        aria-label="Help and support"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label="Help and support"
          className="fixed w-80 max-w-[calc(100vw-1rem)] bg-white rounded-md shadow-pop border border-n-30 overflow-hidden animate-slide-down"
          style={{ top: panelPos.top, right: panelPos.right, zIndex: Z.dropdown }}
        >
          {showTopic ? (
            <>
              <div className="flex items-center gap-2 px-3 h-11 border-b border-n-30 flex-shrink-0">
                <button
                  onClick={() => setActiveTopic(null)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-n-20 transition-colors text-n-70 flex-shrink-0"
                  aria-label="Back to help topics"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-13 font-semibold text-n-100 truncate flex-1">{topicLabel}</h3>
                <button
                  onClick={close}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-n-20 transition-colors text-n-70 flex-shrink-0"
                  aria-label="Close help"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-3 text-13 text-n-90 space-y-2 max-h-96 overflow-y-auto">{topicBody}</div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 px-4 h-11 border-b border-n-30 flex-shrink-0">
                <h3 className="text-13 font-semibold text-n-100">Help and support</h3>
                <button
                  onClick={close}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-n-20 transition-colors text-n-70"
                  aria-label="Close help"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="py-1 max-h-96 overflow-y-auto">
                {HELP_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    role="menuitem"
                    onClick={() => setActiveTopic(t.id)}
                    className="w-full flex items-center gap-2.5 px-4 h-10 text-13 text-n-90 hover:bg-n-20 transition-colors text-left"
                  >
                    <span className="text-n-70 flex-shrink-0">{t.icon}</span>
                    <span className="flex-1">{t.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-n-50 flex-shrink-0" />
                  </button>
                ))}
                <div className="my-1 border-t border-n-30" />
                <a
                  role="menuitem"
                  href={SUPPORT_MAILTO}
                  onClick={close}
                  className="w-full flex items-center gap-2.5 px-4 h-10 text-13 text-n-90 hover:bg-n-20 transition-colors"
                >
                  <Mail className="w-4 h-4 text-n-70 flex-shrink-0" />
                  <span className="flex-1">Contact support</span>
                </a>
                <button
                  role="menuitem"
                  onClick={() => setActiveTopic('about')}
                  className="w-full flex items-center gap-2.5 px-4 h-10 text-13 text-n-90 hover:bg-n-20 transition-colors text-left"
                >
                  <Info className="w-4 h-4 text-n-70 flex-shrink-0" />
                  <span className="flex-1">About this system</span>
                  <ChevronRight className="w-3.5 h-3.5 text-n-50 flex-shrink-0" />
                </button>
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Mail, Info } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { HELP_TOPICS, HELP_ABOUT_BODY, SUPPORT_MAILTO } from '../../lib/helpContent';

// Mobile counterpart to the desktop HelpMenu popover — same shared topic
// content (see lib/helpContent.tsx), presented as a full-width sheet from
// the More tab instead of a header dropdown. Only "Contact support" opens
// email; every other entry stays in-app.
export default function MobileHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const close = () => { onClose(); setActiveTopic(null); };
  const back = () => setActiveTopic(null);

  const topicLabel = activeTopic === 'about' ? 'About this system' : HELP_TOPICS.find((t) => t.id === activeTopic)?.label;
  const topicBody = activeTopic === 'about' ? HELP_ABOUT_BODY : HELP_TOPICS.find((t) => t.id === activeTopic)?.body;
  const showTopic = activeTopic !== null;

  return (
    <BottomSheet open={open} onClose={close} title={showTopic ? undefined : 'Help and support'}>
      {showTopic ? (
        <>
          <div className="flex items-center gap-2 px-4 pb-2 pt-1 border-b border-n-30">
            <button
              onClick={back}
              className="w-9 h-9 flex items-center justify-center rounded text-n-70 hover:bg-n-20 transition-colors flex-shrink-0"
              aria-label="Back to help topics"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold text-n-100 truncate flex-1">{topicLabel}</h2>
          </div>
          <div className="px-4 py-3 text-[15px] text-n-90 space-y-2">{topicBody}</div>
        </>
      ) : (
        <div className="py-1 pb-3">
          {HELP_TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTopic(t.id)}
              className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-n-90 hover:bg-n-20 transition-colors text-left"
            >
              <span className="text-n-70 flex-shrink-0">{t.icon}</span>
              <span className="flex-1">{t.label}</span>
              <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
            </button>
          ))}
          <div className="my-1 border-t border-n-30" />
          <a
            href={SUPPORT_MAILTO}
            onClick={close}
            className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-n-90 hover:bg-n-20 transition-colors"
          >
            <Mail className="w-5 h-5 text-n-70 flex-shrink-0" />
            <span className="flex-1">Contact support</span>
          </a>
          <button
            onClick={() => setActiveTopic('about')}
            className="w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-n-90 hover:bg-n-20 transition-colors text-left"
          >
            <Info className="w-5 h-5 text-n-70 flex-shrink-0" />
            <span className="flex-1">About this system</span>
            <ChevronRight className="w-4 h-4 text-n-50 flex-shrink-0" />
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

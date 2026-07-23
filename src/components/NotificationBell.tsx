import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, BellRing, X, ClipboardList, CheckCircle2, Archive, AlertCircle, AlertTriangle, Clock, RefreshCw, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { formatRelative } from '../utils/formatters';
import { Z } from '../lib/floating';
import type { Notification } from '../types';

const NOTIF_STYLE: Record<Notification['type'], { icon: typeof ClipboardList; className: string }> = {
  task_assigned: { icon: ClipboardList, className: 'bg-ptr-green/10 text-ptr-green' },
  task_updated: { icon: RefreshCw, className: 'bg-n-20 text-n-80' },
  task_completed: { icon: CheckCircle2, className: 'bg-signal-amber/10 text-signal-amber' },
  changes_requested: { icon: AlertCircle, className: 'bg-signal-amber/10 text-signal-amber' },
  task_archived: { icon: Archive, className: 'bg-n-20 text-n-70' },
  task_due_soon: { icon: Clock, className: 'bg-signal-amber/10 text-signal-amber' },
  task_due_today: { icon: Clock, className: 'bg-signal-amber/10 text-signal-amber' },
  task_overdue: { icon: AlertTriangle, className: 'bg-signal-red-bg text-signal-red' },
  incident_reported: { icon: AlertTriangle, className: 'bg-signal-red-bg text-signal-red' },
  inventory_request_submitted: { icon: Package, className: 'bg-signal-amber/10 text-signal-amber' },
  inventory_request_approved: { icon: Package, className: 'bg-ptr-green/10 text-ptr-green' },
  inventory_request_rejected: { icon: Package, className: 'bg-signal-red-bg text-signal-red' },
  inventory_stock_issued: { icon: Package, className: 'bg-ptr-green/10 text-ptr-green' },
};

// Four groups, in display order — "requires action" surfaces first and is
// the only group that ever drives the bell's badge count (a restrained
// signal: routine assignment/system chatter shouldn't demand attention).
type NotifGroup = 'action' | 'assignments' | 'incidents' | 'system';
const GROUP_OF: Record<Notification['type'], NotifGroup> = {
  changes_requested: 'action',
  task_overdue: 'action',
  task_due_today: 'action',
  task_due_soon: 'action',
  task_completed: 'action', // awaiting the reviewer's approval
  task_assigned: 'assignments',
  incident_reported: 'incidents',
  task_updated: 'system',
  task_archived: 'system',
  inventory_request_submitted: 'action',
  inventory_request_approved: 'assignments',
  inventory_request_rejected: 'action',
  inventory_stock_issued: 'assignments',
};
const GROUP_LABEL: Record<NotifGroup, string> = {
  action: 'Requires action',
  assignments: 'Assignments',
  incidents: 'Incidents',
  system: 'System',
};
const GROUP_ORDER: NotifGroup[] = ['action', 'assignments', 'incidents', 'system'];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The panel is position:fixed and pinned to the viewport's right edge (not
  // the bell's), so on a narrow phone it can't run off the left of the
  // screen the way a bell-anchored `absolute right-0` panel does. Only `top`
  // needs measuring, since the header height differs between the guard and
  // admin layouts this component is shared by.
  const [panelTop, setPanelTop] = useState(0);
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const { notifications, markRead, markAllRead } = useNotifications();
  const push = usePushNotifications();
  const [promptDismissed, setPromptDismissed] = useState(
    () => localStorage.getItem('ptr-push-prompt-dismissed') === '1',
  );

  // Restrained badge: only notifications that actually need action move the
  // needle, not every unread row (routine assignments/system chatter don't).
  const actionableUnreadCount = notifications.filter((n) => !n.read && GROUP_OF[n.type] === 'action').length;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const grouped = GROUP_ORDER.map((g) => ({ group: g, items: notifications.filter((n) => GROUP_OF[n.type] === g).slice(0, 6) })).filter((g) => g.items.length > 0);
  const showPushPrompt = push.status === 'unsubscribed' && push.permission !== 'denied' && !promptDismissed;
  const showIOSInstallHint = push.needsIOSInstall && !promptDismissed;

  const dismissPushPrompt = () => {
    setPromptDismissed(true);
    localStorage.setItem('ptr-push-prompt-dismissed', '1');
  };

  const close = () => { setOpen(false); triggerRef.current?.focus(); };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Re-measure where the panel should drop from whenever it opens, and keep
  // it in sync if the viewport resizes while open.
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPanelTop(rect.bottom + 8);
    };
    reposition();
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [open]);

  const handleNotifClick = (notif: Notification) => {
    markRead.mutate(notif.id);
    setOpen(false);
    const role = currentUser?.role;
    const base = role === 'director' ? '/director' : role === 'range_officer' ? '/officer' : '/guard';
    // incident_reported notifications have no task — they route to the
    // Incident Log instead of a task's detail page. inventory_* notifications
    // route into whichever role's nested inventory area — the director's, or
    // (for an assigned guard) /guard/inventory/requests/:id.
    if (notif.taskId) navigate(`${base}/tasks/${notif.taskId}`);
    else if (notif.inventoryRequestId) navigate(`${base}/inventory/requests/${notif.inventoryRequestId}`);
    else navigate(`${base}/incidents`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded hover:bg-n-20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ptr-accent/40"
        title="Notifications"
        aria-label={`Notifications${actionableUnreadCount > 0 ? ` (${actionableUnreadCount} need action)` : unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {actionableUnreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-signal-red ring-2 ring-white" aria-hidden="true" />
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed right-2 w-80 max-w-[calc(100vw-1rem)] bg-white rounded-md shadow-pop border border-n-30 overflow-hidden animate-slide-down"
          style={{ top: panelTop, zIndex: Z.dropdown }}
        >
          <div className="flex items-center justify-between gap-2 px-4 h-11 border-b border-n-30">
            <h3 className="text-13 font-semibold text-n-100">Notifications</h3>
            <div className="flex items-center gap-3 flex-shrink-0">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-13 text-ptr-accent font-medium flex items-center gap-1 hover:underline"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={close}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-n-20 transition-colors text-n-70"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {showIOSInstallHint && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-ptr-green/5 border-b border-n-30">
              <BellRing className="w-4 h-4 text-ptr-green flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-n-100">Get notified on this device</p>
                <p className="text-xs text-n-70 mt-0.5">
                  On iPhone/iPad, first add this app to your Home Screen (Share button &rarr; Add to Home
                  Screen), then open it from there to turn on notifications.
                </p>
              </div>
              <button
                onClick={dismissPushPrompt}
                className="p-0.5 rounded text-n-60 hover:text-n-90 flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {showPushPrompt && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-ptr-green/5 border-b border-n-30">
              <BellRing className="w-4 h-4 text-ptr-green flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-n-100">Get notified on this device</p>
                <p className="text-xs text-n-70 mt-0.5">
                  Turn on notifications to see task updates even when the app isn&rsquo;t open.
                </p>
                {push.error && <p className="text-xs text-signal-red mt-1">{push.error}</p>}
                <button
                  onClick={() => void push.enable()}
                  disabled={push.loading}
                  className="text-xs font-semibold text-ptr-green mt-1.5"
                >
                  {push.loading ? 'Enabling…' : 'Enable notifications'}
                </button>
              </div>
              <button
                onClick={dismissPushPrompt}
                className="p-0.5 rounded text-n-60 hover:text-n-90 flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {push.permission === 'denied' && push.status === 'unsubscribed' && (
            <div className="px-4 py-2 bg-n-10 border-b border-n-30">
              <p className="text-xs text-n-70">
                Notifications are blocked for this site. Enable them in your browser or device settings to
                get alerts here.
              </p>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-13 text-n-70">
                No notifications yet
              </div>
            ) : (
              grouped.map(({ group, items }) => (
                <div key={group}>
                  <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-n-70 bg-n-10 sticky top-0">
                    {GROUP_LABEL[group]}
                  </div>
                  {items.map((notif) => {
                    const { icon: NotifIcon, className: notifClassName } = NOTIF_STYLE[notif.type];
                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`w-full text-left px-4 py-2.5 hover:bg-n-10 transition-colors border-b border-n-20 last:border-0 ${
                          !notif.read ? 'bg-ptr-green/[0.04]' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${notifClassName}`}>
                            <NotifIcon className="w-3.5 h-3.5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <div className="text-13 font-semibold text-n-100 truncate">{notif.title}</div>
                              {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-ptr-green flex-shrink-0" aria-hidden="true" />}
                            </div>
                            <div className="text-13 text-n-80 mt-0.5 line-clamp-2">
                              {notif.message}
                            </div>
                            <div className="text-xs text-n-70 mt-1">
                              {formatRelative(notif.createdAt)}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

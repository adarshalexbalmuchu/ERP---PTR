import { useState, useRef, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { formatRelative } from '../utils/formatters';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const notifications = useStore((s) => s.notifications);
  const markNotificationRead = useStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useStore((s) => s.markAllNotificationsRead);

  const myNotifications = notifications.filter((n) => n.userId === currentUser?.id);
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotifClick = (notifId: string, taskId: string) => {
    markNotificationRead(notifId);
    setOpen(false);
    const base = currentUser?.role === 'director' ? '/director' : currentUser?.role === 'range_officer' ? '/officer' : '/guard';
    navigate(`${base}/tasks/${taskId}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl hover:bg-ptr-cream transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5 text-ptr-brown" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-ptr-cream-dark z-50 overflow-hidden animate-slide-down">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ptr-cream-dark">
            <h3 className="text-sm font-semibold text-ptr-brown">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-xs text-ptr-green font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {myNotifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-ptr-brown-light">
                No notifications yet
              </div>
            ) : (
              myNotifications.slice(0, 15).map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif.id, notif.taskId)}
                  className={`w-full text-left px-4 py-3 hover:bg-ptr-cream transition-colors border-b border-ptr-cream-dark last:border-0 ${
                    !notif.read ? 'bg-ptr-green/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-ptr-green mt-1.5 flex-shrink-0" />
                    )}
                    <div className={`flex-1 ${notif.read ? 'pl-4' : ''}`}>
                      <div className="text-xs font-semibold text-ptr-brown">{notif.title}</div>
                      <div className="text-xs text-ptr-brown-light mt-0.5 line-clamp-2">
                        {notif.message}
                      </div>
                      <div className="text-xs text-ptr-brown-light/70 mt-1">
                        {formatRelative(notif.createdAt)}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

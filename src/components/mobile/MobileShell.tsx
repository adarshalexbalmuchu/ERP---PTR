import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home, ClipboardList, AlertTriangle, Map as MapIcon, MoreHorizontal, Search,
  UserCircle, Users, History, HelpCircle, LogOut, X, Wifi, WifiOff, RefreshCw, AlertCircle,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useAuth } from '../../contexts/AuthContext';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useLocationSharing } from '../../hooks/useLiveLocation';
import NotificationBell from '../NotificationBell';
import BottomSheet from './BottomSheet';
import MobileSearchOverlay from './MobileSearchOverlay';
import jharkhandEmblem from '../../assets/jharkhand-emblem.png';

function SyncPill() {
  const { state, lastSynced } = useSyncStatus();
  const cfg = {
    offline: { icon: WifiOff, label: 'Offline', cls: 'text-white bg-white/15' },
    syncing: { icon: RefreshCw, label: 'Syncing', cls: 'text-white bg-white/15', spin: true },
    'sync-failed': { icon: AlertCircle, label: 'Sync failed', cls: 'text-white bg-signal-red/90' },
    synced: { icon: Wifi, label: lastSynced ? 'Synced' : 'Online', cls: 'text-white/85 bg-white/10' },
  }[state];
  const Icon = cfg.icon;
  // A persistent status indicator at every width — the label collapses away
  // on narrow phones (iPhone SE/13 etc.) but the icon (and its colour) is
  // always visible, since section 9 treats sync state as a core, always-on
  // signal, not something that can quietly disappear on a smaller screen.
  return (
    <span
      className={`inline-flex items-center gap-1 h-6 px-1.5 xs:px-2 rounded-full text-[11px] font-medium flex-shrink-0 ${cfg.cls}`}
      title={lastSynced ? `Last synced ${new Date(lastSynced).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : cfg.label}
    >
      <Icon className={`w-3 h-3 ${'spin' in cfg && cfg.spin ? 'animate-spin' : ''}`} />
      <span className="hidden xs:inline">{cfg.label}</span>
    </span>
  );
}

interface MoreItem {
  label: string;
  icon: React.ReactNode;
  to?: string;
  href?: string;
  danger?: boolean;
  onClick?: () => void;
}

export default function MobileShell({ base, role }: { base: string; role: string }) {
  const currentUser = useStore((s) => s.currentUser);
  const { logoutFromSupabase } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Field roles run the same background patrol-location beacon on mobile as
  // the desktop guard shell did — moving the shell here must not drop it.
  useLocationSharing();

  const handleLogout = async () => {
    setMoreOpen(false);
    await logoutFromSupabase();
    navigate('/login', { replace: true });
  };

  const moreItems: MoreItem[] = [
    { label: 'My profile', icon: <UserCircle className="w-5 h-5" />, to: `${base}/profile` },
    ...(role === 'director' ? [{ label: 'Personnel', icon: <Users className="w-5 h-5" />, to: `${base}/users` }] : []),
    ...(role === 'director' || role === 'range_officer'
      ? [{ label: 'System audit', icon: <History className="w-5 h-5" />, to: `${base}/audit` }]
      : []),
    { label: 'Help & support', icon: <HelpCircle className="w-5 h-5" />, href: 'mailto:tigercell.ptr@jharkhand.gov.in?subject=PTR%20Field%20Operations%20—%20Support' },
    { label: 'Log out', icon: <LogOut className="w-5 h-5" />, danger: true, onClick: handleLogout },
  ];

  const navItem = (to: string, end: boolean, icon: React.ReactNode, label: string) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ptr-accent/50 ${
          isActive ? 'text-ptr-green' : 'text-n-70'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* Top app bar — compact identity + status, no rail/sidebar */}
      <header
        className="sticky top-0 z-30 bg-ptr-green text-white flex items-center gap-2 px-3"
        style={{ height: 'calc(56px + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <img src={jharkhandEmblem} alt="" className="w-7 h-7 flex-shrink-0" />
        <div className="leading-tight min-w-0 flex-1">
          <div className="text-[10px] text-white/65 uppercase tracking-wide leading-none">Government of Jharkhand</div>
          <div className="text-[15px] font-semibold leading-tight truncate">Field Operations</div>
        </div>
        <SyncPill />
        <button
          onClick={() => setSearchOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Search tasks, incidents, personnel and ranges"
        >
          <Search className="w-5 h-5" />
        </button>
        <NotificationBell />
      </header>

      {searchOpen && <MobileSearchOverlay base={base} onClose={() => setSearchOpen(false)} />}

      <main className="flex-1" style={{ paddingBottom: 'calc(var(--ptr-bottom-nav-h) + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>

      {/* Persistent bottom navigation — Home / Tasks / Incidents / Map / More.
          Reserves exactly its own rendered height on <main> above (via the
          --ptr-bottom-nav-h var) so short pages can never leave main's
          normal-flow box overlapping this fixed bar's hit-test region. */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-n-30 flex items-stretch"
        style={{ height: 'var(--ptr-bottom-nav-h)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        {navItem(base, true, <Home className="w-5 h-5" />, 'Home')}
        {navItem(`${base}/tasks`, false, <ClipboardList className="w-5 h-5" />, 'Tasks')}
        {navItem(`${base}/incidents`, false, <AlertTriangle className="w-5 h-5" />, 'Incidents')}
        {navItem(`${base}/map`, false, <MapIcon className="w-5 h-5" />, 'Map')}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] py-1.5 text-[11px] font-medium text-n-70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ptr-accent/50"
        >
          <MoreHorizontal className="w-5 h-5" />
          More
        </button>
      </nav>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-13 font-semibold text-n-100 truncate">{currentUser?.name}</div>
            <div className="text-xs text-n-70 truncate">{currentUser?.designation}</div>
          </div>
          <button onClick={() => setMoreOpen(false)} className="w-9 h-9 flex items-center justify-center rounded text-n-70 hover:bg-n-20 transition-colors flex-shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="py-1 pb-3">
          {moreItems.map((item) => {
            const cls = `w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] transition-colors ${
              item.danger ? 'text-signal-red' : 'text-n-90 hover:bg-n-20'
            }`;
            const content = <><span className={item.danger ? 'text-signal-red' : 'text-n-70'}>{item.icon}</span>{item.label}</>;
            if (item.to) return <NavLink key={item.label} to={item.to} onClick={() => setMoreOpen(false)} className={cls}>{content}</NavLink>;
            if (item.href) return <a key={item.label} href={item.href} className={cls}>{content}</a>;
            return <button key={item.label} onClick={item.onClick} className={cls}>{content}</button>;
          })}
        </div>
      </BottomSheet>
    </div>
  );
}

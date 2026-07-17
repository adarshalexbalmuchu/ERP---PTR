import { useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Home, Package, ClipboardList, History, MoreHorizontal,
  UserCircle, HelpCircle, LogOut, X, Wifi, WifiOff, RefreshCw, AlertCircle, Check,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { useAuth } from '../../contexts/AuthContext';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { MobileOverlayProvider, useMobileOverlay } from '../../contexts/MobileOverlayContext';
import { formatRelative } from '../../utils/formatters';
import NotificationBell from '../NotificationBell';
import BottomSheet from './BottomSheet';
import MobileHelpSheet from './MobileHelpSheet';
import jharkhandEmblem from '../../assets/jharkhand-emblem.png';

// A separate parallel shell rather than a role branch inside MobileShell —
// inventory_staff has no Field Ops nav destinations at all, and (unlike
// every Field Ops role) no live-location patrol beacon, so folding it into
// MobileShell would mean Field Ops maintainers reasoning about a role that
// doesn't share almost any of that file's behaviour. Structural conventions
// (header height, SyncPill, --ptr-bottom-nav-h, MobileOverlayProvider,
// BottomSheet-based More) are copied verbatim from MobileShell.tsx.

const SYNC_PILL_CFG = {
  offline: { icon: WifiOff, label: 'Offline', cls: 'text-white bg-white/15' },
  syncing: { icon: RefreshCw, label: 'Syncing', cls: 'text-white bg-white/15', spin: true },
  'sync-failed': { icon: AlertCircle, label: 'Sync failed', cls: 'text-white bg-signal-red/90' },
  synced: { icon: Wifi, label: 'Synced', cls: 'text-white/80 bg-white/10' },
} as const;

function SyncPill({ onOpen }: { onOpen: (trigger: HTMLElement) => void }) {
  const { state, lastSynced } = useSyncStatus();
  const cfg = SYNC_PILL_CFG[state];
  const Icon = cfg.icon;
  return (
    <button
      onClick={(e) => onOpen(e.currentTarget)}
      className={`inline-flex items-center gap-1 h-6 px-1.5 xs:px-2 rounded-full text-[11px] font-medium flex-shrink-0 ${cfg.cls}`}
      title={lastSynced ? `Last synced ${new Date(lastSynced).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : cfg.label}
      aria-label="Sync status"
    >
      <Icon className={`w-3 h-3 ${'spin' in cfg && cfg.spin ? 'animate-spin' : ''}`} />
      <span className="hidden xs:inline">{cfg.label}</span>
    </button>
  );
}

function SyncDetailsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, isOnline, pendingCount, failedCount, lastSynced } = useSyncStatus();
  const queryClient = useQueryClient();

  const retry = () => {
    void queryClient.resumePausedMutations();
    void queryClient.invalidateQueries();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Sync status">
      <div className="p-4 space-y-3">
        {!isOnline ? (
          <div className="flex items-start gap-2.5">
            <WifiOff className="w-5 h-5 text-signal-amber flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[15px] font-semibold text-n-100">Offline</p>
              <p className="text-13 text-n-70 mt-0.5">
                {pendingCount + failedCount > 0 ? `${pendingCount + failedCount} change${pendingCount + failedCount === 1 ? '' : 's'} waiting to sync` : 'Changes made now will sync once you’re back online.'}
              </p>
            </div>
          </div>
        ) : state === 'sync-failed' ? (
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-signal-red flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-n-100">Sync failed</p>
              <p className="text-13 text-n-70 mt-0.5">{failedCount} change{failedCount === 1 ? '' : 's'} could not be sent.</p>
              <button onClick={retry} className="btn-secondary h-9 text-13 mt-2">Retry</button>
            </div>
          </div>
        ) : state === 'syncing' ? (
          <div className="flex items-start gap-2.5">
            <RefreshCw className="w-5 h-5 text-ptr-green flex-shrink-0 mt-0.5 animate-spin" />
            <div>
              <p className="text-[15px] font-semibold text-n-100">Syncing…</p>
              <p className="text-13 text-n-70 mt-0.5">{pendingCount} change{pendingCount === 1 ? '' : 's'} being sent.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5">
            <Check className="w-5 h-5 text-signal-green flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[15px] font-semibold text-n-100">All changes synced</p>
              <p className="text-13 text-n-70 mt-0.5">
                {lastSynced ? `Last synced ${formatRelative(new Date(lastSynced).toISOString())}` : 'Nothing waiting to sync.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

interface MoreItem {
  label: string;
  icon: React.ReactNode;
  to?: string;
  danger?: boolean;
  onClick?: () => void;
}

function ShellContent() {
  const currentUser = useStore((s) => s.currentUser);
  const { logoutFromSupabase } = useAuth();
  const navigate = useNavigate();
  const overlay = useMobileOverlay();
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [localMoreOpen, setLocalMoreOpen] = useState(false);

  const moreOpen = overlay?.isOpen('more') ?? localMoreOpen;
  const helpOpen = overlay?.isOpen('help') ?? false;
  const syncOpen = overlay?.isOpen('sync-details') ?? false;
  const closeMore = () => (overlay ? overlay.close('more') : setLocalMoreOpen(false));
  // Distinct from closeMore: a NavLink's own navigation races against and
  // gets unwound by close()'s history.back() call (see that function's
  // comment) — in-sheet links must skip it.
  const closeMoreForNav = () => (overlay ? overlay.close('more', { viaNavigation: true }) : setLocalMoreOpen(false));

  const handleLogout = async () => {
    overlay?.close();
    await logoutFromSupabase();
    navigate('/login', { replace: true });
  };

  const moreItems: MoreItem[] = [
    { label: 'My profile', icon: <UserCircle className="w-5 h-5" />, to: '/inventory/profile' },
    { label: 'Help & support', icon: <HelpCircle className="w-5 h-5" />, onClick: () => overlay?.open('help', moreButtonRef.current) },
    { label: 'Log out', icon: <LogOut className="w-5 h-5" />, danger: true, onClick: () => void handleLogout() },
  ];

  const navItem = (to: string, end: boolean, icon: React.ReactNode, label: string) => (
    <NavLink to={to} end={end} className="group flex-1 flex items-center justify-center min-h-[52px] focus-visible:outline-none">
      {({ isActive }) => (
        <span
          className={`flex flex-col items-center gap-0.5 px-3.5 py-1.5 rounded-lg transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ptr-accent group-focus-visible:ring-offset-1 ${
            isActive ? 'text-ptr-green bg-ptr-green/10' : 'text-n-70'
          }`}
        >
          {icon}
          <span className="text-[11px] font-medium">{label}</span>
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="h-dvh bg-white flex flex-col overflow-hidden">
      <header
        className="sticky top-0 z-30 bg-ptr-green text-white flex items-center gap-2 px-3"
        style={{ height: 'calc(56px + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <img src={jharkhandEmblem} alt="" className="w-7 h-7 flex-shrink-0" />
        <div className="leading-tight min-w-0 flex-1">
          <div className="text-[10px] text-white/70 uppercase tracking-wide leading-none truncate">Government of Jharkhand</div>
          <div className="text-[15px] font-semibold leading-tight truncate">Inventory</div>
        </div>
        <SyncPill onOpen={(trigger) => overlay?.open('sync-details', trigger)} />
        <NotificationBell />
      </header>

      {/* Single scroll owner, identical convention to MobileShell.tsx —
          pages rendered through this Outlet must stay in normal flow. */}
      <main
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          paddingBottom: 'calc(var(--ptr-bottom-nav-h) + env(safe-area-inset-bottom))',
          overscrollBehaviorY: 'contain',
        }}
      >
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-n-30 flex items-stretch"
        style={{ height: 'var(--ptr-bottom-nav-h)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        {navItem('/inventory', true, <Home className="w-5 h-5" />, 'Home')}
        {navItem('/inventory/stock', false, <Package className="w-5 h-5" />, 'Stock')}
        {navItem('/inventory/requests', false, <ClipboardList className="w-5 h-5" />, 'Requests')}
        {navItem('/inventory/transactions', false, <History className="w-5 h-5" />, 'Transactions')}
        <button
          ref={moreButtonRef}
          onClick={() => (overlay ? overlay.open('more', moreButtonRef.current) : setLocalMoreOpen(true))}
          aria-label="More"
          aria-expanded={moreOpen}
          className="group flex-1 flex items-center justify-center min-h-[52px] focus-visible:outline-none"
        >
          <span className={`flex flex-col items-center gap-0.5 px-3.5 py-1.5 rounded-lg transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ptr-accent group-focus-visible:ring-offset-1 ${moreOpen ? 'text-ptr-green bg-ptr-green/10' : 'text-n-70'}`}>
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[11px] font-medium">More</span>
          </span>
        </button>
      </nav>

      <BottomSheet open={moreOpen} onClose={closeMore}>
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-13 font-semibold text-n-100 truncate">{currentUser?.name}</div>
            <div className="text-xs text-n-70 truncate">{currentUser?.designation}</div>
          </div>
          <button onClick={closeMore} className="w-9 h-9 flex items-center justify-center rounded text-n-70 hover:bg-n-20 transition-colors flex-shrink-0" aria-label="Close more menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="py-1 pb-3">
          {moreItems.map((item) => {
            const cls = `w-full flex items-center gap-3 px-4 min-h-[48px] text-[15px] transition-colors ${
              item.danger ? 'text-signal-red' : 'text-n-90 hover:bg-n-20'
            }`;
            const content = <><span className={item.danger ? 'text-signal-red' : 'text-n-70'}>{item.icon}</span>{item.label}</>;
            if (item.to) return <NavLink key={item.label} to={item.to} onClick={closeMoreForNav} className={cls}>{content}</NavLink>;
            return <button key={item.label} onClick={item.onClick} className={cls}>{content}</button>;
          })}
        </div>
      </BottomSheet>

      <MobileHelpSheet open={helpOpen} onClose={() => overlay?.close('help')} />
      <SyncDetailsSheet open={syncOpen} onClose={() => overlay?.close('sync-details')} />
    </div>
  );
}

export default function InventoryMobileShell() {
  return (
    <MobileOverlayProvider>
      <ShellContent />
    </MobileOverlayProvider>
  );
}

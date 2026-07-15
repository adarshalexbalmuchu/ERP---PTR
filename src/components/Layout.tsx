import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Menu,
  X,
  LogOut,
  AlertTriangle,
  Map as MapIcon,
  History,
  UserCircle,
  Search,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import useStore from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { useLocationSharing } from '../hooks/useLiveLocation';
import NotificationBell from './NotificationBell';
import Footer from './Footer';
import { SlotProvider, CommandBarSlot, ContextPanelSlot } from './layout/Slots';
import jharkhandEmblem from '../assets/jharkhand-emblem.png';

type Section = { key: string; to: string; label: string; icon: React.ReactNode };

const iconCls = 'w-[18px] h-[18px] flex-shrink-0';

function directorSections(): Section[] {
  return [
    { key: 'dashboard', to: '/director', label: 'Dashboard', icon: <LayoutDashboard className={iconCls} /> },
    { key: 'tasks', to: '/director/tasks', label: 'Task registry', icon: <ClipboardList className={iconCls} /> },
    { key: 'incidents', to: '/director/incidents', label: 'Incident reports', icon: <AlertTriangle className={iconCls} /> },
    { key: 'map', to: '/director/map', label: 'Range map', icon: <MapIcon className={iconCls} /> },
    { key: 'users', to: '/director/users', label: 'Personnel', icon: <Users className={iconCls} /> },
    { key: 'audit', to: '/director/audit', label: 'System audit', icon: <History className={iconCls} /> },
  ];
}

function officerSections(): Section[] {
  return [
    { key: 'dashboard', to: '/officer', label: 'Dashboard', icon: <LayoutDashboard className={iconCls} /> },
    { key: 'tasks', to: '/officer/tasks', label: 'Task registry', icon: <ClipboardList className={iconCls} /> },
    { key: 'incidents', to: '/officer/incidents', label: 'Incident reports', icon: <AlertTriangle className={iconCls} /> },
    { key: 'map', to: '/officer/map', label: 'Range map', icon: <MapIcon className={iconCls} /> },
    { key: 'audit', to: '/officer/audit', label: 'System audit', icon: <History className={iconCls} /> },
  ];
}

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  tasks: 'Task registry',
  incidents: 'Incident reports',
  map: 'Range map',
  users: 'Personnel',
  audit: 'System audit',
  profile: 'My profile',
};

// Which rail section a given path belongs to (task detail lives under Tasks).
function sectionForPath(pathname: string, base: string): string {
  const rest = pathname.slice(base.length).replace(/^\//, '');
  const seg = rest.split('/')[0];
  if (!seg) return 'dashboard';
  if (seg === 'tasks') return 'tasks';
  return seg; // incidents | map | users | audit | profile
}

function UserMenu({ onLogout }: { onLogout: () => void }) {
  const currentUser = useStore((s) => s.currentUser);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const base = currentUser?.role === 'director' ? '/director' : '/officer';

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-9 pl-1.5 pr-1 rounded hover:bg-white/10 transition-colors"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <span className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center text-xs font-semibold">
          {currentUser?.avatarInitials}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-white/70 hidden sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-md shadow-pop border border-n-30 py-1 z-50 animate-slide-down">
          <div className="px-3 py-2.5 border-b border-n-30">
            <div className="text-13 font-semibold text-n-100 truncate">{currentUser?.name}</div>
            <div className="text-xs text-n-80 truncate">{currentUser?.designation}</div>
          </div>
          <button
            onClick={() => { setOpen(false); navigate(`${base}/profile`); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-13 text-n-90 hover:bg-n-20 transition-colors"
          >
            <UserCircle className="w-4 h-4 text-n-70" />
            My profile
          </button>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-13 text-signal-red hover:bg-signal-red-bg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function GlobalHeader({
  onToggleNav,
  base,
}: {
  onToggleNav: () => void;
  base: string;
}) {
  const { logoutFromSupabase } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleLogout = async () => {
    await logoutFromSupabase();
    navigate('/login', { replace: true });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(`${base}/tasks${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  };

  return (
    <header
      className="flex-shrink-0 bg-ptr-green text-white flex items-center gap-2 pl-1.5 pr-2 sm:pr-3"
      style={{ height: 'calc(48px + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Left — identity */}
      <button
        onClick={onToggleNav}
        className="lg:hidden w-10 h-10 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2.5 min-w-0 pl-1">
        <img src={jharkhandEmblem} alt="" className="w-7 h-7 flex-shrink-0" />
        <div className="leading-tight min-w-0 hidden xs:block">
          <div className="text-[10.5px] text-white/70 tracking-wide uppercase leading-none">Government of Jharkhand</div>
          <div className="text-13 font-semibold text-white leading-tight truncate">Palamau Tiger Reserve</div>
        </div>
        <span className="text-13 font-semibold text-white xs:hidden">PTR</span>
        <span className="hidden lg:block text-xs text-white/55 border-l border-white/20 pl-2.5 ml-1 truncate">
          Field Operations Management System
        </span>
      </div>

      {/* Center — global search */}
      <form onSubmit={submitSearch} className="hidden md:flex flex-1 justify-center px-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="w-full h-8 pl-8 pr-3 rounded bg-white/12 hover:bg-white/16 focus:bg-white text-13 text-white focus:text-n-100 placeholder:text-white/60 focus:placeholder:text-n-70 focus:outline-none focus:ring-2 focus:ring-white/40 transition-colors"
            style={{ fontSize: '16px' }}
          />
        </div>
      </form>

      {/* Right — actions */}
      <div className="flex items-center gap-0.5 ml-auto md:ml-0">
        <a
          href="mailto:tigercell.ptr@jharkhand.gov.in?subject=PTR%20Field%20Operations%20—%20Support"
          className="w-10 h-10 hidden sm:flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          title="Help & support"
          aria-label="Help and support"
        >
          <HelpCircle className="w-5 h-5" />
        </a>
        <div className="text-n-100">
          <NotificationBell />
        </div>
        <UserMenu onLogout={handleLogout} />
      </div>
    </header>
  );
}

function IconRail({ sections, currentSection }: { sections: Section[]; currentSection: string }) {
  return (
    <nav className="hidden lg:flex flex-col items-center w-12 flex-shrink-0 bg-n-20 border-r border-n-30 py-1.5 gap-0.5">
      {sections.map((s) => {
        const active = s.key === currentSection;
        return (
          <NavLink
            key={s.key}
            to={s.to}
            title={s.label}
            className="group relative w-10 h-10 flex items-center justify-center rounded"
          >
            <span
              className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full transition-opacity ${
                active ? 'bg-ptr-green opacity-100' : 'opacity-0'
              }`}
            />
            <span
              className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                active ? 'text-ptr-green bg-ptr-green/10' : 'text-n-80 group-hover:bg-n-30 group-hover:text-n-100'
              }`}
            >
              {s.icon}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function AdminLayout({ sections, base }: { sections: Section[]; base: string }) {
  const { logoutFromSupabase } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const currentSection = sectionForPath(location.pathname, base);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logoutFromSupabase();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-dvh flex flex-col bg-white overflow-hidden">
      <GlobalHeader onToggleNav={() => setNavOpen(true)} base={base} />

      <div className="flex flex-1 overflow-hidden">
        <IconRail sections={sections} currentSection={currentSection} />

        {/* Mobile drawer scrim */}
        {navOpen && (
          <div
            className="fixed inset-0 top-12 bg-black/30 z-30 lg:hidden"
            onClick={() => setNavOpen(false)}
            style={{ animation: 'fadeIn 0.12s ease-out' }}
          />
        )}

        {/* Contextual navigation panel — static 220px column on desktop,
            slide-in drawer (with the labelled section nav prepended) on mobile.
            One DOM node so the page's portalled filters live in a single slot. */}
        <aside
          className={`bg-n-10 border-r border-n-30 flex flex-col z-40
            fixed top-12 bottom-0 left-0 w-[280px] transition-transform duration-150
            lg:static lg:top-0 lg:w-[220px] lg:translate-x-0 lg:transition-none
            ${navOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full lg:translate-x-0'}`}
        >
          <div className="flex items-center justify-between px-4 h-11 border-b border-n-30 flex-shrink-0">
            <h2 className="text-13 font-semibold text-n-100">{SECTION_TITLES[currentSection] ?? 'Menu'}</h2>
            <button
              onClick={() => setNavOpen(false)}
              className="lg:hidden w-8 h-8 -mr-1.5 flex items-center justify-center rounded text-n-70 hover:bg-n-20"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile-only labelled section nav (desktop uses the icon rail). */}
          <nav className="lg:hidden px-2 py-2 border-b border-n-30 space-y-0.5">
            {sections.map((s) => {
              const active = s.key === currentSection;
              return (
                <NavLink
                  key={s.key}
                  to={s.to}
                  className={`flex items-center gap-3 px-2.5 h-10 rounded text-13 transition-colors ${
                    active ? 'bg-ptr-green/10 text-ptr-green font-semibold' : 'text-n-90 hover:bg-n-20'
                  }`}
                >
                  {s.icon}
                  {s.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Page-provided views/filters portal in here. */}
          <div className="flex-1 overflow-y-auto">
            <ContextPanelSlot className="p-3" />
          </div>
        </aside>

        {/* Workspace column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Command bar */}
          <div className="flex-shrink-0 h-11 bg-white border-b border-n-30 flex items-center gap-1 px-2 sm:px-3 overflow-x-auto">
            <CommandBarSlot className="flex items-center gap-1 min-w-max" />
          </div>

          {/* Continuous white workspace */}
          <main className="flex-1 overflow-y-auto bg-white flex flex-col">
            <div className="flex-1">
              <Outlet />
            </div>
            <Footer />
          </main>
        </div>
      </div>

      {/* Mobile logout affordance lives in the drawer footer for reachability */}
      {navOpen && (
        <button
          onClick={handleLogout}
          className="lg:hidden fixed bottom-0 left-0 w-[280px] z-40 flex items-center gap-2.5 px-4 h-12 bg-n-10 border-t border-r border-n-30 text-13 font-medium text-signal-red"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      )}
    </div>
  );
}

function GuardLayout() {
  const currentUser = useStore((s) => s.currentUser);
  const { logoutFromSupabase } = useAuth();
  const navigate = useNavigate();
  useLocationSharing();

  const handleLogout = async () => {
    await logoutFromSupabase();
    navigate('/login', { replace: true });
  };

  const navItem = (to: string, end: boolean, icon: React.ReactNode, label: string) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
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
      <div className="sticky top-0 z-30">
        {/* Compact green identity header */}
        <header
          className="bg-ptr-green text-white flex items-center gap-2.5 px-3"
          style={{ height: 'calc(48px + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}
        >
          <img src={jharkhandEmblem} alt="" className="w-7 h-7 flex-shrink-0" />
          <div className="leading-tight min-w-0 flex-1">
            <div className="text-[10.5px] text-white/70 uppercase tracking-wide leading-none">Government of Jharkhand</div>
            <div className="text-13 font-semibold leading-tight truncate">Palamau Tiger Reserve</div>
          </div>
          <div className="text-white/90">
            <NotificationBell />
          </div>
          <NavLink
            to="/guard/profile"
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-xs font-semibold flex-shrink-0"
            title="My profile"
          >
            {currentUser?.avatarInitials}
          </NavLink>
        </header>
        {/* Identity strip */}
        <div className="bg-n-10 border-b border-n-30 px-3 py-1.5">
          <p className="text-13 text-n-90">
            <span className="font-semibold">{currentUser?.name}</span>
            {currentUser?.designation && <span className="text-n-70"> · {currentUser.designation}</span>}
          </p>
        </div>
      </div>

      <main className="flex-1" style={{ paddingBottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}>
        <Outlet />
        <Footer />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-n-30 flex items-stretch z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItem('/guard', true, <ClipboardList className="w-5 h-5" />, 'My tasks')}
        {navItem('/guard/incidents', false, <AlertTriangle className="w-5 h-5" />, 'Incidents')}
        {navItem('/guard/map', false, <MapIcon className="w-5 h-5" />, 'Map')}
        {navItem('/guard/profile', false, <UserCircle className="w-5 h-5" />, 'Profile')}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-n-70 hover:text-signal-red transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </button>
      </nav>
    </div>
  );
}

export default function Layout() {
  const currentUser = useStore((s) => s.currentUser);

  if (currentUser?.role === 'director') {
    return (
      <SlotProvider>
        <AdminLayout sections={directorSections()} base="/director" />
      </SlotProvider>
    );
  }

  if (currentUser?.role === 'range_officer') {
    return (
      <SlotProvider>
        <AdminLayout sections={officerSections()} base="/officer" />
      </SlotProvider>
    );
  }

  return <GuardLayout />;
}

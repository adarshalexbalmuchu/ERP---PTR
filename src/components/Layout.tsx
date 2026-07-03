import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Users,
  Menu,
  X,
  LogOut,
  AlertTriangle,
  Map as MapIcon,
  History,
} from 'lucide-react';
import useStore from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import GovStrip from './GovStrip';
import Footer from './Footer';
import ptrLogo from '../assets/ptr-logo.png';

type NavItem = { to: string; label: string; icon: React.ReactNode };

function Sidebar({
  items,
  onLogout,
  onClose,
}: {
  items: NavItem[];
  onLogout: () => void;
  onClose?: () => void;
}) {
  const currentUser = useStore((s) => s.currentUser);
  return (
    <div className="h-full flex flex-col bg-ptr-green-dark">
      {/* The green GovStrip above already carries the Government of
          Jharkhand identity — the sidebar header only needs the reserve. */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/95 border border-white/15 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src={ptrLogo} alt="Palamu Tiger Reserve emblem" className="w-full h-full object-contain p-0.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white leading-snug">Palamu Tiger Reserve</div>
            <div className="text-[11px] text-white/50 uppercase tracking-[0.08em] leading-tight mt-0.5">
              Field Operations
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 transition-colors md:hidden flex-shrink-0"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split('/').length <= 2}
            className={({ isActive }) =>
              `relative flex items-center gap-3 pl-5 pr-4 py-2.5 rounded-sm text-sm transition-colors min-h-[44px] ${
                isActive
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'text-white/65 font-medium hover:bg-white/5 hover:text-white'
              }`
            }
            onClick={onClose}
          >
            {({ isActive }) => (
              <>
                {/* enterprise-style selected indicator: accent bar, not a pill */}
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-white/90" />}
                {item.icon}
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
            {currentUser?.avatarInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{currentUser?.name}</div>
            <div className="text-xs text-white/50 truncate">{currentUser?.designation}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium w-full text-left min-h-[44px] text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}

function AdminLayout({ items }: { items: NavItem[] }) {
  const currentUser = useStore((s) => s.currentUser);
  const { logoutFromSupabase } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logoutFromSupabase();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col h-screen bg-ptr-cream overflow-hidden">
      <GovStrip />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-col w-64 flex-shrink-0">
          <Sidebar items={items} onLogout={handleLogout} />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
              style={{ animation: 'fadeIn 0.15s ease-out' }}
            />
            <div
              className="absolute left-0 top-0 bottom-0 w-72"
              style={{ animation: 'slideRight 0.2s ease-out' }}
            >
              <Sidebar items={items} onLogout={handleLogout} onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile top bar */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-ptr-cream-dark flex-shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-xl hover:bg-ptr-cream transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5 text-ptr-brown" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white border border-ptr-cream-dark flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={ptrLogo} alt="" className="w-full h-full object-contain" />
              </div>
              <span className="text-sm font-bold text-ptr-brown">PTR Tasks</span>
            </div>
            <NotificationBell />
          </header>

          {/* Desktop top bar — operational context, no consumer greeting */}
          <div className="hidden md:flex relative items-center justify-between px-6 py-2.5 bg-white border-b border-ptr-cream-dark flex-shrink-0 min-h-[56px]">
            <p className="text-xs text-ptr-brown-light tabular-nums">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <span className="absolute left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-[0.14em] text-ptr-brown hidden lg:inline">
              Field Operations Management System
            </span>
            <div className="flex items-center gap-4">
              <div className="text-right leading-tight border-r border-ptr-cream-dark pr-4">
                <p className="text-[10px] uppercase tracking-[0.08em] text-ptr-brown-light/80">Logged in as</p>
                <p className="text-xs font-semibold text-ptr-brown">
                  {currentUser?.name}
                  <span className="font-normal text-ptr-brown-light"> &middot; {currentUser?.designation}</span>
                </p>
              </div>
              <NotificationBell />
            </div>
          </div>

          <main
            className="flex-1 overflow-y-auto flex flex-col"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(42,39,36,0.03) 1px, transparent 0)',
              backgroundSize: '18px 18px',
            }}
          >
            <div className="flex-1">
              <Outlet />
            </div>
            <Footer />
          </main>
        </div>
      </div>
    </div>
  );
}

function GuardLayout() {
  const currentUser = useStore((s) => s.currentUser);
  const { logoutFromSupabase } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutFromSupabase();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-ptr-cream flex flex-col">
      <GovStrip />
      <header className="bg-white border-b border-ptr-cream-dark px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white border border-ptr-cream-dark flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={ptrLogo} alt="" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-sm font-bold text-ptr-brown leading-none">PTR Tiger Cell</div>
            <div className="text-xs text-ptr-brown-light leading-none">My Tasks</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <div className="flex items-center gap-2 pl-2 border-l border-ptr-cream-dark">
            <div className="w-8 h-8 rounded-full bg-ptr-green/10 flex items-center justify-center text-xs font-semibold text-ptr-green">
              {currentUser?.avatarInitials}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-ptr-cream transition-colors text-ptr-brown-light hover:text-red-600"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 pb-16">
        <Outlet />
        <Footer />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-ptr-cream-dark flex items-stretch z-30">
        <NavLink
          to="/guard"
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              isActive ? 'text-ptr-green' : 'text-ptr-brown-light'
            }`
          }
        >
          <ClipboardList className="w-5 h-5" />
          My Tasks
        </NavLink>
        <NavLink
          to="/guard/incidents"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              isActive ? 'text-ptr-green' : 'text-ptr-brown-light'
            }`
          }
        >
          <AlertTriangle className="w-5 h-5" />
          Incidents
        </NavLink>
        <NavLink
          to="/guard/map"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              isActive ? 'text-ptr-green' : 'text-ptr-brown-light'
            }`
          }
        >
          <MapIcon className="w-5 h-5" />
          Map
        </NavLink>
      </nav>
    </div>
  );
}

export default function Layout() {
  const currentUser = useStore((s) => s.currentUser);

  if (currentUser?.role === 'director') {
    const items: NavItem[] = [
      { to: '/director', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] flex-shrink-0" /> },
      { to: '/director/tasks', label: 'Task Registry', icon: <ClipboardList className="w-[18px] h-[18px] flex-shrink-0" /> },
      { to: '/director/reports', label: 'Reports', icon: <FileText className="w-[18px] h-[18px] flex-shrink-0" /> },
      { to: '/director/incidents', label: 'Incident Reports', icon: <AlertTriangle className="w-[18px] h-[18px] flex-shrink-0" /> },
      { to: '/director/map', label: 'Range Map', icon: <MapIcon className="w-[18px] h-[18px] flex-shrink-0" /> },
      { to: '/director/audit', label: 'System Audit', icon: <History className="w-[18px] h-[18px] flex-shrink-0" /> },
      { to: '/director/users', label: 'Personnel', icon: <Users className="w-[18px] h-[18px] flex-shrink-0" /> },
    ];
    return <AdminLayout items={items} />;
  }

  if (currentUser?.role === 'range_officer') {
    const items: NavItem[] = [
      { to: '/officer', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] flex-shrink-0" /> },
      { to: '/officer/tasks', label: 'Task Registry', icon: <ClipboardList className="w-[18px] h-[18px] flex-shrink-0" /> },
      { to: '/officer/incidents', label: 'Incident Reports', icon: <AlertTriangle className="w-[18px] h-[18px] flex-shrink-0" /> },
      { to: '/officer/map', label: 'Range Map', icon: <MapIcon className="w-[18px] h-[18px] flex-shrink-0" /> },
      { to: '/officer/audit', label: 'System Audit', icon: <History className="w-[18px] h-[18px] flex-shrink-0" /> },
    ];
    return <AdminLayout items={items} />;
  }

  return <GuardLayout />;
}

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Menu, X, LogOut, Leaf } from 'lucide-react';
import useStore from '../store/useStore';
import NotificationBell from './NotificationBell';

function AdminSidebar({ onLogout, onClose }: { onLogout: () => void; onClose?: () => void }) {
  const currentUser = useStore((s) => s.currentUser);
  return (
    <div className="h-full flex flex-col bg-white border-r border-ptr-cream-dark">
      <div className="flex items-center justify-between px-4 py-4 border-b border-ptr-cream-dark">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-ptr-green flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-ptr-brown leading-tight">PTR</div>
            <div className="text-xs text-ptr-brown-light leading-tight">Task Management</div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-ptr-cream transition-colors md:hidden"
          >
            <X className="w-5 h-5 text-ptr-brown-light" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <NavLink
          to="/admin"
          end
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink
          to="/admin/tasks"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <ClipboardList className="w-5 h-5 flex-shrink-0" />
          <span>All Tasks</span>
        </NavLink>
      </nav>

      <div className="p-3 border-t border-ptr-cream-dark space-y-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-ptr-green/10 flex items-center justify-center text-xs font-semibold text-ptr-green flex-shrink-0">
            {currentUser?.avatarInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-ptr-brown truncate">{currentUser?.name}</div>
            <div className="text-xs text-ptr-brown-light truncate">{currentUser?.designation}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="sidebar-link w-full text-left"
          style={{ color: '#dc2626' }}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (currentUser?.role === 'admin') {
    return (
      <div className="flex h-screen bg-ptr-cream overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-col w-64 flex-shrink-0">
          <AdminSidebar onLogout={handleLogout} />
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
              <AdminSidebar onLogout={handleLogout} onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile top bar */}
          <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-ptr-cream-dark">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-xl hover:bg-ptr-cream transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5 text-ptr-brown" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-ptr-green flex items-center justify-center">
                <Leaf className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-bold text-ptr-brown">PTR Tasks</span>
            </div>
            <NotificationBell />
          </header>

          {/* Desktop top bar */}
          <div className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-ptr-cream-dark">
            <p className="text-sm text-ptr-brown-light">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <NotificationBell />
          </div>

          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  // Staff layout
  return (
    <div className="min-h-screen bg-ptr-cream flex flex-col">
      <header className="bg-white border-b border-ptr-cream-dark px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-ptr-green flex items-center justify-center">
            <Leaf className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-ptr-brown leading-none">PTR</div>
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
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

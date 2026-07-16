import { type ReactNode, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersister } from './lib/queryClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import useStore from './store/useStore';
import { isFieldRole } from './types';
import Login from './pages/Login';
import Layout from './components/Layout';
import OfflineBanner from './components/OfflineBanner';
import ptrLogo from './assets/ptr-logo.png';

// Route-level code splitting: a guard never downloads director/officer
// bundles (charts, user management, etc.) and vice versa.
const DirectorDashboard = lazy(() => import('./pages/director/Dashboard'));
const DirectorTaskList = lazy(() => import('./pages/director/TaskList'));
const DirectorUsers = lazy(() => import('./pages/director/Users'));
const OfficerDashboard = lazy(() => import('./pages/officer/Dashboard'));
const OfficerTaskList = lazy(() => import('./pages/officer/TaskList'));
const TaskDetailPage = lazy(() => import('./pages/shared/TaskDetailPage'));
const IncidentLog = lazy(() => import('./pages/shared/IncidentLog'));
const MapView = lazy(() => import('./pages/shared/MapView'));
const AuditLog = lazy(() => import('./pages/shared/AuditLog'));
const Profile = lazy(() => import('./pages/shared/Profile'));
const GuardMyTasks = lazy(() => import('./pages/guard/MyTasks'));
const GuardTaskList = lazy(() => import('./pages/guard/TaskList'));

// Hospitality Inventory Management (Phase 1) — a fully separate domain from
// Field Ops, so it gets its own lazy chunk regardless of which shell (the
// director's nested area, or the inventory_staff top-level one) renders it.
const InventoryDashboard = lazy(() => import('./pages/inventory/Dashboard'));
const InventoryItems = lazy(() => import('./pages/inventory/Items'));
const InventoryCategories = lazy(() => import('./pages/inventory/Categories'));
const InventoryLocations = lazy(() => import('./pages/inventory/Locations'));
const InventoryStock = lazy(() => import('./pages/inventory/Stock'));
const InventoryRequests = lazy(() => import('./pages/inventory/Requests'));
const InventoryRequestDetail = lazy(() => import('./pages/inventory/RequestDetail'));
const InventoryTransactions = lazy(() => import('./pages/inventory/Transactions'));
const InventoryReports = lazy(() => import('./pages/inventory/Reports'));
const InventoryStaffManagement = lazy(() => import('./pages/inventory/StaffManagement'));

function roleHome(role: string): string {
  if (role === 'director') return '/director';
  if (role === 'range_officer') return '/officer';
  if (role === 'inventory_staff') return '/inventory';
  return '/guard';
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-ptr-cream flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-white border border-ptr-cream-dark shadow-sm flex items-center justify-center overflow-hidden animate-pulse">
          <img src={ptrLogo} alt="" className="w-full h-full object-contain p-1" />
        </div>
        <p className="text-sm text-ptr-brown-light">Loading…</p>
      </div>
    </div>
  );
}

function ProtectedDirector({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const user = useStore((s) => s.currentUser);
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'director') return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

function ProtectedOfficer({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const user = useStore((s) => s.currentUser);
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'range_officer') return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

function ProtectedGuard({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const user = useStore((s) => s.currentUser);
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isFieldRole(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

function ProtectedInventoryStaff({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const user = useStore((s) => s.currentUser);
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'inventory_staff') return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

function Root() {
  const { loading } = useAuth();
  const user = useStore((s) => s.currentUser);
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(user.role)} replace />;
}

// Role-agnostic deep link used by push notification clicks (the service
// worker has no idea which role opened it) — resolves to the same task
// under whichever role-scoped route the signed-in user actually has.
function TaskRedirect() {
  const { loading } = useAuth();
  const user = useStore((s) => s.currentUser);
  const { id } = useParams();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`${roleHome(user.role)}/tasks/${id}`} replace />;
}

export default function App() {
  // Realtime subscriptions (see useTasks/useNotifications) push live updates,
  // but a phone's OS aggressively suspends or kills a backgrounded app's
  // WebSocket — so any change made while it was in the background (a task
  // assigned, a comment added) never arrives over that dead connection, and
  // there's no missed-event replay. Reopening/foregrounding the app doesn't
  // necessarily reload the page either, so nothing re-fetches on its own.
  // Refetching everything whenever the tab becomes visible again (or comes
  // back online) closes that gap without needing a manual refresh.
  useEffect(() => {
    const refetchAll = () => { void queryClient.invalidateQueries(); };
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refetchAll(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', refetchAll);
    window.addEventListener('pageshow', refetchAll);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', refetchAll);
      window.removeEventListener('pageshow', refetchAll);
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister }}
      onSuccess={() => {
        // Replay any mutations (progress updates, start/complete, etc.)
        // that were queued while offline and survived a page reload.
        void queryClient.resumePausedMutations().then(() => {
          void queryClient.invalidateQueries();
        });
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <OfflineBanner />
          <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Root />} />
            <Route path="/login" element={<Login />} />
            <Route path="/tasks/:id" element={<TaskRedirect />} />

            {/* Director */}
            <Route
              path="/director"
              element={
                <ProtectedDirector>
                  <Layout />
                </ProtectedDirector>
              }
            >
              <Route index element={<DirectorDashboard />} />
              <Route path="tasks" element={<DirectorTaskList />} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="users" element={<DirectorUsers />} />
              <Route path="incidents" element={<IncidentLog />} />
              <Route path="map" element={<MapView />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="profile" element={<Profile />} />

              {/* Hospitality Inventory Management — nested area with its own
                  internal pages; opens from the icon rail / mobile More sheet. */}
              <Route path="inventory" element={<InventoryDashboard />} />
              <Route path="inventory/items" element={<InventoryItems />} />
              <Route path="inventory/categories" element={<InventoryCategories />} />
              <Route path="inventory/locations" element={<InventoryLocations />} />
              <Route path="inventory/stock" element={<InventoryStock />} />
              <Route path="inventory/requests" element={<InventoryRequests />} />
              <Route path="inventory/requests/:id" element={<InventoryRequestDetail />} />
              <Route path="inventory/transactions" element={<InventoryTransactions />} />
              <Route path="inventory/reports" element={<InventoryReports />} />
              <Route path="inventory/staff" element={<InventoryStaffManagement />} />
            </Route>

            {/* Range Officer */}
            <Route
              path="/officer"
              element={
                <ProtectedOfficer>
                  <Layout />
                </ProtectedOfficer>
              }
            >
              <Route index element={<OfficerDashboard />} />
              <Route path="tasks" element={<OfficerTaskList />} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="incidents" element={<IncidentLog />} />
              <Route path="map" element={<MapView />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Guard */}
            <Route
              path="/guard"
              element={
                <ProtectedGuard>
                  <Layout />
                </ProtectedGuard>
              }
            >
              <Route index element={<GuardMyTasks />} />
              <Route path="tasks" element={<GuardTaskList />} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="incidents" element={<IncidentLog />} />
              <Route path="map" element={<MapView />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Inventory staff — a fully separate shell (see Layout.tsx),
                no Field Ops routes at all under this tree. */}
            <Route
              path="/inventory"
              element={
                <ProtectedInventoryStaff>
                  <Layout />
                </ProtectedInventoryStaff>
              }
            >
              <Route index element={<InventoryDashboard />} />
              <Route path="stock" element={<InventoryStock />} />
              <Route path="requests" element={<InventoryRequests />} />
              <Route path="requests/:id" element={<InventoryRequestDetail />} />
              <Route path="transactions" element={<InventoryTransactions />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

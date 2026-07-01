import { type ReactNode, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Leaf } from 'lucide-react';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import useStore from './store/useStore';
import Login from './pages/Login';
import Layout from './components/Layout';

// Route-level code splitting: a guard never downloads director/officer
// bundles (charts, user management, etc.) and vice versa.
const DirectorDashboard = lazy(() => import('./pages/director/Dashboard'));
const DirectorTaskList = lazy(() => import('./pages/director/TaskList'));
const DirectorReports = lazy(() => import('./pages/director/Reports'));
const DirectorUsers = lazy(() => import('./pages/director/Users'));
const OfficerDashboard = lazy(() => import('./pages/officer/Dashboard'));
const OfficerTaskList = lazy(() => import('./pages/officer/TaskList'));
const TaskDetailPage = lazy(() => import('./pages/shared/TaskDetailPage'));
const GuardMyTasks = lazy(() => import('./pages/guard/MyTasks'));

function roleHome(role: string): string {
  if (role === 'director') return '/director';
  if (role === 'range_officer') return '/officer';
  return '/guard';
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-ptr-cream flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-ptr-green flex items-center justify-center animate-pulse">
          <Leaf className="w-6 h-6 text-white" />
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
  if (user.role !== 'guard') return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

function Root() {
  const { loading } = useAuth();
  const user = useStore((s) => s.currentUser);
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(user.role)} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Root />} />
            <Route path="/login" element={<Login />} />

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
              <Route path="reports" element={<DirectorReports />} />
              <Route path="users" element={<DirectorUsers />} />
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
              <Route path="tasks/:id" element={<TaskDetailPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

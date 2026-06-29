import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import useStore from './store/useStore';
import Login from './pages/Login';
import Layout from './components/Layout';
import DirectorDashboard from './pages/director/Dashboard';
import DirectorTaskList from './pages/director/TaskList';
import DirectorReports from './pages/director/Reports';
import DirectorUsers from './pages/director/Users';
import OfficerDashboard from './pages/officer/Dashboard';
import OfficerTaskList from './pages/officer/TaskList';
import TaskDetailPage from './pages/shared/TaskDetailPage';
import GuardMyTasks from './pages/guard/MyTasks';

function roleHome(role: string): string {
  if (role === 'director') return '/director';
  if (role === 'range_officer') return '/officer';
  return '/guard';
}

function ProtectedDirector({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.currentUser);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'director') return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

function ProtectedOfficer({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.currentUser);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'range_officer') return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

function ProtectedGuard({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.currentUser);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'guard') return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

function Root() {
  const user = useStore((s) => s.currentUser);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(user.role)} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
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
    </BrowserRouter>
    </QueryClientProvider>
  );
}

import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useStore from './store/useStore';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/admin/Dashboard';
import AdminTaskList from './pages/admin/TaskList';
import AdminTaskDetailPage from './pages/admin/TaskDetailPage';
import StaffMyTasks from './pages/staff/MyTasks';
import StaffTaskDetailPage from './pages/staff/TaskDetailPage';

function ProtectedAdmin({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.currentUser);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/staff" replace />;
  return <>{children}</>;
}

function ProtectedStaff({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.currentUser);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'staff') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function Root() {
  const user = useStore((s) => s.currentUser);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/staff'} replace />;
}

export default function App() {
  return (
    <BrowserRouter basename="/ERP---PTR">
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedAdmin>
              <Layout />
            </ProtectedAdmin>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<AdminTaskList />} />
          <Route path="tasks/:id" element={<AdminTaskDetailPage />} />
        </Route>
        <Route
          path="/staff"
          element={
            <ProtectedStaff>
              <Layout />
            </ProtectedStaff>
          }
        >
          <Route index element={<StaffMyTasks />} />
          <Route path="tasks/:id" element={<StaffTaskDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

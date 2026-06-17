import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

const LoginPage        = lazy(() => import('./pages/LoginPage'));
const AdminDashboard   = lazy(() => import('./pages/admin/Dashboard'));
const CoachesPage      = lazy(() => import('./pages/admin/CoachesPage'));
const TaskBoard        = lazy(() => import('./pages/admin/TaskBoard'));
const AssignTask       = lazy(() => import('./pages/admin/AssignTask'));
const AgentDashboard   = lazy(() => import('./pages/admin/AgentDashboard'));
const AutoFixesPage    = lazy(() => import('./pages/admin/AutoFixesPage'));
const CoachDashboard   = lazy(() => import('./pages/coach/Dashboard'));
const MyTasks          = lazy(() => import('./pages/coach/MyTasks'));
const FeedbackPage     = lazy(() => import('./pages/coach/FeedbackPage'));
const SuperAdminOverview = lazy(() => import('./pages/super-admin/Overview'));
const SuperAdminRegion   = lazy(() => import('./pages/super-admin/RegionDetail'));
const SuperAdminAdmins   = lazy(() => import('./pages/super-admin/ManageAdmins'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-dvh bg-primary-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      <p className="text-sm text-primary-600 font-medium font-sans">Loading…</p>
    </div>
  </div>
);

const AdminLayout = () => (
  <ProtectedRoute requiredRole="admin" component={() => <Layout role="admin" />} />
);

const CoachLayout = () => (
  <ProtectedRoute requiredRole="coach" component={() => <Layout role="coach" />} />
);

const SuperAdminLayout = () => (
  <ProtectedRoute requiredRole="super_admin" component={() => <Layout role="super_admin" />} />
);

const RoleRedirect = () => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  try {
    const { role } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (role === 'super_admin') return <Navigate to="/super-admin/overview" replace />;
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/coach/dashboard" replace />;
  } catch {
    return <Navigate to="/login" replace />;
  }
};

const App = () => (
  <>
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          fontFamily: "'Inter', sans-serif",
          fontSize: '14px',
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)',
        },
        success: { iconTheme: { primary: '#0d9488', secondary: '#fff' } },
        error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
      }}
    />
    <Router>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/coaches"   element={<CoachesPage />} />
              <Route path="/admin/tasks"     element={<TaskBoard />} />
              <Route path="/admin/assign"            element={<AssignTask />} />
              <Route path="/admin/agent-dashboard"  element={<AgentDashboard />} />
              <Route path="/admin/auto-fixes"        element={<AutoFixesPage />} />
              <Route path="/admin"           element={<Navigate to="/admin/dashboard" replace />} />
            </Route>

            <Route element={<CoachLayout />}>
              <Route path="/coach/dashboard" element={<CoachDashboard />} />
              <Route path="/coach/tasks"     element={<MyTasks />} />
              <Route path="/coach/feedback"  element={<FeedbackPage />} />
              <Route path="/coach"           element={<Navigate to="/coach/dashboard" replace />} />
            </Route>

            <Route element={<SuperAdminLayout />}>
              <Route path="/super-admin/overview"   element={<SuperAdminOverview />} />
              <Route path="/super-admin/region/:id" element={<SuperAdminRegion />} />
              <Route path="/super-admin/admins"     element={<SuperAdminAdmins />} />
              <Route path="/super-admin"            element={<Navigate to="/super-admin/overview" replace />} />
            </Route>

            <Route path="/"  element={<RoleRedirect />} />
            <Route path="*"  element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  </>
);

export default App;

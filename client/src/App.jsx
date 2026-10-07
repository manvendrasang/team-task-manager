import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';

import Layout from './components/layout/Layout';
import Login from './components/auth/Login';
import Register from './components/auth/Register';

// Route-level code splitting: the auth screens aren't needed by signed-in users
// and vice versa, so neither has to be in the first chunk.
const Dashboard     = lazy(() => import(/* webpackChunkName: "dashboard" */ './components/dashboard/Dashboard'));
const ProjectList   = lazy(() => import(/* webpackChunkName: "projects" */ './components/projects/ProjectList'));
const ProjectDetail = lazy(() => import(/* webpackChunkName: "projects" */ './components/projects/ProjectDetail'));
const MyTasks       = lazy(() => import(/* webpackChunkName: "my-tasks" */ './components/tasks/MyTasks'));
const Warnings      = lazy(() => import(/* webpackChunkName: "warnings" */ './components/warnings/MyWarnings'));

const LoadingScreen = () => (
  <div className="loading-screen">
    <div style={{ display: 'flex', gap: 8 }} role="status" aria-label="Loading">
      <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to={location.state?.from || '/dashboard'} replace />;
  return children;
};

const NotFound = () => (
  <div className="notfound-page fade-in">
    <div className="notfound-code">404</div>
    <h1>Page not found</h1>
    <p>The page you're looking for doesn't exist or has been moved.</p>
    <a className="btn btn-primary" href="/dashboard">Back to dashboard</a>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
                  <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

                  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard"    element={<Dashboard />} />
                    <Route path="projects"     element={<ProjectList />} />
                    <Route path="projects/:id" element={<ProjectDetail />} />
                    <Route path="my-tasks"     element={<MyTasks />} />
                    <Route path="warnings"     element={<Warnings />} />
                    <Route path="*"            element={<NotFound />} />
                  </Route>

                  {/* Unmatched URLs outside the authenticated shell too */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
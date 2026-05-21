import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { api } from './lib/api';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { useOfflineSync } from './hooks/useOfflineSync';
import { I18nProvider } from './lib/i18n';
import ErrorBoundary from './components/ErrorBoundary';
import { DashboardSkeleton } from './components/Skeleton';

// Route-level code splitting — each page loads only when navigated to
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ShopDashboard = lazy(() => import('./pages/ShopDashboard'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const DistributorDashboard = lazy(() => import('./pages/DistributorDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const CADashboard = lazy(() => import('./pages/CADashboard'));

const PageLoader = () => (
  <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid rgba(139,92,246,0.2)', borderTop: '3px solid #8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
      <p style={{ color: '#475569', fontSize: '13px', fontFamily: 'Outfit, sans-serif' }}>Loading MyStore OS...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

const PrivateRoute = ({ children, role }) => {
  const { user, authLoading } = useAuth();
  if (authLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;
  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(user.role)) return <Navigate to="/" />;
  }
  return children;
};

const RoleRouter = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  switch (user.role) {
    case 'shop':        return <Navigate to="/shop" />;
    case 'staff':       return <Navigate to="/shop" />;
    case 'customer':    return <Navigate to="/user" />;
    case 'distributor': return <Navigate to="/distributor" />;
    case 'admin':       return <Navigate to="/admin" />;
    case 'ca':          return <Navigate to="/ca" />;
    default:            return <Navigate to="/login" />;
  }
};

const AppLayout = ({ children }) => <div className="app-container">{children}</div>;
const WideAppLayout = ({ children }) => <div className="app-container wide-layout">{children}</div>;

function App() {
  useOfflineSync();
  const [customCSS, setCustomCSS] = useState('');

  useEffect(() => {
    api.getSiteConfig('customCSS', '').then(setCustomCSS).catch(() => {});
    const handler = (e) => setCustomCSS(e.detail || '');
    window.addEventListener('custom-css-updated', handler);
    return () => window.removeEventListener('custom-css-updated', handler);
  }, []);

  return (
    <ErrorBoundary fullPage>
      <I18nProvider>
        <AuthProvider>
          {customCSS && <style dangerouslySetInnerHTML={{ __html: customCSS }} />}
          <BrowserRouter>
            <Suspense fallback={<DashboardSkeleton />}>
              <Routes>
                <Route path="/" element={
                  <ErrorBoundary fullPage><LandingPage /></ErrorBoundary>
                } />

                <Route path="/login" element={
                  <ErrorBoundary fullPage><AppLayout><Login /></AppLayout></ErrorBoundary>
                } />
                <Route path="/register" element={
                  <ErrorBoundary fullPage><AppLayout><Register /></AppLayout></ErrorBoundary>
                } />

                <Route path="/s/:shopId" element={
                  <ErrorBoundary fullPage><WideAppLayout><UserDashboard /></WideAppLayout></ErrorBoundary>
                } />

                <Route path="/dashboard" element={<RoleRouter />} />
                <Route path="/shop/*" element={
                  <PrivateRoute role={['shop', 'staff']}>
                    <ErrorBoundary fullPage><WideAppLayout><ShopDashboard /></WideAppLayout></ErrorBoundary>
                  </PrivateRoute>
                } />
                <Route path="/user/*" element={
                  <PrivateRoute role="customer">
                    <ErrorBoundary fullPage><WideAppLayout><UserDashboard /></WideAppLayout></ErrorBoundary>
                  </PrivateRoute>
                } />
                <Route path="/distributor/*" element={
                  <PrivateRoute role="distributor">
                    <ErrorBoundary fullPage><WideAppLayout><DistributorDashboard /></WideAppLayout></ErrorBoundary>
                  </PrivateRoute>
                } />
                <Route path="/admin/*" element={
                  <PrivateRoute role="admin">
                    <ErrorBoundary fullPage><AdminDashboard /></ErrorBoundary>
                  </PrivateRoute>
                } />
                <Route path="/ca/*" element={
                  <PrivateRoute role="ca">
                    <ErrorBoundary fullPage><WideAppLayout><CADashboard /></WideAppLayout></ErrorBoundary>
                  </PrivateRoute>
                } />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;

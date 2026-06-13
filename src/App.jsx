import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, lazy, Suspense } from 'react';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { useOfflineSync } from './hooks/useOfflineSync';
import { I18nProvider } from './lib/i18n';
import { SiteConfigProvider, useSiteConfig } from './lib/siteConfig';
import ErrorBoundary from './components/ErrorBoundary';
import { DashboardSkeleton } from './components/Skeleton';

// Route-level code splitting — each page loads only when navigated to
const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const AuthReset = lazy(() => import('./pages/AuthReset'));
const Register = lazy(() => import('./pages/Register'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ShopDashboard = lazy(() => import('./pages/ShopDashboard'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const DistributorDashboard = lazy(() => import('./pages/DistributorDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const CADashboard = lazy(() => import('./pages/CADashboard'));
const AlternativeComparison = lazy(() => import('./pages/AlternativeComparison'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const Support = lazy(() => import('./pages/Support'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const WaitingApproval = lazy(() => import('./pages/WaitingApproval'));
const StateLanding = lazy(() => import('./pages/StateLanding'));
const BlogIndex = lazy(() => import('./pages/BlogIndex'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const Pricing = lazy(() => import('./pages/Pricing'));
const AffiliateDashboard = lazy(() => import('./pages/AffiliateDashboard'));

const PageLoader = () => (
  <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid rgba(139,92,246,0.2)', borderTop: '3px solid #8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
      <p style={{ color: '#475569', fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Loading MyStore OS...</p>
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
  if (user.status === 'pending') return <Navigate to="/waiting" />;
  switch (user.role) {
    case 'shop':        return <Navigate to="/shop" />;
    case 'staff':       return <Navigate to="/shop" />;
    case 'customer':    return <Navigate to="/user" />;
    case 'distributor': return <Navigate to="/distributor" />;
    case 'admin':       return <Navigate to="/admin" />;
    case 'ca':          return <Navigate to="/ca" />;
    case 'affiliate':   return <Navigate to="/affiliate" />;
    default:            return <Navigate to="/login" />;
  }
};

const PendingRoute = ({ children }) => {
  const { user, authLoading } = useAuth();
  if (authLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;
  if (user.status !== 'pending') return <Navigate to="/dashboard" />;
  return children;
};

const AppLayout = ({ children }) => <div className="app-container">{children}</div>;
const WideAppLayout = ({ children }) => <div className="app-container wide-layout">{children}</div>;

const BANNER_COLORS = { info: '#3b82f6', warning: '#f59e0b', success: '#10b981', error: '#ef4444' };

function AnnouncementBanner() {
  const { config } = useSiteConfig();
  const [dismissedKey, setDismissedKey] = useState(() => { try { return sessionStorage.getItem('ann_dismissed') || ''; } catch { return ''; } });
  const dismissed = dismissedKey === config.announcementText;
  if (!config.announcementActive || !config.announcementText || dismissed) return null;
  return (
    <div style={{ background: BANNER_COLORS[config.announcementType] || '#3b82f6', color: '#fff', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <span>{config.announcementText}</span>
      <button onClick={() => { try { sessionStorage.setItem('ann_dismissed', config.announcementText); } catch (_e) { /* ignore */ } setDismissedKey(config.announcementText); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }} aria-label="Dismiss">×</button>
    </div>
  );
}

function MaintenanceModeOverlay() {
  const { config } = useSiteConfig();
  const { user } = useAuth();
  if (!config.maintenanceMode || user?.role === 'admin') return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f172a', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div style={{ fontSize: '48px' }}>🔧</div>
      <h2 style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 700 }}>Under Maintenance</h2>
      <p style={{ color: '#94a3b8', fontSize: '15px', textAlign: 'center', maxWidth: '400px' }}>{config.maintenanceMessage || 'We are performing scheduled maintenance. Back soon!'}</p>
    </div>
  );
}

function App() {
  useOfflineSync();

  return (
    <ErrorBoundary fullPage>
      <I18nProvider>
        <SiteConfigProvider>
          <AuthProvider>
          <BrowserRouter>
              <AnnouncementBanner />
              <MaintenanceModeOverlay />
              <Routes>
                <Route path="/" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><LandingPage /></ErrorBoundary>
                  </Suspense>
                } />

                <Route path="/alternative/:competitor" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><AlternativeComparison /></ErrorBoundary>
                  </Suspense>
                } />

                <Route path="/about" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><AboutUs /></ErrorBoundary>
                  </Suspense>
                } />
                <Route path="/privacy" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><PrivacyPolicy /></ErrorBoundary>
                  </Suspense>
                } />
                <Route path="/terms" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><TermsOfService /></ErrorBoundary>
                  </Suspense>
                } />
                <Route path="/contact" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><ContactUs /></ErrorBoundary>
                  </Suspense>
                } />
                <Route path="/support" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><Support /></ErrorBoundary>
                  </Suspense>
                } />

                <Route path="/pricing" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><Pricing /></ErrorBoundary>
                  </Suspense>
                } />
                <Route path="/blog" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><BlogIndex /></ErrorBoundary>
                  </Suspense>
                } />
                <Route path="/blog/:slug" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><BlogPost /></ErrorBoundary>
                  </Suspense>
                } />
                <Route path="/in/:state" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><StateLanding /></ErrorBoundary>
                  </Suspense>
                } />

                <Route path="/login" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><AppLayout><Login /></AppLayout></ErrorBoundary>
                  </Suspense>
                } />
                <Route path="/register" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><AppLayout><Register /></AppLayout></ErrorBoundary>
                  </Suspense>
                } />

                <Route path="/auth/callback" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><AuthCallback /></ErrorBoundary>
                  </Suspense>
                } />
                <Route path="/auth/reset" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><AuthReset /></ErrorBoundary>
                  </Suspense>
                } />

                <Route path="/s/:shopId" element={
                  <Suspense fallback={<DashboardSkeleton />}>
                    <ErrorBoundary fullPage><WideAppLayout><UserDashboard /></WideAppLayout></ErrorBoundary>
                  </Suspense>
                } />

                <Route path="/onboarding" element={
                  <PendingRoute>
                    <Suspense fallback={<PageLoader />}>
                      <ErrorBoundary fullPage><Onboarding /></ErrorBoundary>
                    </Suspense>
                  </PendingRoute>
                } />
                <Route path="/waiting" element={
                  <PendingRoute>
                    <Suspense fallback={<PageLoader />}>
                      <ErrorBoundary fullPage><WaitingApproval /></ErrorBoundary>
                    </Suspense>
                  </PendingRoute>
                } />

                <Route path="/dashboard" element={<RoleRouter />} />
                <Route path="/shop/*" element={
                  <PrivateRoute role={['shop', 'staff']}>
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><WideAppLayout><ShopDashboard /></WideAppLayout></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
                <Route path="/user/*" element={
                  <PrivateRoute role="customer">
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><WideAppLayout><UserDashboard /></WideAppLayout></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
                <Route path="/distributor/*" element={
                  <PrivateRoute role="distributor">
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><WideAppLayout><DistributorDashboard /></WideAppLayout></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
                <Route path="/admin/*" element={
                  <PrivateRoute role="admin">
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><AdminDashboard /></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
                <Route path="/ca/*" element={
                  <PrivateRoute role="ca">
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><WideAppLayout><CADashboard /></WideAppLayout></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
                <Route path="/affiliate/*" element={
                  <PrivateRoute role="affiliate">
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><AffiliateDashboard /></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
              </Routes>
          </BrowserRouter>
          </AuthProvider>
        </SiteConfigProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;

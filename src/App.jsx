import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { isNativeApp } from './lib/capacitorInit';
import { isSupabaseConfigured } from './lib/supabase';
import { useState, lazy, Suspense } from 'react';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { useOfflineSync } from './hooks/useOfflineSync';
import { I18nProvider } from './lib/i18n';
import { SiteConfigProvider, useSiteConfig } from './lib/siteConfig';
import ErrorBoundary from './components/ErrorBoundary';
import PushNavigationBridge from './components/PushNavigationBridge';
import NativePushRegistration from './components/NativePushRegistration';
import { DashboardSkeleton } from './components/Skeleton';

// Route-level code splitting — each page loads only when navigated to
const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const AuthReset = lazy(() => import('./pages/AuthReset'));
const Register = lazy(() => import('./pages/Register'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const NativeWelcome = lazy(() => import('./pages/NativeWelcome'));
const ShopDashboard = lazy(() => import('./pages/ShopDashboard'));
const ZohoStyleShell = lazy(() => import('./components/ZohoStyleShell'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const ManageBooking = lazy(() => import('./pages/ManageBooking'));
const DistributorDashboard = lazy(() => import('./pages/DistributorDashboard'));
// Field distribution — separate chunk so reps don't download the full
// distributor dashboard they mostly don't need.
const FieldSetup = lazy(() => import('./pages/field/FieldSetup'));
const FieldLoadOut = lazy(() => import('./pages/field/FieldLoadOut'));
const FieldStock = lazy(() => import('./pages/field/FieldStock'));
const FieldRoutes = lazy(() => import('./pages/field/FieldRoutes'));
const FieldRun = lazy(() => import('./pages/field/FieldRun'));
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

// Forces a full ShopDashboard remount when switching between main (/shop)
// and a branch (/shop/branch/:branchId). Without the key prop, React reuses
// the same component instance and only updates props — activeTab, orders,
// products etc all persist from the previous context causing visible stale data.
const BranchKeyWrapper = () => {
  const { branchId } = useParams();
  return (
    <ErrorBoundary fullPage>
      <WideAppLayout>
        <ShopDashboard key={`branch-${branchId}`} />
      </WideAppLayout>
    </ErrorBoundary>
  );
};

const RoleRouter = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (user.status === 'pending') {
    // Resume-onboarding: shop/distributor who haven't completed the
    // onboarding form yet get sent back to finish it, instead of being
    // stuck on /waiting with a half-filled profile that admin can't
    // approve. onboardingCompleted defaults to true in toUser when the
    // column isn't yet present, so existing pending shops aren't affected.
    if ((user.role === 'shop' || user.role === 'distributor') && user.onboardingCompleted === false) {
      return <Navigate to="/onboarding" />;
    }
    return <Navigate to="/waiting" />;
  }
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

// Persistent, high-visibility warning shown at the top of EVERY screen
// when the build has no real Supabase URL. In that state the app runs on
// local IndexedDB mock data — the super admin panel shows fake numbers,
// bills don't sync, no data is real. This banner ensures the mistake is
// caught within seconds of opening the app, instead of silently rolling
// out to production users. The banner never appears on healthy builds.
function MockDataWarningBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100000,
      background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
      color: '#fff', padding: '10px 16px', textAlign: 'center',
      fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
    }}>
      ⚠️ This build has no database connection — showing DEMO DATA.
      &nbsp;Set VITE_SUPABASE_URL and rebuild.
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
              <PushNavigationBridge />
              <NativePushRegistration />
              <MockDataWarningBanner />
              <AnnouncementBanner />
              <MaintenanceModeOverlay />
              <Routes>
                <Route path="/preview" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><ZohoStyleShell shopName="Karthikeya" shopCode="SHP-H9U6F6" /></ErrorBoundary>
                  </Suspense>
                } />
                <Route path="/" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage>
                      {isNativeApp() ? <NativeWelcome /> : <LandingPage />}
                    </ErrorBoundary>
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

                <Route path="/manage-booking/:token" element={
                  <Suspense fallback={<PageLoader />}>
                    <ErrorBoundary fullPage><ManageBooking /></ErrorBoundary>
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
                <Route path="/shop" element={
                  <PrivateRoute role={['shop', 'staff']}>
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><WideAppLayout><ShopDashboard key="main" /></WideAppLayout></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
                <Route path="/shop/branch/:branchId" element={
                  <PrivateRoute role={['shop', 'staff']}>
                    <Suspense fallback={<DashboardSkeleton />}>
                      <BranchKeyWrapper />
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
                {/* Field distribution. A separate top-level path rather
                    than /distributor/field, because /distributor/* is a
                    wildcard that would otherwise swallow it. */}
                <Route path="/field/setup" element={
                  <PrivateRoute role="distributor">
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><WideAppLayout><FieldSetup /></WideAppLayout></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
                <Route path="/field/run" element={
                  <PrivateRoute role="distributor">
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><WideAppLayout><FieldRun /></WideAppLayout></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
                <Route path="/field/routes" element={
                  <PrivateRoute role="distributor">
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><WideAppLayout><FieldRoutes /></WideAppLayout></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
                <Route path="/field/stock" element={
                  <PrivateRoute role="distributor">
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><WideAppLayout><FieldStock /></WideAppLayout></ErrorBoundary>
                    </Suspense>
                  </PrivateRoute>
                } />
                <Route path="/field/loadout" element={
                  <PrivateRoute role="distributor">
                    <Suspense fallback={<DashboardSkeleton />}>
                      <ErrorBoundary fullPage><WideAppLayout><FieldLoadOut /></WideAppLayout></ErrorBoundary>
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

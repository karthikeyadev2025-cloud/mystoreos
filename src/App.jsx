import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from './lib/api';
import Login from './pages/Login';
import Register from './pages/Register';
import ShopDashboard from './pages/ShopDashboard';
import UserDashboard from './pages/UserDashboard';
import DistributorDashboard from './pages/DistributorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LandingPage from './pages/LandingPage';
import CADashboard from './pages/CADashboard';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { useOfflineSync } from './hooks/useOfflineSync';

const PrivateRoute = ({ children, role }) => {
  const { user } = useAuth();
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
    case 'shop': return <Navigate to="/shop" />;
    case 'staff': return <Navigate to="/shop" />;
    case 'customer': return <Navigate to="/user" />;
    case 'distributor': return <Navigate to="/distributor" />;
    case 'admin': return <Navigate to="/admin" />;
    case 'ca': return <Navigate to="/ca" />;
    default: return <Navigate to="/login" />;
  }
};

const AppLayout = ({ children }) => <div className="app-container">{children}</div>;
const WideAppLayout = ({ children }) => <div className="app-container wide-layout">{children}</div>;

function App() {
  useOfflineSync(); // background: auto-flushes offline write queue on reconnect
  const [customCSS, setCustomCSS] = useState('');

  useEffect(() => {
    const loadCSS = async () => {
      try {
        const cssConfig = await api.getSiteConfig('customCSS', '');
        setCustomCSS(cssConfig);
      } catch (e) {
        console.error("Failed to load global custom CSS", e);
      }
    };
    loadCSS();

    const handleCSSUpdate = (e) => {
      setCustomCSS(e.detail || '');
    };
    window.addEventListener('custom-css-updated', handleCSSUpdate);
    return () => {
      window.removeEventListener('custom-css-updated', handleCSSUpdate);
    };
  }, []);

  return (
    <AuthProvider>
      <style dangerouslySetInnerHTML={{ __html: customCSS }} />
      <BrowserRouter>
        <Routes>
          {/* Full Screen Routes */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Mobile App Layout Routes */}
          <Route path="/login" element={<AppLayout><Login /></AppLayout>} />
          <Route path="/register" element={<AppLayout><Register /></AppLayout>} />
          
          <Route path="/s/:shopId" element={<WideAppLayout><UserDashboard /></WideAppLayout>} />
          
          <Route path="/dashboard" element={<RoleRouter />} />
          <Route path="/shop/*" element={
            <PrivateRoute role={['shop', 'staff']}><WideAppLayout><ShopDashboard /></WideAppLayout></PrivateRoute>
          } />
          <Route path="/user/*" element={
            <PrivateRoute role="customer"><WideAppLayout><UserDashboard /></WideAppLayout></PrivateRoute>
          } />
          <Route path="/distributor/*" element={
            <PrivateRoute role="distributor"><WideAppLayout><DistributorDashboard /></WideAppLayout></PrivateRoute>
          } />
          <Route path="/admin/*" element={
            <PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>
          } />
          <Route path="/ca/*" element={
            <PrivateRoute role="ca"><WideAppLayout><CADashboard /></WideAppLayout></PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

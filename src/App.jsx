import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ShopDashboard from './pages/ShopDashboard';
import UserDashboard from './pages/UserDashboard';
import DistributorDashboard from './pages/DistributorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LandingPage from './pages/LandingPage';
import { useAuth } from './hooks/useAuth';

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
    default: return <Navigate to="/login" />;
  }
};

const AppLayout = ({ children }) => <div className="app-container">{children}</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Full Screen Routes */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Mobile App Layout Routes */}
        <Route path="/login" element={<AppLayout><Login /></AppLayout>} />
        <Route path="/register" element={<AppLayout><Register /></AppLayout>} />
        
        <Route path="/s/:shopId" element={<AppLayout><UserDashboard /></AppLayout>} />
        
        <Route path="/dashboard" element={<RoleRouter />} />
        <Route path="/shop/*" element={
          <PrivateRoute role={['shop', 'staff']}><AppLayout><ShopDashboard /></AppLayout></PrivateRoute>
        } />
        <Route path="/user/*" element={
          <PrivateRoute role="customer"><AppLayout><UserDashboard /></AppLayout></PrivateRoute>
        } />
        <Route path="/distributor/*" element={
          <PrivateRoute role="distributor"><AppLayout><DistributorDashboard /></AppLayout></PrivateRoute>
        } />
        <Route path="/admin/*" element={
          <PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

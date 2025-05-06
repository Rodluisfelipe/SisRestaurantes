import { Routes, Route, Navigate, useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./Context/AuthContext";
import Menu from "./Pages/Menu";
import Admin from "./Pages/Admin";
import Login from "./Pages/Login";
import Kitchen from "./Pages/Kitchen";
import { BusinessProvider, useBusinessConfig } from './Context/BusinessContext';
import { AuthProvider } from './Context/AuthContext';
import { useEffect } from "react";

// Componente protegido para rutas que requieren autenticación
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { businessId } = useParams();
  const location = useLocation();
  
  if (loading) return null; // O un spinner si prefieres

  // Si hay token en localStorage, consideramos que tiene sesión
  const hasToken = Boolean(localStorage.getItem('accessToken'));
  
  // Check for SuperAdmin parameters in URL
  const params = new URLSearchParams(location.search);
  const hasSuperAdminToken = params.get('satoken') || params.get('source') === 'superadmin';
  
  // Allow access if it's a SuperAdmin request
  if (hasSuperAdminToken) {
    return children;
  }
  
  // Solo redirige si no tiene token Y no está autenticado
  if (!hasToken && !isAuthenticated) {
    return <Navigate to={`/${businessId}/login`} replace />;
  }

  return children;
};

function BusinessProviderWrapper({ children }) {
  const { businessId } = useParams();
  console.log('BusinessProviderWrapper - businessId from URL:', businessId);
  return <BusinessProvider businessId={businessId}>{children}</BusinessProvider>;
}

function App() {
  return (
    <AuthProvider>
        <Routes>
        <Route
          path="/:businessId"
          element={
            <BusinessProviderWrapper>
              <Menu />
            </BusinessProviderWrapper>
          }
        />
        <Route
          path="/:businessId/mesa/:tableNumber"
          element={
            <BusinessProviderWrapper>
              <Menu />
            </BusinessProviderWrapper>
          }
        />
          <Route 
          path=":businessId/admin/*"
            element={
            <BusinessProviderWrapper>
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            </BusinessProviderWrapper>
            } 
          />
          <Route 
            path=":businessId/kitchen"
            element={
              <BusinessProviderWrapper>
                <ProtectedRoute>
                  <Kitchen />
                </ProtectedRoute>
              </BusinessProviderWrapper>
            } 
          />
          <Route path="/login" element={<Login />} />
          <Route
            path=":businessId/login"
            element={
              <BusinessProviderWrapper>
                <Login />
              </BusinessProviderWrapper>
            }
          />
        <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
    </AuthProvider>
  );
}

export default App;

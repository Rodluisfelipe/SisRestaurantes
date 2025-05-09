import { Routes, Route, Navigate, useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./Context/AuthContext";
import Menu from "./Pages/Menu";
import Admin from "./Pages/Admin";
import Login from "./Pages/Login";
import Kitchen from "./Pages/Kitchen";
import { BusinessProvider, useBusinessConfig } from './Context/BusinessContext';
import { AuthProvider } from './Context/AuthContext';
import { useEffect } from "react";
import { getBusinessSlug } from './utils/getBusinessId';

// Componente protegido para rutas que requieren autenticación
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { businessId } = useParams();
  const location = useLocation();
  
  if (loading) return null;

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

// Componente para manejar la redirección inicial
function RootRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const redirectToBusinessPage = async () => {
      // Si ya estamos en una ruta específica que no sea la raíz, no hacer nada
      if (location.pathname !== '/') return;

      // Intentar obtener el slug del negocio
      const slug = getBusinessSlug();
      
      if (slug) {
        // Si tenemos un slug y no estamos ya en esa ruta, redirigir al menú del negocio
        if (location.pathname !== `/${slug}`) {
          navigate(`/${slug}`, { replace: true });
        }
      } else {
        // Si no hay slug, redirigir al login general
        navigate('/login', { replace: true });
      }
    };

    redirectToBusinessPage();
  }, [navigate, location]);

  return null;
}

function App() {
  return (
    <AuthProvider>
        <Routes>
          {/* Rutas específicas primero */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          
          {/* Rutas con businessId */}
          <Route
            path="/:businessId/login"
            element={
              <BusinessProviderWrapper>
                <Login />
              </BusinessProviderWrapper>
            }
          />
          <Route 
            path="/:businessId/admin/*"
            element={
              <BusinessProviderWrapper>
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              </BusinessProviderWrapper>
            } 
          />
          <Route 
            path="/:businessId/kitchen"
            element={
              <BusinessProviderWrapper>
                <ProtectedRoute>
                  <Kitchen />
                </ProtectedRoute>
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
            path="/:businessId"
            element={
              <BusinessProviderWrapper>
                <Menu />
              </BusinessProviderWrapper>
            }
          />
        </Routes>
    </AuthProvider>
  );
}

export default App;

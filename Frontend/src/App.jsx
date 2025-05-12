import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "./Context/AuthContext";
import { useState } from "react";

// Lazy load components
const HealthCheckLazy = lazy(() => import('./Pages/HealthCheck'));
import Menu from "./Pages/Menu";
import Admin from "./Pages/Admin";
import Login from "./Pages/Login";
import Kitchen from "./Pages/Kitchen";
import SuperAdminDashboard from "./Pages/SuperAdmin/SuperAdminDashboard";
import { BusinessProvider } from './Context/BusinessContext';
import { AuthProvider } from './Context/AuthContext';
import LandingHome from "./Pages/Landing/Home";
import LandingLogin from "./Pages/Landing/Login";
import LandingRegister from "./Pages/Landing/Register";
import LandingFeatures from "./Pages/Landing/Features";
import LandingContact from "./Pages/Landing/Contact";
import LandingPricing from "./Pages/Landing/Pricing";
import LandingLayout from "./Layouts/LandingLayout";
import NotFound from "./Pages/NotFound";
import TableValidator from "./Components/TableValidator";

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

// Componente que verifica si un negocio existe
function BusinessProviderWrapper({ children }) {
  const { businessId } = useParams();
  const [businessNotFound, setBusinessNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  
  console.log('BusinessProviderWrapper - businessId from URL:', businessId);
  
  // Si el negocio no existe, mostrar la página NotFound
  if (businessNotFound) {
    return <NotFound />;
  }
  
  return (
    <BusinessProvider 
      businessId={businessId}
      onError={(error) => {
        console.error('BusinessProviderWrapper - Error detectado:', error);
        
        // Si es un error 404 o no se pudo encontrar el negocio, mostrar NotFound
        if (error?.response?.status === 404 || 
            error?.type === 'INVALID_ID' || 
            (error?.message && error?.message.includes('not found'))) {
          console.log('BusinessProviderWrapper - Negocio no encontrado, mostrando NotFound');
          setBusinessNotFound(true);
        }
        
        setLoading(false);
      }}
      onLoaded={() => {
        setLoading(false);
      }}
    >
      {loading ? (
        <div className="min-h-screen bg-[#051C2C] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3A7AFF]"></div>
        </div>
      ) : children}
    </BusinessProvider>
  );
}

// Lista de rutas reservadas que no deben tratarse como IDs de negocio
const RESERVED_PATHS = ['login', 'register', 'features', 'contact', 'pricing', 'about', 'terms'];

function App() {
  return (
    <AuthProvider>
        <Routes>
        {/* Rutas de administración - SuperAdmin */}
        <Route path="/superadmin/*" element={<SuperAdminDashboard />} />
        <Route path="/reset-password/:token" element={<SuperAdminDashboard />} />
        
        {/* Rutas de la Landing Page con layout compartido - IMPORTANTE: Deben ir ANTES de las rutas de negocio */}
        <Route element={<LandingLayout />}>
          <Route path="/" element={<LandingHome />} />
          <Route path="/login" element={<LandingLogin />} />
          <Route path="/register" element={<LandingRegister />} />
          <Route path="/features" element={<LandingFeatures />} />
          <Route path="/contact" element={<LandingContact />} />
          <Route path="/pricing" element={<LandingPricing />} /> 
          <Route path="/about" element={<LandingHome />} /> 
          <Route path="/terms" element={<LandingHome />} /> 
        </Route>
        
        {/* Health check endpoint para Uptime Robot */}
        <Route path="/health" element={
          <Suspense fallback={<div>Loading...</div>}>
            <HealthCheckLazy />
          </Suspense>
        } />
        
        {/* Ruta de login para app móvil */}
        <Route path="/app-login" element={<Login />} />
        
        {/* Rutas específicas de negocios */}
        <Route
          path="/:businessId/mesa/:tableNumber"
          element={
            <BusinessProviderWrapper>
              <TableValidator>
                <Menu />
              </TableValidator>
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
          path="/:businessId/login"
            element={
              <BusinessProviderWrapper>
                <Login />
              </BusinessProviderWrapper>
            }
          />
        
        {/* Ruta genérica para ID de negocio - IMPORTANTE: debe ir después de las rutas específicas */}
        <Route
          path="/:businessId/*"
          element={
            <BusinessProviderWrapper>
              <Menu />
            </BusinessProviderWrapper>
          }
        />
        
        {/* Ruta para páginas no encontradas */}
        <Route path="*" element={<NotFound />} />
        </Routes>
    </AuthProvider>
  );
}

export default App;

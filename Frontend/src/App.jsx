import React, { Suspense, lazy, useCallback } from "react";
import { Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "./Context/AuthContext";
import { useState } from "react";

// Lazy load heavy components for code-splitting
const HealthCheckLazy = lazy(() => import('./Pages/HealthCheck'));
const Menu = lazy(() => import("./Pages/Menu"));
const Admin = lazy(() => import("./Pages/Admin"));
const Kitchen = lazy(() => import("./Pages/Kitchen"));
const POS = lazy(() => import("./Pages/POS"));
const SuperAdminDashboard = lazy(() => import("./Pages/SuperAdmin/SuperAdminDashboard"));
const DomiPage = lazy(() => import("./Components/Delivery/DomiPage"));
const DeliveryTracker = lazy(() => import("./Components/Delivery/DeliveryTracker"));
const DeliveryQRPage = lazy(() => import("./Components/Delivery/DeliveryQRPage"));
const MenuByCatalog = lazy(() => import("./Pages/Catalog/MenuByCatalog"));
const RestaurantDetail = lazy(() => import("./Pages/Catalog/RestaurantDetail"));
const LeadCapturePage = lazy(() => import("./Pages/LeadCapturePage"));
const PaymentResult = lazy(() => import("./Pages/PaymentResult"));

// Lazy load landing pages (solo se usan en la landing, no en app de restaurante)
const LandingHome = lazy(() => import("./Pages/Landing/Home"));
const LandingLogin = lazy(() => import("./Pages/Landing/Login"));
const LandingRegister = lazy(() => import("./Pages/Landing/Register"));
const LandingFeatures = lazy(() => import("./Pages/Landing/Features"));
const LandingDemo = lazy(() => import("./Pages/Landing/Demo"));
const LandingContact = lazy(() => import("./Pages/Landing/Contact"));
const LandingPricing = lazy(() => import("./Pages/Landing/Pricing"));
const BlogIndex = lazy(() => import("./Pages/Blog/BlogIndex"));
const BlogPost = lazy(() => import("./Pages/Blog/BlogPost"));
const NichePage = lazy(() => import("./Pages/Landing/NichePage"));

import Login from "./Pages/Login";
import CustomerOrderDisplay from "./Components/CustomerOrderDisplay";
import { BusinessProvider } from './Context/BusinessContext';
import LandingLayout from "./Layouts/LandingLayout";
import CatalogLayout from "./Layouts/CatalogLayout";
import NotFound from "./Pages/NotFound";
import TableValidator from "./Components/TableValidator";
import DynamicManifest from "./Components/DynamicManifest";

// Componente protegido para rutas que requieren autenticación
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { businessId } = useParams();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-red-100" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin" style={{ animationDuration: '0.8s' }} />
          </div>
          <p className="text-slate-500 text-sm">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Rely on server-validated auth state from AuthContext, not raw localStorage
  if (!isAuthenticated) {
    return <Navigate to={`/${businessId}/login`} replace />;
  }

  return children;
};

// Componente que verifica si un negocio existe
function BusinessProviderWrapper({ children }) {
  const { businessId } = useParams();
  const [businessNotFound, setBusinessNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const handleError = useCallback((error) => {
    if (error?.response?.status === 404 || 
        error?.type === 'INVALID_ID' || 
        (error?.message && error?.message.includes('not found'))) {
      setBusinessNotFound(true);
    }
    setLoading(false);
  }, []);

  const handleLoaded = useCallback(() => {
    setLoading(false);
  }, []);
  
  // Si el negocio no existe, mostrar la página NotFound
  if (businessNotFound) {
    return <NotFound />;
  }
  
  return (
    <BusinessProvider 
      businessId={businessId}
      onError={handleError}
      onLoaded={handleLoaded}
    >
      <DynamicManifest />
      {loading ? (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            {/* Spinner limpio */}
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-red-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin" style={{ animationDuration: '0.8s' }} />
              <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-red-600 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.2s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg animate-pulse" />
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-red-600 mb-1">MenuBy</h2>
            <p className="text-slate-600 text-sm font-medium">Cargando...</p>
            
            <div className="flex justify-center space-x-1.5 mt-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms`, animationDuration: '1s' }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : children}
    </BusinessProvider>
  );
}

// Lista de rutas reservadas que no deben tratarse como IDs de negocio
const RESERVED_PATHS = ['login', 'register', 'features', 'demo', 'contact', 'pricing', 'about', 'terms', 'blog',
  'menu-digital-restaurante', 'menu-digital-bar', 'menu-digital-cafeteria', 'menu-digital-pizzeria',
  'menu-digital-hamburgueseria', 'menu-digital-hotel', 'menu-digital-food-truck', 'menu-digital-panaderia',
  'menu-digital-comida-rapida', 'menu-digital-sushi', 'menu-digital-asadero', 'menu-digital-heladeria',
  'restaurantes', 'health', 'superadmin', 'app-login'
];

function App() {
  return (
      <Routes>
        {/* Rutas de administración - SuperAdmin */}
        <Route path="/superadmin/*" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><SuperAdminDashboard /></Suspense>} />
        <Route path="/reset-password/:token" element={<Suspense fallback={<div>Loading...</div>}><SuperAdminDashboard /></Suspense>} />
        
        {/* Rutas del Catálogo MenuBy */}
        <Route element={<CatalogLayout />}>
          <Route path="/restaurantes" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><MenuByCatalog /></Suspense>} />
          <Route path="/restaurantes/restaurant/:restaurantId" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><RestaurantDetail /></Suspense>} />
        </Route>

        {/* Redirección de rutas antiguas para compatibilidad */}
        <Route path="/catalog" element={<Navigate to="/restaurantes" replace />} />
        <Route path="/catalog/*" element={<Navigate to="/restaurantes" replace />} />

        {/* Rutas de la Landing Page con layout compartido - IMPORTANTE: Deben ir ANTES de las rutas de negocio */}
        <Route element={<LandingLayout />}>
          <Route path="/" element={<LandingHome />} />
          <Route path="/login" element={<LandingLogin />} />
          <Route path="/register" element={<LandingRegister />} />
          <Route path="/features" element={<LandingFeatures />} />
          <Route path="/demo" element={<LandingDemo />} />
          <Route path="/contact" element={<LandingContact />} />
          <Route path="/pricing" element={<LandingPricing />} /> 
          <Route path="/blog" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><BlogIndex /></Suspense>} />
          <Route path="/blog/:slug" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><BlogPost /></Suspense>} />
          <Route path="/about" element={<LandingHome />} /> 
          <Route path="/terms" element={<LandingHome />} /> 
          {/* Niche SEO landing pages — explicit routes to avoid conflicts with /:businessId */}
          <Route path="/menu-digital-restaurante" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-bar" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-cafeteria" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-pizzeria" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-hamburgueseria" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-hotel" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-food-truck" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-panaderia" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-comida-rapida" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-sushi" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-asadero" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
          <Route path="/menu-digital-heladeria" element={<Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><NichePage /></Suspense>} />
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
                <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><Menu /></Suspense>
              </TableValidator>
            </BusinessProviderWrapper>
          }
        />
        
          <Route 
          path="/:businessId/admin/*"
            element={
            <BusinessProviderWrapper>
              <ProtectedRoute>
                <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><Admin /></Suspense>
              </ProtectedRoute>
            </BusinessProviderWrapper>
            } 
          />
        
          <Route 
          path="/:businessId/kitchen"
            element={
              <BusinessProviderWrapper>
                <ProtectedRoute>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><Kitchen /></Suspense>
                </ProtectedRoute>
              </BusinessProviderWrapper>
            } 
          />

          <Route 
          path="/:businessId/pos"
            element={
              <BusinessProviderWrapper>
                <ProtectedRoute>
                  <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><POS /></Suspense>
                </ProtectedRoute>
              </BusinessProviderWrapper>
            } 
          />
          
          {/* Customer Order Display - Public route for customers to track their orders */}
          <Route 
            path="/:businessId/orders"
            element={
              <BusinessProviderWrapper>
                <CustomerOrderDisplay />
              </BusinessProviderWrapper>
            }
          />

          {/* Payment Result - Public route for ePayco payment confirmation */}
          <Route 
            path="/:businessId/payment-result"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div></div>}>
                <PaymentResult />
              </Suspense>
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

        {/* Delivery: Domiciliario page */}
        <Route
          path="/:businessId/domi"
          element={
            <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}>
              <DomiPage />
            </Suspense>
          }
        />

        {/* Delivery: Client tracking page */}
        <Route
          path="/:businessId/track/:orderId"
          element={
            <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}>
              <DeliveryTracker />
            </Suspense>
          }
        />

        {/* Delivery: QR page (public, token-based) */}
        <Route
          path="/:businessId/delivery/:token"
          element={
            <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}>
              <DeliveryQRPage />
            </Suspense>
          }
        />

        <Route
          path="/:businessId/*"
          element={
            <BusinessProviderWrapper>
              <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>}><Menu /></Suspense>
            </BusinessProviderWrapper>
          }
        />
        
        {/* Ruta para captura de leads - URLs no encontradas se convierten en oportunidades */}
        <Route path="*" element={<Suspense fallback={<div>Loading...</div>}><LeadCapturePage /></Suspense>} />
        </Routes>
  );
}

export default App;

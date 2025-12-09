import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import BusinessSettings from "../Components/BusinessSettings";
import CategorySettings from "../Components/CategorySettings";
import ToppingGroupsManager from '../Components/ToppingGroupsManager';
import ProductFormToppingSelector from '../Components/ProductFormToppingSelector';
import ProductToppingOrderSelector from '../Components/ProductToppingOrderSelector';
import ProductOrderSelector from '../Components/ProductOrderSelector';
import WhatsAppCustomizer from '../Components/WhatsAppCustomizer';
import { API_ENDPOINTS } from "../config";
import api from "../services/api";
import ProductToppingSelector from '../Components/ProductToppingSelector';
import { useAuth } from "../Context/AuthContext";
import ThemeSettings from '../Components/ThemeSettings';
import LocationSettings from '../Components/LocationSettings';
import BannerUpload from '../Components/Catalog/BannerUpload';
import BannerApproval from '../Components/Catalog/BannerApproval';
import RestaurantBannerView from '../Components/Catalog/RestaurantBannerView';
import { useBusinessConfig } from '../Context/BusinessContext';
import ChangePassword from "../Components/ChangePassword";
import { socket, joinBusiness, socketDiagnostic } from '../services/socket';
import { SOCKET_EVENTS, ORDER_STATUS } from '../utils/constants';
import { isValidObjectId, isValidBusinessIdentifier } from '../utils/isValidObjectId';
import TableSettings from "../Components/TableSettings";
import ModernOrdersDashboard from "../Components/ModernOrdersDashboard";
import EnhancedCompletedOrders from "../Components/EnhancedCompletedOrders";
import ModernAdminSidebar from "../Components/ModernAdminSidebar";
import SubscriptionStatus from "../Components/SubscriptionStatus";
import SubscriptionPayment from "./SubscriptionPayment";
import CustomersManager from "../Components/CustomersManager";
import CouponsManager from "../Components/CouponsManager";
import MultiSessionWarning from "../Components/MultiSessionWarning";
import DeliveryZoneManager from "../Components/DeliveryZoneManager";
import PushNotificationToggle from "../Components/PushNotificationToggle";
import SubscriptionPaymentCard from "../Components/SubscriptionPaymentCard";
import SubscriptionDetailsCard from "../Components/SubscriptionDetailsCard";
import { motion, AnimatePresence } from "framer-motion";

// Wrapper para gestión de suscripciones
const SubscriptionManagementWrapper = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const { businessId: businessIdFromConfig } = useBusinessConfig();
  const { user } = useAuth();

  // Preferir businessId del contexto, si no está disponible usar el del user (para SuperAdmin)
  const businessId = businessIdFromConfig || user?.businessId;

  useEffect(() => {
    if (businessId || user?.role === 'superadmin') {
      loadSubscription();
    }
  }, [businessId, user]);

  const loadSubscription = async () => {
    try {
      // Si es SuperAdmin y tenemos businessId, pasarlo como query param
      const url = user?.role === 'superadmin' && businessId 
        ? `/subscriptions/me?businessId=${businessId}`
        : '/subscriptions/me';
      
      const res = await api.get(url);
      if (res.data.success && res.data.subscription) {
        setSubscription(res.data.subscription);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      // Si es 403, el usuario no tiene businessId válido - mostrar mensaje
      if (error.response?.status === 403) {
        console.error('No se pudo determinar el negocio. Por favor, cierra sesión y vuelve a iniciar sesión.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SubscriptionPaymentCard />
      {subscription && <SubscriptionDetailsCard subscription={subscription} />}
    </div>
  );
};

// Componente de Modal de Confirmación para edición
const ConfirmationModal = ({ isOpen, onClose, onConfirm, product, formData }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gradient-to-b from-white to-slate-50 rounded-2xl shadow-2xl border border-slate-200/50 p-4 sm:p-6 max-w-md w-full mx-3"
      >
        <div className="flex items-center gap-3 mb-4 sm:mb-6 pb-3 border-b border-slate-200">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Confirmar Cambios
          </h2>
        </div>
        
        <div className="space-y-3">
          {/* Nombre */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-slate-600 font-medium text-xs mb-1.5">Nombre:</p>
            <div className="flex items-center gap-2 flex-wrap">
              {product.name !== formData.name ? (
                <>
                  <p className="line-through text-red-500 text-sm">{product.name}</p>
                  <span className="text-slate-400">→</span>
                  <p className="text-green-600 text-sm font-semibold">{formData.name}</p>
                </>
              ) : (
                <p className="text-slate-900 text-sm font-medium">{product.name}</p>
              )}
            </div>
          </div>
          
          {/* Descripción */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-slate-600 font-medium text-xs mb-1.5">Descripción:</p>
            <div className="flex flex-col gap-1.5">
              {product.description !== formData.description ? (
                <>
                  <p className="line-through text-red-500 text-xs">{product.description || "Sin descripción"}</p>
                  <p className="text-green-600 text-xs font-medium">{formData.description || "Sin descripción"}</p>
                </>
              ) : (
                <p className="text-slate-900 text-xs">{product.description || "Sin descripción"}</p>
              )}
            </div>
          </div>
          
          {/* Precio */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-slate-600 font-medium text-xs mb-1.5">Precio:</p>
            <div className="flex items-center gap-2">
              {product.price !== formData.price ? (
                <>
                  <p className="line-through text-red-500 text-sm">${product.price}</p>
                  <span className="text-slate-400">→</span>
                  <p className="text-green-600 text-base font-bold">${formData.price}</p>
                </>
              ) : (
                <p className="text-slate-900 text-base font-bold">${product.price}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-5 pt-4 border-t border-slate-200">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-all duration-200 text-sm shadow-sm border border-slate-200"
          >
            ❌ Cancelar
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold transition-all duration-200 text-sm shadow-lg"
          >
            ✅ Confirmar Cambios
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

// Componente de Modal de Confirmación para eliminación - Responsive
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, product }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#333F50]/95 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 max-w-md w-full border border-[#333F50] mx-3"
      >
        <div className="flex items-center mb-3 sm:mb-4 text-red-400">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-lg sm:text-xl font-bold text-white">Eliminar Producto</h2>
        </div>
        
        <p className="text-[#D1D9FF] mb-4 sm:mb-6 text-sm sm:text-base">
          ¿Estás seguro de que deseas eliminar el producto <span className="font-bold text-white">{product.name}</span>? Esta acción no se puede deshacer.
        </p>
        
        <div className="bg-[#051C2C]/30 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6 border border-[#333F50]">
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-0">
            <p className="text-[#A5B9FF] sm:w-32 text-xs sm:text-sm">Nombre:</p>
            <p className="text-white font-medium text-sm sm:text-base break-words">{product.name}</p>
          </div>
          <div className="flex flex-col sm:flex-row mt-2 gap-1 sm:gap-0">
            <p className="text-[#A5B9FF] sm:w-32 text-xs sm:text-sm">Precio:</p>
            <p className="text-white font-medium text-sm sm:text-base">${product.price}</p>
          </div>
          <div className="flex flex-col sm:flex-row mt-2 gap-1 sm:gap-0">
            <p className="text-[#A5B9FF] sm:w-32 text-xs sm:text-sm">Categoría:</p>
            <p className="text-white font-medium text-sm sm:text-base">{product.categoryName || "Sin categoría"}</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg text-white bg-[#333F50] hover:bg-[#333F50]/80 transition-colors text-sm sm:text-base order-2 sm:order-1"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors text-sm sm:text-base order-1 sm:order-2"
          >
            Eliminar Producto
          </button>
        </div>
      </motion.div>
    </div>
  );
};

function Admin() {
  const { isAuthenticated, logout, user, login, loading } = useAuth();
  const { businessConfig } = useBusinessConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const { businessId: rawBusinessId } = useBusinessConfig();
  
  // Memoizar businessId para evitar cambios innecesarios
  const businessId = useMemo(() => rawBusinessId, [rawBusinessId]);
  
  // Inicializar activeTab según el tamaño de pantalla
  const [activeTab, setActiveTab] = useState(() => {
    // En desktop (lg+), iniciar en 'orders', en mobile en 'dashboard'
    return window.innerWidth >= 1024 ? 'orders' : 'dashboard';
  });
  const [activeCatalogTab, setActiveCatalogTab] = useState('upload');
  
  // Listener para navegación desde componentes (evento custom)
  useEffect(() => {
    const handleNavigateToTab = (event) => {
      const tabName = event.detail;
      if (tabName && typeof tabName === 'string') {
        setActiveTab(tabName);
        // Scroll suave al inicio después de un pequeño delay
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }
    };
    
    window.addEventListener('navigateToTab', handleNavigateToTab);
    return () => {
      window.removeEventListener('navigateToTab', handleNavigateToTab);
    };
  }, []);
  const [products, setProducts] = useState([]);
  
  // Log para debugging del estado de productos
  useEffect(() => {
    console.log('🔄 Estado de productos actualizado:', products.length, 'productos');
  }, [products]);
  const [categories, setCategories] = useState([]);
  const [toppingGroups, setToppingGroups] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image: '',
    toppingGroups: []
  });
  const [touchedFields, setTouchedFields] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sseEnabled, setSseEnabled] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [newOrderNotification, setNewOrderNotification] = useState(null);
  const [showOrderBanner, setShowOrderBanner] = useState(false);
  const [draggedFeaturedItem, setDraggedFeaturedItem] = useState(null);
  const [showToppingsSection, setShowToppingsSection] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // Wizard: 1=Info, 2=Precio/Imagen, 3=Extras
  const socketListenersRegistered = useRef(false);
  const lastJoinedBusiness = useRef(null);
  const notificationAudioRef = useRef(null); // Audio para notificaciones de pedidos
  
  // Refs para auto-focus en campos del wizard
  const nameInputRef = useRef(null);
  const priceInputRef = useRef(null);
  const toppingsSectionRef = useRef(null);
  const redirectionCountRef = useRef(0);
  const initialRenderRef = useRef(true);
  
  // Check if user is a superadmin viewing in temporary mode
  const isSuperAdminMode = user?.role === 'superadmin' || user?.username === 'superadmin_temp' || window.location.pathname.includes('/superadmin');
  
  // Handle SuperAdmin token from URL
  useEffect(() => {
    const handleSuperAdminToken = () => {
      // Helper to get cookies
      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
      };
      
      // First check for the satoken URL parameter
      const params = new URLSearchParams(location.search);
      const satoken = params.get('satoken');
      const fromSuperAdmin = params.get('source') === 'superadmin';
      
      // Check from URL parameter first
      if (satoken) {
        try {
          // Parse the token data
          const tokenData = JSON.parse(decodeURIComponent(satoken));
          
          // Store in localStorage for this session
          localStorage.setItem('accessToken', tokenData.accessToken);
          localStorage.setItem('refreshToken', tokenData.refreshToken);
          localStorage.setItem('user', JSON.stringify(tokenData.user));
          if (businessId) {
            localStorage.setItem('businessSlug', businessId);
          }
          
          // Remove the token from URL (to avoid sharing it accidentally)
          navigate(location.pathname, { replace: true });
          
          // Force refresh the page to apply the new auth state
          window.location.reload();
          return; // Exit if we handled the URL token
        } catch (error) {
          console.error('Error parsing SuperAdmin token:', error);
        }
      }
      
      // If there was no URL token, check for temp localStorage values
      if (fromSuperAdmin) {
        const tempAccessToken = localStorage.getItem('temp_accessToken');
        const tempRefreshToken = localStorage.getItem('temp_refreshToken');
        const tempUser = localStorage.getItem('temp_user');
        
        if (tempAccessToken && tempRefreshToken && tempUser) {
          try {
            // Move from temp to actual localStorage keys
            localStorage.setItem('accessToken', tempAccessToken);
            localStorage.setItem('refreshToken', tempRefreshToken);
            localStorage.setItem('user', tempUser);
            if (businessId) {
              localStorage.setItem('businessSlug', businessId);
            }
            
            // Clean up temp values
            localStorage.removeItem('temp_accessToken');
            localStorage.removeItem('temp_refreshToken');
            localStorage.removeItem('temp_user');
            localStorage.removeItem('temp_businessSlug');
            
            // Remove the source parameter
            navigate(location.pathname, { replace: true });
            
            // Force refresh
            window.location.reload();
            return; // Exit if we handled localStorage
          } catch (error) {
            console.error('Error handling temp tokens:', error);
          }
        }
        
        // Check cookies as a last resort
        const cookieAccessToken = getCookie('sa_accessToken');
        const cookieRefreshToken = getCookie('sa_refreshToken');
        const cookieUser = getCookie('sa_user');
        
        if (cookieAccessToken && cookieRefreshToken && cookieUser) {
          try {
            // Move from cookies to localStorage
            localStorage.setItem('accessToken', cookieAccessToken);
            localStorage.setItem('refreshToken', cookieRefreshToken);
            localStorage.setItem('user', decodeURIComponent(cookieUser));
            if (businessId) {
              localStorage.setItem('businessSlug', businessId);
            }
            
            // Clear cookies
            document.cookie = 'sa_accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            document.cookie = 'sa_refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            document.cookie = 'sa_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            document.cookie = 'sa_businessSlug=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            
            // Remove the source parameter
            navigate(location.pathname, { replace: true });
            
            // Force refresh
            window.location.reload();
          } catch (error) {
            console.error('Error handling cookie tokens:', error);
          }
        }
      }
    };
    
    handleSuperAdminToken();
  }, [location, navigate, businessId]);
  
  // Debug log para businessId
  useEffect(() => {
    console.log('BusinessId actual:', businessId, 'Tipo:', typeof businessId);
  }, [businessId]);
  
  // Validación de businessId (con protección contra bucles)
  useEffect(() => {
    // Skip en el primer render para evitar redirecciones innecesarias
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    // Verificar si el businessId es válido o es un slug válido
    const isValidId = isValidBusinessIdentifier(businessId);
    const isValidSlug = typeof businessId === 'string' && businessId.length > 0 && businessId !== 'undefined';
    
    console.log('Admin - BusinessId validation:', {
      businessId,
      type: typeof businessId,
      isValidId,
      isValidSlug,
      redirectionCount: redirectionCountRef.current
    });
    
    // Si no hay businessId o no es un formato aceptable, redirigir
    if (!isValidId && !isValidSlug && redirectionCountRef.current < 2) {
      redirectionCountRef.current += 1;
      console.log(`Redirigiendo a home debido a businessId inválido. Redirección #${redirectionCountRef.current}`);
      navigate("/", { replace: true });
    }
  }, [businessId, navigate]);

  // Auto-focus en campos cuando cambia el paso del wizard
  useEffect(() => {
    if (showProductModal) {
      // Pequeño delay para asegurar que el DOM esté listo
      const timer = setTimeout(() => {
        if (currentStep === 1 && nameInputRef.current) {
          nameInputRef.current.focus();
        } else if (currentStep === 2 && priceInputRef.current) {
          priceInputRef.current.focus();
        } else if (currentStep === 3 && toppingsSectionRef.current) {
          toppingsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep, showProductModal]);
  
  // Validación de autenticación (con protección contra bucles)
  useEffect(() => {
    // Skip en el primer render para evitar redirecciones innecesarias
    if (initialRenderRef.current) {
      return;
    }

    // Solo redirigir si no está autenticado y no está cargando
    if (!loading && !isAuthenticated) {
      // Limitar el número de redirecciones para prevenir bucles
      if (redirectionCountRef.current < 2) {
        redirectionCountRef.current += 1;
        console.log(`Redirigiendo a login debido a falta de autenticación. Redirección #${redirectionCountRef.current}`);
        navigate("/login", { replace: true });
      }
    } else {
      // Resetear el contador si el usuario está autenticado
      redirectionCountRef.current = 0;
    }
  }, [isAuthenticated, loading, navigate]);

  // Función para cargar los datos
  const loadData = async () => {
    // Usar la nueva función de validación
    if (!isValidBusinessIdentifier(businessId)) {
      console.log('No se cargarán datos: businessId inválido', businessId);
      return;
    }
    
    setDataLoading(true);
    try {
      const [productsRes, categoriesRes, toppingGroupsRes] = await Promise.all([
        api.get(`/products?businessId=${businessId}`),
        api.get(`/categories?businessId=${businessId}`),
        api.get(`/topping-groups?businessId=${businessId}`)
      ]);
      
      // Log detallado de los datos cargados para debugging
      console.log('Productos cargados:', productsRes.data.length);
      console.log('Categorías cargadas:', categoriesRes.data.length);
      console.log('Grupos de toppings cargados:', toppingGroupsRes.data.length);
      console.log('Tipo de productsRes.data:', typeof productsRes.data, productsRes.data);
      console.log('Es array productsRes.data:', Array.isArray(productsRes.data));
      
      // Log detallado de los grupos de toppings
      console.log('Detalle de grupos de toppings:', toppingGroupsRes.data.map(group => ({
        id: group._id,
        name: group.name,
        options: group.options ? group.options.length : 0
      })));
      
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setToppingGroups(Array.isArray(toppingGroupsRes.data) ? toppingGroupsRes.data : []);
      
      // Log adicional para debugging
      console.log('✅ Datos cargados exitosamente:');
      console.log('- Productos:', productsRes.data.length);
      console.log('- Categorías:', categoriesRes.data.length);
      console.log('- Topping Groups:', toppingGroupsRes.data.length);
    } catch (err) {
      console.error("Error al obtener datos:", err);
    } finally {
      setDataLoading(false);
    }
  };
  
  // Cargar datos iniciales
  useEffect(() => {
    // Solo cargar datos si hay un businessId válido
    if (businessId && isValidBusinessIdentifier(businessId)) {
      console.log('Cargando datos para businessId:', businessId);
      loadData();
    }
  }, [businessId]);

  // Registrar listeners de socket UNA SOLA VEZ
  useEffect(() => {
    if (socketListenersRegistered.current) return;
    
    console.log('🔌 Registering socket listeners ONCE');
    
    // Listener para nuevos pedidos
    socket.on(SOCKET_EVENTS.ORDER_CREATED, (newOrder) => {
      console.log('🔔 New order received in Admin:', newOrder);
      console.log('📊 Order details:', {
        id: newOrder._id,
        orderNumber: newOrder.orderNumber,
        status: newOrder.status,
        isPending: newOrder.status === ORDER_STATUS.PENDING
      });
      
      // Mostrar notificación banner solo si el pedido está pendiente
      if (newOrder.status === ORDER_STATUS.PENDING) {
        console.log('✅ Showing banner for pending order');
        setNewOrderNotification(newOrder);
        setShowOrderBanner(true);
        
        // Reproducir sonido de notificación
        if (notificationAudioRef.current) {
          const audio = notificationAudioRef.current;
          if (audio.readyState >= 2) { // Audio listo para reproducir
            audio.currentTime = 0; // Reiniciar desde el inicio
            audio.play().catch(e => {
              console.error('Error playing notification sound:', e);
            });
          }
        }
        
        // Auto-ocultar después de 10 segundos
        setTimeout(() => {
          setShowOrderBanner(false);
        }, 10000);
        
        // Actualizar contador de pedidos pendientes
        setPendingOrdersCount(prev => prev + 1);
      } else {
        console.log('⏭️ Order not pending, skipping banner');
      }
    });
    
    socket.on(SOCKET_EVENTS.ORDER_UPDATED, (updatedOrder) => {
      console.log('Order updated:', updatedOrder);
      if (updatedOrder.status !== ORDER_STATUS.PENDING) {
        setPendingOrdersCount(prev => Math.max(0, prev - 1));
      }
    });
    
    socket.on('products_update', (data) => {
      // Manejar diferentes formatos de actualización
      if (data.type === 'created' && data.product) {
        setProducts(prev => [...prev, data.product]);
      } else if (data.type === 'deleted' && data.productId) {
        setProducts(prev => prev.filter(p => p._id !== data.productId));
      } else if (data.type === 'updated' && data.product) {
        setProducts(prev => prev.map(p => p._id === data.product._id ? data.product : p));
      } else if (Array.isArray(data)) {
        // Si es un array completo, reemplazar
        setProducts(data);
      }
    });
    
    socket.on('categories_update', (data) => {
      setCategories(data.categories || data);
    });
    
    socket.on('topping_groups_update', (data) => {
      setToppingGroups(data);
    });
    
    socketListenersRegistered.current = true;
    console.log('✅ Socket listeners registered permanently');
    console.log('🔌 Socket connected:', socket.connected);
    
    // Si no está conectado, conectar ahora
    if (!socket.connected) {
      console.log('🔌 Connecting socket...');
      socket.connect();
    }
    
    // Cleanup solo cuando el componente se desmonte COMPLETAMENTE
    return () => {
      console.log('🧹 Component unmounting, cleaning up socket listeners');
      socket.off(SOCKET_EVENTS.ORDER_CREATED);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED);
      socket.off('products_update');
      socket.off('categories_update');
      socket.off('topping_groups_update');
      socketListenersRegistered.current = false;
    };
  }, []); // Array vacío - solo al montar/desmontar

  // Unirse al business cuando cambie (sin afectar los listeners)
  useEffect(() => {
    if (!businessId || !isValidBusinessIdentifier(businessId)) return;
    
    // Solo hacer joinBusiness si cambió realmente
    if (lastJoinedBusiness.current === businessId) {
      return;
    }
    
    console.log('🏢 Joining business:', businessId);
    socketDiagnostic();
    joinBusiness(businessId);
    lastJoinedBusiness.current = businessId;
  }, [businessId]);

  // SSE Connection - Opcional y desactivado por defecto
  useEffect(() => {
    if (!sseEnabled) return;
    
    let eventSource = null;
    const maxRetries = 3;
    const retryDelay = 3000;
    let retryCount = 0;
    
    const connectSSE = () => {
      try {
        if (retryCount >= maxRetries) {
          console.log('Admin: Máximo número de intentos de reconexión alcanzado');
          return;
        }

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        eventSource = new EventSource(`${apiUrl}/events`);
      
        eventSource.onopen = () => {
          console.log('Admin: Conexión SSE establecida');
          retryCount = 0; // Resetear el contador cuando la conexión es exitosa
        };
      
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Admin: Evento recibido:', data.type);
            
            switch (data.type) {
              case 'products_update':
                setProducts(data.data);
                break;
              case 'categories_update':
                setCategories(data.data.categories || data.data);
                break;
              case 'topping_groups_update':
                setToppingGroups(data.data);
                break;
              default:
                break;
            }
          } catch (error) {
            console.error('Error procesando evento SSE en Admin:', error);
          }
        };
      
        eventSource.onerror = (error) => {
          console.error('Error en la conexión SSE en Admin:', error);
          eventSource.close();
          retryCount++;
          
          // Intentar reconectar después de un delay
          setTimeout(() => {
            if (retryCount < maxRetries) {
              console.log(`Admin: Intento de reconexión ${retryCount + 1}/${maxRetries}`);
              connectSSE();
            }
          }, retryDelay);
        };
      } catch (error) {
        console.error('Error inicializando SSE:', error);
      }
    };

    // Iniciar la conexión SSE solo si está habilitada
    if (sseEnabled) {
      connectSSE();
    }

    // Cleanup
    return () => {
      if (eventSource) {
        console.log('Admin: Cerrando conexión SSE');
        eventSource.close();
      }
    };
  }, [sseEnabled]);

  useEffect(() => {
    // Evitar cambios de título si businessConfig no está definido correctamente
    if (!businessConfig) return;
    
    if (businessConfig.businessName) {
      document.title = businessConfig.businessName;
    }
    if (businessConfig.logo) {
      let favicon = document.querySelector("link[rel='icon']") || document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/png';
      favicon.href = businessConfig.logo;
      document.head.appendChild(favicon);
    }
  }, [businessConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched when submitting
    setTouchedFields({
      name: true,
      price: true,
      category: true
    });
    
    // Validación del lado del cliente
    if (!form.name.trim()) {
      showErrorMessage('El nombre del producto es obligatorio');
      return;
    }
    
    // Convertir el precio a número para validación
    const numericPrice = parseFloat(form.price.replace(/\./g, ''));
    if (!form.price || numericPrice <= 0 || isNaN(numericPrice)) {
      showErrorMessage('El precio debe ser mayor a 0');
      return;
    }
    
    if (!form.category) {
      showErrorMessage('Debes seleccionar una categoría para el producto');
      return;
    }
    
    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('description', form.description);
    // Usar el precio ya convertido para validación
    formData.append('price', numericPrice);
    formData.append('category', form.category);
    if (form.image instanceof File) {
      formData.append('image', form.image);
    } else if (form.image) {
      // Asegurar que siempre se envíe la URL de la imagen
      formData.append('image', form.image);
    }
    
    // Procesar los toppingGroups - necesitamos enviar array de IDs
    let toppingGroupIds = [];
    if (form.toppingGroups && form.toppingGroups.length > 0) {
      toppingGroupIds = form.toppingGroups.map(tg => {
        return typeof tg === 'object' && tg._id ? tg._id : tg;
      });
    }
    
    console.log('Grupos de toppings a enviar (IDs):', toppingGroupIds);
    formData.append('toppingGroups', JSON.stringify(toppingGroupIds));

    // Agregar businessId
    formData.append('businessId', businessId);

    try {
      if (editingId) {
        setShowConfirmModal(true);
      } else {
        console.log('Enviando datos para crear producto:', Object.fromEntries(formData.entries()));
        const response = await api.post('/products', formData);
        showSuccessMessage('✨ Producto creado exitosamente');
        setForm({
          name: '',
          description: '',
          price: '',
          category: '',
          image: '',
          toppingGroups: []
        });
        setTouchedFields({});
        // Cerrar el modal después de crear
        setTimeout(() => {
          setShowProductModal(false);
        }, 500);
        // Actualizar la lista de productos con el nuevo producto
        setProducts(prevProducts => [...prevProducts, response.data]);
        // Recargar datos para asegurar sincronización
        setTimeout(() => {
          loadData();
        }, 800);
      }
    } catch (error) {
      console.error('Error:', error);
      showErrorMessage('Error al crear el producto. Verifica que todos los campos estén completos.');
    }
  };

  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    setErrorMessage(''); // Limpiar mensaje de error
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showErrorMessage = (message) => {
    setErrorMessage(message);
    setSuccessMessage(''); // Limpiar mensaje de éxito
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const confirmEdit = async () => {
    try {
      // Asegurémonos de que los datos se envíen correctamente
      // Procesar los toppingGroups - necesitamos enviar array de IDs
      let toppingGroupIds = [];
      if (form.toppingGroups && form.toppingGroups.length > 0) {
        toppingGroupIds = form.toppingGroups.map(tg => {
          return typeof tg === 'object' && tg._id ? tg._id : tg;
        });
      }
      
      const formToSend = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price.replace(/\./g, '')),
        category: form.category,
        image: form.image,
        toppingGroups: toppingGroupIds,
        businessId,
      };
      
      console.log('Enviando al servidor:', formToSend);
      console.log('ToppingGroups enviados:', formToSend.toppingGroups);
      
      const response = await api.put(`/products/${editingId}`, formToSend);
      console.log('Respuesta al actualizar:', response.data);
      
      // Si el backend sigue sin devolver los toppingGroups, mantenlos en el frontend
      if (!response.data.toppingGroups || response.data.toppingGroups.length === 0) {
        // Actualizar manualmente el producto en el estado
        setProducts(prevProducts => 
          prevProducts.map(product => 
            product._id === editingId 
              ? {...response.data, toppingGroups: toppingGroupIds}
              : product
          )
        );
      } else {
        // Si el backend devuelve los toppingGroups, usar la respuesta tal cual
        setProducts(prevProducts => 
          prevProducts.map(product => 
            product._id === editingId ? response.data : product
          )
        );
      }
      
      // Limpiar el formulario y cerrar el modal
      setForm({ name: "", description: "", price: "", category: "", image: "", toppingGroups: [] });
      setTouchedFields({});
      setEditingId(null);
      setEditingProduct(null);
      setShowConfirmModal(false);
      
      // Cerrar el modal después de actualizar
      setTimeout(() => {
        setShowProductModal(false);
      }, 500);
      
      // Mostrar mensaje de éxito
      showSuccessMessage("✅ Producto actualizado correctamente");
      // Recargar datos para asegurar sincronización
      setTimeout(() => {
        loadData();
      }, 800);
    } catch (error) {
      console.error("Error al actualizar producto:", error);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleBlur = (fieldName) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));
  };

  const handlePriceChange = (e) => {
    const { value } = e.target;
    
    // Permitir solo números, puntos y comas
    const cleanValue = value.replace(/[^0-9.,]/g, '');
    
    // Convertir comas a puntos para formato colombiano
    const formattedValue = cleanValue.replace(/,/g, '.');
    
    setForm(prev => ({
      ...prev,
      price: formattedValue
    }));
  };

  const handleToppingGroupsChange = (selectedGroups) => {
    console.log('Grupos de toppings seleccionados:', selectedGroups);
    setForm({ ...form, toppingGroups: selectedGroups });
  };

  const handleEdit = (product) => {
    console.log('Producto a editar:', product);
    console.log('Toppings del producto:', product.toppingGroups);
    
    // Procesar los toppingGroups para uso en el formulario
    let processedToppingGroups = [];
    
    if (product.toppingGroups && Array.isArray(product.toppingGroups)) {
      // Si ya son objetos completos, usarlos directamente
      if (product.toppingGroups.length > 0 && typeof product.toppingGroups[0] === 'object' && product.toppingGroups[0]._id) {
        processedToppingGroups = product.toppingGroups;
      } 
      // Si solo son IDs, buscar los objetos completos en la lista de toppingGroups
      else {
        processedToppingGroups = product.toppingGroups.map(toppingId => {
          // Buscar el grupo completo por ID
          const fullGroup = toppingGroups.find(group => group._id === toppingId);
          return fullGroup || toppingId; // Si no se encuentra, devolver el ID
        }).filter(group => group); // Filtrar valores nulos o undefined
      }
    }
    
    console.log('Grupos de toppings procesados para el formulario:', processedToppingGroups);
    
    setEditingId(product._id);
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: product.category || "",
      image: product.image || "",
      toppingGroups: processedToppingGroups
    });
  };

  const handleDelete = async (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/products/${productToDelete._id}`);
      setProducts(products.filter(product => product._id !== productToDelete._id));
      showSuccessMessage('🗑️ Producto eliminado exitosamente');
      setShowDeleteModal(false);
      setProductToDelete(null);
      // Recargar datos para asegurar sincronización
      setTimeout(() => {
        loadData();
      }, 500);
    } catch (error) {
      console.error('Error al eliminar el producto:', error);
    }
  };

  const handleToggleProduct = async (productId) => {
    try {
      const response = await api.patch(`/products/${productId}/toggle`);
      
      // Actualizar el estado local del producto
      const updatedProduct = response.data.product;
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product._id === productId 
            ? { ...product, active: updatedProduct.active }
            : product
        )
      );
      
      // Mensaje personalizado según el estado
      const message = updatedProduct.active 
        ? '✅ Producto activado correctamente' 
        : '⏸️ Producto pausado correctamente';
      showSuccessMessage(message);
    } catch (error) {
      console.error('Error al cambiar estado del producto:', error);
      showErrorMessage('❌ Error al cambiar el estado del producto');
    }
  };

  // Función para marcar/desmarcar producto como destacado
  const handleToggleFeatured = async (productId) => {
    console.log('🌟 handleToggleFeatured LLAMADO - ProductId:', productId);
    console.log('🌟 Intentando hacer PUT a:', `/products/${productId}/toggle-featured`);
    try {
      console.log('🌟 Enviando request PUT...');
      const response = await api.put(`/products/${productId}/toggle-featured`);
      console.log('🌟 Respuesta recibida:', response.data);
      
      // Actualizar el estado local del producto
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product._id === productId 
            ? { ...product, isFeatured: response.data.product.isFeatured, featuredOrder: response.data.product.featuredOrder }
            : product
        )
      );
      
      console.log('🌟 Producto actualizado exitosamente en el estado local');
      
      // Mensaje personalizado según el estado destacado
      const message = response.data.product.isFeatured
        ? '⭐ Producto marcado como destacado'
        : '✅ Producto removido de destacados';
      showSuccessMessage(message);
    } catch (error) {
      console.error('❌ Error al cambiar estado destacado:', error);
      console.error('❌ Error completo:', error.response || error);
      if (error.response?.data?.message) {
        showErrorMessage(error.response.data.message);
      } else {
        showErrorMessage('❌ Error al cambiar el estado destacado');
      }
    }
  };

  // Función para reordenar productos destacados
  const handleReorderFeatured = async (newOrder) => {
    try {
      const orderedIds = newOrder.map(p => p._id);
      console.log('Reordenando productos destacados:', { newOrder, orderedIds });
      
      if (!orderedIds || orderedIds.length === 0) {
        console.error('orderedIds está vacío');
        showErrorMessage('⚠️ No hay productos para reordenar');
        return;
      }
      
      await api.put('/products/reorder-featured', { orderedIds });
      
      // Actualizar el estado local
      setProducts(prevProducts => 
        prevProducts.map(product => {
          const index = orderedIds.indexOf(product._id);
          if (index !== -1) {
            return { ...product, featuredOrder: index + 1 };
          }
          return product;
        })
      );
      
      showSuccessMessage('🔄 Orden de destacados actualizado');
    } catch (error) {
      console.error('Error al reordenar destacados:', error);
      console.error('Error details:', error.response?.data);
      showErrorMessage(error.response?.data?.message || '❌ Error al reordenar destacados');
    }
  };

  // Drag handlers para productos destacados
  const handleFeaturedDragStart = (e, index) => {
    setDraggedFeaturedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFeaturedDragOver = (e, index, featuredProducts) => {
    e.preventDefault();
    if (draggedFeaturedItem === null || draggedFeaturedItem === index) return;

    const newOrder = [...featuredProducts];
    const draggedProduct = newOrder[draggedFeaturedItem];
    newOrder.splice(draggedFeaturedItem, 1);
    newOrder.splice(index, 0, draggedProduct);

    setDraggedFeaturedItem(index);
    handleReorderFeatured(newOrder);
  };

  const handleFeaturedDragEnd = () => {
    setDraggedFeaturedItem(null);
  };

  // Función para editar producto
  const editProduct = (product) => {
    setEditingId(product._id);  // ✅ Agregar esta línea que faltaba
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: product.category,
      image: product.image,
      toppingGroups: product.toppingGroups || []
    });
    setTouchedFields({}); // Reset validation when editing
    setCurrentStep(1); // Reset to first step
    setShowProductModal(true); // Open modal for editing
    setShowToppingsSection(false); // Reset toppings section
  };

  // Función para eliminar producto (alias de handleDelete)
  const deleteProduct = (productId) => {
    const product = products.find(p => p._id === productId);
    if (product) {
      handleDelete(product);
    }
  };

  const cancelEdit = () => {
    setForm({
      name: '',
      description: '',
      price: '',
      category: '',
      image: '',
      toppingGroups: []
    });
    setEditingId(null);
    setEditingProduct(null);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setProductToDelete(null);
  };

  // Forzar cambio de contraseña si mustChangePassword es true
  if (user && user.mustChangePassword) {
    return (
      <div className="min-h-screen bg-[#051C2C] flex items-center justify-center py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full bg-[#333F50]/80 rounded-2xl shadow-xl overflow-hidden border border-[#333F50] p-8"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center mb-6"
          >
            <h2 className="text-2xl font-bold text-white">Cambiar contraseña</h2>
            <p className="mt-2 text-sm text-[#D1D9FF]">
              Por seguridad, debes establecer una nueva contraseña antes de continuar.
            </p>
          </motion.div>
          <ChangePassword forceNoOldPassword />
          <motion.button 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={logout} 
            className="mt-6 w-full bg-red-500 text-white py-3 rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Salir
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          {/* Spinner limpio */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            {/* Base */}
            <div className="absolute inset-0 rounded-full border-4 border-red-100" />
            {/* Anillo principal */}
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            {/* Anillo secundario */}
            <motion.div
              className="absolute inset-2 rounded-full border-4 border-transparent border-b-red-600"
              animate={{ rotate: -360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
            {/* Centro */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          </div>

          {/* Texto */}
          <h2 className="text-xl font-bold text-red-600 mb-1">Panel de Administración</h2>
          <p className="text-slate-600 text-sm font-medium">Cargando...</p>

          {/* Puntos */}
          <div className="flex justify-center space-x-1.5 mt-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-red-500"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (businessConfig && businessConfig.isActive === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#051C2C]">
        <img src={businessConfig.logo || 'https://placehold.co/150x150?text=Logo'} alt="Logo" className="w-32 h-32 mb-6 rounded-full object-cover border-4 border-[#333F50]" />
        <h1 className="text-2xl font-bold text-white mb-2">Panel desactivado</h1>
        <p className="text-[#D1D9FF] text-center max-w-md">Este negocio ha sido desactivado. Por favor, contacte al administrador para reactivar su acceso.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* SuperAdmin Badge - Discreto */}
      {isSuperAdminMode && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed top-4 right-4 z-[60] group"
          title="Modo SuperAdmin - Visualización del panel de administración"
        >
          <div className="relative">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-2 rounded-full shadow-lg flex items-center space-x-2 cursor-help">
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs sm:text-sm font-semibold hidden sm:inline">SuperAdmin</span>
            </div>
            
            {/* Tooltip en hover - solo desktop */}
            <div className="hidden group-hover:block absolute top-full right-0 mt-2 w-64 bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl">
              <div className="flex items-start space-x-2">
                <svg className="h-4 w-4 mt-0.5 shrink-0 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Estás viendo el panel como SuperAdmin. Los cambios aquí son solo de visualización.</p>
              </div>
              <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-900 transform rotate-45"></div>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Multi-Session Warning */}
      <MultiSessionWarning />
      
      <div className="flex min-h-screen">
        {/* Modern Sidebar */}
        <ModernAdminSidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          businessConfig={businessConfig}
          handleLogout={logout}
          pendingOrdersCount={pendingOrdersCount}
        />

        {/* Main Content Area */}
        <div className="flex-1 w-full lg:ml-0">
          {/* Top Header - Oculto en mobile, visible en desktop */}
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden md:block bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40"
          >
            <div className="px-3 sm:px-4 md:px-6 py-3 md:py-4 ml-0 lg:ml-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mt-12 lg:mt-0">
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 capitalize truncate">
                    {activeTab === 'dashboard' && 'Panel Principal'}
                    {activeTab === 'products' && 'Gestión de Productos'}
                    {activeTab === 'product-order' && 'Orden de Productos'}
                    {activeTab === 'orders' && 'Panel de Pedidos'}
                    {activeTab === 'categories' && 'Gestión de Categorías'}
                    {activeTab === 'toppings' && 'Gestión de Extras'}
                    {activeTab === 'customers' && 'Gestión de Clientes'}
                    {activeTab === 'coupons' && 'Gestión de Cupones'}
                    {activeTab === 'tables' && 'Configuración de Mesas'}
                    {activeTab === 'delivery-zones' && 'Zonas de Entrega'}
                    {activeTab === 'theme' && 'Personalización de Tema'}
                    {activeTab === 'location' && 'Configuración de Ubicación'}
                    {activeTab === 'catalog' && 'Gestión de Catálogo'}
                    {activeTab === 'whatsapp' && 'Configuración WhatsApp'}
                    {activeTab === 'subscription' && 'Mi Suscripción'}
                    {activeTab === 'business' && 'Configuración del Negocio'}
                    {activeTab === 'change-password' && 'Cambiar Contraseña'}
                    {activeTab === 'completed_orders' && 'Pedidos Completados'}
                  </h1>
                  <p className="text-slate-600 mt-1 text-xs sm:text-sm hidden sm:block">
                    {activeTab === 'dashboard' && 'Acceso rápido a todas las funciones'}
                    {activeTab === 'products' && 'Administra tu menú y productos'}
                    {activeTab === 'product-order' && 'Reordena cómo aparecen los productos en el menú'}
                    {activeTab === 'orders' && 'Gestiona pedidos en tiempo real'}
                    {activeTab === 'categories' && 'Organiza tu menú por categorías'}
                    {activeTab === 'toppings' && 'Configura extras y complementos'}
                    {activeTab === 'customers' && 'Administra información y estadísticas de clientes'}
                    {activeTab === 'coupons' && 'Crea y gestiona cupones de descuento para promocionar tu restaurante'}
                    {activeTab === 'tables' && 'Administra mesas y códigos QR'}
                    {activeTab === 'delivery-zones' && 'Define áreas de cobertura, precios y tiempos de entrega'}
                    {activeTab === 'theme' && 'Personaliza la apariencia de tu restaurante'}
                    {activeTab === 'location' && 'Configura tu ubicación para el catálogo'}
                    {activeTab === 'catalog' && 'Gestiona banners promocionales para el catálogo'}
                    {activeTab === 'whatsapp' && 'Personaliza el formato de mensajes WhatsApp'}
                    {activeTab === 'subscription' && 'Gestiona tu suscripción y pagos'}
                    {activeTab === 'business' && 'Información y configuración general'}
                    {activeTab === 'change-password' && 'Actualiza tu contraseña de acceso'}
                    {activeTab === 'completed_orders' && 'Historial y resumen de pedidos'}
                  </p>
                </div>
          </div>
        </div>
          </motion.div>

          {/* Audio element for notifications */}
          <audio 
            ref={notificationAudioRef} 
            preload="auto"
            onError={(e) => {
              console.error('Audio loading error:', e);
            }}
            onCanPlay={() => {
              console.log('Audio ready to play');
            }}
          >
            <source src="/audio/new-order-notification.mp3" type="audio/mpeg" />
            Tu navegador no soporta el elemento de audio.
          </audio>

          {/* Content Container - Responsive Padding */}
          <div className="p-3 sm:p-4 md:p-6">
            
            {/* Banner de Notificación de Nuevo Pedido */}
            <AnimatePresence>
              {showOrderBanner && newOrderNotification && activeTab !== 'orders' && (
                <motion.div
                  initial={{ y: -100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -100, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="mb-4 relative"
                >
                  <button
                    onClick={() => {
                      setActiveTab('orders');
                      setShowOrderBanner(false);
                    }}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Icono animado */}
                      <div className="shrink-0">
                        <motion.div
                          animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 10, -10, 0]
                          }}
                          transition={{ 
                            duration: 0.5,
                            repeat: Infinity,
                            repeatDelay: 1
                          }}
                          className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
                        >
                          <span className="text-2xl sm:text-3xl">🔔</span>
                        </motion.div>
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-bold text-base sm:text-lg">
                            ¡Nuevo Pedido!
                          </h3>
                          <motion.span
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="inline-block w-2 h-2 bg-white rounded-full"
                          />
                        </div>
                        <p className="text-white/90 text-xs sm:text-sm truncate">
                          Pedido #{newOrderNotification.orderNumber || newOrderNotification._id?.slice(-6)} 
                          {newOrderNotification.customer?.name && ` - ${newOrderNotification.customer.name}`}
                        </p>
                        <p className="text-white/80 text-[10px] sm:text-xs mt-0.5">
                          Toca aquí para gestionar el pedido
                        </p>
                      </div>

                      {/* Flecha indicadora */}
                      <div className="shrink-0">
                        <motion.div
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <svg 
                            className="w-5 h-5 sm:w-6 sm:h-6 text-white" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M9 5l7 7-7 7" 
                            />
                          </svg>
                        </motion.div>
                      </div>
                    </div>
                  </button>

                  {/* Botón cerrar */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOrderBanner(false);
                    }}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-colors group"
                  >
                    <svg 
                      className="w-4 h-4 text-white" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M6 18L18 6M6 6l12 12" 
                      />
                    </svg>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subscription Status - Aparece en TODAS las secciones cuando está vencida o en período de gracia */}
            {businessConfig && businessConfig._id && (
              <div className="mb-6">
                <SubscriptionStatus 
                  businessId={businessConfig._id}
                  onNavigateToSubscription={() => setActiveTab('subscription')}
                  compact={false}
                />
              </div>
            )}

            <AnimatePresence mode="wait">
            <motion.div 
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                {/* Render Components Based on Active Tab */}
                
                {/* Dashboard Principal */}
                {activeTab === 'dashboard' && (
                  <div className="space-y-6">
                    {/* Header del Dashboard */}
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 md:p-8 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h1 className="text-2xl md:text-3xl font-bold mb-2">
                            Bienvenido de nuevo 👋
                          </h1>
                          <p className="text-blue-100">
                            Panel de administración - {businessConfig?.businessName || 'Tu Restaurante'}
                          </p>
                        </div>
                        <div className="hidden md:block">
                          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                            {businessConfig?.logo ? (
                              <img 
                                src={businessConfig.logo} 
                                alt="Logo" 
                                className="w-16 h-16 rounded-xl object-cover"
                              />
                            ) : (
                              <span className="text-4xl">🍔</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grid de Funciones en Cuadrícula */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                      {/* Pedidos */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('orders')}
                        className="relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all group"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">📋</div>
                          <h3 className="font-bold text-lg mb-1">Pedidos</h3>
                          <p className="text-xs text-blue-100 opacity-90">Gestión en tiempo real</p>
                        </div>
                        {pendingOrdersCount > 0 && (
                          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                            {pendingOrdersCount}
                          </div>
                        )}
                      </motion.button>

                      {/* Productos */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('products')}
                        className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">🍔</div>
                          <h3 className="font-bold text-lg mb-1">Productos</h3>
                          <p className="text-xs text-orange-100 opacity-90">Administra tu menú</p>
                        </div>
                      </motion.button>

                      {/* Categorías */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('categories')}
                        className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">📂</div>
                          <h3 className="font-bold text-lg mb-1">Categorías</h3>
                          <p className="text-xs text-yellow-100 opacity-90">Organiza productos</p>
                        </div>
                      </motion.button>

                      {/* Extras */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('toppings')}
                        className="bg-gradient-to-br from-amber-500 to-yellow-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">🧀</div>
                          <h3 className="font-bold text-lg mb-1">Extras</h3>
                          <p className="text-xs text-amber-100 opacity-90">Toppings y opciones</p>
                        </div>
                      </motion.button>

                      {/* Clientes */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('customers')}
                        className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">👥</div>
                          <h3 className="font-bold text-lg mb-1">Clientes</h3>
                          <p className="text-xs text-teal-100 opacity-90">Base de datos</p>
                        </div>
                      </motion.button>

                      {/* Cupones */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('coupons')}
                        className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">🎫</div>
                          <h3 className="font-bold text-lg mb-1">Cupones</h3>
                          <p className="text-xs text-pink-100 opacity-90">Descuentos y ofertas</p>
                        </div>
                      </motion.button>

                      {/* Mesas */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('tables')}
                        className="bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">🪑</div>
                          <h3 className="font-bold text-lg mb-1">Mesas</h3>
                          <p className="text-xs text-indigo-100 opacity-90">Códigos QR</p>
                        </div>
                      </motion.button>

                      {/* Zonas de Entrega */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('delivery-zones')}
                        className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">🗺️</div>
                          <h3 className="font-bold text-lg mb-1">Zonas</h3>
                          <p className="text-xs text-green-100 opacity-90">Áreas de entrega</p>
                        </div>
                      </motion.button>

                      {/* Catálogo */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('catalog')}
                        className="bg-gradient-to-br from-violet-500 to-purple-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">📢</div>
                          <h3 className="font-bold text-lg mb-1">Catálogo</h3>
                          <p className="text-xs text-violet-100 opacity-90">Banners y promociones</p>
                        </div>
                      </motion.button>

                      {/* WhatsApp */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('whatsapp')}
                        className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">💬</div>
                          <h3 className="font-bold text-lg mb-1">WhatsApp</h3>
                          <p className="text-xs text-green-100 opacity-90">Configurar mensajes</p>
                        </div>
                      </motion.button>

                      {/* Suscripción */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('subscription')}
                        className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">💳</div>
                          <h3 className="font-bold text-lg mb-1">Suscripción</h3>
                          <p className="text-xs text-blue-100 opacity-90">Plan y pagos</p>
                        </div>
                      </motion.button>

                      {/* Configuración */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('business')}
                        className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">⚙️</div>
                          <h3 className="font-bold text-lg mb-1">Configuración</h3>
                          <p className="text-xs text-slate-100 opacity-90">Datos del negocio</p>
                        </div>
                      </motion.button>

                      {/* Tema */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('theme')}
                        className="bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">🎨</div>
                          <h3 className="font-bold text-lg mb-1">Tema</h3>
                          <p className="text-xs text-fuchsia-100 opacity-90">Personalización</p>
                        </div>
                      </motion.button>

                      {/* Ubicación */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('location')}
                        className="bg-gradient-to-br from-red-500 to-rose-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">📍</div>
                          <h3 className="font-bold text-lg mb-1">Ubicación</h3>
                          <p className="text-xs text-red-100 opacity-90">Dirección y mapa</p>
                        </div>
                      </motion.button>

                      {/* Orden de Productos */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('product-order')}
                        className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">🔄</div>
                          <h3 className="font-bold text-lg mb-1">Orden</h3>
                          <p className="text-xs text-purple-100 opacity-90">Ordenar productos</p>
                        </div>
                      </motion.button>

                      {/* Pedidos Completados */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('completed_orders')}
                        className="bg-gradient-to-br from-lime-500 to-green-500 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">✅</div>
                          <h3 className="font-bold text-lg mb-1">Completados</h3>
                          <p className="text-xs text-lime-100 opacity-90">Historial</p>
                        </div>
                      </motion.button>

                      {/* Cambiar Contraseña */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('change-password')}
                        className="bg-gradient-to-br from-gray-600 to-slate-600 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="text-white">
                          <div className="text-4xl mb-3">🔒</div>
                          <h3 className="font-bold text-lg mb-1">Contraseña</h3>
                          <p className="text-xs text-gray-100 opacity-90">Cambiar acceso</p>
                        </div>
                      </motion.button>
                    </div>
                  </div>
                )}

                {activeTab === 'business' && (
                  <div className="space-y-6">
                    {/* Botón Volver - Solo móvil */}
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span className="font-medium">Volver al inicio</span>
                    </button>
                    
                    <BusinessSettings />
                    <PushNotificationToggle 
                      businessId={businessId} 
                      userId={null} 
                    />
                  </div>
                )}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <CategorySettings categories={categories} />
            </div>
          )}
          {activeTab === 'toppings' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <ToppingGroupsManager />
            </div>
          )}
          {activeTab === 'tables' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <TableSettings />
            </div>
          )}
          {activeTab === 'theme' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <ThemeSettings />
            </div>
          )}
          {activeTab === 'location' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <LocationSettings />
            </div>
          )}
          {activeTab === 'catalog' && (
            <div className="space-y-4 md:space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              {/* Tabs para alternar entre vistas - Responsive */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 md:mb-6">
                <button
                  onClick={() => setActiveCatalogTab('upload')}
                  className={`px-4 py-2 sm:py-2.5 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                    activeCatalogTab === 'upload' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📤 Subir Banners
                </button>
                <button
                  onClick={() => setActiveCatalogTab('view')}
                  className={`px-4 py-2 sm:py-2.5 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                    activeCatalogTab === 'view' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  👁️ Mis Banners
                </button>
              </div>
              
              {/* Contenido según la pestaña activa */}
              {activeCatalogTab === 'upload' ? (
                <BannerUpload />
              ) : (
                <RestaurantBannerView />
              )}
            </div>
          )}
          {activeTab === 'change-password' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <ChangePassword />
            </div>
          )}
                {activeTab === 'orders' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <ModernOrdersDashboard />
            </div>
          )}
          {activeTab === 'completed_orders' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <EnhancedCompletedOrders />
            </div>
          )}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <CustomersManager />
            </div>
          )}
          {activeTab === 'coupons' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <CouponsManager />
            </div>
          )}
          {activeTab === 'delivery-zones' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <DeliveryZoneManager />
            </div>
          )}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <SubscriptionPayment />
            </div>
          )}
                
                {/* Products Management */}
          {activeTab === 'products' && (
                  <div className="space-y-4 md:space-y-6">
                    {/* Botón Volver - Solo móvil */}
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span className="font-medium">Volver al inicio</span>
                    </button>
                    
                    {/* Create Product Button */}
                    <motion.button
                      onClick={() => {
                        setShowProductModal(true);
                        setEditingProduct(null);
                        setForm({ name: '', description: '', price: '', category: '', image: '', toppingGroups: [] });
                        setTouchedFields({});
                        setCurrentStep(1); // Reset to first step
                        setShowToppingsSection(false);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 font-bold text-lg"
                    >
                      <span className="text-2xl">🍔</span>
                      <span>Nuevo Producto</span>
                      <span className="text-2xl">+</span>
                    </motion.button>

                    {/* Product Form Modal */}
                    <AnimatePresence>
                      {showProductModal && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
                          onClick={() => {
                            setShowProductModal(false);
                            setEditingProduct(null);
                          }}
                        >
                          <motion.div
                            initial={{ scale: 0.95, y: 30, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.95, y: 30, opacity: 0 }}
                            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gradient-to-b from-white to-slate-50 rounded-2xl shadow-2xl border border-slate-200/50 max-w-4xl w-full h-[95vh] overflow-hidden flex flex-col"
                          >
                        {/* Modal Header with Close Button */}
                        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 px-6 py-4 shadow-lg relative overflow-hidden flex-shrink-0">
                          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <motion.div 
                                initial={{ rotate: -10, scale: 0.9 }}
                                animate={{ rotate: 0, scale: 1 }}
                                transition={{ type: "spring", delay: 0.1 }}
                                className="w-7 h-7 bg-white/25 rounded-lg flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/30"
                              >
                                <span className="text-base">{editingProduct ? '✏️' : '🍔'}</span>
                              </motion.div>
                              <div>
                                <h2 className="text-lg font-bold text-white drop-shadow-sm">
                                  {editingProduct ? 'Editar Producto' : 'Crear Producto'}
                                </h2>
                              </div>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.1, rotate: 90 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                setShowProductModal(false);
                                setEditingProduct(null);
                                setCurrentStep(1); // Reset wizard
                              }}
                              className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white shadow-lg backdrop-blur-sm border border-white/30"
                            >
                              <span className="text-base font-light">×</span>
                            </motion.button>
                          </div>
                        </div>

                        {/* Step Indicator */}
                        <div className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex-shrink-0">
                          {[
                            { num: 1, label: 'Info Básica', icon: '📋' },
                            { num: 2, label: 'Precio e Imagen', icon: '💵' },
                            { num: 3, label: 'Extras', icon: '🍟' }
                          ].map((step, idx) => (
                            <div key={step.num} className="flex items-center gap-2">
                              <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                                  currentStep === step.num
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md scale-105'
                                    : currentStep > step.num
                                    ? 'bg-green-500 text-white shadow-sm'
                                    : 'bg-white text-slate-400 border border-slate-200'
                                }`}
                              >
                                <span className="text-xs">{step.icon}</span>
                                <span className="text-[11px] font-semibold hidden sm:inline">{step.label}</span>
                                <span className={`text-[10px] font-bold ${
                                  currentStep >= step.num ? 'opacity-100' : 'opacity-50'
                                }`}>
                                  {currentStep > step.num ? '✓' : step.num}
                                </span>
                              </motion.div>
                              {idx < 2 && (
                                <div className={`h-0.5 w-8 transition-all ${
                                  currentStep > step.num ? 'bg-green-500' : 'bg-slate-200'
                                }`}></div>
                              )}
                            </div>
                          ))}
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                          <div className="p-4 space-y-3">
                            
                            {/* PASO 1: Información Básica */}
                            {currentStep === 1 && (
                              <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-3"
                              >
                                <div className="text-center mb-3">
                                  <h3 className="text-lg font-bold text-slate-800 mb-1">📋 Información Básica</h3>
                                  <p className="text-sm text-slate-600">Completa los datos principales del producto</p>
                                </div>

                                {/* Product Name */}
                                <div className="space-y-1">
                                  <label className="flex items-center text-sm font-semibold text-slate-700">
                                    <span className="mr-2">🏷️</span>
                                    Nombre del Producto*
                                  </label>
                                  <input
                                    ref={nameInputRef}
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    onBlur={() => handleBlur('name')}
                                    className={`w-full rounded-lg border-2 bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 placeholder-slate-400 px-3 py-2 text-sm transition-all ${
                                      touchedFields.name && !form.name.trim() ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                                    }`}
                                    placeholder="Ej: Hamburguesa Clásica, Pizza Margarita..."
                                    required
                                  />
                                  {touchedFields.name && !form.name.trim() && (
                                    <motion.p 
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="text-red-600 text-sm flex items-center gap-2 font-medium"
                                    >
                                      <span>⚠️</span>
                                      Este campo es obligatorio
                                    </motion.p>
                                  )}
                                </div>

                                {/* Description */}
                                <div className="space-y-1">
                                  <label className="flex items-center text-sm font-semibold text-slate-700">
                                    <span className="mr-2">📝</span>
                                    Descripción
                                  </label>
                                  <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    rows="2"
                                    className="w-full rounded-lg border-2 border-slate-200 bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 placeholder-slate-400 px-3 py-2 text-sm transition-all resize-none"
                                    placeholder="Describe tu producto de forma atractiva..."
                                  ></textarea>
                                </div>

                                {/* Category */}
                                <div className="space-y-1">
                                  <label className="flex items-center text-sm font-semibold text-slate-700">
                                    <span className="mr-2">📂</span>
                                    Categoría*
                                  </label>
                                  <select
                                    name="category"
                                    value={form.category}
                                    onChange={handleChange}
                                    onBlur={() => handleBlur('category')}
                                    className={`w-full rounded-lg border-2 bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 px-3 py-2 text-sm transition-all cursor-pointer appearance-none bg-no-repeat bg-right pr-10 ${
                                      touchedFields.category && !form.category ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                                    }`}
                                    style={{
                                      backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')",
                                      backgroundPosition: 'right 1rem center',
                                      backgroundSize: '1.5rem 1.5rem'
                                    }}
                                  >
                                    <option value="">Seleccionar categoría...</option>
                                    {categories.map(category => (
                                      <option key={category._id} value={category._id}>
                                        {category.name}
                                      </option>
                                    ))}
                                  </select>
                                  {touchedFields.category && !form.category && (
                                    <motion.p 
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="text-red-600 text-sm flex items-center gap-2 font-medium"
                                    >
                                      <span>⚠️</span>
                                      Selecciona una categoría
                                    </motion.p>
                                  )}
                                </div>
                              </motion.div>
                            )}

                            {/* PASO 2: Precio e Imagen */}
                            {currentStep === 2 && (
                              <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                              >
                                <div className="text-center mb-8">
                                  <h3 className="text-2xl font-bold text-slate-800 mb-2">💵 Precio e Imagen</h3>
                                  <p className="text-slate-600">Define el precio y añade una imagen atractiva</p>
                                </div>

                                {/* Precio */}
                                <div className="space-y-2">
                                  <label className="flex items-center text-sm font-semibold text-slate-700">
                                    <span className="mr-2">💰</span>
                                    Precio*
                                  </label>
                                  <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-4">
                                      <span className="text-slate-600 font-bold text-lg">$</span>
                                    </div>
                                    <input
                                      ref={priceInputRef}
                                      name="price"
                                      type="text"
                                      value={form.price}
                                      onChange={handlePriceChange}
                                      onBlur={() => handleBlur('price')}
                                      className={`w-full rounded-xl border-2 bg-white focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 placeholder-slate-400 pl-12 pr-4 py-3 text-base font-bold transition-all shadow-sm hover:shadow-md ${
                                        touchedFields.price && (!form.price || parseFloat(form.price.replace(/\./g, '')) <= 0 || isNaN(parseFloat(form.price.replace(/\./g, '')))) ? 'border-red-400 bg-red-50/50' : 'border-slate-200'
                                      }`}
                                      placeholder="29.000"
                                      required
                                    />
                                  </div>
                                  {touchedFields.price && (!form.price || parseFloat(form.price.replace(/\./g, '')) <= 0 || isNaN(parseFloat(form.price.replace(/\./g, '')))) && (
                                    <motion.p 
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="text-red-600 text-sm flex items-center gap-2 font-medium"
                                    >
                                      <span>⚠️</span>
                                      Precio inválido
                                    </motion.p>
                                  )}
                                </div>

                                {/* Imagen URL */}
                                <div className="space-y-2">
                                  <label className="flex items-center text-sm font-semibold text-slate-700">
                                    <span className="mr-2">🔗</span>
                                    URL de Imagen
                                  </label>
                                  <input
                                    name="image"
                                    value={form.image}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 placeholder-slate-400 px-4 py-3 text-base transition-all"
                                    placeholder="https://ejemplo.com/imagen-producto.jpg"
                                  />
                                </div>

                                {/* Image Preview */}
                                {form.image && (
                                  <motion.div 
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ type: "spring", duration: 0.4 }}
                                    className="relative w-full h-64 rounded-xl overflow-hidden border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100"
                                  >
                                    <img
                                      src={form.image}
                                      alt="Preview"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                    <div style={{ display: 'none' }} className="w-full h-full flex flex-col items-center justify-center bg-slate-100">
                                      <span className="text-6xl mb-3">🖼️</span>
                                      <span className="text-base text-slate-500 font-medium">No se pudo cargar la imagen</span>
                                    </div>
                                    <div className="absolute top-3 right-3 bg-green-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                                      ✓ Vista previa
                                    </div>
                                  </motion.div>
                                )}
                              </motion.div>
                            )}

                            {/* PASO 3: Extras/Toppings */}
                            {currentStep === 3 && (
                              <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                              >
                                <div className="text-center mb-8">
                                  <h3 className="text-2xl font-bold text-slate-800 mb-2">🍟 Extras Opcionales</h3>
                                  <p className="text-slate-600">Selecciona los complementos que se pueden agregar</p>
                                </div>

                                <div ref={toppingsSectionRef} className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
                                  <motion.button
                                    type="button"
                                    onClick={() => setShowToppingsSection(!showToppingsSection)}
                                    whileHover={{ backgroundColor: 'rgb(248 250 252)' }}
                                    whileTap={{ scale: 0.99 }}
                                    className="w-full flex items-center justify-between px-5 py-4 bg-white transition-colors"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                                        <span className="text-2xl">🧀</span>
                                      </div>
                                      <div className="text-left">
                                        <span className="text-base font-bold text-slate-800 block">Extras Disponibles</span>
                                        <span className="text-sm text-slate-500">Agrega complementos opcionales al producto</span>
                                      </div>
                                      {form.toppingGroups && form.toppingGroups.length > 0 && (
                                        <motion.span 
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm px-3 py-1.5 rounded-full font-bold shadow-md"
                                        >
                                          {form.toppingGroups.length} seleccionados
                                        </motion.span>
                                      )}
                                    </div>
                                    <motion.svg 
                                      animate={{ rotate: showToppingsSection ? 180 : 0 }}
                                      transition={{ duration: 0.3 }}
                                      className="w-6 h-6 text-slate-600"
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </motion.svg>
                                  </motion.button>
                                  
                                  <AnimatePresence>
                                    {showToppingsSection && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="border-t-2 border-slate-200"
                                      >
                                        <div className="p-6 bg-slate-50/50 space-y-5">
                                          <ProductFormToppingSelector 
                                            toppingGroups={toppingGroups} 
                                            selectedToppings={form.toppingGroups} 
                                            onChange={handleToppingGroupsChange}
                                          />
                                          
                                          {/* Reordenamiento de Toppings */}
                                          {form.toppingGroups && form.toppingGroups.length > 0 && (
                                            <div className="pt-5 border-t-2 border-slate-200">
                                              <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                                  <span className="text-lg">🔄</span>
                                                </div>
                                                <div>
                                                  <span className="text-base font-bold text-slate-800 block">Orden de Extras</span>
                                                  <span className="text-sm text-slate-500">Arrastra para reordenar</span>
                                                </div>
                                              </div>
                                              <ProductToppingOrderSelector 
                                                selectedToppings={form.toppingGroups} 
                                                onChange={handleToppingGroupsChange}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {(!form.toppingGroups || form.toppingGroups.length === 0) && !showToppingsSection && (
                                  <div className="text-center py-8 text-slate-500">
                                    <p className="text-sm">No se han seleccionado extras. Haz clic arriba para agregar.</p>
                                    <p className="text-xs mt-1">Esto es opcional - puedes continuar sin extras.</p>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>
                        </form>
                          
                        {/* Wizard Navigation - Sticky Footer */}
                        <div className="border-t border-slate-200 bg-white p-4 shadow-lg flex-shrink-0">
                          <div className="flex gap-3">
                            {/* Botón Anterior (solo en pasos 2 y 3) */}
                            {currentStep > 1 && (
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all font-semibold flex items-center justify-center gap-2 text-sm"
                              >
                                <span className="text-xl">←</span>
                                <span>Anterior</span>
                              </motion.button>
                            )}

                            {/* Botón Cancelar (solo cuando está editando y en paso 1) */}
                            {editingProduct && currentStep === 1 && (
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setEditingProduct(null);
                                  setForm({ name: '', description: '', price: '', category: '', image: '', toppingGroups: [] });
                                  setTouchedFields({});
                                  setCurrentStep(1);
                                  setShowToppingsSection(false);
                                  setShowProductModal(false);
                                }}
                                className="flex-1 px-5 py-3 border-2 border-red-300 text-red-700 rounded-xl hover:bg-red-50 hover:border-red-400 transition-all font-semibold flex items-center justify-center gap-2 text-base"
                              >
                                <span className="text-xl">❌</span>
                                <span>Cancelar</span>
                              </motion.button>
                            )}
                            
                            {/* Botón Siguiente (pasos 1 y 2) o Crear/Actualizar (paso 3) */}
                            {currentStep < 3 ? (
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  // Validar paso actual antes de avanzar
                                  if (currentStep === 1) {
                                    if (!form.name.trim() || !form.category) {
                                      // Marcar campos como tocados para mostrar errores
                                      setTouchedFields(prev => ({ ...prev, name: true, category: true }));
                                      return;
                                    }
                                  } else if (currentStep === 2) {
                                    if (!form.price || parseFloat(form.price.replace(/\./g, '')) <= 0) {
                                      setTouchedFields(prev => ({ ...prev, price: true }));
                                      return;
                                    }
                                  }
                                  setCurrentStep(prev => prev + 1);
                                }}
                                className="flex-1 px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all font-semibold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-base"
                              >
                                <span>Siguiente</span>
                                <span className="text-xl">→</span>
                              </motion.button>
                            ) : (
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  const modalContent = e.target.closest('.bg-gradient-to-b');
                                  const formElement = modalContent.querySelector('form');
                                  if (formElement) {
                                    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                                    formElement.dispatchEvent(submitEvent);
                                  }
                                }}
                                className="flex-1 px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all font-semibold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-base"
                              >
                                <span>{editingProduct ? '✏️' : '✨'}</span>
                                <span>{editingProduct ? 'Actualizar Producto' : 'Crear Producto'}</span>
                              </motion.button>
                            )}
                          </div>
                        </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

              {/* Modern Products Grid - Responsive Optimized */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                      {(() => {
                        console.log('Render - Tipo de products:', typeof products, products);
                        console.log('Render - Es array products:', Array.isArray(products));
                        const safeProducts = Array.isArray(products) ? products : [];
                        console.log('Render - safeProducts:', safeProducts);
                        return safeProducts.map((product, index) => (
                        <motion.div 
                          key={product._id} 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ y: -4, transition: { duration: 0.2 } }}
                          className={`group rounded-xl shadow-lg border overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full ${
                            product.active !== false 
                              ? 'bg-white border-gray-200' 
                              : 'bg-red-50 border-red-200 opacity-75'
                          }`}
                        >
                          {/* Product Image */}
                          <div className="relative overflow-hidden flex-shrink-0">
                            <img 
                              src={product.image || 'https://placehold.co/400x300?text=🍔'} 
                              alt={product.name}
                              className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
                            
                            {/* Price Badge */}
                            <div className="absolute top-3 left-3">
                              <div className="bg-green-500 text-white px-3 py-1 rounded-full font-bold shadow-md">
                                <span className="text-sm">${Number(product.price).toLocaleString('es-CO')}</span>
                              </div>
                            </div>

                            {/* Status and Category Badges */}
                            <div className="absolute top-3 right-3 flex flex-col gap-2">
                              {/* Featured Badge */}
                              {product.isFeatured && (
                                <div className="flex justify-end">
                                  <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1">
                                    ⭐ Destacado
                                  </span>
                                </div>
                              )}
                              
                              {/* Status Badge */}
                              <div className="flex justify-end">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold shadow-md ${
                                  product.active !== false 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-red-500 text-white'
                                }`}>
                                  {product.active !== false ? '🟢 Activo' : '🔴 Inactivo'}
                                </span>
                              </div>
                              
                              {/* Category Badge */}
                              {product.category && (
                                <div className="flex justify-end">
                                  <span className="bg-white/90 backdrop-blur-sm text-gray-700 px-2 py-1 rounded-full text-xs font-medium shadow-md max-w-[100px] truncate">
                                    📂 {categories.find(c => c._id === product.category)?.name || 'Sin categoría'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Product Info */}
                          <div className="p-4 flex-grow flex flex-col">
                            {/* Product Name */}
                            <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">
                              {product.name}
                            </h3>
                            
                            {/* Description */}
                            <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-2 flex-grow">
                              {product.description}
                            </p>

                            {/* Action Buttons - Improved Layout */}
                            <div className="grid grid-cols-2 gap-2 mt-auto">
                              {/* Editar */}
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => editProduct(product)}
                                className="bg-blue-500 text-white px-3 py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                title="Editar producto"
                              >
                                <span className="text-base">✏️</span>
                                <span className="text-sm">Editar</span>
                              </motion.button>
                              
                              {/* Toggle Activo/Inactivo */}
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleToggleProduct(product._id)}
                                className={`px-3 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${
                                  product.active !== false
                                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                                    : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                                title={product.active !== false ? 'Desactivar' : 'Activar'}
                              >
                                <span className="text-base">{product.active !== false ? '⏸️' : '▶️'}</span>
                                <span className="text-sm">{product.active !== false ? 'Pausar' : 'Activar'}</span>
                              </motion.button>
                              
                              {/* Eliminar */}
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => deleteProduct(product._id)}
                                className="bg-red-500 text-white px-3 py-2.5 rounded-lg font-semibold hover:bg-red-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                title="Eliminar producto"
                              >
                                <span className="text-base">🗑️</span>
                                <span className="text-sm">Eliminar</span>
                              </motion.button>
                              
                              {/* Destacar - Full width */}
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleToggleFeatured(product._id)}
                                className={`px-3 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${
                                  product.isFeatured
                                    ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                                title={product.isFeatured ? 'Quitar destacado' : 'Destacar'}
                              >
                                <span className="text-base">⭐</span>
                                <span className="text-sm">{product.isFeatured ? 'Destacado' : 'Destacar'}</span>
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                        ));
                      })()}
                    </div>
                  </div>
          )}

          {/* Product Order Management */}
          {activeTab === 'product-order' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>

              {/* Sección de Productos Destacados */}
              {(() => {
                const featuredProducts = Array.isArray(products) 
                  ? products.filter(p => p.isFeatured).sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0))
                  : [];

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-xl border-2 border-yellow-200 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-yellow-400 p-2 rounded-lg">
                          <span className="text-2xl">⭐</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">Productos Destacados</h3>
                          <p className="text-sm text-gray-600">
                            Arrastra y suelta para cambiar el orden • {featuredProducts.length} de 5 productos
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {featuredProducts.length === 0 ? (
                      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-8 text-center">
                        <div className="text-6xl mb-4">⭐</div>
                        <p className="text-gray-600 font-medium">No hay productos destacados</p>
                        <p className="text-sm text-gray-500 mt-2">Ve a la sección de productos y marca hasta 5 productos como destacados</p>
                      </div>
                    ) : (
                      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 space-y-2">
                        {featuredProducts.map((product, index) => (
                          <motion.div
                            key={product._id}
                            draggable
                            onDragStart={(e) => handleFeaturedDragStart(e, index)}
                            onDragOver={(e) => handleFeaturedDragOver(e, index, featuredProducts)}
                            onDragEnd={handleFeaturedDragEnd}
                            className={`flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm border-2 transition-all ${
                              draggedFeaturedItem === index 
                                ? 'border-yellow-400 opacity-50' 
                                : 'border-gray-200 hover:border-yellow-300'
                            } cursor-move`}
                            whileHover={{ scale: 1.02 }}
                          >
                            {/* Drag Handle */}
                            <div className="text-gray-400 hover:text-yellow-500 transition-colors cursor-grab active:cursor-grabbing">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
                              </svg>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-2xl font-bold text-yellow-600 w-8 text-center">
                                {index + 1}
                              </span>
                              {product.image && (
                                <img 
                                  src={product.image} 
                                  alt={product.name}
                                  className="w-12 h-12 object-cover rounded-lg"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 truncate">{product.name}</p>
                                <p className="text-sm text-gray-500">${product.price.toLocaleString()}</p>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleToggleFeatured(product._id)}
                              className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                              title="Quitar de destacados"
                            >
                              ❌
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })()}
              
              <ProductOrderSelector 
                products={products}
                categories={categories}
                businessId={businessId}
                onOrderChange={(newOrderedProducts) => {
                  setProducts(newOrderedProducts);
                }}
              />
            </motion.div>
          )}

          {/* WhatsApp Customizer */}
          {activeTab === 'whatsapp' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Botón Volver - Solo móvil */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver al inicio</span>
              </button>
              
              <WhatsAppCustomizer />
            </motion.div>
          )}

          {/* Customers Manager */}
                
              </motion.div>
            </AnimatePresence>
        </div>
        </div>
      </div>

      {/* Success Message Toast - Improved UX */}
          <AnimatePresence>
            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, x: 100, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.8 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="fixed top-20 right-4 sm:right-6 z-50 max-w-[90vw] sm:max-w-md"
              >
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-4 flex items-center gap-3">
                    {/* Icon Container */}
                    <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <span className="text-2xl">✅</span>
                    </div>
                    
                    {/* Message */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm sm:text-base leading-tight">
                        {successMessage}
                      </p>
                    </div>
                    
                    {/* Close button */}
                    <button
                      onClick={() => setSuccessMessage('')}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                    >
                      <span className="text-lg">×</span>
                    </button>
                  </div>
                  
                  {/* Progress bar */}
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 3, ease: "linear" }}
                    className="h-1 bg-white/30"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

      {/* Error Message Toast - Improved UX */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div 
                initial={{ opacity: 0, x: 100, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.8 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="fixed top-20 right-4 sm:right-6 z-50 max-w-[90vw] sm:max-w-md"
              >
                <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-4 flex items-center gap-3">
                    {/* Icon Container */}
                    <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    
                    {/* Message */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm sm:text-base leading-tight">
                        {errorMessage}
                      </p>
                    </div>
                    
                    {/* Close button */}
                    <button
                      onClick={() => setErrorMessage('')}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                    >
                      <span className="text-lg">×</span>
                    </button>
                  </div>
                  
                  {/* Progress bar */}
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 3, ease: "linear" }}
                    className="h-1 bg-white/30"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
      {/* Modals */}
          <ConfirmationModal
            isOpen={showConfirmModal}
            onClose={cancelEdit}
            onConfirm={confirmEdit}
            product={editingProduct || {}}
            formData={form}
          />
          
          <DeleteConfirmationModal
            isOpen={showDeleteModal}
            onClose={cancelDelete}
            onConfirm={confirmDelete}
            product={productToDelete || {}}
          />
    </div>
  );
}

export default Admin;

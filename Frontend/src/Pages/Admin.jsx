import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
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
import { socket } from '../services/socket';
import { isValidObjectId, isValidBusinessIdentifier } from '../utils/isValidObjectId';
import TableSettings from "../Components/TableSettings";
import ModernOrdersDashboard from "../Components/ModernOrdersDashboard";
import CompletedOrdersSummary from "../Components/CompletedOrdersSummary";
import ModernAdminSidebar from "../Components/ModernAdminSidebar";
import SubscriptionStatus from "../Components/SubscriptionStatus";
import { motion, AnimatePresence } from "framer-motion";

// Componente de Modal de Confirmación para edición
const ConfirmationModal = ({ isOpen, onClose, onConfirm, product, formData }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#333F50]/95 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-[#333F50]"
      >
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <svg className="w-6 h-6 text-[#3A7AFF] mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Confirmar Cambios
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[#D1D9FF] font-medium">Nombre:</p>
            <div className="flex items-center">
              <p className={`${product.name !== formData.name ? 'line-through text-red-400' : 'text-white'} mr-2`}>
                {product.name}
              </p>
              {product.name !== formData.name && (
                <p className="text-[#5FF9B4]">{formData.name}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-[#D1D9FF] font-medium">Descripción:</p>
            <div className="flex items-center">
              <p className={`${product.description !== formData.description ? 'line-through text-red-400' : 'text-white'} mr-2`}>
                {product.description || "Sin descripción"}
              </p>
              {product.description !== formData.description && (
                <p className="text-[#5FF9B4]">{formData.description || "Sin descripción"}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-[#D1D9FF] font-medium">Precio:</p>
            <div className="flex items-center">
              <p className={`${product.price !== formData.price ? 'line-through text-red-400' : 'text-white'} mr-2`}>
                ${product.price}
              </p>
              {product.price !== formData.price && (
                <p className="text-[#5FF9B4]">${formData.price}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-white bg-[#333F50] hover:bg-[#333F50]/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-white bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 transition-colors"
          >
            Confirmar Cambios
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Componente de Modal de Confirmación para eliminación
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, product }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#333F50]/95 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-[#333F50]"
      >
        <div className="flex items-center mb-4 text-red-400">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-white">Eliminar Producto</h2>
        </div>
        
        <p className="text-[#D1D9FF] mb-6">
          ¿Estás seguro de que deseas eliminar el producto <span className="font-bold text-white">{product.name}</span>? Esta acción no se puede deshacer.
        </p>
        
        <div className="bg-[#051C2C]/30 p-4 rounded-lg mb-6 border border-[#333F50]">
          <div className="flex">
            <p className="text-[#A5B9FF] w-32">Nombre:</p>
            <p className="text-white font-medium">{product.name}</p>
          </div>
          <div className="flex mt-2">
            <p className="text-[#A5B9FF] w-32">Precio:</p>
            <p className="text-white font-medium">${product.price}</p>
          </div>
          <div className="flex mt-2">
            <p className="text-[#A5B9FF] w-32">Categoría:</p>
            <p className="text-white font-medium">{product.categoryName || "Sin categoría"}</p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-white bg-[#333F50] hover:bg-[#333F50]/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors"
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
  const { businessId } = useBusinessConfig();
  const [activeTab, setActiveTab] = useState('products');
  const [activeCatalogTab, setActiveCatalogTab] = useState('upload');
  const [products, setProducts] = useState([]);
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
  const [editingId, setEditingId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sseEnabled, setSseEnabled] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
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

  // Configurar WebSocket
  useEffect(() => {
    // Usar la nueva función de validación
    if (!isValidBusinessIdentifier(businessId)) return;
    
    // --- WebSocket: Conexión y listeners ---
    try {
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit('joinBusiness', businessId);
      
      // Definir listeners para los eventos
      const handleProductsUpdate = (data) => {
        setProducts(data);
      };
      
      const handleCategoriesUpdate = (data) => {
        setCategories(data.categories || data);
      };
      
      const handleToppingGroupsUpdate = (data) => {
        setToppingGroups(data);
        console.log('Estado de toppingGroups actualizado:', data);
      };
      
      // Registrar listeners
      socket.on('products_update', handleProductsUpdate);
      socket.on('categories_update', handleCategoriesUpdate);
      socket.on('topping_groups_update', handleToppingGroupsUpdate);
      
      // Cleanup function
      return () => {
        console.log('Admin: Cerrando conexión SSE');
        socket.off('products_update', handleProductsUpdate);
        socket.off('categories_update', handleCategoriesUpdate);
        socket.off('topping_groups_update', handleToppingGroupsUpdate);
        socket.emit('leaveBusiness', businessId);
      };
    } catch (error) {
      console.error('Error en la configuración de WebSocket:', error);
    }
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
    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('description', form.description);
    formData.append('price', form.price);
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
        showSuccessMessage('Producto creado exitosamente');
        setForm({
          name: '',
          description: '',
          price: '',
          category: '',
          image: '',
          toppingGroups: []
        });
        // Actualizar la lista de productos con el nuevo producto
        setProducts(prevProducts => [...prevProducts, response.data]);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
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
        price: Number(form.price),
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
      setEditingId(null);
      setEditingProduct(null);
      setShowConfirmModal(false);
      
      // Mostrar mensaje de éxito
      showSuccessMessage("Producto actualizado correctamente");
    } catch (error) {
      console.error("Error al actualizar producto:", error);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
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
      showSuccessMessage('Producto eliminado exitosamente');
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error) {
      console.error('Error al eliminar el producto:', error);
    }
  };

  const handleToggleProduct = async (productId) => {
    try {
      const response = await api.patch(`/products/${productId}/toggle`);
      
      // Actualizar el estado local del producto
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product._id === productId 
            ? { ...product, active: response.data.product.active }
            : product
        )
      );
      
      showSuccessMessage(response.data.message);
    } catch (error) {
      console.error('Error al cambiar estado del producto:', error);
      showSuccessMessage('Error al cambiar el estado del producto');
    }
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
      <div className="flex flex-col justify-center items-center min-h-screen bg-[#051C2C]">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 flex items-center justify-center mb-4">
            <svg className="animate-spin h-12 w-12 text-[#3A7AFF]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div className="mt-2 text-lg font-semibold text-white tracking-wide animate-pulse">Cargando...</div>
        </div>
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
      {/* SuperAdmin Banner */}
      {isSuperAdminMode && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed top-0 left-0 w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-3 px-4 text-center font-semibold z-[60] flex items-center justify-center shadow-lg"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Modo SuperAdmin - Visualización del panel de administración
        </motion.div>
      )}
      
      <div className="flex">
        {/* Modern Sidebar */}
        <ModernAdminSidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          businessConfig={businessConfig}
          handleLogout={logout}
          pendingOrdersCount={pendingOrdersCount}
        />

        {/* Main Content Area */}
        <div className="flex-1 ml-0">
          {/* Top Header */}
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40 ${isSuperAdminMode ? 'mt-12' : ''}`}
          >
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 capitalize">
                    {activeTab === 'products' && 'Gestión de Productos'}
                    {activeTab === 'product-order' && 'Orden de Productos'}
                    {activeTab === 'orders' && 'Panel de Pedidos'}
                    {activeTab === 'categories' && 'Gestión de Categorías'}
                    {activeTab === 'toppings' && 'Gestión de Extras'}
                    {activeTab === 'tables' && 'Configuración de Mesas'}
                    {activeTab === 'theme' && 'Personalización de Tema'}
                    {activeTab === 'location' && 'Configuración de Ubicación'}
                    {activeTab === 'catalog' && 'Gestión de Catálogo'}
                    {activeTab === 'whatsapp' && 'Configuración WhatsApp'}
                    {activeTab === 'business' && 'Configuración del Negocio'}
                    {activeTab === 'change-password' && 'Cambiar Contraseña'}
                    {activeTab === 'completed_orders' && 'Pedidos Completados'}
                  </h1>
                  <p className="text-slate-600 mt-1">
                    {activeTab === 'products' && 'Administra tu menú y productos'}
                    {activeTab === 'product-order' && 'Reordena cómo aparecen los productos en el menú'}
                    {activeTab === 'orders' && 'Gestiona pedidos en tiempo real'}
                    {activeTab === 'categories' && 'Organiza tu menú por categorías'}
                    {activeTab === 'toppings' && 'Configura extras y complementos'}
                    {activeTab === 'tables' && 'Administra mesas y códigos QR'}
                    {activeTab === 'theme' && 'Personaliza la apariencia de tu restaurante'}
                    {activeTab === 'location' && 'Configura tu ubicación para el catálogo'}
                    {activeTab === 'catalog' && 'Gestiona banners promocionales para el catálogo'}
                    {activeTab === 'whatsapp' && 'Personaliza el formato de mensajes WhatsApp'}
                    {activeTab === 'business' && 'Información y configuración general'}
                    {activeTab === 'change-password' && 'Actualiza tu contraseña de acceso'}
                    {activeTab === 'completed_orders' && 'Historial y resumen de pedidos'}
                  </p>
                </div>
                
        {isSuperAdminMode ? (
          <motion.button 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
            onClick={() => window.close()} 
                    className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl hover:from-yellow-500 hover:to-orange-600 transition-all duration-200 font-semibold shadow-lg flex items-center space-x-2"
          >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
                    <span>Cerrar Vista</span>
          </motion.button>
                ) : null}
          </div>
        </div>
          </motion.div>

          {/* Content Container */}
          <div className="p-6">
            {/* Subscription Status */}
            {businessConfig && businessConfig._id && (
              <div className="mb-6">
                <SubscriptionStatus businessId={businessConfig._id} />
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
                {activeTab === 'business' && <BusinessSettings />}
          {activeTab === 'categories' && <CategorySettings categories={categories} />}
          {activeTab === 'toppings' && <ToppingGroupsManager />}
          {activeTab === 'tables' && <TableSettings />}
          {activeTab === 'theme' && <ThemeSettings />}
          {activeTab === 'location' && <LocationSettings />}
          {activeTab === 'catalog' && (
            <div className="space-y-6">
              {/* Tabs para alternar entre vistas */}
              <div className="flex space-x-4 mb-6">
                <button
                  onClick={() => setActiveCatalogTab('upload')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeCatalogTab === 'upload' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Subir Banners
                </button>
                <button
                  onClick={() => setActiveCatalogTab('view')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeCatalogTab === 'view' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Mis Banners
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
          {activeTab === 'change-password' && <ChangePassword />}
                {activeTab === 'orders' && <ModernOrdersDashboard />}
          {activeTab === 'completed_orders' && <CompletedOrdersSummary />}
                
                {/* Products Management */}
          {activeTab === 'products' && (
                  <div className="space-y-6">
                    {/* Modern Product Form */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                      className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl p-8 border border-slate-200/50 backdrop-blur-sm"
              >
                        {/* Form Header */}
                        <div className="mb-8 text-center">
                          <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <span className="text-2xl">🍔</span>
                          </div>
                          <h2 className="text-2xl font-bold text-slate-900 mb-2">
                            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                          </h2>
                          <p className="text-slate-600">
                            {editingProduct ? 'Actualiza la información del producto' : 'Agrega un nuevo producto a tu menú'}
                          </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column */}
                            <div className="space-y-6">
                              {/* Product Name */}
                              <div className="group">
                                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                                  <span className="mr-2">🏷️</span>
                        Nombre del Producto
                      </label>
                                <div className="relative">
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                                    className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 text-lg transition-all duration-200 group-hover:border-slate-300"
                                    placeholder="Ej: Hamburguesa Clásica"
                        required
                      />
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                                    <span className="text-slate-400">✨</span>
                    </div>
                                </div>
                              </div>

                              {/* Description */}
                              <div className="group">
                                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                                  <span className="mr-2">📝</span>
                        Descripción
                      </label>
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                                  rows="4"
                                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300 resize-none"
                                  placeholder="Describe tu producto de manera atractiva..."
                      ></textarea>
                    </div>

                              {/* Price and Category Row */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Price */}
                                <div className="group">
                                  <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                                    <span className="mr-2">💰</span>
                        Precio
                      </label>
                                  <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-4">
                                      <span className="text-slate-500 font-medium">$</span>
                                    </div>
                        <input
                          name="price"
                        type="number"
                        min="0"
                        step="0.01"
                          value={form.price}
                          onChange={handleChange}
                                      className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 pl-12 pr-6 py-4 text-lg font-semibold transition-all duration-200 group-hover:border-slate-300"
                          placeholder="0.00"
                          required
                        />
                    </div>
                                </div>

                                {/* Category */}
                                <div className="group">
                                  <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                                    <span className="mr-2">📂</span>
                        Categoría
                      </label>
                      <select
                        name="category"
                        value={form.category}
                        onChange={handleChange}
                                    className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                      >
                        <option value="">Sin categoría</option>
                        {categories.map(category => (
                          <option key={category._id} value={category._id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                              {/* Image URL */}
                              <div className="group">
                                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                                  <span className="mr-2">🖼️</span>
                                  Imagen del Producto
                      </label>
                        <input
                          name="image"
                          value={form.image}
                          onChange={handleChange}
                                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                        placeholder="https://ejemplo.com/imagen.jpg"
                        />
                      </div>

                              {/* Image Preview */}
                    {form.image && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="group"
                                >
                                  <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                                    <span className="mr-2">👀</span>
                                    Vista Previa
                                  </label>
                                  <div className="relative w-full h-48 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-lg">
                          <img
                            src={form.image}
                            alt="Vista previa"
                                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    <div style={{ display: 'none' }} className="w-full h-full flex items-center justify-center">
                                      <span className="text-4xl">🖼️</span>
                        </div>
                      </div>
                                </motion.div>
                              )}

                              {/* Toppings */}
                              <div className="group">
                                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                                  <span className="mr-2">🧀</span>
                                  Extras Disponibles
                                </label>
                                <div className="bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-slate-200 p-4">
                                  <ProductFormToppingSelector 
                                    toppingGroups={toppingGroups} 
                                    selectedToppings={form.toppingGroups} 
                                    onChange={handleToppingGroupsChange}
                                  />
                                </div>
                              </div>

                              {/* Reordenamiento de Toppings */}
                              {form.toppingGroups && form.toppingGroups.length > 0 && (
                                <div className="group">
                                  <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                                    <span className="mr-2">🔄</span>
                                    Orden de los Extras
                                  </label>
                                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-slate-200 p-4">
                                    <ProductToppingOrderSelector 
                                      selectedToppings={form.toppingGroups} 
                                      onChange={handleToppingGroupsChange}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex justify-center space-x-4 pt-8 border-t border-slate-200">
                            {editingProduct && (
                              <motion.button
                      type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setEditingProduct(null);
                                  setForm({ name: '', description: '', price: '', category: '', image: '', toppingGroups: [] });
                                }}
                                className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-2xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 font-semibold flex items-center space-x-2 shadow-lg"
                              >
                                <span>❌</span>
                                <span>Cancelar</span>
                              </motion.button>
                            )}
                            <motion.button
                    type="submit"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-semibold shadow-xl flex items-center space-x-2"
                  >
                              <span>{editingProduct ? '✏️' : '✨'}</span>
                              <span>{editingProduct ? 'Actualizar Producto' : 'Crear Producto'}</span>
                            </motion.button>
                </div>
                        </form>
              </motion.div>
              
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
                            <div className="mb-4 flex-grow">
                              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                                {product.name}
                              </h3>
                              <p className="text-sm text-gray-600 leading-relaxed min-h-[60px]">
                                {product.description}
                              </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-1 mt-auto">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => editProduct(product)}
                                className="flex-1 bg-blue-500 text-white px-2 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center space-x-1 text-xs min-w-0"
                              >
                                <span>✏️</span>
                                <span className="truncate">Editar</span>
                              </motion.button>
                              
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleToggleProduct(product._id)}
                                className={`flex-1 px-2 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-1 text-xs min-w-0 ${
                                  product.active !== false
                                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                                    : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                                title={product.active !== false ? 'Desactivar producto' : 'Activar producto'}
                              >
                                <span>{product.active !== false ? '👁️‍🗨️' : '👁️'}</span>
                                <span className="truncate">{product.active !== false ? 'Apagar' : 'Encender'}</span>
                              </motion.button>
                              
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => deleteProduct(product._id)}
                                className="flex-1 bg-red-500 text-white px-2 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors duration-200 flex items-center justify-center space-x-1 text-xs min-w-0"
                              >
                                <span>🗑️</span>
                                <span className="truncate">Eliminar</span>
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
              <WhatsAppCustomizer />
            </motion.div>
          )}
                
              </motion.div>
            </AnimatePresence>
        </div>
        </div>
      </div>

      {/* Success Message Banner */}
          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-20 left-1/2 transform -translate-x-1/2 p-3 bg-green-500/20 text-green-300 text-sm rounded-lg border border-green-500/30 z-50"
            >
              {successMessage}
            </motion.div>
          )}
          
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

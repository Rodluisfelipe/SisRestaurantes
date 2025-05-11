import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import BusinessSettings from "../Components/BusinessSettings";
import CategorySettings from "../Components/CategorySettings";
import ToppingGroupsManager from '../Components/ToppingGroupsManager';
import ProductFormToppingSelector from '../Components/ProductFormToppingSelector';
import { API_ENDPOINTS } from "../config";
import api from "../services/api";
import ProductToppingSelector from '../Components/ProductToppingSelector';
import { useAuth } from "../Context/AuthContext";
import ThemeSettings from '../Components/ThemeSettings';
import { useBusinessConfig } from '../Context/BusinessContext';
import ChangePassword from "../Components/ChangePassword";
import { socket } from '../services/api';
import { isValidObjectId, isValidBusinessIdentifier } from '../utils/isValidObjectId';
import TableSettings from "../Components/TableSettings";
import OrdersDashboard from "../Components/OrdersDashboard";
import CompletedOrdersSummary from "../Components/CompletedOrdersSummary";
import { motion } from "framer-motion";

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

export default function Admin() {
  const { isAuthenticated, logout, user, login, loading } = useAuth();
  const { businessConfig } = useBusinessConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const { businessId } = useBusinessConfig();
  const [activeTab, setActiveTab] = useState('products');
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
  const redirectionCountRef = useRef(0);
  const initialRenderRef = useRef(true);
  
  // Check if user is a superadmin viewing in temporary mode
  const isSuperAdminMode = user?.role === 'superadmin' || user?.username === 'superadmin_temp';
  
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
      
      // Log detallado de los grupos de toppings
      console.log('Detalle de grupos de toppings:', toppingGroupsRes.data.map(group => ({
        id: group._id,
        name: group.name,
        options: group.options ? group.options.length : 0
      })));
      
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setToppingGroups(toppingGroupsRes.data);
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
    <div className="min-h-screen bg-[#051C2C]">
      {/* SuperAdmin Banner */}
      {isSuperAdminMode && (
        <div className="fixed top-0 left-0 w-full bg-yellow-500 text-yellow-900 py-1 px-4 text-center font-semibold z-[60] flex items-center justify-center">
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Modo SuperAdmin - Visualización del panel de administración
        </div>
      )}
      
      {/* Header */}
      <header className={`fixed top-0 left-0 w-full bg-[#333F50] shadow-lg z-50 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#333F50]/80 ${isSuperAdminMode ? 'mt-7' : ''}`}>
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center space-x-3"
        >
          {/* Botón de menú móvil */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md text-[#D1D9FF] hover:bg-[#051C2C]/30 lg:hidden transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
          <img src={businessConfig.logo || '/logo.png'} alt="Logo" className="h-10 w-10 rounded-full object-cover border-2 border-[#5FF9B4] shadow" />
          <span className="text-lg font-bold text-white tracking-wide hidden sm:inline">{businessConfig.businessName || 'Panel Admin'}</span>
        </motion.div>
        {isSuperAdminMode ? (
          <motion.button 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            onClick={() => window.close()} 
            className="px-4 py-2 bg-yellow-500 text-yellow-900 rounded-lg hover:bg-yellow-600 transition-colors font-semibold shadow-md"
          >
            Cerrar Vista
          </motion.button>
        ) : (
          <motion.button 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            onClick={logout} 
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
            </svg>
            Salir
          </motion.button>
        )}
      </header>

      {/* Navegación lateral */}
      <nav className={`fixed w-64 h-full bg-[#333F50]/90 shadow-xl pt-16 transition-transform duration-300 ease-in-out transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 z-40 border-r border-[#333F50] ${isSuperAdminMode ? 'mt-7' : ''}`}>
        <div className="px-4 py-6 h-full overflow-y-auto">
          <div className="space-y-2">
            {[
              { name: 'Productos', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', tab: 'products' },
              { name: 'Información', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', tab: 'settings' },
              { name: 'Categorías', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v2', tab: 'categories' },
              { name: 'Toppings', icon: 'M12 6v6l4 2', tab: 'toppings' },
              { name: 'Mesas', icon: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', tab: 'tables' },
              { name: 'Personalización', icon: 'M12 4v16m8-8H4', tab: 'theme' },
              { name: 'Cambiar contraseña', icon: 'M12 11c0-1.104.896-2 2-2s2 .896 2 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2c0-1.104.896-2 2-2s2 .896 2 2', tab: 'change-password' },
              { name: 'Pedidos', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', tab: 'orders' },
              { name: 'Resumen de Pedidos', icon: 'M12 12a1 1 0 011-1h.01a1 1 0 110 2H13a1 1 0 01-1-1z', tab: 'completed_orders' },
            ].map(({ name, icon, tab }) => (
              <motion.button
                key={tab}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * ["products", "settings", "categories", "toppings", "tables", "theme", "change-password", "orders", "completed_orders"].indexOf(tab) }}
                onClick={() => {
                  setActiveTab(tab);
                  setIsMobileMenuOpen(false);
                }}
                className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors duration-200 ${
                  activeTab === tab 
                    ? 'bg-[#3A7AFF]/20 text-[#3A7AFF] font-semibold border border-[#3A7AFF]/20' 
                    : 'text-[#D1D9FF] hover:bg-[#051C2C]/30'
                }`}
              >
                <svg className="h-5 w-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
                <span className="truncate">{name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </nav>

      {/* Overlay para cerrar el menú en móvil */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Contenido principal responsive */}
      <main className={`pt-16 ${isMobileMenuOpen ? 'lg:pl-64' : 'lg:pl-64'} transition-all duration-300 ${isSuperAdminMode ? 'mt-7' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Banner de mensaje de éxito */}
          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-20 left-1/2 transform -translate-x-1/2 p-3 bg-green-500/20 text-green-300 text-sm rounded-lg border border-green-500/30 z-50"
            >
              {successMessage}
            </motion.div>
          )}
          
          {/* Modal de confirmación de edición */}
          <ConfirmationModal
            isOpen={showConfirmModal}
            onClose={cancelEdit}
            onConfirm={confirmEdit}
            product={editingProduct || {}}
            formData={form}
          />
          
          {/* Modal de confirmación de eliminación */}
          <DeleteConfirmationModal
            isOpen={showDeleteModal}
            onClose={cancelDelete}
            onConfirm={confirmDelete}
            product={productToDelete || {}}
          />

          {activeTab === 'settings' && <BusinessSettings />}
          {activeTab === 'categories' && <CategorySettings categories={categories} />}
          {activeTab === 'toppings' && <ToppingGroupsManager />}
          {activeTab === 'tables' && <TableSettings />}
          {activeTab === 'theme' && <ThemeSettings />}
          {activeTab === 'change-password' && <ChangePassword />}
          {activeTab === 'orders' && <OrdersDashboard />}
          {activeTab === 'completed_orders' && <CompletedOrdersSummary />}
          {activeTab === 'products' && (
            <>
              <motion.form 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                onSubmit={handleSubmit} 
                className="bg-[#333F50]/80 rounded-2xl shadow-xl p-4 sm:p-6 mb-8 border border-[#333F50]"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#D1D9FF] mb-1">
                        Nombre del Producto
                      </label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-[#333F50] bg-[#333F50]/50 shadow-sm focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-white placeholder-[#A5B9FF]/70 px-3 py-2.5"
                        placeholder="Ej: Pizza Margherita"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#D1D9FF] mb-1">
                        Descripción
                      </label>
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows="3"
                        className="w-full rounded-lg border border-[#333F50] bg-[#333F50]/50 shadow-sm focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-white placeholder-[#A5B9FF]/70 px-3 py-2.5"
                        placeholder="Descripción detallada del producto"
                      ></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#D1D9FF] mb-1">
                        Precio
                      </label>
                        <input
                          name="price"
                        type="number"
                        min="0"
                        step="0.01"
                          value={form.price}
                          onChange={handleChange}
                        className="w-full rounded-lg border border-[#333F50] bg-[#333F50]/50 shadow-sm focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-white placeholder-[#A5B9FF]/70 px-3 py-2.5"
                          placeholder="0.00"
                          required
                        />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#D1D9FF] mb-1">
                        Categoría
                      </label>
                      <select
                        name="category"
                        value={form.category}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-[#333F50] bg-[#333F50]/50 shadow-sm focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-white px-3 py-2.5"
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
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#D1D9FF] mb-1">
                        URL de la imagen
                      </label>
                        <input
                          name="image"
                          value={form.image}
                          onChange={handleChange}
                        className="w-full rounded-lg border border-[#333F50] bg-[#333F50]/50 shadow-sm focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-white placeholder-[#A5B9FF]/70 px-3 py-2.5"
                        placeholder="https://ejemplo.com/imagen.jpg"
                        />
                      </div>
                    <div>
                      <label className="block text-sm font-medium text-[#D1D9FF] mb-1">
                    Grupos de Toppings
                  </label>
                    <ProductFormToppingSelector 
                      toppingGroups={toppingGroups} 
                        selectedGroups={form.toppingGroups} 
                      onChange={handleToppingGroupsChange}
                    />
                    </div>
                    {form.image && (
                      <div className="mt-2">
                        <p className="text-sm text-[#D1D9FF] mb-1">Vista previa:</p>
                        <div className="relative w-32 h-32 border border-[#333F50] rounded-lg overflow-hidden bg-[#051C2C]/50">
                          <img
                            src={form.image}
                            alt="Vista previa"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = 'https://placehold.co/100x100?text=Error';
                            }}
                          />
                </div>
                      </div>
                    )}
                    <div className="flex items-end justify-end space-x-2 pt-6">
                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                          className="px-4 py-2 rounded-lg font-medium border border-[#333F50] bg-[#333F50]/50 text-[#A5B9FF] hover:bg-[#051C2C]/30 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                        className="px-4 py-2 rounded-lg text-white font-medium bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 transition-colors shadow-lg hover:shadow-[#3A7AFF]/20"
                  >
                        {editingId ? "Guardar Cambios" : "Agregar Producto"}
                  </button>
                </div>
                  </div>
                </div>
              </motion.form>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-[#333F50]/80 rounded-2xl shadow-xl p-4 sm:p-6 border border-[#333F50]"
              >
                <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <h3 className="text-xl font-bold text-white">Productos</h3>
                  <p className="text-sm text-[#D1D9FF]">Total: {products.length} productos</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-[#D1D9FF]">
                        <th className="p-3 text-left">Producto</th>
                        <th className="p-3 text-left">Categoría</th>
                        <th className="p-3 text-right">Precio</th>
                        <th className="p-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.length > 0 ? (
                        products.map((product, idx) => (
                          <motion.tr 
                            key={product._id} 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.03 }}
                            className="transition-colors bg-[#051C2C]/60 hover:bg-[#051C2C] border-b border-[#333F50]/30"
                          >
                            <td className="p-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-[#333F50]/50 border border-[#333F50]">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.src = 'https://placehold.co/100x100?text=Error';
                                      }}
                          />
                        ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#333F50]">
                                      <svg className="w-6 h-6 text-[#A5B9FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        </div>
                                <div>
                                  <p className="font-semibold text-white">{product.name}</p>
                                  {product.description && (
                                    <p className="text-xs text-[#A5B9FF] line-clamp-1">{product.description}</p>
                                  )}
                      </div>
                            </div>
                            </td>
                            <td className="p-3 text-[#D1D9FF]">{product.categoryName || "Sin categoría"}</td>
                            <td className="p-3 text-right font-medium text-white">${product.price}</td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end space-x-2">
                            <button
                                  onClick={() => handleEdit(product)}
                                  className="p-1.5 rounded-lg text-[#3A7AFF] hover:bg-[#3A7AFF]/10 transition-colors"
                                  title="Editar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                                  onClick={() => handleDelete(product)}
                                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Eliminar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                            </td>
                          </motion.tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="p-4 text-center text-[#D1D9FF]">
                            No hay productos disponibles. Agrega uno usando el formulario de arriba.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                        </div>
              </motion.div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

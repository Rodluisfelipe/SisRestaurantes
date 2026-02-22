// @charset UTF-8
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import ProductCard from "../Components/Productcard";
import BusinessHeader from "../Components/BusinessHeader";
import CartSummary from "../Components/CartSummary";
import OrderTypeSelector from "../Components/OrderTypeSelector";
import FilterableMenu from "../Components/FilterableMenu";
import OrderConfirmationModal from "../Components/OrderConfirmationModal";
import CartBar from "../Components/CartBar";
import FavoritesModal from "../Components/FavoritesModal";
import OrderHistoryModal from "../Components/OrderHistoryModal";
import FeaturedProducts from "../Components/FeaturedProducts";
import { FlyToCartProvider } from "../Components/FlyToCart";
import { FilterableMenuSkeleton, BusinessHeaderSkeleton } from "../Components/MenuSkeletons";
import SplashScreen from "../Components/SplashScreen";
import RestaurantClosedOverlay from "../Components/RestaurantClosedOverlay";
import OrderTracker from "../Components/OrderTracker";
import PaymentUpload from "../Components/PaymentUpload";
import MyOrders from "../Components/MyOrders";
import { useBusinessStatus } from "../hooks/useBusinessStatus";
import api from "../services/api";
import { useBusinessConfig } from "../Context/BusinessContext";
import '../../styles/scrollbar.css';
import { socket } from '../services/socket';
import { isValidBusinessIdentifier } from '../utils/isValidObjectId';
import * as SessionManager from '../utils/sessionManager';
import { calculateItemPrice, calculateTotalAmount, calculateTotalItems, createWhatsAppMessage } from '../utils/orderUtils';
import logger from '../utils/logger';
import { isPushSupported, subscribeToPush } from '../utils/pushNotifications';
import { useParams, useNavigate } from 'react-router-dom';
import NotFound from './NotFound';
import LeadCapturePage from './LeadCapturePage';
import useSEO from '../hooks/useSEO';

/**
 * Página principal del Menú para clientes
 *
 * Funcionalidad:
 * - Muestra productos organizados por categorías
 * - Permite agregar productos al carrito
 * - Gestiona selección de opciones adicionales (toppings)
 * - Muestra resumen del carrito y posibilita crear pedidos
 * - Se actualiza en tiempo real mediante Server-Sent Events
 */

// Función para obtener el orden de las categorías
const getCategoryOrder = () => {
  try {
    const savedOrder = SessionManager.getFromLocalStorage('categoryOrderSettings');
    return savedOrder ? savedOrder : {};
  } catch (error) {
    logger.error('Error al obtener orden de categorías:', error);
    return {};
  }
};

// Función para verificar si la sesión actual es válida (no ha expirado)
const isValidSession = () => {
  const sessionStartTime = SessionManager.getFromLocalStorage('sessionStartTime');
  if (!sessionStartTime) return false;
  
  // Máximo tiempo de sesión: 3 horas (10800000 ms)
  const MAX_SESSION_TIME = 3 * 60 * 60 * 1000;
  const currentTime = Date.now();
  const sessionAge = currentTime - parseInt(sessionStartTime);
  
  return sessionAge < MAX_SESSION_TIME;
};

export default function Menu() {
  const { tableNumber: tableFromUrl } = useParams();
  const isQRMode = !!tableFromUrl;
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(() => {
    return SessionManager.getFromSession('cart', []);
  });
  
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [isSelectingToppings, setIsSelectingToppings] = useState(false);
  const { businessConfig, businessId, error: businessError } = useBusinessConfig();
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
  const [orderConfirmationDetails, setOrderConfirmationDetails] = useState({
    type: '',
    message: ''
  });
  const [businessNotFound, setBusinessNotFound] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null); // null, 'active', 'grace', 'suspended'
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  
  // Business hours status (open/closed)
  const { businessStatus, loading: statusLoading } = useBusinessStatus(businessId);
  const [closedOverlayDismissed, setClosedOverlayDismissed] = useState(false);

  // Estados para modales de favoritos e historial
  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // In-app ordering states
  const [showOrderTracker, setShowOrderTracker] = useState(false);
  const [showPaymentUpload, setShowPaymentUpload] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState(() => sessionStorage.getItem('activeOrderId') || null);
  const [activeCustomerToken, setActiveCustomerToken] = useState(() => sessionStorage.getItem('activeCustomerToken') || null);
  const [activeOrderStatus, setActiveOrderStatus] = useState(null);
  
  // Check if business uses in-app ordering
  const isInAppMode = businessConfig?.orderingMode === 'inapp' || businessConfig?.orderingMode === 'both';

  // Poll active order status for banner display
  useEffect(() => {
    if (!activeOrderId || !activeCustomerToken || !isInAppMode) {
      setActiveOrderStatus(null);
      return;
    }
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await api.get(`/orders/track/${activeOrderId}?token=${activeCustomerToken}`);
        if (!cancelled) setActiveOrderStatus(res.data.status || null);
      } catch {
        if (!cancelled) setActiveOrderStatus(null);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeOrderId, activeCustomerToken, isInAppMode]);

  // Clear active order (user confirmed completed order)
  const clearActiveOrder = useCallback(() => {
    setActiveOrderId(null);
    setActiveCustomerToken(null);
    setActiveOrderStatus(null);
    sessionStorage.removeItem('activeOrderId');
    sessionStorage.removeItem('activeCustomerToken');
  }, []);
  
  // Detectar si viene del catálogo de restaurantes
  const [comesFromCatalog, setComesFromCatalog] = useState(() => {
    // Verificar si el referrer contiene "/restaurantes"
    const referrer = document.referrer;
    const fromCatalog = referrer.includes('/restaurantes');
    
    // Guardar en sessionStorage para mantener el estado durante la navegación
    if (fromCatalog) {
      sessionStorage.setItem('fromCatalog', 'true');
      return true;
    }
    
    // Verificar si ya estaba marcado en sessionStorage
    return sessionStorage.getItem('fromCatalog') === 'true';
  });
  
  // Initialize orderInfo with the appropriate storage
  const [orderInfo, setOrderInfo] = useState(() => {
    // Obtener información guardada de la sesión
    const savedOrderInfo = SessionManager.loadOrderInfo();
    
    if (savedOrderInfo) {
      // Si hay información guardada, usarla
      // En modo QR, asegurarse de usar el número de mesa de la URL
      if (isQRMode && tableFromUrl) {
        return { ...savedOrderInfo, tableNumber: tableFromUrl };
      }
      return savedOrderInfo;
    }
    
    // Si no hay información guardada, crear base según modo
    if (isQRMode) {
      return {
        customerName: '',
        phone: '',
        orderType: '',
        tableNumber: tableFromUrl || ''
      };
    } else {
      // En modo normal, usar nombre y teléfono guardados si existen
      const savedName = SessionManager.getSavedCustomerName();
      const savedPhone = SessionManager.getFromLocalStorage('customerPhone', '') || localStorage.getItem('customerPhone');
      return {
        customerName: savedName || '',
        phone: savedPhone || '',
        orderType: '',
        tableNumber: ''
      };
    }
  });

  // SEO optimization
  useSEO({
    title: businessConfig?.businessName ? `${businessConfig.businessName} - Menú Digital` : 'Menú Digital',
    description: businessConfig?.description || `Descubre el delicioso menú de ${businessConfig?.businessName || 'nuestro restaurante'}. Ordena online y disfruta de la mejor comida.`,
    logo: businessConfig?.logo,
    siteName: businessConfig?.businessName || 'Restaurante',
    url: window.location.href,
    type: 'restaurant',
    keywords: `${businessConfig?.businessName || 'restaurante'}, menú digital, pedidos online, ${businessConfig?.city ? businessConfig.city + ', ' : ''}${businessConfig?.department ? businessConfig.department + ', ' : ''}comida, delivery`,
    image: businessConfig?.coverImage || businessConfig?.logo,
    businessConfig
  });

  // Determinar si debe mostrar el selector de tipo de pedido
  const shouldShowOrderTypeSelector = () => {
    // Si ya hay información de pedido guardada con nombre y teléfono, no mostrar el selector
    const savedOrderInfo = SessionManager.getFromSession('orderInfo');
    if (savedOrderInfo && savedOrderInfo.customerName && savedOrderInfo.phone) {
      logger.info('Hay información de cliente guardada, no mostrar selector inicial');
      return false;
    }
    
    // En modo QR, mostrar selector incluso si hay información para validar mesa
    if (isQRMode) {
      logger.info('Modo QR: mostrar selector inicial para confirmar mesa', tableFromUrl);
      return true;
    }
    
    // En modo normal, verificar si hay nombre y teléfono guardados
    const savedName = SessionManager.getSavedCustomerName();
    const savedPhone = SessionManager.getFromLocalStorage('customerPhone', '') || localStorage.getItem('customerPhone');
    if (savedName && savedName.trim() !== '' && savedPhone && savedPhone.trim() !== '') {
      logger.info('Hay nombre y teléfono guardados en localStorage, no mostrar selector inicial');
      
      // El nombre y teléfono ya deberían estar en orderInfo por la inicialización del estado
      // No necesitamos setOrderInfo aquí, evitando el problema de inicialización
      
      return false;
    }
    
    // Si no hay información completa de cliente, mostrar el selector para pedir nombre y teléfono
    logger.info('No hay información completa de cliente, mostrar selector inicial para pedir nombre y teléfono');
    return true;
  };

  const [showOrderTypeSelector, setShowOrderTypeSelector] = useState(() => {
    return shouldShowOrderTypeSelector();
  });

  // Effect para guardar orderInfo cuando se actualice
  useEffect(() => {
    if (orderInfo && orderInfo.customerName) {
      SessionManager.saveToSession('orderInfo', orderInfo);
    }
  }, [orderInfo]);

  // Use table number as a dependency for some effects
  useEffect(() => {
    logger.info('Current table number:', tableFromUrl);
  }, [tableFromUrl]);

  // Si la sesión expiró o no viene de QR, limpiar localStorage de QR
  useEffect(() => {
    if (isQRMode && !tableFromUrl) {
      SessionManager.removeFromLocalStorage('tableQR_currentTable');
      SessionManager.removeFromLocalStorage('isTableQRSession');
      SessionManager.removeFromLocalStorage('tableQR_orderInfo');
    }
  }, [isQRMode, tableFromUrl]);

  // Guardar carrito en la sesión
  useEffect(() => {
    SessionManager.saveToSession('cart', cart);
  }, [cart]);

  // Si la sesión expiró o no viene de QR, limpiar datos obsoletos
  useEffect(() => {
    // Al montar el componente, limpiar cualquier sesión obsoleta
    if (!isQRMode) {
      // Si estamos en modo normal, limpiar cualquier dato QR que pudiera haber
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('qr_session_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, [isQRMode]);

  // Listener para eventos de storage entre pestañas
  useEffect(() => {
    const handleStorageChange = (event) => {
      // Solo procesamos eventos de sessionStorage
      if (!event.storageArea || event.storageArea !== sessionStorage) return;
      
      const prefix = SessionManager.getPrefix();
      
      // Si el evento es para nuestra sesión actual
      if (event.key && event.key.startsWith(prefix)) {
        const actualKey = event.key.replace(prefix, '');
        
        if (actualKey === 'cart') {
          try {
            const newCart = event.newValue ? JSON.parse(event.newValue) : [];
            setCart(newCart);
          } catch (error) {
            logger.error('Error parsing cart from sessionStorage:', error);
          }
        }
        
        if (actualKey === 'orderInfo') {
          try {
            const newOrderInfo = JSON.parse(event.newValue);
            setOrderInfo(newOrderInfo);
          } catch (error) {
            logger.error('Error parsing orderInfo from sessionStorage:', error);
          }
        }
      }
    };
    
    // Añadir listener para sessionStorage
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    logger.info('Menu - businessId:', businessId, 'type:', typeof businessId);
    logger.info('Menu - businessConfig:', businessConfig);
  }, [businessId, businessConfig]);

  useEffect(() => {
    if (businessConfig?.businessName) {
      document.title = businessConfig.businessName;
    }
    if (businessConfig?.logo) {
      let favicon = document.querySelector("link[rel='icon']") || document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/png';
      favicon.href = businessConfig.logo;
      document.head.appendChild(favicon);
    }
  }, [businessConfig.businessName, businessConfig.logo]);

  useEffect(() => {
    // Verificar si hay un error con el businessId o si no se encontró el negocio
    if (businessError) {
      logger.error('Menu - Error cargando negocio:', businessError);
      
      // Si es un error 404, mostrar NotFound
      if (businessError.response && businessError.response.status === 404) {
        setBusinessNotFound(true);
      }
    }
  }, [businessError]);

  // Cargar estado de suscripción
  useEffect(() => {
    if (!businessId) return;
    
    const loadSubscriptionStatus = async () => {
      try {
        setSubscriptionLoading(true);
        const response = await api.get(`/subscriptions/check/${businessId}`);
        if (response.data.success && response.data.subscription) {
          const sub = response.data.subscription;
          
          // Usar el estado calculado por el backend (más confiable)
          // El backend ya calcula el estado usando getCurrentStatus() que considera:
          // - active: si now <= periodEnd
          // - grace: si now > periodEnd pero now <= graceUntil
          // - suspended: si now > graceUntil
          const backendStatus = sub.status;
          
          // Verificar manualmente como respaldo si el backend no envió el status
          let status = backendStatus;
          if (!backendStatus) {
            const now = new Date();
            const periodEnd = sub.periodEnd ? new Date(sub.periodEnd) : (sub.endDate ? new Date(sub.endDate) : null);
            const graceUntil = sub.graceUntil ? new Date(sub.graceUntil) : (periodEnd ? new Date(new Date(periodEnd).getTime() + 5 * 24 * 60 * 60 * 1000) : null);
            
            if (periodEnd && graceUntil) {
              if (now > graceUntil) {
                status = 'suspended';
              } else if (now > periodEnd) {
                status = 'grace';
              } else {
                status = 'active';
              }
            } else {
              status = 'active';
            }
          }
          
          logger.info('Menu - Estado de suscripción cargado:', { 
            status, 
            backendStatus, 
            periodEnd: sub.periodEnd, 
            graceUntil: sub.graceUntil,
            now: new Date().toISOString(),
            periodEndDate: sub.periodEnd ? new Date(sub.periodEnd).toISOString() : null,
            graceUntilDate: sub.graceUntil ? new Date(sub.graceUntil).toISOString() : null
          });
          
          // Asegurar que el estado se establezca correctamente
          if (status === 'suspended') {
            logger.warn('Menu - SUSCRIPCIÓN SUSPENDIDA - El menú debe estar bloqueado');
          }
          
          setSubscriptionStatus(status);
        } else {
          // Sin suscripción = activo (para no bloquear el menú si no hay suscripción configurada)
          setSubscriptionStatus(null);
        }
      } catch (err) {
        // Si no hay suscripción o hay error, asumir que está activo (para no bloquear el menú)
        logger.warn('Error cargando estado de suscripción:', err);
        setSubscriptionStatus(null);
      } finally {
        setSubscriptionLoading(false);
      }
    };
    
    loadSubscriptionStatus();
    
    // Actualizar el estado cada minuto para asegurar que se actualice cuando cambie el estado
    const interval = setInterval(() => {
      loadSubscriptionStatus();
    }, 60000); // Cada minuto
    
    return () => clearInterval(interval);
  }, [businessId]);

  useEffect(() => {
    // Usar isValidBusinessIdentifier en lugar de isValidObjectId para aceptar tanto slugs como ObjectIDs
    const isValid = isValidBusinessIdentifier(businessId);
    logger.info('Menu - businessId es válido:', isValid, businessId);
    
    if (!isValid) {
      logger.info('Menu - businessId no es válido, no se cargarán datos');
      return;
    }
    
    setLoading(true);
    const fetchData = async () => {
      try {
        logger.info('Menu - Cargando datos para businessId:', businessId);
        const [productsRes, categoriesRes] = await Promise.all([
          api.get(`/products?businessId=${businessId}`),
          api.get(`/categories?businessId=${businessId}`)
        ]);
        logger.info('Menu - Datos recibidos:', {
          products: productsRes.data.length,
          categories: categoriesRes.data.length
        });
        setProducts(productsRes.data);
        setCategories(categoriesRes.data);
      } catch (err) {
        logger.error("Error al obtener datos:", err);
      } finally {
        setLoading(false);
        // Keep splash visible a moment for branding, then dismiss
        setTimeout(() => setShowSplash(false), 800);
      }
    };
    fetchData();


    // Comentar temporalmente los SSE hasta que el backend los soporte
    /*
    const eventSource = new EventSource(`${API_ENDPOINTS.EVENTS}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        logger.info('Evento recibido:', data.type);
        
        switch (data.type) {
          case 'products_update':
            logger.info('Actualizando productos:', data.data.length);
            setProducts(data.data);
            break;
          case 'categories_update':
            logger.info('Actualizando categorías:', data.data.length);
            setCategories(data.data.categories || data.data);
            break;
          case 'business_config_update':
            logger.info('Actualizando configuración del negocio:', data.data);
            setBusinessConfig(data.data);
            break;
          default:
            break;
        }
      } catch (error) {
        logger.error('Error procesando evento:', error);
      }
    };

    eventSource.onerror = (error) => {
      logger.error('Error en la conexión SSE:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
    */
  }, [businessId]);

  useEffect(() => {
    // Usar isValidBusinessIdentifier en lugar de isValidObjectId
    const isValid = isValidBusinessIdentifier(businessId);
    if (!isValid) {
      logger.info('Menu - businessId no es válido para socket:', businessId);
      return;
    }
    
    if (socket && !socket.connected) {
      socket.connect();
    }
    if (socket) {
      socket.emit('joinBusiness', businessId);
    }
    logger.info('Socket joinBusiness:', businessId);
    if (socket) {
      socket.on('products_update', (data) => {
        if (data.type === 'created') {
          setProducts((prev) => [...prev, data.product]);
        } else if (data.type === 'deleted') {
          setProducts((prev) => prev.filter(p => p._id !== data.productId));
        }
        // Puedes agregar lógica para 'updated' si lo implementas en backend
      });
      socket.on('categories_update', (data) => {
        if (data.type === 'created') {
          setCategories((prev) => [...prev, data.category]);
        } else if (data.type === 'updated') {
          setCategories((prev) => prev.map(cat => cat._id === data.category._id ? data.category : cat));
        } else if (data.type === 'deleted') {
          setCategories((prev) => prev.filter(cat => cat._id !== data.categoryId));
        }
      });
    }
    
    return () => {
      if (socket) {
        socket.emit('leaveBusiness', businessId);
        socket.off('products_update');
        socket.off('categories_update');
      }
    };
  }, [businessId]);

  const addToCart = (product) => {
    // Verificar si la suscripción está suspendida
    if (subscriptionStatus === 'suspended') {
      logger.warn('Menu - addToCart bloqueado: suscripción suspendida', { subscriptionStatus, productId: product._id });
      // Mensaje sutil sin mencionar problemas de pago
      return;
    }
    
    setCart(prevCart => {
      const toppingsString = JSON.stringify(product.selectedToppings || {});
      const uniqueId = `${product._id}-${toppingsString.replace(/[{}",:]/g, '')}`;
      const existingItemIndex = prevCart.findIndex(item => item.uniqueId === uniqueId);

      if (existingItemIndex >= 0) {
        const newCart = [...prevCart];
        newCart[existingItemIndex] = {
          ...newCart[existingItemIndex],
          quantity: (newCart[existingItemIndex].quantity || 0) + (product.quantity || 1)
        };
        return newCart;
      }

      return [...prevCart, { 
        ...product, 
        uniqueId, 
        quantity: product.quantity || 1 
      }];
    });
  };
  const updateQuantity = (uniqueId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(uniqueId);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item =>
        item.uniqueId === uniqueId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
    
    // Cart se guardará automáticamente con el efecto useEffect
  };

  const removeFromCart = (uniqueId) => {
    const updatedCart = cart.filter(item => item.uniqueId !== uniqueId);
    setCart(updatedCart);
    
    if (updatedCart.length === 0) {
      setShowCartSummary(false);
    }
  };

  // Calculación correcta del total incluyendo toppings
  const calculateItemPrice = (item) => {
    // Precio base del producto
    let totalPrice = parseFloat(item.finalPrice || item.price || 0);
    
    // Sumar precio de toppings si existen
    if (item.selectedToppings && item.selectedToppings.length > 0) {
      item.selectedToppings.forEach(topping => {
        // Añadir precio base del grupo si existe
        if (topping.basePrice) {
          totalPrice += parseFloat(topping.basePrice);
        }
        
        // Añadir precio de la opción seleccionada
        if (topping.price) {
          totalPrice += parseFloat(topping.price);
        }
        
        // Añadir precios de subgrupos si existen
        if (topping.subGroups && topping.subGroups.length > 0) {
          topping.subGroups.forEach(subItem => {
            if (subItem.price) {
              totalPrice += parseFloat(subItem.price);
            }
          });
        }
      });
    }
    
    return totalPrice * (item.quantity || 1);
  };

  // Función para calcular el total del carrito
  const calculateTotalAmount = () => {
    return cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);
  };

  // Calcular total de items en el carrito
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  
  // Calcular monto total incluyendo toppings
  const totalAmount = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);

  const handleOrderTypeComplete = (info) => {
    logger.info('Datos recibidos del selector de tipo:', info);
    
    // Asegurar que tengamos al menos un nombre de cliente
    if (!info.customerName) {
      logger.warn('No se recibió nombre de cliente en handleOrderTypeComplete');
      info.customerName = 'Cliente';
    }
    
    // En modo QR, verificar que haya tipo de pedido
    if (isQRMode && !info.orderType) {
      logger.warn('No se recibió tipo de pedido en modo QR en handleOrderTypeComplete');
    }
    
    // En modo normal, mantener orderType vacío
    if (!isQRMode && info.orderType) {
      logger.info('Tipo de pedido recibido en modo normal, pero se manejará en CartSummary:', info.orderType);
    }
    
    // En modo normal, asegurar que no haya número de mesa para tipos que no sean inSite
    if (!isQRMode && info.orderType !== 'inSite') {
      info.tableNumber = '';
    }
    
    // Guardar la información actualizada
    setOrderInfo(info);
    setShowOrderTypeSelector(false);
    
    // Usar la nueva función que maneja correctamente el almacenamiento
    SessionManager.saveOrderInfo(info);
    
    logger.info('Información actualizada del pedido:', info);
  };

  const updateOrderInfo = (newInfo) => {
    setOrderInfo(newInfo);
    
    // Usar la nueva función que maneja correctamente el almacenamiento
    SessionManager.saveOrderInfo(newInfo);
  };

  const handleOrder = async (directOrderInfo, appliedCoupon) => {
    try {
      logger.info('===== INICIANDO PROCESAMIENTO DE PEDIDO =====');
      logger.info('Estado del pedido en orderInfo:', orderInfo);
      logger.info('Estado del pedido recibido directamente:', directOrderInfo);
      
      // Verificar si la suscripción está suspendida
      if (subscriptionStatus === 'suspended') {
        // Mensaje sutil sin mencionar problemas de pago
        setIsSubmittingOrder(false);
        return;
      }
      
      // Prevenir múltiples envíos
      if (isSubmittingOrder) {
        logger.info('Ya hay un envío en proceso, ignorando');
        return;
      }
      
    setIsSubmittingOrder(true);
    
      // Validar que haya productos en el carrito
      if (cart.length === 0) {
        logger.error('Error: Carrito vacío');
        alert('No hay productos en el carrito');
        setIsSubmittingOrder(false);
        return;
      }

      // Usar la información directa si está disponible, si no usar orderInfo
      const finalOrderInfo = directOrderInfo || orderInfo;
      logger.info('Información final a usar:', finalOrderInfo);

      // Validar nombre y teléfono del cliente
      if (!finalOrderInfo?.customerName) {
        logger.error('Error: Falta nombre del cliente');
        // Si no hay nombre de cliente, mostrar selector para nombre y teléfono
        setShowOrderTypeSelector(true);
        setIsSubmittingOrder(false);
        return;
      }

      if (!finalOrderInfo?.phone) {
        logger.error('Error: Falta teléfono del cliente');
        // Si no hay teléfono de cliente, mostrar selector para nombre y teléfono
        setShowOrderTypeSelector(true);
        setIsSubmittingOrder(false);
        return;
      }

      // Verificar el tipo de pedido
      if (!finalOrderInfo?.orderType) {
        logger.error('Tipo de pedido no especificado');
        
        // En modo normal, mostrar CartSummary para seleccionar tipo
        if (!isQRMode) {
          logger.info('Modo normal: mostrando CartSummary para seleccionar tipo');
          setShowCartSummary(true);
          setIsSubmittingOrder(false);
          return;
        } else {
          // En modo QR, requerir tipo
          logger.error('Error: Modo QR sin tipo de pedido');
          alert('Por favor selecciona el tipo de pedido');
          setIsSubmittingOrder(false);
          return;
        }
      }

      // Verificar mesa para pedidos en sitio
      if (finalOrderInfo.orderType === 'inSite') {
        const currentTable = finalOrderInfo.tableNumber ? finalOrderInfo.tableNumber.trim() : '';
        
        logger.info('Verificando mesa para pedido en sitio:', currentTable);
        
        if (!currentTable) {
          // Si no hay mesa, actuar según el modo
          if (isQRMode && tableFromUrl) {
            // En QR, usar la mesa de la URL
            logger.info('Usando mesa de URL en modo QR:', tableFromUrl);
            finalOrderInfo.tableNumber = tableFromUrl;
          } else {
            // En modo normal, pedir la mesa
            logger.info('Pedido en sitio sin mesa en modo normal: mostrando modal');
            setShowCartSummary(true);
            setIsSubmittingOrder(false);
            return;
          }
        } else {
          logger.info(`*** MESA ESPECIFICADA: ${currentTable} - PROCESANDO PEDIDO EN SITIO ***`);
        }
      }
      
      // Llegamos aquí con toda la información necesaria
      logger.info('Información completa, procediendo a enviar el pedido:', finalOrderInfo);
      
      // Calcular total del pedido
      const totalAmount = calculateTotalAmount();
      console.log('=== CÁLCULO DE TOTAL ===');
      console.log('totalAmount calculado:', totalAmount);
      console.log('cart items:', cart);
      console.log('=== FIN CÁLCULO ===');
      
      // Realizar últimas validaciones
      if (finalOrderInfo.orderType === 'inSite' && !finalOrderInfo.tableNumber) {
        logger.error('Error: Intento de enviar pedido en sitio sin número de mesa');
        alert('Error: Falta el número de mesa');
        setIsSubmittingOrder(false);
        return;
      }

      logger.info('*** INFORMACIÓN FINAL VALIDADA ANTES DE ENVÍO: ***', finalOrderInfo);
      
      // Ejecutar el envío con toda la información correcta
      logger.info('*** EJECUTANDO ENVÍO FINAL DEL PEDIDO ***');
      const response = await executeOrderSubmission(finalOrderInfo, cart, totalAmount, appliedCoupon);
      
      // Asegurar que el estado de envío se resetee, ya sea exitoso o no
      if (response) {
        logger.info('*** PEDIDO ENVIADO CORRECTAMENTE ***');
      } else {
        logger.error('*** FALLO EN EL ENVÍO DEL PEDIDO ***');
      }
      
      setTimeout(() => {
        logger.info('Reseteando estado de envío después de completar/fallar la orden');
        setIsSubmittingOrder(false);
      }, 500);
      
    } catch (error) {
      logger.error('Error general en handleOrder:', error);
      alert('Error al procesar el pedido. Por favor intenta nuevamente.');
      setIsSubmittingOrder(false);
    } finally {
      // Asegurar que el estado siempre se resetee al finalizar
      setTimeout(() => {
      setIsSubmittingOrder(false);
      }, 500);
    }
  };

  const getSortedCategories = (categories) => {
    const savedOrder = SessionManager.getFromLocalStorage('categoryOrder');
    logger.info("Menu: Retrieved category order from localStorage:", savedOrder);
    
    if (!savedOrder) {
      return [...categories].sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
    }
    
    try {
      const orderMap = savedOrder;
      logger.info("Menu: Parsed order map:", orderMap);
      
      return [...categories].sort((a, b) => {
        const orderA = orderMap[a._id] !== undefined ? orderMap[a._id] : 999;
        const orderB = orderMap[b._id] !== undefined ? orderMap[b._id] : 999;
        return orderA - orderB;
      });
    } catch (err) {
      logger.error("Menu: Error parsing category order:", err);
      return [...categories].sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
    }
  };

  // Función que ejecuta todo el proceso de envío del pedido
  const executeOrderSubmission = async (orderDetails, cartItems, totalAmount, appliedCoupon) => {
    logger.info('Ejecutando envío de pedido con detalles:', orderDetails);
    
    try {
      // Crear estructura de datos específica para enviar al backend
      const orderData = {
        businessId: businessId,
        customerName: orderDetails.customerName,
        orderType: orderDetails.orderType,
        tableNumber: orderDetails.tableNumber || '', // Solo para el envío
        phone: orderDetails.phone || '',
        address: orderDetails.address || '',
        items: cartItems.map(item => ({
          productId: item._id,
          name: item.name,
          price: item.finalPrice || item.price,
          quantity: item.quantity || 1,
          selectedToppings: item.selectedToppings || []
        })),
        totalAmount: totalAmount.toString(), // Convertir a string para evitar problemas con 0
        // In-app ordering channel
        ...(isInAppMode && {
          orderChannel: 'inapp',
          paymentMethod: orderDetails.paymentMethod || null,
          customerNotes: orderDetails.customerNotes || ''
        }),
        // Información del cupón si está aplicado
        ...(appliedCoupon && {
          couponCode: appliedCoupon.coupon.code,
          couponId: appliedCoupon.coupon._id,
          discountAmount: appliedCoupon.discountAmount,
          finalAmount: appliedCoupon.finalAmount
        }),
        // Información de zona de entrega
        ...(orderDetails.orderType === 'delivery' && {
          deliveryFee: orderDetails.deliveryFee || null,
          deliveryZoneName: orderDetails.deliveryZoneName || null,
          deliveryZoneInfo: orderDetails.deliveryZoneInfo || null,
          deliveryCalculated: orderDetails.deliveryCalculated || false,
          deliveryNeedsConfirmation: orderDetails.deliveryNeedsConfirmation || false
        })
      };

      logger.info('Datos finales del pedido a enviar:', orderData);
      console.log('=== DATOS COMPLETOS ENVIADOS AL BACKEND ===');
      console.log('businessId:', orderData.businessId);
      console.log('customerName:', orderData.customerName);
      console.log('orderType:', orderData.orderType);
      console.log('items:', orderData.items);
      console.log('totalAmount:', orderData.totalAmount);
      console.log('tableNumber:', orderData.tableNumber);
      console.log('phone:', orderData.phone);
      console.log('address:', orderData.address);
      if (orderData.orderType === 'delivery') {
        console.log('--- Datos de zona de entrega ---');
        console.log('deliveryFee:', orderData.deliveryFee);
        console.log('deliveryZoneName:', orderData.deliveryZoneName);
        console.log('deliveryCalculated:', orderData.deliveryCalculated);
        console.log('deliveryNeedsConfirmation:', orderData.deliveryNeedsConfirmation);
      }
      console.log('=== FIN DATOS ===');

      // Para pedidos a domicilio enviar WhatsApp solo si NO es modo in-app
      if (orderDetails.orderType === 'delivery' && !isInAppMode) {
        // Crear el mensaje de WhatsApp usando el template personalizado
        const whatsappMessage = await createWhatsAppMessage(
          orderDetails, 
          cartItems, 
          totalAmount, 
          calculateTotalItems(cartItems), 
          businessConfig,
          appliedCoupon
        );
        
        // Función para detectar si es móvil
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Construir URL de WhatsApp según el dispositivo
        let whatsappUrl;
        if (businessConfig?.whatsappNumber) {
          if (isMobile) {
            // Para móviles, usar el protocolo whatsapp://
            whatsappUrl = `whatsapp://send?phone=${businessConfig.whatsappNumber}&text=${whatsappMessage}`;
          } else {
            // Para desktop, usar wa.me
            whatsappUrl = `https://wa.me/${businessConfig.whatsappNumber}?text=${whatsappMessage}`;
          }
        } else {
          if (isMobile) {
            // Sin número específico en móvil
            whatsappUrl = `whatsapp://send?text=${whatsappMessage}`;
          } else {
            // Sin número específico en desktop
            whatsappUrl = `https://wa.me/?text=${whatsappMessage}`;
          }
        }

        // Abrir WhatsApp
        try {
          window.location.href = whatsappUrl;
        } catch (error) {
          // Fallback si el protocolo whatsapp:// no funciona
          // Error silencioso
          const fallbackUrl = businessConfig?.whatsappNumber 
            ? `https://wa.me/${businessConfig.whatsappNumber}?text=${whatsappMessage}` 
            : `https://wa.me/?text=${whatsappMessage}`;
          window.open(fallbackUrl, '_blank');
        }
      }
      
      // Guardar el pedido en la base de datos
      logger.info('Enviando datos del pedido a la API:', orderData);
      const response = await api.post('/orders', orderData);
      logger.info('Pedido creado exitosamente:', response.data);
      
      // Si es un pedido a domicilio, actualizar la dirección del cliente en la BD
      if (orderDetails.orderType === 'delivery' && orderDetails.address && orderDetails.phone) {
        try {
          logger.info('Actualizando dirección del cliente en la BD:', {
            phone: orderDetails.phone,
            address: orderDetails.address
          });
          
          await api.patch(`/customers/${orderDetails.phone}/address?businessId=${businessId}`, {
            name: orderDetails.customerName,
            address: orderDetails.address
          });
          
          // También guardar en localStorage para uso inmediato
          SessionManager.saveToLocalStorage('customerAddress', orderDetails.address);
          
          logger.info('Dirección del cliente actualizada exitosamente');
        } catch (addressError) {
          logger.error('Error al actualizar dirección del cliente:', addressError);
          // No fallar el pedido si no se puede actualizar la dirección
        }
      }
      
      // Limpiar cualquier ID de pedido anterior y guardar el nuevo
      sessionStorage.removeItem('lastOrderId');
      sessionStorage.setItem('lastOrderId', response.data._id);
      
      // Guardar el número de orden para mostrar en el modal de confirmación
      sessionStorage.setItem('lastOrderNumber', response.data.orderNumber);
      logger.info('Número de orden guardado:', response.data.orderNumber);
      
      // For in-app orders, save customerToken and show tracker
      if (isInAppMode && response.data.customerToken) {
        sessionStorage.setItem('activeOrderId', response.data._id);
        sessionStorage.setItem('activeCustomerToken', response.data.customerToken);
        setActiveOrderId(response.data._id);
        setActiveCustomerToken(response.data.customerToken);

        // Request push notification permission and subscribe (only if already granted — user-gesture prompt is handled in OrderTracker)
        if (isPushSupported() && Notification.permission === 'granted') {
          setTimeout(async () => {
            try {
              await subscribeToPush(businessId, null, response.data.customerToken);
              logger.info('Customer auto-subscribed to push notifications (already granted)');
            } catch (pushErr) {
              logger.warn('Customer push subscription failed (non-critical):', pushErr.message);
            }
          }, 1500);
        }
      }
      
      // Configurar mensaje específico según tipo de pedido
      let confirmMessage = '¡Gracias por tu pedido!';
      if (isInAppMode) {
        confirmMessage = '¡Pedido recibido! Realiza el pago y sube tu comprobante para continuar.';
      } else if (orderDetails.orderType === 'delivery') {
        confirmMessage = '¡Gracias por tu pedido! Te contactaremos pronto para coordinar la entrega.';
      } else if (orderDetails.orderType === 'inSite') {
        confirmMessage = `¡Gracias por tu pedido! Tu orden será servida en la Mesa ${orderDetails.tableNumber}.`;
      } else if (orderDetails.orderType === 'takeaway') {
        confirmMessage = '¡Gracias por tu pedido! Tu orden estará lista para recoger en breve.';
      }
      
      // Mostrar modal de confirmación o tracker
      if (isInAppMode) {
        // For in-app: skip confirmation modal, show tracker directly
        setShowOrderTracker(true);
      } else {
        setOrderConfirmationDetails({
          type: orderDetails.orderType,
          message: confirmMessage
        });
        setShowOrderConfirmationModal(true);
      }
      
      // Actualizar orderInfo con la información del pedido completado para mantener los datos del cliente
      const updatedOrderInfo = {
        ...orderInfo,
        customerName: orderDetails.customerName,
        phone: orderDetails.phone,
        address: orderDetails.address || orderInfo.address || '',
        orderType: '' // Limpiar tipo de pedido para que pueda elegir de nuevo
      };
      setOrderInfo(updatedOrderInfo);
      SessionManager.saveOrderInfo(updatedOrderInfo);
      
      // Limpiar el carrito después de enviar
      setCart([]);
      setShowCartSummary(false);
      
      // Limpiar carrito de AMBOS storages (localStorage y sessionStorage)
      SessionManager.removeFromLocalStorage('cart');
      SessionManager.removeFromSessionStorage('cart');
      
      // Guardar tipo de pedido completado
      SessionManager.saveToLocalStorage('lastCompletedOrderType', orderDetails.orderType);
      
      // Notificar a otras pestañas que se completó un pedido
      SessionManager.saveToLocalStorage('orderCompleted', 'true');
      
      // Eliminar la notificación después de un segundo
      setTimeout(() => {
        SessionManager.removeFromLocalStorage('orderCompleted');
      }, 1000);
      
      return true; // Indicar éxito
    } catch (error) {
      logger.error('Error al crear pedido en la API:', error);
      
      // Manejar error específico de suscripción suspendida
      if (error.response?.status === 403 && error.response?.data?.code === 'SUBSCRIPTION_SUSPENDED') {
        // No mostrar alert - el usuario ya ve el aviso discreto en la parte superior
        // Recargar estado de suscripción
        if (businessId) {
          const response = await api.get(`/subscriptions/check/${businessId}`).catch(() => null);
          if (response?.data?.success && response.data.subscription) {
            const sub = response.data.subscription;
            const now = new Date();
            const periodEnd = sub.periodEnd || sub.endDate;
            const graceUntil = sub.graceUntil || (periodEnd ? new Date(new Date(periodEnd).getTime() + 5 * 24 * 60 * 60 * 1000) : null);
            let status = 'active';
            if (periodEnd && graceUntil && now > graceUntil) {
              status = 'suspended';
            } else if (periodEnd && now > periodEnd) {
              status = 'grace';
            }
            setSubscriptionStatus(status);
          }
        }
        return false;
      }
      
      alert(`Error al procesar el pedido en el servidor: ${error.response?.data?.message || error.message || 'Error desconocido'}`);
      return false; // Indicar fallo
    }
  };

  // Si el negocio no se encuentra, mostrar NotFound
  if (businessNotFound) {
    return <LeadCapturePage />;
  }

  // Verificar si el negocio está activo
  const isBusinessActive = businessConfig?.isActive !== false;
  
  // Si el negocio no está activo, mostrar mensaje
  if (!isBusinessActive && businessId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-[#1F2937] p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center border border-[#DCE4F5] shadow-lg">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-[#3A7AFF]/10 mb-4">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-8 w-8 text-[#3A7AFF]" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-3">Este restaurante no está disponible</h2>
          <p className="text-[#6C7A92] mb-6">El restaurante "{businessConfig?.businessName || 'solicitado'}" no está activo en este momento. Por favor, vuelve más tarde.</p>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-[#3A7AFF] text-white rounded-lg hover:bg-[#3A7AFF]/90 w-full"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <SplashScreen businessConfig={businessConfig} visible={showSplash} />
        {!showSplash && (
          <div className="min-h-screen bg-gray-50 pb-20 pt-safe">
            <BusinessHeaderSkeleton />
            <FilterableMenuSkeleton />
          </div>
        )}
      </>
    );
  }

  if (showOrderTypeSelector) {
    return <OrderTypeSelector onComplete={handleOrderTypeComplete} initialTableNumber={tableFromUrl} />;
  }

  // El menú siempre se renderiza, el CartSummary se superpone como modal

  // Función para volver al catálogo de restaurantes
  const handleBackToCatalog = () => {
    sessionStorage.removeItem('fromCatalog');
    navigate('/restaurantes');
  };

  return (
    <FlyToCartProvider>
    <main className="min-h-screen bg-gray-50 pb-20 pt-safe">
      <BusinessHeader 
        comesFromCatalog={comesFromCatalog}
        onShowFavorites={() => setShowFavorites(true)}
        onShowHistory={() => setShowHistory(true)}
        showFavoritesButton={orderInfo.phone && businessConfig?.features?.favoritesEnabled !== false}
        showHistoryButton={orderInfo.phone && businessConfig?.features?.orderHistoryEnabled !== false}
      />
      
      {/* Aviso discreto de servicio temporalmente no disponible */}
      {subscriptionStatus === 'suspended' && (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-center text-sm font-semibold text-red-700">
              ⚠️ Servicio temporalmente no disponible. Por favor, contacta al restaurante.
            </p>
          </div>
        </div>
      )}
      
      {/* Botón para volver al catálogo (solo si viene del catálogo) */}
      {comesFromCatalog && (
        <button
          onClick={handleBackToCatalog}
          className="fixed top-4 left-4 z-50 bg-white hover:bg-gray-100 text-gray-700 rounded-full p-2 shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95 border border-gray-200"
          title="Volver al catálogo"
          aria-label="Volver al catálogo"
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2.5} 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
        </button>
      )}

      {/* Restaurant Closed overlay — shown when closed by business hours */}
      {!businessStatus.isOpen && !closedOverlayDismissed && !statusLoading && (
        <RestaurantClosedOverlay
          businessConfig={businessConfig}
          businessStatus={businessStatus}
          onDismiss={() => setClosedOverlayDismissed(true)}
        />
      )}
      
      <FilterableMenu 
        products={products}
        categories={categories}
        addToCart={addToCart}
        businessId={businessId}
        businessConfig={businessConfig}
        onToppingsOpen={() => setIsSelectingToppings(true)}
        onToppingsClose={() => setIsSelectingToppings(false)}
        subscriptionStatus={subscriptionStatus}
        hasActiveOrder={!!(isInAppMode && activeOrderId && activeCustomerToken && !showOrderTracker && !showPaymentUpload)}
        activeOrderStatus={activeOrderStatus}
        onViewActiveOrder={() => setShowOrderTracker(true)}
        onDismissCompletedOrder={clearActiveOrder}
      />

      <CartBar 
        cart={cart}
        totalItems={totalItems}
        totalAmount={totalAmount}
        onShowCart={() => {
          // No permitir abrir el carrito si está suspendido
          if (subscriptionStatus === 'suspended') {
            return;
          }
          setShowCartSummary(true);
        }}
        businessConfig={businessConfig}
        isSelectingToppings={isSelectingToppings}
        showCartSummary={showCartSummary}
        subscriptionStatus={subscriptionStatus}
      />
      
      <OrderConfirmationModal 
        show={showOrderConfirmationModal}
        onClose={() => {
          // Recargar orderInfo desde sessionStorage después de cerrar el modal
          const reloadedOrderInfo = SessionManager.loadOrderInfo();
          if (reloadedOrderInfo) {
            logger.info('Recargando orderInfo después de cerrar modal de confirmación:', reloadedOrderInfo);
            setOrderInfo(reloadedOrderInfo);
          }
          
          // Asegurarse de que el carrito esté vacío
          setCart([]);
          SessionManager.removeFromSessionStorage('cart');
          
          setShowOrderConfirmationModal(false);
        }}
        orderInfo={orderInfo}
        orderConfirmationDetails={orderConfirmationDetails}
        businessConfig={businessConfig}
        businessId={businessId}
        setOrderInfo={setOrderInfo}
        setCart={setCart}
        setShowCartSummary={setShowCartSummary}
      />
      
      {/* Order Tracker for in-app orders */}
      {showOrderTracker && activeOrderId && activeCustomerToken && (
        <OrderTracker
          orderId={activeOrderId}
          customerToken={activeCustomerToken}
          businessConfig={businessConfig}
          onClose={() => setShowOrderTracker(false)}
          onUploadProof={() => {
            setShowOrderTracker(false);
            setShowPaymentUpload(true);
          }}
        />
      )}

      {/* Payment Upload Modal */}
      {showPaymentUpload && activeOrderId && activeCustomerToken && (
        <PaymentUpload
          orderId={activeOrderId}
          customerToken={activeCustomerToken}
          businessConfig={businessConfig}
          onClose={() => {
            setShowPaymentUpload(false);
            setShowOrderTracker(true);
          }}
          onSuccess={() => {
            setShowPaymentUpload(false);
            setShowOrderTracker(true);
          }}
        />
      )}

      {/* My Orders Panel */}
      {showMyOrders && (
        <MyOrders
          businessId={businessId}
          phone={orderInfo.phone}
          businessConfig={businessConfig}
          onTrackOrder={(order) => {
            if (order.customerToken) {
              setActiveOrderId(order._id);
              setActiveCustomerToken(order.customerToken);
              sessionStorage.setItem('activeOrderId', order._id);
              sessionStorage.setItem('activeCustomerToken', order.customerToken);
            }
            setShowMyOrders(false);
            setShowOrderTracker(true);
          }}
          onClose={() => setShowMyOrders(false)}
        />
      )}
      
      {/* CartSummary como modal superpuesto */}
      {showCartSummary && (
        <CartSummary
          cart={cart}
          updateQuantity={updateQuantity}
          removeFromCart={removeFromCart}
          onClose={() => setShowCartSummary(false)}
          orderInfo={orderInfo}
          updateOrderInfo={updateOrderInfo}
          createWhatsAppMessage={createWhatsAppMessage}
          onOrder={handleOrder}
          businessConfig={businessConfig}
          isSubmittingOrder={isSubmittingOrder}
          subscriptionStatus={subscriptionStatus}
          isInAppMode={isInAppMode}
        />
      )}

      {/* Modal de Favoritos */}
      <FavoritesModal
        show={showFavorites}
        onClose={() => setShowFavorites(false)}
        businessId={businessId}
        customerPhone={orderInfo.phone}
        theme={businessConfig?.theme}
        onAddToCart={(favoriteItem) => {
          // Convertir favorito a formato de carrito y agregarlo
          const cartItem = {
            ...favoriteItem,
            quantity: 1,
            itemId: Date.now() + Math.random()
          };
          addToCart(cartItem);
          setShowFavorites(false);
        }}
      />

      {/* Modal de Historial de Pedidos */}
      <OrderHistoryModal
        show={showHistory}
        onClose={() => setShowHistory(false)}
        businessId={businessId}
        customerPhone={orderInfo.phone}
        theme={businessConfig?.theme}
        onReorder={(orderItems) => {
          console.log('[Menu] Reordering items:', orderItems);
          console.log('[Menu] Current products:', products);
          
          // Enriquecer items con datos actuales de productos
          const cartItems = orderItems.map((item, index) => {
            // Buscar el producto actual en el catálogo
            const currentProduct = products.find(p => p._id === item.productId);
            
            console.log('[Menu] Enriching item:', { 
              itemName: item.name, 
              productId: item.productId,
              foundProduct: !!currentProduct,
              currentProductImage: currentProduct?.image 
            });
            
            // Si encontramos el producto actual, usar su imagen y datos actualizados
            if (currentProduct) {
              return {
                ...item,
                _id: currentProduct._id,
                image: currentProduct.image,
                category: currentProduct.category,
                description: currentProduct.description,
                isAvailable: currentProduct.isAvailable,
                itemId: Date.now() + index,
                uniqueId: `${currentProduct._id}-${JSON.stringify(item.selectedToppings || {}).replace(/[{}",:]/g, '')}`
              };
            }
            
            // Si no encontramos el producto (fue eliminado), usar datos del pedido original
            return {
              ...item,
              _id: item.productId,
              itemId: Date.now() + index,
              uniqueId: `${item.productId}-${JSON.stringify(item.selectedToppings || {}).replace(/[{}",:]/g, '')}`
            };
          });
          
          console.log('[Menu] Enriched cart items:', cartItems);
          setCart(cartItems);
          SessionManager.saveToSession('cart', cartItems);
          setShowHistory(false);
          setShowCartSummary(true);
        }}
      />

      {/* Footer - MenuBy Branding */}
      <footer className="bg-gradient-to-r from-slate-50 to-slate-100 border-t border-slate-200 py-4 mt-8">
        <div className="container mx-auto px-4 text-center">
          <a 
            href="https://www.menuby.tech" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-red-600 transition-colors duration-300 text-sm font-medium group"
          >
            <span>Crea tu menú digital con</span>
            <span className="font-bold text-red-600 group-hover:text-red-700">MenuBy</span>
            <svg 
              className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </footer>
    </main>
    </FlyToCartProvider>
  );
} 
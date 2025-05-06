// @charset UTF-8
import React, { useState, useEffect } from 'react';
import ProductCard from "../Components/Productcard";
import BusinessHeader from "../Components/BusinessHeader";
import CartSummary from "../Components/CartSummary";
import OrderTypeSelector from "../Components/OrderTypeSelector";
import FilterableMenu from "../Components/FilterableMenu";
import OrderConfirmationModal from "../Components/OrderConfirmationModal";
import CartBar from "../Components/CartBar";
import api from "../services/api";
import { useBusinessConfig } from "../Context/BusinessContext";
import '../../styles/scrollbar.css';
import { socket } from '../services/api';
import { isValidBusinessIdentifier } from '../utils/isValidObjectId';
import * as SessionManager from '../utils/sessionManager';
import { calculateItemPrice, calculateTotalAmount, calculateTotalItems, createWhatsAppMessage } from '../utils/orderUtils';
import logger from '../utils/logger';

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
    const savedOrder = localStorage.getItem('categoryOrderSettings');
    return savedOrder ? JSON.parse(savedOrder) : {};
  } catch (error) {
    logger.error('Error al obtener orden de categorías:', error);
    return {};
  }
};

// Función para verificar si la sesión actual es válida (no ha expirado)
const isValidSession = () => {
  const sessionStartTime = localStorage.getItem('sessionStartTime');
  if (!sessionStartTime) return false;
  
  // Máximo tiempo de sesión: 3 horas (10800000 ms)
  const MAX_SESSION_TIME = 3 * 60 * 60 * 1000;
  const currentTime = Date.now();
  const sessionAge = currentTime - parseInt(sessionStartTime);
  
  return sessionAge < MAX_SESSION_TIME;
};

export default function Menu() {
  // Determinar el modo actual basado en la URL
  const isQRMode = SessionManager.isQRMode();
  
  // Obtener el número de mesa directamente de la URL (solo en modo QR)
  const tableFromUrl = SessionManager.getTableNumberFromURL();

  // Determinar si debe mostrar el selector de tipo de pedido
  const shouldShowOrderTypeSelector = () => {
    // Si ya hay información de pedido guardada con nombre de cliente, no mostrar el selector
    const savedOrderInfo = SessionManager.getFromSession('orderInfo');
    if (savedOrderInfo && savedOrderInfo.customerName) {
      logger.info('Hay información de cliente guardada, no mostrar selector inicial');
      return false;
    }
    
    // En modo QR, mostrar selector incluso si hay información para validar mesa
    if (isQRMode) {
      logger.info('Modo QR: mostrar selector inicial para confirmar mesa', tableFromUrl);
      return true;
    }
    
    // En modo normal, verificar si hay nombre de cliente guardado
    const savedName = SessionManager.getSavedCustomerName();
    if (savedName && savedName.trim() !== '') {
      logger.info('Hay nombre de cliente guardado en localStorage, no mostrar selector inicial');
      
      // Crear información básica con el nombre guardado
      const basicInfo = {
        customerName: savedName,
        orderType: '',
        tableNumber: ''
      };
      
      // Guardar esta información básica y continuar sin mostrar selector
      setOrderInfo(basicInfo);
      SessionManager.saveOrderInfo(basicInfo);
      
      return false;
    }
    
    // Si no hay información de cliente, mostrar el selector para pedir nombre
    logger.info('No hay información de cliente, mostrar selector inicial para pedir nombre');
    return true;
  };
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(() => {
    return SessionManager.getFromSession('cart', []);
  });
  
  const [loading, setLoading] = useState(true);
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [showOrderTypeSelector, setShowOrderTypeSelector] = useState(() => {
    return shouldShowOrderTypeSelector();
  });
  
  const [isSelectingToppings, setIsSelectingToppings] = useState(false);
  const { businessConfig } = useBusinessConfig();
  const { businessId } = useBusinessConfig();
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
  const [orderConfirmationDetails, setOrderConfirmationDetails] = useState({
    type: '',
    message: ''
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
        orderType: '',
        tableNumber: tableFromUrl || ''
      };
    } else {
      return {
        customerName: SessionManager.getSavedCustomerName(),
        orderType: '',
        // En modo normal, no inicializar con número de mesa
        tableNumber: ''
      };
    }
  });
  
  // Use table number as a dependency for some effects
  useEffect(() => {
    logger.info('Current table number:', tableFromUrl);
  }, [tableFromUrl]);

  // Si la sesión expiró o no viene de QR, limpiar localStorage de QR
  useEffect(() => {
    if (isQRMode && !tableFromUrl) {
      localStorage.removeItem('tableQR_currentTable');
      localStorage.removeItem('isTableQRSession'); 
      localStorage.removeItem('tableQR_orderInfo');
    }
  }, [isQRMode, tableFromUrl]);

  // Guardar carrito en la sesión
  useEffect(() => {
    SessionManager.saveToSession('cart', cart);
  }, [cart]);

  // Guardar orderInfo en la sesión
  useEffect(() => {
    if (orderInfo) {
      SessionManager.saveToSession('orderInfo', orderInfo);
    }
  }, [orderInfo]);

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
    
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('joinBusiness', businessId);
    logger.info('Socket joinBusiness:', businessId);
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
    return () => {
      socket.emit('leaveBusiness', businessId);
      socket.off('products_update');
      socket.off('categories_update');
    };
  }, [businessId]);

  const addToCart = (product) => {
    setCart(prevCart => {
      const toppingsString = JSON.stringify(product.selectedToppings || {});
      const uniqueId = `${product._id}-${toppingsString.replace(/[{}",:]/g, '')}`;
      const existingItemIndex = prevCart.findIndex(item => item.uniqueId === uniqueId);

      if (existingItemIndex >= 0) {
        const newCart = [...prevCart];
        newCart[existingItemIndex] = {
          ...newCart[existingItemIndex],
          quantity: (newCart[existingItemIndex].quantity || 0) + 1
        };
        return newCart;
      }

      return [...prevCart, { 
        ...product, 
        uniqueId, 
        quantity: 1 
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
    
    // Actualizar localStorage
    localStorage.setItem('cart', JSON.stringify(cart));
  };

  const removeFromCart = (uniqueId) => {
    const updatedCart = cart.filter(item => item.uniqueId !== uniqueId);
    setCart(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    
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

  const handleOrder = async (directOrderInfo) => {
    try {
      logger.info('===== INICIANDO PROCESAMIENTO DE PEDIDO =====');
      logger.info('Estado del pedido en orderInfo:', orderInfo);
      logger.info('Estado del pedido recibido directamente:', directOrderInfo);
      
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

      // Validar nombre del cliente
      if (!finalOrderInfo?.customerName) {
        logger.error('Error: Falta nombre del cliente');
        // Si no hay nombre de cliente, mostrar selector solo para nombre
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
      const response = await executeOrderSubmission(finalOrderInfo, cart, totalAmount);
      
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
    const savedOrder = localStorage.getItem('categoryOrder');
    logger.info("Menu: Retrieved category order from localStorage:", savedOrder);
    
    if (!savedOrder) {
      return [...categories].sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
    }
    
    try {
      const orderMap = JSON.parse(savedOrder);
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
  const executeOrderSubmission = async (orderDetails, cartItems, totalAmount) => {
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
        totalAmount
      };

      logger.info('Datos finales del pedido a enviar:', orderData);

      // Para pedidos a domicilio enviar WhatsApp además de guardar en API
      if (orderDetails.orderType === 'delivery') {
        // Usar el número configurado en el panel de administración
        const whatsappNumber = businessConfig?.whatsappNumber 
          ? `https://wa.me/${businessConfig.whatsappNumber}?text=${createWhatsAppMessage(orderDetails, cartItems, totalAmount)}` 
          : `https://wa.me/?text=${createWhatsAppMessage(orderDetails, cartItems, totalAmount)}`;

        window.open(whatsappNumber);
      }
      
      // Guardar el pedido en la base de datos
      logger.info('Enviando datos del pedido a la API:', orderData);
      const response = await api.post('/orders', orderData);
      logger.info('Pedido creado exitosamente:', response.data);
      
      // Limpiar cualquier ID de pedido anterior y guardar el nuevo
      sessionStorage.removeItem('lastOrderId');
      sessionStorage.setItem('lastOrderId', response.data._id);
      
      // Guardar el número de orden para mostrar en el modal de confirmación
      sessionStorage.setItem('lastOrderNumber', response.data.orderNumber);
      logger.info('Número de orden guardado:', response.data.orderNumber);
      
      // Configurar mensaje específico según tipo de pedido
      let confirmMessage = '¡Gracias por tu pedido!';
      if (orderDetails.orderType === 'delivery') {
        confirmMessage = '¡Gracias por tu pedido! Te contactaremos pronto para coordinar la entrega.';
      } else if (orderDetails.orderType === 'inSite') {
        confirmMessage = `¡Gracias por tu pedido! Tu orden será servida en la Mesa ${orderDetails.tableNumber}.`;
      } else if (orderDetails.orderType === 'takeaway') {
        confirmMessage = '¡Gracias por tu pedido! Tu orden estará lista para recoger en breve.';
      }
      
      // Mostrar modal de confirmación
      setOrderConfirmationDetails({
        type: orderDetails.orderType,
        message: confirmMessage
      });
      
      // Activar modal de confirmación
      setShowOrderConfirmationModal(true);
      
      // Limpiar el carrito después de enviar
      setCart([]);
      setShowCartSummary(false);
      
      // Limpiar localStorage y guardar tipo de pedido completado
      localStorage.removeItem('cart');
      localStorage.setItem('lastCompletedOrderType', orderDetails.orderType);
      
      // Notificar a otras pestañas que se completó un pedido
      localStorage.setItem('orderCompleted', 'true');
      
      // Eliminar la notificación después de un segundo
      setTimeout(() => {
        localStorage.removeItem('orderCompleted');
      }, 1000);
      
      return true; // Indicar éxito
    } catch (error) {
      logger.error('Error al crear pedido en la API:', error);
      alert(`Error al procesar el pedido en el servidor: ${error.message || 'Error desconocido'}`);
      return false; // Indicar fallo
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 flex items-center justify-center mb-4">
            <span className="inline-block w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></span>
          </div>
          <div className="mt-2 text-lg font-semibold text-gray-700 tracking-wide animate-pulse">Cargando...</div>
        </div>
      </div>
    );
  }

  if (showOrderTypeSelector) {
    return <OrderTypeSelector onComplete={handleOrderTypeComplete} initialTableNumber={tableFromUrl} />;
  }

  if (showCartSummary) {
    return (
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
      />
    );
  }

  if (businessConfig && businessConfig.isActive === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <img src={businessConfig.logo || 'https://placehold.co/150x150?text=Logo'} alt="Logo" className="w-32 h-32 mb-6 rounded-full object-cover border-4 border-blue-200" />
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Menú desactivado</h1>
        <p className="text-gray-600 text-center max-w-md">Este negocio se encuentra temporalmente desactivado. Por favor, contacte al administrador para más información.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <BusinessHeader />
      
      <FilterableMenu 
        products={products}
        categories={categories}
        addToCart={addToCart}
        onToppingsOpen={() => setIsSelectingToppings(true)}
        onToppingsClose={() => setIsSelectingToppings(false)}
      />

      <CartBar 
        cart={cart}
        totalItems={totalItems}
        totalAmount={totalAmount}
        onShowCart={() => setShowCartSummary(true)}
        businessConfig={businessConfig}
        isSelectingToppings={isSelectingToppings}
        showCartSummary={showCartSummary}
      />
      
      <OrderConfirmationModal 
        show={showOrderConfirmationModal}
        onClose={() => setShowOrderConfirmationModal(false)}
        orderInfo={orderInfo}
        orderConfirmationDetails={orderConfirmationDetails}
        businessConfig={businessConfig}
        businessId={businessId}
        setOrderInfo={setOrderInfo}
        setCart={setCart}
        setShowCartSummary={setShowCartSummary}
      />
    </div>
  );
} 
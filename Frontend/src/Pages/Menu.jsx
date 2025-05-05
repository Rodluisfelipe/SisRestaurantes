// @charset UTF-8
import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import ProductCard from "../Components/Productcard";
import BusinessHeader from "../Components/BusinessHeader";
import CartSummary from "../Components/CartSummary";
import OrderTypeSelector from "../Components/OrderTypeSelector";
import FilterableMenu from "../Components/FilterableMenu";
import { API_ENDPOINTS } from "../config";
import api from "../services/api";
import { useBusinessConfig } from "../Context/BusinessContext";
import '../../styles/scrollbar.css';
import { socket } from '../services/api';
import { isValidObjectId, isValidBusinessIdentifier } from '../utils/isValidObjectId';

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

const getCategoryOrder = () => {
  try {
    const savedOrder = localStorage.getItem('categoryOrderSettings');
    return savedOrder ? JSON.parse(savedOrder) : {};
  } catch (error) {
    console.error('Error al obtener orden de categorías:', error);
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
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [loading, setLoading] = useState(true);
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [showOrderTypeSelector, setShowOrderTypeSelector] = useState(() => {
    const savedOrderInfo = localStorage.getItem('orderInfo');
    return !savedOrderInfo;
  });
  const [orderInfo, setOrderInfo] = useState(() => {
    const savedOrderInfo = localStorage.getItem('orderInfo');
    return savedOrderInfo ? JSON.parse(savedOrderInfo) : null;
  });
  const [isSelectingToppings, setIsSelectingToppings] = useState(false);
  const { businessConfig } = useBusinessConfig();
  const { businessId } = useBusinessConfig();
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  
  // Get table number from URL parameters if available
  const [tableNumber, setTableNumber] = useState(() => {
    const path = window.location.pathname;
    const matches = path.match(/\/mesa\/(\w+)/);
    
    if (matches && matches[1]) {
      // Save table number to localStorage for this session
      localStorage.setItem('currentTable', matches[1]);
      return matches[1];
    }
    
    // Si no está en la URL, verificar en localStorage (solo si la sesión es válida)
    if (isValidSession()) {
      return localStorage.getItem('currentTable') || null;
    }
    
    // Si la sesión expiró, limpiar localStorage
    localStorage.removeItem('currentTable');
    localStorage.removeItem('orderInfo');
    localStorage.removeItem('sessionStartTime');
    return null;
  });
  
  // Use table number as a dependency for some effects
  useEffect(() => {
    console.log('Current table number:', tableNumber);
  }, [tableNumber]);

  useEffect(() => {
    console.log('Menu - businessId:', businessId, 'type:', typeof businessId);
    console.log('Menu - businessConfig:', businessConfig);
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
    console.log('Menu - businessId es válido:', isValid, businessId);
    
    if (!isValid) {
      console.log('Menu - businessId no es válido, no se cargarán datos');
      return;
    }
    
    setLoading(true);
    const fetchData = async () => {
      try {
        console.log('Menu - Cargando datos para businessId:', businessId);
        const [productsRes, categoriesRes] = await Promise.all([
          api.get(`/products?businessId=${businessId}`),
          api.get(`/categories?businessId=${businessId}`)
        ]);
        console.log('Menu - Datos recibidos:', {
          products: productsRes.data.length,
          categories: categoriesRes.data.length
        });
        setProducts(productsRes.data);
        setCategories(categoriesRes.data);
      } catch (err) {
        console.error("Error al obtener datos:", err);
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
        console.log('Evento recibido:', data.type);
        
        switch (data.type) {
          case 'products_update':
            console.log('Actualizando productos:', data.data.length);
            setProducts(data.data);
            break;
          case 'categories_update':
            console.log('Actualizando categorías:', data.data.length);
            setCategories(data.data.categories || data.data);
            break;
          case 'business_config_update':
            console.log('Actualizando configuración del negocio:', data.data);
            setBusinessConfig(data.data);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('Error procesando evento:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Error en la conexión SSE:', error);
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
      console.log('Menu - businessId no es válido para socket:', businessId);
      return;
    }
    
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('joinBusiness', businessId);
    console.log('Socket joinBusiness:', businessId);
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

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (orderInfo) {
      localStorage.setItem('orderInfo', JSON.stringify(orderInfo));
    }
  }, [orderInfo]);

  const addToCart = (product) => {
    setCart(prevCart => {
      // Crear un identificador único para el producto basado en su ID y toppings
      const toppingsString = JSON.stringify(product.selectedToppings || {});
      const uniqueId = `${product._id}-${toppingsString.replace(/[{}",:]/g, '')}`;
      
      // Buscar si existe un producto idéntico (mismo ID único)
      const existingItemIndex = prevCart.findIndex(item => item.uniqueId === uniqueId);

      if (existingItemIndex >= 0) {
        // Si existe, incrementar la cantidad
        const newCart = [...prevCart];
        newCart[existingItemIndex] = {
          ...newCart[existingItemIndex],
          quantity: (newCart[existingItemIndex].quantity || 0) + 1
        };
        return newCart;
      }

      // Si no existe, agregar como nuevo item con ID único
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

  // Calcular total de items en el carrito
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  
  // Calcular monto total incluyendo toppings
  const totalAmount = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);

  const handleOrderTypeComplete = (info) => {
    setOrderInfo(info);
    setShowOrderTypeSelector(false);
    
    // Asegurarse de que si hay tableNumber, se guarde correctamente
    if (info.tableNumber) {
      localStorage.setItem('currentTable', info.tableNumber);
      setTableNumber(info.tableNumber);
    }
  };

  const updateOrderInfo = (newInfo) => {
    setOrderInfo(newInfo);
    localStorage.setItem('orderInfo', JSON.stringify(newInfo));
  };

  const createWhatsAppMessage = () => {
    const businessName = businessConfig?.businessName || 'Nuestro Negocio';
    let message = "";
    
    // Información del cliente
    message += `*** DATOS DEL CLIENTE ***\n`;
    message += `*Nombre:* ${orderInfo.customerName || 'Cliente'}\n`;
    
    // Información del pedido según tipo
    if (orderInfo.orderType === 'delivery') {
      message += `*Tipo de pedido:* A Domicilio\n`;
      message += `*Teléfono:* ${orderInfo.phone || 'No proporcionado'}\n`;
      message += `*Dirección:* ${orderInfo.address || 'No proporcionada'}\n`;
    } else if (orderInfo.orderType === 'inSite') {
      message += `*Tipo de pedido:* En Sitio\n`;
      message += `*Mesa #:* ${orderInfo.tableNumber || 'No especificada'}\n`;
    }
    message += `------------------------\n\n`;

    // Agregar detalle de productos
    message += `*** DETALLE DEL PEDIDO ***\n`;
    
    cart.forEach((item, index) => {
      message += `\n${index + 1}. ${item.quantity}x ${item.name}\n`;
      message += `   Precio unitario: $${(item.finalPrice || item.price).toFixed(2)}\n`;
      
      // Verificar si hay toppings seleccionados y es un array
      if (item.selectedToppings && Array.isArray(item.selectedToppings) && item.selectedToppings.length > 0) {
        message += `   *Adicionales:*\n`;
        
        // Iterar sobre cada grupo de toppings seleccionado
        item.selectedToppings.forEach(topping => {
          const basePrice = Number(topping.basePrice || 0);
          
          // Mostrar el grupo y su precio base si existe
          message += `   • ${topping.groupName}`;
          if (basePrice > 0) {
            message += ` (Base: $${basePrice.toFixed(2)})`;
          }
          message += `:\n`;
          
          // Mostrar la opción principal si existe
          if (topping.optionName) {
            message += `     - ${topping.optionName}`;
            if (topping.price > 0) {
              message += ` (+$${topping.price.toFixed(2)})`;
            }
            message += `\n`;
          }
          
          // Mostrar opciones de subgrupos si existen
          if (topping.subGroups && Array.isArray(topping.subGroups) && topping.subGroups.length > 0) {
            topping.subGroups.forEach(subItem => {
              message += `     - ${subItem.subGroupTitle}: ${subItem.optionName}`;
              if (subItem.price > 0) {
                message += ` (+$${subItem.price.toFixed(2)})`;
              }
              message += `\n`;
            });
          }
        });
      }
      
      message += `   *Subtotal:* $${calculateItemPrice(item).toFixed(2)}\n`;
      message += `   ------------------------\n`;
    });

    // Agregar totales
    message += `\n*** RESUMEN ***\n`;
    message += `*Productos:* ${cart.length}\n`;
    message += `*Cantidad total:* ${totalItems} items\n`;
    message += `*TOTAL A PAGAR:* $${totalAmount.toFixed(2)}\n`;
    message += `------------------------\n`;
    
    // Agregar un mensaje de agradecimiento y datos del negocio
    message += `\n¡Gracias por tu pedido en ${businessName}!\n`;
    message += `Tu orden será procesada inmediatamente.`;
    
    return encodeURIComponent(message);
  };

  const handleOrder = async () => {
    // Prevent multiple submissions
    if (isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    
    try {
      // Validar que tengamos toda la información necesaria
      if (!orderInfo || !orderInfo.customerName) {
        alert('Error: No hay información del cliente');
        setIsSubmittingOrder(false);
        return;
      }

      if (!orderInfo.orderType) {
        alert('Por favor selecciona el tipo de pedido (Delivery o En Sitio)');
        setIsSubmittingOrder(false);
        return;
      }

      // Validar datos de entrega para pedidos a domicilio
      if (orderInfo.orderType === 'delivery') {
        const phone = orderInfo.phone ? orderInfo.phone.trim() : '';
        const address = orderInfo.address ? orderInfo.address.trim() : '';
        
        if (!phone || !address) {
          alert('Por favor completa la información de entrega');
          setIsSubmittingOrder(false);
          return;
        }
        
        // Actualizar orderInfo con valores sin espacios en blanco extra
        orderInfo.phone = phone;
        orderInfo.address = address;
      }

      // Validar número de mesa para pedidos en sitio
      if (orderInfo.orderType === 'inSite' && !orderInfo.tableNumber) {
        alert('Por favor ingresa el número de mesa');
        setIsSubmittingOrder(false);
        return;
      }

      // Preparar los datos del pedido para la API
      const orderData = {
        businessId: businessId,
        customerName: orderInfo.customerName,
        orderType: orderInfo.orderType,
        tableNumber: orderInfo.tableNumber || '',
        phone: orderInfo.phone || '',
        address: orderInfo.address || '',
        items: cart.map(item => ({
          productId: item._id,
          name: item.name,
          price: item.finalPrice || item.price,
          quantity: item.quantity || 1,
          selectedToppings: item.selectedToppings || []
        })),
        totalAmount: totalAmount
      };

      console.log('Creating order for business:', businessId);
      console.log('Order data:', orderData);

      // Para pedidos a domicilio enviar WhatsApp además de guardar en API
      if (orderInfo.orderType === 'delivery') {
        // Usar el número configurado en el panel de administración, o usar la API predeterminada sin número
        const whatsappNumber = businessConfig?.whatsappNumber 
          ? `https://wa.me/${businessConfig.whatsappNumber}?text=${createWhatsAppMessage()}` 
          : `https://wa.me/?text=${createWhatsAppMessage()}`;

        window.open(whatsappNumber);
      }
      
      // Guardar el pedido en la base de datos en todos los casos
      const response = await api.post('/orders', orderData);
      console.log('Pedido creado:', response.data);
      
      // Mostrar confirmación
      alert(`¡Gracias por tu pedido! ${orderInfo.orderType === 'delivery' 
        ? 'Te contactaremos pronto para coordinar la entrega.' 
        : 'Tu pedido ha sido enviado al restaurante.'}`);
      
      // Limpiar el carrito después de enviar
      setCart([]);
      setShowCartSummary(false);
      localStorage.removeItem('cart');
    } catch (error) {
      console.error('Error al crear el pedido:', error);
      alert('Hubo un problema al procesar tu pedido. Por favor intenta nuevamente.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const getSortedCategories = (categories) => {
    const savedOrder = localStorage.getItem('categoryOrder');
    console.log("Menu: Retrieved category order from localStorage:", savedOrder);
    
    if (!savedOrder) {
      return [...categories].sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
    }
    
    try {
      const orderMap = JSON.parse(savedOrder);
      console.log("Menu: Parsed order map:", orderMap);
      
      return [...categories].sort((a, b) => {
        const orderA = orderMap[a._id] !== undefined ? orderMap[a._id] : 999;
        const orderB = orderMap[b._id] !== undefined ? orderMap[b._id] : 999;
        return orderA - orderB;
      });
    } catch (err) {
      console.error("Menu: Error parsing category order:", err);
      return [...categories].sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50">
        <div className="relative flex flex-col items-center">
          {/* Spinner animado negro, minimalista */}
          <div className="w-16 h-16 flex items-center justify-center mb-4">
            <span className="inline-block w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></span>
          </div>
          <div className="mt-2 text-lg font-semibold text-gray-700 tracking-wide animate-pulse">Cargando...</div>
        </div>
      </div>
    );
  }

  if (showOrderTypeSelector) {
    return <OrderTypeSelector onComplete={handleOrderTypeComplete} initialTableNumber={tableNumber} />;
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

      {/* Barra fija inferior del carrito - ahora con visibilidad condicional */}
      {cart.length > 0 && !isSelectingToppings && !showCartSummary && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="container mx-auto flex items-center justify-between">
            <div>
              <span className="text-gray-600">{totalItems} productos</span>
              <p className="font-bold text-lg">${totalAmount.toFixed(2)}</p>
            </div>
            <button
              onClick={() => setShowCartSummary(true)}
              style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
              className="px-6 py-2 rounded-lg transition-colors duration-300"
            >
              Ver Carrito
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 
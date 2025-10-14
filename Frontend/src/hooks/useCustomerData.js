import { useState, useEffect } from 'react';
import { logSystem } from '../utils/systemLogger';
import * as SessionManager from '../utils/sessionManager';
import api from '../services/api';
import { socket } from '../services/socket';

export const useCustomerData = () => {
  const [customerData, setCustomerData] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);

  const loadCustomerData = () => {
    try {
      // Usar SessionManager para obtener los datos con el prefijo correcto
      const phone = SessionManager.getFromLocalStorage('customerPhone', '') || localStorage.getItem('customerPhone');
      const name = SessionManager.getSavedCustomerName() || localStorage.getItem('customerName');
      const address = SessionManager.getFromLocalStorage('customerAddress', '') || localStorage.getItem('customerAddress');
      
      logSystem(`Hook useCustomerData - phone: ${phone}, name: ${name}, address: ${address}`);
      
      if (phone || name) {
        const data = {
          phone: phone || '',
          name: name || 'Cliente',
          address: address || ''
        };
        
        setCustomerData(data);
        logSystem('Datos del cliente cargados correctamente', data);
        return data;
      }
    } catch (error) {
      logSystem('Error al cargar datos del cliente', error);
    }
    return null;
  };

  const saveCustomerData = (data) => {
    try {
      // Usar SessionManager para guardar con el prefijo correcto
      if (data.name) {
        SessionManager.saveCustomerName(data.name);
      }
      if (data.phone) {
        SessionManager.saveToLocalStorage('customerPhone', data.phone);
      }
      if (data.address) {
        SessionManager.saveToLocalStorage('customerAddress', data.address);
      }
      
      setCustomerData(prev => ({ ...prev, ...data }));
      logSystem('Datos del cliente guardados correctamente');
    } catch (error) {
      logSystem('Error al guardar datos del cliente', error);
    }
  };

  const loadCustomerOrders = async () => {
    try {
      const phone = customerData?.phone || SessionManager.getFromLocalStorage('customerPhone', '') || localStorage.getItem('customerPhone');
      console.log('loadCustomerOrders - phone:', phone);
      if (!phone) {
        console.log('loadCustomerOrders - No phone found, skipping');
        return;
      }

      // Obtener businessId del contexto o de la URL
      const businessId = window.location.pathname.split('/')[1] || 'felipe';
      console.log('loadCustomerOrders - businessId:', businessId);
      console.log('loadCustomerOrders - window.location.pathname:', window.location.pathname);
      
      // Cargar pedidos activos (pending, inProgress, etc.)
      console.log('loadCustomerOrders - Fetching active orders from backend...');
      const activeOrdersResponse = await api.get(`/orders?businessId=${businessId}`);
      const allActiveOrders = activeOrdersResponse.data || [];
      console.log('loadCustomerOrders - All active orders received:', allActiveOrders.length);
      
      // Cargar pedidos completados (últimas 24 horas para tener margen)
      console.log('loadCustomerOrders - Fetching completed orders from backend...');
      const completedOrdersResponse = await api.get(`/orders/completed?businessId=${businessId}`);
      const allCompletedOrders = completedOrdersResponse.data || [];
      console.log('loadCustomerOrders - All completed orders received:', allCompletedOrders.length);
      
      // Filtrar pedidos activos por teléfono del cliente
      const customerActiveOrders = allActiveOrders.filter(order => order.phone === phone);
      console.log('loadCustomerOrders - Filtered active customer orders:', customerActiveOrders.length);
      
      // Filtrar pedidos completados por teléfono del cliente y mantener solo los de la última hora
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hora atrás
      const customerCompletedOrders = allCompletedOrders.filter(order => {
        if (order.phone !== phone) return false;
        
        // Verificar si el pedido fue completado en la última hora
        const completedAt = new Date(order.completedAt || order.updatedAt || order.createdAt);
        return completedAt >= oneHourAgo;
      });
      console.log('loadCustomerOrders - Filtered completed customer orders (last hour):', customerCompletedOrders.length);
      
      // Combinar pedidos activos y completados
      const allCustomerOrders = [...customerActiveOrders, ...customerCompletedOrders];
      
      // Ordenar por fecha de creación (más recientes primero)
      allCustomerOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      console.log('loadCustomerOrders - Total customer orders (active + completed):', allCustomerOrders.length);
      console.log('loadCustomerOrders - All customer orders:', allCustomerOrders);
      setCustomerOrders(allCustomerOrders);
      
      // También guardar en localStorage como backup
      if (allCustomerOrders.length > 0) {
        localStorage.setItem(`customerOrders_${phone}`, JSON.stringify(allCustomerOrders));
      }
    } catch (error) {
      console.error('loadCustomerOrders - Error:', error);
      logSystem('Error al cargar pedidos del cliente', error);
      
      // Fallback: cargar pedidos de localStorage si el backend falla
      const phone = customerData?.phone || SessionManager.getFromLocalStorage('customerPhone', '') || localStorage.getItem('customerPhone');
      if (phone) {
        const savedOrders = localStorage.getItem(`customerOrders_${phone}`);
        if (savedOrders) {
          setCustomerOrders(JSON.parse(savedOrders));
        }
      }
    }
  };

  // Función para recargar datos del cliente (útil después de actualizar información)
  const reloadCustomerData = () => {
    const data = loadCustomerData();
    if (data) {
      loadCustomerOrders();
    }
  };

  const addCustomerOrder = (order) => {
    try {
      const phone = customerData?.phone || localStorage.getItem('customerPhone');
      if (!phone) return;

      const updatedOrders = [order, ...customerOrders];
      setCustomerOrders(updatedOrders);
      
      // Guardar en localStorage
      localStorage.setItem(`customerOrders_${phone}`, JSON.stringify(updatedOrders));
      logSystem('Pedido agregado al historial del cliente');
      
      // Recargar pedidos del backend para asegurar sincronización
      setTimeout(() => {
        loadCustomerOrders();
      }, 1000);
    } catch (error) {
      logSystem('Error al agregar pedido al historial', error);
    }
  };

  const updateCustomerOrder = (orderId, updates) => {
    try {
      const updatedOrders = customerOrders.map(order => 
        order._id === orderId ? { ...order, ...updates } : order
      );
      
      setCustomerOrders(updatedOrders);
      
      const phone = customerData?.phone || localStorage.getItem('customerPhone');
      if (phone) {
        localStorage.setItem(`customerOrders_${phone}`, JSON.stringify(updatedOrders));
      }
      
      logSystem('Estado del pedido actualizado');
    } catch (error) {
      logSystem('Error al actualizar pedido', error);
    }
  };

  useEffect(() => {
    console.log('useEffect - Initial load');
    const data = loadCustomerData();
    if (data) {
      console.log('useEffect - Customer data loaded, loading orders');
      loadCustomerOrders();
    } else {
      console.log('useEffect - No customer data found');
    }
  }, []);

  useEffect(() => {
    console.log('useEffect - customerData changed:', customerData);
    if (customerData) {
      console.log('useEffect - Loading orders for customer:', customerData.phone);
      loadCustomerOrders();
    } else {
      console.log('useEffect - No customerData, skipping loadCustomerOrders');
    }
  }, [customerData]);

  // Configurar WebSocket para actualizaciones en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleOrderUpdate = (data) => {
      console.log('WebSocket - Order update received:', data);
      
      // Verificar si el pedido actualizado pertenece al cliente actual
      const phone = customerData?.phone || SessionManager.getFromLocalStorage('customerPhone', '') || localStorage.getItem('customerPhone');
      if (data.order && data.order.phone === phone) {
        console.log('WebSocket - Updating customer order:', data.order);
        
        setCustomerOrders(prevOrders => {
          const updatedOrders = [...prevOrders];
          const orderIndex = updatedOrders.findIndex(order => order._id === data.order._id);
          
          if (orderIndex !== -1) {
            // Actualizar pedido existente
            updatedOrders[orderIndex] = { ...updatedOrders[orderIndex], ...data.order };
            console.log('WebSocket - Order updated in list');
          } else {
            // Agregar nuevo pedido si no existe
            updatedOrders.unshift(data.order);
            console.log('WebSocket - New order added to list');
          }
          
          // Ordenar por fecha de creación
          updatedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          return updatedOrders;
        });
      }
    };

    const handleOrderCompleted = (data) => {
      console.log('WebSocket - Order completed received:', data);
      
      // Verificar si el pedido completado pertenece al cliente actual
      const phone = customerData?.phone || SessionManager.getFromLocalStorage('customerPhone', '') || localStorage.getItem('customerPhone');
      if (data.order && data.order.phone === phone) {
        console.log('WebSocket - Customer order completed:', data.order);
        
        setCustomerOrders(prevOrders => {
          const updatedOrders = [...prevOrders];
          const orderIndex = updatedOrders.findIndex(order => order._id === data.order._id);
          
          if (orderIndex !== -1) {
            // Actualizar estado a completado
            updatedOrders[orderIndex] = { 
              ...updatedOrders[orderIndex], 
              status: 'completed',
              completedAt: new Date().toISOString()
            };
            console.log('WebSocket - Order marked as completed');
          } else {
            // Agregar pedido completado si no existe
            updatedOrders.unshift({
              ...data.order,
              status: 'completed',
              completedAt: new Date().toISOString()
            });
            console.log('WebSocket - Completed order added to list');
          }
          
          // Ordenar por fecha de creación
          updatedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          return updatedOrders;
        });
      }
    };

    // Escuchar eventos de WebSocket
    socket.on('order_status_update', handleOrderUpdate);
    socket.on('order_completed', handleOrderCompleted);

    return () => {
      socket.off('order_status_update', handleOrderUpdate);
      socket.off('order_completed', handleOrderCompleted);
    };
  }, [customerData?.phone]);

  // Recargar pedidos cada 30 segundos para mantener sincronización
  useEffect(() => {
    const interval = setInterval(() => {
      if (customerData?.phone) {
        loadCustomerOrders();
      }
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [customerData?.phone]);

  return { 
    customerData, 
    customerOrders,
    saveCustomerData, 
    loadCustomerData,
    loadCustomerOrders,
    reloadCustomerData,
    addCustomerOrder,
    updateCustomerOrder
  };
};

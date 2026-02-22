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
      if (!phone) return;

      // Obtener businessId del contexto o de la URL
      const businessId = window.location.pathname.split('/')[1] || '';
      if (!businessId) return;
      
      // Usar endpoint my-orders que busca en Order + CompletedOrder
      const response = await api.get(`/orders/my-orders?phone=${encodeURIComponent(phone)}&businessId=${businessId}`);
      const { active = [], completed = [] } = response.data || {};
      
      // Combinar activos + completados recientes (últimos 20)
      const allCustomerOrders = [...active, ...completed]
        .sort((a, b) => new Date(b.createdAt || b.completedAt) - new Date(a.createdAt || a.completedAt));
      
      setCustomerOrders(allCustomerOrders);
      
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
    const data = loadCustomerData();
    if (data) {
      loadCustomerOrders();
    }
  }, []);

  useEffect(() => {
    if (customerData) {
      loadCustomerOrders();
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

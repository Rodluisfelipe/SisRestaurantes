import { useState, useEffect } from 'react';
import { logSystem } from '../utils/systemLogger';
import * as SessionManager from '../utils/sessionManager';
import api from '../services/api';

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
      
      // Cargar todos los pedidos del negocio y filtrar por teléfono
      console.log('loadCustomerOrders - Fetching orders from backend...');
      const response = await api.get(`/orders?businessId=${businessId}`);
      const allOrders = response.data || [];
      console.log('loadCustomerOrders - All orders received:', allOrders.length);
      
      // Filtrar pedidos por teléfono del cliente
      const customerOrders = allOrders.filter(order => order.phone === phone);
      
      // Filtrar pedidos: mostrar todos los pendientes/en progreso + completados de los últimos 30 minutos
      const filteredOrders = customerOrders.filter(order => {
        if (order.status === 'pending' || order.status === 'inProgress') {
          return true; // Mostrar todos los pedidos activos
        }
        
        if (order.status === 'completed') {
          const completedTime = new Date(order.updatedAt || order.createdAt);
          const now = new Date();
          const timeDiff = now - completedTime;
          const thirtyMinutes = 30 * 60 * 1000; // 30 minutos en milisegundos
          
          return timeDiff < thirtyMinutes; // Mostrar solo si fue completado hace menos de 30 minutos
        }
        
        return false;
      });
      
      console.log('loadCustomerOrders - Filtered customer orders:', filteredOrders.length);
      console.log('loadCustomerOrders - Customer orders:', filteredOrders);
      setCustomerOrders(filteredOrders);
      
      // También guardar en localStorage como backup
      if (filteredOrders.length > 0) {
        localStorage.setItem(`customerOrders_${phone}`, JSON.stringify(filteredOrders));
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

  // Timer para actualizar pedidos completados cada minuto
  useEffect(() => {
    if (!customerOrders.some(order => order.status === 'completed')) return;

    const interval = setInterval(() => {
      loadCustomerOrders(); // Recargar pedidos para aplicar el filtro de tiempo
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(interval);
  }, [customerOrders]);

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

import { useState, useEffect } from 'react';
import { logSystem } from '../utils/systemLogger';
import * as SessionManager from '../utils/sessionManager';

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

      // TODO: Implementar carga de pedidos del backend
      // const response = await api.get(`/orders/customer/${phone}`);
      // setCustomerOrders(response.data);
      
      // Por ahora, cargar pedidos de localStorage si existen
      const savedOrders = localStorage.getItem(`customerOrders_${phone}`);
      if (savedOrders) {
        setCustomerOrders(JSON.parse(savedOrders));
      }
    } catch (error) {
      logSystem('Error al cargar pedidos del cliente', error);
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

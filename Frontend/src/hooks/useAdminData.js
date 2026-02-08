import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { API_ENDPOINTS } from '../config';
import { socket, joinBusiness, socketDiagnostic } from '../services/socket';
import { SOCKET_EVENTS, ORDER_STATUS } from '../utils/constants';
import { isValidBusinessIdentifier } from '../utils/isValidObjectId';
import { useBusinessConfig } from '../Context/BusinessContext';

/**
 * Custom hook que encapsula toda la carga de datos, listeners de socket, SSE
 * y efectos de configuración del negocio.
 *
 * Extraído de Admin.jsx (~300 líneas de useEffects + loadData).
 */
export default function useAdminData(businessId) {
  const { businessConfig } = useBusinessConfig();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [toppingGroups, setToppingGroups] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [sseEnabled] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [newOrderNotification, setNewOrderNotification] = useState(null);
  const [showOrderBanner, setShowOrderBanner] = useState(false);

  const socketListenersRegistered = useRef(false);
  const lastJoinedBusiness = useRef(null);
  const notificationAudioRef = useRef(null);

  // Debug log para productos
  useEffect(() => {
    console.log('🔄 Estado de productos actualizado:', products.length, 'productos');
  }, [products]);

  // --- Cargar datos ---
  const loadData = useCallback(async () => {
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

      console.log('Productos cargados:', productsRes.data.length);
      console.log('Categorías cargadas:', categoriesRes.data.length);
      console.log('Grupos de toppings cargados:', toppingGroupsRes.data.length);

      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setToppingGroups(Array.isArray(toppingGroupsRes.data) ? toppingGroupsRes.data : []);

      console.log('✅ Datos cargados exitosamente');
    } catch (err) {
      console.error('Error al obtener datos:', err);
    } finally {
      setDataLoading(false);
    }
  }, [businessId]);

  // Cargar datos iniciales
  useEffect(() => {
    if (businessId && isValidBusinessIdentifier(businessId)) {
      console.log('Cargando datos para businessId:', businessId);
      loadData();
    }
  }, [businessId, loadData]);

  // --- Socket listeners (una sola vez) ---
  useEffect(() => {
    if (socketListenersRegistered.current) return;

    console.log('🔌 Registering socket listeners ONCE');

    socket.on(SOCKET_EVENTS.ORDER_CREATED, (newOrder) => {
      console.log('🔔 New order received in Admin:', newOrder);
      if (newOrder.status === ORDER_STATUS.PENDING) {
        setNewOrderNotification(newOrder);
        setShowOrderBanner(true);

        // Reproducir sonido
        if (notificationAudioRef.current) {
          const audio = notificationAudioRef.current;
          if (audio.readyState >= 2) {
            audio.currentTime = 0;
            audio.play().catch(e => console.error('Error playing notification sound:', e));
          }
        }

        setTimeout(() => setShowOrderBanner(false), 10000);
        setPendingOrdersCount(prev => prev + 1);
      }
    });

    socket.on(SOCKET_EVENTS.ORDER_UPDATED, (updatedOrder) => {
      if (updatedOrder.status !== ORDER_STATUS.PENDING) {
        setPendingOrdersCount(prev => Math.max(0, prev - 1));
      }
    });

    socket.on('products_update', (data) => {
      if (data.type === 'created' && data.product) {
        setProducts(prev => [...prev, data.product]);
      } else if (data.type === 'deleted' && data.productId) {
        setProducts(prev => prev.filter(p => p._id !== data.productId));
      } else if (data.type === 'updated' && data.product) {
        setProducts(prev => prev.map(p => p._id === data.product._id ? data.product : p));
      } else if (Array.isArray(data)) {
        setProducts(data);
      }
    });

    socket.on('categories_update', (data) => setCategories(data.categories || data));
    socket.on('topping_groups_update', (data) => setToppingGroups(data));

    socketListenersRegistered.current = true;

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off(SOCKET_EVENTS.ORDER_CREATED);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED);
      socket.off('products_update');
      socket.off('categories_update');
      socket.off('topping_groups_update');
      socketListenersRegistered.current = false;
    };
  }, []);

  // --- Unirse al business ---
  useEffect(() => {
    if (!businessId || !isValidBusinessIdentifier(businessId)) return;
    if (lastJoinedBusiness.current === businessId) return;

    console.log('🏢 Joining business:', businessId);
    socketDiagnostic();
    joinBusiness(businessId);
    lastJoinedBusiness.current = businessId;
  }, [businessId]);

  // --- SSE (opcional, desactivado por defecto) ---
  useEffect(() => {
    if (!sseEnabled) return;

    let eventSource = null;
    const maxRetries = 3;
    const retryDelay = 3000;
    let retryCount = 0;

    const connectSSE = () => {
      try {
        if (retryCount >= maxRetries) return;
        eventSource = new EventSource(API_ENDPOINTS.EVENTS);

        eventSource.onopen = () => { retryCount = 0; };
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case 'products_update': setProducts(data.data); break;
              case 'categories_update': setCategories(data.data.categories || data.data); break;
              case 'topping_groups_update': setToppingGroups(data.data); break;
              default: break;
            }
          } catch (error) {
            console.error('Error procesando evento SSE en Admin:', error);
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          retryCount++;
          if (retryCount < maxRetries) {
            setTimeout(connectSSE, retryDelay);
          }
        };
      } catch (error) {
        console.error('Error inicializando SSE:', error);
      }
    };

    connectSSE();
    return () => { if (eventSource) eventSource.close(); };
  }, [sseEnabled]);

  // --- Título y favicon del negocio ---
  useEffect(() => {
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

  return {
    products, setProducts,
    categories,
    toppingGroups,
    dataLoading,
    pendingOrdersCount,
    newOrderNotification,
    showOrderBanner, setShowOrderBanner,
    notificationAudioRef,
    loadData,
  };
}

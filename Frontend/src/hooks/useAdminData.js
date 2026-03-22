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

  // Audio global que siempre está disponible, sin depender del DOM
  const globalAudioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  useEffect(() => {
    const audio = new Audio('/audio/new-order-notification.mp3');
    audio.preload = 'auto';
    audio.volume = 1.0;
    globalAudioRef.current = audio;

    // Los navegadores bloquean audio.play() hasta que el usuario interactúe.
    // Desbloqueamos el audio con el primer clic/toque en cualquier parte de la página.
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      const a = globalAudioRef.current;
      if (a) {
        a.muted = true;
        a.play().then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
          audioUnlockedRef.current = true;
          console.log('🔊 Audio desbloqueado por interacción del usuario');
        }).catch(() => {});
      }
    };

    document.addEventListener('click', unlockAudio, { once: false });
    document.addEventListener('touchstart', unlockAudio, { once: false });

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      audio.pause();
      audio.src = '';
      globalAudioRef.current = null;
    };
  }, []);

  // --- Cargar conteo inicial de pedidos pendientes desde el backend ---
  const loadPendingOrdersCount = useCallback(async () => {
    if (!businessId || !isValidBusinessIdentifier(businessId)) return;
    try {
      const res = await api.get(`/orders?businessId=${businessId}&status=pending`);
      const pending = Array.isArray(res.data) ? res.data.length : 0;
      console.log('📊 Pending orders loaded from API:', pending);
      setPendingOrdersCount(pending);
    } catch (err) {
      console.error('Error loading pending orders count:', err);
    }
  }, [businessId]);

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
      loadPendingOrdersCount();
    }
  }, [businessId, loadData, loadPendingOrdersCount]);

  // --- Socket listeners (una sola vez) ---
  useEffect(() => {
    if (socketListenersRegistered.current) return;

    console.log('🔌 Registering socket listeners ONCE');

    socket.on(SOCKET_EVENTS.ORDER_CREATED, (newOrder) => {
      console.log('🔔 New order received in Admin:', newOrder);
      if (newOrder.status === ORDER_STATUS.PENDING) {
        setNewOrderNotification(newOrder);
        setShowOrderBanner(true);

        // Reproducir sonido (siempre, sin importar la sección activa)
        const audio = globalAudioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.muted = false;
          const playPromise = audio.play();
          if (playPromise) {
            playPromise.catch(e => {
              console.warn('⚠️ No se pudo reproducir sonido de notificación:', e.message);
              // Reintentar con un audio fresco
              try {
                const fallback = new Audio('/audio/new-order-notification.mp3');
                fallback.play().catch(() => {});
              } catch (_) {}
            });
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

    // 📅 New booking notification sound
    socket.on('new_booking', (booking) => {
      console.log('📅 New booking received in Admin:', booking);
      const audio = globalAudioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.muted = false;
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch(e => {
            console.warn('⚠️ No se pudo reproducir sonido de cita:', e.message);
            try {
              const fallback = new Audio('/audio/new-order-notification.mp3');
              fallback.play().catch(() => {});
            } catch (_) {}
          });
        }
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
      socket.off('new_booking');
      socket.off('products_update');
      socket.off('categories_update');
      socket.off('topping_groups_update');
      socketListenersRegistered.current = false;
    };
  }, []);

  // --- Unirse al business (y re-unirse en reconexión) ---
  useEffect(() => {
    if (!businessId || !isValidBusinessIdentifier(businessId)) return;

    const doJoin = () => {
      console.log('🏢 Joining business:', businessId);
      socketDiagnostic();
      joinBusiness(businessId);
      lastJoinedBusiness.current = businessId;
    };

    // Join on first mount or businessId change
    if (lastJoinedBusiness.current !== businessId) {
      doJoin();
    }

    // Re-join + reload count on every reconnect
    const handleReconnect = () => {
      console.log('🔄 Socket reconnected — re-joining business & reloading pending count');
      doJoin();
      loadPendingOrdersCount();
    };

    socket.on('connect', handleReconnect);

    return () => {
      socket.off('connect', handleReconnect);
    };
  }, [businessId, loadPendingOrdersCount]);

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

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../services/api';
import { socket } from '../services/socket';
import { getBusinessIdFromSlug } from '../utils/getBusinessId';
import { isValidBusinessIdentifier } from '../utils/isValidObjectId';

const BIZ_CACHE_KEY = 'menuby_biz_';
const BIZ_CACHE_TTL = 30 * 60 * 1000; // 30 min

function getCachedBiz(id) {
  try {
    const raw = localStorage.getItem(`${BIZ_CACHE_KEY}${id}`);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Date.now() - c.ts > BIZ_CACHE_TTL) { localStorage.removeItem(`${BIZ_CACHE_KEY}${id}`); return null; }
    return c.data;
  } catch { return null; }
}
function setCachedBiz(id, data) {
  try { localStorage.setItem(`${BIZ_CACHE_KEY}${id}`, JSON.stringify({ data, ts: Date.now() })); }
  catch { /* ignore */ }
}

// ── Business hours helpers (moved from useBusinessStatus) ──
function isCurrentlyOpen(businessHours) {
  if (!businessHours) return true;
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.toTimeString().substring(0, 5);
  const dayHours = businessHours[currentDay];
  if (!dayHours || !dayHours.isOpen) return false;
  return currentTime >= dayHours.openTime && currentTime <= dayHours.closeTime;
}

function getNextOpenTime(businessHours) {
  if (!businessHours) return null;
  const now = new Date();
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentDayIndex = dayOrder.indexOf(currentDay);
  for (let i = 0; i < 7; i++) {
    const dayIndex = (currentDayIndex + i) % 7;
    const dayKey = dayOrder[dayIndex];
    const dayHours = businessHours[dayKey];
    if (dayHours && dayHours.isOpen) return { day: dayKey, time: dayHours.openTime };
  }
  return null;
}

function computeBusinessStatus(config) {
  if (!config) return { isOpen: true, isOpenByHours: true, isMenuActive: true, menuStatus: 'active', nextOpenTime: null };
  const isOpenByHours = isCurrentlyOpen(config.businessHours);
  const isMenuActive = (config.menuStatus || 'active') === 'active';
  return {
    isOpen: (config.isOpen !== false) && isOpenByHours && isMenuActive,
    isOpenByHours,
    isMenuActive,
    menuStatus: config.menuStatus || 'active',
    nextOpenTime: getNextOpenTime(config.businessHours),
  };
}

const BusinessContext = createContext();

export function useBusinessConfig() {
  const context = useContext(BusinessContext);
  // Si el contexto no existe o no está inicializado, devolver un objeto por defecto
  if (!context) {
    return {
      businessId: null,
      businessConfig: {
        businessName: 'Mi Negocio',
        logo: '',
        theme: { buttonColor: '#2563eb', buttonTextColor: '#ffffff' }
      },
      loading: true
    };
  }
  return context;
}

export function BusinessProvider({ children, businessId: propBusinessId, onError, onLoaded }) {
  const [businessId, setBusinessId] = useState(propBusinessId || null);
  const [businessConfig, setBusinessConfig] = useState({
    businessName: 'Mi Negocio',
    logo: '',
    coverImage: '',
    isOpen: true,
    whatsappNumber: '',
    socialMedia: {
      facebook: { url: '', isVisible: false },
      instagram: { url: '', isVisible: false },
      tiktok: { url: '', isVisible: false }
    },
    extraLink: { url: '', isVisible: false },
    theme: {
      buttonColor: '#2563eb',
      buttonTextColor: '#ffffff'
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [networkError, setNetworkError] = useState(false);

  // Refs to avoid re-triggering useEffect when callbacks change
  const onErrorRef = useRef(onError);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onLoadedRef.current = onLoaded; }, [onLoaded]);

  const fetchBusiness = useCallback(async () => {
      setLoading(true);
      setError(null);
      setNetworkError(false);
      try {
        // First prioritize the businessId passed as prop
        let id = propBusinessId;
        
        // If no prop businessId is available, try to get it from the slug
        if (!id) {
          id = await getBusinessIdFromSlug();
        }
        
        
        // Validar si el ID es válido (ahora acepta tanto ObjectID como slug)
        if (!id || !isValidBusinessIdentifier(id)) {
          setLoading(false);
          
          // Si hay una función onError, notificar del error
          if (onErrorRef.current && typeof onErrorRef.current === 'function') {
            onErrorRef.current({ message: 'ID de negocio inválido', type: 'INVALID_ID' });
          }
          
          // Notificar que la carga ha terminado
          if (onLoadedRef.current && typeof onLoadedRef.current === 'function') {
            onLoadedRef.current();
          }
          
          return;
        }
        
        try {
          // Si es un slug (no es un ObjectID hexadecimal), usar el endpoint by-slug
          let response;
          if (typeof id === 'string' && !/^[0-9a-fA-F]{24}$/.test(id)) {
            response = await api.get(`/business-config/by-slug/${id}`);
          } else {
            response = await api.get(`/business-config?businessId=${id}`);
          }
          
          if (response.data) {
            if (!businessId || businessId !== response.data._id) {
              setBusinessId(response.data._id);
            }
            
            const theme = response.data.theme || { 
              buttonColor: '#2563eb', 
              buttonTextColor: '#ffffff'
            };
            const fullConfig = { ...response.data, theme };
            setBusinessConfig(fullConfig);
            setCachedBiz(id, fullConfig);
          }
        } catch (fetchErr) {
          // Check if network error (no response = offline/timeout)
          const isNetwork = !fetchErr.response;
          if (isNetwork) setNetworkError(true);

          // Try cached data as fallback
          const cached = getCachedBiz(id) || getCachedBiz(propBusinessId);
          if (cached) {
            setBusinessConfig(cached);
            if (cached._id) setBusinessId(cached._id);
          }

          setError(fetchErr.message || 'Error desconocido al cargar la configuración');
          
          if (onErrorRef.current && typeof onErrorRef.current === 'function') {
            onErrorRef.current(fetchErr);
          }
        }
      } catch (outerErr) {
        const isNetwork = !outerErr.response;
        if (isNetwork) setNetworkError(true);
        setError(outerErr.message || 'Error desconocido al obtener el business ID');
        
        if (onErrorRef.current && typeof onErrorRef.current === 'function') {
          onErrorRef.current(outerErr);
        }
      } finally {
        setLoading(false);
        
        if (onLoadedRef.current && typeof onLoadedRef.current === 'function') {
          onLoadedRef.current();
        }
      }
  }, [propBusinessId]);

  useEffect(() => {
    fetchBusiness();
  }, [fetchBusiness]);

  // Update businessId if prop changes - SOLO cuando la prop cambia, NO cuando cambia el state
  useEffect(() => {
    if (propBusinessId && propBusinessId !== businessId) {
      setBusinessId(propBusinessId);
    }
  }, [propBusinessId]); // ✅ Eliminado businessId de dependencias para evitar loop infinito

  useEffect(() => {
    if (!businessId) return;
    // --- WebSocket: Conexión y listeners ---
    try {
      // Solo conectar WebSocket en producción
      if (window.location.hostname !== 'localhost' && socket && !socket.connected) {
        socket.connect();
        socket.emit('joinBusiness', businessId);
      }
      
      if (socket) {
        socket.on('business_config_update', (data) => {
          setBusinessConfig(prevConfig => ({
            ...prevConfig,
            ...data,
            theme: data.theme || prevConfig.theme
          }));
        });
        socket.on('business_status_update', (data) => {
            setBusinessConfig(prevConfig => ({
              ...prevConfig,
            isActive: data.isActive
            }));
        });
      }
      
      return () => {
        try {
          if (socket) {
            socket.emit('leaveBusiness', businessId);
            socket.off('business_config_update');
            socket.off('business_status_update');
          }
        } catch (e) {
          // Error silencioso
        }
      };
    } catch (e) {
      // Error silencioso
    }
    // --- Fin WebSocket ---
  }, [businessId]);

  // Función para actualizar la configuración
  const updateConfig = useCallback(async (newConfig) => {
    try {
      const response = await api.put('/business-config', { ...newConfig, businessId });
      setBusinessConfig(response.data);
      return response.data;
    } catch (error) {
      // Error silencioso
      throw error;
    }
  }, [businessId]);

  // Derive business status from config (replaces useBusinessStatus for same-business components)
  const businessStatus = useMemo(() => computeBusinessStatus(businessConfig), [businessConfig]);

  const getStatusDisplay = useCallback(() => {
    if (businessStatus.isOpen) return { text: 'Abierto', color: 'bg-green-500', icon: '🟢' };
    return { text: 'Cerrado', color: 'bg-red-500', icon: '🔴' };
  }, [businessStatus.isOpen]);

  const value = useMemo(() => ({
    businessId,
    businessConfig,
    businessStatus,
    getStatusDisplay,
    loading,
    error,
    networkError,
    retryFetch: fetchBusiness,
    updateConfig
  }), [businessId, businessConfig, businessStatus, getStatusDisplay, loading, error, networkError, fetchBusiness, updateConfig]);

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
} 
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { socket } from '../services/socket';
import { getBusinessIdFromSlug } from '../utils/getBusinessId';
import { isValidBusinessIdentifier } from '../utils/isValidObjectId';

const BusinessContext = createContext();

export function useBusinessConfig() {
  const context = useContext(BusinessContext);
  // Si el contexto no existe o no está inicializado, devolver un objeto por defecto
  if (!context) {
    return {
      businessId: null,
      businessConfig: {
        businessName: 'Mi Restaurante',
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
    businessName: 'Mi Restaurante',
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

  // Refs to avoid re-triggering useEffect when callbacks change
  const onErrorRef = useRef(onError);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onLoadedRef.current = onLoaded; }, [onLoaded]);

  useEffect(() => {
    async function fetchBusiness() {
      setLoading(true);
      setError(null);
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
            // Establecer el businessId con el _id real del negocio SOLO si aún no está seteado
            // Esto evita el loop infinito entre slug y ObjectId
            if (!businessId || businessId !== response.data._id) {
              setBusinessId(response.data._id);
            }
            
            const theme = response.data.theme || { 
              buttonColor: '#2563eb', 
              buttonTextColor: '#ffffff'
            };
            setBusinessConfig({
              ...response.data,
              theme
            });
          }
        } catch (error) {
          // Error silencioso - solo mostrar en desarrollo crítico
          setError(error.message || 'Error desconocido al cargar la configuración');
          
          // Si hay una función onError, notificar del error
          if (onErrorRef.current && typeof onErrorRef.current === 'function') {
            onErrorRef.current(error);
          }
        }
      } catch (error) {
        // Error silencioso
        setError(error.message || 'Error desconocido al obtener el business ID');
        
        // Si hay una función onError, notificar del error
        if (onErrorRef.current && typeof onErrorRef.current === 'function') {
          onErrorRef.current(error);
        }
      } finally {
        setLoading(false);
        
        // Notificar que la carga ha terminado
        if (onLoadedRef.current && typeof onLoadedRef.current === 'function') {
          onLoadedRef.current();
        }
      }
    }
    fetchBusiness();
  }, [propBusinessId]);

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
  const updateConfig = async (newConfig) => {
    try {
      const response = await api.put('/business-config', { ...newConfig, businessId });
      setBusinessConfig(response.data);
      return response.data;
    } catch (error) {
      // Error silencioso
      throw error;
    }
  };

  const value = {
    businessId,
    businessConfig,
    loading,
    error,
    updateConfig
  };

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
} 
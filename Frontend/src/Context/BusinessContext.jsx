import React, { createContext, useContext, useState, useEffect } from 'react';
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
        
        console.log('BusinessProvider - Using businessId:', id, 'Type:', typeof id);
        
        // Validar si el ID es válido (ahora acepta tanto ObjectID como slug)
        if (!id || !isValidBusinessIdentifier(id)) {
          console.log('BusinessProvider - ID inválido o nulo:', id);
          setLoading(false);
          
          // Si hay una función onError, notificar del error
          if (onError && typeof onError === 'function') {
            onError({ message: 'ID de negocio inválido', type: 'INVALID_ID' });
          }
          
          // Notificar que la carga ha terminado
          if (onLoaded && typeof onLoaded === 'function') {
            onLoaded();
          }
          
          return;
        }
        
        setBusinessId(id);
        
        try {
          // Si es un slug (no es un ObjectID hexadecimal), usar el endpoint by-slug
          let response;
          if (typeof id === 'string' && !/^[0-9a-fA-F]{24}$/.test(id)) {
            console.log('BusinessProvider - Fetching by slug:', id);
            response = await api.get(`/business-config/by-slug/${id}`);
          } else {
            console.log('BusinessProvider - Fetching by ID:', id);
            response = await api.get(`/business-config?businessId=${id}`);
          }
          
          if (response.data) {
            console.log('BusinessProvider - Datos recibidos:', response.data);
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
          console.error('Error al cargar la configuración:', error);
          setError(error.message || 'Error desconocido al cargar la configuración');
          
          // Si hay una función onError, notificar del error
          if (onError && typeof onError === 'function') {
            onError(error);
          }
        }
      } catch (error) {
        console.error('Error al obtener el business ID:', error);
        setError(error.message || 'Error desconocido al obtener el business ID');
        
        // Si hay una función onError, notificar del error
        if (onError && typeof onError === 'function') {
          onError(error);
        }
      } finally {
        setLoading(false);
        
        // Notificar que la carga ha terminado
        if (onLoaded && typeof onLoaded === 'function') {
          onLoaded();
        }
      }
    }
    fetchBusiness();
  }, [propBusinessId, onError, onLoaded]);

  // Update businessId if prop changes
  useEffect(() => {
    if (propBusinessId && propBusinessId !== businessId) {
      setBusinessId(propBusinessId);
    }
  }, [propBusinessId, businessId]);

  useEffect(() => {
    if (!businessId) return;
    // --- WebSocket: Conexión y listeners ---
    try {
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit('joinBusiness', businessId);
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
      return () => {
        try {
          socket.emit('leaveBusiness', businessId);
          socket.off('business_config_update');
          socket.off('business_status_update');
        } catch (e) {
          console.error('Error al desconectar socket:', e);
        }
      };
    } catch (e) {
      console.error('Error en la configuración de WebSocket:', e);
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
      console.error('Error al actualizar la configuración:', error);
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
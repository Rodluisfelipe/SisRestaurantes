import { useState, useEffect } from 'react';
import api from '../services/api';

export const useUserLocation = () => {
  const [location, setLocation] = useState({
    coordinates: null,  // { lat, lng }
    address: null,      // "Calle 123, Chía, Cundinamarca"
    city: null,         // "Chía"
    loading: true,
    error: null
  });

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    // 1. Verificar si hay ubicación guardada en localStorage
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        const savedTime = parsed.timestamp || 0;
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        // Si tiene menos de 5 minutos, usar ubicación guardada
        if (now - savedTime < fiveMinutes) {
          // Si el cache tiene el valor genérico "Ciudad", forzar actualización
          if (parsed.city === 'Ciudad') {
            console.log('⚠️ Cache con ciudad genérica, actualizando...');
            localStorage.removeItem('userLocation');
            // Continuar para obtener nueva ubicación
          } else {
            console.log('💾 Cargando desde cache - Ciudad:', parsed.city, '| Dirección:', parsed.address);
            setLocation({
              coordinates: parsed.coordinates,
              address: parsed.address,
              city: parsed.city || 'tu zona', // Asegurar fallback
              loading: false,
              error: null
            });
            return;
          }
        } else {
          console.log('⏰ Cache expirado, obteniendo nueva ubicación...');
        }
      } catch (e) {
        console.log('Error parsing saved location:', e);
      }
    }

    // 2. Si no hay guardada o expiró, pedir GPS del navegador
    if (!navigator.geolocation) {
      console.log('⚠️ Geolocalización no soportada');
      setLocation({
        coordinates: null,
        address: 'Chía, Cundinamarca',
        city: 'Chía',
        loading: false,
        error: 'Geolocalización no soportada'
      });
      return;
    }

    console.log('📡 Solicitando ubicación GPS...');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        console.log('✅ GPS obtenido:', coords);

        // 3. Geocodificar usando Nominatim (OpenStreetMap)
        try {
          const response = await api.get('/delivery-zones/reverse-geocode', {
            params: {
              lat: coords.lat,
              lon: coords.lng
            }
          });

          console.log('🗺️ Respuesta Nominatim:', response.data);

          if (response.data.success && response.data.result) {
            const result = response.data.result;
            
            // Parsear dirección de forma legible
            const displayName = result.displayName || result.display_name || '';
            const parts = displayName.split(',');
            const formattedAddress = parts.slice(0, 3).join(',').trim();
            
            // Intentar obtener la ciudad de múltiples campos de Nominatim
            const city = result.address?.city || 
                        result.address?.town || 
                        result.address?.village || 
                        result.address?.municipality || 
                        result.address?.county ||  // Condado/Municipio
                        result.address?.state_district || // Distrito estatal
                        result.address?.state || // Estado/Departamento
                        (parts[1] ? parts[1].trim() : null) || // Segunda parte de displayName
                        'tu zona'; // Fallback final más amigable
            
            const locationData = {
              coordinates: coords,
              address: formattedAddress || displayName,
              city: city,
              timestamp: Date.now()
            };
            
            console.log('📍 Ciudad detectada:', city, '| Dirección completa:', formattedAddress);
            
            setLocation({
              coordinates: coords,
              address: locationData.address,
              city: city,
              loading: false,
              error: null
            });
            
            // Guardar en localStorage con timestamp
            localStorage.setItem('userLocation', JSON.stringify(locationData));
            console.log('💾 Ubicación guardada:', locationData.address);
          } else {
            throw new Error('Geocoding response unsuccessful');
          }
        } catch (error) {
          console.error('❌ Error reverse geocoding:', error);
          
          // Fallback: usar coordenadas como dirección
          setLocation({
            coordinates: coords,
            address: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
            city: 'Ubicación detectada',
            loading: false,
            error: null
          });
        }
      },
      (error) => {
        console.error('❌ Error obteniendo ubicación GPS:', error);
        
        // Fallback a ubicación por defecto
        setLocation({
          coordinates: null,
          address: 'Chía, Cundinamarca',
          city: 'Chía',
          loading: false,
          error: error.message
        });
      },
      {
        enableHighAccuracy: false, // Más rápido, menos preciso
        timeout: 10000,            // 10 segundos
        maximumAge: 300000         // Cache de 5 minutos
      }
    );
  };

  const updateLocation = () => {
    console.log('🔄 Actualizando ubicación...');
    localStorage.removeItem('userLocation');
    setLocation(prev => ({ ...prev, loading: true }));
    getCurrentLocation();
  };

  const clearLocation = () => {
    console.log('🗑️ Limpiando ubicación...');
    localStorage.removeItem('userLocation');
    setLocation({
      coordinates: null,
      address: 'Chía, Cundinamarca',
      city: 'Chía',
      loading: false,
      error: null
    });
  };

  return {
    location,
    updateLocation,
    clearLocation,
    hasLocation: !!location.coordinates,
    isLoading: location.loading
  };
};


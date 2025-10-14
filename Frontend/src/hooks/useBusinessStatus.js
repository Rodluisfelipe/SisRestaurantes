import { useState, useEffect } from 'react';
import api from '../services/api';

export const useBusinessStatus = (businessId) => {
  const [businessStatus, setBusinessStatus] = useState({
    isOpen: true,
    isOpenByHours: true,
    isMenuActive: true,
    menuStatus: 'active',
    nextOpenTime: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Función para verificar si el negocio está abierto según horarios
  const isCurrentlyOpen = (businessHours) => {
    if (!businessHours) return true;
    
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = now.toTimeString().substring(0, 5); // 'HH:MM'
    
    const dayHours = businessHours[currentDay];
    if (!dayHours || !dayHours.isOpen) {
      return false;
    }
    
    return currentTime >= dayHours.openTime && currentTime <= dayHours.closeTime;
  };

  // Función para obtener la próxima hora de apertura
  const getNextOpenTime = (businessHours) => {
    if (!businessHours) return null;
    
    const now = new Date();
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentDayIndex = dayOrder.indexOf(currentDay);
    
    // Buscar el próximo día abierto
    for (let i = 0; i < 7; i++) {
      const dayIndex = (currentDayIndex + i) % 7;
      const dayKey = dayOrder[dayIndex];
      const dayHours = businessHours[dayKey];
      
      if (dayHours && dayHours.isOpen) {
        return {
          day: dayKey,
          time: dayHours.openTime
        };
      }
    }
    
    return null;
  };

  const fetchBusinessStatus = async () => {
    if (!businessId) return;
    
    try {
      // Obtener la configuración completa del negocio
      const response = await api.get(`/business-config?businessId=${businessId}`);
      const config = response.data;
      
      // Calcular el estado basado en los datos
      const isOpenByHours = isCurrentlyOpen(config.businessHours);
      const isMenuActive = config.menuStatus === 'active';
      
      const status = {
        isOpen: config.isOpen && isOpenByHours && isMenuActive,
        isOpenByHours,
        isMenuActive,
        menuStatus: config.menuStatus || 'active',
        nextOpenTime: getNextOpenTime(config.businessHours)
      };
      
      setBusinessStatus(status);
    } catch (err) {
      console.error('Error al obtener estado del negocio:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessStatus();
    
    // Actualizar cada minuto para verificar cambios de horario
    const interval = setInterval(fetchBusinessStatus, 60000);
    
    return () => clearInterval(interval);
  }, [businessId]);

  const getStatusDisplay = () => {
    if (businessStatus.isOpen) {
      return {
        text: 'Abierto',
        color: 'bg-green-500',
        icon: '🟢'
      };
    }
    
    if (!businessStatus.isOpenByHours) {
      return {
        text: 'Cerrado por horario',
        color: 'bg-orange-500',
        icon: '🟠'
      };
    }
    
    if (!businessStatus.isMenuActive) {
      return {
        text: 'Menú pausado',
        color: 'bg-red-500',
        icon: '🔴'
      };
    }
    
    return {
      text: 'Cerrado',
      color: 'bg-red-500',
      icon: '🔴'
    };
  };

  return {
    businessStatus,
    loading,
    error,
    getStatusDisplay,
    refetch: fetchBusinessStatus
  };
};

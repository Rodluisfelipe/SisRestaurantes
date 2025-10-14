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

  const fetchBusinessStatus = async () => {
    if (!businessId) return;
    
    try {
      const response = await api.get(`/business-config/status/${businessId}`);
      setBusinessStatus(response.data);
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

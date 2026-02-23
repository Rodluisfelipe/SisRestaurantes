import { useState, useEffect, useCallback } from 'react';
import { getOnboardingStatus, markGuideShown } from '../services/authService';

/**
 * Hook para manejar el estado de onboarding del negocio.
 * - Nuevos usuarios: desbloqueo progresivo
 * - Usuarios existentes (legacy): todo desbloqueado + botón (?) 
 */
export default function useOnboarding() {
  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getOnboardingStatus();
      if (data) setOnboarding(data);
    } catch {
      // If endpoint doesn't exist yet, treat as legacy
      setOnboarding({ isLegacy: true, level: 6, progress: 100, unlockedSections: 'all', guidesShown: [], nextStep: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const isSectionUnlocked = useCallback((sectionId) => {
    if (!onboarding) return true;
    if (onboarding.isLegacy || onboarding.level >= 6) return true;
    if (onboarding.unlockedSections === 'all') return true;
    return onboarding.unlockedSections.includes(sectionId);
  }, [onboarding]);

  const isGuideShown = useCallback((guideId) => {
    if (!onboarding) return true;
    return (onboarding.guidesShown || []).includes(guideId);
  }, [onboarding]);

  const showGuide = useCallback(async (guideId) => {
    await markGuideShown(guideId);
    setOnboarding(prev => prev ? {
      ...prev,
      guidesShown: [...(prev.guidesShown || []), guideId]
    } : prev);
  }, []);

  const getUnlockMessage = useCallback((sectionId) => {
    if (!onboarding || onboarding.isLegacy || onboarding.level >= 6) return null;
    
    const messages = {
      // Level 2 unlocks
      'theme': 'Agrega tu primer producto para personalizar',
      'product-order': 'Agrega tu primer producto para desbloquear',
      'toppings': 'Agrega tu primer producto para desbloquear',
      // Level 3 unlocks
      'orders': 'Configura tu modo de pedido para recibir órdenes',
      'completed_orders': 'Configura tu modo de pedido para recibir órdenes',
      'payment-config': 'Configura tu modo de pedido para desbloquear',
      // Level 4 unlocks
      'customers': 'Empieza a recibir pedidos para ver tus clientes',
      'reviews': 'Empieza a recibir pedidos para ver reseñas',
      // Level 5 unlocks
      'coupons': 'Disponible cuando tengas más actividad',
      'tables': 'Disponible cuando tengas más actividad',
      'delivery-zones': 'Disponible cuando tengas más actividad',
      'catalog': 'Disponible cuando tengas más actividad',
      'whatsapp': 'Disponible cuando tengas más actividad',
    };
    
    return messages[sectionId] || null;
  }, [onboarding]);

  return {
    onboarding,
    loading,
    isSectionUnlocked,
    isGuideShown,
    showGuide,
    getUnlockMessage,
    refreshOnboarding: fetchStatus
  };
}

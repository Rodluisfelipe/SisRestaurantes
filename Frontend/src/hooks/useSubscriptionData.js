import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../Context/AuthContext';
import { useBusinessSocket } from '../hooks/useBusinessSocket';

/**
 * Hook centralizado para datos de suscripción.
 * Se usa una sola vez en Admin.jsx y se pasa el resultado a todos
 * los componentes que lo necesiten, evitando API calls duplicados,
 * socket listeners duplicados y timers duplicados.
 */
export default function useSubscriptionData(businessId) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [graceUntilDate, setGraceUntilDate] = useState(null);
  const { user } = useAuth();
  const socket = useBusinessSocket(businessId || user?.businessId);
  const timerRef = useRef(null);

  // --- Cargar suscripción ---
  const loadSubscription = useCallback(async () => {
    try {
      setLoading(true);
      let response;

      if (user && !businessId) {
        response = await api.get('/subscriptions/me');
      } else if (businessId && user) {
        response = await api.get(`/subscriptions/me?businessId=${businessId}`);
      } else if (businessId) {
        response = await api.get(`/subscriptions/check/${businessId}`);
      } else {
        setSubscription(null);
        setLoading(false);
        return;
      }

      if (response.data.success) {
        if (response.data.subscription) {
          setSubscription(response.data.subscription);
        } else if (response.data.hasSubscription && response.data.subscription) {
          const sub = response.data.subscription;
          const now = new Date();
          const periodEnd = sub.periodEnd || sub.endDate;
          const graceUntil = sub.graceUntil || (periodEnd ? new Date(new Date(periodEnd).getTime() + 5 * 24 * 60 * 60 * 1000) : null);

          let status = 'active';
          if (periodEnd && now > graceUntil) {
            status = 'suspended';
          } else if (periodEnd && now > new Date(periodEnd)) {
            status = 'grace';
          }

          setSubscription({
            ...sub,
            status,
            periodEnd: periodEnd || sub.endDate,
            graceUntil,
            graceDaysRemaining: graceUntil && now <= graceUntil
              ? (() => {
                  const nowN = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const graceN = new Date(new Date(graceUntil).getFullYear(), new Date(graceUntil).getMonth(), new Date(graceUntil).getDate());
                  return Math.max(0, Math.floor((graceN - nowN) / (1000 * 60 * 60 * 24)));
                })()
              : 0,
            daysRemaining: periodEnd ? Math.ceil((new Date(periodEnd) - now) / (1000 * 60 * 60 * 24)) : 0
          });
        } else {
          setSubscription(null);
        }
      } else {
        setSubscription(null);
      }
    } catch (err) {
      if (err.response?.status !== 403 && err.response?.status !== 401) {
        setError('Error al cargar la información de suscripción');
      }
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, user]);

  // Cargar al montar
  useEffect(() => {
    if (businessId || user) {
      loadSubscription();
    } else {
      setLoading(false);
    }
  }, [businessId, user, loadSubscription]);

  // Socket listener (una sola vez)
  useEffect(() => {
    if (!socket) return;
    const handler = () => loadSubscription();
    socket.on('subscription_activated', handler);
    return () => socket.off('subscription_activated', handler);
  }, [socket, loadSubscription]);

  // Timer de gracia — solo corre si la suscripción está en período de gracia
  useEffect(() => {
    if (!subscription) return;

    // Determinar si estamos en grace period antes de iniciar timer
    const now = new Date();
    const pe = subscription.periodEnd ? new Date(subscription.periodEnd) : null;
    let grace = subscription.graceUntil || subscription.gracePeriodEnd
      ? new Date(subscription.graceUntil || subscription.gracePeriodEnd)
      : null;
    if (!grace && pe) {
      grace = new Date(pe);
      grace.setDate(grace.getDate() + 5);
    }

    const isInGrace = pe && grace && now > pe && now <= grace;

    if (!isInGrace) {
      // No estamos en grace — limpiar y no iniciar timer
      setGraceUntilDate(null);
      setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    // Estamos en grace period — iniciar countdown cada segundo
    setGraceUntilDate(grace);

    const tick = () => {
      const diff = grace - new Date();
      if (diff > 0) {
        setTimeRemaining({
          days: Math.floor(diff / 86400000),
          hours: Math.floor((diff % 86400000) / 3600000),
          minutes: Math.floor((diff % 3600000) / 60000),
          seconds: Math.floor((diff % 60000) / 1000),
        });
      } else {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timerRef.current);
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [subscription]);

  // Derivar estado actual (memoizado para evitar re-renders innecesarios)
  const derivedStatus = useMemo(() => {
    if (!subscription) return { currentStatus: 'active', isActive: true, isInGracePeriod: false, isExpired: false };

    const now = new Date();
    const periodEnd = subscription.periodEnd ? new Date(subscription.periodEnd) : null;
    const graceUntil = subscription.graceUntil || subscription.gracePeriodEnd
      ? new Date(subscription.graceUntil || subscription.gracePeriodEnd)
      : null;

    let status = subscription.status || 'active';
    if (periodEnd && graceUntil) {
      if (now > graceUntil) status = 'suspended';
      else if (now > periodEnd) status = 'grace';
      else status = 'active';
    } else if (periodEnd) {
      if (now > periodEnd) {
        const calcGrace = new Date(periodEnd);
        calcGrace.setDate(calcGrace.getDate() + 5);
        status = now > calcGrace ? 'suspended' : 'grace';
      } else {
        status = 'active';
      }
    }

    return {
      currentStatus: status,
      isActive: status === 'active',
      isInGracePeriod: status === 'grace',
      isExpired: status === 'suspended',
    };
  }, [subscription]);

  return {
    subscription,
    loading,
    error,
    timeRemaining,
    graceUntilDate,
    ...derivedStatus,
    reload: loadSubscription,
  };
}

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCrown, FaCalendarAlt, FaExclamationTriangle, FaArrowRight } from 'react-icons/fa';
import api from '../services/api';
import { useAuth } from '../Context/AuthContext';
import { useBusinessSocket } from '../hooks/useBusinessSocket';

const SubscriptionStatus = ({ businessId, onNavigateToSubscription }) => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [graceUntilDate, setGraceUntilDate] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const socket = useBusinessSocket(businessId || user?.businessId);

  useEffect(() => {
    // Solo cargar si tenemos businessId o si el usuario está autenticado
    if (businessId || user) {
      loadSubscription();
    } else {
      setLoading(false);
    }
  }, [businessId, user]);

  // Escuchar eventos de socket para actualización en tiempo real
  useEffect(() => {
    if (!socket) return;
    
    const handleSubscriptionActivated = (data) => {
      console.log('Socket: Subscription activated', data);
      loadSubscription();
    };
    
    socket.on('subscription_activated', handleSubscriptionActivated);
    
    return () => {
      socket.off('subscription_activated', handleSubscriptionActivated);
    };
  }, [socket]);

  // Contador en tiempo real para el período de gracia
  useEffect(() => {
    if (!subscription) return;

    const calculateTimeRemaining = () => {
      const now = new Date();
      const periodEnd = subscription.periodEnd ? new Date(subscription.periodEnd) : null;
      let graceUntil = subscription.graceUntil || subscription.gracePeriodEnd 
        ? new Date(subscription.graceUntil || subscription.gracePeriodEnd) 
        : null;
      
      // Si no hay graceUntil pero tenemos periodEnd, calcularlo
      if (!graceUntil && periodEnd) {
        graceUntil = new Date(periodEnd);
        graceUntil.setDate(graceUntil.getDate() + 5);
      }

      if (graceUntil && now <= graceUntil) {
        setGraceUntilDate(graceUntil);
        const diff = graceUntil - now;
        
        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          
          setTimeRemaining({ days, hours, minutes, seconds });
        } else {
          setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        }
      } else {
        setGraceUntilDate(null);
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [subscription]);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      let response;
      
      // Si tenemos businessId y el usuario está autenticado, usar /subscriptions/me
      // Si no, usar /subscriptions/check/:businessId (si tenemos businessId)
      if (user && !businessId) {
        // Usuario autenticado sin businessId específico
        response = await api.get(`/subscriptions/me`);
      } else if (businessId && user) {
        // Usuario autenticado con businessId específico
        response = await api.get(`/subscriptions/me?businessId=${businessId}`);
      } else if (businessId) {
        // Sin usuario autenticado pero con businessId (contexto público)
        response = await api.get(`/subscriptions/check/${businessId}`);
      } else {
        setSubscription(null);
        setLoading(false);
        return;
      }
      
      if (response.data.success) {
        // Formato de /subscriptions/me
        if (response.data.subscription) {
          setSubscription(response.data.subscription);
        }
        // Formato de /subscriptions/check/:businessId
        else if (response.data.hasSubscription && response.data.subscription) {
          const sub = response.data.subscription;
          // Convertir al formato esperado
          const now = new Date();
          const periodEnd = sub.periodEnd || sub.endDate;
          const graceUntil = sub.graceUntil || (periodEnd ? new Date(new Date(periodEnd).getTime() + 5 * 24 * 60 * 60 * 1000) : null);
          
          let status = 'active';
          if (periodEnd && now > graceUntil) {
            status = 'suspended';
          } else if (periodEnd && now > periodEnd) {
            status = 'grace';
          }
          
          setSubscription({
            ...sub,
            status,
            periodEnd: periodEnd || sub.endDate,
            graceUntil,
            graceDaysRemaining: graceUntil && now <= graceUntil 
              ? (() => {
                  const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const graceNormalized = new Date(new Date(graceUntil).getFullYear(), new Date(graceUntil).getMonth(), new Date(graceUntil).getDate());
                  const diffTime = graceNormalized - nowNormalized;
                  const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                  return Math.max(0, daysDiff);
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
    } catch (error) {
      console.error('Error loading subscription:', error);
      // Solo mostrar error si es un error crítico, no 403 (puede ser que el usuario no esté autenticado)
      if (error.response?.status !== 403 && error.response?.status !== 401) {
        setError('Error al cargar la información de suscripción');
      }
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status, isInGracePeriod) => {
    if (isInGracePeriod) return 'text-yellow-600';
    if (status === 'active') return 'text-green-600';
    if (status === 'expired') return 'text-red-600';
    return 'text-gray-600';
  };

  const getStatusText = (status, isInGracePeriod) => {
    if (isInGracePeriod) return 'Período de Gracia';
    if (status === 'active') return 'Activo';
    if (status === 'expired') return 'Expirado';
    return 'Inactivo';
  };

  const getPlanIcon = (planType) => {
    return planType === 'annual' ? '👑' : '📅';
  };

  const getPlanText = (planType) => {
    return planType === 'annual' ? 'Plan Anual' : 'Plan Mensual';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="text-blue-700 font-medium">Cargando información de suscripción...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-4 border border-red-200">
        <div className="flex items-center space-x-3">
          <FaExclamationTriangle className="text-red-500" />
          <span className="text-red-700 font-medium">{error}</span>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">📋</div>
          <div>
            <h3 className="text-gray-800 font-semibold">Sin Suscripción Activa</h3>
            <p className="text-gray-600 text-sm">Contacta al administrador para activar tu plan</p>
          </div>
        </div>
      </div>
    );
  }

  // Calcular estado basado en fechas (más confiable que el status del backend)
  const now = new Date();
  const periodEnd = subscription.periodEnd ? new Date(subscription.periodEnd) : null;
  const graceUntil = subscription.graceUntil || subscription.gracePeriodEnd ? new Date(subscription.graceUntil || subscription.gracePeriodEnd) : null;
  
  let currentStatus = subscription.status || 'active';
  if (periodEnd && graceUntil) {
    if (now > graceUntil) {
      currentStatus = 'suspended';
    } else if (now > periodEnd) {
      currentStatus = 'grace';
    } else {
      currentStatus = 'active';
    }
  } else if (periodEnd) {
    if (now > periodEnd) {
              // Si no hay graceUntil, calcularlo
        const calculatedGraceUntil = new Date(periodEnd);
        calculatedGraceUntil.setDate(calculatedGraceUntil.getDate() + 5);
        if (now > calculatedGraceUntil) {
          currentStatus = 'suspended';
        } else {
          currentStatus = 'grace';
        }
    } else {
      currentStatus = 'active';
    }
  }
  
  const isExpired = currentStatus === 'suspended';
  const isInGracePeriod = currentStatus === 'grace';
  const isActive = currentStatus === 'active';
  
  // Calcular días restantes de gracia (normalizando fechas para comparar solo días)
  let graceDaysRemaining = 0;
  
  // Si tenemos graceUntil, calcular basado en eso
  if (graceUntil) {
    const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const graceNormalized = new Date(graceUntil.getFullYear(), graceUntil.getMonth(), graceUntil.getDate());
    const diffTime = graceNormalized - nowNormalized;
    const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    graceDaysRemaining = Math.max(0, daysDiff);
  } 
  // Si no hay graceUntil pero tenemos periodEnd y estamos en período de gracia, calcularlo
  else if (periodEnd && isInGracePeriod) {
    const calculatedGraceUntil = new Date(periodEnd);
    calculatedGraceUntil.setDate(calculatedGraceUntil.getDate() + 5);
    const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const graceNormalized = new Date(calculatedGraceUntil.getFullYear(), calculatedGraceUntil.getMonth(), calculatedGraceUntil.getDate());
    const diffTime = graceNormalized - nowNormalized;
    const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    graceDaysRemaining = Math.max(0, daysDiff);
  }
  // Si el backend nos dio un valor, usarlo solo si no pudimos calcularlo nosotros
  else if (subscription.graceDaysRemaining !== undefined && subscription.graceDaysRemaining !== null) {
    graceDaysRemaining = subscription.graceDaysRemaining;
  }

      return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: (isExpired || isInGracePeriod) ? [1, 0.9, 1] : 1,
          y: 0
        }}
        transition={
          (isExpired || isInGracePeriod) ? {
            opacity: {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }
          } : {}
        }
        className={`hidden md:block rounded-lg p-3 md:p-4 border-2 ${
          isExpired 
            ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200 shadow-lg' 
            : isInGracePeriod
            ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 shadow-lg'
            : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
        }`}
      >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <div className="text-2xl sm:text-3xl shrink-0">
            {getPlanIcon(subscription.planType)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 truncate">
                {getPlanText(subscription.planType)}
              </h3>
              {subscription.planType === 'annual' && (
                <FaCrown className="text-yellow-500 text-sm sm:text-base shrink-0" />
              )}
            </div>
            <p className={`text-xs sm:text-sm font-medium ${getStatusColor(subscription.status, isInGracePeriod)}`}>
              {getStatusText(subscription.status, isInGracePeriod)}
            </p>
            <p className="text-gray-600 text-xs sm:text-sm truncate">
              ${subscription.price?.toLocaleString('es-CO') || '0'} COP • Hasta {formatDate(subscription.periodEnd || subscription.endDate)}
            </p>
          </div>
        </div>
        
        <div className="text-right shrink-0">
          {isExpired ? (
            <div className="text-red-600">
              <FaExclamationTriangle className="mx-auto mb-1 text-base sm:text-xl" />
              <p className="text-[10px] sm:text-xs font-medium">MENÚ DESACTIVADO</p>
            </div>
          ) : isInGracePeriod ? (
            <div className="text-yellow-600">
              <FaCalendarAlt className="mx-auto mb-1 text-base sm:text-xl" />
              <p className="text-[10px] sm:text-xs font-medium">
                {subscription.daysRemaining < 0 ? 'EXPIRÓ' : `${subscription.daysRemaining} días`}
              </p>
            </div>
          ) : (
            <div className="text-green-600">
              <FaCalendarAlt className="mx-auto mb-1 text-base sm:text-xl" />
              <p className="text-[10px] sm:text-xs font-medium">
                {subscription.daysRemaining > 0 ? `${subscription.daysRemaining} días` : 'ACTIVO'}
              </p>
            </div>
          )}
        </div>
      </div>
      
              {isInGracePeriod && (() => {
                // Calcular si quedan menos de 24 horas (menos de 1 día)
                const totalHoursRemaining = (timeRemaining.days * 24) + timeRemaining.hours;
                const isLessThan24Hours = totalHoursRemaining < 24 && timeRemaining.days === 0;
                
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ 
                      opacity: [1, 0.9, 1],
                      y: 0
                    }}
                    transition={{
                      opacity: {
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }
                    }}
                    className={`mt-3 p-3 sm:p-4 rounded-lg border-2 shadow-lg ${
                      isLessThan24Hours 
                        ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-300' 
                        : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300'
                    }`}
                  >
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <FaExclamationTriangle className={`${isLessThan24Hours ? 'text-red-600' : 'text-yellow-600'} text-base sm:text-xl flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                        <p className={`${isLessThan24Hours ? 'text-red-900' : 'text-yellow-900'} font-bold text-xs sm:text-sm mb-2`}>
                          ⏰ Período de Gracia
                        </p>
                        {graceUntilDate && (timeRemaining.days > 0 || timeRemaining.hours > 0 || timeRemaining.minutes > 0 || timeRemaining.seconds > 0) ? (
                          <>
                            <div className={`${isLessThan24Hours ? 'bg-red-100 border-red-300' : 'bg-yellow-100 border-yellow-300'} border-2 rounded-lg p-2 sm:p-3 mb-3`}>
                              <p className={`${isLessThan24Hours ? 'text-red-900' : 'text-yellow-900'} font-bold text-sm sm:text-base mb-1 text-center hidden sm:block`}>
                                Tiempo restante hasta desactivación:
                              </p>
                              {/* Mobile: Compact one-line countdown */}
                              <div className="block sm:hidden text-center">
                                <p className={`${isLessThan24Hours ? 'text-red-900' : 'text-yellow-900'} font-bold text-base mb-1`}>
                                  {timeRemaining.days > 0 && `${timeRemaining.days}d `}
                                  {String(timeRemaining.hours).padStart(2, '0')}:
                                  {String(timeRemaining.minutes).padStart(2, '0')}:
                                  {String(timeRemaining.seconds).padStart(2, '0')}
                                </p>
                                <p className={`${isLessThan24Hours ? 'text-red-700' : 'text-yellow-700'} text-[10px]`}>
                                  hasta desactivación
                                </p>
                              </div>
                              {/* Desktop: Full grid countdown */}
                              <div className="hidden sm:flex items-center justify-center space-x-2 text-center">
                                {timeRemaining.days > 0 && (
                                  <div className={`${isLessThan24Hours ? 'bg-red-200' : 'bg-yellow-200'} px-3 py-1 rounded`}>
                                    <div className={`text-2xl font-bold ${isLessThan24Hours ? 'text-red-900' : 'text-yellow-900'}`}>{timeRemaining.days}</div>
                                    <div className={`text-xs ${isLessThan24Hours ? 'text-red-700' : 'text-yellow-700'}`}>{timeRemaining.days === 1 ? 'día' : 'días'}</div>
                                  </div>
                                )}
                                <div className={`${isLessThan24Hours ? 'bg-red-200' : 'bg-yellow-200'} px-3 py-1 rounded`}>
                                  <div className={`text-2xl font-bold ${isLessThan24Hours ? 'text-red-900' : 'text-yellow-900'}`}>{String(timeRemaining.hours).padStart(2, '0')}</div>
                                  <div className={`text-xs ${isLessThan24Hours ? 'text-red-700' : 'text-yellow-700'}`}>horas</div>
                                </div>
                                <div className={`${isLessThan24Hours ? 'bg-red-200' : 'bg-yellow-200'} px-3 py-1 rounded`}>
                                  <div className={`text-2xl font-bold ${isLessThan24Hours ? 'text-red-900' : 'text-yellow-900'}`}>{String(timeRemaining.minutes).padStart(2, '0')}</div>
                                  <div className={`text-xs ${isLessThan24Hours ? 'text-red-700' : 'text-yellow-700'}`}>min</div>
                                </div>
                                <div className={`${isLessThan24Hours ? 'bg-red-200' : 'bg-yellow-200'} px-3 py-1 rounded`}>
                                  <div className={`text-2xl font-bold ${isLessThan24Hours ? 'text-red-900' : 'text-yellow-900'}`}>{String(timeRemaining.seconds).padStart(2, '0')}</div>
                                  <div className={`text-xs ${isLessThan24Hours ? 'text-red-700' : 'text-yellow-700'}`}>seg</div>
                                </div>
                              </div>
                              <p className={`${isLessThan24Hours ? 'text-red-800' : 'text-yellow-800'} text-[10px] sm:text-xs mt-2 text-center`}>
                                Desactivación: <strong className="hidden sm:inline">{formatDateTime(graceUntilDate)}</strong><strong className="inline sm:hidden">{formatDateTime(graceUntilDate).split(' ')[0]}</strong>
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="bg-red-100 border-2 border-red-300 rounded-lg p-3 mb-3">
                            <p className="text-red-900 font-bold text-center">
                              ⚠️ El menú se desactivará muy pronto
                            </p>
                            {graceUntilDate && (
                              <p className="text-red-800 text-xs mt-1 text-center">
                                Fecha de desactivación: <strong>{formatDateTime(graceUntilDate)}</strong>
                              </p>
                            )}
                          </div>
                        )}
                        <p className={`${isLessThan24Hours ? 'text-red-800' : 'text-yellow-800'} text-sm mb-3`}>
                          Tu suscripción expiró el {formatDate(subscription.periodEnd || subscription.endDate)}. 
                          Tienes <strong>{graceDaysRemaining} días de gracia</strong> para renovar antes de que tu menú se desactive.
                        </p>
                        <p className={`${isLessThan24Hours ? 'text-red-700' : 'text-yellow-700'} text-xs mb-3 font-medium`}>
                          ⚠️ Después del período de gracia, el menú quedará desactivado para seleccionar o ver órdenes. Los usuarios solo podrán ver el menú, pero no podrán realizar pedidos.
                        </p>
                      <button
                        onClick={() => {
                          if (onNavigateToSubscription) {
                            onNavigateToSubscription();
                          } else if (location.pathname.includes('/admin')) {
                            // Si estamos en el panel admin, usar evento custom o scroll
                            window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'subscription' }));
                            // También intentar scroll al inicio
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          } else {
                            navigate('/admin');
                          }
                        }}
                        className={`w-full sm:w-auto mt-2 px-4 py-2 ${isLessThan24Hours ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5`}
                      >
                        <span>Renovar Ahora</span>
                        <FaArrowRight className="text-sm" />
                      </button>
                    </div>
                  </div>
                </motion.div>
                  );
                })()}
      
              {isExpired && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ 
              opacity: [1, 0.9, 1],
              y: 0
            }}
            transition={{
              opacity: {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
            className="mt-3 p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border-2 border-red-300 shadow-lg"
          >
          <div className="flex items-start space-x-3">
            <FaExclamationTriangle className="text-red-600 text-xl flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-900 font-bold text-sm mb-2">
                🔴 MENÚ DESACTIVADO
              </p>
              <p className="text-red-800 text-sm mb-2">
                Tu suscripción expiró y el período de gracia de <strong>5 días</strong> ha finalizado.
              </p>
              <p className="text-red-700 text-xs mb-3 font-medium">
                ❌ El menú está desactivado para seleccionar o ver órdenes. Los usuarios solo pueden ver el menú, pero no pueden realizar pedidos. Para reactivarlo completamente, debes renovar tu suscripción.
              </p>
              <button
                onClick={() => {
                  if (onNavigateToSubscription) {
                    onNavigateToSubscription();
                  } else if (location.pathname.includes('/admin')) {
                    // Si estamos en el panel admin, usar evento custom o scroll
                    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'subscription' }));
                    // También intentar scroll al inicio
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    navigate('/admin');
                  }
                }}
                className="w-full sm:w-auto mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <span>Renovar Suscripción</span>
                <FaArrowRight className="text-sm" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default SubscriptionStatus;

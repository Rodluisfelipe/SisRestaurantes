import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { useBusinessConfig } from '../Context/BusinessContext';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCreditCard, FaExclamationTriangle, FaCalendarCheck, FaCheckCircle, FaTimes, FaArrowRight } from 'react-icons/fa';
import { useBusinessSocket } from '../hooks/useBusinessSocket';

const SubscriptionPaymentCard = () => {
  const { user } = useAuth();
  const { businessId: businessIdFromConfig } = useBusinessConfig();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedPlanType, setSelectedPlanType] = useState('monthly');
  
  // Conectar a socket para recibir actualizaciones en tiempo real
  const socket = useBusinessSocket(businessIdFromConfig || user?.businessId);

  const businessId = businessIdFromConfig || user?.businessId;


  useEffect(() => {
    if (businessId || user?.role === 'superadmin') {
      loadSubscription();
    }
    
  }, [businessId, user]);

  // Escuchar eventos de socket para actualización en tiempo real
  useEffect(() => {
    if (!socket) return;
    
    const handleSubscriptionActivated = (data) => {
      console.log('Socket: Subscription activated', data);
      loadSubscription();
    };
    
    const handlePaymentFailed = (data) => {
      console.log('Socket: Payment failed', data);
    };
    
    socket.on('subscription_activated', handleSubscriptionActivated);
    socket.on('subscription_payment_failed', handlePaymentFailed);
    
    return () => {
      socket.off('subscription_activated', handleSubscriptionActivated);
      socket.off('subscription_payment_failed', handlePaymentFailed);
    };
  }, [socket]);

  const loadSubscription = async () => {
    try {
      const url = user?.role === 'superadmin' && businessId 
        ? `/subscriptions/me?businessId=${businessId}`
        : '/subscriptions/me';
      
      const res = await api.get(url);
      if (res.data.success && res.data.subscription) {
        setSubscription(res.data.subscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      if (error.response?.status === 403) {
        console.error('No se pudo determinar el negocio. Por favor, cierra sesión y vuelve a iniciar sesión.');
      }
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    setProcessing(true);
    // Función deshabilitada temporalmente - integración de pagos pendiente
    alert('Sistema de pagos temporalmente no disponible. Por favor contacta al administrador.');
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg shadow-lg p-6 border-2 border-gray-200"
      >
        <div className="flex items-center space-x-4">
          <div className="text-4xl">📋</div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Sin Suscripción Activa</h3>
            <p className="text-gray-600 mt-1">Aún no tienes una suscripción activa.</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const statusBadge = {
    'active': { color: 'green', text: 'Activa', icon: <FaCheckCircle /> },
    'past_due': { color: 'orange', text: 'Pago vencido', icon: <FaExclamationTriangle /> },
    'grace': { color: 'yellow', text: 'En periodo de gracia', icon: <FaCalendarCheck /> },
    'suspended': { color: 'red', text: 'Suspendida', icon: <FaExclamationTriangle /> },
    'canceled': { color: 'gray', text: 'Cancelada', icon: <FaCreditCard /> }
  };

  const badge = statusBadge[subscription.status] || statusBadge.active;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-lg p-6 border-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <FaCreditCard className="mr-2 text-blue-600" />
          Mi Suscripción
        </h2>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-2 bg-${badge.color}-100 text-${badge.color}-800`}>
          {badge.icon}
          <span>{badge.text}</span>
        </span>
      </div>

      {/* Banner de Alerta - Grace Period */}
      {(subscription.status === 'grace' || (subscription.status === 'active' && subscription.graceDaysRemaining > 0 && subscription.daysRemaining <= 0)) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg"
        >
          <div className="flex items-start space-x-3">
            <FaExclamationTriangle className="text-yellow-600 text-xl flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-yellow-900 font-bold text-sm mb-2">
                ⏰ Período de Gracia: {subscription.graceDaysRemaining || 7} {subscription.graceDaysRemaining === 1 ? 'día restante' : 'días restantes'}
              </p>
              <p className="text-yellow-800 text-sm mb-2">
                Tu suscripción expiró el {new Date(subscription.periodEnd || subscription.endDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}. 
                Tienes <strong>{subscription.graceDaysRemaining || 7} días de gracia</strong> para renovar.
              </p>
              <p className="text-yellow-700 text-xs mb-3 font-medium">
                ⚠️ Después del período de gracia, tu menú quedará desactivado y no será visible para los clientes.
              </p>
              <button
                onClick={() => navigate('/admin/subscriptions')}
                className="w-full sm:w-auto mt-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <span>Renovar Ahora</span>
                <FaArrowRight className="text-sm" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Banner de Alerta - Suspended */}
      {subscription.status === 'suspended' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-lg"
        >
          <div className="flex items-start space-x-3">
            <FaExclamationTriangle className="text-red-600 text-xl flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-900 font-bold text-sm mb-2">
                🔴 MENÚ DESACTIVADO
              </p>
              <p className="text-red-800 text-sm mb-2">
                Tu suscripción expiró y el período de gracia de <strong>7 días</strong> ha finalizado.
              </p>
              <p className="text-red-700 text-xs mb-3 font-medium">
                ❌ Tu menú no está visible para los clientes. Para reactivarlo, debes renovar tu suscripción.
              </p>
              <button
                onClick={() => navigate('/admin/subscriptions')}
                className="w-full sm:w-auto mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <span>Renovar Suscripción</span>
                <FaArrowRight className="text-sm" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Fecha de Vencimiento */}
      <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-700 text-sm font-medium">
              {subscription.status === 'active' ? 'Vence el' : subscription.status === 'grace' ? 'Gracia hasta el' : 'Venció el'}
            </p>
            <p className="text-blue-900 text-xl font-bold mt-1">
              {new Date(subscription.periodEnd).toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
          {subscription.daysRemaining !== undefined && (
            <div className="text-right">
              <p className="text-blue-600 text-3xl font-bold">{subscription.daysRemaining}</p>
              <p className="text-blue-700 text-xs">días restantes</p>
            </div>
          )}
        </div>
      </div>

      {/* Último Pago */}
      {subscription.lastPayment && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 font-medium mb-2">Último pago</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-lg">
                ${subscription.lastPayment.amount.toLocaleString('es-CO')} <span className="text-sm text-gray-600">COP</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(subscription.lastPayment.date).toLocaleDateString('es-CO', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })} • {subscription.lastPayment.method}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              subscription.lastPayment.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
              subscription.lastPayment.status === 'DECLINED' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {subscription.lastPayment.status}
            </span>
          </div>
        </div>
      )}

      {/* Selector de Plan (solo si está vencida) */}
      {(subscription.status === 'past_due' || subscription.status === 'grace' || subscription.status === 'suspended') && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">Selecciona tu plan de renovación:</p>
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={() => setSelectedPlanType('monthly')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedPlanType === 'monthly'
                  ? 'border-blue-600 bg-blue-600 text-white shadow-lg'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
              }`}
            >
              <div className="text-center">
                <p className="font-bold text-lg">Mensual</p>
                <p className={`text-2xl font-extrabold mt-1 ${selectedPlanType === 'monthly' ? 'text-white' : 'text-blue-600'}`}>
                  $27.000
                </p>
                <p className="text-xs mt-1 opacity-80">Por mes</p>
              </div>
            </motion.button>

            <motion.button
              onClick={() => setSelectedPlanType('annual')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-4 rounded-lg border-2 transition-all relative ${
                selectedPlanType === 'annual'
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'
              }`}
            >
              <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                ¡Ahorra!
              </span>
              <div className="text-center">
                <p className="font-bold text-lg">Anual</p>
                <p className={`text-2xl font-extrabold mt-1 ${selectedPlanType === 'annual' ? 'text-white' : 'text-indigo-600'}`}>
                  $308.000
                </p>
                <p className="text-xs mt-1 opacity-80">Equivale a 11 meses</p>
              </div>
            </motion.button>
          </div>
        </div>
      )}

      {/* Botón de Pago */}
      <button
        onClick={handlePayNow}
        disabled={processing || subscription.status === 'active'}
        className={`w-full py-4 rounded-lg font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 ${
          subscription.status === 'active' 
            ? 'bg-gray-400 cursor-not-allowed opacity-60' 
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
        }`}
      >
        {processing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Abriendo pasarela de pago...</span>
          </>
        ) : subscription.status === 'active' ? (
          <>
            <FaCheckCircle />
            <span>Suscripción Activa</span>
          </>
        ) : (
          <>
            <FaCreditCard />
            <span>Pagar / Renovar ahora</span>
          </>
        )}
      </button>

      {subscription.status !== 'active' && (
        <p className="text-xs text-gray-500 text-center mt-3">
        </p>
      )}
    </motion.div>
  );
};

export default SubscriptionPaymentCard;

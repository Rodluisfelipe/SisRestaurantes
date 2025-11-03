import React, { useState, useEffect } from 'react';
import { useAuth } from '../Context/AuthContext';
import api from '../services/api';
import { motion } from 'framer-motion';
import { FaCreditCard, FaExclamationTriangle, FaCalendarCheck, FaCheckCircle } from 'react-icons/fa';

const SubscriptionPaymentCard = () => {
  const { businessId } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (businessId) {
      loadSubscription();
    }
  }, [businessId]);

  const loadSubscription = async () => {
    try {
      const res = await api.get('/subscriptions/me');
      if (res.data.success && res.data.subscription) {
        setSubscription(res.data.subscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      // Si es 403, el usuario no tiene businessId válido - mostrar mensaje
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
    try {
      const res = await api.post('/subscriptions/checkout');
      if (res.data.success && res.data.checkoutLink) {
        // Redirigir a Wompi
        window.location.href = res.data.checkoutLink;
      } else {
        alert('Error al crear checkout. Por favor intenta nuevamente.');
        setProcessing(false);
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert(error.response?.data?.message || 'Error al crear checkout. Por favor intenta nuevamente.');
      setProcessing(false);
    }
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
      {/* Header con Badge */}
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

      {/* Banner de Alerta (si aplica) */}
      {(subscription.status === 'past_due' || subscription.status === 'grace') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg"
        >
          <div className="flex items-start space-x-3">
            <FaExclamationTriangle className="text-orange-600 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-orange-900 font-medium">Tu suscripción está vencida</p>
              <p className="text-orange-700 text-sm mt-1">Mantén tu acceso renovando ahora.</p>
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

      {/* CTA Principal */}
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
            <span>Redirigiendo a Wompi...</span>
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
          Serás redirigido a Wompi para completar el pago de forma segura
        </p>
      )}
    </motion.div>
  );
};

export default SubscriptionPaymentCard;


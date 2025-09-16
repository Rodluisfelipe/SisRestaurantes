import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaCrown, FaCalendarAlt, FaExclamationTriangle } from 'react-icons/fa';
import api from '../services/api';

const SubscriptionStatus = ({ businessId }) => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (businessId) {
      loadSubscription();
    }
  }, [businessId]);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/subscriptions/check/${businessId}`);
      
      if (response.data.success && response.data.hasSubscription) {
        setSubscription(response.data.subscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      setError('Error al cargar la información de suscripción');
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

  const isExpired = subscription.status === 'expired' && !subscription.isInGracePeriod;
  const isInGracePeriod = subscription.isInGracePeriod;
  const isActive = subscription.isActive;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg p-4 border-2 ${
        isExpired 
          ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200' 
          : isInGracePeriod
          ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
          : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-3xl">
            {getPlanIcon(subscription.planType)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-gray-800">
                {getPlanText(subscription.planType)}
              </h3>
              {subscription.planType === 'annual' && (
                <FaCrown className="text-yellow-500" />
              )}
            </div>
            <p className={`text-sm font-medium ${getStatusColor(subscription.status, isInGracePeriod)}`}>
              {getStatusText(subscription.status, isInGracePeriod)}
            </p>
            <p className="text-gray-600 text-sm">
              ${subscription.price} • Hasta {formatDate(subscription.endDate)}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          {isExpired ? (
            <div className="text-red-600">
              <FaExclamationTriangle className="mx-auto mb-1" />
              <p className="text-xs font-medium">MENÚ DESACTIVADO</p>
            </div>
          ) : isInGracePeriod ? (
            <div className="text-yellow-600">
              <FaCalendarAlt className="mx-auto mb-1" />
              <p className="text-xs font-medium">
                {subscription.daysRemaining < 0 ? 'EXPIRÓ' : `${subscription.daysRemaining} días`}
              </p>
            </div>
          ) : (
            <div className="text-green-600">
              <FaCalendarAlt className="mx-auto mb-1" />
              <p className="text-xs font-medium">
                {subscription.daysRemaining > 0 ? `${subscription.daysRemaining} días` : 'ACTIVO'}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {isInGracePeriod && (
        <div className="mt-3 p-3 bg-yellow-100 rounded-lg border border-yellow-200">
          <div className="flex items-center space-x-2">
            <FaExclamationTriangle className="text-yellow-600" />
            <p className="text-yellow-800 text-sm font-medium">
              Tu suscripción ha expirado. Tienes 1 día para renovar antes de que se desactive el menú.
            </p>
          </div>
        </div>
      )}
      
      {isExpired && (
        <div className="mt-3 p-3 bg-red-100 rounded-lg border border-red-200">
          <div className="flex items-center space-x-2">
            <FaExclamationTriangle className="text-red-600" />
            <p className="text-red-800 text-sm font-medium">
              Tu menú está desactivado. Contacta al administrador para renovar tu suscripción.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default SubscriptionStatus;

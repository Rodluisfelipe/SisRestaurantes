import React from 'react';
import { FaCalendarAlt, FaClock, FaDollarSign, FaTag } from 'react-icons/fa';
import { motion } from 'framer-motion';

const SubscriptionDetailsCard = ({ subscription }) => {
  if (!subscription) return null;

  const getPlanName = (plan) => {
    switch (plan) {
      case 'annual': return 'Plan Anual';
      case 'semiannual': return 'Plan Semestral';
      case 'quarterly': return 'Plan Trimestral';
      default: return 'Plan Mensual';
    }
  };

  const getPlanIcon = (plan) => {
    switch (plan) {
      case 'annual': return '👑';
      case 'semiannual': return '🛡️';
      case 'quarterly': return '💎';
      default: return '📅';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white rounded-lg shadow-lg p-6 border border-gray-200"
    >
      <h3 className="text-xl font-bold mb-6 flex items-center">
        <FaTag className="mr-2 text-purple-600" />
        Detalles de la Suscripción
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getPlanIcon(subscription.plan)}</span>
            <div>
              <p className="text-purple-700 text-sm font-medium">Plan:</p>
              <p className="font-bold text-purple-900">{getPlanName(subscription.plan)}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <FaCalendarAlt className="text-blue-600" />
            <span className="text-gray-600">Período:</span>
          </div>
          <span className="font-semibold text-gray-800">
            {new Date(subscription.periodStart).toLocaleDateString('es-CO', {
              day: '2-digit',
              month: '2-digit'
            })} - {new Date(subscription.periodEnd).toLocaleDateString('es-CO', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}
          </span>
        </div>
        
        {subscription.nextDueDate && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <FaClock className="text-green-600" />
              <span className="text-gray-600">Próximo cobro:</span>
            </div>
            <span className="font-semibold text-gray-800">
              {new Date(subscription.nextDueDate).toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </span>
          </div>
        )}
        
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
          <div className="flex items-center space-x-3">
            <FaDollarSign className="text-green-600" />
            <span className="text-gray-600">Días restantes:</span>
          </div>
          <span className="font-bold text-green-900 text-lg">{subscription.daysRemaining}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default SubscriptionDetailsCard;


import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { getBusinessSlug } from '../utils/getBusinessId';

const CouponInput = ({ onCouponApplied, onCouponRemoved, appliedCoupon, orderData, customerId, businessId }) => {
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setError('Por favor ingresa un código de cupón');
      return;
    }

    setValidating(true);
    setError('');

    try {
      const finalBusinessId = businessId || getBusinessSlug();
      const response = await api.post('/coupons/validate', {
        businessId: finalBusinessId,
        code: couponCode.trim(),
        orderData,
        customerId
      });

      if (response.data.valid) {
        onCouponApplied(response.data);
        setCouponCode('');
        setError('');
        setShowModal(false);
      } else {
        setError(response.data.message || 'Cupón inválido');
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      setError(error.response?.data?.message || 'Error al validar el cupón');
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    onCouponRemoved();
    setError('');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getDiscountIcon = (type) => {
    const icons = {
      percentage: '%',
      fixed: '$',
      free_delivery: '🚚'
    };
    return icons[type] || '%';
  };

  return (
    <div className="mb-4">
      {appliedCoupon ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-green-600 text-lg mr-2">✅</span>
              <div>
                <p className="font-medium text-green-800 text-sm">
                  Cupón aplicado: {appliedCoupon.coupon.code}
                </p>
                <p className="text-xs text-green-600">
                  -{formatCurrency(appliedCoupon.discountAmount)} • Total: {formatCurrency(appliedCoupon.finalAmount)}
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50"
            >
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          className="w-full bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
        >
          <span className="text-lg">🎫</span>
          <span className="text-sm font-medium text-gray-700">¿Tienes un cupón?</span>
        </button>
      )}

      {/* Modal para ingresar cupón */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="mr-2">🎫</span>
                  Cupón de Descuento
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Ingresa tu código de cupón"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
                    style={{ color: '#111827' }}
                    onKeyPress={(e) => e.key === 'Enter' && handleValidateCoupon()}
                  />
                  <button
                    onClick={handleValidateCoupon}
                    disabled={validating || !couponCode.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {validating ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Validando...
                      </div>
                    ) : (
                      'Aplicar'
                    )}
                  </button>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 rounded-lg p-3"
                  >
                    <div className="flex items-center">
                      <span className="text-red-600 text-lg mr-2">❌</span>
                      <p className="text-red-800 text-sm">{error}</p>
                    </div>
                  </motion.div>
                )}

                <div className="text-xs text-gray-500 text-center">
                  💡 Ingresa el código de tu cupón para obtener descuentos especiales
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CouponInput;

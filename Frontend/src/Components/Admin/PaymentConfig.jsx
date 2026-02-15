import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * Admin panel for configuring ordering mode and payment information.
 * 
 * Allows restaurant owner to:
 * - Choose ordering mode: WhatsApp only, In-app, or Both
 * - Configure payment accounts (Nequi, Daviplata, bank transfer)
 * - Set payment instructions for customers
 */
const PaymentConfig = () => {
  const { businessConfig, businessId } = useBusinessConfig();
  
  const [orderingMode, setOrderingMode] = useState('whatsapp');
  const [paymentInfo, setPaymentInfo] = useState({
    nequi: '',
    daviplata: '',
    bankName: '',
    bankAccountType: '',
    bankAccountNumber: '',
    accountHolder: '',
    instructions: ''
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load current config
  useEffect(() => {
    if (businessConfig) {
      setOrderingMode(businessConfig.orderingMode || 'whatsapp');
      setPaymentInfo({
        nequi: businessConfig.paymentInfo?.nequi || '',
        daviplata: businessConfig.paymentInfo?.daviplata || '',
        bankName: businessConfig.paymentInfo?.bankName || '',
        bankAccountType: businessConfig.paymentInfo?.bankAccountType || '',
        bankAccountNumber: businessConfig.paymentInfo?.bankAccountNumber || '',
        accountHolder: businessConfig.paymentInfo?.accountHolder || '',
        instructions: businessConfig.paymentInfo?.instructions || ''
      });
    }
  }, [businessConfig]);

  const handlePaymentInfoChange = (field, value) => {
    setPaymentInfo(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleModeChange = (mode) => {
    setOrderingMode(mode);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await api.put('/business-config', {
        businessId,
        orderingMode,
        paymentInfo
      });
      setSuccess(true);
      setHasChanges(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar configuración');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const isInAppEnabled = orderingMode === 'inapp' || orderingMode === 'both';

  const ORDERING_MODES = [
    {
      id: 'whatsapp',
      label: 'Solo WhatsApp',
      desc: 'Los clientes hacen pedidos por WhatsApp (modo actual)',
      icon: '💬',
      color: 'bg-green-50 border-green-200',
      activeColor: 'bg-green-100 border-green-500 ring-2 ring-green-200'
    },
    {
      id: 'inapp',
      label: 'Pedido en App',
      desc: 'Los clientes pagan y hacen seguimiento directamente en el menú',
      icon: '📱',
      color: 'bg-blue-50 border-blue-200',
      activeColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-200'
    },
    {
      id: 'both',
      label: 'Ambos',
      desc: 'Los clientes eligen entre WhatsApp o pago en app',
      icon: '🔄',
      color: 'bg-purple-50 border-purple-200',
      activeColor: 'bg-purple-100 border-purple-500 ring-2 ring-purple-200'
    }
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Ordering Mode Selection */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Modo de Pedidos</h3>
        <p className="text-sm text-gray-500 mb-4">¿Cómo quieres que tus clientes hagan pedidos?</p>
        
        <div className="space-y-3">
          {ORDERING_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                orderingMode === mode.id ? mode.activeColor : mode.color
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{mode.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{mode.label}</span>
                    {orderingMode === mode.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm"
                      >
                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{mode.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Payment Information - only show when in-app is enabled */}
      {isInAppEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-1">Información de Pago</h3>
          <p className="text-sm text-gray-500 mb-4">
            Los clientes verán esta información para realizar el pago antes de que confirmes
          </p>

          <div className="space-y-4">
            {/* Nequi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📱 Nequi
              </label>
              <input
                type="text"
                value={paymentInfo.nequi}
                onChange={(e) => handlePaymentInfoChange('nequi', e.target.value)}
                placeholder="Número de Nequi"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:border-transparent text-sm transition-all"
                style={{ focusRingColor: themeColor }}
              />
            </div>

            {/* Daviplata */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💜 Daviplata
              </label>
              <input
                type="text"
                value={paymentInfo.daviplata}
                onChange={(e) => handlePaymentInfoChange('daviplata', e.target.value)}
                placeholder="Número de Daviplata"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:border-transparent text-sm transition-all"
              />
            </div>

            {/* Bank Transfer */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                🏦 Transferencia Bancaria
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Banco</label>
                  <input
                    type="text"
                    value={paymentInfo.bankName}
                    onChange={(e) => handlePaymentInfoChange('bankName', e.target.value)}
                    placeholder="Ej: Bancolombia"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo de Cuenta</label>
                  <select
                    value={paymentInfo.bankAccountType}
                    onChange={(e) => handlePaymentInfoChange('bankAccountType', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Ahorros">Ahorros</option>
                    <option value="Corriente">Corriente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Número de Cuenta</label>
                <input
                  type="text"
                  value={paymentInfo.bankAccountNumber}
                  onChange={(e) => handlePaymentInfoChange('bankAccountNumber', e.target.value)}
                  placeholder="Número de cuenta bancaria"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Titular de la Cuenta</label>
                <input
                  type="text"
                  value={paymentInfo.accountHolder}
                  onChange={(e) => handlePaymentInfoChange('accountHolder', e.target.value)}
                  placeholder="Nombre del titular"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 Instrucciones para el Cliente
              </label>
              <textarea
                value={paymentInfo.instructions}
                onChange={(e) => handlePaymentInfoChange('instructions', e.target.value)}
                placeholder="Ej: Envía el pago a cualquiera de las cuentas y sube tu comprobante"
                rows={3}
                maxLength={300}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:border-transparent text-sm resize-none transition-all"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{paymentInfo.instructions.length}/300</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Info Banner */}
      {isInAppEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-2xl p-4"
        >
          <h4 className="font-semibold text-blue-900 text-sm mb-2">💡 ¿Cómo funciona?</h4>
          <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside">
            <li>El cliente hace su pedido desde el menú</li>
            <li>Ve tu información de pago y transfiere</li>
            <li>Sube foto del comprobante</li>
            <li>Tú verificas el pago desde el panel de pedidos</li>
            <li>Confirmas el pago y comienzas a preparar</li>
          </ol>
        </motion.div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95"
          style={{ backgroundColor: hasChanges ? themeColor : '#9ca3af' }}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando...
            </span>
          ) : (
            'Guardar Configuración'
          )}
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium"
        >
          ✅ Configuración guardada exitosamente
        </motion.div>
      )}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700"
        >
          ⚠️ {error}
        </motion.div>
      )}
    </div>
  );
};

export default PaymentConfig;

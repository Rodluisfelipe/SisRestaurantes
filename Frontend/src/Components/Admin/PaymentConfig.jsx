import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * Admin panel for configuring ordering mode, payment methods, and payment accounts.
 * 
 * Three tabs:
 * 1. Modo de Pedidos - Choose ordering mode
 * 2. Métodos de Pago - Enable/disable payment methods globally & per mode
 * 3. Datos de Cuenta - Payment account details (Nequi, Daviplata, bank)
 */
const PaymentConfig = () => {
  const { businessConfig, businessId } = useBusinessConfig();
  
  const [activeTab, setActiveTab] = useState('mode');
  const [orderingMode, setOrderingMode] = useState('whatsapp');
  const [paymentMethods, setPaymentMethods] = useState({
    efectivo: { enabled: false, modes: { whatsapp: true, inapp: true } },
    nequi: { enabled: false, modes: { whatsapp: true, inapp: true } },
    daviplata: { enabled: false, modes: { whatsapp: true, inapp: true } },
    transferencia: { enabled: false, modes: { whatsapp: true, inapp: true } },
  });
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
      // Load payment methods config, with backward-compatible defaults
      if (businessConfig.paymentMethods) {
        setPaymentMethods({
          efectivo: {
            enabled: businessConfig.paymentMethods.efectivo?.enabled ?? false,
            modes: {
              whatsapp: businessConfig.paymentMethods.efectivo?.modes?.whatsapp ?? true,
              inapp: businessConfig.paymentMethods.efectivo?.modes?.inapp ?? true,
            }
          },
          nequi: {
            enabled: businessConfig.paymentMethods.nequi?.enabled ?? !!businessConfig.paymentInfo?.nequi,
            modes: {
              whatsapp: businessConfig.paymentMethods.nequi?.modes?.whatsapp ?? true,
              inapp: businessConfig.paymentMethods.nequi?.modes?.inapp ?? true,
            }
          },
          daviplata: {
            enabled: businessConfig.paymentMethods.daviplata?.enabled ?? !!businessConfig.paymentInfo?.daviplata,
            modes: {
              whatsapp: businessConfig.paymentMethods.daviplata?.modes?.whatsapp ?? true,
              inapp: businessConfig.paymentMethods.daviplata?.modes?.inapp ?? true,
            }
          },
          transferencia: {
            enabled: businessConfig.paymentMethods.transferencia?.enabled ?? !!businessConfig.paymentInfo?.bankAccountNumber,
            modes: {
              whatsapp: businessConfig.paymentMethods.transferencia?.modes?.whatsapp ?? true,
              inapp: businessConfig.paymentMethods.transferencia?.modes?.inapp ?? true,
            }
          },
        });
      } else {
        // Backward compat: infer from paymentInfo
        setPaymentMethods({
          efectivo: { enabled: false, modes: { whatsapp: true, inapp: true } },
          nequi: { enabled: false, modes: { whatsapp: true, inapp: true } },
          daviplata: { enabled: !!businessConfig.paymentInfo?.daviplata, modes: { whatsapp: true, inapp: true } },
          transferencia: { enabled: !!businessConfig.paymentInfo?.bankAccountNumber, modes: { whatsapp: true, inapp: true } },
        });
      }
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

  const togglePaymentMethod = (methodId) => {
    setPaymentMethods(prev => ({
      ...prev,
      [methodId]: { ...prev[methodId], enabled: !prev[methodId].enabled }
    }));
    setHasChanges(true);
  };

  const toggleMethodMode = (methodId, modeId) => {
    setPaymentMethods(prev => ({
      ...prev,
      [methodId]: {
        ...prev[methodId],
        modes: {
          ...prev[methodId].modes,
          [modeId]: !prev[methodId].modes[modeId]
        }
      }
    }));
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
        paymentInfo,
        paymentMethods
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

  const ORDERING_MODES = [
    {
      id: 'whatsapp',
      label: 'Solo WhatsApp',
      desc: 'Los clientes hacen pedidos por WhatsApp',
      icon: '💬',
      color: 'bg-green-50 border-green-200',
      activeColor: 'bg-green-100 border-green-500 ring-2 ring-green-200'
    },
    {
      id: 'inapp',
      label: 'Pedido en App',
      desc: 'Los clientes pagan y hacen seguimiento en el menú',
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

  const NEQUI_LOGO = 'https://cdn.prod.website-files.com/6317a229ebf7723658463b4b/663a6b0d43303ddf38035997_logo-nequi.svg';
  const DAVIPLATA_LOGO = 'https://play-lh.googleusercontent.com/bNPDiFqg28L6ckatfuP-WgrxDRDk0JEOkC6nUIQp7Q61RW78i1bw-ffMmEjyxl-qP6dv3ANDOQqmIbBtgJI3EA';

  const PAYMENT_METHODS_META = [
    { id: 'efectivo', label: 'Efectivo', icon: '💵', desc: 'Pago en efectivo al recibir el pedido' },
    { id: 'nequi', label: 'Nequi', logo: NEQUI_LOGO, desc: 'Transferencia por Nequi', needsAccount: true },
    { id: 'daviplata', label: 'Daviplata', logo: DAVIPLATA_LOGO, desc: 'Transferencia por Daviplata', needsAccount: true },
    { id: 'transferencia', label: 'Transferencia Bancaria', icon: '🏦', desc: 'Transferencia directa a cuenta bancaria', needsAccount: true },
  ];

  const MODE_LABELS = {
    whatsapp: { icon: '💬', label: 'WhatsApp' },
    inapp: { icon: '📱', label: 'En App' },
  };

  // Which modes are relevant based on orderingMode
  const activeModes = orderingMode === 'whatsapp' ? ['whatsapp'] : orderingMode === 'inapp' ? ['inapp'] : ['whatsapp', 'inapp'];

  const TABS = [
    { id: 'mode', label: 'Modo de Pedidos', icon: '📦' },
    { id: 'methods', label: 'Métodos de Pago', icon: '💳' },
    { id: 'accounts', label: 'Datos de Cuenta', icon: '🏦' },
  ];

  // Check if any method that needs account data is enabled
  const needsAccountsTab = paymentMethods.nequi.enabled || paymentMethods.daviplata.enabled || paymentMethods.transferencia.enabled;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1.5 flex gap-1">
        {TABS.map(tab => {
          // Hide accounts tab if no method needs it
          if (tab.id === 'accounts' && !needsAccountsTab) return null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ====== TAB: Modo de Pedidos ====== */}
      {activeTab === 'mode' && (
        <motion.div
          key="mode"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
        >
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

          {/* Info about in-app flow */}
          {(orderingMode === 'inapp' || orderingMode === 'both') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4"
            >
              <h4 className="font-semibold text-blue-900 text-sm mb-2">💡 ¿Cómo funciona el modo en App?</h4>
              <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside">
                <li>El cliente hace su pedido desde el menú</li>
                <li>Ve tu información de pago y transfiere</li>
                <li>Sube foto del comprobante</li>
                <li>Tú verificas el pago desde el panel de pedidos</li>
                <li>Confirmas el pago y comienzas a preparar</li>
              </ol>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ====== TAB: Métodos de Pago ====== */}
      {activeTab === 'methods' && (
        <motion.div
          key="methods"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Métodos de Pago</h3>
            <p className="text-sm text-gray-500 mb-5">Activa los métodos de pago y configura en qué modos estarán disponibles</p>

            <div className="space-y-3">
              {PAYMENT_METHODS_META.map(method => {
                const config = paymentMethods[method.id];
                const isEnabled = config?.enabled;

                return (
                  <div
                    key={method.id}
                    className={`rounded-xl border-2 transition-all overflow-hidden ${
                      isEnabled ? 'border-green-300 bg-green-50/30' : 'border-gray-200 bg-gray-50/50'
                    }`}
                  >
                    {/* Header row: toggle + label */}
                    <button
                      onClick={() => togglePaymentMethod(method.id)}
                      className="w-full flex items-center gap-3 p-4"
                    >
                      {method.logo ? (
                        <img src={method.logo} alt={method.label} className="w-8 h-8 object-contain rounded" />
                      ) : (
                        <span className="text-2xl">{method.icon}</span>
                      )}
                      <div className="flex-1 text-left">
                        <span className="font-semibold text-gray-900">{method.label}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{method.desc}</p>
                      </div>
                      {/* Toggle switch */}
                      <div className={`relative w-11 h-6 rounded-full transition-colors ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <motion.div
                          layout
                          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
                          style={{ left: isEnabled ? '22px' : '2px' }}
                        />
                      </div>
                    </button>

                    {/* Per-mode toggles (only when enabled and multiple modes exist) */}
                    <AnimatePresence>
                      {isEnabled && activeModes.length > 1 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-0">
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                              <p className="text-xs font-medium text-gray-500 mb-2">Disponible en:</p>
                              <div className="flex gap-3">
                                {activeModes.map(modeId => (
                                  <label
                                    key={modeId}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={config.modes[modeId] ?? true}
                                      onChange={() => toggleMethodMode(method.id, modeId)}
                                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {MODE_LABELS[modeId].icon} {MODE_LABELS[modeId].label}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Warning if account data needed but missing */}
                    {isEnabled && method.needsAccount && (
                      (() => {
                        const missing = (method.id === 'nequi' && !paymentInfo.nequi) ||
                          (method.id === 'daviplata' && !paymentInfo.daviplata) ||
                          (method.id === 'transferencia' && !paymentInfo.bankAccountNumber);
                        return missing ? (
                          <div className="px-4 pb-3">
                            <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                              <span className="text-sm">⚠️</span>
                              <p className="text-xs text-amber-700">
                                Completa los datos de cuenta en la pestaña <strong>"Datos de Cuenta"</strong> para que los clientes puedan usar este método.
                              </p>
                            </div>
                          </div>
                        ) : null;
                      })()
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary card */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">Resumen de métodos activos</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS_META.filter(m => paymentMethods[m.id]?.enabled).map(m => (
                <span key={m.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700">
                  {m.logo ? <img src={m.logo} alt={m.label} className="w-4 h-4 object-contain rounded-sm inline-block" /> : m.icon} {m.label}
                  {activeModes.length > 1 && (
                    <span className="text-gray-400 ml-1">
                      ({activeModes.filter(mode => paymentMethods[m.id]?.modes?.[mode]).map(mode => MODE_LABELS[mode].icon).join(' ')})
                    </span>
                  )}
                </span>
              ))}
              {PAYMENT_METHODS_META.filter(m => paymentMethods[m.id]?.enabled).length === 0 && (
                <span className="text-xs text-gray-400 italic">Ningún método activado</span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ====== TAB: Datos de Cuenta ====== */}
      {activeTab === 'accounts' && needsAccountsTab && (
        <motion.div
          key="accounts"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-1">Datos de Cuenta</h3>
          <p className="text-sm text-gray-500 mb-4">
            Los clientes verán estos datos para realizar el pago
          </p>

          <div className="space-y-4">
            {/* Nequi */}
            {paymentMethods.nequi.enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📱 Número de Nequi
                </label>
                <input
                  type="text"
                  value={paymentInfo.nequi}
                  onChange={(e) => handlePaymentInfoChange('nequi', e.target.value)}
                  placeholder="Ej: 3001234567"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:border-transparent text-sm transition-all"
                />
              </div>
            )}

            {/* Daviplata */}
            {paymentMethods.daviplata.enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  💜 Número de Daviplata
                </label>
                <input
                  type="text"
                  value={paymentInfo.daviplata}
                  onChange={(e) => handlePaymentInfoChange('daviplata', e.target.value)}
                  placeholder="Ej: 3009876543"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:border-transparent text-sm transition-all"
                />
              </div>
            )}

            {/* Bank Transfer */}
            {paymentMethods.transferencia.enabled && (
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
            )}

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
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium"
          >
            ✅ Configuración guardada exitosamente
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700"
          >
            ⚠️ {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PaymentConfig;

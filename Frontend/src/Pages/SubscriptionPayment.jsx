import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useBusinessSocket } from '../hooks/useBusinessSocket';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaCreditCard, 
  FaUpload, 
  FaCheckCircle, 
  FaTimes, 
  FaClock, 
  FaExclamationTriangle,
  FaCalendarAlt,
  FaMobile,
  FaWallet,
  FaSyncAlt,
  FaTag,
  FaInfoCircle,
  FaChevronRight
} from 'react-icons/fa';

const SubscriptionPayment = () => {
  const { user } = useAuth();
  const { businessId } = useBusinessConfig();
  const navigate = useNavigate();
  const socket = useBusinessSocket(businessId);
  
  const [subscription, setSubscription] = useState(null);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Formulario
  const [formData, setFormData] = useState({
    monthsPurchased: 1,
    amount: 30000, // Precio con descuento: 32,000 - 2,000 = 30,000
    paymentMethod: 'Nequi',
    proof: null
  });
  
  const [errors, setErrors] = useState({});
  
  // Precio base mensual
  const MONTHLY_PRICE = 30000;
  
  // Comisión fija (se suma al total)
  const COMMISSION = 2000;
  
  // Descuento por usar medios de pago manuales
  const PAYMENT_DISCOUNT = 2000;
  
  // Descuentos adicionales por volumen
  const VOLUME_DISCOUNTS = {
    1: 0,      // Sin descuento por volumen
    3: 5000,   // $5,000 de descuento por volumen
    6: 10000,  // $10,000 de descuento por volumen
    12: 15000  // $15,000 de descuento por volumen
  };
  
  // Precios base (meses × precio mensual + comisión)
  const PRICING_BASE = {
    1: (MONTHLY_PRICE * 1) + COMMISSION,    // $30,000 + $2,000 = $32,000
    3: (MONTHLY_PRICE * 3) + COMMISSION,    // $90,000 + $2,000 = $92,000
    6: (MONTHLY_PRICE * 6) + COMMISSION,    // $180,000 + $2,000 = $182,000
    12: (MONTHLY_PRICE * 12) + COMMISSION   // $360,000 + $2,000 = $362,000
  };
  
  // Precios originales sin comisión ni descuentos (para mostrar tachado)
  const PRICING_ORIGINAL = {
    1: MONTHLY_PRICE * 1,    // $30,000
    3: MONTHLY_PRICE * 3,    // $90,000
    6: MONTHLY_PRICE * 6,    // $180,000
    12: MONTHLY_PRICE * 12   // $360,000
  };
  
  // Precios finales con descuentos aplicados
  // Precio base (con comisión) - descuento pago manual - descuento por volumen
  const PRICING = {
    1: PRICING_BASE[1] - PAYMENT_DISCOUNT - VOLUME_DISCOUNTS[1],   // 32,000 - 2,000 - 0 = 30,000
    3: PRICING_BASE[3] - PAYMENT_DISCOUNT - VOLUME_DISCOUNTS[3],   // 92,000 - 2,000 - 5,000 = 85,000
    6: PRICING_BASE[6] - PAYMENT_DISCOUNT - VOLUME_DISCOUNTS[6],   // 182,000 - 2,000 - 10,000 = 170,000
    12: PRICING_BASE[12] - PAYMENT_DISCOUNT - VOLUME_DISCOUNTS[12] // 362,000 - 2,000 - 15,000 = 345,000
  };
  
  // Calcular ahorros por pagar más meses (comparado con pagar mensual)
  const calculateSavings = (months) => {
    if (months === 1) return 0;
    const monthlyPriceWithDiscount = PRICING[1]; // $30,000 (30,000 - 2,000 + 2,000)
    const totalIfMonthly = monthlyPriceWithDiscount * months;
    const actualPrice = PRICING[months];
    const savings = totalIfMonthly - actualPrice;
    return savings > 0 ? savings : 0;
  };
  
  // Calcular descuento total (volumen + pago manual)
  const getTotalDiscount = (months) => {
    return VOLUME_DISCOUNTS[months] + PAYMENT_DISCOUNT;
  };
  
  // Medios de pago
  const PAYMENT_METHODS = [
    { 
      value: 'Nequi', 
      label: 'Nequi', 
      icon: FaMobile, 
      logo: 'https://logos-world.net/wp-content/uploads/2021/03/Nequi-Logo.png',
      details: 'Número: 3028181520',
      code: '@LRQ430'
    },
    { 
      value: 'Daviplata', 
      label: 'Daviplata', 
      icon: FaWallet, 
      logo: 'https://logos-world.net/wp-content/uploads/2021/03/Daviplata-Logo.png',
      details: 'Número: 3028181520',
      code: '@LRQ430'
    },
    { 
      value: 'Transferencia', 
      label: 'Transferencia Bancaria', 
      icon: FaCreditCard, 
      logo: null,
      details: 'Banco: Bancolombia - Cuenta: XXX XXX XXX XXX'
    }
  ];

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Escuchar eventos de socket para actualización en tiempo real
  useEffect(() => {
    if (!socket) return;
    
    const handleSubscriptionActivated = (data) => {
      console.log('Socket: Subscription activated', data);
      // Recargar suscripción y solicitudes
      loadData();
      // Mostrar notificación
      if (data.message) {
        alert(`✅ ${data.message}`);
      }
    };
    
    socket.on('subscription_activated', handleSubscriptionActivated);
    
    return () => {
      socket.off('subscription_activated', handleSubscriptionActivated);
    };
  }, [socket]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadSubscription(),
        loadPaymentRequests()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      // Intentar primero con /api/subscription/me (en paymentRequests.js)
      // Si falla, intentar con /api/subscriptions/me (en subscriptions.js)
      let res;
      try {
        res = await api.get('/subscription/me');
      } catch (error) {
        // Si falla, intentar con el otro endpoint
        if (error.response?.status === 404 || error.response?.status === 403) {
          console.warn('Intentando con /api/subscriptions/me...');
          res = await api.get('/subscriptions/me');
        } else {
          throw error;
        }
      }
      
      if (res.data.success) {
        if (res.data.subscription) {
          setSubscription(res.data.subscription);
        } else {
          // No hay suscripción, eso está bien
          setSubscription(null);
        }
      }
    } catch (error) {
      // Si es 403/401, probablemente el usuario no está autenticado
      // No mostrar error, solo dejar subscription como null
      if (error.response?.status === 403 || error.response?.status === 401) {
        console.warn('Usuario no autenticado o sin permisos para ver suscripción');
      } else {
        console.error('Error loading subscription:', error);
      }
      setSubscription(null);
    }
  };

  const loadPaymentRequests = async () => {
    try {
      const res = await api.get('/payments/manual/my-requests');
      if (res.data.success && res.data.requests) {
        setPaymentRequests(res.data.requests);
      } else {
        setPaymentRequests([]);
      }
    } catch (error) {
      // Si es 404, el endpoint no existe aún (servidor no reiniciado)
      // Si es 403/401, el usuario no está autenticado
      if (error.response?.status === 404) {
        console.warn('Endpoint /payments/manual/my-requests no encontrado. El servidor puede necesitar reiniciarse.');
      } else if (error.response?.status === 403 || error.response?.status === 401) {
        console.warn('Usuario no autenticado o sin permisos para ver solicitudes de pago');
      } else {
        console.error('Error loading payment requests:', error);
      }
      setPaymentRequests([]);
    }
  };

  const handleMonthsChange = (months) => {
    const amount = PRICING[months] || PRICING[1];
    setFormData({ ...formData, monthsPurchased: months, amount });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setErrors({ ...errors, proof: 'Solo se permiten imágenes (JPG, PNG) o PDF' });
        return;
      }
      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, proof: 'El archivo no debe superar 5MB' });
        return;
      }
      setFormData({ ...formData, proof: file });
      setErrors({ ...errors, proof: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar
    if (!formData.proof) {
      setErrors({ ...errors, proof: 'Debes subir un comprobante de pago' });
      return;
    }
    
    // Verificar si hay solicitud pendiente
    const hasPending = paymentRequests.some(req => req.status === 'pending');
    if (hasPending) {
      alert('Ya tienes una solicitud de pago pendiente. Espera a que sea revisada.');
      return;
    }
    
    try {
      setSubmitting(true);
      setErrors({});
      
      const formDataToSend = new FormData();
      
      // Asegurar que todos los valores sean strings
      formDataToSend.append('monthsPurchased', String(formData.monthsPurchased));
      formDataToSend.append('amount', String(formData.amount));
      formDataToSend.append('paymentMethod', String(formData.paymentMethod));
      
      // Asegurar que el archivo se adjunte correctamente
      if (formData.proof) {
        formDataToSend.append('proof', formData.proof);
      } else {
        alert('Error: No se seleccionó ningún archivo de comprobante');
        setSubmitting(false);
        return;
      }
      
      // Incluir businessId si está disponible (necesario para SuperAdmins)
      if (businessId) {
        formDataToSend.append('businessId', String(businessId));
      }
      
      // Log para depuración
      console.log('Enviando solicitud de pago:', {
        monthsPurchased: formData.monthsPurchased,
        amount: formData.amount,
        paymentMethod: formData.paymentMethod,
        hasProof: !!formData.proof,
        proofName: formData.proof?.name,
        proofSize: formData.proof?.size,
        businessId: businessId || 'no disponible'
      });
      
      const res = await api.post('/payments/manual/request', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (res.data.success) {
        setShowSuccessModal(true);
        setFormData({
          monthsPurchased: 1,
          amount: PRICING[1] || 25000,
          paymentMethod: 'Nequi',
          proof: null
        });
        await loadPaymentRequests();
      }
    } catch (error) {
      console.error('Error submitting payment request:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error request data:', {
        monthsPurchased: formData.monthsPurchased,
        amount: formData.amount,
        paymentMethod: formData.paymentMethod,
        hasProof: !!formData.proof,
        hasBusinessId: !!businessId
      });
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Error al enviar la solicitud';
      alert(errorMsg);
      setErrors({ 
        ...errors, 
        submit: errorMsg 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return { color: 'yellow', text: 'En Revisión', icon: FaClock };
      case 'approved':
        return { color: 'green', text: 'Aprobado', icon: FaCheckCircle };
      case 'rejected':
        return { color: 'red', text: 'Rechazado', icon: FaTimes };
      default:
        return { color: 'gray', text: 'Desconocido', icon: FaClock };
    }
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return null;
    
    const now = new Date();
    const periodEnd = subscription.periodEnd ? new Date(subscription.periodEnd) : null;
    const graceUntil = subscription.graceUntil ? new Date(subscription.graceUntil) : null;
    
    if (periodEnd && graceUntil) {
      if (now > graceUntil) {
        return { status: 'suspended', text: 'MENÚ DESACTIVADO', color: 'red' };
      } else if (now > periodEnd) {
        return { status: 'grace', text: 'Período de Gracia', color: 'yellow' };
      }
    }
    return { status: 'active', text: 'Activo', color: 'green' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-slate-400">
        <FaSyncAlt className="animate-spin mr-2 text-xs" /> Cargando...
      </div>
    );
  }

  const subStatus = getSubscriptionStatus();

  return (
    <div className="space-y-3">
      {/* Estado de Suscripción */}
      {subscription && (
        <div className={`rounded-xl border p-3 flex items-center justify-between ${
          subStatus?.color === 'red'
            ? 'bg-red-50 border-red-200'
            : subStatus?.color === 'yellow'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-emerald-50 border-emerald-200'
        }`}>
          <div>
            <p className={`text-xs font-bold ${
              subStatus?.color === 'red' ? 'text-red-700' :
              subStatus?.color === 'yellow' ? 'text-amber-700' :
              'text-emerald-700'
            }`}>
              {subStatus?.text}
            </p>
            {subscription.periodEnd && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {subStatus?.status === 'grace' && subscription.graceDaysRemaining > 0 ? (
                  <>Período de gracia: {subscription.graceDaysRemaining} días restantes</>
                ) : (
                  <>Vence: {new Date(subscription.periodEnd).toLocaleDateString('es-CO')}</>
                )}
              </p>
            )}
          </div>
          <FaCalendarAlt className={`text-sm ${
            subStatus?.color === 'red' ? 'text-red-400' :
            subStatus?.color === 'yellow' ? 'text-amber-400' :
            'text-emerald-400'
          }`} />
        </div>
      )}

      {/* Formulario de Pago */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Renovar Suscripción</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Selecciona la duración</p>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Selector de Meses */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[1, 3, 6, 12].map(months => {
              const savings = calculateSavings(months);
              const isSelected = formData.monthsPurchased === months;
              const totalDiscount = getTotalDiscount(months);
              return (
                <button
                  key={months}
                  type="button"
                  onClick={() => handleMonthsChange(months)}
                  className={`relative p-3 rounded-lg border-2 transition-all text-center ${
                    isSelected
                      ? 'border-slate-800 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    -${totalDiscount.toLocaleString('es-CO')}
                  </div>
                  <div className="text-lg font-bold text-slate-800">{months}</div>
                  <div className="text-[10px] text-slate-400">{months === 1 ? 'mes' : 'meses'}</div>
                  <div className="mt-1.5">
                    {PRICING_BASE[months] !== PRICING[months] && (
                      <div className="text-[10px] text-slate-300 line-through">
                        ${PRICING_BASE[months].toLocaleString('es-CO')}
                      </div>
                    )}
                    <div className="text-xs font-bold text-emerald-600">
                      ${PRICING[months].toLocaleString('es-CO')}
                    </div>
                  </div>
                  {savings > 0 && (
                    <div className="mt-1 text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                      Ahorras ${savings.toLocaleString('es-CO')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Monto Total */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500">Total a Pagar:</span>
              <div className="text-right">
                {PRICING_BASE[formData.monthsPurchased] !== formData.amount && (
                  <div className="text-[10px] text-slate-300 line-through">
                    ${PRICING_BASE[formData.monthsPurchased].toLocaleString('es-CO')}
                  </div>
                )}
                <span className="text-base font-bold text-slate-800">
                  ${formData.amount.toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>
            
            {/* Descuentos aplicados */}
            <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <FaCheckCircle className="text-[8px]" /> Descuento pago manual
                </span>
                <span className="text-emerald-700 font-bold">-${PAYMENT_DISCOUNT.toLocaleString('es-CO')}</span>
              </div>
              {VOLUME_DISCOUNTS[formData.monthsPurchased] > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <FaCheckCircle className="text-[8px]" /> Descuento por volumen
                  </span>
                  <span className="text-emerald-700 font-bold">-${VOLUME_DISCOUNTS[formData.monthsPurchased].toLocaleString('es-CO')}</span>
                </div>
              )}
              {calculateSavings(formData.monthsPurchased) > 0 && (
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold">
                    Ahorras ${calculateSavings(formData.monthsPurchased).toLocaleString('es-CO')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tip de ahorro */}
          {formData.monthsPurchased === 1 && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
              <div className="flex items-start gap-2">
                <FaInfoCircle className="text-xs text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-slate-700 mb-1">Ahorra mas pagando por adelantado</p>
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <p><strong>3 meses:</strong> ${PRICING[3].toLocaleString('es-CO')} (-${getTotalDiscount(3).toLocaleString('es-CO')})</p>
                    <p><strong>6 meses:</strong> ${PRICING[6].toLocaleString('es-CO')} (-${getTotalDiscount(6).toLocaleString('es-CO')})</p>
                    <p><strong>12 meses:</strong> ${PRICING[12].toLocaleString('es-CO')} (-${getTotalDiscount(12).toLocaleString('es-CO')})</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Metodo de Pago */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Metodo de Pago
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            
            {/* Info del metodo seleccionado */}
            <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              {(() => {
                const selectedMethod = PAYMENT_METHODS.find(m => m.value === formData.paymentMethod);
                return (
                  <div className="space-y-1.5">
                    {selectedMethod?.logo && (
                      <div className="flex justify-center mb-2">
                        <img 
                          src={selectedMethod.logo} 
                          alt={selectedMethod.label}
                          className="h-8 object-contain"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                    <p className="text-xs font-semibold text-slate-700">{selectedMethod?.label}</p>
                    <p className="text-[11px] text-slate-600">
                      <span className="font-medium">Numero:</span> {selectedMethod?.details?.replace('Numero: ', '')}
                    </p>
                    {selectedMethod?.code && (
                      <p className="text-[11px] text-slate-600">
                        <span className="font-medium">Llave:</span>{' '}
                        <span className="font-mono bg-white px-1.5 py-0.5 rounded text-[10px] border border-slate-200">{selectedMethod.code}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      Realiza el pago y luego sube el comprobante
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Subir Comprobante */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Comprobante de Pago *
            </label>
            <div className="flex items-center gap-3 p-3 border border-dashed border-slate-300 rounded-lg hover:border-slate-400 transition-colors">
              <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FaUpload className="text-slate-400 text-xs" />
              </div>
              <div className="flex-1 min-w-0">
                <label htmlFor="proof-upload" className="text-xs font-medium text-slate-700 cursor-pointer hover:text-slate-900">
                  {formData.proof ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <FaCheckCircle className="text-[10px]" /> {formData.proof.name}
                    </span>
                  ) : (
                    'Subir archivo'
                  )}
                  <input
                    id="proof-upload"
                    name="proof-upload"
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/jpg,image/png,application/pdf"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="text-[10px] text-slate-400">PNG, JPG, PDF hasta 5MB</p>
              </div>
            </div>
            {errors.proof && (
              <p className="mt-1 text-[11px] text-red-500">{errors.proof}</p>
            )}
          </div>

          {/* Boton Enviar */}
          <button
            type="submit"
            disabled={submitting || !formData.proof}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {submitting ? 'Enviando...' : 'Enviar Comprobante'}
          </button>
        </form>
      </div>

      {/* Historial de Solicitudes */}
      {paymentRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">Mis Solicitudes de Pago</h2>
          </div>
          
          <div className="divide-y divide-slate-100">
            {paymentRequests.map((request) => {
              const badge = getStatusBadge(request.status);
              const BadgeIcon = badge.icon;
              
              return (
                <div key={request._id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <BadgeIcon className={`text-xs text-${badge.color}-500`} />
                        <span className={`text-xs font-semibold text-${badge.color}-700`}>
                          {badge.text}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {request.monthsPurchased} {request.monthsPurchased === 1 ? 'mes' : 'meses'} | 
                        ${request.amount?.toLocaleString('es-CO')} | 
                        {request.paymentMethod}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(request.createdAt).toLocaleString('es-CO')}
                      </p>
                      {request.status === 'rejected' && request.rejectionReason && (
                        <div className="mt-1.5 p-2 bg-red-50 rounded text-[11px] text-red-600">
                          <span className="font-medium">Motivo:</span> {request.rejectionReason}
                        </div>
                      )}
                    </div>
                    <FaChevronRight className="text-[10px] text-slate-300 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de exito */}
      <AnimatePresence>
        {showSuccessModal && (
          <div 
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSuccessModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5"
            >
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                  <FaCheckCircle className="text-emerald-500 text-lg" />
                </div>
                
                <h3 className="text-sm font-bold text-slate-800 mb-1">Solicitud Enviada</h3>
                <p className="text-[11px] text-slate-500 mb-4">
                  Tu solicitud sera revisada por nuestro equipo. Recibiras una notificacion cuando sea procesada.
                </p>
                
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <FaClock className="text-xs text-slate-400 flex-shrink-0" />
                    <p className="text-[11px] text-slate-600">
                      <span className="font-medium">Tiempo estimado:</span> maximo 24 horas
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubscriptionPayment;

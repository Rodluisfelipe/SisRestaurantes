import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useBusinessSocket } from '../hooks/useBusinessSocket';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaCreditCard, 
  FaCheckCircle, 
  FaTimes, 
  FaClock, 
  FaExclamationTriangle,
  FaCalendarAlt,
  FaSyncAlt,
  FaShieldAlt,
  FaLock
} from 'react-icons/fa';

const SubscriptionPayment = () => {
  const { user } = useAuth();
  const { businessId } = useBusinessConfig();
  const [searchParams] = useSearchParams();
  const socket = useBusinessSocket(businessId);
  
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [epaycoConfig, setEpaycoConfig] = useState({ publicKey: '', isTest: false });
  const [paymentResult, setPaymentResult] = useState(null);
  const [epaycoReady, setEpaycoReady] = useState(false);
  
  // Verificar resultado de pago (redirect de ePayco)
  useEffect(() => {
    const ref = searchParams.get('ref');
    const status = searchParams.get('status');
    
    if (ref) {
      checkPaymentStatus(ref, status);
    }
  }, [searchParams]);

  // Cargar script de ePayco
  useEffect(() => {
    if (document.getElementById('epayco-script')) {
      setEpaycoReady(true);
      return;
    }
    
    const script = document.createElement('script');
    script.id = 'epayco-script';
    script.src = 'https://checkout.epayco.co/checkout.js';
    script.async = true;
    script.onload = () => setEpaycoReady(true);
    script.onerror = () => console.error('Error loading ePayco script');
    document.head.appendChild(script);
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Socket: escuchar activación de suscripción
  useEffect(() => {
    if (!socket) return;
    
    const handleActivated = (data) => {
      setPaymentResult({
        status: 'approved',
        message: data.message || '¡Tu suscripción ha sido activada!',
      });
      loadSubscription();
    };
    
    socket.on('subscription_activated', handleActivated);
    return () => socket.off('subscription_activated', handleActivated);
  }, [socket]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadSubscription(), loadPlans()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      let res;
      try {
        res = await api.get('/subscription/me');
      } catch (error) {
        if (error.response?.status === 404 || error.response?.status === 403) {
          res = await api.get('/subscriptions/me');
        } else {
          throw error;
        }
      }
      
      if (res.data.success && res.data.subscription) {
        setSubscription(res.data.subscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      if (error.response?.status !== 403 && error.response?.status !== 401) {
        console.error('Error loading subscription:', error);
      }
      setSubscription(null);
    }
  };

  const loadPlans = async () => {
    try {
      const res = await api.get('/epayco/plans');
      if (res.data.success) {
        setPlans(res.data.plans);
        setEpaycoConfig({
          publicKey: res.data.publicKey,
          isTest: res.data.isTest,
        });
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };

  const checkPaymentStatus = async (ref, statusCode) => {
    try {
      const res = await api.get(`/epayco/status/${ref}`);
      if (res.data.success) {
        const { payment } = res.data;
        if (payment.status === 'approved') {
          setPaymentResult({
            status: 'approved',
            message: `¡Pago aprobado! Tu suscripción de ${payment.months} mes(es) está activa.`,
            reference: payment.reference,
          });
          await loadSubscription();
        } else if (payment.status === 'pending') {
          setPaymentResult({
            status: 'pending',
            message: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
            reference: payment.reference,
          });
        } else {
          setPaymentResult({
            status: 'failed',
            message: payment.responseMessage || 'El pago no fue aprobado. Intenta de nuevo.',
            reference: payment.reference,
          });
        }
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      const code = parseInt(statusCode);
      if (code === 1) {
        setPaymentResult({ status: 'approved', message: '¡Pago procesado! Verificando activación...' });
        await loadSubscription();
      } else if (code === 3) {
        setPaymentResult({ status: 'pending', message: 'Pago pendiente de confirmación.' });
      } else {
        setPaymentResult({ status: 'failed', message: 'El pago no fue completado.' });
      }
    }
  };

  const handlePayWithEpayco = async () => {
    if (!epaycoReady || !window.ePayco) {
      alert('Cargando pasarela de pagos, intenta en un momento...');
      return;
    }
    
    setProcessing(true);
    
    try {
      const res = await api.post('/epayco/create', { months: selectedMonths, businessId });
      
      if (!res.data.success) {
        alert(res.data.message || 'Error al crear el pago');
        return;
      }
      
      const { checkoutData } = res.data;
      
      const handler = window.ePayco.checkout.configure({
        key: checkoutData.key,
        test: checkoutData.test,
      });
      
      handler.open({
        name: checkoutData.name,
        description: checkoutData.description,
        invoice: checkoutData.invoice,
        currency: checkoutData.currency,
        amount: checkoutData.amount,
        tax_base: checkoutData.tax_base,
        tax: checkoutData.tax,
        tax_ico: checkoutData.tax_ico,
        country: checkoutData.country,
        lang: checkoutData.lang,
        external: checkoutData.external,
        confirmation: checkoutData.confirmation,
        response: checkoutData.response,
        extra1: checkoutData.extra1,
        extra2: checkoutData.extra2,
        extra3: checkoutData.extra3,
      });
      
    } catch (error) {
      console.error('Error initiating ePayco payment:', error);
      alert(error.response?.data?.message || 'Error al iniciar el pago');
    } finally {
      setProcessing(false);
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

  const selectedPlan = plans.find(p => p.months === selectedMonths);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-slate-400">
        <FaSyncAlt className="animate-spin mr-2 text-xs" /> Cargando...
      </div>
    );
  }

  const subStatus = getSubscriptionStatus();

  // ==========================================
  // PANTALLA COMPLETA DE RESULTADO DE PAGO
  // ==========================================
  if (paymentResult) {
    const isApproved = paymentResult.status === 'approved';
    const isPending = paymentResult.status === 'pending';
    
    return (
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg"
        >
          {/* Header con icono grande */}
          <div className={`px-6 py-8 text-center ${
            isApproved ? 'bg-gradient-to-br from-emerald-50 to-emerald-100' :
            isPending ? 'bg-gradient-to-br from-amber-50 to-amber-100' :
            'bg-gradient-to-br from-red-50 to-red-100'
          }`}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                isApproved ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' :
                isPending ? 'bg-amber-500 shadow-lg shadow-amber-500/30' :
                'bg-red-500 shadow-lg shadow-red-500/30'
              }`}
            >
              {isApproved ? (
                <FaCheckCircle className="text-white text-2xl" />
              ) : isPending ? (
                <FaClock className="text-white text-2xl" />
              ) : (
                <FaTimes className="text-white text-2xl" />
              )}
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`text-xl font-bold ${
                isApproved ? 'text-emerald-800' :
                isPending ? 'text-amber-800' :
                'text-red-800'
              }`}
            >
              {isApproved ? '¡Pago Exitoso!' :
               isPending ? 'Pago en Proceso' :
               'Pago No Completado'}
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-sm text-slate-600 mt-2 max-w-xs mx-auto"
            >
              {paymentResult.message}
            </motion.p>
          </div>

          {/* Detalles */}
          <div className="px-6 py-5 space-y-3">
            {isApproved && subscription && (
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Estado</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    ✓ Activa
                  </span>
                </div>
                {subscription.periodEnd && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Vigente hasta</span>
                    <span className="text-xs font-bold text-slate-700">
                      {new Date(subscription.periodEnd).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                {subscription.lastMonthsPurchased && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Plan</span>
                    <span className="text-xs font-bold text-slate-700">
                      {subscription.lastMonthsPurchased} {subscription.lastMonthsPurchased === 1 ? 'mes' : 'meses'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {isPending && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                <div className="flex items-start gap-3">
                  <FaSyncAlt className="text-amber-500 text-sm mt-0.5 animate-spin" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">Esperando confirmación</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Tu pago está siendo procesado por la entidad financiera. 
                      Esta página se actualizará automáticamente cuando se confirme.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {paymentResult.reference && (
              <div className="flex justify-between items-center py-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400">Referencia</span>
                <span className="text-[10px] text-slate-500 font-mono">{paymentResult.reference}</span>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="px-6 pb-6 space-y-2">
            {isApproved && (
              <button
                onClick={() => {
                  setPaymentResult(null);
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className="w-full py-3 px-4 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-slate-900/20"
              >
                Continuar al Panel
              </button>
            )}

            {!isApproved && (
              <>
                <button
                  onClick={() => {
                    setPaymentResult(null);
                    window.history.replaceState({}, '', window.location.pathname);
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-slate-900/20"
                >
                  {isPending ? 'Volver' : 'Intentar de Nuevo'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // VISTA NORMAL - SELECCIÓN DE PLAN Y PAGO
  // ==========================================

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
                ) : subStatus?.status === 'suspended' ? (
                  <>Venció: {new Date(subscription.periodEnd).toLocaleDateString('es-CO')}</>
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
          <h2 className="text-sm font-bold text-slate-800">
            {subscription ? 'Renovar Suscripción' : 'Activar Suscripción'}
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Selecciona la duración y paga en línea</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Selector de Plan */}
          {plans.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {plans.map(plan => {
                const isSelected = selectedMonths === plan.months;
                const savingsVsMonthly = plan.months > 1 
                  ? (plans[0]?.total * plan.months) - plan.total 
                  : 0;
                
                return (
                  <button
                    key={plan.months}
                    type="button"
                    onClick={() => setSelectedMonths(plan.months)}
                    className={`relative p-3 rounded-lg border-2 transition-all text-center ${
                      isSelected
                        ? 'border-slate-800 bg-slate-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-lg font-bold text-slate-800">{plan.months}</div>
                    <div className="text-[10px] text-slate-400">{plan.months === 1 ? 'mes' : 'meses'}</div>
                    <div className="mt-1.5">
                      <div className="text-xs font-bold text-slate-800">
                        ${plan.total.toLocaleString('es-CO')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ${plan.pricePerMonth.toLocaleString('es-CO')}/mes
                      </div>
                    </div>
                    {savingsVsMonthly > 0 && (
                      <div className="mt-1 text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                        Ahorras ${savingsVsMonthly.toLocaleString('es-CO')}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400">
              <FaExclamationTriangle className="mx-auto text-lg text-amber-400 mb-2" />
              <p>No se pudieron cargar los planes.</p>
              <button 
                onClick={loadPlans} 
                className="mt-2 text-blue-500 hover:underline text-[11px]"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Detalle del plan seleccionado */}
          {selectedPlan && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500">Suscripción {selectedPlan.label}</span>
                <span className="text-[11px] text-slate-700">${selectedPlan.basePrice.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500">Comisión pasarela de pago</span>
                <span className="text-[11px] text-slate-400">+${selectedPlan.commission.toLocaleString('es-CO')}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">Total a pagar</span>
                <span className="text-base font-bold text-slate-800">
                  ${selectedPlan.total.toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>
          )}

          {/* Botón de pago */}
          {selectedPlan && (
            <button
              type="button"
              onClick={handlePayWithEpayco}
              disabled={processing || !epaycoReady}
              className="w-full py-3 px-4 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black disabled:from-slate-300 disabled:to-slate-400 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <FaSyncAlt className="animate-spin text-xs" />
                  <span>Preparando pago...</span>
                </>
              ) : (
                <>
                  <FaLock className="text-xs" />
                  <span>Pagar ${selectedPlan.total.toLocaleString('es-CO')} COP</span>
                </>
              )}
            </button>
          )}

          {/* Badge de seguridad */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <FaShieldAlt className="text-emerald-400" />
              <span>Pago seguro</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <FaCreditCard className="text-slate-300" />
              <span>Tarjeta, PSE, Nequi, Daviplata</span>
            </div>
          </div>

          {/* Logo ePayco */}
          <div className="flex justify-center pt-1">
            <img 
              src="https://369969691f476073508a-60bf0867add971908d4f26a64519c2aa.ssl.cf5.rackcdn.com/btns/epayco/pagos-procesados-por-epayco-dark-64.png"
              alt="Pagos procesados por ePayco"
              className="h-5 opacity-50"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          {/* Modo test badge */}
          {epaycoConfig.isTest && (
            <div className="flex justify-center">
              <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                MODO PRUEBAS
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPayment;

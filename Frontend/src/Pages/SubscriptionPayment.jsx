import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useBusinessSocket } from '../hooks/useBusinessSocket';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

const SubscriptionPayment = () => {
  const { user } = useAuth();
  const { businessId } = useBusinessConfig();
  const [searchParams] = useSearchParams();
  const socket = useBusinessSocket(businessId);
  
  const [subscription, setSubscription] = useState(null);
  const [epaycoPlans, setEpaycoPlans] = useState([]);
  const [dlocalPlans, setDlocalPlans] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [selectedGateway, setSelectedGateway] = useState('dlocal'); // 'epayco' | 'dlocal'
  const [epaycoConfig, setEpaycoConfig] = useState({ publicKey: '', isTest: false });
  const [dlocalConfig, setDlocalConfig] = useState({ isTest: false });
  const [paymentResult, setPaymentResult] = useState(null);
  const [activeTab, setActiveTab] = useState('plan'); // 'plan' | 'history'
  
  // Verificar resultado de pago (redirect de ePayco)
  useEffect(() => {
    const ref = searchParams.get('ref');
    const status = searchParams.get('status');
    if (ref) checkPaymentStatus(ref, status);
  }, [searchParams]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handleActivated = (data) => {
      setPaymentResult({
        status: 'approved',
        message: data.message || '¡Tu suscripción ha sido activada!',
      });
      loadSubscription();
      loadPaymentHistory();
    };
    socket.on('subscription_activated', handleActivated);
    return () => socket.off('subscription_activated', handleActivated);
  }, [socket]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadSubscription(), loadEpaycoPlans(), loadDlocalPlans(), loadPaymentHistory()]);
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
        } else throw error;
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

  const loadEpaycoPlans = async () => {
    try {
      const res = await api.get('/epayco/plans');
      if (res.data.success) {
        setEpaycoPlans(res.data.plans);
        setEpaycoConfig({ publicKey: res.data.publicKey, isTest: res.data.isTest });
      }
    } catch (error) {
      console.error('Error loading ePayco plans:', error);
    }
  };

  const loadDlocalPlans = async () => {
    try {
      const res = await api.get('/dlocal/plans');
      if (res.data.success) {
        setDlocalPlans(res.data.plans);
        setDlocalConfig({ isTest: res.data.isTest });
      }
    } catch (error) {
      console.error('Error loading dLocal plans:', error);
    }
  };

  const loadPaymentHistory = async () => {
    try {
      const [epaycoRes, dlocalRes] = await Promise.all([
        api.get('/epayco/history').catch(() => ({ data: { payments: [] } })),
        api.get('/dlocal/history').catch(() => ({ data: { payments: [] } })),
      ]);
      const all = [
        ...(epaycoRes.data.payments || []).map(p => ({ ...p, gateway: 'ePayco' })),
        ...(dlocalRes.data.payments || []).map(p => ({ ...p, gateway: 'dLocal' })),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPaymentHistory(all);
    } catch (error) {
      console.error('Error loading payment history:', error);
    }
  };

  const checkPaymentStatus = async (ref, statusCode) => {
    // Intentar con ambas pasarelas
    const gw = searchParams.get('gw');
    const endpoints = gw === 'dlocal' ? ['/dlocal/status/', '/epayco/status/'] : ['/epayco/status/', '/dlocal/status/'];
    
    for (const endpoint of endpoints) {
      try {
        const res = await api.get(`${endpoint}${ref}`);
        if (res.data.success) {
          const { payment } = res.data;
          if (payment.status === 'approved') {
            setPaymentResult({ status: 'approved', message: `¡Pago aprobado! Tu suscripción de ${payment.months} mes(es) está activa.`, reference: payment.reference });
            await loadSubscription();
          } else if (payment.status === 'pending') {
            setPaymentResult({ status: 'pending', message: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.', reference: payment.reference });
          } else {
            setPaymentResult({ status: 'failed', message: payment.responseMessage || 'El pago no fue aprobado. Intenta de nuevo.', reference: payment.reference });
          }
          return;
        }
      } catch (e) { /* try next */ }
    }
    // Fallback por código
    const code = parseInt(statusCode);
    if (code === 1) {
      setPaymentResult({ status: 'approved', message: '¡Pago procesado! Verificando activación...' });
      await loadSubscription();
    } else if (code === 3) {
      setPaymentResult({ status: 'pending', message: 'Pago pendiente de confirmación.' });
    } else {
      setPaymentResult({ status: 'failed', message: 'El pago no fue completado.' });
    }
  };

  const handlePayWithEpayco = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const res = await api.post('/epayco/create', { months: selectedMonths, businessId });
      if (!res.data.success) { alert(res.data.message || 'Error al crear el pago'); return; }
      const { checkoutData } = res.data;

      const oldScript = document.getElementById('epayco-script');
      if (oldScript) { oldScript.remove(); delete window.ePayco; }
      
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.id = 'epayco-script';
        script.src = 'https://checkout.epayco.co/checkout.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Error cargando ePayco'));
        document.head.appendChild(script);
      });
      
      if (!window.ePayco) throw new Error('ePayco SDK no disponible');

      // Guardar sesión antes del redirect
      const t = sessionStorage.getItem('accessToken');
      const r = sessionStorage.getItem('refreshToken');
      const u = sessionStorage.getItem('user');
      if (t) localStorage.setItem('accessToken', t);
      if (r) localStorage.setItem('refreshToken', r);
      if (u) localStorage.setItem('user', u);
      
      const handler = window.ePayco.checkout.configure({ key: checkoutData.key, test: checkoutData.test });
      handler.open({
        name: checkoutData.name, description: checkoutData.description,
        invoice: checkoutData.invoice, currency: checkoutData.currency,
        amount: checkoutData.amount, tax_base: checkoutData.tax_base,
        tax: checkoutData.tax, tax_ico: checkoutData.tax_ico,
        country: checkoutData.country, lang: checkoutData.lang,
        external: checkoutData.external, confirmation: checkoutData.confirmation,
        response: checkoutData.response, extra1: checkoutData.extra1,
        extra2: checkoutData.extra2, extra3: checkoutData.extra3,
      });
    } catch (error) {
      console.error('Error initiating ePayco payment:', error);
      alert(error.response?.data?.message || error.message || 'Error al iniciar el pago');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayWithDlocal = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      // Guardar sesión antes del redirect
      const t = sessionStorage.getItem('accessToken');
      const r = sessionStorage.getItem('refreshToken');
      const u = sessionStorage.getItem('user');
      if (t) localStorage.setItem('accessToken', t);
      if (r) localStorage.setItem('refreshToken', r);
      if (u) localStorage.setItem('user', u);

      const res = await api.post('/dlocal/create', { months: selectedMonths, businessId });
      if (!res.data.success) { alert(res.data.message || 'Error al crear el pago'); return; }

      if (res.data.redirectUrl) {
        window.location.href = res.data.redirectUrl;
      } else {
        alert('No se recibió URL de pago de dLocal');
      }
    } catch (error) {
      console.error('Error initiating dLocal payment:', error);
      alert(error.response?.data?.message || error.message || 'Error al iniciar el pago con dLocal');
    } finally {
      setProcessing(false);
    }
  };

  const handlePay = () => {
    if (selectedGateway === 'dlocal') {
      handlePayWithDlocal();
    } else {
      handlePayWithEpayco();
    }
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return null;
    const now = new Date();
    const periodEnd = subscription.periodEnd ? new Date(subscription.periodEnd) : null;
    const graceUntil = subscription.graceUntil ? new Date(subscription.graceUntil) : null;
    if (periodEnd && graceUntil) {
      if (now > graceUntil) return { status: 'suspended', text: 'Menú Desactivado', color: 'red' };
      if (now > periodEnd) return { status: 'grace', text: 'Período de Gracia', color: 'yellow' };
    }
    return { status: 'active', text: 'Activa', color: 'green' };
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const formatCurrency = (n) => `$${(n || 0).toLocaleString('es-CO')}`;

  const plans = selectedGateway === 'dlocal' ? dlocalPlans : epaycoPlans;
  const selectedPlan = plans.find(p => p.months === selectedMonths);
  const isTestMode = selectedGateway === 'dlocal' ? dlocalConfig.isTest : epaycoConfig.isTest;
  const subStatus = getSubscriptionStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-[#3A7AFF]/30 border-t-[#3A7AFF] rounded-full animate-spin" />
      </div>
    );
  }

  // ==========================================
  // RESULTADO DE PAGO
  // ==========================================
  if (paymentResult) {
    const isApproved = paymentResult.status === 'approved';
    const isPending = paymentResult.status === 'pending';
    
    return (
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-[#DCE4F5] overflow-hidden shadow-lg">
          <div className={`px-6 py-8 text-center ${
            isApproved ? 'bg-emerald-50' : isPending ? 'bg-amber-50' : 'bg-red-50'
          }`}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                isApproved ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-red-500'
              }`}>
              {isApproved ? (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              ) : isPending ? (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ) : (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </motion.div>
            <h2 className={`text-xl font-bold ${isApproved ? 'text-emerald-800' : isPending ? 'text-amber-800' : 'text-red-800'}`}>
              {isApproved ? '¡Pago Exitoso!' : isPending ? 'Pago en Proceso' : 'Pago No Completado'}
            </h2>
            <p className="text-sm text-[#6C7A92] mt-2 max-w-xs mx-auto">{paymentResult.message}</p>
          </div>

          <div className="px-6 py-5 space-y-3">
            {isApproved && subscription && (
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 space-y-2">
                <div className="flex justify-between"><span className="text-xs text-[#6C7A92]">Estado</span><span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Activa</span></div>
                {subscription.periodEnd && <div className="flex justify-between"><span className="text-xs text-[#6C7A92]">Vigente hasta</span><span className="text-xs font-bold text-[#1F2937]">{formatDate(subscription.periodEnd)}</span></div>}
              </div>
            )}
            {isPending && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 flex items-start gap-3">
                <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mt-0.5 flex-shrink-0" />
                <div><p className="text-xs font-bold text-amber-700">Esperando confirmación</p><p className="text-[11px] text-[#6C7A92] mt-1">Se actualizará automáticamente cuando se confirme.</p></div>
              </div>
            )}
            {paymentResult.reference && (
              <div className="flex justify-between items-center py-2 border-t border-[#DCE4F5]">
                <span className="text-[10px] text-[#6C7A92]">Referencia</span>
                <span className="text-[10px] text-[#6C7A92] font-mono">{paymentResult.reference}</span>
              </div>
            )}
          </div>

          <div className="px-6 pb-6">
            <button onClick={() => { setPaymentResult(null); window.history.replaceState({}, '', window.location.pathname); loadPaymentHistory(); }}
              className="w-full py-3 px-4 bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-[#3A7AFF]/20">
              {isApproved ? 'Continuar' : isPending ? 'Volver' : 'Intentar de Nuevo'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // VISTA PRINCIPAL
  // ==========================================
  return (
    <div className="space-y-3">
      
      {/* MODO PRUEBAS Badge */}
      {isTestMode && (
        <div className="flex justify-center">
          <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold tracking-wide">
            MODO PRUEBAS — {selectedGateway === 'dlocal' ? 'dLocal' : 'ePayco'}
          </span>
        </div>
      )}

      {/* ==========================================
          SUSCRIPCIÓN ACTUAL — Compact inline  
          ========================================== */}
      <div className="bg-white rounded-xl border border-[#DCE4F5] overflow-hidden shadow-sm">
        <div className="px-3.5 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#1F2937]">Suscripción</h3>
            {subStatus ? (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                subStatus.color === 'green' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                subStatus.color === 'yellow' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-red-50 text-red-700 border border-red-200'
              }`}>{subStatus.text}</span>
            ) : (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-[#6C7A92] border border-[#DCE4F5]">Sin plan</span>
            )}
          </div>

          {subscription ? (
            <>
              {/* Compact progress bar */}
              {subscription.periodStart && subscription.periodEnd && (
                <div className="mt-2">
                  <div className="h-1.5 bg-[#F4F6FB] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(2, ((Date.now() - new Date(subscription.periodStart).getTime()) / (new Date(subscription.periodEnd).getTime() - new Date(subscription.periodStart).getTime())) * 100))}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        subStatus?.color === 'green' ? 'bg-emerald-400' :
                        subStatus?.color === 'yellow' ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                    />
                  </div>
                </div>
              )}
              
              {/* Single row of key info */}
              <div className="mt-2 flex items-center gap-3 text-[10px] text-[#6C7A92]">
                <span>
                  <span className="font-semibold text-[#1F2937]">
                    {subscription.lastMonthsPurchased 
                      ? `${subscription.lastMonthsPurchased} ${subscription.lastMonthsPurchased === 1 ? 'mes' : 'meses'}`
                      : subscription.planType === 'annual' ? 'Anual' : 'Mensual'}
                  </span>
                </span>
                <span className="text-[#DCE4F5]">|</span>
                <span>Vence <span className="font-semibold text-[#1F2937]">{formatDate(subscription.periodEnd)}</span></span>
                {subscription.price && (
                  <>
                    <span className="text-[#DCE4F5]">|</span>
                    <span className="font-semibold text-[#1F2937]">{formatCurrency(subscription.price)}</span>
                  </>
                )}
              </div>

              {/* Grace/Suspended compact warnings */}
              {subStatus?.status === 'grace' && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span>Período de gracia — {subscription.graceDaysRemaining > 0 ? `${subscription.graceDaysRemaining} día(s)` : 'Renueva ahora'}</span>
                </div>
              )}
              {subStatus?.status === 'suspended' && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 border border-red-200">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <span>Menú desactivado — Renueva para reactivar</span>
                </div>
              )}
            </>
          ) : (
            <p className="mt-1 text-[10px] text-[#6C7A92]">Activa un plan para publicar tu menú digital</p>
          )}
        </div>
      </div>

      {/* ==========================================
          TABS: RENOVAR / HISTORIAL
          ========================================== */}
      <div className="bg-white rounded-xl border border-[#DCE4F5] overflow-hidden shadow-sm">
        {/* Tab headers */}
        <div className="flex border-b border-[#DCE4F5]">
          <button onClick={() => setActiveTab('plan')}
            className={`flex-1 py-2 text-[11px] font-semibold transition-all relative ${activeTab === 'plan' ? 'text-[#3A7AFF]' : 'text-[#6C7A92]'}`}>
            {subscription ? 'Renovar' : 'Activar Plan'}
            {activeTab === 'plan' && <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#3A7AFF] rounded-full" />}
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-[11px] font-semibold transition-all relative ${activeTab === 'history' ? 'text-[#3A7AFF]' : 'text-[#6C7A92]'}`}>
            Historial {paymentHistory.length > 0 && <span className="ml-0.5 text-[8px] bg-[#F4F6FB] text-[#6C7A92] px-1 py-0.5 rounded-full">{paymentHistory.length}</span>}
            {activeTab === 'history' && <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#3A7AFF] rounded-full" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* ==========================================
              TAB: PLAN + PASARELA + PAGAR (all compact)
              ========================================== */}
          {activeTab === 'plan' && (
            <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-3.5 space-y-3">
              
              {/* Plan selector — horizontal row */}
              {plans.length > 0 ? (
                <div className="flex gap-1.5">
                  {plans.map(plan => {
                    const isSelected = selectedMonths === plan.months;
                    const savingsVsMonthly = plan.months > 1 ? (plans[0]?.total * plan.months) - plan.total : 0;
                    const isBestValue = plan.months === 12;
                    
                    return (
                      <button key={plan.months} type="button" onClick={() => setSelectedMonths(plan.months)}
                        className={`relative flex-1 py-2 px-1 rounded-lg border transition-all text-center ${
                          isSelected
                            ? 'border-[#3A7AFF] bg-[#3A7AFF]/5 shadow-sm'
                            : 'border-[#DCE4F5] hover:border-[#3A7AFF]/30'
                        }`}>
                        {isBestValue && (
                          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-bold bg-[#3A7AFF] text-white px-1.5 py-px rounded-full whitespace-nowrap leading-tight">
                            MEJOR
                          </div>
                        )}
                        <div className={`text-sm font-bold leading-none ${isSelected ? 'text-[#3A7AFF]' : 'text-[#1F2937]'}`}>{plan.months}</div>
                        <div className="text-[8px] text-[#6C7A92] leading-tight">{plan.months === 1 ? 'mes' : 'meses'}</div>
                        <div className={`text-[10px] font-bold mt-0.5 leading-none ${isSelected ? 'text-[#3A7AFF]' : 'text-[#1F2937]'}`}>
                          {formatCurrency(plan.total)}
                        </div>
                        {savingsVsMonthly > 0 && (
                          <div className="text-[7px] text-emerald-600 font-semibold mt-0.5 leading-tight">
                            -{formatCurrency(savingsVsMonthly)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[11px] text-[#6C7A92]">No se pudieron cargar los planes</p>
                  <button onClick={loadData} className="text-[#3A7AFF] text-[10px] font-medium mt-1">Reintentar</button>
                </div>
              )}

              {/* Gateway selector — compact toggle */}
              {plans.length > 0 && (
                <div className="flex items-center gap-1.5 bg-[#F4F6FB] rounded-lg p-1">
                  <button type="button" onClick={() => setSelectedGateway('dlocal')}
                    className={`flex-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      selectedGateway === 'dlocal' ? 'bg-white text-[#3A7AFF] shadow-sm' : 'text-[#6C7A92]'
                    }`}>
                    <span>dLocal</span>
                    <span className="font-bold">{formatCurrency(dlocalPlans.find(p => p.months === selectedMonths)?.total || 0)}</span>
                    {selectedGateway !== 'dlocal' && <span className="text-[8px] text-emerald-600 font-semibold">Menor costo</span>}
                  </button>
                  <button type="button" onClick={() => setSelectedGateway('epayco')}
                    className={`flex-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      selectedGateway === 'epayco' ? 'bg-white text-[#3A7AFF] shadow-sm' : 'text-[#6C7A92]'
                    }`}>
                    <span>ePayco</span>
                    <span className="font-bold">{formatCurrency(epaycoPlans.find(p => p.months === selectedMonths)?.total || 0)}</span>
                  </button>
                </div>
              )}

              {/* Desglose + Botón pagar — merged compact */}
              {selectedPlan && (
                <div className="bg-[#F4F6FB] rounded-lg p-3">
                  <div className="flex items-center justify-between text-[10px] text-[#6C7A92]">
                    <span>{selectedPlan.label} ({formatCurrency(selectedPlan.basePrice)}) + comisión {formatCurrency(selectedPlan.commission)}</span>
                    <span className="text-sm font-bold text-[#1F2937]">{formatCurrency(selectedPlan.total)}</span>
                  </div>
                </div>
              )}

              {/* Botón pagar — compact */}
              {selectedPlan && (
                <button type="button" onClick={handlePay} disabled={processing}
                  className="w-full py-2.5 bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 disabled:bg-[#DCE4F5] disabled:text-[#6C7A92] text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-[#3A7AFF]/20 disabled:shadow-none flex items-center justify-center gap-1.5">
                  {processing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Pagar {formatCurrency(selectedPlan.total)} COP</span>
                    </>
                  )}
                </button>
              )}

              {/* Métodos — single compact line */}
              <p className="text-center text-[9px] text-[#6C7A92]/60">
                Tarjeta · PSE · Nequi · Daviplata · Pago seguro
              </p>
            </motion.div>
          )}

          {/* ==========================================
              TAB: HISTORIAL DE PAGOS
              ========================================== */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-3.5">
              
              {paymentHistory.length === 0 ? (
                <div className="text-center py-6">
                  <svg className="w-8 h-8 mx-auto text-[#DCE4F5] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-[11px] text-[#6C7A92]">Sin historial de pagos</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {paymentHistory.map((payment, i) => {
                    const statusColors = {
                      approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'OK' },
                      pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Pend.' },
                      rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Rech.' },
                      failed: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Falló' },
                      reversed: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', label: 'Rev.' },
                      cancelled: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', label: 'Canc.' },
                      created: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Nuevo' },
                    };
                    const s = statusColors[payment.status] || statusColors.created;
                    
                    return (
                      <div key={payment._id || i}
                        className="flex items-center justify-between bg-[#F4F6FB] rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>
                          <div>
                            <span className="text-[11px] font-semibold text-[#1F2937]">{payment.months} {payment.months === 1 ? 'mes' : 'meses'}</span>
                            <span className="text-[9px] text-[#6C7A92] ml-1.5">{formatDate(payment.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {payment.gateway && (
                            <span className={`text-[8px] font-medium px-1 py-0.5 rounded ${
                              payment.gateway === 'dLocal' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                            }`}>{payment.gateway}</span>
                          )}
                          <span className="text-[11px] font-bold text-[#1F2937]">{formatCurrency(payment.totalAmount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SubscriptionPayment;

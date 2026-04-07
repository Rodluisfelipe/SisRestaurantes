import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useBusinessSocket } from '../hooks/useBusinessSocket';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

// Planes de pago directo (sin comisión de pasarela, con descuento por duración)
const DIRECT_PLANS = [
  { months: 1, label: '1 Mes', basePrice: 30000, total: 30000, commission: 0, pricePerMonth: 30000, discount: 0 },
  { months: 3, label: '3 Meses', basePrice: 90000, total: 85500, commission: 0, pricePerMonth: 28500, discount: 5 },
  { months: 6, label: '6 Meses', basePrice: 180000, total: 162000, commission: 0, pricePerMonth: 27000, discount: 10 },
  { months: 12, label: '12 Meses', basePrice: 360000, total: 306000, commission: 0, pricePerMonth: 25500, discount: 15 },
];

// Métodos de pago directo
const DIRECT_METHODS = [
  { id: 'Nequi', label: 'Nequi', value: '302 818 1520', icon: '\uD83D\uDCF1' },
  { id: 'Daviplata', label: 'Daviplata', value: '302 818 1520', icon: '\uD83D\uDCB3' },
  { id: 'Transferencia', label: 'Llave Breve', value: '@LRQ430', icon: '\uD83D\uDD11' },
];

const SubscriptionPayment = () => {
  const { user } = useAuth();
  const { businessId } = useBusinessConfig();
  const [searchParams] = useSearchParams();
  const socket = useBusinessSocket(businessId);
  const fileInputRef = useRef(null);
  
  const [subscription, setSubscription] = useState(null);
  const [epaycoPlans, setEpaycoPlans] = useState([]);
  const [dlocalPlans, setDlocalPlans] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [selectedGateway, setSelectedGateway] = useState('direct'); // 'direct' | 'epayco' | 'dlocal'
  const [epaycoConfig, setEpaycoConfig] = useState({ publicKey: '', isTest: false });
  const [dlocalConfig, setDlocalConfig] = useState({ isTest: false });
  const [paymentResult, setPaymentResult] = useState(null);
  const [activeTab, setActiveTab] = useState('plan'); // 'plan' | 'history'
  
  // Direct payment state
  const [selectedMethod, setSelectedMethod] = useState('Nequi');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [copiedMethod, setCopiedMethod] = useState(null);
  
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
        message: data.message || '\u00A1Tu suscripci\u00F3n ha sido activada!',
      });
      loadSubscription();
      loadPaymentHistory();
      loadMyRequests();
    };
    socket.on('subscription_activated', handleActivated);
    return () => socket.off('subscription_activated', handleActivated);
  }, [socket]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadSubscription(), loadMyRequests(), loadEpaycoPlans(), loadDlocalPlans(), loadPaymentHistory()]);
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

  const loadMyRequests = async () => {
    try {
      const res = await api.get('/payments/manual/my-requests');
      if (res.data.success) {
        setMyRequests(res.data.requests || []);
      }
    } catch (error) {
      console.error('Error loading my requests:', error);
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
      // Silently fail — gateway not configured
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
      // Silently fail — gateway not configured
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
    const gw = searchParams.get('gw');
    const endpoints = gw === 'dlocal' ? ['/dlocal/status/', '/epayco/status/'] : ['/epayco/status/', '/dlocal/status/'];
    
    for (const endpoint of endpoints) {
      try {
        const res = await api.get(`${endpoint}${ref}`);
        if (res.data.success) {
          const { payment } = res.data;
          if (payment.status === 'approved') {
            setPaymentResult({ status: 'approved', message: `\u00A1Pago aprobado! Tu suscripci\u00F3n de ${payment.months} mes(es) est\u00E1 activa.`, reference: payment.reference });
            await loadSubscription();
          } else if (payment.status === 'pending') {
            setPaymentResult({ status: 'pending', message: 'Tu pago est\u00E1 siendo procesado. Te notificaremos cuando se confirme.', reference: payment.reference });
          } else {
            setPaymentResult({ status: 'failed', message: payment.responseMessage || 'El pago no fue aprobado. Intenta de nuevo.', reference: payment.reference });
          }
          return;
        }
      } catch (e) { /* try next */ }
    }
    const code = parseInt(statusCode);
    if (code === 1) {
      setPaymentResult({ status: 'approved', message: '\u00A1Pago procesado! Verificando activaci\u00F3n...' });
      await loadSubscription();
    } else if (code === 3) {
      setPaymentResult({ status: 'pending', message: 'Pago pendiente de confirmaci\u00F3n.' });
    } else {
      setPaymentResult({ status: 'failed', message: 'El pago no fue completado.' });
    }
  };

  // ========== DIRECT PAYMENT ==========
  const handleProofChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen es muy grande. M\u00E1ximo 10MB.');
      return;
    }
    setProofFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setProofPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleDirectPayment = async () => {
    if (processing) return;
    if (!proofFile) {
      alert('Sube el comprobante de pago');
      return;
    }
    setProcessing(true);
    try {
      const plan = DIRECT_PLANS.find(p => p.months === selectedMonths);
      const formData = new FormData();
      formData.append('proof', proofFile);
      formData.append('monthsPurchased', selectedMonths);
      formData.append('amount', plan.total);
      formData.append('paymentMethod', selectedMethod);
      if (businessId) formData.append('businessId', businessId);

      const res = await api.post('/payments/manual/request', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setPaymentResult({
          status: 'pending',
          message: 'Comprobante enviado. Tu pago ser\u00E1 verificado y la suscripci\u00F3n se activar\u00E1 autom\u00E1ticamente.',
        });
        setProofFile(null);
        setProofPreview(null);
        loadMyRequests();
      } else {
        alert(res.data.message || 'Error al enviar comprobante');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error al enviar el comprobante');
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = (text, methodId) => {
    navigator.clipboard.writeText(text.replace(/\s/g, '')).then(() => {
      setCopiedMethod(methodId);
      setTimeout(() => setCopiedMethod(null), 2000);
    });
  };

  // ========== EPAYCO / DLOCAL ==========
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
        alert('No se recibi\u00F3 URL de pago de dLocal');
      }
    } catch (error) {
      console.error('Error initiating dLocal payment:', error);
      alert(error.response?.data?.message || error.message || 'Error al iniciar el pago con dLocal');
    } finally {
      setProcessing(false);
    }
  };

  const handlePay = () => {
    if (selectedGateway === 'direct') {
      handleDirectPayment();
    } else if (selectedGateway === 'dlocal') {
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
      if (now > graceUntil) return { status: 'suspended', text: 'Men\u00FA Desactivado', color: 'red' };
      if (now > periodEnd) return { status: 'grace', text: 'Per\u00EDodo de Gracia', color: 'yellow' };
    }
    return { status: 'active', text: 'Activa', color: 'green' };
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '\u2014';
  const formatCurrency = (n) => `$${(n || 0).toLocaleString('es-CO')}`;

  const plans = selectedGateway === 'direct' ? DIRECT_PLANS : selectedGateway === 'dlocal' ? dlocalPlans : epaycoPlans;
  const selectedPlan = plans.find(p => p.months === selectedMonths);
  const isTestMode = selectedGateway === 'dlocal' ? dlocalConfig.isTest : selectedGateway === 'epayco' ? epaycoConfig.isTest : false;
  const getPlanDisplayName = () => {
    if (!subscription) return '';
    // Derive from planType first (most reliable), then lastMonthsPurchased as fallback
    if (subscription.planType === 'annual' || subscription.lastMonthsPurchased === 12) return 'Plan Anual';
    if (subscription.planType === 'semiannual' || subscription.lastMonthsPurchased === 6) return 'Plan Semestral';
    if (subscription.planType === 'quarterly' || subscription.lastMonthsPurchased === 3) return 'Plan Trimestral';
    return 'Plan Mensual';
  };

  const getPlanTierLevel = () => {
    if (!subscription) return 0;
    if (subscription.planType === 'annual' || subscription.lastMonthsPurchased === 12) return 4;
    if (subscription.planType === 'semiannual' || subscription.lastMonthsPurchased === 6) return 3;
    if (subscription.planType === 'quarterly' || subscription.lastMonthsPurchased === 3) return 2;
    return 1;
  };

  const subStatus = getSubscriptionStatus();
  const planTier = getPlanTierLevel();
  const isAnnualPlan = planTier === 4;
  const hasPendingRequest = myRequests.some(r => r.status === 'pending');

  // Combine all history for display
  const allHistory = [
    ...paymentHistory,
    ...myRequests.map(r => ({
      _id: r._id || r.id,
      months: r.monthsPurchased,
      totalAmount: r.amount,
      status: r.status,
      createdAt: r.createdAt,
      gateway: 'Directo',
      paymentMethod: r.paymentMethod,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
          className="bg-white rounded-2xl border border-slate-100 lg:border-[#DCE4F5] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-lg">
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
              {isApproved ? '\u00A1Pago Exitoso!' : isPending ? 'Pago en Proceso' : 'Pago No Completado'}
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
                <div><p className="text-xs font-bold text-amber-700">Esperando confirmación</p><p className="text-[11px] text-[#6C7A92] mt-1">Se activará automáticamente cuando se confirme tu pago.</p></div>
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
            <button onClick={() => { setPaymentResult(null); window.history.replaceState({}, '', window.location.pathname); loadPaymentHistory(); loadMyRequests(); }}
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
            MODO PRUEBAS &mdash; {selectedGateway === 'dlocal' ? 'dLocal' : 'ePayco'}
          </span>
        </div>
      )}

      {/* ==========================================
          SUSCRIPCIÓN ACTUAL — Premium for annual, compact for others  
          ========================================== */}
      {isAnnualPlan && subscription && subStatus?.status === 'active' ? (
        /* ── ANNUAL PREMIUM CARD ── */
        <div className="relative overflow-hidden rounded-2xl lg:rounded-xl border border-violet-300/30 shadow-[0_2px_16px_rgba(139,92,246,0.08)]">
          {/* Animated dark gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950" />
          
          {/* Glow orbs */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-violet-500/15 rounded-full blur-3xl animate-premium-glow" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl animate-premium-glow" style={{ animationDelay: '1.5s' }} />
          
          {/* Shimmer sweep */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-premium-shimmer" />
          </div>

          {/* Sparkles */}
          <div className="absolute top-3 right-6 w-1 h-1 bg-violet-300/60 rounded-full animate-premium-sparkle-1" />
          <div className="absolute bottom-4 right-12 w-0.5 h-0.5 bg-purple-300/50 rounded-full animate-premium-sparkle-2" />
          <div className="absolute top-5 left-16 w-0.5 h-0.5 bg-indigo-300/40 rounded-full animate-premium-sparkle-3" />

          {/* Content */}
          <div className="relative px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {/* Crown icon */}
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/25 to-purple-600/25 border border-violet-400/20 flex items-center justify-center animate-premium-float">
                  <svg className="w-4.5 h-4.5 text-violet-300 animate-premium-crown-glow" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2l2.5 4 4.5-1.5-2 5L16 16H4l1-6.5-2-5L7.5 6z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-violet-100">Plan Anual</span>
                    <span className="text-[7px] font-black bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent px-1.5 py-0.5 rounded-full border border-violet-400/25 uppercase tracking-[0.12em] leading-none">PRO</span>
                  </div>
                  <span className="text-[10px] text-violet-300/50 font-medium">Suscripción Premium</span>
                </div>
              </div>
              <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                Activa
              </span>
            </div>

            {/* Progress bar */}
            {subscription.periodStart && subscription.periodEnd && (
              <div className="mt-3">
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(2, ((Date.now() - new Date(subscription.periodStart).getTime()) / (new Date(subscription.periodEnd).getTime() - new Date(subscription.periodStart).getTime())) * 100))}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-violet-500"
                  />
                </div>
              </div>
            )}

            {/* Info row */}
            <div className="mt-2.5 flex items-center gap-3 text-[10px]">
              <span className="text-violet-200/80">
                Vence <span className="font-semibold text-violet-100">{formatDate(subscription.periodEnd)}</span>
              </span>
              {subscription.daysRemaining > 0 && (
                <>
                  <span className="text-violet-400/30">|</span>
                  <span className="font-bold tabular-nums bg-gradient-to-r from-violet-200 to-purple-300 bg-clip-text text-transparent">
                    {subscription.daysRemaining} días restantes
                  </span>
                </>
              )}
              {subscription.price > 0 && (
                <>
                  <span className="text-violet-400/30">|</span>
                  <span className="font-semibold text-violet-200/80">{formatCurrency(subscription.price)}</span>
                </>
              )}
            </div>
          </div>

          {/* Bottom accent */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" />
        </div>
      ) : (
        /* ── STANDARD CARD (monthly/quarterly/semiannual/expired/grace) ── */
        <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-[#DCE4F5] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm">
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
                
                <div className="mt-2 flex items-center gap-3 text-[10px] text-[#6C7A92]">
                  <span>
                    <span className="font-semibold text-[#1F2937]">
                      {getPlanDisplayName()}
                    </span>
                  </span>
                  <span className="text-[#DCE4F5]">|</span>
                  <span>Vence <span className="font-semibold text-[#1F2937]">{formatDate(subscription.periodEnd)}</span></span>
                  {subscription.price > 0 && (
                    <>
                      <span className="text-[#DCE4F5]">|</span>
                      <span className="font-semibold text-[#1F2937]">{formatCurrency(subscription.price)}</span>
                    </>
                  )}
                </div>

                {subStatus?.status === 'grace' && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>Período de gracia &mdash; {subscription.graceDaysRemaining > 0 ? `${subscription.graceDaysRemaining} día(s)` : 'Renueva ahora'}</span>
                  </div>
                )}
                {subStatus?.status === 'suspended' && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 border border-red-200">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span>Menú desactivado &mdash; Renueva para reactivar</span>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-1 text-[10px] text-[#6C7A92]">Activa un plan para publicar tu menú digital</p>
            )}
          </div>
        </div>
      )}

      {/* Pending request banner */}
      {hasPendingRequest && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
          <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin flex-shrink-0" />
          <p className="text-[11px] text-amber-700 font-medium">Tienes un pago pendiente de verificación. Se activará pronto.</p>
        </div>
      )}

      {/* ==========================================
          TABS: RENOVAR / HISTORIAL
          ========================================== */}
      <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-[#DCE4F5] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm">
        <div className="flex border-b border-[#DCE4F5]">
          <button onClick={() => setActiveTab('plan')}
            className={`flex-1 py-2 text-[11px] font-semibold transition-all relative ${activeTab === 'plan' ? 'text-[#3A7AFF]' : 'text-[#6C7A92]'}`}>
            {subscription ? 'Renovar' : 'Activar Plan'}
            {activeTab === 'plan' && <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#3A7AFF] rounded-full" />}
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-[11px] font-semibold transition-all relative ${activeTab === 'history' ? 'text-[#3A7AFF]' : 'text-[#6C7A92]'}`}>
            Historial {allHistory.length > 0 && <span className="ml-0.5 text-[8px] bg-[#F4F6FB] text-[#6C7A92] px-1 py-0.5 rounded-full">{allHistory.length}</span>}
            {activeTab === 'history' && <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#3A7AFF] rounded-full" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'plan' && (
            <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-3.5 space-y-3">
              
              {/* Plan selector — horizontal row */}
              <div className="flex gap-1.5">
                {DIRECT_PLANS.map(plan => {
                  const isSelected = selectedMonths === plan.months;
                  const savingsVsMonthly = plan.months > 1 ? (DIRECT_PLANS[0].total * plan.months) - plan.total : 0;
                  const isBestValue = plan.months === 12;
                  const displayTotal = selectedGateway === 'direct' ? plan.total 
                    : selectedGateway === 'dlocal' ? (dlocalPlans.find(p => p.months === plan.months)?.total || plan.total) 
                    : (epaycoPlans.find(p => p.months === plan.months)?.total || plan.total);
                  
                  return (
                    <button key={plan.months} type="button" onClick={() => setSelectedMonths(plan.months)}
                      className={`relative flex-1 py-2 px-1 rounded-lg border transition-all text-center ${
                        isBestValue
                          ? isSelected
                            ? 'border-violet-400/50 bg-gradient-to-b from-violet-950 to-purple-950 shadow-md shadow-violet-500/10'
                            : 'border-violet-300/30 bg-gradient-to-b from-violet-950/90 to-purple-950/90 hover:border-violet-400/40'
                          : isSelected
                            ? 'border-[#3A7AFF] bg-[#3A7AFF]/5 shadow-sm'
                            : 'border-[#DCE4F5] hover:border-[#3A7AFF]/30'
                      }`}>
                      {isBestValue && (
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-bold bg-gradient-to-r from-violet-500 to-purple-500 text-white px-1.5 py-px rounded-full whitespace-nowrap leading-tight flex items-center gap-0.5">
                          <svg className="w-2 h-2" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2l2.5 4 4.5-1.5-2 5L16 16H4l1-6.5-2-5L7.5 6z" /></svg>
                          PRO
                        </div>
                      )}
                      <div className={`text-sm font-bold leading-none ${isBestValue ? 'text-violet-200' : isSelected ? 'text-[#3A7AFF]' : 'text-[#1F2937]'}`}>{plan.months}</div>
                      <div className={`text-[8px] leading-tight ${isBestValue ? 'text-violet-400/60' : 'text-[#6C7A92]'}`}>{plan.months === 1 ? 'mes' : 'meses'}</div>
                      <div className={`text-[10px] font-bold mt-0.5 leading-none ${isBestValue ? 'text-violet-100' : isSelected ? 'text-[#3A7AFF]' : 'text-[#1F2937]'}`}>
                        {formatCurrency(displayTotal)}
                      </div>
                      {savingsVsMonthly > 0 && selectedGateway === 'direct' && (
                        <div className={`text-[7px] font-semibold mt-0.5 leading-tight ${isBestValue ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          -{formatCurrency(savingsVsMonthly)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Gateway selector — direct + pasarelas */}
              <div className="flex items-center gap-1 bg-[#F4F6FB] rounded-lg p-1">
                <button type="button" onClick={() => setSelectedGateway('direct')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1 ${
                    selectedGateway === 'direct' ? 'bg-white text-[#3A7AFF] shadow-sm' : 'text-[#6C7A92]'
                  }`}>
                  <span>Pago Directo</span>
                  {selectedGateway !== 'direct' && <span className="text-[7px] text-emerald-600 font-semibold">Sin comisión</span>}
                </button>
                {(epaycoPlans.length > 0 || dlocalPlans.length > 0) && (
                  <>
                    {dlocalPlans.length > 0 && (
                      <button type="button" onClick={() => setSelectedGateway('dlocal')}
                        className={`flex-1 py-1.5 px-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1 ${
                          selectedGateway === 'dlocal' ? 'bg-white text-[#3A7AFF] shadow-sm' : 'text-[#6C7A92]'
                        }`}>
                        <span>dLocal</span>
                      </button>
                    )}
                    {epaycoPlans.length > 0 && (
                      <button type="button" onClick={() => setSelectedGateway('epayco')}
                        className={`flex-1 py-1.5 px-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1 ${
                          selectedGateway === 'epayco' ? 'bg-white text-[#3A7AFF] shadow-sm' : 'text-[#6C7A92]'
                        }`}>
                        <span>ePayco</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* ========== DIRECT PAYMENT FLOW ========== */}
              {selectedGateway === 'direct' && selectedPlan && (
                <>
                  {/* Price summary */}
                  <div className="bg-[#F4F6FB] rounded-lg p-3">
                    <div className="flex items-center justify-between text-[10px] text-[#6C7A92]">
                      <span>{selectedPlan.label} &mdash; Sin comisión</span>
                      <div className="text-right">
                        {selectedPlan.discount > 0 && (
                          <span className="text-[9px] line-through text-[#6C7A92]/60 mr-1.5">{formatCurrency(selectedPlan.basePrice)}</span>
                        )}
                        <span className="text-sm font-bold text-[#1F2937]">{formatCurrency(selectedPlan.total)}</span>
                      </div>
                    </div>
                    {selectedPlan.discount > 0 && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-emerald-600 font-semibold">{selectedPlan.discount}% de descuento</span>
                        <span className="text-[9px] text-emerald-600 font-semibold">Ahorras {formatCurrency(selectedPlan.basePrice - selectedPlan.total)}</span>
                      </div>
                    )}
                  </div>

                  {/* Payment info cards */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-[#1F2937]">Transfiere a:</p>
                    {DIRECT_METHODS.map(method => (
                      <button key={method.id} type="button"
                        onClick={() => { setSelectedMethod(method.id); copyToClipboard(method.value, method.id); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                          selectedMethod === method.id
                            ? 'border-[#3A7AFF] bg-[#3A7AFF]/5'
                            : 'border-[#DCE4F5] hover:border-[#3A7AFF]/30'
                        }`}>
                        <span className="text-lg">{method.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-[#1F2937]">{method.label}</span>
                            {method.sublabel && <span className="text-[9px] text-[#6C7A92]">({method.sublabel})</span>}
                          </div>
                          <span className="text-sm font-bold text-[#3A7AFF] font-mono tracking-wide">{method.value}</span>
                        </div>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                          copiedMethod === method.id 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-[#F4F6FB] text-[#6C7A92]'
                        }`}>
                          {copiedMethod === method.id ? '\u2713 Copiado' : 'Copiar'}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Upload proof */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-[#1F2937]">Sube el comprobante:</p>
                    <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/jpg,application/pdf" onChange={handleProofChange} className="hidden" />
                    
                    {proofPreview ? (
                      <div className="relative">
                        <img src={proofPreview} alt="Comprobante" className="w-full h-32 object-cover rounded-lg border border-[#DCE4F5]" />
                        <button type="button" onClick={() => { setProofFile(null); setProofPreview(null); }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="w-full py-5 border-2 border-dashed border-[#DCE4F5] rounded-lg hover:border-[#3A7AFF]/40 transition-all flex flex-col items-center gap-1.5 bg-[#F4F6FB]/50">
                        <svg className="w-6 h-6 text-[#6C7A92]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[11px] text-[#6C7A92] font-medium">Toca para subir foto del comprobante</span>
                        <span className="text-[9px] text-[#6C7A92]/60">JPG, PNG o PDF &bull; Máx 10MB</span>
                      </button>
                    )}
                  </div>

                  {/* Submit button */}
                  <button type="button" onClick={handlePay} disabled={processing || !proofFile || hasPendingRequest}
                    className="w-full py-2.5 bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 disabled:bg-[#DCE4F5] disabled:text-[#6C7A92] text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-[#3A7AFF]/20 disabled:shadow-none flex items-center justify-center gap-1.5">
                    {processing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : hasPendingRequest ? (
                      <span>Ya tienes un pago en revisión</span>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Enviar comprobante &mdash; {formatCurrency(selectedPlan.total)} COP</span>
                      </>
                    )}
                  </button>

                  <p className="text-center text-[9px] text-[#6C7A92]/60">
                    Nequi &middot; Daviplata &middot; Llave Breve &middot; Verificación en minutos
                  </p>
                </>
              )}

              {/* ========== GATEWAY PAYMENT FLOW (ePayco/dLocal) ========== */}
              {selectedGateway !== 'direct' && (
                <>
                  {selectedPlan ? (
                    <>
                      <div className="bg-[#F4F6FB] rounded-lg p-3">
                        <div className="flex items-center justify-between text-[10px] text-[#6C7A92]">
                          <span>{selectedPlan.label} ({formatCurrency(selectedPlan.basePrice)}) + comisión {formatCurrency(selectedPlan.commission)}</span>
                          <span className="text-sm font-bold text-[#1F2937]">{formatCurrency(selectedPlan.total)}</span>
                        </div>
                      </div>

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

                      <p className="text-center text-[9px] text-[#6C7A92]/60">
                        Tarjeta &middot; PSE &middot; Nequi &middot; Daviplata &middot; Pago seguro
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-[11px] text-[#6C7A92]">No se pudieron cargar los planes de esta pasarela</p>
                      <button onClick={loadData} className="text-[#3A7AFF] text-[10px] font-medium mt-1">Reintentar</button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ==========================================
              TAB: HISTORIAL DE PAGOS
              ========================================== */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-3.5">
              
              {allHistory.length === 0 ? (
                <div className="text-center py-6">
                  <svg className="w-8 h-8 mx-auto text-[#DCE4F5] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-[11px] text-[#6C7A92]">Sin historial de pagos</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {allHistory.map((payment, i) => {
                    const statusColors = {
                      approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'OK' },
                      pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Pend.' },
                      rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Rech.' },
                      failed: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Fall\u00F3' },
                      reversed: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', label: 'Rev.' },
                      cancelled: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', label: 'Canc.' },
                      created: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Nuevo' },
                    };
                    const s = statusColors[payment.status] || statusColors.created;
                    const gwColors = {
                      'Directo': 'bg-emerald-50 text-emerald-600',
                      'dLocal': 'bg-purple-50 text-purple-600',
                      'ePayco': 'bg-blue-50 text-blue-600',
                    };
                    
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
                            <span className={`text-[8px] font-medium px-1 py-0.5 rounded ${gwColors[payment.gateway] || 'bg-gray-50 text-gray-600'}`}>
                              {payment.gateway === 'Directo' ? (payment.paymentMethod || 'Directo') : payment.gateway}
                            </span>
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

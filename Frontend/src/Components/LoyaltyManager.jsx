import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Joyride, { STATUS } from 'react-joyride';
import confetti from 'canvas-confetti';
import {
  FaGift, FaStar, FaTrophy, FaChartBar, FaPlus, FaEdit, FaTrash,
  FaToggleOn, FaToggleOff, FaSave, FaUsers, FaCoins, FaMedal,
  FaPercent, FaTruck, FaHamburger, FaChevronDown, FaTimes, FaSearch,
  FaRocket, FaLightbulb, FaCheck, FaArrowRight, FaInfoCircle,
  FaExclamationTriangle, FaPlay, FaMagic
} from 'react-icons/fa';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

/* ═══════════════════════════════════════════ */
/*              CONSTANTS                      */
/* ═══════════════════════════════════════════ */

const REWARD_TYPES = [
  { value: 'discount_percent', label: 'Descuento %', icon: FaPercent, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', emoji: '📉', desc: 'Ideal para premiar lealtad' },
  { value: 'discount_fixed', label: 'Descuento $', icon: FaCoins, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', emoji: '💵', desc: 'Un monto fijo de descuento' },
  { value: 'free_product', label: 'Producto gratis', icon: FaHamburger, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', emoji: '🎁', desc: 'Perfecto para enganchar' },
  { value: 'free_delivery', label: 'Envío gratis', icon: FaTruck, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', emoji: '🛵', desc: 'Sube el ticket en días lentos' },
];

const ORDER_MODE_OPTIONS = [
  { value: 'inSite', label: 'En mesa', emoji: '🪑' },
  { value: 'takeaway', label: 'Para llevar', emoji: '🥡' },
  { value: 'delivery', label: 'Domicilio', emoji: '🛵' },
];

const DEFAULT_TIERS = [
  { name: 'Bronce', minPoints: 0, multiplier: 1, color: '#cd7f32', icon: 'star', benefits: ['Acumula puntos'] },
  { name: 'Plata', minPoints: 500, multiplier: 1.5, color: '#94a3b8', icon: 'star', benefits: ['x1.5 puntos', 'Prioridad'] },
  { name: 'Oro', minPoints: 2000, multiplier: 2, color: '#eab308', icon: 'trophy', benefits: ['x2 puntos', '5% descuento'] },
  { name: 'VIP', minPoints: 5000, multiplier: 3, color: '#a855f7', icon: 'crown', benefits: ['x3 puntos', 'Producto gratis mensual'] },
];

const REWARD_TEMPLATES = [
  {
    emoji: '🎁', title: 'Regalar un producto', subtitle: 'Ideal para enganchar clientes',
    color: 'from-orange-400 to-red-400',
    form: { name: 'Producto gratis', description: 'Disfruta un producto por cuenta de la casa', type: 'free_product', discountValue: 0, maxDiscount: 0, pointsCost: 200, productName: '', productId: '', isActive: true, applicableOrderModes: [] }
  },
  {
    emoji: '📉', title: 'Dar un descuento', subtitle: 'Para premiar la lealtad',
    color: 'from-blue-400 to-indigo-400',
    form: { name: '10% de descuento', description: '10% de descuento en tu próximo pedido', type: 'discount_percent', discountValue: 10, maxDiscount: 0, pointsCost: 150, productName: '', productId: '', isActive: true, applicableOrderModes: [] }
  },
  {
    emoji: '🛵', title: 'Domicilio gratis', subtitle: 'Sube el ticket en días lentos',
    color: 'from-purple-400 to-pink-400',
    form: { name: 'Envío gratis', description: 'Tu próximo domicilio va por nuestra cuenta', type: 'free_delivery', discountValue: 0, maxDiscount: 0, pointsCost: 100, productName: '', productId: '', isActive: true, applicableOrderModes: ['delivery'] }
  },
];

/* ═══════════════════════════════════════════ */
/*              TOUR STEPS                     */
/* ═══════════════════════════════════════════ */

const TOUR_STEPS = [
  {
    target: '[data-tour="welcome"]',
    content: (
      <div className="text-center py-2">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">¡Bienvenido al motor de ventas!</h3>
        <p className="text-sm text-slate-500">Crea clientes recurrentes en 3 simples pasos. Te guiaremos en todo el proceso.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="toggle-active"]',
    content: (
      <div>
        <h3 className="font-bold text-slate-800 mb-1">Paso 1: Activa el programa</h3>
        <p className="text-sm text-slate-500">Con un solo clic, tus clientes empezarán a acumular puntos automáticamente en cada compra.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '[data-tour="points-config"]',
    content: (
      <div>
        <h3 className="font-bold text-slate-800 mb-1">Paso 2: Define las reglas</h3>
        <p className="text-sm text-slate-500">Decide cuántos puntos ganarán tus clientes por cada compra. Puedes ajustarlo cuando quieras.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '[data-tour="rewards-tab"]',
    content: (
      <div>
        <h3 className="font-bold text-slate-800 mb-1">Paso 3: Crea premios</h3>
        <p className="text-sm text-slate-500">Elige qué premios podrán canjear tus clientes: productos gratis, descuentos o envío gratis.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '[data-tour="save-btn"]',
    content: (
      <div>
        <h3 className="font-bold text-slate-800 mb-1">¡No olvides guardar!</h3>
        <p className="text-sm text-slate-500">Cuando termines de configurar, presiona este botón para activar los cambios.</p>
      </div>
    ),
    placement: 'bottom',
  },
];

const TOUR_STYLES = {
  options: {
    zIndex: 10000,
    arrowColor: '#fff',
    backgroundColor: '#fff',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    primaryColor: '#f97316',
    textColor: '#334155',
    width: 340,
  },
  buttonNext: { backgroundColor: '#f97316', borderRadius: '12px', padding: '8px 20px', fontSize: '14px', fontWeight: '600' },
  buttonBack: { color: '#94a3b8', fontSize: '13px', marginRight: 8 },
  buttonSkip: { color: '#94a3b8', fontSize: '13px' },
  tooltip: { borderRadius: '16px', padding: '20px' },
  tooltipContainer: { textAlign: 'left' },
  spotlight: { borderRadius: '16px' },
};

/* ═══════════════════════════════════════════ */
/*          LIVE PHONE PREVIEW                 */
/* ═══════════════════════════════════════════ */

const PhonePreview = ({ program, themeColor, businessName }) => {
  const pts = program.pointsPerAmount || 1;
  const amt = program.amountPerPoints || 10000;
  const activeRewards = program.rewards?.filter(r => r.isActive) || [];
  const activeTiers = program.tiersEnabled ? (program.tiers || []) : [];

  return (
    <div className="relative mx-auto" style={{ width: 220 }}>
      {/* Phone frame */}
      <div className="relative rounded-[28px] border-[6px] border-slate-800 bg-slate-800 overflow-hidden shadow-2xl">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-800 rounded-b-xl z-20" />

        {/* Screen content */}
        <div className="bg-gradient-to-b from-slate-50 to-white rounded-[22px] overflow-hidden" style={{ height: 380 }}>
          <div className="overflow-y-auto h-full">
            {/* Points card */}
            <div className="p-3 pt-7">
              <div
                className="rounded-xl p-3 text-white relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
              >
                <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10 bg-white" />
                <p className="text-[8px] opacity-70 uppercase tracking-wider">{businessName || 'Tu negocio'}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black">520</span>
                  <span className="text-[9px] opacity-60">puntos</span>
                </div>
                <div className="mt-2 flex items-center gap-1 bg-white/15 rounded-md px-2 py-1">
                  <span className="text-[8px]">🔥</span>
                  <span className="text-[8px]">
                    Ganas {pts} pto{pts > 1 ? 's' : ''} por ${Number(amt).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>

            {/* Tiers preview */}
            {activeTiers.length > 0 && (
              <div className="px-3 pb-2">
                <p className="text-[9px] font-semibold text-slate-600 mb-1.5">🏆 Niveles</p>
                <div className="flex gap-1.5">
                  {activeTiers.slice(0, 4).map((tier, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-lg p-1.5 text-center border"
                      style={{ borderColor: tier.color + '40', backgroundColor: tier.color + '10' }}
                    >
                      <div className="text-sm">{i === 0 ? '🥉' : i === 1 ? '🥈' : i === 2 ? '🥇' : '💎'}</div>
                      <p className="text-[7px] font-bold text-slate-700 truncate">{tier.name}</p>
                      <p className="text-[6px] text-slate-400">x{tier.multiplier}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rewards preview */}
            {activeRewards.length > 0 ? (
              <div className="px-3 pb-3">
                <p className="text-[9px] font-semibold text-slate-600 mb-1.5">🎁 Premios</p>
                <div className="space-y-1.5">
                  {activeRewards.slice(0, 3).map((r, i) => {
                    const rt = REWARD_TYPES.find(t => t.value === r.type) || REWARD_TYPES[0];
                    return (
                      <div key={i} className="flex items-center gap-2 bg-white rounded-lg border border-slate-100 p-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${rt.bg}`}>
                          <span className="text-xs">{rt.emoji}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] font-semibold text-slate-700 truncate">{r.name}</p>
                          <p className="text-[7px] text-slate-400">{r.pointsCost} pts</p>
                        </div>
                        <button className="px-2 py-0.5 rounded-md text-[7px] font-bold text-white" style={{ backgroundColor: themeColor }}>Canjear</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-3 py-6 text-center">
                <p className="text-2xl mb-1">🎁</p>
                <p className="text-[9px] text-slate-400">Agrega premios para verlos aquí</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">Así lo ven tus clientes</p>
    </div>
  );
};

/* ═══════════════════════════════════════════ */
/*          SMART WARNING                      */
/* ═══════════════════════════════════════════ */

const SmartWarning = ({ program, rewardForm }) => {
  if (!rewardForm.pointsCost || !program.amountPerPoints || !program.pointsPerAmount) return null;

  const moneyPerPoint = program.amountPerPoints / program.pointsPerAmount;
  const costInMoney = rewardForm.pointsCost * moneyPerPoint;

  let message = null;
  let severity = 'info';

  if (rewardForm.type === 'free_product' && rewardForm.pointsCost < 30) {
    severity = 'danger';
    message = `⚠️ Con solo ${rewardForm.pointsCost} puntos (≈ $${Math.round(costInMoney).toLocaleString('es-CO')} en compras), estás regalando un producto. ¿No es muy bajo?`;
  } else if (rewardForm.type === 'discount_percent' && rewardForm.discountValue > 30) {
    severity = 'warning';
    message = `Un ${rewardForm.discountValue}% de descuento es bastante generoso. Asegúrate de que tu margen lo soporte.`;
  } else if (costInMoney < 10000 && rewardForm.type === 'free_product') {
    severity = 'warning';
    message = `Este premio se consigue con $${Math.round(costInMoney).toLocaleString('es-CO')} en compras. Considera subir los puntos.`;
  } else if (costInMoney > 500000) {
    severity = 'info';
    message = `Este premio requiere $${Math.round(costInMoney).toLocaleString('es-CO')} en compras. Asegúrate de que sea alcanzable.`;
  }

  if (!message) return null;

  const colors = { info: 'bg-blue-50 border-blue-200 text-blue-700', warning: 'bg-amber-50 border-amber-200 text-amber-700', danger: 'bg-red-50 border-red-200 text-red-700' };

  return (
    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${colors[severity]}`}>
      <FaExclamationTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>{message}</span>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════ */
/*          MAIN COMPONENT                     */
/* ═══════════════════════════════════════════ */

const LoyaltyManager = () => {
  const { businessConfig, businessId } = useBusinessConfig();
  const bizId = businessId || businessConfig?._id;
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [stats, setStats] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('rules');

  const [program, setProgram] = useState({
    isActive: false,
    pointsPerAmount: 1,
    amountPerPoints: 10000,
    firstOrderBonus: 50,
    referralBonus: 0,
    pointsExpiryDays: 90,
    tiersEnabled: false,
    tiers: [],
    rewards: []
  });

  /* ── Tour ── */
  const [runTour, setRunTour] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(() => {
    try { return localStorage.getItem('loyalty_tour_done') === '1'; } catch { return false; }
  });

  /* ── Reward modal ── */
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [rewardForm, setRewardForm] = useState({
    name: '', description: '', type: 'discount_percent',
    discountValue: 10, maxDiscount: 0, pointsCost: 100,
    productName: '', productId: '', isActive: true,
    applicableOrderModes: []
  });
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';

  /* ═══ DATA FETCHING ═══ */

  const fetchProgram = useCallback(async () => {
    if (!bizId) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/loyalty/program?businessId=${bizId}`);
      setProgram(data);
    } catch (err) {
      console.error('Error loading loyalty program:', err);
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  const fetchStats = useCallback(async () => {
    if (!bizId) return;
    try {
      const [statsRes, topRes] = await Promise.all([
        api.get(`/loyalty/stats?businessId=${bizId}`),
        api.get(`/loyalty/top-customers?limit=10&businessId=${bizId}`)
      ]);
      setStats(statsRes.data);
      setTopCustomers(topRes.data);
    } catch (err) {
      console.error('Error loading loyalty stats:', err);
    }
  }, [bizId]);

  const fetchProducts = useCallback(async () => {
    if (!bizId) return;
    try {
      const { data } = await api.get(`/products?businessId=${bizId}`);
      setProducts(data.filter(p => p.active !== false));
    } catch (err) {
      console.error('Error loading products:', err);
    }
  }, [bizId]);

  useEffect(() => { fetchProgram(); }, [fetchProgram]);
  useEffect(() => { if (activeTab === 'stats') fetchStats(); }, [activeTab, fetchStats]);

  useEffect(() => {
    if (!loading && !tourCompleted && program) {
      const timer = setTimeout(() => setRunTour(true), 800);
      return () => clearTimeout(timer);
    }
  }, [loading, tourCompleted]);

  /* ═══ ACTIONS ═══ */

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data } = await api.put('/loyalty/program', { ...program, businessId: bizId });
      setProgram(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      if (data.isActive && data.rewards.length > 0) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    } catch (err) {
      console.error('Error saving loyalty program:', err);
      alert('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = () => {
    setProgram(p => ({ ...p, isActive: !p.isActive }));
  };

  const handleToggleTiers = () => {
    setProgram(p => ({
      ...p,
      tiersEnabled: !p.tiersEnabled,
      tiers: !p.tiersEnabled && p.tiers.length === 0 ? DEFAULT_TIERS : p.tiers
    }));
  };

  const handleTourCallback = (data) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false);
      setTourCompleted(true);
      try { localStorage.setItem('loyalty_tour_done', '1'); } catch {}
    }
  };

  /* ── Reward CRUD ── */
  const openRewardModal = (reward = null) => {
    fetchProducts();
    setProductSearch('');
    setShowProductDropdown(false);
    if (reward) {
      setEditingReward(reward);
      setRewardForm({
        name: reward.name, description: reward.description || '',
        type: reward.type, discountValue: reward.discountValue || 0,
        maxDiscount: reward.maxDiscount || 0, pointsCost: reward.pointsCost,
        productName: reward.productName || '', productId: reward.productId || '',
        isActive: reward.isActive,
        applicableOrderModes: reward.applicableOrderModes || []
      });
      setShowTemplates(false);
      setShowRewardModal(true);
    } else {
      setEditingReward(null);
      setShowTemplates(true);
      setShowRewardModal(true);
    }
  };

  const selectTemplate = (template) => {
    setRewardForm({ ...template.form });
    setShowTemplates(false);
  };

  const selectBlank = () => {
    setRewardForm({
      name: '', description: '', type: 'discount_percent',
      discountValue: 10, maxDiscount: 0, pointsCost: 100,
      productName: '', productId: '', isActive: true,
      applicableOrderModes: []
    });
    setShowTemplates(false);
  };

  const saveReward = () => {
    if (!rewardForm.name.trim() || !rewardForm.pointsCost) return;
    const newReward = { ...rewardForm };
    if (editingReward) {
      newReward._id = editingReward._id;
      newReward.timesRedeemed = editingReward.timesRedeemed || 0;
      setProgram(p => ({
        ...p,
        rewards: p.rewards.map(r => (r._id === editingReward._id ? newReward : r))
      }));
    } else {
      newReward._id = `temp_${Date.now()}`;
      setProgram(p => ({ ...p, rewards: [...p.rewards, newReward] }));
    }
    setShowRewardModal(false);
  };

  const deleteReward = (id) => {
    setProgram(p => ({ ...p, rewards: p.rewards.filter(r => r._id !== id) }));
  };

  /* ── Tier CRUD ── */
  const updateTier = (idx, field, value) => {
    setProgram(p => {
      const tiers = [...p.tiers];
      tiers[idx] = { ...tiers[idx], [field]: value };
      return { ...p, tiers };
    });
  };

  const addTier = () => {
    const maxPts = program.tiers.length ? Math.max(...program.tiers.map(t => t.minPoints)) : 0;
    setProgram(p => ({
      ...p,
      tiers: [...p.tiers, { name: 'Nuevo nivel', minPoints: maxPts + 1000, multiplier: 1, color: '#94a3b8', icon: 'star', benefits: [] }]
    }));
  };

  const removeTier = (idx) => {
    setProgram(p => ({ ...p, tiers: p.tiers.filter((_, i) => i !== idx) }));
  };

  /* ═══ COMPUTED ═══ */

  const completionSteps = useMemo(() => [
    { done: program.isActive, label: 'Programa activado' },
    { done: program.pointsPerAmount > 0 && program.amountPerPoints > 0, label: 'Reglas configuradas' },
    { done: program.rewards.length > 0, label: 'Al menos 1 premio creado' },
  ], [program]);

  const completionPercent = useMemo(() => {
    const done = completionSteps.filter(s => s.done).length;
    return Math.round((done / completionSteps.length) * 100);
  }, [completionSteps]);

  const TABS = [
    { id: 'rules', label: 'Reglas', emoji: '⚙️', desc: '¿Cómo ganan puntos?' },
    { id: 'rewards', label: 'Premios', emoji: '🎁', desc: '¿Qué se llevan?', tourId: 'rewards-tab' },
    { id: 'tiers', label: 'Niveles', emoji: '🏆', desc: 'Bronce → Oro → VIP' },
    { id: 'stats', label: 'Stats', emoji: '📊', desc: 'Rendimiento' },
  ];

  /* ═══ RENDER ═══ */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: themeColor }} />
          <p className="text-sm text-slate-400">Cargando programa de fidelidad...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto" data-tour="welcome">
      {/* Tour */}
      <Joyride
        steps={TOUR_STEPS}
        run={runTour}
        continuous
        showSkipButton
        showProgress
        callback={handleTourCallback}
        styles={TOUR_STYLES}
        locale={{ back: 'Atrás', close: 'Cerrar', last: '¡Entendido!', next: 'Siguiente', open: 'Abrir', skip: 'Saltar tutorial' }}
      />

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: themeColor + '15' }}>
            <FaGift className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">Programa de Fidelidad</h2>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-full bg-amber-100 text-amber-600 border border-amber-200/80">Beta</span>
            </div>
            <p className="text-sm text-slate-400">Convierte visitantes en clientes frecuentes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTourCompleted(false); setRunTour(true); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all"
          >
            <FaLightbulb className="w-3 h-3" /> Tutorial
          </button>
          <button
            onClick={handleToggleActive}
            data-tour="toggle-active"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
              program.isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            {program.isActive ? <FaToggleOn className="w-5 h-5" /> : <FaToggleOff className="w-5 h-5" />}
            {program.isActive ? 'Activo' : 'Inactivo'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-tour="save-btn"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-sm"
            style={{ backgroundColor: saveSuccess ? '#10b981' : themeColor }}
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
            ) : saveSuccess ? (
              <><FaCheck className="w-4 h-4" /> ¡Guardado!</>
            ) : (
              <><FaSave className="w-4 h-4" /> Guardar</>
            )}
          </button>
        </div>
      </div>

      {/* ═══ COMPLETION PROGRESS ═══ */}
      {completionPercent < 100 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FaRocket className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-amber-800">Configura tu programa</span>
            </div>
            <span className="text-xs font-bold text-amber-600">{completionPercent}%</span>
          </div>
          <div className="w-full bg-amber-200/40 rounded-full h-2 mb-3">
            <motion.div
              className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
              initial={{ width: 0 }}
              animate={{ width: `${completionPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {completionSteps.map((step, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs font-medium ${step.done ? 'text-emerald-600' : 'text-amber-600/70'}`}>
                {step.done ? <FaCheck className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border-2 border-amber-300 inline-block" />}
                {step.label}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ TABS ═══ */}
      <div className="flex gap-1 mb-6 bg-slate-100/80 rounded-2xl p-1.5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-tour={tab.tourId || undefined}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="text-base">{tab.emoji}</span>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold leading-tight">{tab.label}</p>
              <p className="text-[10px] text-slate-400 font-normal">{tab.desc}</p>
            </div>
            <span className="sm:hidden text-xs">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═══ CONTENT WITH PREVIEW ═══ */}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0">

          {/* TAB: Rules */}
          {activeTab === 'rules' && (
            <div className="space-y-4" data-tour="points-config">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-xl">🪙</span>
                  <h3 className="text-base font-bold text-slate-800">Reglas de puntos</h3>
                </div>
                <div className="bg-slate-50 rounded-xl p-5">
                  <p className="text-base text-slate-700 leading-relaxed flex flex-wrap items-center gap-1.5">
                    <span>Mis clientes ganarán</span>
                    <input
                      type="number"
                      value={program.pointsPerAmount}
                      onChange={e => setProgram(p => ({ ...p, pointsPerAmount: Number(e.target.value) || 1 }))}
                      className="inline-block w-20 px-3 py-1.5 rounded-lg border-2 border-orange-200 bg-white text-center font-bold text-orange-600 text-lg focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                      min="1"
                    />
                    <span className="font-semibold" style={{ color: themeColor }}>punto{program.pointsPerAmount !== 1 ? 's' : ''}</span>
                    <span>por cada</span>
                    <span className="text-slate-400">$</span>
                    <input
                      type="number"
                      value={program.amountPerPoints}
                      onChange={e => setProgram(p => ({ ...p, amountPerPoints: Number(e.target.value) || 1 }))}
                      className="inline-block w-28 px-3 py-1.5 rounded-lg border-2 border-orange-200 bg-white text-center font-bold text-orange-600 text-lg focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                      min="1"
                    />
                    <span>que gasten.</span>
                  </p>
                </div>
                <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50/60 rounded-xl">
                  <FaInfoCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-600">
                    <strong>Ejemplo:</strong> Si un cliente compra ${Number(program.amountPerPoints * 3).toLocaleString('es-CO')}, gana <strong>{program.pointsPerAmount * 3} puntos</strong> automáticamente.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-xl">🎉</span>
                  <h3 className="text-base font-bold text-slate-800">Bonificaciones</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">🎁 {isService ? 'Bonus primera cita' : 'Bonus primer pedido'}</p>
                    <p className="text-xs text-slate-500 mb-2">{isService ? 'Puntos extra de bienvenida la primera vez que reservan' : 'Puntos extra de bienvenida la primera vez que compran'}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={program.firstOrderBonus}
                        onChange={e => setProgram(p => ({ ...p, firstOrderBonus: Number(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-sm font-semibold text-center focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
                        min="0" placeholder="0 = sin bonus"
                      />
                      <span className="text-xs text-slate-400 whitespace-nowrap">puntos</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-700 mb-2">⏰ Expiración de puntos</p>
                    <p className="text-xs text-slate-500 mb-2">Días antes de que los puntos venzan. 0 = nunca</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={program.pointsExpiryDays}
                        onChange={e => setProgram(p => ({ ...p, pointsExpiryDays: Number(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-center focus:ring-2 focus:ring-slate-200 outline-none"
                        min="0" placeholder="0 = nunca"
                      />
                      <span className="text-xs text-slate-400 whitespace-nowrap">días</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Rewards */}
          {activeTab === 'rewards' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{program.rewards.length} premio(s) configurado(s)</p>
                <button
                  onClick={() => openRewardModal()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm shadow-sm transition-all hover:shadow-md"
                  style={{ backgroundColor: themeColor }}
                >
                  <FaPlus className="w-3 h-3" /> Nuevo premio
                </button>
              </div>

              {program.rewards.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center"
                >
                  <div className="text-5xl mb-4">🎁</div>
                  <h3 className="text-lg font-bold text-slate-700 mb-2">Crea tu primer premio</h3>
                  <p className="text-sm text-slate-400 mb-5 max-w-xs mx-auto">
                    Tus clientes acumularán puntos con cada compra. ¿Qué querrías que se pudieran llevar?
                  </p>
                  <button
                    onClick={() => openRewardModal()}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                    style={{ backgroundColor: themeColor }}
                  >
                    <FaMagic className="w-4 h-4" /> Crear premio con plantilla
                  </button>
                </motion.div>
              )}

              <div className="grid gap-3">
                {program.rewards.map((reward) => {
                  const rt = REWARD_TYPES.find(r => r.value === reward.type) || REWARD_TYPES[0];
                  const moneyEquiv = program.amountPerPoints && program.pointsPerAmount
                    ? Math.round((reward.pointsCost * program.amountPerPoints) / program.pointsPerAmount)
                    : null;
                  return (
                    <motion.div key={reward._id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all ${
                        reward.isActive ? 'border-slate-200 hover:border-slate-300' : 'border-slate-100 opacity-60'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${rt.bg}`}>
                        <span className="text-xl">{rt.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-800 truncate">{reward.name}</h4>
                          {!reward.isActive && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full">Inactiva</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {reward.type === 'discount_percent' && `${reward.discountValue}% de descuento`}
                          {reward.type === 'discount_fixed' && `$${Number(reward.discountValue).toLocaleString('es-CO')} de descuento`}
                          {reward.type === 'free_product' && `🍽️ ${reward.productName || 'Por definir'}`}
                          {reward.type === 'free_delivery' && '🛵 Envío gratuito'}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                            {reward.pointsCost} pts
                          </span>
                          {moneyEquiv != null && (
                            <span className="text-[10px] text-slate-400">≈ ${moneyEquiv.toLocaleString('es-CO')} en compras</span>
                          )}
                          {reward.applicableOrderModes?.length > 0 && (
                            <span className="text-[10px] text-slate-400">
                              {reward.applicableOrderModes.map(v => ORDER_MODE_OPTIONS.find(o => o.value === v)?.emoji).join(' ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{reward.timesRedeemed || 0} canjes</span>
                        <button onClick={() => openRewardModal(reward)} className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors">
                          <FaEdit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteReward(reward._id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                          <FaTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: Tiers */}
          {activeTab === 'tiers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button onClick={handleToggleTiers}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                    program.tiersEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  {program.tiersEnabled ? <FaToggleOn className="w-5 h-5" /> : <FaToggleOff className="w-5 h-5" />}
                  {program.tiersEnabled ? 'Niveles activados' : 'Niveles desactivados'}
                </button>
                {program.tiersEnabled && (
                  <button onClick={addTier} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: themeColor }}>
                    <FaPlus className="w-3 h-3" /> Nivel
                  </button>
                )}
              </div>

              {!program.tiersEnabled && (
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
                  <div className="text-5xl mb-4">🏆</div>
                  <h3 className="text-lg font-bold text-slate-700 mb-2">Niveles de lealtad</h3>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto">
                    Activa niveles (Bronce → Plata → Oro → VIP) para que los clientes ganen multiplicadores de puntos.
                  </p>
                </div>
              )}

              {program.tiersEnabled && (
                <div className="space-y-3">
                  {/* Visual tier ladder */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Vista rápida</p>
                    <div className="flex items-end gap-2 justify-center">
                      {program.tiers.map((tier, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <div className="rounded-xl flex items-center justify-center transition-all"
                            style={{ backgroundColor: tier.color + '20', width: 48 + idx * 10, height: 48 + idx * 10 }}
                          >
                            <FaMedal className="w-5 h-5" style={{ color: tier.color }} />
                          </div>
                          <p className="text-[10px] font-bold text-slate-700">{tier.name}</p>
                          <p className="text-[9px] text-slate-400">x{tier.multiplier}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {program.tiers.map((tier, idx) => (
                    <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: tier.color + '20' }}>
                          <FaMedal className="w-5 h-5" style={{ color: tier.color }} />
                        </div>
                        <input
                          value={tier.name}
                          onChange={e => updateTier(idx, 'name', e.target.value)}
                          className="text-base font-bold text-slate-800 border-b-2 border-transparent focus:border-slate-300 outline-none px-1 bg-transparent"
                          placeholder="Nombre del nivel"
                        />
                        <button onClick={() => removeTier(idx)} className="ml-auto p-2 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                          <FaTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Puntos mínimos</label>
                          <input type="number" value={tier.minPoints} onChange={e => updateTier(idx, 'minPoints', Number(e.target.value) || 0)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-center focus:ring-2 focus:ring-orange-100 focus:border-orange-300 outline-none" min="0" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Multiplicador</label>
                          <input type="number" value={tier.multiplier} onChange={e => updateTier(idx, 'multiplier', Number(e.target.value) || 1)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-center focus:ring-2 focus:ring-orange-100 focus:border-orange-300 outline-none" min="1" step="0.5" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Color</label>
                          <input type="color" value={tier.color} onChange={e => updateTier(idx, 'color', e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Stats */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              {!stats ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-sm text-slate-500">Cargando estadísticas...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Miembros', value: stats.totalMembers || 0, icon: '👥', bg: 'bg-blue-50', border: 'border-blue-100' },
                      { label: 'Pts emitidos', value: stats.totalPointsIssued || 0, icon: '🪙', bg: 'bg-amber-50', border: 'border-amber-100' },
                      { label: 'Pts canjeados', value: stats.totalPointsRedeemed || 0, icon: '🎁', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                      { label: 'Pts activos', value: stats.totalPointsActive || 0, icon: '⭐', bg: 'bg-purple-50', border: 'border-purple-100' },
                    ].map((stat, i) => (
                      <div key={i} className={`${stat.bg} rounded-2xl border ${stat.border} p-4`}>
                        <span className="text-lg">{stat.icon}</span>
                        <p className="text-xl font-black text-slate-800 mt-1">{Number(stat.value).toLocaleString('es-CO')}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">🏆</span>
                      <h3 className="text-base font-bold text-slate-800">Clientes más leales</h3>
                    </div>
                    {topCustomers.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">Aún no hay datos</p>
                    ) : (
                      <div className="space-y-2">
                        {topCustomers.map((c, i) => (
                          <div key={c._id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'
                            }`}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate">{c.customerId?.name || c.phone}</p>
                              <p className="text-[10px] text-slate-400">{c.phone} · {c.totalOrders} {isService ? 'citas' : 'pedidos'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-800">{c.points} pts</p>
                              {c.currentTier && <p className="text-[10px] text-slate-400">{c.currentTier}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* LIVE PREVIEW */}
        <div className="hidden lg:block w-[260px] shrink-0 sticky top-4">
          <PhonePreview program={program} themeColor={themeColor} businessName={businessConfig?.businessName} />
        </div>
      </div>

      {/* ═══ REWARD MODAL ═══ */}
      <AnimatePresence>
        {showRewardModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRewardModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-5 pb-3 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {editingReward ? 'Editar premio' : showTemplates ? 'Elige un tipo de premio' : 'Configurar premio'}
                  </h3>
                  {showTemplates && <p className="text-xs text-slate-400 mt-0.5">Elige una plantilla o empieza desde cero</p>}
                </div>
                <button onClick={() => setShowRewardModal(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                  <FaTimes className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 pb-3 flex-1 min-h-0">
                {showTemplates ? (
                  <div className="space-y-3">
                    {REWARD_TEMPLATES.map((tpl, i) => (
                      <motion.button key={i} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                        onClick={() => selectTemplate(tpl)}
                        className={`w-full text-left rounded-2xl p-4 bg-gradient-to-r ${tpl.color} text-white shadow-md hover:shadow-lg transition-all`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{tpl.emoji}</span>
                          <div>
                            <p className="font-bold text-base">{tpl.title}</p>
                            <p className="text-sm opacity-90">{tpl.subtitle}</p>
                          </div>
                          <FaArrowRight className="ml-auto w-4 h-4 opacity-60" />
                        </div>
                      </motion.button>
                    ))}
                    <button onClick={selectBlank}
                      className="w-full text-left rounded-2xl p-4 border-2 border-dashed border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">✏️</span>
                        <div>
                          <p className="font-bold text-sm">Crear desde cero</p>
                          <p className="text-xs opacity-70">Configura cada detalle manualmente</p>
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre del premio</label>
                      <input value={rewardForm.name} onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none"
                        placeholder="Ej: Postre gratis, 10% descuento..." />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo de premio</label>
                      <div className="grid grid-cols-2 gap-2">
                        {REWARD_TYPES.map(rt => (
                          <button key={rt.value} onClick={() => setRewardForm(f => ({ ...f, type: rt.value }))}
                            className={`flex items-center gap-2 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                              rewardForm.type === rt.value ? `border-blue-500 ${rt.bg}` : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <span className="text-base">{rt.emoji}</span>
                            {rt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(rewardForm.type === 'discount_percent' || rewardForm.type === 'discount_fixed') && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Valor {rewardForm.type === 'discount_percent' ? '(%)' : '($)'}
                          </label>
                          <input type="number" value={rewardForm.discountValue}
                            onChange={e => setRewardForm(f => ({ ...f, discountValue: Number(e.target.value) || 0 }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-center focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none" min="0" />
                        </div>
                        {rewardForm.type === 'discount_percent' && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Máx. descuento ($)</label>
                            <input type="number" value={rewardForm.maxDiscount}
                              onChange={e => setRewardForm(f => ({ ...f, maxDiscount: Number(e.target.value) || 0 }))}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none" min="0" placeholder="0 = sin límite" />
                          </div>
                        )}
                      </div>
                    )}

                    {rewardForm.type === 'free_product' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">{isService ? 'Servicio a regalar' : 'Producto a regalar'}</label>
                        <button type="button" onClick={() => setShowProductDropdown(v => !v)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                            rewardForm.productName ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{rewardForm.productName || (isService ? 'Seleccionar servicio...' : 'Seleccionar producto...')}</span>
                          <FaChevronDown className={`w-3 h-3 shrink-0 transition-transform ${showProductDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showProductDropdown && (
                          <div className="mt-1 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-lg">
                            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                              <FaSearch className="w-3 h-3 text-slate-400" />
                              <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                                className="w-full text-sm outline-none" placeholder={isService ? 'Buscar servicio...' : 'Buscar producto...'} autoFocus />
                            </div>
                            <div className="max-h-36 overflow-y-auto">
                              {products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                                <button key={p._id} type="button"
                                  onClick={() => {
                                    setRewardForm(f => ({ ...f, productId: p._id, productName: p.name }));
                                    setProductSearch('');
                                    setShowProductDropdown(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${
                                    rewardForm.productId === p._id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                                  }`}
                                >
                                  <span className="truncate">{p.name}</span>
                                  {p.price != null && <span className="text-[11px] text-slate-400 ml-2 shrink-0">${Number(p.price).toLocaleString('es-CO')}</span>}
                                </button>
                              ))}
                              {products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                <p className="px-3 py-2 text-xs text-slate-400">{isService ? 'No se encontraron servicios' : 'No se encontraron productos'}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Costo en puntos</label>
                      <input type="number" value={rewardForm.pointsCost}
                        onChange={e => setRewardForm(f => ({ ...f, pointsCost: Number(e.target.value) || 1 }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-center focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none" min="1" />
                      {program.amountPerPoints > 0 && program.pointsPerAmount > 0 && (
                        <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                          <FaInfoCircle className="w-3 h-3" />
                          Equivale a ${Math.round((rewardForm.pointsCost * program.amountPerPoints) / program.pointsPerAmount).toLocaleString('es-CO')} en compras del cliente
                        </p>
                      )}
                    </div>

                    <SmartWarning program={program} rewardForm={rewardForm} />

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descripción (opcional)</label>
                      <input value={rewardForm.description} onChange={e => setRewardForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none"
                        placeholder="Ej: Disfruta un postre por cuenta de la casa" />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Aplica para</label>
                      <div className="flex gap-2">
                        {ORDER_MODE_OPTIONS.map(mode => {
                          const checked = rewardForm.applicableOrderModes.length === 0 || rewardForm.applicableOrderModes.includes(mode.value);
                          return (
                            <button key={mode.value} type="button"
                              onClick={() => {
                                setRewardForm(f => {
                                  const current = f.applicableOrderModes.length === 0 ? ORDER_MODE_OPTIONS.map(m => m.value) : [...f.applicableOrderModes];
                                  const next = current.includes(mode.value) ? current.filter(v => v !== mode.value) : [...current, mode.value];
                                  return { ...f, applicableOrderModes: next.length === ORDER_MODE_OPTIONS.length ? [] : next };
                                });
                              }}
                              className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                                checked ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-400'
                              }`}
                            >
                              {mode.emoji} {mode.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        {rewardForm.applicableOrderModes.length === 0
                          ? '✅ Aplica para todos los modos'
                          : `Solo para: ${rewardForm.applicableOrderModes.map(v => ORDER_MODE_OPTIONS.find(o => o.value === v)?.label).join(', ')}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {!showTemplates && (
                <div className="flex gap-2 p-5 pt-3 shrink-0 border-t border-slate-100">
                  <button onClick={() => setShowRewardModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={saveReward}
                    disabled={!rewardForm.name.trim() || !rewardForm.pointsCost}
                    className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40 shadow-sm"
                    style={{ backgroundColor: themeColor }}
                  >
                    {editingReward ? '✅ Actualizar' : '🎁 Crear premio'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoyaltyManager;

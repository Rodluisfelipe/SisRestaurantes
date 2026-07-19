import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { getBusinessSlug } from '../utils/getBusinessId';
import { useBusinessConfig } from '../Context/BusinessContext';
import {
  Medal, Award, Crown, Gem, Star, Trophy, Flame, Gift, Lock, Check,
  CheckCircle2, Sparkles, Map, ClipboardList, CalendarCheck,
  UtensilsCrossed, Wallet, Banknote, Bike,
} from 'lucide-react';

const EMPTY_ARRAY = [];

/* ═══════════════════════════════════════════════ */
/*  ANIMATED ODOMETER COUNTER                      */
/* ═══════════════════════════════════════════════ */
const AnimatedCounter = ({ value }) => {
  const ref = useRef(null);
  const prev = useRef(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prev.current, to = value, dur = 1800, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(from + (to - from) * ease).toLocaleString('es-CO');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prev.current = value;
  }, [value]);
  return <span ref={ref} className="tabular-nums">0</span>;
};

/* ═══════════════════════════════════════════════ */
/*  CIRCULAR PROGRESS RING                         */
/* ═══════════════════════════════════════════════ */
const ProgressRing = ({ percent, size = 44, stroke = 3.5, color = '#f97316' }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-black" style={{ color }}>{Math.round(percent)}%</span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════ */
/*  CONSTANTS                                      */
/* ═══════════════════════════════════════════════ */
const TIER_MAP = {
  bronze: Medal, bronce: Medal, silver: Award, plata: Award,
  gold: Trophy, oro: Trophy, platinum: Gem, platino: Gem,
  diamond: Gem, diamante: Gem, vip: Crown
};
const getTierIcon = (n) => {
  if (!n) return Star;
  const k = n.toLowerCase();
  for (const [a, b] of Object.entries(TIER_MAP)) { if (k.includes(a)) return b; }
  return Star;
};

const REWARD_ICONS = { free_product: UtensilsCrossed, discount_percent: Wallet, discount_fixed: Banknote, free_delivery: Bike };

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } };

/* ═══════════════════════════════════════════════ */
/*  LOYALTY PAGE (Customer-facing)                 */
/* ═══════════════════════════════════════════════ */
const LoyaltyPage = ({ show, onClose, phone, businessId, businessName, theme, products = EMPTY_ARRAY, addToCart }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [redeeming, setRedeeming] = useState(null);

  const btnColor = theme?.buttonColor || '#f97316';
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  /* ── Data fetching ── */
  const fetchBalance = useCallback(async () => {
    if (!phone || !businessId) return;
    try {
      setLoading(true);
      const bid = businessId || getBusinessSlug();
      const { data: res } = await api.get('/loyalty/balance', { params: { businessId: bid, phone } });
      if (res.active) setData(res);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [phone, businessId]);

  useEffect(() => { if (show) fetchBalance(); }, [show, fetchBalance]);

  /* ── Computed ── */
  const currentTier = data?.currentTier || '';
  const sortedTiers = useMemo(() => {
    if (!data?.tiers?.length) return [];
    return [...data.tiers].sort((a, b) => a.minPoints - b.minPoints);
  }, [data?.tiers]);

  const currentTierIndex = sortedTiers.findIndex(t => t.name === currentTier);
  const nextTier = sortedTiers[currentTierIndex + 1] || null;
  const progressToNext = nextTier
    ? Math.min(100, ((data?.totalEarned || 0) / nextTier.minPoints) * 100)
    : 100;
  const pointsToNext = nextTier
    ? Math.max(0, nextTier.minPoints - (data?.totalEarned || 0))
    : 0;

  const availableRewards = useMemo(() => data?.rewards?.filter(r => r.isActive) || [], [data?.rewards]);

  /* ── Sorted: unlocked first, then closest to unlock ── */
  const sortedRewards = useMemo(() => {
    if (!data) return availableRewards;
    return [...availableRewards].sort((a, b) => {
      const aOk = data.points >= a.pointsCost ? 0 : 1;
      const bOk = data.points >= b.pointsCost ? 0 : 1;
      if (aOk !== bOk) return aOk - bOk;
      return a.pointsCost - b.pointsCost;
    });
  }, [availableRewards, data]);

  /* ── Smart nudge: closest locked reward ── */
  const smartNudge = useMemo(() => {
    if (!data || !availableRewards.length) return null;
    const locked = availableRewards
      .filter(r => r.pointsCost > data.points)
      .sort((a, b) => a.pointsCost - b.pointsCost);
    if (!locked.length) return null;
    const closest = locked[0];
    const ptsNeeded = closest.pointsCost - data.points;
    const moneyNeeded = data.amountPerPoints > 0 && data.pointsPerAmount > 0
      ? Math.ceil((ptsNeeded * data.amountPerPoints) / data.pointsPerAmount)
      : null;
    return { reward: closest, ptsNeeded, moneyNeeded, percent: Math.round((data.points / closest.pointsCost) * 100) };
  }, [data, availableRewards]);

  /* ── Product helper ── */
  const getProductForReward = useCallback((reward) => {
    if (reward.type !== 'free_product' || !reward.productId) return null;
    return products.find(p => p._id === reward.productId) || null;
  }, [products]);

  /* ── Redeem free product ── */
  const handleRedeemFreeProduct = useCallback(async (reward) => {
    if (!phone || !businessId || redeeming) return;
    if (data.points < reward.pointsCost) return;
    const product = getProductForReward(reward);
    if (!product && !reward.productName) return;
    setRedeeming(reward._id);
    try {
      await api.post('/loyalty/redeem', { businessId, phone, rewardId: reward._id });
      if (addToCart) {
        addToCart({
          _id: product?._id || reward.productId,
          name: product?.name || reward.productName,
          price: 0, finalPrice: 0,
          image: product?.image || '',
          quantity: 1, selectedToppings: [],
          isLoyaltyReward: true,
          loyaltyRewardName: reward.name
        });
      }
      await fetchBalance();
      onClose();
    } catch (err) {
      console.error('Error redeeming:', err);
      alert('No se pudo canjear. Intenta de nuevo.');
    } finally {
      setRedeeming(null);
    }
  }, [phone, businessId, data, redeeming, getProductForReward, addToCart, fetchBalance, onClose]);

  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="loyalty-page"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex flex-col"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative mt-8 flex-1 bg-gradient-to-b from-slate-50 to-white rounded-t-3xl overflow-hidden flex flex-col"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Scrollbar hide */}
            <style>{`.lp-scroll::-webkit-scrollbar{display:none}`}</style>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-safe lp-scroll" style={{ scrollbarWidth: 'none' }}>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${btnColor}33`, borderTopColor: btnColor }} />
                </div>
              ) : !data ? (
                <div className="text-center py-20 px-6">
                  <Star className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-bold text-slate-700 mb-1">Programa no disponible</h3>
                  <p className="text-sm text-slate-400">Este negocio aún no tiene un programa de fidelidad activo.</p>
                </div>
              ) : (
                <motion.div
                  className="px-4 pt-2 pb-8 space-y-5"
                  variants={stagger}
                  initial="hidden"
                  animate="visible"
                >

                  {/* ═══════════════════════════════════════════ */}
                  {/*  1. HERO CARD — Holographic VIP Wallet      */}
                  {/* ═══════════════════════════════════════════ */}
                  <motion.div
                    variants={fadeUp}
                    className="relative overflow-hidden rounded-2xl shadow-xl"
                    style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}cc, ${btnColor}88)` }}
                  >
                    {/* Shimmer sweep */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                      <motion.div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 48%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.18) 52%, transparent 60%)' }}
                        animate={{ x: ['-100%', '250%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
                      />
                    </div>

                    {/* Decorative orbs */}
                    <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10" />
                    <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-white/[0.06]" />
                    <div className="absolute top-1/3 right-1/3 w-20 h-20 rounded-full bg-white/[0.04]" />

                    <div className="relative z-20 p-5">
                      {/* Top: Business name + Tier badge */}
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                            {businessName || 'Programa de fidelidad'}
                          </p>
                          {currentTier && (
                            <motion.div
                              initial={{ scale: 0, rotate: -20 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', delay: 0.5 }}
                              className="flex items-center gap-1.5 mt-1.5"
                            >
                              {(() => { const TierIcon = getTierIcon(currentTier); return <TierIcon className="w-4 h-4 text-white" />; })()}
                              <span className="text-xs font-black uppercase tracking-wider text-white/90">{currentTier}</span>
                            </motion.div>
                          )}
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/10">
                          <Trophy className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      {/* Points — Animated Odometer */}
                      <div className="mb-5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black text-white tracking-tight">
                            <AnimatedCounter value={data.points} />
                          </span>
                          <span className="text-sm font-semibold text-white/60">puntos</span>
                        </div>
                        <p className="text-[10px] text-white/40 mt-1 font-medium">
                          Total histórico: {(data.totalEarned || 0).toLocaleString('es-CO')} pts acumulados
                        </p>
                      </div>

                      {/* Earning rate pill */}
                      <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2.5 border border-white/10">
                        <Flame className="w-4 h-4 text-white" />
                        <span className="text-xs font-bold text-white/90">
                          {data.pointsPerAmount} pto{data.pointsPerAmount > 1 ? 's' : ''} por cada ${Number(data.amountPerPoints).toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>

                    {/* Bottom strip — card number feel */}
                    <div className="relative z-20 flex items-center justify-between px-5 py-2.5 border-t border-white/10 bg-black/10">
                      <span className="text-[9px] font-mono text-white/30 tracking-widest">
                        •••• •••• {phone?.slice(-4) || '0000'}
                      </span>
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">MEMBER</span>
                    </div>
                  </motion.div>

                  {/* ═══════════════════════════════════════════ */}
                  {/*  2. SMART NUDGE — Psychological Push        */}
                  {/* ═══════════════════════════════════════════ */}
                  {smartNudge && (
                    <motion.div
                      variants={fadeUp}
                      className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <motion.div
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0"
                        >
                          <Flame className="w-5 h-5 text-amber-600" />
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-amber-800">¡Estás cerca!</p>
                          <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                            Te faltan <strong>{smartNudge.ptsNeeded.toLocaleString('es-CO')} puntos</strong> para{' '}
                            <strong className="text-amber-900">{smartNudge.reward.name}</strong>.
                            {smartNudge.moneyNeeded && (
                              <> Agrega <strong>${smartNudge.moneyNeeded.toLocaleString('es-CO')}</strong> a tu {isService ? 'cita' : 'pedido'} y ¡lo desbloqueas! 🎉</>
                            )}
                          </p>
                          {/* Mini progress */}
                          <div className="mt-2 w-full h-2 bg-amber-200/50 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
                              initial={{ width: 0 }}
                              animate={{ width: `${smartNudge.percent}%` }}
                              transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                            />
                          </div>
                          <p className="text-[9px] text-amber-500 mt-1 font-bold text-right">{smartNudge.percent}% completado</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ═══════════════════════════════════════════ */}
                  {/*  3. REWARDS CAROUSEL — Netflix-style        */}
                  {/* ═══════════════════════════════════════════ */}
                  {sortedRewards.length > 0 && (
                    <motion.div variants={fadeUp}>
                      <div className="flex items-center justify-between mb-3 px-0.5">
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-slate-700" />
                          <h3 className="text-sm font-black text-slate-800">Recompensas</h3>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {sortedRewards.filter(r => data.points >= r.pointsCost).length}/{sortedRewards.length} disponibles
                        </span>
                      </div>

                      {/* Horizontal scroll */}
                      <div
                        className="overflow-x-auto -mx-4 px-4 pb-2 lp-scroll"
                        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
                      >
                        <div className="flex gap-3" style={{ width: 'max-content' }}>
                          {sortedRewards.map((reward, idx) => {
                            const canAfford = data.points >= reward.pointsCost;
                            const progress = Math.min(100, (data.points / reward.pointsCost) * 100);
                            const remaining = Math.max(0, reward.pointsCost - data.points);
                            const product = getProductForReward(reward);
                            const isRedeeming = redeeming === reward._id;
                            const RewardIcon = REWARD_ICONS[reward.type] || Gift;

                            return (
                              <motion.div
                                key={reward._id}
                                style={{ scrollSnapAlign: 'start', width: '240px' }}
                                className="flex-shrink-0"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.08 }}
                              >
                                <div className={`rounded-2xl border overflow-hidden transition-all h-full flex flex-col ${
                                  canAfford
                                    ? 'bg-white border-green-200 shadow-lg shadow-green-100/50'
                                    : 'bg-white/80 border-slate-150'
                                }`}>
                                  {/* Product image (free_product only) */}
                                  {reward.type === 'free_product' && product?.image && (
                                    <div className="h-28 bg-slate-100 overflow-hidden relative">
                                      <img
                                        src={product.image}
                                        alt={product.name}
                                        className={`w-full h-full object-cover transition-all ${!canAfford ? 'grayscale opacity-60' : ''}`}
                                      />
                                      {!canAfford && (
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                          <Lock className="w-7 h-7 text-white" />
                                        </div>
                                      )}
                                      {canAfford && (
                                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500 text-white text-[9px] font-black shadow-md">
                                          <Check className="w-2.5 h-2.5" /> Disponible
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="p-3.5 flex-1 flex flex-col">
                                    {/* Header: icon/ring + name */}
                                    <div className="flex items-start gap-2.5 mb-2">
                                      {canAfford ? (
                                        <motion.div
                                          animate={{ scale: [1, 1.15, 1] }}
                                          transition={{ duration: 1.5, repeat: Infinity }}
                                          className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0"
                                        >
                                          <RewardIcon className="w-5 h-5 text-green-600" />
                                        </motion.div>
                                      ) : (
                                        <ProgressRing percent={progress} size={40} stroke={3} color={btnColor} />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-slate-800 leading-tight">{reward.name}</p>
                                        {reward.description && (
                                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{reward.description}</p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Reward details */}
                                    <p className="text-[10px] text-slate-500 mb-2">
                                      {reward.type === 'discount_percent' && `${reward.discountValue}% de descuento`}
                                      {reward.type === 'discount_fixed' && `$${Number(reward.discountValue).toLocaleString('es-CO')} de descuento`}
                                      {reward.type === 'free_product' && `${reward.productName || (isService ? 'Servicio gratis' : 'Producto gratis')}`}
                                      {reward.type === 'free_delivery' && 'Envío gratuito'}
                                    </p>

                                    {/* Points + status */}
                                    <div className="flex items-center justify-between mt-auto">
                                      <span className={`text-xs font-black px-2 py-1 rounded-lg ${
                                        canAfford ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                                      }`}>
                                        {reward.pointsCost.toLocaleString('es-CO')} pts
                                      </span>
                                      {!canAfford && (
                                        <span className="text-[9px] text-slate-400 font-semibold">
                                          Faltan {remaining.toLocaleString('es-CO')}
                                        </span>
                                      )}
                                    </div>

                                    {/* Action button */}
                                    {canAfford && reward.type === 'free_product' && (
                                      <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleRedeemFreeProduct(reward)}
                                        disabled={isRedeeming}
                                        className="mt-3 w-full py-2.5 rounded-xl text-white text-xs font-black transition-all disabled:opacity-50 shadow-md"
                                        style={{ backgroundColor: btnColor }}
                                      >
                                        {isRedeeming ? (
                                          <span className="flex items-center justify-center gap-1.5">
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Canjeando...
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center justify-center gap-1.5">
                                            <Gift className="w-3.5 h-3.5" /> {isService ? 'Agregar a la cita gratis' : 'Agregar al pedido gratis'}
                                          </span>
                                        )}
                                      </motion.button>
                                    )}
                                    {canAfford && reward.type !== 'free_product' && (
                                      <div className="mt-3 w-full py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-[11px] font-bold text-center inline-flex items-center justify-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5" /> Se aplica al ordenar
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Swipe hint */}
                      {sortedRewards.length > 1 && (
                        <p className="text-[9px] text-slate-300 text-center mt-1 font-medium">← Desliza para ver más →</p>
                      )}

                      <p className="text-[9px] text-center text-slate-400 mt-2">
                        {isService ? 'Los descuentos se aplican automáticamente al momento de tu cita' : 'Los descuentos se aplican automáticamente al momento de hacer tu pedido'}
                      </p>
                    </motion.div>
                  )}

                  {/* ═══════════════════════════════════════════ */}
                  {/*  4. TIER ROADMAP — Hero&apos;s Path           */}
                  {/* ═══════════════════════════════════════════ */}
                  {sortedTiers.length > 0 && (
                    <motion.div
                      variants={fadeUp}
                      className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Map className="w-4 h-4 text-slate-700" />
                        <h3 className="text-sm font-black text-slate-800">Tu camino</h3>
                        {nextTier && (
                          <span
                            className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: btnColor + '15', color: btnColor }}
                          >
                            {pointsToNext.toLocaleString('es-CO')} pts para {nextTier.name}
                          </span>
                        )}
                      </div>

                      {/* Horizontal roadmap */}
                      <div className="overflow-x-auto lp-scroll" style={{ scrollbarWidth: 'none' }}>
                        <div
                          className="flex items-center py-2"
                          style={{ minWidth: sortedTiers.length > 3 ? 'max-content' : '100%' }}
                        >
                          {sortedTiers.map((tier, idx) => {
                            const isCompleted = idx < currentTierIndex;
                            const isCurrent = idx === currentTierIndex;
                            const isLocked = idx > currentTierIndex;

                            return (
                              <React.Fragment key={tier._id || idx}>
                                {/* Node */}
                                <div className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ minWidth: '72px' }}>
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', delay: idx * 0.15 }}
                                    className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${
                                      isCurrent
                                        ? 'border-amber-400 bg-amber-50 shadow-lg shadow-amber-200/60 ring-4 ring-amber-100'
                                        : isCompleted
                                          ? 'border-green-300 bg-green-50'
                                          : 'border-slate-200 bg-slate-50 opacity-50'
                                    }`}
                                  >
                                    {isCompleted
                                      ? <CheckCircle2 className="w-6 h-6 text-green-600" />
                                      : (() => { const TierIcon = getTierIcon(tier.name); return <TierIcon className={`w-6 h-6 ${isCurrent ? 'text-amber-600' : 'text-slate-400'}`} />; })()}
                                  </motion.div>
                                  <p className={`text-[10px] font-bold text-center leading-tight ${
                                    isCurrent ? 'text-amber-700' : isCompleted ? 'text-green-600' : 'text-slate-400'
                                  }`}>
                                    {tier.name}
                                  </p>
                                  {isCurrent && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-black uppercase">
                                      Aquí estás
                                    </span>
                                  )}
                                  {isLocked && (
                                    <span className="text-[8px] text-slate-400 font-medium">
                                      {tier.minPoints.toLocaleString('es-CO')} pts
                                    </span>
                                  )}
                                  {tier.multiplier > 1 && (
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                                      isLocked ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      ×{tier.multiplier} puntos
                                    </span>
                                  )}
                                </div>

                                {/* Connector */}
                                {idx < sortedTiers.length - 1 && (
                                  <div className="flex-1 h-1 mx-1.5 rounded-full bg-slate-100 overflow-hidden min-w-[28px]">
                                    {(isCompleted || isCurrent) && (
                                      <motion.div
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: isCompleted ? '#22c55e' : btnColor }}
                                        initial={{ width: '0%' }}
                                        animate={{
                                          width: isCompleted ? '100%' : `${isCurrent && nextTier ? progressToNext : 0}%`
                                        }}
                                        transition={{ duration: 1, ease: 'easeOut', delay: 0.5 + idx * 0.2 }}
                                      />
                                    )}
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>

                      {/* Progress bar to next tier */}
                      {nextTier && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-slate-500 font-semibold">
                              Progreso a <strong className="text-slate-700">{nextTier.name}</strong>
                            </span>
                            <span className="font-black" style={{ color: btnColor }}>
                              {Math.round(progressToNext)}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressToNext}%` }}
                              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                              className="h-full rounded-full"
                              style={{ background: `linear-gradient(90deg, ${btnColor}, ${btnColor}aa)` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                            Te faltan <strong className="text-slate-600">{pointsToNext.toLocaleString('es-CO')}</strong> puntos
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ═══════════════════════════════════════════ */}
                  {/*  5. HOW IT WORKS                             */}
                  {/* ═══════════════════════════════════════════ */}
                  <motion.div variants={fadeUp} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
                    <h3 className="text-sm font-black text-slate-800 mb-3">¿Cómo funciona?</h3>
                    <div className="space-y-3">
                      {[
                        { icon: CalendarCheck, title: isService ? 'Agenda tu cita' : 'Haz tu pedido', desc: `Ganas ${data.pointsPerAmount} punto${data.pointsPerAmount > 1 ? 's' : ''} por cada $${Number(data.amountPerPoints).toLocaleString('es-CO')} en compras` },
                        { icon: Star, title: 'Acumula puntos', desc: isService ? 'Tus puntos se suman automáticamente con cada cita' : 'Tus puntos se suman automáticamente con cada compra' },
                        { icon: Gift, title: 'Canjea recompensas', desc: isService ? 'Usa tus puntos al reservar para obtener descuentos y servicios gratis' : 'Usa tus puntos al ordenar para obtener descuentos y productos gratis' }
                      ].map((step, i) => (
                        <motion.div key={i} variants={fadeUp} className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-100 flex items-center justify-center flex-shrink-0">
                            <step.icon className="w-5 h-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">{step.title}</p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{step.desc}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  {/* ═══════════════════════════════════════════ */}
                  {/*  6. TRANSACTION HISTORY                      */}
                  {/* ═══════════════════════════════════════════ */}
                  {data.recentTransactions?.length > 0 && (
                    <motion.div variants={fadeUp} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                      <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-slate-700" />
                          <h3 className="text-sm font-black text-slate-800">Historial</h3>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 font-bold">
                            {data.recentTransactions.length}
                          </span>
                        </div>
                        <motion.div animate={{ rotate: showHistory ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </motion.div>
                      </button>

                      <AnimatePresence>
                        {showHistory && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 space-y-1">
                              {data.recentTransactions.map((tx, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.04 }}
                                  className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                                      tx.points > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                                    }`}>
                                      {tx.points > 0 ? '＋' : '−'}
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-slate-700">{tx.description}</p>
                                      {tx.createdAt && (
                                        <p className="text-[9px] text-slate-300 font-medium">
                                          {new Date(tx.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-black tabular-nums ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {tx.points > 0 ? '+' : ''}{tx.points}
                                  </span>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* Bottom spacer */}
                  <div className="h-4" />

                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(LoyaltyPage);

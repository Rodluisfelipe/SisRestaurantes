import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { getBusinessSlug } from '../utils/getBusinessId';

/* ─── Inline SVG icons ─── */
const StarIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
);
const GiftIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></svg>
);
const TrophyIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6" /><path d="M18 9h1.5a2.5 2.5 0 000-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" /><path d="M18 2H6v7a6 6 0 0012 0V2z" /></svg>
);
const FireIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.6 0-8-3.1-8-8.5C4 9.7 8.4 3.7 11.4.6c.3-.3.8-.3 1.1 0C15.6 3.7 20 9.7 20 14.5c0 5.4-4.4 8.5-8 8.5zm0-19.7C9.7 6.4 6.5 11.1 6.5 14.5 6.5 18.6 9.6 21 12 21s5.5-2.4 5.5-6.5C17.5 11.1 14.3 6.4 12 3.3z"/></svg>
);
const CloseIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const ChevronIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6" /></svg>
);

/* ─── Tier default configs ─── */
const TIER_ICONS = {
  bronze:  '🥉',
  silver:  '🥈',
  gold:    '🥇',
  platinum:'💎',
  diamond: '💎',
  default: '⭐'
};

const getTierEmoji = (tierName) => {
  if (!tierName) return '⭐';
  const key = tierName.toLowerCase();
  for (const [k, v] of Object.entries(TIER_ICONS)) {
    if (key.includes(k)) return v;
  }
  return '⭐';
};

const REWARD_TYPE_LABELS = {
  free_product: '🍽️ Producto gratis',
  discount_percent: '💰 Descuento %',
  discount_fixed: '💵 Descuento fijo',
  free_delivery: '🛵 Envío gratis'
};

const LoyaltyPage = ({ show, onClose, phone, businessId, businessName, theme, products = [], addToCart }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [redeeming, setRedeeming] = useState(null);

  const btnColor = theme?.buttonColor || '#f97316';
  const btnText = theme?.buttonTextColor || '#ffffff';

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

  useEffect(() => {
    if (show) fetchBalance();
  }, [show, fetchBalance]);

  // Computed data
  const currentTier = data?.currentTier || '';
  const sortedTiers = useMemo(() => {
    if (!data?.tiers?.length) return [];
    return [...data.tiers].sort((a, b) => a.minPoints - b.minPoints);
  }, [data?.tiers]);

  const currentTierIndex = sortedTiers.findIndex(t => t.name === currentTier);
  const nextTier = sortedTiers[currentTierIndex + 1] || null;
  const currentTierObj = sortedTiers[currentTierIndex] || (sortedTiers.length ? sortedTiers[0] : null);

  const progressToNext = nextTier
    ? Math.min(100, ((data?.totalEarned || 0) / nextTier.minPoints) * 100)
    : 100;

  const pointsToNext = nextTier
    ? Math.max(0, nextTier.minPoints - (data?.totalEarned || 0))
    : 0;

  const availableRewards = useMemo(() => {
    if (!data?.rewards) return [];
    return data.rewards.filter(r => r.isActive);
  }, [data?.rewards]);

  // Find the full product data for a reward's productId
  const getProductForReward = useCallback((reward) => {
    if (reward.type !== 'free_product' || !reward.productId) return null;
    return products.find(p => p._id === reward.productId) || null;
  }, [products]);

  // Handle redeeming a free product reward
  const handleRedeemFreeProduct = useCallback(async (reward) => {
    if (!phone || !businessId || redeeming) return;
    if (data.points < reward.pointsCost) return;

    const product = getProductForReward(reward);
    if (!product && !reward.productName) return;

    setRedeeming(reward._id);
    try {
      // Redeem points immediately for free product
      await api.post('/loyalty/redeem', {
        businessId,
        phone,
        rewardId: reward._id
      });

      // Add product to cart with price 0 and loyalty tag
      if (addToCart) {
        addToCart({
          _id: product?._id || reward.productId,
          name: product?.name || reward.productName,
          price: 0,
          finalPrice: 0,
          image: product?.image || '',
          quantity: 1,
          selectedToppings: [],
          isLoyaltyReward: true,
          loyaltyRewardName: reward.name
        });
      }

      // Refresh balance
      await fetchBalance();

      // Close loyalty page so user sees the cart
      onClose();
    } catch (err) {
      console.error('Error redeeming free product:', err);
      alert('No se pudo canjear la recompensa. Intenta de nuevo.');
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
          {/* ─── Backdrop ─── */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

          {/* ─── Main Panel ─── */}
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

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
            >
              <CloseIcon className="w-4 h-4" />
            </button>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${btnColor}33`, borderTopColor: btnColor }} />
                </div>
              ) : !data ? (
                <div className="text-center py-20 px-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                    <StarIcon className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-1">Programa no disponible</h3>
                  <p className="text-sm text-slate-400">Este restaurante aún no tiene un programa de fidelidad activo.</p>
                </div>
              ) : (
                <div className="px-4 pt-2 pb-8 space-y-5">

                  {/* ══════ HERO: Points Card ══════ */}
                  <div
                    className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}dd, ${btnColor}aa)` }}
                  >
                    {/* Decorative circles */}
                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 bg-white" />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-[0.07] bg-white" />
                    <div className="absolute top-1/2 right-1/4 w-20 h-20 rounded-full opacity-[0.05] bg-white" />

                    <div className="relative z-10">
                      {/* Top: business name + tier */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs font-medium opacity-80 uppercase tracking-wider">
                            {businessName || 'Programa de fidelidad'}
                          </p>
                          {currentTier && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-base">{getTierEmoji(currentTier)}</span>
                              <span className="text-sm font-bold uppercase tracking-wide">{currentTier}</span>
                            </div>
                          )}
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <TrophyIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      {/* Points display — big and bold */}
                      <div className="mb-4">
                        <div className="flex items-baseline gap-2">
                          <motion.span
                            key={data.points}
                            initial={{ scale: 1.3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-4xl font-black tabular-nums"
                          >
                            {data.points.toLocaleString('es-CO')}
                          </motion.span>
                          <span className="text-sm font-medium opacity-70">puntos</span>
                        </div>
                        <p className="text-[11px] opacity-60 mt-0.5">
                          Total acumulado: {(data.totalEarned || 0).toLocaleString('es-CO')} pts
                        </p>
                      </div>

                      {/* Earning rate */}
                      <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2">
                        <FireIcon className="w-4 h-4 text-yellow-300" />
                        <span className="text-xs font-medium">
                          Ganas {data.pointsPerAmount} punto{data.pointsPerAmount > 1 ? 's' : ''} por cada ${Number(data.amountPerPoints).toLocaleString('es-CO')} en compras
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ══════ TIER PROGRESS ══════ */}
                  {sortedTiers.length > 0 && (
                    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <TrophyIcon className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-slate-800">Tu nivel</h3>
                      </div>

                      {/* Tier ladder */}
                      <div className="relative">
                        {/* Progress line background */}
                        <div className="absolute left-[18px] top-4 bottom-4 w-0.5 bg-slate-100" />

                        <div className="space-y-0">
                          {sortedTiers.map((tier, idx) => {
                            const isActive = idx <= currentTierIndex;
                            const isCurrent = tier.name === currentTier;
                            const isLocked = idx > currentTierIndex;

                            return (
                              <div key={tier._id || idx} className="relative flex items-center gap-3 py-2.5">
                                {/* Node */}
                                <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-base border-2 transition-all ${
                                  isCurrent
                                    ? 'border-amber-400 bg-amber-50 shadow-md shadow-amber-200/50 scale-110'
                                    : isActive
                                      ? 'border-green-400 bg-green-50'
                                      : 'border-slate-200 bg-slate-50'
                                }`}>
                                  {getTierEmoji(tier.name)}
                                </div>

                                {/* Tier info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${isCurrent ? 'text-amber-700' : isActive ? 'text-green-700' : 'text-slate-400'}`}>
                                      {tier.name}
                                    </span>
                                    {isCurrent && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold uppercase">Actual</span>
                                    )}
                                    {isLocked && (
                                      <span className="text-[9px] text-slate-400">{tier.minPoints.toLocaleString('es-CO')} pts</span>
                                    )}
                                  </div>
                                  {tier.benefits?.length > 0 && (
                                    <p className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-500' : 'text-slate-300'}`}>
                                      {tier.benefits.join(' · ')}
                                    </p>
                                  )}
                                  {tier.multiplier > 1 && (
                                    <span className={`text-[10px] font-semibold ${isActive ? 'text-amber-600' : 'text-slate-300'}`}>
                                      ×{tier.multiplier} puntos
                                    </span>
                                  )}
                                </div>

                                {/* Checkmark for completed tiers */}
                                {isActive && !isCurrent && (
                                  <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Progress bar to next tier */}
                      {nextTier && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[11px] mb-1.5">
                            <span className="text-slate-500 font-medium">Progreso a <strong className="text-slate-700">{nextTier.name}</strong></span>
                            <span className="font-bold" style={{ color: btnColor }}>{Math.round(progressToNext)}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressToNext}%` }}
                              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                              className="h-full rounded-full"
                              style={{ background: `linear-gradient(90deg, ${btnColor}, ${btnColor}cc)` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                            Te faltan <strong className="text-slate-600">{pointsToNext.toLocaleString('es-CO')}</strong> puntos para alcanzar <strong className="text-slate-600">{nextTier.name}</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {availableRewards.length > 0 && (
                    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <GiftIcon className="w-4 h-4 text-pink-500" />
                        <h3 className="text-sm font-bold text-slate-800">Recompensas disponibles</h3>
                      </div>
                      <div className="space-y-2">
                        {availableRewards.map(reward => {
                          const canAfford = data.points >= reward.pointsCost;
                          const progress = Math.min(100, (data.points / reward.pointsCost) * 100);
                          const remaining = Math.max(0, reward.pointsCost - data.points);
                          const product = getProductForReward(reward);
                          const isRedeeming = redeeming === reward._id;

                          return (
                            <div
                              key={reward._id}
                              className={`rounded-xl p-3 border transition-all ${
                                canAfford
                                  ? 'border-green-200 bg-green-50/50'
                                  : 'border-slate-100 bg-slate-50/50'
                              }`}
                            >
                              {/* Product image for free_product */}
                              {reward.type === 'free_product' && product?.image && (
                                <div className="w-full h-28 rounded-lg overflow-hidden mb-2 bg-slate-100">
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}

                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                                  canAfford ? 'bg-green-100' : 'bg-slate-100'
                                }`}>
                                  {reward.type === 'free_product' ? '🍽️' : reward.type === 'free_delivery' ? '🛵' : '🎁'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-800">{reward.name}</p>
                                  {reward.description && (
                                    <p className="text-[11px] text-slate-400 mt-0.5">{reward.description}</p>
                                  )}
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {REWARD_TYPE_LABELS[reward.type] || reward.type}
                                    {(reward.type === 'discount_percent' || reward.type === 'discount_fixed') && (
                                      <> · {reward.type === 'discount_percent' ? `${reward.discountValue}%` : `$${reward.discountValue.toLocaleString('es-CO')}`}</>
                                    )}
                                    {reward.type === 'free_product' && reward.productName && (
                                      <> · {reward.productName}</>
                                    )}
                                  </p>

                                  {/* Mini progress bar */}
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                                      <span className={canAfford ? 'text-green-600 font-bold' : 'text-slate-400'}>
                                        {canAfford ? '✓ Disponible para canjear' : `Faltan ${remaining.toLocaleString('es-CO')} pts`}
                                      </span>
                                      <span className="text-slate-500 font-semibold">{reward.pointsCost.toLocaleString('es-CO')} pts</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: canAfford ? '#22c55e' : btnColor }}
                                      />
                                    </div>
                                  </div>

                                  {/* Redeem button for free_product */}
                                  {reward.type === 'free_product' && canAfford && (
                                    <button
                                      onClick={() => handleRedeemFreeProduct(reward)}
                                      disabled={isRedeeming}
                                      className="mt-2 w-full py-2 rounded-lg text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                                      style={{ backgroundColor: btnColor }}
                                    >
                                      {isRedeeming ? 'Canjeando...' : '🎁 Canjear y agregar al pedido'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-center text-slate-400 mt-3">
                        Los descuentos se aplican al momento de hacer tu pedido desde el carrito
                      </p>
                    </div>
                  )}

                  {/* ══════ HOW IT WORKS ══════ */}
                  <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-slate-800 mb-3">¿Cómo funciona?</h3>
                    <div className="space-y-3">
                      {[
                        { icon: '🛒', title: 'Haz tu pedido', desc: `Ganas ${data.pointsPerAmount} punto${data.pointsPerAmount > 1 ? 's' : ''} por cada $${Number(data.amountPerPoints).toLocaleString('es-CO')} en compras` },
                        { icon: '⭐', title: 'Acumula puntos', desc: 'Tus puntos se suman automáticamente con cada compra' },
                        { icon: '🎁', title: 'Canjea recompensas', desc: 'Usa tus puntos al momento de ordenar para obtener descuentos y productos gratis' }
                      ].map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-base flex-shrink-0">
                            {step.icon}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">{step.title}</p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{step.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ══════ TRANSACTIONS HISTORY ══════ */}
                  {data.recentTransactions?.length > 0 && (
                    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                      <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          <h3 className="text-sm font-bold text-slate-800">Historial de movimientos</h3>
                        </div>
                        <ChevronIcon className={`w-4 h-4 text-slate-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {showHistory && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 space-y-1.5">
                              {data.recentTransactions.map((tx, i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                                      tx.points > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                                    }`}>
                                      {tx.points > 0 ? '＋' : '−'}
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700">{tx.description}</p>
                                      {tx.createdAt && (
                                        <p className="text-[10px] text-slate-300">
                                          {new Date(tx.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-bold tabular-nums ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {tx.points > 0 ? '+' : ''}{tx.points}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(LoyaltyPage);

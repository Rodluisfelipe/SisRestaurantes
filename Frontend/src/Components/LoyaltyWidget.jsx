import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { getBusinessSlug } from '../utils/getBusinessId';

/* ── small helpers ── */
const StarIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
);
const GiftIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></svg>
);
const CheckIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

const LoyaltyWidget = ({ phone, businessId, theme, onRewardSelected, orderMode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedRewardId, setSelectedRewardId] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const btnColor = theme?.buttonColor || '#f97316';

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

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const availableRewards = useMemo(() => {
    if (!data?.rewards) return [];
    return data.rewards.filter(r => {
      if (!r.isActive) return false;
      // free_product rewards are redeemed from LoyaltyPage, not widget
      if (r.type === 'free_product') return false;
      if (orderMode && r.applicableOrderModes?.length > 0) {
        return r.applicableOrderModes.includes(orderMode);
      }
      return true;
    });
  }, [data, orderMode]);

  const handleToggleReward = (reward) => {
    if (data.points < reward.pointsCost) return;
    const isSelected = selectedRewardId === reward._id;
    if (isSelected) {
      // Deselect
      setSelectedRewardId(null);
      if (onRewardSelected) onRewardSelected(null);
    } else {
      // Select this reward (preview only, not yet redeemed)
      setSelectedRewardId(reward._id);
      if (onRewardSelected) onRewardSelected({
        rewardId: reward._id,
        pointsCost: reward.pointsCost,
        reward: {
          name: reward.name,
          type: reward.type,
          discountValue: reward.discountValue,
          maxDiscount: reward.maxDiscount,
          productId: reward.productId,
          productName: reward.productName
        }
      });
    }
  };

  // Don't show anything if no phone, not active, or loading
  if (!phone || loading || !data) return null;

  const currentTier = data.currentTier;
  const nextTier = data.tiers?.length
    ? data.tiers.filter(t => t.minPoints > data.totalEarned).sort((a, b) => a.minPoints - b.minPoints)[0]
    : null;
  const progress = nextTier ? Math.min(100, (data.totalEarned / nextTier.minPoints) * 100) : 100;

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <StarIcon className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-amber-800">{data.points} puntos</span>
            {currentTier && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-200/60 text-amber-700 font-semibold">{currentTier}</span>
            )}
          </div>
          <p className="text-[10px] text-amber-600/80 leading-tight">
            Ganas {data.pointsPerAmount} pto{data.pointsPerAmount > 1 ? 's' : ''} por ${Number(data.amountPerPoints).toLocaleString('es-CO')}
          </p>
        </div>
        <svg className={`w-4 h-4 text-amber-400 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2.5">
              {/* Tier progress */}
              {nextTier && (
                <div>
                  <div className="flex items-center justify-between text-[10px] text-amber-600 mb-1">
                    <span>{currentTier || 'Inicio'}</span>
                    <span>{nextTier.name} ({nextTier.minPoints} pts)</span>
                  </div>
                  <div className="w-full h-1.5 bg-amber-200/50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: btnColor }} />
                  </div>
                </div>
              )}

              {/* Available rewards */}
              {availableRewards.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Canjear puntos</p>
                  <div className="space-y-1.5">
                    {availableRewards.map(reward => {
                      const canRedeem = data.points >= reward.pointsCost;
                      const isSelected = selectedRewardId === reward._id;
                      return (
                        <div key={reward._id} className={`flex items-center gap-2 p-2 rounded-lg border ${
                          isSelected ? 'bg-green-50 border-green-300' : 'bg-white/70 border-amber-100'
                        }`}>
                          {isSelected ? <CheckIcon className="w-4 h-4 text-green-600 flex-shrink-0" /> : <GiftIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-slate-700 truncate">{reward.name}</p>
                            <p className="text-[10px] text-slate-400">{reward.pointsCost} puntos</p>
                          </div>
                          <button
                            onClick={() => handleToggleReward(reward)}
                            disabled={!canRedeem && !isSelected}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                              isSelected
                                ? 'bg-green-500 text-white active:scale-95'
                                : canRedeem
                                  ? 'text-white active:scale-95'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                            style={!isSelected && canRedeem ? { backgroundColor: btnColor } : {}}
                          >
                            {isSelected ? '✓ Aplicado' : canRedeem ? 'Aplicar' : `Faltan ${reward.pointsCost - data.points}`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent transactions */}
              {data.recentTransactions?.length > 0 && (
                <details className="group">
                  <summary className="text-[10px] font-semibold text-amber-600 cursor-pointer select-none">Historial reciente</summary>
                  <div className="mt-1.5 space-y-1">
                    {data.recentTransactions.slice(0, 5).map((tx, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                        <span className="truncate">{tx.description}</span>
                        <span className={`font-bold ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {tx.points > 0 ? '+' : ''}{tx.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(LoyaltyWidget);

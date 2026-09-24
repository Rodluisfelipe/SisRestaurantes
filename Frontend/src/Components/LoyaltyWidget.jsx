import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { getBusinessSlug } from '../utils/getBusinessId';
import { Star, Check } from 'lucide-react';
import { Boton } from './ui';

/**
 * Los puntos en el carrito: cuántos tienes y, si alcanzan, las recompensas
 * que se aplican a este pedido (descuentos, domicilio gratis). Los niveles y
 * el historial viven en "Mis puntos"; aquí solo lo que sirve para pagar.
 */
const LoyaltyWidget = ({ phone, businessId, onRewardSelected, orderMode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedRewardId, setSelectedRewardId] = useState(null);

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

  const alcanzan = availableRewards.filter((r) => data.points >= r.pointsCost);
  const siguiente = availableRewards
    .filter((r) => data.points < r.pointsCost)
    .sort((a, b) => a.pointsCost - b.pointsCost)[0];

  return (
    <div className="rounded-2xl border border-linea bg-superficie-tarjeta p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full bg-marca-suave text-marca flex items-center justify-center shrink-0">
          <Star className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-tinta">
            Tienes {data.points.toLocaleString('es-CO')} {data.points === 1 ? 'punto' : 'puntos'}
          </p>
          <p className="text-xs text-tinta-2">
            {alcanzan.length
              ? 'Puedes usarlos en este pedido'
              : siguiente
                ? `Te faltan ${(siguiente.pointsCost - data.points).toLocaleString('es-CO')} para ${siguiente.name}`
                : `Este pedido te suma puntos`}
          </p>
        </div>
      </div>

      {alcanzan.length > 0 && (
        <div className="mt-3 space-y-2">
          {alcanzan.map((reward) => {
            const elegida = selectedRewardId === reward._id;
            return (
              <div
                key={reward._id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${elegida ? 'border-exito bg-emerald-50' : 'border-linea'}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-tinta truncate">{reward.name}</p>
                  <p className="text-xs text-tinta-2">{reward.pointsCost.toLocaleString('es-CO')} puntos</p>
                </div>
                <Boton
                  tamano="sm"
                  variante={elegida ? 'accion' : 'secundario'}
                  icono={elegida ? <Check className="w-4 h-4" /> : null}
                  onClick={() => handleToggleReward(reward)}
                  aria-pressed={elegida}
                >
                  {elegida ? 'Aplicado' : 'Aplicar'}
                </Boton>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(LoyaltyWidget);

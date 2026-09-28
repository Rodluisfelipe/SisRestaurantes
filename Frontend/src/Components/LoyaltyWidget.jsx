import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { getBusinessSlug } from '../utils/getBusinessId';
import { Star, Check } from 'lucide-react';
import { Boton } from './ui';
import TarjetaSellos from './TarjetaSellos';

/* Con tarjeta de sellos: la tarjeta y, si la llenó, el botón para usar el
   premio en este pedido. El servidor es quien lo aplica y lo descuenta. */
function WidgetSellos({ tarjeta, cart, onRewardSelected }) {
  const [usar, setUsar] = useState(false);
  const { premio } = tarjeta;
  const faltaProducto = premio.tipo === 'free_product'
    && !(cart || []).some((i) => String(i._id || i.productId) === String(premio.productId));

  // Si quita el producto del premio del carrito, el premio se quita solo
  useEffect(() => {
    if (usar && faltaProducto) { setUsar(false); onRewardSelected?.(null); }
  }, [usar, faltaProducto, onRewardSelected]);

  const alternar = () => {
    const nuevo = !usar;
    setUsar(nuevo);
    onRewardSelected?.(nuevo ? {
      sellos: true,
      reward: { name: premio.nombre, type: premio.tipo, discountValue: premio.valor, maxDiscount: premio.tope, productId: premio.productId, productName: premio.productName },
    } : null);
  };

  return (
    <div className="rounded-2xl border border-linea bg-superficie-tarjeta p-3.5 space-y-3">
      <p className="text-sm font-bold text-tinta">Tu tarjeta de sellos</p>
      <TarjetaSellos requeridos={tarjeta.requeridos} sellos={tarjeta.sellos} premio={premio.nombre} color="var(--mb-accent, #2563eb)" compacta />
      {tarjeta.premiosDisponibles > 0 ? (
        <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${usar ? 'border-exito bg-emerald-50' : 'border-linea'}`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-tinta">¡Ganaste {premio.nombre}!</p>
            <p className="text-xs text-tinta-2">
              {faltaProducto ? `Agrega ${premio.productName || 'el producto'} al pedido para usarlo.` : 'Puedes usarlo en este pedido.'}
            </p>
          </div>
          <Boton tamano="sm" variante={usar ? 'accion' : 'secundario'} icono={usar ? <Check className="w-4 h-4" /> : null}
            onClick={alternar} disabled={faltaProducto} aria-pressed={usar}>
            {usar ? 'Usado' : 'Usar'}
          </Boton>
        </div>
      ) : (
        <p className="text-xs text-tinta-2">
          {tarjeta.montoMinimo > 0
            ? `Este pedido te suma un sello si es de $${Math.round(tarjeta.montoMinimo).toLocaleString('es-CO')} o más.`
            : 'Este pedido te suma un sello.'}{' '}
          Te {tarjeta.requeridos - tarjeta.sellos === 1 ? 'falta' : 'faltan'} {tarjeta.requeridos - tarjeta.sellos} para {premio.nombre}.
        </p>
      )}
    </div>
  );
}

/**
 * Los puntos en el carrito: cuántos tienes y, si alcanzan, las recompensas
 * que se aplican a este pedido (descuentos, domicilio gratis). Los niveles y
 * el historial viven en "Mis puntos"; aquí solo lo que sirve para pagar.
 */
const LoyaltyWidget = ({ phone, businessId, onRewardSelected, orderMode, cart }) => {
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
    if (!data?.rewards || data.mode === 'stamps') return [];
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
  if (data.mode === 'stamps' && data.tarjeta) {
    return <WidgetSellos tarjeta={data.tarjeta} cart={cart} onRewardSelected={onRewardSelected} />;
  }

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

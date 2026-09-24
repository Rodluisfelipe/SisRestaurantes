import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Gift, Lock, Receipt } from 'lucide-react';
import api from '../services/api';
import { getBusinessSlug } from '../utils/getBusinessId';
import { useBusinessConfig } from '../Context/BusinessContext';
import { esSinCuenta } from '../utils/cuentaCliente';
import MenuScreen from './MenuScreen';
import { Boton, Insignia, formatearPesos } from './ui';

const EMPTY_ARRAY = [];

/**
 * Los puntos del cliente y lo que puede canjear.
 *
 * Antes era una "tarjeta holográfica" con brillo animado, orbes, un número de
 * tarjeta de mentira, un contador que giraba y un carrusel de recompensas: se
 * veía hecho por máquina y costaba encontrar lo único que importa. Ahora
 * responde, en orden, las tres preguntas del cliente: ¿cuántos puntos tengo?,
 * ¿qué puedo canjear ya?, ¿cuánto me falta para lo siguiente?
 */

const puntosTxt = (n) => `${Number(n || 0).toLocaleString('es-CO')} ${Number(n) === 1 ? 'punto' : 'puntos'}`;

function queEs(reward, isService) {
  switch (reward.type) {
    case 'discount_percent': return `${reward.discountValue}% de descuento${reward.maxDiscount ? ` (hasta ${formatearPesos(reward.maxDiscount)})` : ''}`;
    case 'discount_fixed': return `${formatearPesos(reward.discountValue)} de descuento`;
    case 'free_delivery': return 'Domicilio gratis';
    case 'free_product': return reward.productName || (isService ? 'Servicio gratis' : 'Producto gratis');
    default: return '';
  }
}

const LoyaltyPage = ({ show, onClose, phone, businessId, businessName, products = EMPTY_ARRAY, addToCart }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sinCuenta, setSinCuenta] = useState(false);
  const [redeeming, setRedeeming] = useState(null);
  const [error, setError] = useState('');
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  const fetchBalance = useCallback(async () => {
    if (!phone || !businessId) { setLoading(false); setSinCuenta(true); return; }
    try {
      setLoading(true);
      setSinCuenta(false);
      const bid = businessId || getBusinessSlug();
      const { data: res } = await api.get('/loyalty/balance', { params: { businessId: bid, phone } });
      setData(res.active ? res : null);
    } catch (e) {
      if (esSinCuenta(e)) setSinCuenta(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [phone, businessId]);

  useEffect(() => { if (show) fetchBalance(); }, [show, fetchBalance]);

  const puntos = data?.points || 0;

  const recompensas = useMemo(() => {
    const activas = (data?.rewards || []).filter((r) => r.isActive);
    // Primero lo que ya se puede canjear; después, de la más cercana a la más lejana.
    return activas.sort((a, b) => {
      const ya = (r) => (puntos >= r.pointsCost ? 0 : 1);
      return ya(a) - ya(b) || a.pointsCost - b.pointsCost;
    });
  }, [data?.rewards, puntos]);

  const canjeables = recompensas.filter((r) => puntos >= r.pointsCost);
  const siguiente = recompensas.find((r) => r.pointsCost > puntos) || null;
  // Cuánto hay que gastar para llegar, que se entiende mejor que "X puntos".
  const plataParaSiguiente = siguiente && data?.amountPerPoints > 0 && data?.pointsPerAmount > 0
    ? Math.ceil(((siguiente.pointsCost - puntos) * data.amountPerPoints) / data.pointsPerAmount)
    : null;

  const niveles = useMemo(
    () => [...(data?.tiers || [])].sort((a, b) => a.minPoints - b.minPoints),
    [data?.tiers],
  );
  const nivelActual = data?.currentTier || '';
  const iNivel = niveles.findIndex((t) => t.name === nivelActual);
  const siguienteNivel = niveles[iNivel + 1] || null;

  const productoDe = useCallback(
    (reward) => (reward.type === 'free_product' && reward.productId
      ? products.find((p) => String(p._id) === String(reward.productId)) || null
      : null),
    [products],
  );

  /* Canjear un producto gratis: se descuentan los puntos y el producto entra
     al carrito en $0. Los descuentos y el domicilio gratis se aplican al pagar. */
  const canjear = useCallback(async (reward) => {
    if (!phone || !businessId || redeeming || puntos < reward.pointsCost) return;
    const producto = productoDe(reward);
    if (!producto && !reward.productName) return;
    setRedeeming(reward._id);
    setError('');
    try {
      await api.post('/loyalty/redeem', { businessId, phone, rewardId: reward._id });
      addToCart?.({
        _id: producto?._id || reward.productId,
        name: producto?.name || reward.productName,
        price: 0,
        finalPrice: 0,
        image: producto?.image || '',
        quantity: 1,
        selectedToppings: [],
        isLoyaltyReward: true,
        loyaltyRewardName: reward.name,
      });
      await fetchBalance();
      onClose();
    } catch {
      setError('No se pudo canjear. Intenta de nuevo.');
    } finally {
      setRedeeming(null);
    }
  }, [phone, businessId, redeeming, puntos, productoDe, addToCart, fetchBalance, onClose]);

  return (
    <MenuScreen open={show} onClose={onClose} title="Mis puntos" subtitle={businessName || undefined}>
      <div className="px-4 py-5 space-y-6 pb-10">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[96, 72, 64, 64].map((h, i) => <div key={i} className="rounded-2xl bg-superficie-2 animate-pulse" style={{ height: h }} />)}
          </div>
        ) : sinCuenta ? (
          <Aviso
            icono={<Receipt className="w-7 h-7" />}
            titulo="Tus puntos te esperan"
            texto="Tus puntos se ven en este celular desde tu primer pedido. Con cada compra sumas y aquí los canjeas."
            accion={<Boton className="mt-5" onClick={onClose}>Ver el menú</Boton>}
          />
        ) : !data ? (
          <Aviso
            icono={<Gift className="w-7 h-7" />}
            titulo="Sin programa de puntos"
            texto="Este negocio todavía no tiene un programa de puntos."
          />
        ) : (
          <>
            {/* 1. Cuántos puntos tengo */}
            <section>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-tinta-2">Tienes</p>
                  <p className="text-5xl font-black text-tinta tabular-nums leading-none mt-1">{puntos.toLocaleString('es-CO')}</p>
                  <p className="text-sm font-semibold text-tinta-2 mt-1">{puntos === 1 ? 'punto' : 'puntos'}</p>
                </div>
                {nivelActual && niveles.length > 0 && <Insignia tono="suave" className="text-xs">Nivel {nivelActual}</Insignia>}
              </div>
              {data.pointsPerAmount > 0 && data.amountPerPoints > 0 && (
                <p className="mt-3 text-sm text-tinta-2">
                  Ganas {puntosTxt(data.pointsPerAmount)} por cada {formatearPesos(data.amountPerPoints)} que {isService ? 'pagues' : 'pidas'}.
                </p>
              )}
            </section>

            {/* 2. Cuánto me falta para lo siguiente */}
            {siguiente && (
              <section className="rounded-2xl border border-linea bg-superficie-tarjeta p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-tinta-2">Tu próxima recompensa</p>
                <p className="mt-1 text-lg font-black text-tinta">{siguiente.name}</p>
                <div className="mt-3 h-2.5 rounded-full bg-superficie-2 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={siguiente.pointsCost} aria-valuenow={puntos}>
                  <div className="h-full rounded-full bg-marca transition-[width] duration-700" style={{ width: `${Math.min(100, (puntos / siguiente.pointsCost) * 100)}%` }} />
                </div>
                <p className="mt-2 text-sm text-tinta-2">
                  Te faltan <b className="text-tinta">{puntosTxt(siguiente.pointsCost - puntos)}</b>
                  {plataParaSiguiente ? <> · unos {formatearPesos(plataParaSiguiente)} en pedidos</> : null}
                </p>
              </section>
            )}

            {/* 3. Qué puedo canjear */}
            {recompensas.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wide text-tinta-2">Recompensas</h3>
                  {canjeables.length > 0 && <span className="text-xs font-bold text-exito">{canjeables.length} para canjear</span>}
                </div>
                {error && <p className="mb-2 text-sm font-semibold text-peligro">{error}</p>}
                <div className="rounded-2xl border border-linea bg-superficie-tarjeta divide-y divide-linea overflow-hidden">
                  {recompensas.map((r) => {
                    const alcanza = puntos >= r.pointsCost;
                    const producto = productoDe(r);
                    const esProducto = r.type === 'free_product';
                    return (
                      <div key={r._id} className={`flex items-center gap-3 p-3.5 ${alcanza ? '' : 'opacity-70'}`}>
                        <div className="w-14 h-14 rounded-xl bg-superficie-2 overflow-hidden shrink-0 flex items-center justify-center">
                          {producto?.image
                            ? <img src={producto.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : <Gift className="w-6 h-6 text-tinta-3" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-tinta leading-tight">{r.name}</p>
                          <p className="text-xs text-tinta-2 mt-0.5 line-clamp-2">{r.description || queEs(r, isService)}</p>
                          <p className="text-xs font-bold text-tinta mt-1 tabular-nums">{puntosTxt(r.pointsCost)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {!alcanza ? (
                            <span className="flex items-center gap-1 text-xs font-semibold text-tinta-3">
                              <Lock className="w-3.5 h-3.5" /> Faltan {(r.pointsCost - puntos).toLocaleString('es-CO')}
                            </span>
                          ) : esProducto && addToCart ? (
                            <Boton tamano="sm" className="h-10 px-4" cargando={redeeming === r._id} onClick={() => canjear(r)}>
                              Canjear
                            </Boton>
                          ) : (
                            <span className="text-xs font-semibold text-exito leading-tight block max-w-[96px]">
                              Elígelo al pagar
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Niveles: una lista simple, el actual marcado. */}
            {niveles.length > 1 && (
              <section>
                <h3 className="text-xs font-black uppercase tracking-wide text-tinta-2 mb-2">Niveles</h3>
                <div className="rounded-2xl border border-linea bg-superficie-tarjeta divide-y divide-linea">
                  {niveles.map((t) => {
                    const actual = t.name === nivelActual;
                    return (
                      <div key={t.name} className={`flex items-center justify-between px-4 py-3 ${actual ? 'bg-marca-suave' : ''}`}>
                        <span className={`font-bold ${actual ? 'text-tinta' : 'text-tinta-2'}`}>{t.name}</span>
                        <span className="text-xs text-tinta-2 tabular-nums">
                          {actual ? 'Tu nivel' : `Desde ${puntosTxt(t.minPoints)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {siguienteNivel && (
                  <p className="mt-2 text-xs text-tinta-2">
                    Te faltan {puntosTxt(Math.max(0, siguienteNivel.minPoints - (data.totalEarned || 0)))} acumulados para {siguienteNivel.name}.
                  </p>
                )}
              </section>
            )}

            {/* Movimientos */}
            {data.recentTransactions?.length > 0 && (
              <section>
                <h3 className="text-xs font-black uppercase tracking-wide text-tinta-2 mb-2">Movimientos</h3>
                <div className="rounded-2xl border border-linea bg-superficie-tarjeta divide-y divide-linea">
                  {data.recentTransactions.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-tinta truncate">{tx.description}</p>
                        {tx.createdAt && (
                          <p className="text-xs text-tinta-3">
                            {new Date(tx.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <span className={`text-sm font-black tabular-nums shrink-0 ${tx.points > 0 ? 'text-exito' : 'text-tinta-2'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString('es-CO')}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </MenuScreen>
  );
};

function Aviso({ icono, titulo, texto, accion = null }) {
  return (
    <div className="text-center py-10 px-2">
      <span className="mx-auto w-16 h-16 rounded-full bg-marca-suave text-marca flex items-center justify-center">{icono}</span>
      <h3 className="mt-4 text-xl font-black text-tinta">{titulo}</h3>
      <p className="mt-2 text-sm text-tinta-2 leading-relaxed">{texto}</p>
      {accion}
    </div>
  );
}

export default LoyaltyPage;

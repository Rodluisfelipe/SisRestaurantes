import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useBusinessConfig } from '../../Context/BusinessContext';
import api from '../../services/api';

/**
 * Cierre mensual — estadísticas por mes calendario.
 *
 * El resto del panel usa ventanas rodantes ("últimos 30 días"), que nunca se
 * reinician: el 1° de agosto siguen mezclando julio. Aquí el periodo es el mes
 * calendario, que es como el negocio cierra sus cuentas.
 */

const CHANNEL_LABELS = { pos: 'Punto de venta', inapp: 'Menú online', whatsapp: 'WhatsApp', admin: 'Manual' };
const PAYMENT_LABELS = { cash: 'Efectivo', efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', transfer: 'Transferencia', transferencia: 'Transferencia', card: 'Tarjeta', other: 'Otro' };
const TYPE_LABELS = { inSite: 'En sitio', takeaway: 'Para llevar', delivery: 'Domicilio' };

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-CO');
const num = (n) => (Number(n) || 0).toLocaleString('es-CO');

/* Variación contra el mes anterior. null = no hay base con qué comparar
   (el mes pasado no tuvo ventas), y eso se dibuja como "—": mostrar +100%
   sobre cero haría creer que hubo un crecimiento real. */
function Delta({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-[11px] font-semibold text-slate-300">—</span>;
  }
  if (value === 0) return <span className="text-[11px] font-semibold text-slate-400">sin cambio</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      <svg className={`w-3 h-3 ${up ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      {Math.abs(value)}%
    </span>
  );
}

function Kpi({ label, value, delta, hint, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-slate-900 tabular-nums mt-1 leading-tight" style={accent ? { color: accent } : undefined}>{value}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <Delta value={delta} />
        {hint && <span className="text-[11px] text-slate-400 truncate">{hint}</span>}
      </div>
    </div>
  );
}

/* Desglose con barra proporcional: importa más la participación de cada
   canal que la cifra exacta, y así se lee de un vistazo. */
function Breakdown({ title, rows, labels, themeColor, empty }) {
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.revenue / total) * 100) : 0;
            return (
              <div key={r.id}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[13px] font-semibold text-slate-700 truncate">{labels[r.id] || r.id || '—'}</span>
                  <span className="text-[13px] font-bold text-slate-800 tabular-nums shrink-0">{money(r.revenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: themeColor }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums w-14 text-right shrink-0">{pct}% · {r.orders}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MonthlyClosing() {
  const { businessConfig } = useBusinessConfig();
  const businessId = businessConfig?._id;
  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';

  const [month, setMonth] = useState('');   // '' = el servidor decide el mes en curso
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMonth = useCallback(async (ym) => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      const qs = `businessId=${businessId}${ym ? `&month=${ym}` : ''}`;
      const res = await api.get(`/dashboard/monthly?${qs}`);
      setData(res.data);
      setMonth(res.data.month);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar el cierre del mes');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchMonth(month || undefined); /* eslint-disable-next-line */ }, [businessId]);

  const months = data?.availableMonths || [];
  const idx = months.indexOf(month);
  const olderMonth = idx >= 0 && idx < months.length - 1 ? months[idx + 1] : null;
  const newerMonth = idx > 0 ? months[idx - 1] : null;

  // Escala del gráfico diario: el día más fuerte marca el 100%
  const maxDaily = useMemo(
    () => (data?.daily || []).reduce((m, d) => Math.max(m, d.revenue), 0),
    [data]
  );

  if (!businessId) return null;

  return (
    <div className="space-y-4">
      {/* Selector de mes */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => olderMonth && fetchMonth(olderMonth)}
              disabled={!olderMonth || loading}
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Mes anterior"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="min-w-[150px]">
              <h2 className="text-lg font-black text-slate-900 leading-tight">{data?.label || 'Cierre mensual'}</h2>
              <p className="text-[11px] font-semibold text-slate-400">
                {data?.isCurrent ? 'Mes en curso · va corriendo' : 'Mes cerrado'}
              </p>
            </div>
            <button
              onClick={() => newerMonth && fetchMonth(newerMonth)}
              disabled={!newerMonth || loading}
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Mes siguiente"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          {months.length > 1 && (
            <select
              value={month}
              onChange={(e) => fetchMonth(e.target.value)}
              disabled={loading}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white outline-none focus:ring-2 focus:ring-slate-200"
            >
              {months.map((m) => {
                const [y, mm] = m.split('-');
                const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                return <option key={m} value={m}>{nombres[Number(mm) - 1]} {y}</option>;
              })}
            </select>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
              <div className="h-7 w-28 bg-slate-100 rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPIs contra el mes anterior */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Ventas" value={money(data.current.revenue)} delta={data.deltas.revenue} hint={`vs ${data.previous.label}`} accent={themeColor} />
            <Kpi label="Pedidos" value={num(data.current.orders)} delta={data.deltas.orders} hint={`vs ${num(data.previous.orders)}`} />
            <Kpi label="Ticket promedio" value={money(data.current.avgTicket)} delta={data.deltas.avgTicket} hint={`vs ${money(data.previous.avgTicket)}`} />
            <Kpi label="Productos vendidos" value={num(data.current.products)} delta={data.deltas.products} hint={`vs ${num(data.previous.products)}`} />
          </div>

          {/* Lo que se cobró además de las ventas. Va aparte porque el
              domicilio suele ser del domiciliario y la propina del personal:
              sumarlos a "Ventas" infla la cifra con la que se toman decisiones. */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">De ventas a caja</h3>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-slate-700">Ventas <span className="font-normal text-slate-400">(productos − descuentos)</span></span>
                <span className="text-[13px] font-bold text-slate-800 tabular-nums">{money(data.current.revenue)}</span>
              </div>
              {data.current.deliveryFees > 0 && (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-slate-600">+ Domicilios <span className="text-slate-400">(suelen ir al domiciliario)</span></span>
                  <span className="text-[13px] font-semibold text-slate-700 tabular-nums">{money(data.current.deliveryFees)}</span>
                </div>
              )}
              {data.current.tips > 0 && (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-slate-600">+ Propinas <span className="text-slate-400">(del personal)</span></span>
                  <span className="text-[13px] font-semibold text-slate-700 tabular-nums">{money(data.current.tips)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-slate-100">
                <span className="text-sm font-bold text-slate-900">Total cobrado</span>
                <span className="text-base font-black text-slate-900 tabular-nums">{money(data.current.charged ?? data.current.revenue)}</span>
              </div>
            </div>
            {data.current.discounts > 0 && (
              <p className="text-[11px] text-slate-400 mt-2.5">
                Se descontaron {money(data.current.discounts)} en cupones y promociones, ya restados de Ventas.
              </p>
            )}
          </div>

          {/* Serie diaria */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ventas por día</h3>
              {data.bestDay && (
                <span className="text-[11px] font-semibold text-slate-400">
                  Mejor día: {data.bestDay.day} · {money(data.bestDay.revenue)}
                </span>
              )}
            </div>
            {data.daily.length === 0 ? (
              <p className="text-sm text-slate-400">Sin ventas registradas en {data.label}.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1 h-32 min-w-[420px]">
                  {data.daily.map((d) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 group" title={`Día ${d.day}: ${money(d.revenue)} · ${d.orders} pedidos`}>
                      <div
                        className="w-full rounded-t transition-all group-hover:opacity-80"
                        style={{
                          height: `${maxDaily > 0 ? Math.max(3, (d.revenue / maxDaily) * 100) : 3}%`,
                          backgroundColor: themeColor,
                        }}
                      />
                      <span className="text-[9px] font-bold text-slate-400 tabular-nums">{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desgloses */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Breakdown title="Por canal" rows={data.byChannel} labels={CHANNEL_LABELS} themeColor={themeColor} empty="Sin ventas este mes." />
            <Breakdown title="Por método de pago" rows={data.byPayment} labels={PAYMENT_LABELS} themeColor={themeColor} empty="Sin ventas este mes." />
            <Breakdown title="Por tipo de pedido" rows={data.byOrderType} labels={TYPE_LABELS} themeColor={themeColor} empty="Sin ventas este mes." />
          </div>

          {/* Top productos */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Más vendidos del mes</h3>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-slate-400">Sin productos vendidos en {data.label}.</p>
            ) : (
              <div className="space-y-1.5">
                {data.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] font-black text-slate-500 shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{p.name}</span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums shrink-0">{num(p.qty)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Los cierres de caja miden otra cosa y confundirlos descuadra la
              contabilidad: conviene decirlo donde se van a comparar. */}
          <p className="text-[11px] text-slate-400 leading-relaxed px-1">
            Las cifras cubren {data.label} completo, de la medianoche del día 1 a la del último día, en hora de Colombia.
            Se cuentan los pedidos por su fecha de completado. Esto no reemplaza los cierres de caja:
            la caja mide lo que pasó por ella mientras estuvo abierta, y puede cruzar días o dejar por fuera lo que no se cobró ahí.
          </p>
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

/**
 * Receta de un producto: qué insumos consume una unidad.
 *
 * Con receta, vender el plato descuenta pan, carne y queso en vez de un
 * contador llamado "hamburguesa". Sin receta, el producto sigue controlándose
 * por unidad, que es lo correcto para una gaseosa.
 */

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

export default function RecipeEditor({ producto, businessId, themeColor, onClose, onGuardado }) {
  const [insumos, setInsumos] = useState([]);
  const [unidades, setUnidades] = useState({});
  const [lineas, setLineas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    let vivo = true;
    api.get(`/supplies?businessId=${businessId}`)
      .then((res) => {
        if (!vivo) return;
        setInsumos(res.data.insumos || []);
        setUnidades(res.data.unidades || {});
        setLineas((producto.recipe || []).map((r) => ({
          supplyId: String(r.supplyId?._id || r.supplyId),
          quantity: r.quantity,
        })));
      })
      .catch(() => {})
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [businessId, producto]);

  const porId = useMemo(() => {
    const m = {};
    insumos.forEach((s) => { m[s._id] = s; });
    return m;
  }, [insumos]);

  const enReceta = new Set(lineas.map((l) => l.supplyId));

  const disponibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return insumos.filter((s) => !enReceta.has(s._id) && (!q || s.name.toLowerCase().includes(q)));
  }, [insumos, lineas, busqueda]);

  /* Costo del plato según su receta. Es el dato que convierte la receta en
     algo útil más allá del inventario: sin él no se sabe cuánto deja cada
     venta. Solo cuenta lo que tiene costo registrado. */
  const costo = useMemo(() => {
    let total = 0;
    let faltantes = 0;
    for (const l of lineas) {
      const s = porId[l.supplyId];
      if (!s) continue;
      if (s.cost == null) { faltantes++; continue; }
      total += s.cost * (Number(l.quantity) || 0);
    }
    return { total, faltantes };
  }, [lineas, porId]);

  const margen = producto.price > 0 && costo.total > 0
    ? Math.round(((producto.price - costo.total) / producto.price) * 100)
    : null;

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await api.put(`/supplies/recipe/${producto._id}`, {
        businessId,
        recipe: lineas.filter((l) => l.supplyId && Number(l.quantity) > 0),
      });
      onGuardado?.(res.data);
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo guardar la receta');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">Receta de {producto.name}</h3>
            <p className="text-[11px] text-slate-400">Qué consume una unidad</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {cargando && <div className="space-y-2">{[0, 1].map(i => <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />)}</div>}

          {!cargando && insumos.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">
              Todavía no tienes insumos. Créalos en la pestaña Insumos y vuelve aquí para armar la receta.
            </p>
          )}

          {/* Líneas de la receta */}
          {lineas.length > 0 && (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {lineas.map((l, i) => {
                const s = porId[l.supplyId];
                return (
                  <div key={l.supplyId} className="flex items-center gap-2 p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{s?.name || 'Insumo eliminado'}</p>
                      {s?.cost != null && (
                        <p className="text-[11px] text-slate-400">
                          {money(s.cost * (Number(l.quantity) || 0))} por unidad del plato
                        </p>
                      )}
                    </div>
                    <input
                      type="number" min="0" step="any"
                      value={l.quantity}
                      onChange={(ev) => {
                        const v = ev.target.value;
                        setLineas((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: v } : x)));
                      }}
                      className="w-20 h-9 text-center text-[13px] font-bold rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-slate-200 tabular-nums"
                    />
                    <span className="text-[11px] text-slate-400 w-12 shrink-0">{unidades[s?.unit] || s?.unit || ''}</span>
                    <button
                      onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}
                      className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Costo y margen */}
          {lineas.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">Costo de la receta</span>
                <span className="font-bold text-slate-800 tabular-nums">{money(costo.total)}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">Precio de venta</span>
                <span className="font-bold text-slate-800 tabular-nums">{money(producto.price)}</span>
              </div>
              {margen !== null && (
                <div className="flex justify-between text-[12px] pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Deja</span>
                  <span className={`font-black tabular-nums ${margen < 30 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {money(producto.price - costo.total)} · {margen}%
                  </span>
                </div>
              )}
              {costo.faltantes > 0 && (
                <p className="text-[11px] text-amber-700 pt-1">
                  {costo.faltantes} insumo(s) sin costo registrado, así que el cálculo se queda corto.
                </p>
              )}
            </div>
          )}

          {/* Agregar insumos */}
          {insumos.length > 0 && (
            <div>
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar insumo para agregar..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200 mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {disponibles.slice(0, 12).map((s) => (
                  <button
                    key={s._id}
                    onClick={() => { setLineas((ls) => [...ls, { supplyId: s._id, quantity: 1 }]); setBusqueda(''); }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[12px] font-semibold text-slate-700 transition-colors"
                  >
                    + {s.name}
                  </button>
                ))}
                {disponibles.length === 0 && !busqueda && lineas.length > 0 && (
                  <p className="text-[11px] text-slate-400">Todos los insumos ya están en la receta.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-100 flex gap-2">
          {producto.recipe?.length > 0 && lineas.length === 0 && (
            <p className="flex-1 text-[11px] text-amber-700 self-center leading-snug">
              Al guardar sin líneas, este producto vuelve a controlarse por unidad.
            </p>
          )}
          <button
            onClick={guardar}
            disabled={guardando || cargando}
            className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold disabled:opacity-50 transition-colors"
            style={{ backgroundColor: themeColor }}
          >
            {guardando ? 'Guardando...' : 'Guardar receta'}
          </button>
        </div>
      </div>
    </div>
  );
}

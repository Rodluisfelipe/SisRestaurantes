import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';

/**
 * Insumos — lo que el negocio compra, no lo que vende.
 *
 * Un restaurante no controla "hamburguesas": controla pan, carne y queso.
 * Aquí se manejan esos insumos, y desde el editor de recetas se enlazan con
 * los platos que los consumen.
 */

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

// Cantidades con decimales: 0,5 kg es una compra normal; 3 unidades no lleva coma
const cant = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? v.toLocaleString('es-CO') : v.toLocaleString('es-CO', { maximumFractionDigits: 2 });
};

function estadoDe(s) {
  const v = s.stock ?? 0;
  if (v <= 0) return 'agotado';
  if (s.lowStockAlert > 0 && v <= s.lowStockAlert) return 'bajo';
  return 'bien';
}
const COLOR = {
  agotado: 'bg-red-50 text-red-700 border-red-200',
  bajo: 'bg-amber-50 text-amber-700 border-amber-200',
  bien: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const ETIQUETA = { agotado: 'Agotado', bajo: 'Por acabarse', bien: 'Disponible' };

const VACIO = { name: '', unit: 'u', stock: '', cost: '', lowStockAlert: '', supplier: '' };

export default function SuppliesPanel({ businessId, themeColor, onCambio }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const [nuevo, setNuevo] = useState(null);          // formulario de alta
  const [editando, setEditando] = useState(null);    // id con cantidad exacta abierta
  const [valorExacto, setValorExacto] = useState('');

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setCargando(true);
    try {
      const res = await api.get(`/supplies?businessId=${businessId}`);
      setDatos(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los insumos');
    } finally {
      setCargando(false);
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  const ajustar = useCallback(async (insumo, cambios) => {
    if (ocupado) return;
    setOcupado(insumo._id);
    try {
      const res = await api.patch(`/supplies/${insumo._id}`, { businessId, ...cambios });
      setDatos((d) => d && ({ ...d, insumos: d.insumos.map((s) => (s._id === insumo._id ? res.data : s)) }));
      onCambio?.();
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo ajustar el insumo');
    } finally {
      setOcupado(null);
      setEditando(null);
    }
  }, [businessId, ocupado, onCambio]);

  const crear = async () => {
    if (!nuevo?.name?.trim()) return;
    setOcupado('nuevo');
    try {
      await api.post('/supplies', { businessId, ...nuevo });
      setNuevo(null);
      await cargar();
      onCambio?.();
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo crear el insumo');
    } finally {
      setOcupado(null);
    }
  };

  const eliminar = async (insumo) => {
    if (!window.confirm(`¿Eliminar "${insumo.name}"?`)) return;
    setOcupado(insumo._id);
    try {
      await api.delete(`/supplies/${insumo._id}?businessId=${businessId}`);
      await cargar();
      onCambio?.();
    } catch (err) {
      // El servidor bloquea si alguna receta lo usa, y explica cuántas
      alert(err.response?.data?.message || 'No se pudo eliminar');
    } finally {
      setOcupado(null);
    }
  };

  const visibles = useMemo(() => {
    if (!datos) return [];
    const q = busqueda.trim().toLowerCase();
    return q ? datos.insumos.filter((s) => (s.name || '').toLowerCase().includes(q)) : datos.insumos;
  }, [datos, busqueda]);

  const r = datos?.resumen;
  const unidades = datos?.unidades || { u: 'unidad' };

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Agotados</p>
          <p className="text-xl font-black text-red-600 tabular-nums">{r?.agotados ?? '—'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Por acabarse</p>
          <p className="text-xl font-black text-amber-600 tabular-nums">{r?.bajos ?? '—'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Valor</p>
          <p className="text-xl font-black text-emerald-600 tabular-nums">{r ? money(r.valorInventario) : '—'}</p>
        </div>
      </div>

      {r && r.total > 0 && r.sinCosto > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          {r.sinCosto} de {r.total} insumos no tienen costo, así que no cuentan en el valor.
        </div>
      )}

      {/* Buscar y agregar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar insumo..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
        <button
          onClick={() => setNuevo(nuevo ? null : { ...VACIO })}
          className="px-3 py-2 rounded-xl text-xs font-bold text-white transition-colors"
          style={{ backgroundColor: themeColor }}
        >
          {nuevo ? 'Cancelar' : '+ Nuevo insumo'}
        </button>
      </div>

      {/* Alta */}
      {nuevo && (
        <div className="bg-white rounded-2xl border-2 p-3 space-y-2" style={{ borderColor: themeColor }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <input
              autoFocus
              value={nuevo.name}
              onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })}
              placeholder="Nombre (ej: Carne de res)"
              className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
            <select
              value={nuevo.unit}
              onChange={(e) => setNuevo({ ...nuevo, unit: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none"
            >
              {Object.entries(unidades).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input
              type="number" min="0" step="any"
              value={nuevo.stock}
              onChange={(e) => setNuevo({ ...nuevo, stock: e.target.value })}
              placeholder="Cantidad"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
            <input
              type="number" min="0" step="any"
              value={nuevo.cost}
              onChange={(e) => setNuevo({ ...nuevo, cost: e.target.value })}
              placeholder={`Costo por ${unidades[nuevo.unit] || 'unidad'}`}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
            <input
              type="number" min="0" step="any"
              value={nuevo.lowStockAlert}
              onChange={(e) => setNuevo({ ...nuevo, lowStockAlert: e.target.value })}
              placeholder="Avisar bajo"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <button
            onClick={crear}
            disabled={!nuevo.name.trim() || ocupado === 'nuevo'}
            className="w-full py-2.5 rounded-xl text-white text-xs font-bold disabled:opacity-50 transition-colors"
            style={{ backgroundColor: themeColor }}
          >
            {ocupado === 'nuevo' ? 'Guardando...' : 'Guardar insumo'}
          </button>
        </div>
      )}

      {cargando && <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-14 bg-white rounded-2xl border border-slate-200 animate-pulse" />)}</div>}

      {!cargando && error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{error}</div>}

      {!cargando && !error && visibles.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">
            {busqueda ? 'No hay insumos que coincidan.' : 'Aún no tienes insumos. Agrega el primero para poder armar recetas.'}
          </p>
        </div>
      )}

      {/* Listado */}
      {!cargando && !error && visibles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {visibles.map((s) => {
            const e = estadoDe(s);
            const trabajando = ocupado === s._id;
            return (
              <div key={s._id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 truncate">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${COLOR[e]}`}>{ETIQUETA[e]}</span>
                    <span className="text-[11px] text-slate-400">
                      {s.cost != null ? `${money(s.cost)} / ${unidades[s.unit] || s.unit}` : 'sin costo'}
                    </span>
                    {s.supplier && <span className="text-[11px] text-slate-400">· {s.supplier}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => ajustar(s, { delta: -1, motivo: 'adjust' })}
                    disabled={trabajando || (s.stock ?? 0) <= 0}
                    className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14" /></svg>
                  </button>

                  {editando === s._id ? (
                    <input
                      autoFocus type="number" min="0" step="any"
                      value={valorExacto}
                      onChange={(ev) => setValorExacto(ev.target.value)}
                      onBlur={() => { const v = Number(valorExacto); Number.isFinite(v) && v >= 0 ? ajustar(s, { stock: v, motivo: 'adjust', nota: 'Conteo' }) : setEditando(null); }}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') ev.currentTarget.blur(); if (ev.key === 'Escape') setEditando(null); }}
                      className="w-20 h-8 text-center text-[13px] font-bold rounded-lg border-2 border-slate-300 outline-none tabular-nums"
                    />
                  ) : (
                    <button
                      onClick={() => { setEditando(s._id); setValorExacto(String(s.stock ?? 0)); }}
                      title="Escribir la cantidad exacta"
                      className="min-w-[64px] h-8 px-1.5 rounded-lg text-[13px] font-black tabular-nums text-slate-800 hover:bg-slate-100"
                    >
                      {trabajando ? '·' : `${cant(s.stock)} ${s.unit}`}
                    </button>
                  )}

                  <button
                    onClick={() => ajustar(s, { delta: 1, motivo: 'purchase' })}
                    disabled={trabajando}
                    className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>

                  <button
                    onClick={() => eliminar(s)}
                    disabled={trabajando}
                    title="Eliminar insumo"
                    className="w-8 h-8 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30 flex items-center justify-center ml-0.5"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400 leading-relaxed px-1">
        El botón <strong>+</strong> registra una entrada (compra) y el <strong>−</strong> un ajuste.
        Para un conteo físico, escribe la cantidad exacta tocando el número. Todo queda en el historial.
      </p>
    </div>
  );
}

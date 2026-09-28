import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FaFire, FaThumbtack, FaEyeSlash, FaLock, FaSearch, FaCheck } from 'react-icons/fa';
import api from '../../services/api';
import logger from '../../utils/logger';
import { useBusinessConfig } from '../../Context/BusinessContext';

const MODES = [
  { value: 'hybrid', label: 'Híbrido', desc: 'Ventas + destacados + favoritos' },
  { value: 'auto', label: 'Automático', desc: 'Solo ventas reales' },
  { value: 'manual', label: 'Manual', desc: 'Solo los que fijes' },
];

const DEFAULTS = {
  enabled: true,
  title: 'Los más pedidos',
  mode: 'hybrid',
  windowDays: 30,
  limit: 10,
  minOrders: 1,
  showBadges: true,
  showOrderCounts: true,
  pinnedProductIds: [],
  hiddenProductIds: [],
};

// Los números se guardan como texto mientras se escriben: con parseInt en cada
// tecla, borrar el campo lo rellenaba solo con 30 y no se podía escribir otro.
const entero = (v, def, min, max) => {
  const n = parseInt(v, 10);
  if (!Number.isInteger(n)) return def;
  return Math.min(Math.max(n, min), max);
};

/**
 * Configuración de la sección premium "Los más pedidos".
 * Permite activar/configurar el ranking y fijar/ocultar productos.
 */
export default function PopularSectionManager({ businessId, products = [] }) {
  const { businessConfig } = useBusinessConfig();
  const [cfg, setCfg] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [search, setSearch] = useState('');

  /* Se carga una sola vez: antes cualquier cambio de la configuración del
     negocio (llega en tiempo real) borraba lo que se estaba editando. */
  const cargado = useRef(false);
  useEffect(() => {
    const initial = businessConfig?.popularSection;
    if (initial && !cargado.current) {
      cargado.current = true;
      setCfg({
        ...DEFAULTS,
        ...initial,
        pinnedProductIds: (initial.pinnedProductIds || []).map(String),
        hiddenProductIds: (initial.hiddenProductIds || []).map(String),
      });
    }
  }, [businessConfig]);

  // Detectar si el plan bloquea la feature
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const res = await api.get(`/products/popular?businessId=${businessId}`);
        setLocked(!!res.data?.locked);
      } catch { /* noop */ }
    })();
  }, [businessId]);

  const set = (key, value) => { setCfg(prev => ({ ...prev, [key]: value })); setSaved(false); };

  const togglePin = (id) => {
    setSaved(false);
    setCfg(prev => {
      const pinned = new Set(prev.pinnedProductIds);
      const hidden = new Set(prev.hiddenProductIds);
      if (pinned.has(id)) { pinned.delete(id); }
      else { pinned.add(id); hidden.delete(id); }
      return { ...prev, pinnedProductIds: [...pinned], hiddenProductIds: [...hidden] };
    });
  };

  const toggleHide = (id) => {
    setSaved(false);
    setCfg(prev => {
      const pinned = new Set(prev.pinnedProductIds);
      const hidden = new Set(prev.hiddenProductIds);
      if (hidden.has(id)) { hidden.delete(id); }
      else { hidden.add(id); pinned.delete(id); }
      return { ...prev, pinnedProductIds: [...pinned], hiddenProductIds: [...hidden] };
    });
  };

  const activos = useMemo(() => (Array.isArray(products) ? products.filter(p => p.active !== false) : []), [products]);
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activos.slice(0, 50);
    return activos.filter(p => (p.name || '').toLowerCase().includes(term)).slice(0, 50);
  }, [activos, search]);

  const handleSave = async () => {
    if (saving) return;
    const limpio = {
      ...cfg,
      windowDays: entero(cfg.windowDays, 30, 1, 365),
      limit: entero(cfg.limit, 10, 3, 24),
      minOrders: entero(cfg.minOrders, 0, 0, 100000),
    };
    setCfg(limpio);   // lo que se guarda es lo que queda escrito
    setError('');
    try {
      setSaving(true);
      await api.put('/products/popular/config', { businessId, ...limpio });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      logger.error('Error saving popular section config:', err);
      setError(err.response?.data?.message || (err.response ? 'No se pudo guardar' : 'Sin conexión. Revisa el internet.'));
    } finally {
      setSaving(false);
    }
  };

  const pinnedSet = new Set(cfg.pinnedProductIds);
  const hiddenSet = new Set(cfg.hiddenProductIds);

  return (
    <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FaFire className="text-orange-500 text-sm" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              Los más pedidos
              <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">PREMIUM</span>
            </h3>
            <p className="text-xs text-slate-500">
              {cfg.enabled ? 'Se muestra en tu menú' : 'Apagada: no sale en tu menú'}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0" aria-label="Mostrar la sección en el menú">
          <input type="checkbox" className="sr-only peer" checked={!!cfg.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-orange-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
        </label>
      </div>

      {locked && (
        <div className="m-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <FaLock className="text-amber-500 text-sm mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-amber-800">Disponible en planes de pago</p>
            <p className="text-xs text-amber-700">Puedes configurarla ahora, pero solo se mostrará en tu menú con un plan Starter, Pro o Pro Max.</p>
          </div>
        </div>
      )}

      <div className={`p-4 space-y-4 ${cfg.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        {/* Título */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Título de la sección</label>
          <input
            type="text"
            value={cfg.title}
            onChange={(e) => set('title', e.target.value.slice(0, 40))}
            placeholder="Los más pedidos"
            className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
          />
        </div>

        {/* Modo */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Cómo se arma la lista</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {MODES.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => set('mode', m.value)}
                className={`text-left p-2.5 rounded-xl border transition-all ${cfg.mode === m.value ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <p className={`text-[13px] font-bold ${cfg.mode === m.value ? 'text-orange-600' : 'text-slate-700'}`}>{m.label}</p>
                <p className="text-xs text-slate-500 leading-snug mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Parámetros numéricos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Contar ventas de los últimos (días)</label>
            <input type="number" inputMode="numeric" min={1} max={365} value={cfg.windowDays} onChange={(e) => set('windowDays', e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Cuántos productos mostrar (3 a 24)</label>
            <input type="number" inputMode="numeric" min={3} max={24} value={cfg.limit} onChange={(e) => set('limit', e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Pedidos mínimos para aparecer</label>
            <input type="number" inputMode="numeric" min={0} value={cfg.minOrders} onChange={(e) => set('minOrders', e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm" />
          </div>
        </div>

        {/* Toggles de badges */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={!!cfg.showBadges} onChange={(e) => set('showBadges', e.target.checked)} className="rounded w-4 h-4" />
            Mostrar insignias (#1, Top, Favorito)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={!!cfg.showOrderCounts} onChange={(e) => set('showOrderCounts', e.target.checked)} className="rounded w-4 h-4" />
            Mostrar "X pedidos esta semana"
          </label>
        </div>

        {/* Fijar / ocultar productos */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Fijar o esconder productos</label>
          <p className="text-xs text-slate-500 mb-2">Fijar: siempre sale de primero. Ocultar: nunca sale en esta sección.</p>
          <div className="relative mb-2">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
            />
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {filteredProducts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Sin productos</p>
            ) : filteredProducts.map(p => {
              const id = String(p._id);
              const isPinned = pinnedSet.has(id);
              const isHidden = hiddenSet.has(id);
              return (
                <div key={id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.image
                      ? <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      : <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0" />}
                    <span className="text-[13px] text-slate-700 break-words min-w-0">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePin(id)}
                      title="Fijar al inicio"
                      className={`flex items-center gap-1 px-2.5 h-9 rounded-lg text-xs font-semibold border transition-colors ${isPinned ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'}`}
                    >
                      <FaThumbtack className="text-2xs" /> {isPinned ? 'Fijado' : 'Fijar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHide(id)}
                      title="Ocultar de la sección"
                      className={`flex items-center gap-1 px-2.5 h-9 rounded-lg text-xs font-semibold border transition-colors ${isHidden ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                    >
                      <FaEyeSlash className="text-2xs" /> {isHidden ? 'Oculto' : 'Ocultar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {!search.trim() && activos.length > 50 && (
            <p className="text-xs text-slate-500 mt-1.5">Se ven los primeros 50. Busca por nombre para encontrar los demás.</p>
          )}
        </div>
      </div>

      {/* Guardar: fuera del bloque que se apaga. Antes quedaba dentro y, al
          apagar la sección, el botón tampoco respondía: no se podía apagar. */}
      <div className="px-4 pb-4 flex flex-wrap items-center justify-end gap-3">
        {error && <span role="alert" className="text-sm font-medium text-red-700 flex-1">{error}</span>}
        {saved && <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1"><FaCheck className="text-2xs" /> Guardado</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

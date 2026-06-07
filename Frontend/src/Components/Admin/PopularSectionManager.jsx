import React, { useState, useEffect, useMemo } from 'react';
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

/**
 * Configuración de la sección premium "Los más pedidos".
 * Permite activar/configurar el ranking y fijar/ocultar productos.
 */
export default function PopularSectionManager({ businessId, products = [] }) {
  const { businessConfig } = useBusinessConfig();
  const [cfg, setCfg] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locked, setLocked] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const initial = businessConfig?.popularSection;
    if (initial) {
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

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = Array.isArray(products) ? products.filter(p => p.active !== false) : [];
    if (!term) return list.slice(0, 50);
    return list.filter(p => (p.name || '').toLowerCase().includes(term)).slice(0, 50);
  }, [products, search]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/products/popular/config', { businessId, ...cfg });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      logger.error('Error saving popular section config:', error);
      alert(error.response?.data?.message || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const pinnedSet = new Set(cfg.pinnedProductIds);
  const hiddenSet = new Set(cfg.hiddenProductIds);

  return (
    <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaFire className="text-orange-500 text-sm" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              Los más pedidos
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">PREMIUM</span>
            </h3>
            <p className="text-xs text-slate-500">Sección dinámica de recomendados en tu menú</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={!!cfg.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-orange-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
        </label>
      </div>

      {locked && (
        <div className="m-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <FaLock className="text-amber-500 text-sm mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-amber-800">Disponible en planes de pago</p>
            <p className="text-[11px] text-amber-700">Puedes configurarla ahora, pero solo se mostrará en tu menú con un plan Starter, Pro o Pro Max.</p>
          </div>
        </div>
      )}

      <div className={`p-4 space-y-4 ${cfg.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        {/* Título */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Título de la sección</label>
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
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Cómo se arma el ranking</label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => set('mode', m.value)}
                className={`text-left p-2.5 rounded-xl border transition-all ${cfg.mode === m.value ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <p className={`text-[12px] font-bold ${cfg.mode === m.value ? 'text-orange-600' : 'text-slate-700'}`}>{m.label}</p>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Parámetros numéricos */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Ventana (días)</label>
            <input type="number" min={1} max={365} value={cfg.windowDays} onChange={(e) => set('windowDays', parseInt(e.target.value, 10) || 30)} className="w-full p-2 border border-slate-300 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Mostrar</label>
            <input type="number" min={3} max={24} value={cfg.limit} onChange={(e) => set('limit', parseInt(e.target.value, 10) || 10)} className="w-full p-2 border border-slate-300 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Mín. pedidos</label>
            <input type="number" min={0} value={cfg.minOrders} onChange={(e) => set('minOrders', parseInt(e.target.value, 10) || 0)} className="w-full p-2 border border-slate-300 rounded-xl text-sm" />
          </div>
        </div>

        {/* Toggles de badges */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
            <input type="checkbox" checked={!!cfg.showBadges} onChange={(e) => set('showBadges', e.target.checked)} className="rounded" />
            Mostrar insignias (#1, Top, Favorito)
          </label>
          <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
            <input type="checkbox" checked={!!cfg.showOrderCounts} onChange={(e) => set('showOrderCounts', e.target.checked)} className="rounded" />
            Mostrar "X pedidos esta semana"
          </label>
        </div>

        {/* Fijar / ocultar productos */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fijar o esconder productos</label>
          <div className="relative mb-2">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
            />
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-xl">
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
                    <span className="text-[13px] text-slate-700 truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePin(id)}
                      title="Fijar al inicio"
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${isPinned ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'}`}
                    >
                      <FaThumbtack className="text-[9px]" /> {isPinned ? 'Fijado' : 'Fijar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHide(id)}
                      title="Ocultar de la sección"
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${isHidden ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                    >
                      <FaEyeSlash className="text-[9px]" /> {isHidden ? 'Oculto' : 'Ocultar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Guardar */}
        <div className="flex items-center justify-end gap-3 pt-1">
          {saved && <span className="text-[12px] font-semibold text-emerald-600 flex items-center gap-1"><FaCheck className="text-[10px]" /> Guardado</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

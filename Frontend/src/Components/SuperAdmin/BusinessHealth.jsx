import React, { useEffect, useMemo, useState } from 'react';
import { fetchBusinessHealth } from '../../services/superadminApi';
import BusinessNotes from './BusinessNotes';

const RISK = {
  high:   { label: 'Riesgo alto', dot: 'bg-red-500',     chip: 'bg-red-100 text-red-700' },
  never:  { label: 'Nunca activó', dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700' },
  medium: { label: 'Atención',    dot: 'bg-amber-500',   chip: 'bg-amber-100 text-amber-700' },
  new:    { label: 'Nuevo',       dot: 'bg-blue-500',    chip: 'bg-blue-100 text-blue-700' },
  ok:     { label: 'Al día',      dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
};

const FILTERS = [
  { id: 'attention', label: 'Requieren atención' },
  { id: 'high', label: 'Riesgo alto' },
  { id: 'never', label: 'Nunca activaron' },
  { id: 'medium', label: 'Atención' },
  { id: 'ok', label: 'Al día' },
  { id: 'all', label: 'Todos' },
];

/**
 * BusinessHealth — qué negocios se están apagando.
 * El churn agregado dice cuántos se fueron; esto dice sobre cuáles todavía se
 * puede actuar.
 */
export default function BusinessHealth({ onOpenBusiness }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('attention');
  const [q, setQ] = useState('');
  const [notesFor, setNotesFor] = useState(null); // negocio cuyo historial se abre

  const load = () => {
    setLoading(true);
    fetchBusinessHealth()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const items = useMemo(() => {
    const all = data?.items || [];
    const byRisk = filter === 'all'
      ? all
      : filter === 'attention'
        ? all.filter((i) => ['high', 'never', 'medium'].includes(i.risk))
        : all.filter((i) => i.risk === filter);
    const term = q.trim().toLowerCase();
    return term
      ? byRisk.filter((i) => (i.businessName || '').toLowerCase().includes(term) || (i.slug || '').toLowerCase().includes(term))
      : byRisk;
  }, [data, filter, q]);

  const s = data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Salud de los negocios</h1>
          <p className="text-sm text-slate-500">Quiénes se están apagando, mientras todavía se puede hacer algo.</p>
        </div>
        <button
          onClick={load}
          className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600"
        >
          Actualizar
        </button>
      </div>

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { k: 'high', label: 'Riesgo alto', value: s.high, tone: 'text-red-600' },
            { k: 'never', label: 'Nunca activaron', value: s.never, tone: 'text-orange-600' },
            { k: 'medium', label: 'Atención', value: s.medium, tone: 'text-amber-600' },
            { k: 'ok', label: 'Al día', value: s.ok, tone: 'text-emerald-600' },
            { k: 'all', label: 'Activos', value: s.total, tone: 'text-slate-700' },
          ].map((c) => (
            <button
              key={c.k}
              onClick={() => setFilter(c.k)}
              className={`text-left rounded-xl p-3 border transition-colors ${
 filter === c.k
 ? 'border-slate-300 bg-slate-50'
 : 'border-slate-200 bg-white'
 }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</p>
              <p className={`text-xl font-bold tabular-nums ${c.tone}`}>{c.value ?? 0}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar negocio…"
          className="px-3 py-2 rounded-lg text-sm bg-white border border-slate-200 text-slate-700 focus:outline-none"
        />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors ${
 filter === f.id
 ? 'bg-slate-800 text-white'
 : 'bg-white text-slate-500 border border-slate-200'
 }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
        {loading ? (
          <p className="py-16 text-center text-sm text-slate-400">Calculando…</p>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-semibold text-slate-600">
              {filter === 'attention' ? 'Ningún negocio requiere atención' : 'Sin resultados'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {filter === 'attention' ? 'Todos están recibiendo pedidos con normalidad.' : 'Prueba con otro filtro.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((b) => {
              const r = RISK[b.risk] || RISK.ok;
              const up = b.trendPct > 0;
              return (
                <div key={b._id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{b.businessName}</p>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${r.chip}`}>{r.label}</span>
                    </div>
                    <p className="text-[12px] text-slate-400 truncate">
                      {b.reason}
                      {b.city ? ` · ${b.city}` : ''}
                    </p>
                  </div>

                  <div className="hidden sm:block text-right shrink-0 w-24">
                    <p className="text-[13px] font-bold text-slate-700 tabular-nums">{b.ordersLast7}</p>
                    <p className="text-[10px] text-slate-400">pedidos 7d</p>
                  </div>

                  <div className="hidden sm:block text-right shrink-0 w-16">
                    {b.ordersPrev7 > 0 || b.ordersLast7 > 0 ? (
                      <p className={`text-[13px] font-bold tabular-nums ${up ? 'text-emerald-600' : b.trendPct < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {up ? '+' : ''}{b.trendPct}%
                      </p>
                    ) : <p className="text-[13px] text-slate-500">—</p>}
                    <p className="text-[10px] text-slate-400">vs 7d</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setNotesFor(b)}
                      className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-slate-100 text-slate-600"
                      title="Historial de contacto"
                    >
                      Notas
                    </button>
                    {b.slug && (
                      <a
                        href={`/${b.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-slate-100 text-slate-600"
                      >
                        Ver menú
                      </a>
                    )}
                    {onOpenBusiness && (
                      <button
                        onClick={() => onOpenBusiness(b)}
                        className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-slate-800 text-white"
                      >
                        Abrir
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {notesFor && <BusinessNotes business={notesFor} onClose={() => setNotesFor(null)} />}
    </div>
  );
}

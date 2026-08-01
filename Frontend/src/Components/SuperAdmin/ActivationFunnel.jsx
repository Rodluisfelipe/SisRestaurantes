import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchActivationFunnel } from '../../services/superadminApi';

const RANGES = [
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '1 año' },
];

const STUCK_TONE = {
  'Sin productos': 'bg-red-100 text-red-700',
  'Sin logo': 'bg-amber-100 text-amber-700',
  'Sin el primer pedido': 'bg-orange-100 text-orange-700',
};

/**
 * ActivationFunnel — en qué escalón se caen los negocios nuevos.
 * Mide hitos reales (productos, primer pedido, recurrencia), no guías vistas.
 */
export default function ActivationFunnel() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchActivationFunnel(days)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  const steps = data?.steps || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Activación</h1>
          <p className="text-sm text-slate-500">Dónde se atascan los negocios nuevos, para saber qué arreglar.</p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors ${
                days === r.days ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-400">Calculando…</p>
      ) : !data || data.total === 0 ? (
        <div className="py-16 text-center border border-slate-200 rounded-xl bg-white">
          <p className="font-semibold text-slate-600">Sin registros en este periodo</p>
          <p className="text-sm text-slate-400 mt-1">Prueba con un rango más amplio.</p>
        </div>
      ) : (
        <>
          {/* Embudo */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            {steps.map((s, i) => {
              const prev = i > 0 ? steps[i - 1] : null;
              const dropped = prev ? prev.count - s.count : 0;
              return (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-[13.5px] font-semibold text-slate-700">{s.label}</span>
                    <span className="text-[13px] tabular-nums shrink-0">
                      <strong className="text-slate-800">{s.count}</strong>
                      <span className="text-slate-400"> · {s.pct}%</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s.pct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.06 }}
                      className="h-full rounded-full bg-slate-800"
                    />
                  </div>
                  {dropped > 0 && (
                    <p className="text-[11.5px] text-red-500 mt-1">
                      Se perdieron {dropped} aquí
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Atascados */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-[13.5px] font-bold text-slate-800">Atascados ahora mismo</h2>
              <p className="text-[12px] text-slate-400">Llevan 3 días o más sin pasar al siguiente paso. Aquí es donde una llamada rinde.</p>
            </div>
            {data.stalled.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Ninguno atascado. Todos avanzaron.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.stalled.map((b) => (
                  <div key={b._id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-slate-800 truncate">{b.businessName}</p>
                      <p className="text-[11.5px] text-slate-400">
                        Registrado hace {b.daysOld} días · {b.products} productos
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-bold ${STUCK_TONE[b.stuckAt] || 'bg-slate-100 text-slate-600'}`}>
                      {b.stuckAt}
                    </span>
                    {b.slug && (
                      <a
                        href={`/${b.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-2.5 py-1 rounded-lg text-[11.5px] font-medium bg-slate-100 text-slate-600"
                      >
                        Ver
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

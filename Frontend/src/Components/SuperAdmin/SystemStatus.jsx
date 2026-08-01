import React, { useEffect, useState } from 'react';
import { fetchSystemStatus } from '../../services/superadminApi';

const STATUS = {
  ok:      { label: 'Al día',      dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
  late:    { label: 'Atrasada',    dot: 'bg-amber-500',   chip: 'bg-amber-100 text-amber-700' },
  error:   { label: 'Con error',   dot: 'bg-red-500',     chip: 'bg-red-100 text-red-700' },
  unknown: { label: 'Sin datos',   dot: 'bg-slate-300',   chip: 'bg-slate-100 text-slate-500' },
};

const when = (d) => {
  if (!d) return 'nunca';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
};

export default function SystemStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchSystemStatus().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // se refresca solo cada minuto
    return () => clearInterval(t);
  }, []);

  const bad = (data?.health?.cronsLate || 0) + (data?.health?.cronsError || 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Estado del sistema</h1>
          <p className="text-sm text-slate-500">Si la maquinaria está corriendo, sin esperar a que alguien reclame.</p>
        </div>
        <button
          onClick={load}
          className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600"
        >
          Actualizar
        </button>
      </div>

      {loading && !data ? (
        <p className="py-16 text-center text-sm text-slate-400">Consultando…</p>
      ) : !data ? (
        <div className="py-16 text-center border border-slate-200 rounded-xl bg-white">
          <p className="font-semibold text-slate-600">No se pudo leer el estado</p>
        </div>
      ) : (
        <>
          {/* Titular */}
          <div className={`rounded-xl border p-4 ${bad > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <p className={`text-[15px] font-bold ${bad > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
              {bad > 0
                ? `${bad} tarea${bad > 1 ? 's' : ''} necesita${bad > 1 ? 'n' : ''} atención`
                : 'Todo corriendo con normalidad'}
            </p>
            <p className={`text-[12.5px] mt-0.5 ${bad > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              Actualizado {when(data.generatedAt)}
            </p>
          </div>

          {/* Tareas programadas */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-[13.5px] font-bold text-slate-800">Tareas programadas</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {data.crons.map((c) => {
                const s = STATUS[c.status] || STATUS.unknown;
                return (
                  <div key={c.key} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-slate-800 truncate">{c.label}</p>
                        <p className="text-[11.5px] text-slate-400">
                          {c.schedule} · corrió {when(c.lastRunAt)}
                          {c.lastDurationMs != null ? ` · ${(c.lastDurationMs / 1000).toFixed(1)}s` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-bold ${s.chip}`}>{s.label}</span>
                    </div>
                    {c.lastError && (
                      <p className="mt-1.5 ml-5 text-[11.5px] text-red-600 break-words">{c.lastError}</p>
                    )}
                    {!c.lastError && c.lastResult && (
                      <p className="mt-1 ml-5 text-[11.5px] text-slate-400 break-words">{c.lastResult}</p>
                    )}
                    {c.failures > 0 && (
                      <p className="mt-1 ml-5 text-[11px] text-slate-400">{c.failures} fallo(s) de {c.runs} corridas</p>
                    )}
                  </div>
                );
              })}
            </div>
            {data.crons.every((c) => c.status === 'unknown') && (
              <p className="px-4 py-3 text-[12px] text-slate-400 border-t border-slate-100">
                Las tareas empiezan a registrarse en su próxima corrida.
              </p>
            )}
          </div>

          {/* Impresión y colas */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-[13.5px] font-bold text-slate-800 mb-2">Impresión</h2>
              <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-slate-500">Negocios con agente</span><strong className="tabular-nums text-slate-800">{data.printAgents.configured}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Conectados ahora</span><strong className="tabular-nums text-slate-800">{data.printAgents.businessesOnline}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Agentes activos</span><strong className="tabular-nums text-slate-800">{data.printAgents.agentsOnline}</strong></div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-[13.5px] font-bold text-slate-800 mb-2">Pendientes</h2>
              <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-slate-500">Comprobantes por revisar</span><strong className="tabular-nums text-slate-800">{data.queues.pendingPaymentRequests}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Pedidos abiertos</span><strong className="tabular-nums text-slate-800">{data.queues.openOrders}</strong></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

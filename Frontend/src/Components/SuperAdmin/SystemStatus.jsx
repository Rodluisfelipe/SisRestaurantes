import React, { useEffect, useState } from 'react';
import { fetchSystemStatus, sendDigestNow } from '../../services/superadminApi';

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
  const [digest, setDigest] = useState(null); // estado del envío de prueba

  const load = () => {
    setLoading(true);
    fetchSystemStatus().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // se refresca solo cada minuto
    return () => clearInterval(t);
  }, []);

  const infra = data?.health?.infraIssues || [];
  const bad = (data?.health?.cronsLate || 0) + (data?.health?.cronsError || 0) + infra.length;

  const dur = (s) => {
    if (!s && s !== 0) return '—';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  /* Barra de uso: pasa a ámbar sobre 75% y a rojo sobre 90%, que es cuando de
     verdad hay que hacer algo. */
  const Meter = ({ label, pct, detail }) => (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[12.5px] text-slate-500">{label}</span>
        <span className="text-[12.5px] font-bold text-slate-800 tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {detail && <p className="text-[11px] text-slate-400 mt-0.5">{detail}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Estado del sistema</h1>
          <p className="text-sm text-slate-500">Si la maquinaria está corriendo, sin esperar a que alguien reclame.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={async () => {
              setDigest({ sending: true });
              try {
                const r = await sendDigestNow();
                setDigest({ msg: r?.ok ? 'Resumen enviado a tu correo' : `No se envió: ${r?.result?.reason || 'revisa DIGEST_EMAIL'}`, ok: !!r?.ok });
              } catch (e) {
                setDigest({ msg: e?.response?.data?.message || 'Error al enviar', ok: false });
              }
              setTimeout(() => setDigest(null), 5000);
            }}
            disabled={digest?.sending}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 disabled:opacity-50"
          >
            {digest?.sending ? 'Enviando…' : 'Enviarme el resumen'}
          </button>
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600"
          >
            Actualizar
          </button>
        </div>
      </div>

      {digest?.msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${digest.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
          {digest.msg}
        </div>
      )}

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
              {infra.length > 0
                ? `Revisar: ${infra.join(', ')}`
                : bad > 0
                  ? `${bad} tarea${bad > 1 ? 's' : ''} necesita${bad > 1 ? 'n' : ''} atención`
                  : 'Todo corriendo con normalidad'}
            </p>
            <p className={`text-[12.5px] mt-0.5 ${bad > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              Actualizado {when(data.generatedAt)}
            </p>
          </div>

          {/* Infraestructura */}
          <div className="grid sm:grid-cols-3 gap-3">
            {/* Servidor */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[13.5px] font-bold text-slate-800">Servidor</h2>
                <span className="text-[11px] text-slate-400">{data.server?.nodeVersion}</span>
              </div>
              {data.server ? (
                <div className="space-y-2.5">
                  <Meter
                    label="Memoria"
                    pct={data.server.memory.usedPct}
                    detail={`${(data.server.memory.totalGB - data.server.memory.freeGB).toFixed(1)} de ${data.server.memory.totalGB} GB · app ${data.server.memory.processMB} MB`}
                  />
                  {data.server.disk && (
                    <Meter
                      label="Disco"
                      pct={data.server.disk.usedPct}
                      detail={`${data.server.disk.freeGB} GB libres de ${data.server.disk.totalGB} GB`}
                    />
                  )}
                  <div className="flex justify-between text-[12.5px] pt-1">
                    <span className="text-slate-500">Carga por núcleo</span>
                    <strong className={`tabular-nums ${data.server.loadPerCpu >= 1.5 ? 'text-red-600' : data.server.loadPerCpu >= 1 ? 'text-amber-600' : 'text-slate-800'}`}>
                      {data.server.loadPerCpu} <span className="font-normal text-slate-400">({data.server.cpus} núcleos)</span>
                    </strong>
                  </div>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-slate-500">Backend encendido</span>
                    <strong className="text-slate-800">{dur(data.server.uptimeSec)}</strong>
                  </div>
                </div>
              ) : <p className="text-[12.5px] text-slate-400">Sin datos</p>}
            </div>

            {/* Base de datos */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-[13.5px] font-bold text-slate-800 mb-3">Base de datos</h2>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${data.database?.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className={`text-[13px] font-semibold ${data.database?.status === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {data.database?.status === 'ok' ? 'Conectada' : 'Sin conexión'}
                </span>
              </div>
              <p className="text-[12px] text-slate-400">
                {data.database?.name ? `Base: ${data.database.name}` : `Estado: ${data.database?.state || '—'}`}
              </p>
            </div>

            {/* Spaces */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-[13.5px] font-bold text-slate-800 mb-3">Almacenamiento</h2>
              {(() => {
                const st = data.spaces?.status;
                const tone = st === 'ok' ? ['bg-emerald-500', 'text-emerald-700', 'Operativo']
                  : st === 'missing_config' ? ['bg-slate-300', 'text-slate-500', 'Sin configurar']
                  : st === 'error' ? ['bg-red-500', 'text-red-700', 'Con error']
                  : ['bg-slate-300', 'text-slate-500', 'Sin datos'];
                return (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${tone[0]}`} />
                      <span className={`text-[13px] font-semibold ${tone[1]}`}>{tone[2]}</span>
                      {data.spaces?.latencyMs != null && (
                        <span className="text-[11px] text-slate-400 ml-auto tabular-nums">{data.spaces.latencyMs} ms</span>
                      )}
                    </div>
                    <p className="text-[12px] text-slate-400 truncate">Bucket: {data.spaces?.bucket || '—'}</p>
                    {data.spaces?.error && (
                      <p className="text-[11.5px] text-red-600 mt-1 break-words">{data.spaces.error}</p>
                    )}
                  </>
                );
              })()}
            </div>
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

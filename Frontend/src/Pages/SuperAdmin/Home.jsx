import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import superadminApi from '../../services/superadminApi';

function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatNumber(n) {
  return new Intl.NumberFormat('es-CO').format(n || 0);
}

function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days}d`;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

const KPI = ({ label, value, sub, accent = 'cyan', delay = 0, icon }) => {
  const accentMap = {
    cyan: 'text-cyan-600 dark:text-cyan-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    violet: 'text-violet-600 dark:text-violet-400',
    blue: 'text-blue-600 dark:text-blue-400',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold text-slate-500 dark:text-white/35 uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${accentMap[accent] || accentMap.cyan}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 dark:text-white/40 mt-1 tabular-nums">{sub}</p>}
    </motion.div>
  );
};

const Section = ({ title, action, children }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/70 uppercase tracking-[0.06em]">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const AlertPill = ({ tone = 'amber', label, count, onClick }) => {
  if (!count) return null;
  const toneMap = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300',
    red: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300',
    blue: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-medium hover:opacity-90 transition-opacity active:scale-[0.98] ${toneMap[tone]}`}
    >
      <span className="font-bold tabular-nums">{count}</span>
      <span>{label}</span>
      <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
    </button>
  );
};

const ICONS = {
  business: <svg className="w-3.5 h-3.5 text-slate-400 dark:text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M6 19h.01M14 11h.01M14 15h.01M14 19h.01M10 7V3h8v4"/></svg>,
  orders: <svg className="w-3.5 h-3.5 text-slate-400 dark:text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  gmv: <svg className="w-3.5 h-3.5 text-slate-400 dark:text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  subs: <svg className="w-3.5 h-3.5 text-slate-400 dark:text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>,
};

export default function Home({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await superadminApi.get('/stats/overview');
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudieron cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = data?.kpis;
  const pending = data?.pending;
  const topBusinesses = data?.topBusinesses || [];
  const recent = data?.recentActivity || [];

  const lastUpdated = useMemo(() => data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '', [data]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl h-24" />
          ))}
        </div>
        <div className="bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl h-72" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-sm text-red-900 dark:text-red-300 font-medium">{error}</p>
        <button onClick={load} className="mt-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with refresh */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-slate-500 dark:text-white/40 font-medium">Resumen general de MenuBy · {lastUpdated && `actualizado ${lastUpdated}`}</p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="text-xs font-semibold text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-all flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Actualizar
        </button>
      </div>

      {/* Pending alerts row (only show those > 0) */}
      {(pending?.banners > 0 || pending?.paymentRequests > 0 || kpis?.subscriptions.expiringSoon > 0) && (
        <div className="flex flex-wrap gap-2">
          <AlertPill tone="amber" label="banners pendientes" count={pending?.banners} onClick={() => onNavigate?.('banners')} />
          <AlertPill tone="red" label="solicitudes de pago" count={pending?.paymentRequests} onClick={() => onNavigate?.('subscriptions')} />
          <AlertPill tone="blue" label={`vencen en 7 días`} count={kpis?.subscriptions.expiringSoon} onClick={() => onNavigate?.('subscriptions')} />
        </div>
      )}

      {/* KPI grid */}
      <Section title="Negocios y pedidos">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI
            label="Total negocios"
            value={formatNumber(kpis?.businesses.total)}
            sub={`${formatNumber(kpis?.businesses.active)} activos · ${formatNumber(kpis?.businesses.inactive)} inactivos`}
            accent="blue"
            delay={0}
            icon={ICONS.business}
          />
          <KPI
            label="Pedidos histórico"
            value={formatNumber(kpis?.orders.totalAllTime)}
            sub={`${formatNumber(kpis?.orders.thisMonth)} este mes · ${formatNumber(kpis?.orders.activeNow)} activos`}
            accent="cyan"
            delay={0.05}
            icon={ICONS.orders}
          />
          <KPI
            label="GMV histórico"
            value={formatCOP(kpis?.gmv.allTime)}
            sub={`${formatCOP(kpis?.gmv.thisMonth)} este mes`}
            accent="emerald"
            delay={0.1}
            icon={ICONS.gmv}
          />
          <KPI
            label="Suscripciones activas"
            value={formatNumber(kpis?.subscriptions.active)}
            sub={`${formatNumber(kpis?.subscriptions.expiringSoon)} vencen en 7 días`}
            accent="violet"
            delay={0.15}
            icon={ICONS.subs}
          />
        </div>
      </Section>

      {/* Top businesses + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="Top 5 negocios por pedidos"
          action={topBusinesses.length > 0 && (
            <button onClick={() => onNavigate?.('businesses')} className="text-[11px] font-semibold text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition">Ver todos →</button>
          )}
        >
          <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
            {topBusinesses.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-slate-500 dark:text-white/30">Sin datos todavía</p>
              </div>
            ) : (
              topBusinesses.map((b, i) => (
                <div key={b.businessId || i} className={`flex items-center gap-3 px-4 py-3 ${i < topBusinesses.length - 1 ? 'border-b border-slate-100 dark:border-white/[0.04]' : ''}`}>
                  <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-[11px] font-bold text-slate-600 dark:text-white/60">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{b.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-white/40 font-mono truncate">{b.slug || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold tabular-nums text-cyan-600 dark:text-cyan-400">{formatNumber(b.count)} pedidos</p>
                    <p className="text-[11px] tabular-nums text-slate-500 dark:text-white/40">{formatCOP(b.gmv)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section
          title="Actividad reciente"
          action={recent.length > 0 && (
            <button onClick={() => onNavigate?.('audit')} className="text-[11px] font-semibold text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition">Ver log →</button>
          )}
        >
          <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-slate-500 dark:text-white/30">Sin actividad reciente</p>
              </div>
            ) : (
              recent.map((log, i) => (
                <div key={log._id || i} className={`px-4 py-3 ${i < recent.length - 1 ? 'border-b border-slate-100 dark:border-white/[0.04]' : ''}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                      log.action === 'delete' ? 'bg-red-500' :
                      log.action === 'create' ? 'bg-emerald-500' :
                      'bg-blue-500'
                    }`} />
                    <p className="text-[13px] text-slate-900 dark:text-white/80 truncate flex-1">
                      <span className="font-semibold">{log.action}</span>
                      {' '}
                      <span className="text-slate-500 dark:text-white/50">{log.resource}</span>
                      {log.resourceName && (
                        <>
                          {' · '}
                          <span className="text-slate-700 dark:text-white/70">{log.resourceName}</span>
                        </>
                      )}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-white/35 flex-shrink-0">{formatRelative(log.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-white/40 ml-3.5 truncate">
                    {log.businessName || '—'} · por {log.userEmail || log.userRole || 'sistema'}
                  </p>
                </div>
              ))
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

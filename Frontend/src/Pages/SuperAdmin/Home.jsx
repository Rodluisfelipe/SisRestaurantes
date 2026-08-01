import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import superadminApi from '../../services/superadminApi';

/* ─── Formatters ─── */
function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
}
function formatShortCOP(n) {
  const v = n || 0;
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}
function formatNumber(n) {
  return new Intl.NumberFormat('es-CO').format(n || 0);
}
function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days}d`;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}
function greet() {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

/* ─── KPI Card ─── */
const ACCENTS = {
  blue:    { dot: 'bg-blue-500',    text: 'text-blue-600',       glow: 'shadow-blue-500/10' },
  cyan:    { dot: 'bg-cyan-500',    text: 'text-cyan-600',       glow: 'shadow-cyan-500/10' },
  emerald: { dot: 'bg-emerald-500', text: 'text-emerald-600', glow: 'shadow-emerald-500/10' },
  violet:  { dot: 'bg-violet-500',  text: 'text-violet-600',   glow: 'shadow-violet-500/10' },
};

function KPICard({ label, value, sub, accent = 'blue', delay = 0, icon }) {
  const a = ACCENTS[accent] || ACCENTS.blue;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Accent line on left */}
      <div className={`absolute left-0 top-3 bottom-3 w-[3px] ${a.dot} rounded-r-full opacity-80`} />

      <div className="pl-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          {icon && <span className={`${a.text} opacity-80`}>{icon}</span>}
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">{label}</span>
        </div>
        <p className={`text-[26px] sm:text-[28px] font-bold tabular-nums leading-none ${a.text}`}>{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-2 tabular-nums leading-relaxed">{sub}</p>}
      </div>
    </motion.div>
  );
}

function Section({ title, action, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-bold text-slate-700 uppercase tracking-[0.08em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AlertPill({ tone = 'amber', label, count, onClick }) {
  if (!count) return null;
  const toneMap = {
    amber: 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100',
    red: 'bg-red-50 border-red-300 text-red-900 hover:bg-red-100',
    blue: 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-medium transition-all active:scale-[0.98] ${toneMap[tone]}`}
    >
      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md bg-white/70 text-[11px] font-bold tabular-nums">
        {count}
      </span>
      <span>{label}</span>
      <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
    </button>
  );
}

const ICONS = {
  business: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M6 19h.01M14 11h.01M14 15h.01M14 19h.01M10 7V3h8v4"/></svg>,
  orders:   <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  gmv:      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/></svg>,
  subs:     <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>,
};

/* ─── Main Home ─── */
export default function Home({ onNavigate, userName }) {
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

  const lastUpdated = useMemo(
    () => data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '',
    [data]
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-white border border-slate-200 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-72 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-sm text-red-700 font-medium">{error}</p>
        <button onClick={load} className="mt-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition">Reintentar</button>
      </div>
    );
  }

  const hasAlerts = (pending?.banners > 0 || pending?.paymentRequests > 0 || kpis?.subscriptions?.expiringSoon > 0);

  return (
    <div className="space-y-6">
      {/* ─── Hero greeting ─── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500/[0.08] via-blue-500/[0.05] to-violet-500/[0.06] border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[22px] sm:text-[26px] font-bold text-slate-900 leading-tight tracking-tight">
              {greet()}{userName ? `, ${userName.split(' ')[0]}` : ''} 👋
            </p>
            <p className="text-[13px] text-slate-600 mt-1">
              Aquí está el pulso de MenuBy
              {lastUpdated && <span className="text-slate-400"> · actualizado {lastUpdated}</span>}
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-lg bg-white/80 border border-slate-200 hover:bg-white transition-all flex items-center gap-1.5 backdrop-blur-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Actualizar
          </button>
        </div>
      </div>

      {/* ─── Pending alerts (only if > 0) ─── */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-2">
          <AlertPill tone="amber" label="banners por aprobar" count={pending?.banners} onClick={() => onNavigate?.('banners')} />
          <AlertPill tone="red" label="solicitudes de pago" count={pending?.paymentRequests} onClick={() => onNavigate?.('subscriptions')} />
          <AlertPill tone="blue" label="suscripciones vencen en 7d" count={kpis?.subscriptions?.expiringSoon} onClick={() => onNavigate?.('subscriptions')} />
        </div>
      )}

      {/* ─── KPI grid ─── */}
      <Section title="Resumen general">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Negocios"
            value={formatNumber(kpis?.businesses?.total)}
            sub={`${formatNumber(kpis?.businesses?.active)} activos · ${formatNumber(kpis?.businesses?.inactive)} inactivos`}
            accent="blue"
            delay={0}
            icon={ICONS.business}
          />
          <KPICard
            label="Pedidos histórico"
            value={formatNumber(kpis?.orders?.totalAllTime)}
            sub={`${formatNumber(kpis?.orders?.thisMonth)} este mes · ${formatNumber(kpis?.orders?.activeNow)} en curso`}
            accent="cyan"
            delay={0.06}
            icon={ICONS.orders}
          />
          <KPICard
            label="GMV histórico"
            value={formatShortCOP(kpis?.gmv?.allTime)}
            sub={`${formatShortCOP(kpis?.gmv?.thisMonth)} este mes`}
            accent="emerald"
            delay={0.12}
            icon={ICONS.gmv}
          />
          <KPICard
            label="Suscripciones"
            value={formatNumber(kpis?.subscriptions?.active)}
            sub={`${formatNumber(kpis?.subscriptions?.expiringSoon)} vencen en 7 días`}
            accent="violet"
            delay={0.18}
            icon={ICONS.subs}
          />
        </div>
      </Section>

      {/* ─── Top businesses + Recent activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="Top 5 negocios por pedidos"
          action={topBusinesses.length > 0 && (
            <button onClick={() => onNavigate?.('businesses')} className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition flex items-center gap-1">
              Ver todos
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          )}
        >
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {topBusinesses.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-xs text-slate-500">Sin datos todavía</p>
              </div>
            ) : (
              topBusinesses.map((b, i) => {
                const total = topBusinesses[0]?.count || 1;
                const pct = Math.round((b.count / total) * 100);
                return (
                  <div key={b.businessId || i} className={`px-4 py-3 ${i < topBusinesses.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-[11px] font-bold text-cyan-700 shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{b.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">{b.slug || '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums text-cyan-600">{formatNumber(b.count)}</p>
                        <p className="text-[11px] tabular-nums text-slate-500">{formatShortCOP(b.gmv)}</p>
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.1 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Section>

        <Section
          title="Actividad reciente"
          action={recent.length > 0 && (
            <button onClick={() => onNavigate?.('audit')} className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition flex items-center gap-1">
              Ver log
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          )}
        >
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {recent.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-xs text-slate-500">Sin actividad reciente</p>
              </div>
            ) : (
              recent.map((log, i) => {
                const tone =
                  log.action === 'delete' ? 'bg-red-500' :
                  log.action === 'create' ? 'bg-emerald-500' :
                  log.action === 'update' ? 'bg-blue-500' :
                  'bg-slate-400';
                return (
                  <div key={log._id || i} className={`px-4 py-3 ${i < recent.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${tone} shrink-0`} />
                      <p className="text-[13px] text-slate-900 truncate flex-1">
                        <span className="font-semibold capitalize">{log.action}</span>
                        {' '}
                        <span className="text-slate-500">{log.resource}</span>
                        {log.resourceName && (
                          <>
                            {' · '}
                            <span className="text-slate-700">{log.resourceName}</span>
                          </>
                        )}
                      </p>
                      <span className="text-[11px] text-slate-500 shrink-0">{formatRelative(log.createdAt)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 ml-3.5 truncate">
                      {log.businessName || '—'} · {log.userEmail || log.userRole || 'sistema'}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

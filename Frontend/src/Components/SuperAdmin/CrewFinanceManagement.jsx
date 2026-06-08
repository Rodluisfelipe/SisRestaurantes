/**
 * CrewFinanceManagement — panel central de finanzas Crew para SuperAdmin.
 *
 * Tabs:
 *   - Resumen (treasury): saldos agregados, comisión por mes, actividad reciente
 *   - Recargas: cola de solicitudes con comprobante para aprobar/rechazar
 *   - Retiros: cola de solicitudes de workers para pagar a Nequi/etc
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import superadminApi from '../../services/superadminApi';
import { SAButton, SAModal, SABadge, SAEmptyState, SAToast } from './ui';

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

function formatRelative(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `Hace ${days}d`;
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABS = [
  { id: 'treasury', label: 'Resumen' },
  { id: 'recharges', label: 'Recargas' },
  { id: 'withdrawals', label: 'Retiros' },
];

export default function CrewFinanceManagement() {
  const [tab, setTab] = useState('treasury');
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'treasury' && (
          <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TreasuryView />
          </motion.div>
        )}
        {tab === 'recharges' && (
          <motion.div key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RechargesQueue setToast={setToast} />
          </motion.div>
        )}
        {tab === 'withdrawals' && (
          <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <WithdrawalsQueue setToast={setToast} />
          </motion.div>
        )}
      </AnimatePresence>

      <SAToast
        type={toast.type}
        message={toast.message}
        isVisible={toast.visible}
        onClose={() => setToast({ ...toast, visible: false })}
      />
    </div>
  );
}

/* ─────────── Treasury ─────────── */

function TreasuryView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await superadminApi.get('/crew/treasury');
        setData(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 animate-pulse">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]" />)}
      </div>
    );
  }

  if (!data) return null;

  const t = data.treasury.businesses;
  const w = data.treasury.pendingWithdrawals;
  const commissionTotal = data.commissionByMonth.reduce((s, m) => s + m.total, 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard label="Saldo disponible (negocios)" value={formatCOP(t.totalAvailable)} hint={`${t.rechargedBusinesses} negocio(s) con saldo`} tone="emerald" />
        <KpiCard label="Reservado en escrow" value={formatCOP(t.totalInEscrow)} hint="Turnos publicados, no liberados" tone="amber" />
        <KpiCard label="Pagado a workers (vida)" value={formatCOP(t.totalLifetimeSpent)} hint="Total histórico" tone="sky" />
        <KpiCard label="Comisión Crew (vida)" value={formatCOP(t.totalLifetimeCommission)} hint="Ingresos de la plataforma" tone="violet" />
      </div>

      {/* Comisión por mes */}
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Comisión por mes</h3>
          <span className="text-xs text-slate-500 dark:text-white/40">
            Total <strong className="text-slate-900 dark:text-white tabular-nums">{formatCOP(commissionTotal)}</strong>
          </span>
        </div>
        {data.commissionByMonth.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-white/40 text-center py-4">Aún no hay comisiones registradas.</p>
        ) : (
          <div className="space-y-1.5">
            {data.commissionByMonth.map((m) => {
              const max = Math.max(...data.commissionByMonth.map(x => x.total));
              const pct = max > 0 ? (m.total / max) * 100 : 0;
              return (
                <div key={m._id} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 dark:text-white/50 w-16 shrink-0">{m._id}</span>
                  <div className="flex-1 h-6 bg-slate-100 dark:bg-white/[0.04] rounded-md relative overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-md"
                    />
                    <span className="absolute inset-0 flex items-center justify-end px-2 text-[11px] font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatCOP(m.total)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-white/30 w-12 text-right tabular-nums">{m.count} ops</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pendiente */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Retiros pendientes de pagar</p>
            <p className="text-[22px] font-extrabold text-amber-900 dark:text-amber-200 tabular-nums mt-0.5">{formatCOP(w.total)}</p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">{w.count} solicitud(es)</p>
          </div>
          <svg className="w-10 h-10 text-amber-400 dark:text-amber-500/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint, tone }) {
  const tones = {
    emerald: 'from-emerald-500/15 to-transparent border-emerald-200 dark:border-emerald-500/20',
    amber: 'from-amber-500/15 to-transparent border-amber-200 dark:border-amber-500/20',
    sky: 'from-sky-500/15 to-transparent border-sky-200 dark:border-sky-500/20',
    violet: 'from-violet-500/15 to-transparent border-violet-200 dark:border-violet-500/20',
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${tones[tone]} dark:bg-white/[0.02] p-3.5`}>
      <p className="text-[10px] font-bold text-slate-600 dark:text-white/50 uppercase tracking-wider">{label}</p>
      <p className="text-[18px] font-extrabold text-slate-900 dark:text-white tabular-nums mt-1 leading-tight">{value}</p>
      <p className="text-[10px] text-slate-500 dark:text-white/40 mt-0.5">{hint}</p>
    </div>
  );
}

/* ─────────── Recharges queue ─────────── */

function RechargesQueue({ setToast }) {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await superadminApi.get('/crew/recharges', { params: { status } });
      setItems(data.requests || []);
      setCounts(data.counts || {});
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'Error al cargar' });
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id, action) => {
    setBusy(true);
    try {
      const body = action === 'reject' ? { reason } : {};
      await superadminApi.post(`/crew/recharges/${id}/${action}`, body);
      setToast({ visible: true, type: 'success', message: action === 'approve' ? 'Recarga aprobada y acreditada' : 'Recarga rechazada' });
      setTarget(null); setRejecting(false); setReason('');
      load();
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'No se pudo procesar' });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-lg w-fit">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
              status === s ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-white/40'
            }`}
          >
            <span className="capitalize">{s === 'pending' ? 'En revisión' : s === 'approved' ? 'Aprobadas' : 'Rechazadas'}</span>
            {(counts[s]?.count || 0) > 0 && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                s === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                  : s === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
              }`}>{counts[s].count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-2 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl border border-slate-200 dark:border-white/[0.06]" />)}
        </div>
      ) : items.length === 0 ? (
        <SAEmptyState title="Sin solicitudes" description={status === 'pending' ? 'Cuando un negocio recargue saldo, aparecerá acá para tu aprobación.' : 'Sin registros en este estado.'} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {items.map((r) => (
            <button
              key={r._id}
              onClick={() => { setTarget(r); setRejecting(false); setReason(''); }}
              className="text-left p-3 rounded-xl border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] bg-white dark:bg-white/[0.03] transition flex items-center gap-3"
            >
              <img src={r.proofUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-white/[0.06] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {r.businessId?.businessName || 'Negocio'}
                </p>
                <p className="text-[18px] font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {formatCOP(r.amount)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-white/40">
                  {r.paymentMethod} · {formatRelative(r.createdAt)}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </button>
          ))}
        </div>
      )}

      <SAModal
        isOpen={!!target}
        onClose={() => { setTarget(null); setRejecting(false); setReason(''); }}
        title="Revisar recarga"
        subtitle={target?.businessId?.businessName}
        width="max-w-2xl"
      >
        {target && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <DetailStat label="Monto" value={formatCOP(target.amount)} />
              <DetailStat label="Método" value={target.paymentMethod} />
              <DetailStat label="Saldo actual" value={formatCOP(target.businessId?.crewWallet?.balance || 0)} />
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider mb-2">Comprobante</p>
              <a href={target.proofUrl} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-white/[0.04]">
                <img src={target.proofUrl} alt="Comprobante" className="w-full max-h-[460px] object-contain" />
              </a>
            </div>

            <div className="text-xs text-slate-500 dark:text-white/40 space-y-0.5">
              <p>Enviado: {new Date(target.createdAt).toLocaleString('es-CO')}</p>
              {target.notes && <p>Nota del negocio: {target.notes}</p>}
              {target.reviewedAt && <p>Revisado: {new Date(target.reviewedAt).toLocaleString('es-CO')} {target.reviewedBy?.email && `por ${target.reviewedBy.email}`}</p>}
              {target.rejectionReason && <p className="text-rose-600 dark:text-rose-400">Motivo del rechazo: {target.rejectionReason}</p>}
            </div>

            {rejecting && (
              <div className="bg-rose-50 dark:bg-rose-500/[0.08] border border-rose-200 dark:border-rose-500/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Motivo del rechazo</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 300))}
                  placeholder="Ej: El comprobante no es legible, el monto no coincide, transferencia no recibida…"
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
            )}

            {target.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                {rejecting ? (
                  <>
                    <SAButton variant="ghost" onClick={() => { setRejecting(false); setReason(''); }} disabled={busy}>Cancelar</SAButton>
                    <div className="flex-1" />
                    <SAButton variant="danger" disabled={busy || !reason.trim()} onClick={() => decide(target._id, 'reject')}>
                      Confirmar rechazo
                    </SAButton>
                  </>
                ) : (
                  <>
                    <SAButton variant="danger" onClick={() => setRejecting(true)} disabled={busy}>Rechazar</SAButton>
                    <div className="flex-1" />
                    <SAButton variant="primary" disabled={busy} onClick={() => decide(target._id, 'approve')}>
                      Aprobar y acreditar {formatCOP(target.amount)}
                    </SAButton>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </SAModal>
    </div>
  );
}

/* ─────────── Withdrawals queue ─────────── */

function WithdrawalsQueue({ setToast }) {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [externalRef, setExternalRef] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await superadminApi.get('/crew/withdrawals', { params: { status } });
      setItems(data.withdrawals || []);
      setCounts(data.counts || {});
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'Error al cargar' });
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const pay = async (id) => {
    setBusy(true);
    try {
      await superadminApi.post(`/crew/withdrawals/${id}/pay`, { externalReference: externalRef || null });
      setToast({ visible: true, type: 'success', message: 'Retiro marcado como pagado' });
      setTarget(null); setExternalRef('');
      load();
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'No se pudo procesar' });
    } finally { setBusy(false); }
  };

  const reject = async (id) => {
    setBusy(true);
    try {
      await superadminApi.post(`/crew/withdrawals/${id}/reject`, { reason });
      setToast({ visible: true, type: 'success', message: 'Retiro rechazado y devuelto' });
      setTarget(null); setRejecting(false); setReason('');
      load();
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'No se pudo procesar' });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-lg w-fit">
        {['pending', 'paid', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
              status === s ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-white/40'
            }`}
          >
            {s === 'pending' ? 'Por pagar' : s === 'paid' ? 'Pagados' : 'Rechazados'}
            {(counts[s]?.count || 0) > 0 && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                s === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                  : s === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
              }`}>{counts[s].count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-2 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl border border-slate-200 dark:border-white/[0.06]" />)}
        </div>
      ) : items.length === 0 ? (
        <SAEmptyState title="Sin retiros" description={status === 'pending' ? 'Cuando un worker pida retirar saldo, aparecerá acá.' : 'Sin registros en este estado.'} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {items.map((w) => (
            <button
              key={w._id}
              onClick={() => { setTarget(w); setExternalRef(''); setRejecting(false); setReason(''); }}
              className="text-left p-3 rounded-xl border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] bg-white dark:bg-white/[0.03] transition flex items-center gap-3"
            >
              {w.workerId?.photo ? (
                <img src={w.workerId.photo} alt="" className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-white/[0.06] shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-white/[0.06] dark:to-white/[0.03] flex items-center justify-center text-[14px] font-bold text-slate-700 dark:text-white/70 shrink-0">
                  {(w.workerId?.name || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{w.workerId?.name}</p>
                <p className="text-[18px] font-extrabold text-slate-900 dark:text-white tabular-nums leading-none mt-0.5">{formatCOP(w.amount)}</p>
                <p className="text-[10px] text-slate-500 dark:text-white/40 capitalize">{w.payoutMethod?.type} · {w.payoutMethod?.accountInfo}</p>
              </div>
              <StatusBadge status={w.status} />
            </button>
          ))}
        </div>
      )}

      <SAModal
        isOpen={!!target}
        onClose={() => { setTarget(null); setExternalRef(''); setRejecting(false); setReason(''); }}
        title={`Retiro · ${target?.workerId?.name || ''}`}
        subtitle={target?.workerId?.phone}
        width="max-w-lg"
      >
        {target && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03] p-4 text-center">
              <p className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider">Monto a pagar</p>
              <p className="text-[28px] font-extrabold text-slate-900 dark:text-white tabular-nums">{formatCOP(target.amount)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DetailStat label="Método" value={target.payoutMethod?.type?.toUpperCase()} />
              <DetailStat label="Cuenta" value={target.payoutMethod?.accountInfo} />
              {target.payoutMethod?.holderName && <DetailStat label="Titular" value={target.payoutMethod.holderName} />}
              <DetailStat label="KYC del worker" value={target.workerId?.kyc?.status || 'none'} />
            </div>

            <div className="text-xs text-slate-500 dark:text-white/40 space-y-0.5">
              <p>Solicitado: {new Date(target.createdAt).toLocaleString('es-CO')}</p>
              {target.paidAt && <p>Pagado: {new Date(target.paidAt).toLocaleString('es-CO')} {target.paidBy?.email && `por ${target.paidBy.email}`}</p>}
              {target.externalReference && <p>Referencia externa: {target.externalReference}</p>}
              {target.rejectionReason && <p className="text-rose-600 dark:text-rose-400">Motivo del rechazo: {target.rejectionReason}</p>}
            </div>

            {target.status === 'pending' && !rejecting && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider mb-1.5">Referencia del comprobante (opcional)</p>
                <input
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  placeholder="Ej: M0123456 (id transacción Nequi)"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {target.status === 'pending' && rejecting && (
              <div className="bg-rose-50 dark:bg-rose-500/[0.08] border border-rose-200 dark:border-rose-500/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Motivo del rechazo</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 300))}
                  placeholder="Ej: Cuenta destino inválida, datos no coinciden con el titular…"
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
            )}

            {target.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                {rejecting ? (
                  <>
                    <SAButton variant="ghost" onClick={() => { setRejecting(false); setReason(''); }} disabled={busy}>Cancelar</SAButton>
                    <div className="flex-1" />
                    <SAButton variant="danger" disabled={busy || !reason.trim()} onClick={() => reject(target._id)}>
                      Confirmar rechazo
                    </SAButton>
                  </>
                ) : (
                  <>
                    <SAButton variant="danger" onClick={() => setRejecting(true)} disabled={busy}>Rechazar</SAButton>
                    <div className="flex-1" />
                    <SAButton variant="primary" disabled={busy} onClick={() => pay(target._id)}>
                      Marcar como pagado
                    </SAButton>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </SAModal>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'pending') return <SABadge variant="warning">Pendiente</SABadge>;
  if (status === 'approved' || status === 'paid') return <SABadge variant="success">{status === 'paid' ? 'Pagado' : 'Aprobado'}</SABadge>;
  if (status === 'rejected') return <SABadge variant="danger">Rechazado</SABadge>;
  return <SABadge variant="neutral">{status}</SABadge>;
}

function DetailStat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate tabular-nums">{value || '—'}</p>
    </div>
  );
}

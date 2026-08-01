/**
 * CrewVacanciesManagement — moderación de vacantes (SuperAdmin).
 *
 * - Tabs por status
 * - Filtro por ownerType (business / crew_employer)
 * - Detalle + acción "Cerrar manualmente" con motivo (para vacantes que violen políticas)
 * - KPI de ingresos por fees + breakdown mensual
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import superadminApi from '../../services/superadminApi';
import { SAButton, SAModal, SABadge, SAEmptyState, SAToast } from './ui';

const STATUS_TABS = [
  { key: 'published', label: 'Activas' },
  { key: 'paused', label: 'Pausadas' },
  { key: 'closed', label: 'Cerradas' },
  { key: 'expired', label: 'Expiradas' },
  { key: 'all', label: 'Todas' },
];

const OWNER_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'business', label: 'Negocios MenuBy' },
  { key: 'crew_employer', label: 'Empleadores externos' },
];

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

function formatRelative(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `Hace ${days}d`;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CrewVacanciesManagement() {
  const [status, setStatus] = useState('published');
  const [ownerType, setOwnerType] = useState('all');
  const [vacancies, setVacancies] = useState([]);
  const [counts, setCounts] = useState({});
  const [feesByMonth, setFeesByMonth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status };
      if (ownerType !== 'all') params.ownerType = ownerType;
      const { data } = await superadminApi.get('/crew/vacancies', { params });
      setVacancies(data.vacancies || []);
      setCounts(data.counts || {});
      setFeesByMonth(data.feesByMonth || []);
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'Error al cargar' });
    } finally { setLoading(false); }
  }, [status, ownerType]);

  useEffect(() => { load(); }, [load]);

  const closeVacancy = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await superadminApi.post(`/crew/vacancies/${target._id}/close`, { reason });
      setToast({ visible: true, type: 'success', message: 'Vacante cerrada' });
      setTarget(null); setClosing(false); setReason('');
      load();
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'No se pudo cerrar' });
    } finally { setBusy(false); }
  };

  const totalFeesAll = feesByMonth.reduce((s, m) => s + (m.total || 0), 0);
  const totalCountAll = feesByMonth.reduce((s, m) => s + (m.count || 0), 0);

  return (
    <div className="space-y-4">
      {/* KPI revenue */}
      <div className="grid sm:grid-cols-3 gap-2">
        <KpiCard label="Vacantes pagadas (últimos 12 meses)" value={totalCountAll} tone="slate" />
        <KpiCard label="Ingresos por fees" value={formatCOP(totalFeesAll)} tone="violet" />
        <KpiCard label="Activas ahora" value={counts.published?.total || 0} tone="emerald" />
      </div>

      {/* Fees by month */}
      {feesByMonth.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Ingresos por mes</p>
          <div className="space-y-1.5">
            {feesByMonth.map((m) => {
              const max = Math.max(...feesByMonth.map((x) => x.total || 0));
              const pct = max > 0 ? ((m.total || 0) / max) * 100 : 0;
              return (
                <div key={m._id} className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-slate-500 w-16 shrink-0">{m._id || '—'}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-md relative overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-md"
                    />
                    <span className="absolute inset-0 flex items-center justify-end px-2 text-[10.5px] font-bold tabular-nums text-slate-900">
                      {formatCOP(m.total)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 w-12 text-right tabular-nums">{m.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {STATUS_TABS.map((t) => {
          const c = counts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
 status === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
 }`}
            >
              {t.label}
              {c?.total > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-violet-100 text-violet-700">{c.total}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Owner filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mr-1">Origen:</span>
        {OWNER_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setOwnerType(f.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
 ownerType === f.key
 ? 'bg-slate-900 text-white border-slate-900'
 : 'bg-white text-slate-500 border-slate-200'
 }`}
          >{f.label}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-2 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl border border-slate-200" />)}
        </div>
      ) : vacancies.length === 0 ? (
        <SAEmptyState title="No hay vacantes en este filtro" description="Cambia los filtros para ver más resultados." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {vacancies.map((v) => (
            <VacancyCard key={v._id} vacancy={v} onClick={() => { setTarget(v); setClosing(false); setReason(''); }} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      <SAModal
        isOpen={!!target}
        onClose={() => { setTarget(null); setClosing(false); setReason(''); }}
        title={target?.title}
        subtitle={target ? `${target.role} · ${target.applicationCount || 0} postulantes` : ''}
        width="max-w-2xl"
      >
        {target && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <DetailStat label="Estado"><StatusBadge status={target.status} /></DetailStat>
              <DetailStat label="Origen">
                {target.ownerType === 'business'
                  ? <SABadge variant="info">Negocio MenuBy</SABadge>
                  : <SABadge variant="warning">Empleador externo</SABadge>}
              </DetailStat>
              <DetailStat label="Vistas" value={target.viewCount || 0} />
              <DetailStat label="Postulantes" value={target.applicationCount || 0} />
              <DetailStat label="Costo pagado" value={formatCOP(target.pricePaid)} />
              <DetailStat label="Horario" value={target.schedule || '—'} />
              <DetailStat label="Ubicación" value={target.location?.city || (target.location?.isRemote ? 'Remoto' : '—')} />
              <DetailStat label="Publicada" value={formatRelative(target.publishedAt)} />
            </div>

            {target.ownerType === 'business' && target.businessId?.businessName && (
              <DetailStat label="Negocio" value={target.businessId.businessName} />
            )}
            {target.ownerType === 'crew_employer' && target.employerId?.name && (
              <DetailStat label="Empleador" value={`${target.employerId.name} (${target.employerId.kind})`} />
            )}

            {target.description && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{target.description}</p>
              </div>
            )}

            {target.customQuestions?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Preguntas personalizadas ({target.customQuestions.length})</p>
                <div className="space-y-1.5">
                  {target.customQuestions.map((q, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-700">{q.question}{q.required && <span className="text-rose-500 ml-1">*</span>}</p>
                      <p className="text-[10.5px] text-slate-500 mt-0.5">Tipo: {q.type}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500 space-y-0.5">
              <p>Publicada: {target.publishedAt ? new Date(target.publishedAt).toLocaleString('es-CO') : '—'}</p>
              {target.expiresAt && <p>Expira: {new Date(target.expiresAt).toLocaleString('es-CO')}</p>}
              {target.closeReason && <p className="text-rose-600">Cerrada: {target.closeReason}</p>}
            </div>

            {closing && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-rose-700">Motivo del cierre manual</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 280))}
                  placeholder="Ej: Contenido inapropiado, no cumple políticas, datos sospechosos…"
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
            )}

            {target.status !== 'closed' && (
              <div className="flex gap-2 pt-2">
                {closing ? (
                  <>
                    <SAButton variant="ghost" onClick={() => { setClosing(false); setReason(''); }} disabled={busy}>Cancelar</SAButton>
                    <div className="flex-1" />
                    <SAButton variant="danger" disabled={busy || !reason.trim()} onClick={closeVacancy}>
                      Confirmar cierre manual
                    </SAButton>
                  </>
                ) : (
                  <SAButton variant="danger" onClick={() => setClosing(true)}>Cerrar manualmente</SAButton>
                )}
              </div>
            )}
          </div>
        )}
      </SAModal>

      <SAToast
        type={toast.type}
        message={toast.message}
        isVisible={toast.visible}
        onClose={() => setToast({ ...toast, visible: false })}
      />
    </div>
  );
}

function KpiCard({ label, value, tone }) {
  const tones = {
    slate: 'border-slate-200 bg-white',
    violet: 'border-violet-200 bg-violet-50',
    emerald: 'border-emerald-200 bg-emerald-50',
  };
  return (
    <div className={`rounded-xl border p-3.5 ${tones[tone]}`}>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-[20px] font-extrabold text-slate-900 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function VacancyCard({ vacancy, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-semibold text-slate-900 truncate flex-1">{vacancy.title}</p>
        <StatusBadge status={vacancy.status} />
      </div>
      <p className="text-[11px] text-slate-500 truncate">
        {vacancy.ownerType === 'business' ? (vacancy.businessId?.businessName || 'Negocio MenuBy') : (vacancy.employerId?.name || 'Empleador externo')}
        {' · '}{vacancy.role}
      </p>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <span className="text-[10.5px] text-slate-500">{vacancy.applicationCount || 0} postulantes</span>
        <span className="text-[10.5px] text-slate-400">{formatRelative(vacancy.publishedAt)}</span>
      </div>
    </button>
  );
}

function StatusBadge({ status }) {
  if (status === 'published') return <SABadge variant="success">Activa</SABadge>;
  if (status === 'paused') return <SABadge variant="warning">Pausada</SABadge>;
  if (status === 'closed') return <SABadge variant="danger">Cerrada</SABadge>;
  if (status === 'expired') return <SABadge variant="neutral">Expirada</SABadge>;
  if (status === 'draft') return <SABadge variant="neutral">Borrador</SABadge>;
  return <SABadge variant="neutral">{status}</SABadge>;
}

function DetailStat({ label, value, children }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="text-sm font-semibold text-slate-900 mt-0.5">{children || value}</div>
    </div>
  );
}

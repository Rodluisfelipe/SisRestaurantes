/**
 * CrewEmployersManagement — cola de aprobación/gestión de empleadores Crew externos.
 *
 * Tabs por status, filtro por kind (individual/business), detalle en modal con
 * acciones aprobar / rechazar (motivo) / suspender / restaurar.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import superadminApi from '../../services/superadminApi';
import { SAButton, SAModal, SABadge, SAEmptyState, SAToast } from './ui';

const STATUS_TABS = [
  { key: 'pending_approval', label: 'En revisión' },
  { key: 'approved', label: 'Aprobados' },
  { key: 'rejected', label: 'Rechazados' },
  { key: 'suspended', label: 'Suspendidos' },
];

const REJECT_REASONS = [
  'Información incompleta o no verificable',
  'Tipo de negocio fuera del alcance Crew',
  'No es posible contactar al solicitante',
  'Datos inconsistentes (nombre/teléfono/ubicación)',
  'Cuenta duplicada',
];

const KIND_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'individual', label: 'Personas' },
  { key: 'business', label: 'Negocios' },
];

const BUSINESS_TYPE_LABEL = {
  restaurant: 'Restaurante', cafe: 'Café', bar: 'Bar', bakery: 'Panadería',
  hotel: 'Hotel', catering: 'Catering', event_organizer: 'Organizador eventos',
  wedding: 'Bodas', corporate_event: 'Evento corporativo', production: 'Producción',
  retail: 'Retail', salon: 'Salón belleza', spa: 'Spa', clinic: 'Clínica',
  cleaning: 'Limpieza', moving: 'Mudanzas', services: 'Otros servicios', other: 'Otro',
  ice_cream: 'Heladería', fast_food: 'Comida rápida', food_truck: 'Food truck',
  home_service: 'Servicio a domicilio', private_party: 'Fiesta privada',
};

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

export default function CrewEmployersManagement() {
  const [status, setStatus] = useState('pending_approval');
  const [kindFilter, setKindFilter] = useState('all');
  const [employers, setEmployers] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status };
      if (kindFilter !== 'all') params.kind = kindFilter;
      const { data } = await superadminApi.get('/crew/employers', { params });
      setEmployers(data.employers || []);
      setCounts(data.counts || {});
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'Error al cargar' });
    } finally { setLoading(false); }
  }, [status, kindFilter]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id, action) => {
    setBusy(true);
    try {
      const body = action === 'reject' ? { reason } : {};
      await superadminApi.post(`/crew/employers/${id}/${action}`, body);
      setToast({
        visible: true, type: 'success',
        message: action === 'approve' ? 'Empleador aprobado' :
                 action === 'reject' ? 'Empleador rechazado' :
                 action === 'suspend' ? 'Empleador suspendido' :
                 'Empleador restaurado',
      });
      setTarget(null); setRejecting(false); setReason('');
      load();
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'No se pudo procesar' });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-lg w-fit overflow-x-auto">
        {STATUS_TABS.map((t) => {
          const c = counts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                status === t.key
                  ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60'
              }`}
            >
              {t.label}
              {c?.total > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  t.key === 'pending_approval' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                  : t.key === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : t.key === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                  : 'bg-slate-200 text-slate-700 dark:bg-white/[0.10] dark:text-white/60'
                }`}>{c.total}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Kind filter */}
      <div className="flex gap-1.5 items-center">
        <span className="text-[11px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider">Tipo:</span>
        {KIND_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setKindFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
              kindFilter === f.key
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-slate-900 dark:border-white'
                : 'bg-white dark:bg-white/[0.04] text-slate-500 dark:text-white/50 border-slate-200 dark:border-white/[0.08] hover:border-slate-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl" />
          ))}
        </div>
      ) : employers.length === 0 ? (
        <SAEmptyState
          title={status === 'pending_approval' ? 'No hay solicitudes pendientes' : `No hay empleadores en estado "${status}"`}
          description={status === 'pending_approval' ? 'Cuando un nuevo empleador se registre, aparecerá acá para tu aprobación.' : 'Sin registros en este estado.'}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {employers.map((e) => (
            <button
              key={e._id}
              onClick={() => { setTarget(e); setRejecting(false); setReason(''); }}
              className="text-left p-3 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] rounded-xl transition flex items-start gap-3"
            >
              {e.photo ? (
                <img src={e.photo} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-white/[0.06] shrink-0" />
              ) : (
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-[14px] font-bold shrink-0 ${
                  e.kind === 'individual'
                    ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                    : 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300'
                }`}>
                  {e.kind === 'individual' ? '👤' : '🏢'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{e.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-white/40 truncate">
                  {e.phone}
                  {e.kind === 'business' && e.businessType ? ` · ${BUSINESS_TYPE_LABEL[e.businessType] || e.businessType}` : ''}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <KindPill kind={e.kind} />
                  <StatusPill status={e.status} />
                  <span className="text-[10px] text-slate-400 dark:text-white/30">{formatRelative(e.createdAt)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <SAModal
        isOpen={!!target}
        onClose={() => { setTarget(null); setRejecting(false); setReason(''); }}
        title={target?.name || 'Empleador'}
        subtitle={target ? `${target.kind === 'individual' ? 'Persona' : 'Negocio'} · ${target.phone}` : ''}
        width="max-w-2xl"
      >
        {target && (
          <div className="space-y-4">
            {/* Info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <DetailStat label="Estado">
                <StatusPill status={target.status} />
              </DetailStat>
              <DetailStat label="Tipo">
                <KindPill kind={target.kind} />
              </DetailStat>
              {target.kind === 'business' && (
                <DetailStat label="Categoría" value={BUSINESS_TYPE_LABEL[target.businessType] || target.businessType || '—'} />
              )}
              <DetailStat label="Email" value={target.email || '—'} />
              <DetailStat label="WhatsApp" value={target.whatsappNumber || '—'} />
              {target.address?.city && (
                <DetailStat label="Ciudad" value={target.address.city} />
              )}
              {target.kind === 'business' && target.nit && (
                <DetailStat label="NIT" value={target.nit} />
              )}
              {target.address?.full && (
                <DetailStat label="Dirección" value={target.address.full} />
              )}
            </div>

            {/* Wallet snapshot */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider mb-2">Billetera Crew</p>
              <div className="grid grid-cols-3 gap-2">
                <DetailStat label="Saldo" value={formatCOP(target.crewWallet?.balance)} />
                <DetailStat label="En escrow" value={formatCOP(target.crewWallet?.pendingBalance)} />
                <DetailStat label="Gastado vida" value={formatCOP(target.crewWallet?.totalSpent)} />
              </div>
            </div>

            {/* Stats */}
            {target.stats && (target.stats.shiftsPublished > 0 || target.stats.shiftsCompleted > 0) && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider mb-2">Actividad</p>
                <div className="grid grid-cols-3 gap-2">
                  <DetailStat label="Publicados" value={target.stats.shiftsPublished} />
                  <DetailStat label="Completados" value={target.stats.shiftsCompleted} />
                  <DetailStat label="Cancelaciones" value={target.stats.cancellations} />
                </div>
              </div>
            )}

            {/* Trace meta */}
            <div className="text-xs text-slate-500 dark:text-white/40 space-y-0.5">
              <p>Registro: {new Date(target.createdAt).toLocaleString('es-CO')}</p>
              {target.approvedAt && (
                <p>Aprobado: {new Date(target.approvedAt).toLocaleString('es-CO')}{target.approvedBy?.email ? ` por ${target.approvedBy.email}` : ''}</p>
              )}
              {target.rejectionReason && (
                <p className="text-rose-600 dark:text-rose-400">Motivo del rechazo: {target.rejectionReason}</p>
              )}
              {target.suspendedUntil && (
                <p>Suspendido hasta: {new Date(target.suspendedUntil).toLocaleString('es-CO')}</p>
              )}
            </div>

            {/* Reject reason form */}
            {rejecting && (
              <div className="bg-rose-50 dark:bg-rose-500/[0.08] border border-rose-200 dark:border-rose-500/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Motivo del rechazo</p>
                <div className="flex flex-wrap gap-1.5">
                  {REJECT_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition ${
                        reason === r
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-white/[0.04] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/[0.08] hover:border-slate-300'
                      }`}
                    >{r}</button>
                  ))}
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 300))}
                  placeholder="Detalles que el empleador verá al ingresar…"
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 flex-wrap">
              {target.status === 'pending_approval' && !rejecting && (
                <>
                  <SAButton variant="danger" onClick={() => setRejecting(true)} disabled={busy}>Rechazar</SAButton>
                  <div className="flex-1" />
                  <SAButton variant="primary" disabled={busy} onClick={() => decide(target._id, 'approve')}>
                    Aprobar empleador
                  </SAButton>
                </>
              )}
              {target.status === 'pending_approval' && rejecting && (
                <>
                  <SAButton variant="ghost" onClick={() => { setRejecting(false); setReason(''); }} disabled={busy}>Cancelar</SAButton>
                  <div className="flex-1" />
                  <SAButton variant="danger" disabled={busy || !reason.trim()} onClick={() => decide(target._id, 'reject')}>
                    Confirmar rechazo
                  </SAButton>
                </>
              )}
              {target.status === 'approved' && (
                <SAButton variant="danger" disabled={busy} onClick={() => decide(target._id, 'suspend')}>
                  Suspender
                </SAButton>
              )}
              {(target.status === 'suspended' || target.status === 'rejected') && (
                <SAButton variant="primary" disabled={busy} onClick={() => decide(target._id, 'restore')}>
                  Restaurar a aprobado
                </SAButton>
              )}
            </div>
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

function KindPill({ kind }) {
  if (kind === 'individual') return <SABadge variant="purple">Persona</SABadge>;
  return <SABadge variant="info">Negocio</SABadge>;
}

function StatusPill({ status }) {
  if (status === 'approved') return <SABadge variant="success">Aprobado</SABadge>;
  if (status === 'pending_approval') return <SABadge variant="warning">En revisión</SABadge>;
  if (status === 'rejected') return <SABadge variant="danger">Rechazado</SABadge>;
  if (status === 'suspended') return <SABadge variant="warning">Suspendido</SABadge>;
  if (status === 'banned') return <SABadge variant="danger">Bloqueado</SABadge>;
  return <SABadge variant="neutral">{status}</SABadge>;
}

function DetailStat({ label, value, children }) {
  return (
    <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2">
      <p className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-wider">{label}</p>
      <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{children || value}</div>
    </div>
  );
}

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

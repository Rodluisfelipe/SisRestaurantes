import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import superadminApi from '../../services/superadminApi';
import { SAButton, SAModal, SABadge, SAEmptyState, SAToast } from './ui';

const STATUS_TABS = [
  { key: 'pending', label: 'En revisión' },
  { key: 'approved', label: 'Aprobados' },
  { key: 'rejected', label: 'Rechazados' },
];

const REJECT_REASONS = [
  'Documento ilegible o borroso',
  'Selfie no coincide con la cédula',
  'Documento expirado o adulterado',
  'Falta el reverso de la cédula',
  'Información incompleta',
];

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

export default function CrewKYCManagement() {
  const [status, setStatus] = useState('pending');
  const [workers, setWorkers] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null); // worker abierto en modal
  const [lightbox, setLightbox] = useState(null); // {src, label}
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await superadminApi.get('/crew/kyc', { params: { status } });
      setWorkers(data.workers || []);
      setCounts(data.counts || {});
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'Error al cargar la cola' });
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const decide = async (workerId, action) => {
    setBusy(true);
    try {
      const body = action === 'reject' ? { reason } : {};
      await superadminApi.post(`/crew/kyc/${workerId}/${action}`, body);
      setToast({ visible: true, type: 'success', message: action === 'approve' ? 'KYC aprobado' : 'KYC rechazado' });
      setTarget(null);
      setRejecting(null);
      setReason('');
      load();
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'No se pudo procesar' });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* Stats + tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
 status === t.key
 ? 'bg-white text-slate-900 shadow-sm'
 : 'text-slate-500 hover:text-slate-700'
 }`}
            >
              {t.label}
              {(counts[t.key] || 0) > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
 t.key === 'pending' ? 'bg-amber-100 text-amber-700'
 : t.key === 'approved' ? 'bg-emerald-100 text-emerald-700'
 : 'bg-rose-100 text-rose-700'
 }`}>{counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="text-xs font-medium text-slate-500 hover:text-slate-900 transition flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Actualizar
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
      ) : workers.length === 0 ? (
        <SAEmptyState
          title={status === 'pending' ? 'No hay KYCs en revisión' : status === 'approved' ? 'Aún no hay KYCs aprobados' : 'No hay rechazados'}
          description={status === 'pending' ? 'Cuando un trabajador suba su cédula, aparecerá acá.' : 'Cuando proceses solicitudes, las verás listadas aquí.'}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {workers.map((w) => (
            <button
              key={w._id}
              onClick={() => setTarget(w)}
              className="text-left p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition flex items-start gap-3"
            >
              {w.photo ? (
                <img src={w.photo} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-[14px] font-bold text-slate-700 shrink-0">
                  {(w.name || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{w.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{w.phone}{w.university ? ` · ${w.university}` : ''}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <StatusPill status={w.kyc?.status} />
                  <span className="text-[10px] text-slate-400">{formatRelative(w.kyc?.submittedAt)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <SAModal
        isOpen={!!target}
        onClose={() => { setTarget(null); setRejecting(null); setReason(''); }}
        title={target?.name || 'Detalle KYC'}
        subtitle={target?.phone}
        width="max-w-2xl"
      >
        {target && (
          <div className="space-y-4">
            {/* Info row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <DetailStat label="Estado">
                <StatusPill status={target.kyc?.status} />
              </DetailStat>
              <DetailStat label="Cédula" value={target.cedula || '—'} />
              <DetailStat label="Nivel" value={`Nivel ${target.level || 1}`} />
              <DetailStat label="Turnos" value={target.stats?.shiftsCompleted || 0} />
            </div>

            {/* Documents */}
            <div>
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Documentos cargados</h3>
              <div className="grid grid-cols-3 gap-2">
                <DocCard label="Cédula (frente)" src={target.kyc?.cedulaFrontUrl} onZoom={setLightbox} />
                <DocCard label="Cédula (reverso)" src={target.kyc?.cedulaBackUrl} onZoom={setLightbox} />
                <DocCard label="Selfie" src={target.kyc?.selfieUrl} onZoom={setLightbox} />
              </div>
            </div>

            {/* Submission meta */}
            <div className="text-xs text-slate-500 space-y-0.5">
              <p>Enviado: {target.kyc?.submittedAt ? new Date(target.kyc.submittedAt).toLocaleString('es-CO') : '—'}</p>
              {target.kyc?.reviewedAt && (
                <p>Revisado: {new Date(target.kyc.reviewedAt).toLocaleString('es-CO')}{target.kyc.reviewedBy?.email ? ` por ${target.kyc.reviewedBy.email}` : ''}</p>
              )}
              {target.kyc?.rejectionReason && (
                <p className="text-rose-600">Motivo del rechazo: {target.kyc.rejectionReason}</p>
              )}
            </div>

            {/* Reject reason form */}
            {rejecting === target._id && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-rose-700">Motivo del rechazo</p>
                <div className="flex flex-wrap gap-1.5">
                  {REJECT_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition ${
 reason === r
 ? 'bg-rose-600 text-white border-rose-600'
 : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
 }`}
                    >{r}</button>
                  ))}
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 300))}
                  placeholder="Detalles para que el trabajador entienda qué corregir…"
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
            )}

            {/* Actions */}
            {target.kyc?.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                {rejecting === target._id ? (
                  <>
                    <SAButton variant="ghost" onClick={() => { setRejecting(null); setReason(''); }} disabled={busy}>Cancelar</SAButton>
                    <div className="flex-1" />
                    <SAButton variant="danger" disabled={busy || !reason.trim()} onClick={() => decide(target._id, 'reject')}>
                      Confirmar rechazo
                    </SAButton>
                  </>
                ) : (
                  <>
                    <SAButton variant="danger" onClick={() => setRejecting(target._id)} disabled={busy}>Rechazar</SAButton>
                    <div className="flex-1" />
                    <SAButton variant="primary" disabled={busy} onClick={() => decide(target._id, 'approve')}>
                      Aprobar verificación
                    </SAButton>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </SAModal>

      {/* Lightbox */}
      {lightbox && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img src={lightbox.src} alt={lightbox.label} className="max-h-[92vh] max-w-full rounded-lg shadow-2xl" />
          <p className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-500 bg-black/40 px-3 py-1.5 rounded-full">{lightbox.label}</p>
        </motion.div>
      )}

      <SAToast
        type={toast.type}
        message={toast.message}
        isVisible={toast.visible}
        onClose={() => setToast({ ...toast, visible: false })}
      />
    </div>
  );
}

function StatusPill({ status }) {
  if (status === 'approved') return <SABadge variant="success">Aprobado</SABadge>;
  if (status === 'pending') return <SABadge variant="warning">En revisión</SABadge>;
  if (status === 'rejected') return <SABadge variant="danger">Rechazado</SABadge>;
  return <SABadge variant="neutral">Sin enviar</SABadge>;
}

function DetailStat({ label, value, children }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="text-sm font-semibold text-slate-900 mt-0.5">{children || value}</div>
    </div>
  );
}

function DocCard({ label, src, onZoom }) {
  if (!src) {
    return (
      <div className="aspect-[4/3] rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 text-center px-2">
        Sin {label.toLowerCase()}
      </div>
    );
  }
  return (
    <button
      onClick={() => onZoom({ src, label })}
      className="group relative aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
    >
      <img src={src} alt={label} className="absolute inset-0 w-full h-full object-cover transition group-hover:scale-[1.04]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-90" />
      <p className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate">{label}</p>
      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-700 rounded backdrop-blur-sm">
        Ampliar
      </span>
    </button>
  );
}

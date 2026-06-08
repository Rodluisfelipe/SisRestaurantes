/**
 * CrewPanel — panel del negocio para el marketplace Crew.
 *
 * Estética cosmic (consistente con la app del worker): fondo deep navy con
 * aurora, cards rounded-3xl, glow rojo/naranja en los CTAs.
 *
 * Estructura:
 *   - Hero: CrewWalletCard (saldo, recargar)
 *   - Stats row: contadores rápidos (turnos abiertos, postulantes, filled)
 *   - Tabs: Mis turnos · Publicar · Recargas
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';
import CrewWorkerProfileModal from './CrewWorkerProfileModal';
import BusinessCrewChatModal from './BusinessCrewChatModal';
import CrewWalletCard from './CrewWalletCard';
import CrewRechargeModal from './CrewRechargeModal';

function makeApi(businessId) {
  return {
    base: `${API_URL}/crew`,
    bizId: businessId,
    headers: () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    }),
    withBiz: (path) => `${path}${path.includes('?') ? '&' : '?'}businessId=${businessId}`,
    body: (obj = {}) => JSON.stringify({ ...obj, businessId }),
  };
}

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

const SKILLS = [
  { key: 'mesero', label: 'Mesero', emoji: '🍽️' },
  { key: 'cocinero', label: 'Cocinero', emoji: '👨‍🍳' },
  { key: 'barista', label: 'Barista', emoji: '☕' },
  { key: 'bartender', label: 'Bartender', emoji: '🍸' },
  { key: 'cajero', label: 'Cajero', emoji: '💳' },
  { key: 'runner', label: 'Auxiliar', emoji: '🏃' },
  { key: 'host', label: 'Anfitrión', emoji: '🤝' },
  { key: 'lavaplatos', label: 'Lavaplatos', emoji: '🧽' },
  { key: 'parrillero', label: 'Parrillero', emoji: '🔥' },
  { key: 'eventos', label: 'Eventos', emoji: '🎉' },
];

const PERKS = [
  { key: 'cena_incluida', label: 'Comida incluida', emoji: '🍔' },
  { key: 'transporte_final', label: 'Transporte al cierre', emoji: '🚕' },
  { key: 'propinas_garantizadas', label: 'Propinas garantizadas', emoji: '💵' },
  { key: 'flexibilidad_horario', label: 'Horario flexible', emoji: '⏰' },
  { key: 'ambiente_juvenil', label: 'Ambiente juvenil', emoji: '✨' },
  { key: 'pago_inmediato', label: 'Pago inmediato', emoji: '⚡' },
];

const TABS = [
  { id: 'mine', label: 'Mis turnos', icon: '📋' },
  { id: 'new', label: 'Publicar', icon: '✨' },
  { id: 'recharges', label: 'Recargas', icon: '💳' },
];

export default function CrewPanel({ businessId }) {
  const [view, setView] = useState('mine');
  const [shifts, setShifts] = useState([]);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [selectedShift, setSelectedShift] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const api = makeApi(businessId);

  const loadWallet = useCallback(async () => {
    if (!businessId) return;
    setLoadingWallet(true);
    try {
      const r = await fetch(api.withBiz(`${api.base}/businesses/wallet`), { headers: api.headers() });
      const data = await r.json();
      if (r.ok) setWallet(data.wallet);
    } catch (e) { console.error(e); }
    finally { setLoadingWallet(false); }
  }, [businessId]);

  const loadShifts = useCallback(async () => {
    if (!businessId) return;
    setLoadingShifts(true);
    try {
      const r = await fetch(api.withBiz(`${api.base}/businesses/shifts`), { headers: api.headers() });
      const data = await r.json();
      setShifts(data.shifts || []);
    } catch (e) { console.error(e); }
    finally { setLoadingShifts(false); }
  }, [businessId]);

  useEffect(() => { loadShifts(); loadWallet(); }, [loadShifts, loadWallet]);

  const stats = useMemo(() => ({
    total: shifts.length,
    open: shifts.filter(s => ['open', 'partially_filled'].includes(s.status)).length,
    filled: shifts.filter(s => s.status === 'filled').length,
    completed: shifts.filter(s => s.status === 'completed').length,
  }), [shifts]);

  if (!businessId) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-[#0a0a14] p-8 text-center">
        <p className="text-sm text-white/60">Cargando información del negocio…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100vh] -mx-4 sm:-mx-6 -my-4 sm:-my-6 px-4 sm:px-6 py-4 sm:py-6 font-geist text-white overflow-x-hidden" style={{ background: '#0a0a14' }}>
      {/* Aurora background fija */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -right-20 w-[500px] h-[500px] bg-red-500/15 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 -left-32 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[120px]"
        />
      </div>

      <div className="relative space-y-5 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40 mb-1">Marketplace de turnos</p>
            <h1 className="text-[28px] sm:text-[34px] font-black tracking-tight leading-none flex items-center gap-3">
              Crew
              <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 bg-amber-400/15 text-amber-300 border border-amber-400/30 rounded-full uppercase">
                Beta
              </span>
            </h1>
            <p className="text-[13px] text-white/50 mt-1.5 max-w-md">
              Publica turnos puntuales. Tu saldo Crew protege el pago hasta que el trabajador termine.
            </p>
          </div>

          {/* Mini-stats */}
          <div className="hidden sm:flex items-center gap-2">
            <MiniStat label="Abiertos" value={stats.open} tone="amber" />
            <MiniStat label="Cubiertos" value={stats.filled} tone="emerald" />
            <MiniStat label="Total" value={stats.total} tone="slate" />
          </div>
        </div>

        {/* Wallet hero */}
        <CrewWalletCard wallet={wallet} loading={loadingWallet} onRecharge={() => setRechargeOpen(true)} />

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl bg-black/40 border border-white/[0.06] w-fit">
          {TABS.map((t) => {
            const active = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setView(t.id); setSelectedShift(null); }}
                className={`relative px-4 py-2 rounded-xl text-[12px] font-extrabold uppercase tracking-wider transition-colors flex items-center gap-2 ${
                  active ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="crew-panel-tab"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 shadow-[0_4px_16px_-4px_rgba(239,68,68,0.5)]"
                  />
                )}
                <span className="relative text-base leading-none">{t.icon}</span>
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <AnimatePresence mode="wait">
          {view === 'mine' && !selectedShift && (
            <motion.div key="mine" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loadingShifts && (
                <div className="space-y-3 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-32 rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
                  ))}
                </div>
              )}
              {!loadingShifts && shifts.length === 0 && (
                <EmptyState
                  title="Aún no has publicado turnos"
                  body="Cuando publiques tu primer turno verás los postulantes acá. Tu saldo Crew te protege: solo pagas cuando confirmas que el turno se completó."
                  cta={{ label: 'Publicar mi primer turno', onClick: () => setView('new') }}
                />
              )}
              {!loadingShifts && shifts.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {shifts.map((s, i) => (
                    <ShiftCard key={s._id} shift={s} index={i} onClick={() => setSelectedShift(s)} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'mine' && selectedShift && (
            <motion.div key="applicants" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <ApplicantsView
                api={api}
                shift={selectedShift}
                onBack={() => { setSelectedShift(null); loadShifts(); loadWallet(); }}
              />
            </motion.div>
          )}

          {view === 'new' && (
            <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <NewShiftForm
                api={api}
                wallet={wallet}
                onCreated={() => { setView('mine'); loadShifts(); loadWallet(); }}
                onCancel={() => setView('mine')}
                onNeedRecharge={() => setRechargeOpen(true)}
              />
            </motion.div>
          )}

          {view === 'recharges' && (
            <motion.div key="recharges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RechargesHistory api={api} onRecharge={() => setRechargeOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CrewRechargeModal
        open={rechargeOpen}
        businessId={businessId}
        onClose={() => setRechargeOpen(false)}
        onSuccess={() => { setRechargeOpen(false); loadWallet(); }}
      />
    </div>
  );
}

/* ─────────── helpers ─────────── */

function MiniStat({ label, value, tone }) {
  const tones = {
    amber: 'from-amber-500/20 to-amber-500/[0.04] text-amber-200 border-amber-400/20',
    emerald: 'from-emerald-500/20 to-emerald-500/[0.04] text-emerald-200 border-emerald-400/20',
    slate: 'from-white/[0.08] to-white/[0.02] text-white/80 border-white/[0.08]',
  };
  return (
    <div className={`px-3 py-2 rounded-xl border bg-gradient-to-br ${tones[tone]}`}>
      <p className="text-[18px] font-black leading-none tabular-nums">{value}</p>
      <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-80 mt-0.5">{label}</p>
    </div>
  );
}

function EmptyState({ title, body, cta }) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-10 text-center backdrop-blur-sm">
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-red-500/30 to-orange-500/20 border border-red-400/20 flex items-center justify-center mb-3"
      >
        <svg className="w-7 h-7 text-red-300" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        </svg>
      </motion.div>
      <p className="text-[15px] font-black text-white">{title}</p>
      <p className="text-[12px] text-white/50 mt-1.5 max-w-sm mx-auto leading-relaxed">{body}</p>
      {cta && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={cta.onClick}
          className="mt-5 group relative overflow-hidden px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-extrabold text-[13px] shadow-lg shadow-red-500/40"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
          <span className="relative">{cta.label}</span>
        </motion.button>
      )}
    </div>
  );
}

function ShiftCard({ shift, index, onClick }) {
  const statusInfo = {
    open: { label: 'Abierto', color: 'from-sky-500/30 to-sky-500/10 text-sky-200 border-sky-400/30' },
    partially_filled: { label: 'Parcial', color: 'from-amber-500/30 to-amber-500/10 text-amber-200 border-amber-400/30' },
    filled: { label: 'Cubierto', color: 'from-emerald-500/30 to-emerald-500/10 text-emerald-200 border-emerald-400/30' },
    completed: { label: 'Finalizado', color: 'from-white/10 to-white/[0.04] text-white/60 border-white/[0.08]' },
    cancelled: { label: 'Cancelado', color: 'from-red-500/30 to-red-500/10 text-red-200 border-red-400/30' },
  };
  const s = statusInfo[shift.status] || statusInfo.open;
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="group relative overflow-hidden text-left rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 hover:border-white/[0.18] transition-all"
    >
      {/* Glow hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(120% 60% at 50% 0%, rgba(239,68,68,0.10), transparent 60%)' }} />

      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-black text-white truncate">{shift.title}</p>
            <p className="text-[10.5px] text-white/50 mt-0.5">
              {new Date(shift.date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
              {' · '}{shift.startTime}–{shift.endTime}
            </p>
          </div>
          <span className={`shrink-0 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider rounded-full border bg-gradient-to-r ${s.color}`}>
            {s.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <MiniBox label="Personas" value={`${shift.workersBooked}/${shift.workersNeeded}`} />
          <MiniBox label="Horas" value={`${shift.hoursTotal}h`} />
          <MiniBox label="Pago" value={formatCOP(shift.totalPay)} accent />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <span className="text-[10px] text-white/40">
            Reservado: <span className="text-white/70 font-bold tabular-nums">{formatCOP(shift.reservedAmount)}</span>
          </span>
          <span className="text-[10px] font-extrabold text-red-300 flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
            Ver postulantes
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function MiniBox({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
      <p className="text-[8px] font-extrabold uppercase tracking-wider text-white/30">{label}</p>
      <p className={`text-[11.5px] font-black tabular-nums truncate ${accent ? 'text-emerald-300' : 'text-white/90'}`}>{value}</p>
    </div>
  );
}

/* ─────────── applicants ─────────── */

function ApplicantsView({ api, shift, onBack }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openApp, setOpenApp] = useState(null);
  const [chatApp, setChatApp] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(api.withBiz(`${api.base}/businesses/shifts/${shift._id}/applicants`), { headers: api.headers() });
      const data = await r.json();
      setApps(data.applications || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [shift._id]);

  useEffect(() => { load(); }, [load]);

  const respond = async (appId, action) => {
    try {
      const r = await fetch(`${api.base}/businesses/applications/${appId}/${action}`, {
        method: 'POST', headers: api.headers(), body: api.body({}),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.message || 'No se pudo procesar'); return; }
      load();
    } catch { alert('No se pudo procesar'); }
  };

  const cancelShift = async () => {
    const reason = prompt('Motivo de la cancelación:');
    if (!reason?.trim()) return;
    setCancelling(true);
    try {
      const r = await fetch(`${api.base}/businesses/shifts/${shift._id}/cancel`, {
        method: 'POST', headers: api.headers(),
        body: api.body({ reason }),
      });
      const data = await r.json();
      if (!r.ok) { alert(data.message || 'Error al cancelar'); return; }
      alert(`Cancelado. Devolución: ${formatCOP(data.refund)} · Penalización: ${formatCOP(data.penalty)}`);
      onBack();
    } finally { setCancelling(false); }
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-5">
      <button onClick={onBack} className="mb-3 text-[12px] font-bold text-white/40 hover:text-white flex items-center gap-1 transition">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Volver
      </button>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 className="text-[18px] font-black text-white">{shift.title}</h2>
          <p className="text-[11.5px] text-white/50 mt-1">
            {apps.length} {apps.length === 1 ? 'postulante' : 'postulantes'} · Toca una tarjeta para ver el perfil
          </p>
        </div>
        {!['cancelled', 'completed'].includes(shift.status) && (
          <button
            onClick={cancelShift}
            disabled={cancelling}
            className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-400/30 transition disabled:opacity-50"
          >
            {cancelling ? 'Cancelando…' : 'Cancelar turno'}
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        {loading && <p className="text-[12px] text-white/40 text-center py-6">Cargando postulantes…</p>}
        {!loading && apps.length === 0 && (
          <p className="text-[12px] text-white/40 text-center py-6">Aún no hay postulantes. Agrega beneficios al turno para atraer más.</p>
        )}
        {apps.map((a) => (
          <ApplicantCard
            key={a._id}
            app={a}
            onOpenProfile={() => setOpenApp(a)}
            onAccept={() => respond(a._id, 'accept')}
            onReject={() => respond(a._id, 'reject')}
            onChat={() => setChatApp(a)}
          />
        ))}
      </div>

      {openApp && (
        <CrewWorkerProfileModal
          workerId={openApp.workerId?._id || openApp.workerId}
          businessId={api.bizId}
          matchScore={openApp.matchScore}
          canChat={openApp.status === 'accepted'}
          onClose={() => setOpenApp(null)}
          onChat={openApp.status === 'accepted' ? () => { setChatApp(openApp); setOpenApp(null); } : undefined}
          onAccept={openApp.status === 'pending' ? () => { respond(openApp._id, 'accept'); setOpenApp(null); } : undefined}
          onReject={openApp.status === 'pending' ? () => { respond(openApp._id, 'reject'); setOpenApp(null); } : undefined}
        />
      )}

      {chatApp && (
        <BusinessCrewChatModal
          workerId={chatApp.workerId?._id || chatApp.workerId}
          businessId={api.bizId}
          workerName={chatApp.workerId?.name}
          workerPhoto={chatApp.workerId?.photo}
          onClose={() => setChatApp(null)}
        />
      )}
    </div>
  );
}

function ApplicantCard({ app, onAccept, onReject, onOpenProfile, onChat }) {
  const w = app.workerId || {};
  const matchTone = app.matchScore >= 75 ? 'from-emerald-500/30 to-emerald-500/10 text-emerald-200 border-emerald-400/30'
    : app.matchScore >= 50 ? 'from-amber-500/30 to-amber-500/10 text-amber-200 border-amber-400/30'
    : 'from-white/10 to-white/[0.04] text-white/60 border-white/[0.08]';

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition overflow-hidden">
      <button onClick={onOpenProfile} className="w-full text-left p-3.5">
        <div className="flex items-start gap-3 mb-2">
          {w.photo ? (
            <img src={w.photo} alt={w.name} className="w-14 h-14 rounded-2xl object-cover border border-white/[0.10] shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/40 to-orange-500/30 border border-white/[0.10] flex items-center justify-center text-[18px] font-black text-white shrink-0">
              {(w.name || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[14px] font-black text-white truncate">{w.name || 'Postulante'}</p>
              {w.kyc?.status === 'approved' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 rounded-full">
                  ✓ Verificado
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10.5px] text-white/50 mt-0.5 flex-wrap">
              <span className="font-bold text-red-300">Nivel {w.level || 1}</span>
              <span>·</span>
              <span>{(w.rating?.avg || 0).toFixed(1)}★ ({w.rating?.count || 0})</span>
              <span>·</span>
              <span>{w.stats?.shiftsCompleted || 0} turnos</span>
            </div>
            {w.bio && (
              <p className="text-[11.5px] text-white/70 mt-1.5 line-clamp-2 leading-snug">{w.bio}</p>
            )}
          </div>
          <span className={`shrink-0 px-2 py-0.5 text-[10px] font-extrabold border rounded-full tabular-nums bg-gradient-to-r ${matchTone}`}>
            {app.matchScore}%
          </span>
        </div>

        {w.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {w.skills.slice(0, 4).map((s) => (
              <span key={s.key} className="px-2 py-0.5 text-[9.5px] font-bold bg-white/[0.04] text-white/60 border border-white/[0.06] rounded-full">
                {s.key} · {s.level}
              </span>
            ))}
          </div>
        )}
      </button>

      <div className="px-3.5 pb-3 pt-2 border-t border-white/[0.04]">
        {app.status === 'pending' ? (
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="flex-1 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-[12px] font-bold transition"
            >Rechazar</button>
            <button
              onClick={onAccept}
              className="group relative overflow-hidden flex-1 py-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-[12px] font-extrabold transition shadow-md shadow-red-500/30"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
              <span className="relative">Aceptar</span>
            </button>
          </div>
        ) : app.status === 'accepted' ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-[11px] font-extrabold text-center py-1.5 rounded-xl bg-emerald-500/[0.12] text-emerald-300 border border-emerald-400/30">
              Aceptado ✓
            </p>
            <button
              onClick={onChat}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-[11px] font-extrabold border border-white/[0.08]"
            >
              💬 Mensaje
            </button>
          </div>
        ) : (
          <p className="text-[11px] font-bold text-center py-1.5 rounded-xl bg-white/[0.02] text-white/40 border border-white/[0.06]">
            {app.status === 'rejected' ? 'Rechazado' : app.status}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────── publish form ─────────── */

function NewShiftForm({ api, wallet, onCreated, onCancel, onNeedRecharge }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    role: 'mesero',
    date: new Date().toISOString().split('T')[0],
    startTime: '18:00',
    endTime: '23:00',
    hoursTotal: 5,
    workersNeeded: 1,
    hourlyRate: 13000,
    perks: [],
    isSOS: false,
  });
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState(null);

  const togglePerk = (p) =>
    setForm((f) => ({ ...f, perks: f.perks.includes(p) ? f.perks.filter((x) => x !== p) : [...f.perks, p] }));

  // Quote en vivo
  useEffect(() => {
    const totalPay = (form.hoursTotal || 0) * (form.hourlyRate || 0);
    if (!totalPay) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${api.base}/businesses/wallet/quote-shift?businessId=${api.bizId}`, {
          method: 'POST', headers: api.headers(),
          body: api.body({ totalPay, workersNeeded: form.workersNeeded, isSOS: form.isSOS }),
        });
        const data = await r.json();
        if (r.ok) setQuote(data.quote);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [form.hoursTotal, form.hourlyRate, form.workersNeeded, form.isSOS]);

  const submit = async () => {
    if (!form.title.trim()) return alert('Ingresa un título descriptivo');
    setSaving(true);
    try {
      const r = await fetch(`${api.base}/businesses/shifts`, {
        method: 'POST', headers: api.headers(),
        body: api.body(form),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.code === 'INSUFFICIENT_FUNDS') {
          if (confirm(`${data.message}\n\n¿Quieres recargar ahora?`)) onNeedRecharge();
        } else {
          alert(data.message || 'No se pudo publicar');
        }
        setSaving(false);
        return;
      }
      onCreated?.();
    } catch { alert('Error de conexión'); }
    finally { setSaving(false); }
  };

  const available = wallet?.balance || 0;
  const needed = quote?.totalReserveNeeded || 0;
  const enough = available >= needed;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-5 space-y-5">
      {/* Title */}
      <div>
        <Label>Título del turno</Label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Ej: Mesero sábado en la noche"
          className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/[0.08] text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-red-500 transition"
        />
      </div>

      {/* Role chips */}
      <div>
        <Label>Cargo requerido</Label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {SKILLS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setForm({ ...form, role: s.key })}
              className={`relative overflow-hidden py-2 rounded-xl text-[11px] font-extrabold transition flex items-center justify-center gap-1.5 ${
                form.role === s.key
                  ? 'bg-gradient-to-r from-red-500/30 to-orange-500/20 text-red-200 border border-red-400/40'
                  : 'bg-white/[0.03] text-white/50 border border-white/[0.06] hover:border-white/[0.18]'
              }`}
            >
              <span>{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date / times */}
      <div className="grid grid-cols-3 gap-2">
        <Field label="Fecha">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-red-500" />
        </Field>
        <Field label="Inicio">
          <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-red-500" />
        </Field>
        <Field label="Fin">
          <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-red-500" />
        </Field>
      </div>

      {/* Pay */}
      <div className="grid grid-cols-3 gap-2">
        <Field label="Horas">
          <input type="number" min={1} max={16} value={form.hoursTotal} onChange={(e) => setForm({ ...form, hoursTotal: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-red-500 tabular-nums" />
        </Field>
        <Field label="Personas">
          <input type="number" min={1} max={20} value={form.workersNeeded} onChange={(e) => setForm({ ...form, workersNeeded: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-red-500 tabular-nums" />
        </Field>
        <Field label="Pago / hora">
          <input type="number" min={5000} step={500} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-red-500 tabular-nums" />
        </Field>
      </div>

      {/* Perks */}
      <div>
        <Label>Beneficios (opcional)</Label>
        <div className="flex flex-wrap gap-1.5">
          {PERKS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => togglePerk(p.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition flex items-center gap-1.5 ${
                form.perks.includes(p.key)
                  ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30'
                  : 'bg-white/[0.03] text-white/50 border border-white/[0.06] hover:border-white/[0.18]'
              }`}
            >
              <span>{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* SOS toggle */}
      <label className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/[0.06] border border-amber-400/20 cursor-pointer">
        <input type="checkbox" checked={form.isSOS} onChange={(e) => setForm({ ...form, isSOS: e.target.checked })} className="mt-1 w-4 h-4 accent-amber-500" />
        <div>
          <p className="text-[13px] font-extrabold text-amber-200">Marcar como urgente (SOS)</p>
          <p className="text-[11px] text-amber-100/60 mt-0.5 leading-relaxed">
            Aparece destacado y se notifica con prioridad. Comisión Crew sube al <strong className="text-amber-200">15%</strong>.
          </p>
        </div>
      </label>

      {/* Quote summary */}
      {quote && (
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] p-4"
          style={{ background: 'radial-gradient(140% 100% at 0% 0%, rgba(239,68,68,0.18) 0%, rgba(10,10,20,0.6) 60%)' }}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40 mb-2">Resumen de escrow</p>
          <div className="grid grid-cols-3 gap-2">
            <ResumeBox label="Pago / trabajador" value={formatCOP(quote.payoutPerWorker)} />
            <ResumeBox label={`Comisión Crew (${Math.round(quote.commissionRate * 100)}%)`} value={formatCOP(quote.commissionPerWorker)} />
            <ResumeBox label="Total / trabajador" value={formatCOP(quote.perWorkerTotal)} accent />
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[11px] text-white/50">Se reservarán de tu billetera</span>
            <span className="text-[20px] font-black tabular-nums text-emerald-300">{formatCOP(quote.totalReserveNeeded)}</span>
          </div>
          {!enough && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-400/30 flex items-center justify-between gap-2">
              <span className="text-[11px] text-red-200">
                Te faltan <strong className="tabular-nums">{formatCOP(needed - available)}</strong> para publicar.
              </span>
              <button onClick={onNeedRecharge} className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-red-500 hover:bg-red-400 text-white transition">
                Recargar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white/70 hover:text-white font-bold text-[13px] transition"
        >Cancelar</button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={saving || !enough}
          className="group relative flex-1 overflow-hidden py-3 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-extrabold text-[13px] shadow-lg shadow-red-500/40 disabled:opacity-40"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
          <span className="relative">{saving ? 'Publicando…' : enough ? 'Publicar y reservar saldo' : 'Saldo insuficiente'}</span>
        </motion.button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <label className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40 mb-2">{children}</label>;
}

function Field({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ResumeBox({ label, value, accent }) {
  return (
    <div className="px-2 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <p className="text-[9px] font-extrabold uppercase tracking-wider text-white/40">{label}</p>
      <p className={`text-[12.5px] font-black tabular-nums truncate mt-0.5 ${accent ? 'text-emerald-300' : 'text-white/90'}`}>{value}</p>
    </div>
  );
}

/* ─────────── recharges history ─────────── */

function RechargesHistory({ api, onRecharge }) {
  const [reqs, setReqs] = useState([]);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(api.withBiz(`${api.base}/businesses/wallet/recharge-requests`), { headers: api.headers() }),
          fetch(api.withBiz(`${api.base}/businesses/wallet/transactions`), { headers: api.headers() }),
        ]);
        const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
        setReqs(d1.requests || []);
        setTxns(d2.transactions || []);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-[15px] font-black">Mis solicitudes de recarga</h3>
          <button onClick={onRecharge} className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md shadow-red-500/30">
            + Nueva recarga
          </button>
        </div>
        {loading && <p className="text-[12px] text-white/40">Cargando…</p>}
        {!loading && reqs.length === 0 && (
          <p className="text-[12px] text-white/40 text-center py-6">Aún no tienes solicitudes de recarga.</p>
        )}
        <div className="space-y-2">
          {reqs.map((r) => (
            <div key={r._id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-3">
                <a href={r.proofUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] overflow-hidden block">
                  <img src={r.proofUrl} alt="" className="w-full h-full object-cover" />
                </a>
                <div>
                  <p className="text-[13px] font-extrabold text-white tabular-nums">{formatCOP(r.amount)}</p>
                  <p className="text-[10px] text-white/40">{r.paymentMethod} · {new Date(r.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
              <StatusChip status={r.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-5">
        <h3 className="text-[15px] font-black mb-3">Movimientos recientes</h3>
        {txns.length === 0 ? (
          <p className="text-[12px] text-white/40 text-center py-6">Aún no hay movimientos.</p>
        ) : (
          <div className="space-y-1">
            {txns.slice(0, 12).map((t) => (
              <TxnRow key={t._id} txn={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }) {
  const info = {
    pending: { label: 'En revisión', cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
    approved: { label: 'Aprobada', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    rejected: { label: 'Rechazada', cls: 'bg-red-500/15 text-red-300 border-red-400/30' },
  };
  const i = info[status] || info.pending;
  return <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${i.cls}`}>{i.label}</span>;
}

function TxnRow({ txn }) {
  const labels = {
    deposit: { label: 'Recarga', emoji: '💰', tone: 'text-emerald-300' },
    shift_reserve: { label: 'Reserva turno', emoji: '🔒', tone: 'text-amber-300' },
    shift_release: { label: 'Pago liberado', emoji: '✅', tone: 'text-emerald-300' },
    shift_commission: { label: 'Comisión Crew', emoji: '⚙️', tone: 'text-violet-300' },
    shift_refund: { label: 'Devolución', emoji: '↩️', tone: 'text-sky-300' },
    cancellation_penalty: { label: 'Penalización', emoji: '⚠️', tone: 'text-red-300' },
  };
  const info = labels[txn.kind] || { label: txn.kind, emoji: '•', tone: 'text-white/70' };
  const sign = txn.direction === 'in' ? '+' : '-';
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-white/[0.03] last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base">{info.emoji}</span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-white truncate">{info.label}</p>
          <p className="text-[10px] text-white/40 truncate">{txn.note || new Date(txn.createdAt).toLocaleDateString('es-CO')}</p>
        </div>
      </div>
      <span className={`text-[12.5px] font-black tabular-nums ${info.tone}`}>{sign}{formatCOP(txn.amount)}</span>
    </div>
  );
}

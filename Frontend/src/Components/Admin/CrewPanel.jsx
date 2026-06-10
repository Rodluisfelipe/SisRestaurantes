/**
 * CrewPanel — panel del negocio para el marketplace Crew.
 *
 * Estética CLARA consistente con el panel admin de MenuBy:
 * fondo blanco/slate-50, cards redondeadas con bordes sutiles,
 * acentos con el branding rojo de Crew.
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
import CrewCheckInCodeCard from './CrewCheckInCodeCard';
import VacancyManager from './VacancyManager';

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
  { id: 'vacancies', label: 'Vacantes', icon: '💼' },
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
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Cargando información del negocio…</p>
      </div>
    );
  }

  return (
    <div className="relative font-geist text-slate-800 overflow-x-hidden">
      <div className="space-y-5 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-1">Marketplace de turnos</p>
            <h1 className="text-[24px] sm:text-[28px] font-black tracking-tight leading-none flex items-center gap-3">
              Crew
              <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 bg-red-50 text-red-500 border border-red-200 rounded-full uppercase">
                Beta
              </span>
            </h1>
            <p className="text-[13px] text-slate-500 mt-1.5 max-w-md">
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
        <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200 w-fit">
          {TABS.map((t) => {
            const active = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setView(t.id); setSelectedShift(null); }}
                className={`relative px-4 py-2 rounded-xl text-[12px] font-extrabold uppercase tracking-wider transition-colors flex items-center gap-2 ${
                  active ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="crew-panel-tab"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-red-500 shadow-md shadow-red-500/25"
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
                    <div key={i} className="h-32 rounded-2xl border border-slate-200 bg-slate-50" />
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

          {view === 'vacancies' && (
            <motion.div key="vacancies" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <VacancyManager
                apiBase={`${api.base}/businesses`}
                authHeaders={api.headers}
                bizQueryParam={`businessId=${businessId}`}
                onBalanceChange={loadWallet}
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
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };
  return (
    <div className={`px-3 py-2 rounded-xl border ${tones[tone]}`}>
      <p className="text-[18px] font-black leading-none tabular-nums">{value}</p>
      <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

function EmptyState({ title, body, cta }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-14 h-14 mx-auto rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-3"
      >
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        </svg>
      </motion.div>
      <p className="text-[15px] font-black text-slate-800">{title}</p>
      <p className="text-[12px] text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">{body}</p>
      {cta && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={cta.onClick}
          className="mt-5 px-6 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-[13px] shadow-md shadow-red-500/25 transition"
        >
          {cta.label}
        </motion.button>
      )}
    </div>
  );
}

function ShiftCard({ shift, index, onClick }) {
  const statusInfo = {
    open: { label: 'Abierto', color: 'bg-sky-50 text-sky-700 border-sky-200' },
    partially_filled: { label: 'Parcial', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    filled: { label: 'Cubierto', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    completed: { label: 'Finalizado', color: 'bg-slate-50 text-slate-600 border-slate-200' },
    cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-600 border-red-200' },
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
      className="group text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-black text-slate-800 truncate">{shift.title}</p>
          <p className="text-[10.5px] text-slate-500 mt-0.5">
            {new Date(shift.date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
            {' · '}{shift.startTime}–{shift.endTime}
          </p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider rounded-full border ${s.color}`}>
          {s.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <MiniBox label="Personas" value={`${shift.workersBooked}/${shift.workersNeeded}`} />
        <MiniBox label="Horas" value={`${shift.hoursTotal}h`} />
        <MiniBox label="Pago" value={formatCOP(shift.totalPay)} accent />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-[10px] text-slate-400">
          Reservado: <span className="text-slate-600 font-bold tabular-nums">{formatCOP(shift.reservedAmount)}</span>
        </span>
        <span className="text-[10px] font-extrabold text-red-500 flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
          Ver postulantes
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </span>
      </div>
    </motion.button>
  );
}

function MiniBox({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-1.5">
      <p className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-[11.5px] font-black tabular-nums truncate ${accent ? 'text-emerald-600' : 'text-slate-700'}`}>{value}</p>
    </div>
  );
}

/* ─────────── applicants ─────────── */

function ApplicantsView({ api, shift, onBack }) {
  const [apps, setApps] = useState([]);
  const [bookings, setBookings] = useState([]); // bookings ya creados (con checkInCode)
  const [loading, setLoading] = useState(true);
  const [openApp, setOpenApp] = useState(null);
  const [chatApp, setChatApp] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(api.withBiz(`${api.base}/businesses/shifts/${shift._id}/applicants`), { headers: api.headers() }),
        fetch(api.withBiz(`${api.base}/businesses/shifts/${shift._id}/bookings`), { headers: api.headers() }),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      setApps(d1.applications || []);
      setBookings(d2.bookings || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [shift._id]);

  // Mapa workerId → booking, para hidratar los applicants aceptados con su código de check-in
  const bookingByWorker = bookings.reduce((acc, b) => {
    acc[String(b.workerId?._id || b.workerId)] = b;
    return acc;
  }, {});

  const replaceBookingCode = (bookingId, newCode) => {
    setBookings((prev) => prev.map((b) => (String(b._id) === String(bookingId) ? { ...b, checkInCode: newCode, checkInAttempts: 0 } : b)));
  };

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
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <button onClick={onBack} className="mb-3 text-[12px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 transition">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Volver
      </button>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 className="text-[18px] font-black text-slate-800">{shift.title}</h2>
          <p className="text-[11.5px] text-slate-500 mt-1">
            {apps.length} {apps.length === 1 ? 'postulante' : 'postulantes'} · Toca una tarjeta para ver el perfil
          </p>
        </div>
        {!['cancelled', 'completed'].includes(shift.status) && (
          <button
            onClick={cancelShift}
            disabled={cancelling}
            className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition disabled:opacity-50"
          >
            {cancelling ? 'Cancelando…' : 'Cancelar turno'}
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        {loading && <p className="text-[12px] text-slate-400 text-center py-6">Cargando postulantes…</p>}
        {!loading && apps.length === 0 && (
          <p className="text-[12px] text-slate-400 text-center py-6">Aún no hay postulantes. Agrega beneficios al turno para atraer más.</p>
        )}
        {apps.map((a) => {
          const wId = String(a.workerId?._id || a.workerId);
          const booking = bookingByWorker[wId];
          return (
            <ApplicantCard
              key={a._id}
              app={a}
              booking={booking}
              businessId={api.bizId}
              onOpenProfile={() => setOpenApp(a)}
              onAccept={() => respond(a._id, 'accept')}
              onReject={() => respond(a._id, 'reject')}
              onChat={() => setChatApp(a)}
              onCodeRegenerated={(newCode) => replaceBookingCode(booking?._id, newCode)}
            />
          );
        })}
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

function ApplicantCard({ app, booking, businessId, onAccept, onReject, onOpenProfile, onChat, onCodeRegenerated }) {
  const w = app.workerId || {};
  const matchTone = app.matchScore >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : app.matchScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition overflow-hidden">
      <button onClick={onOpenProfile} className="w-full text-left p-3.5">
        <div className="flex items-start gap-3 mb-2">
          {w.photo ? (
            <img src={w.photo} alt={w.name} className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-[18px] font-black text-red-500 shrink-0">
              {(w.name || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[14px] font-black text-slate-800 truncate">{w.name || 'Postulante'}</p>
              {w.kyc?.status === 'approved' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full">
                  ✓ Verificado
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-0.5 flex-wrap">
              <span className="font-bold text-red-500">Nivel {w.level || 1}</span>
              <span>·</span>
              <span>{(w.rating?.avg || 0).toFixed(1)}★ ({w.rating?.count || 0})</span>
              <span>·</span>
              <span>{w.stats?.shiftsCompleted || 0} turnos</span>
            </div>
            {w.bio && (
              <p className="text-[11.5px] text-slate-600 mt-1.5 line-clamp-2 leading-snug">{w.bio}</p>
            )}
          </div>
          <span className={`shrink-0 px-2 py-0.5 text-[10px] font-extrabold border rounded-full tabular-nums ${matchTone}`}>
            {app.matchScore}%
          </span>
        </div>

        {w.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {w.skills.slice(0, 4).map((s) => (
              <span key={s.key} className="px-2 py-0.5 text-[9.5px] font-bold bg-slate-50 text-slate-600 border border-slate-200 rounded-full">
                {s.key} · {s.level}
              </span>
            ))}
          </div>
        )}
      </button>

      <div className="px-3.5 pb-3 pt-2 border-t border-slate-100">
        {app.status === 'pending' ? (
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="flex-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-[12px] font-bold border border-slate-200 transition"
            >Rechazar</button>
            <button
              onClick={onAccept}
              className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[12px] font-extrabold transition shadow-md shadow-red-500/25"
            >
              Aceptar
            </button>
          </div>
        ) : app.status === 'accepted' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="flex-1 text-[11px] font-extrabold text-center py-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                Aceptado ✓
              </p>
              <button
                onClick={onChat}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-extrabold border border-slate-200"
              >
                💬 Mensaje
              </button>
            </div>
            {/* Código que el negocio le muestra al worker al llegar al sitio */}
            {booking?.checkInCode && booking.status === 'confirmed' && (
              <CrewCheckInCodeCard
                bookingId={booking._id}
                businessId={businessId}
                code={booking.checkInCode}
                onRegenerated={onCodeRegenerated}
              />
            )}
            {booking?.status === 'checked_in' && (
              <p className="text-[11px] text-center py-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 font-extrabold">
                🟢 Check-in registrado — {new Date(booking.checkInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] font-bold text-center py-1.5 rounded-xl bg-slate-50 text-slate-400 border border-slate-200">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
      {/* Title */}
      <div>
        <Label>Título del turno</Label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Ej: Mesero sábado en la noche"
          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition"
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
              className={`py-2 rounded-xl text-[11px] font-extrabold transition flex items-center justify-center gap-1.5 ${
                form.role === s.key
                  ? 'bg-red-50 text-red-600 border border-red-300'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
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
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
        </Field>
        <Field label="Inicio">
          <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
        </Field>
        <Field label="Fin">
          <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
        </Field>
      </div>

      {/* Pay */}
      <div className="grid grid-cols-3 gap-2">
        <Field label="Horas">
          <input type="number" min={1} max={16} value={form.hoursTotal} onChange={(e) => setForm({ ...form, hoursTotal: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 tabular-nums" />
        </Field>
        <Field label="Personas">
          <input type="number" min={1} max={20} value={form.workersNeeded} onChange={(e) => setForm({ ...form, workersNeeded: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 tabular-nums" />
        </Field>
        <Field label="Pago / hora">
          <input type="number" min={5000} step={500} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 tabular-nums" />
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
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                  : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <span>{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* SOS toggle */}
      <label className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 cursor-pointer">
        <input type="checkbox" checked={form.isSOS} onChange={(e) => setForm({ ...form, isSOS: e.target.checked })} className="mt-1 w-4 h-4 accent-amber-500" />
        <div>
          <p className="text-[13px] font-extrabold text-amber-800">Marcar como urgente (SOS)</p>
          <p className="text-[11px] text-amber-700/70 mt-0.5 leading-relaxed">
            Aparece destacado y se notifica con prioridad. Comisión Crew sube al <strong className="text-amber-800">15%</strong>.
          </p>
        </div>
      </label>

      {/* Quote summary */}
      {quote && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-2">Resumen de escrow</p>
          <div className="grid grid-cols-3 gap-2">
            <ResumeBox label="Pago / trabajador" value={formatCOP(quote.payoutPerWorker)} />
            <ResumeBox label={`Comisión Crew (${Math.round(quote.commissionRate * 100)}%)`} value={formatCOP(quote.commissionPerWorker)} />
            <ResumeBox label="Total / trabajador" value={formatCOP(quote.perWorkerTotal)} accent />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Se reservarán de tu billetera</span>
            <span className="text-[20px] font-black tabular-nums text-emerald-600">{formatCOP(quote.totalReserveNeeded)}</span>
          </div>
          {!enough && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2">
              <span className="text-[11px] text-red-700">
                Te faltan <strong className="tabular-nums">{formatCOP(needed - available)}</strong> para publicar.
              </span>
              <button onClick={onNeedRecharge} className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition">
                Recargar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 font-bold text-[13px] transition"
        >Cancelar</button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={saving || !enough}
          className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-[13px] shadow-md shadow-red-500/25 disabled:opacity-40 transition"
        >
          {saving ? 'Publicando…' : enough ? 'Publicar y reservar saldo' : 'Saldo insuficiente'}
        </motion.button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <label className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-2">{children}</label>;
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
    <div className="px-2 py-2 rounded-xl bg-white border border-slate-200">
      <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-[12.5px] font-black tabular-nums truncate mt-0.5 ${accent ? 'text-emerald-600' : 'text-slate-700'}`}>{value}</p>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-[15px] font-black text-slate-800">Mis solicitudes de recarga</h3>
          <button onClick={onRecharge} className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/25 transition">
            + Nueva recarga
          </button>
        </div>
        {loading && <p className="text-[12px] text-slate-400">Cargando…</p>}
        {!loading && reqs.length === 0 && (
          <p className="text-[12px] text-slate-400 text-center py-6">Aún no tienes solicitudes de recarga.</p>
        )}
        <div className="space-y-2">
          {reqs.map((r) => (
            <div key={r._id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <a href={r.proofUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden block">
                  <img src={r.proofUrl} alt="" className="w-full h-full object-cover" />
                </a>
                <div>
                  <p className="text-[13px] font-extrabold text-slate-800 tabular-nums">{formatCOP(r.amount)}</p>
                  <p className="text-[10px] text-slate-500">{r.paymentMethod} · {new Date(r.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
              <StatusChip status={r.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-[15px] font-black text-slate-800 mb-3">Movimientos recientes</h3>
        {txns.length === 0 ? (
          <p className="text-[12px] text-slate-400 text-center py-6">Aún no hay movimientos.</p>
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
    pending: { label: 'En revisión', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { label: 'Aprobada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rechazada', cls: 'bg-red-50 text-red-700 border-red-200' },
  };
  const i = info[status] || info.pending;
  return <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${i.cls}`}>{i.label}</span>;
}

function TxnRow({ txn }) {
  const labels = {
    deposit: { label: 'Recarga', emoji: '💰', tone: 'text-emerald-600' },
    shift_reserve: { label: 'Reserva turno', emoji: '🔒', tone: 'text-amber-600' },
    shift_release: { label: 'Pago liberado', emoji: '✅', tone: 'text-emerald-600' },
    shift_commission: { label: 'Comisión Crew', emoji: '⚙️', tone: 'text-violet-600' },
    shift_refund: { label: 'Devolución', emoji: '↩️', tone: 'text-sky-600' },
    cancellation_penalty: { label: 'Penalización', emoji: '⚠️', tone: 'text-red-600' },
  };
  const info = labels[txn.kind] || { label: txn.kind, emoji: '•', tone: 'text-slate-600' };
  const sign = txn.direction === 'in' ? '+' : '-';
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base">{info.emoji}</span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-slate-700 truncate">{info.label}</p>
          <p className="text-[10px] text-slate-400 truncate">{txn.note || new Date(txn.createdAt).toLocaleDateString('es-CO')}</p>
        </div>
      </div>
      <span className={`text-[12.5px] font-black tabular-nums ${info.tone}`}>{sign}{formatCOP(txn.amount)}</span>
    </div>
  );
}

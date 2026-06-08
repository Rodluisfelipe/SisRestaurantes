/**
 * CrewEmployerDashboard — panel principal para empleadores ya aprobados.
 *
 * Estructura idéntica al CrewPanel del business pero hablando con los
 * endpoints `/api/crew/employers/*` y autenticando con el token del empleador.
 *
 * Tabs:
 *   - Mis turnos (mine)
 *   - Publicar (new)
 *   - Recargas (recharges)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewEmployerApi from '../../services/crewEmployerApi';
import { useCrewEmployer } from './useCrewEmployer';
import EmployerWalletHero from './EmployerWalletHero';
import EmployerRechargeModal from './EmployerRechargeModal';

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
  { key: 'limpieza', label: 'Limpieza', emoji: '🧼' },
  { key: 'delivery', label: 'Domicilio', emoji: '🛵' },
];

const PERKS = [
  { key: 'cena_incluida', label: 'Comida incluida', emoji: '🍔' },
  { key: 'transporte_final', label: 'Transporte', emoji: '🚕' },
  { key: 'propinas_garantizadas', label: 'Propinas', emoji: '💵' },
  { key: 'flexibilidad_horario', label: 'Horario flexible', emoji: '⏰' },
  { key: 'pago_inmediato', label: 'Pago inmediato', emoji: '⚡' },
];

const TABS = [
  { id: 'mine', label: 'Mis turnos', emoji: '📋' },
  { id: 'new', label: 'Publicar', emoji: '✨' },
  { id: 'recharges', label: 'Recargas', emoji: '💳' },
];

export default function CrewEmployerDashboard() {
  const { employer, refreshMe, logout } = useCrewEmployer();
  const [view, setView] = useState('mine');
  const [shifts, setShifts] = useState([]);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [wallet, setWallet] = useState(employer?.crewWallet || null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);

  const loadWallet = useCallback(async () => {
    setLoadingWallet(true);
    try {
      const { data } = await crewEmployerApi.get('/employers/wallet');
      setWallet(data.wallet);
    } catch (e) { console.error(e); }
    finally { setLoadingWallet(false); }
  }, []);

  const loadShifts = useCallback(async () => {
    setLoadingShifts(true);
    try {
      const { data } = await crewEmployerApi.get('/employers/shifts');
      setShifts(data.shifts || []);
    } catch (e) { console.error(e); }
    finally { setLoadingShifts(false); }
  }, []);

  useEffect(() => { loadWallet(); loadShifts(); refreshMe().catch(() => {}); }, []);

  const stats = useMemo(() => ({
    total: shifts.length,
    open: shifts.filter(s => ['open', 'partially_filled'].includes(s.status)).length,
    filled: shifts.filter(s => s.status === 'filled').length,
    completed: shifts.filter(s => s.status === 'completed').length,
  }), [shifts]);

  return (
    <div className="relative min-h-[100dvh] bg-slate-50 text-slate-800 font-geist overflow-x-hidden">
      <header className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {employer?.photo ? (
            <img src={employer.photo} alt="" className="w-10 h-10 rounded-2xl object-cover border border-slate-200" />
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-red-500 flex items-center justify-center font-black text-white shadow-md shadow-red-500/25">
              {(employer?.name || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
              {employer?.kind === 'individual' ? 'Persona' : 'Negocio'}
            </p>
            <p className="text-[13px] font-black text-slate-800 truncate">{employer?.name}</p>
          </div>
        </div>
        <button onClick={logout} className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition">
          Salir
        </button>
      </header>

      <main className="max-w-md mx-auto px-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] space-y-4">
        <EmployerWalletHero wallet={wallet} loading={loadingWallet} onRecharge={() => setRechargeOpen(true)} />

        {/* Mini-stats */}
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Abiertos" value={stats.open} tone="amber" />
          <MiniStat label="Cubiertos" value={stats.filled} tone="emerald" />
          <MiniStat label="Total" value={stats.total} tone="slate" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200">
          {TABS.map((t) => {
            const active = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setView(t.id); setSelectedShift(null); }}
                className={`relative flex-1 px-3 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                  active ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="emp-tab"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-red-500 shadow-md shadow-red-500/25"
                  />
                )}
                <span className="relative text-sm leading-none">{t.emoji}</span>
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {view === 'mine' && !selectedShift && (
            <motion.div key="mine" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loadingShifts && (
                <div className="space-y-2.5 animate-pulse">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl border border-slate-200 bg-white" />)}
                </div>
              )}
              {!loadingShifts && shifts.length === 0 && (
                <EmptyState
                  title="Aún no has publicado turnos"
                  body="Cuando publiques tu primer turno verás los postulantes acá. Tu saldo Crew protege el pago."
                  cta={{ label: 'Publicar mi primer turno', onClick: () => setView('new') }}
                />
              )}
              {!loadingShifts && shifts.length > 0 && (
                <div className="space-y-2.5">
                  {shifts.map((s, i) => (
                    <ShiftCard key={s._id} shift={s} index={i} onClick={() => setSelectedShift(s)} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'mine' && selectedShift && (
            <motion.div key="appls" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <ApplicantsView
                shift={selectedShift}
                onBack={() => { setSelectedShift(null); loadShifts(); loadWallet(); }}
              />
            </motion.div>
          )}

          {view === 'new' && (
            <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <NewShiftForm
                wallet={wallet}
                employerKind={employer?.kind}
                onCreated={() => { setView('mine'); loadShifts(); loadWallet(); }}
                onCancel={() => setView('mine')}
                onNeedRecharge={() => setRechargeOpen(true)}
              />
            </motion.div>
          )}

          {view === 'recharges' && (
            <motion.div key="recharges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RechargesHistory onRecharge={() => setRechargeOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <EmployerRechargeModal
        open={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        onSuccess={() => { setRechargeOpen(false); loadWallet(); }}
      />
    </div>
  );
}

/* ──────── helpers ──────── */

function MiniStat({ label, value, tone }) {
  const tones = {
    amber: 'border-amber-200 text-amber-700 bg-amber-50',
    emerald: 'border-emerald-200 text-emerald-700 bg-emerald-50',
    slate: 'border-slate-200 text-slate-700 bg-white',
  };
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
      <p className="text-[20px] font-black leading-none tabular-nums">{value}</p>
      <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-75 mt-1">{label}</p>
    </div>
  );
}

function EmptyState({ title, body, cta }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-14 h-14 mx-auto rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-3 text-2xl"
      >
        ✨
      </motion.div>
      <p className="text-[15px] font-black text-slate-800">{title}</p>
      <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed max-w-sm mx-auto">{body}</p>
      {cta && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={cta.onClick}
          className="mt-5 px-6 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-[13px] shadow-md shadow-red-500/25 transition">
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
    completed: { label: 'Finalizado', color: 'bg-slate-100 text-slate-500 border-slate-200' },
    cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-600 border-red-200' },
  };
  const s = statusInfo[shift.status] || statusInfo.open;
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-slate-200 bg-white p-3.5 hover:border-slate-300 transition"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-slate-800 truncate">{shift.title}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {new Date(shift.date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
            {' · '}{shift.startTime}–{shift.endTime}
          </p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-full border ${s.color}`}>
          {s.label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <MiniBox label="Personas" value={`${shift.workersBooked}/${shift.workersNeeded}`} />
        <MiniBox label="Horas" value={`${shift.hoursTotal}h`} />
        <MiniBox label="Pago" value={formatCOP(shift.totalPay)} accent />
      </div>
    </motion.button>
  );
}

function MiniBox({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
      <p className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-[11px] font-black tabular-nums truncate ${accent ? 'text-emerald-600' : 'text-slate-700'}`}>{value}</p>
    </div>
  );
}

/* ──────── Applicants ──────── */

function ApplicantsView({ shift, onBack }) {
  const [apps, setApps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        crewEmployerApi.get(`/employers/shifts/${shift._id}/applicants`),
        crewEmployerApi.get(`/employers/shifts/${shift._id}/bookings`),
      ]);
      setApps(a.data.applications || []);
      setBookings(b.data.bookings || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [shift._id]);

  useEffect(() => { load(); }, [load]);

  const respond = async (appId, action) => {
    try {
      await crewEmployerApi.post(`/employers/applications/${appId}/${action}`);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || 'No se pudo procesar');
    }
  };

  const complete = async (bookingId) => {
    try {
      await crewEmployerApi.post(`/employers/bookings/${bookingId}/complete`);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || 'No se pudo completar');
    }
  };

  const cancelShift = async () => {
    const reason = prompt('Motivo de la cancelación:');
    if (!reason?.trim()) return;
    try {
      const { data } = await crewEmployerApi.post(`/employers/shifts/${shift._id}/cancel`, { reason });
      alert(`Cancelado. Devolución: ${formatCOP(data.refund)} · Penalización: ${formatCOP(data.penalty)}`);
      onBack();
    } catch (e) {
      alert(e?.response?.data?.message || 'No se pudo cancelar');
    }
  };

  const bookingByWorker = bookings.reduce((acc, b) => {
    acc[String(b.workerId?._id || b.workerId)] = b;
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <button onClick={onBack} className="mb-3 text-[11.5px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 transition">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="text-[16px] font-black text-slate-800">{shift.title}</h2>
          <p className="text-[11px] text-slate-500">{apps.length} {apps.length === 1 ? 'postulante' : 'postulantes'}</p>
        </div>
        {!['cancelled', 'completed'].includes(shift.status) && (
          <button onClick={cancelShift}
            className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition">
            Cancelar turno
          </button>
        )}
      </div>

      <div className="space-y-2">
        {loading && <p className="text-[12px] text-slate-400 text-center py-6">Cargando…</p>}
        {!loading && apps.length === 0 && (
          <p className="text-[12px] text-slate-400 text-center py-6">Aún no hay postulantes. Tu turno ya es visible, pacientes 🙏.</p>
        )}
        {apps.map((a) => {
          const wId = String(a.workerId?._id || a.workerId);
          const booking = bookingByWorker[wId];
          return (
            <ApplicantCard
              key={a._id}
              app={a}
              booking={booking}
              onAccept={() => respond(a._id, 'accept')}
              onReject={() => respond(a._id, 'reject')}
              onComplete={booking ? () => complete(booking._id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function ApplicantCard({ app, booking, onAccept, onReject, onComplete }) {
  const w = app.workerId || {};
  const matchTone = app.matchScore >= 75
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : app.matchScore >= 50
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-50 text-slate-500 border-slate-200';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-3 mb-2">
        {w.photo ? (
          <img src={w.photo} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-[16px] font-black text-red-600 shrink-0">
            {(w.name || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-slate-800 truncate">{w.name}</p>
          <p className="text-[10.5px] text-slate-500">Nivel {w.level || 1} · {(w.rating?.avg || 0).toFixed(1)}★ · {w.stats?.shiftsCompleted || 0} turnos</p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-extrabold border rounded-full ${matchTone}`}>
          {app.matchScore}%
        </span>
      </div>

      {booking?.checkInCode && booking.status === 'confirmed' && (
        <div className="px-3 py-2 mb-2 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700">Código de llegada</p>
          <p className="text-[18px] font-black text-slate-800 tabular-nums tracking-widest">{booking.checkInCode}</p>
          <p className="text-[10px] text-amber-600/70 mt-0.5">Muéstraselo cuando llegue al sitio.</p>
        </div>
      )}

      {booking?.status === 'checked_in' && (
        <p className="text-[11px] text-center py-1.5 mb-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 font-extrabold">
          🟢 Check-in registrado
        </p>
      )}

      <div className="flex gap-2">
        {app.status === 'pending' ? (
          <>
            <button onClick={onReject} className="flex-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-[12px] font-bold border border-slate-200 transition">
              Rechazar
            </button>
            <button onClick={onAccept} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[12px] font-extrabold transition shadow-md shadow-red-500/25">
              Aceptar
            </button>
          </>
        ) : app.status === 'accepted' && booking?.status === 'checked_in' ? (
          <button onClick={onComplete}
            className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-extrabold shadow-md shadow-emerald-500/25 transition">
            Marcar terminado y pagar
          </button>
        ) : app.status === 'accepted' ? (
          <p className="flex-1 text-[11px] font-extrabold text-center py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            Aceptado ✓
          </p>
        ) : (
          <p className="flex-1 text-[11px] font-bold text-center py-1.5 rounded-xl bg-slate-50 text-slate-400 border border-slate-200">
            {app.status === 'rejected' ? 'Rechazado' : app.status === 'expired' ? 'Expiró (turno ya lleno)' : app.status}
          </p>
        )}
      </div>
    </div>
  );
}

/* ──────── Publish form ──────── */

function NewShiftForm({ wallet, employerKind, onCreated, onCancel, onNeedRecharge }) {
  const [form, setForm] = useState({
    title: employerKind === 'individual' ? 'Necesito ayuda para mi evento' : '',
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

  useEffect(() => {
    const totalPay = (form.hoursTotal || 0) * (form.hourlyRate || 0);
    if (!totalPay) return;
    const t = setTimeout(async () => {
      try {
        const { data } = await crewEmployerApi.post('/employers/wallet/quote-shift', {
          totalPay, workersNeeded: form.workersNeeded, isSOS: form.isSOS,
        });
        setQuote(data.quote);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [form.hoursTotal, form.hourlyRate, form.workersNeeded, form.isSOS]);

  const submit = async () => {
    if (!form.title.trim()) return alert('Pon un título descriptivo');
    setSaving(true);
    try {
      await crewEmployerApi.post('/employers/shifts', form);
      onCreated?.();
    } catch (e) {
      const code = e?.response?.data?.code;
      if (code === 'INSUFFICIENT_FUNDS') {
        if (confirm(`${e.response.data.message}\n\n¿Quieres recargar ahora?`)) onNeedRecharge();
      } else {
        alert(e?.response?.data?.message || 'No se pudo publicar');
      }
    } finally { setSaving(false); }
  };

  const available = wallet?.balance || 0;
  const needed = quote?.totalReserveNeeded || 0;
  const enough = available >= needed;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <Label>Título del turno</Label>
      <input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Ej: Meseros para mi boda en Chía"
        className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-[13.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition"
      />

      <div>
        <Label>Rol requerido</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {SKILLS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setForm({ ...form, role: s.key })}
              className={`py-2 rounded-xl text-[10.5px] font-extrabold transition flex items-center justify-center gap-1 ${
                form.role === s.key
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <span>{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Fecha">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[12px] text-slate-800 focus:outline-none focus:border-red-400" />
        </Field>
        <Field label="Inicio">
          <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[12px] text-slate-800 focus:outline-none focus:border-red-400" />
        </Field>
        <Field label="Fin">
          <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[12px] text-slate-800 focus:outline-none focus:border-red-400" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Horas">
          <input type="number" min={1} max={16} value={form.hoursTotal} onChange={(e) => setForm({ ...form, hoursTotal: Number(e.target.value) })}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[12px] text-slate-800 tabular-nums focus:outline-none focus:border-red-400" />
        </Field>
        <Field label="Personas">
          <input type="number" min={1} max={20} value={form.workersNeeded} onChange={(e) => setForm({ ...form, workersNeeded: Number(e.target.value) })}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[12px] text-slate-800 tabular-nums focus:outline-none focus:border-red-400" />
        </Field>
        <Field label="Pago / hora">
          <input type="number" min={5000} step={500} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[12px] text-slate-800 tabular-nums focus:outline-none focus:border-red-400" />
        </Field>
      </div>

      <div>
        <Label>Beneficios (opcional)</Label>
        <div className="flex flex-wrap gap-1.5">
          {PERKS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => togglePerk(p.key)}
              className={`px-3 py-1.5 rounded-full text-[10.5px] font-bold transition flex items-center gap-1 ${
                form.perks.includes(p.key)
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <span>{p.emoji}</span>{p.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 cursor-pointer">
        <input type="checkbox" checked={form.isSOS} onChange={(e) => setForm({ ...form, isSOS: e.target.checked })} className="mt-1 w-4 h-4 accent-amber-500" />
        <div>
          <p className="text-[12px] font-extrabold text-amber-800">Marcar como urgente (SOS)</p>
          <p className="text-[10.5px] text-amber-700/70 mt-0.5 leading-snug">
            Aparece destacado y se notifica con prioridad. Comisión sube a <strong>15%</strong>.
          </p>
        </div>
      </label>

      {quote && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-2">Reserva de tu wallet</p>
          <div className="grid grid-cols-3 gap-2">
            <ResumeBox label="Pago / trabajador" value={formatCOP(quote.payoutPerWorker)} />
            <ResumeBox label={`Comisión Crew (${Math.round(quote.commissionRate * 100)}%)`} value={formatCOP(quote.commissionPerWorker)} />
            <ResumeBox label="Total / trabajador" value={formatCOP(quote.perWorkerTotal)} accent />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Se reservarán</span>
            <span className="text-[18px] font-black tabular-nums text-emerald-600">{formatCOP(quote.totalReserveNeeded)}</span>
          </div>
          {!enough && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2">
              <span className="text-[11px] text-red-700">
                Faltan <strong className="tabular-nums">{formatCOP(needed - available)}</strong>.
              </span>
              <button onClick={onNeedRecharge}
                className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition">
                Recargar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 font-bold text-[12.5px] transition hover:text-slate-800">
          Cancelar
        </button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={saving || !enough}
          className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-[12.5px] shadow-md shadow-red-500/25 disabled:opacity-40 transition">
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
  return <div><Label>{label}</Label>{children}</div>;
}

function ResumeBox({ label, value, accent }) {
  return (
    <div className="px-2 py-2 rounded-xl bg-white border border-slate-200">
      <p className="text-[8.5px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-[12px] font-black tabular-nums truncate mt-0.5 ${accent ? 'text-emerald-600' : 'text-slate-700'}`}>{value}</p>
    </div>
  );
}

/* ──────── Recharges history ──────── */

function RechargesHistory({ onRecharge }) {
  const [reqs, setReqs] = useState([]);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          crewEmployerApi.get('/employers/wallet/recharge-requests'),
          crewEmployerApi.get('/employers/wallet/transactions'),
        ]);
        setReqs(r1.data.requests || []);
        setTxns(r2.data.transactions || []);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-[14px] font-black text-slate-800">Mis recargas</h3>
          <button onClick={onRecharge}
            className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/25 transition">
            + Nueva
          </button>
        </div>
        {loading && <p className="text-[12px] text-slate-400">Cargando…</p>}
        {!loading && reqs.length === 0 && (
          <p className="text-[12px] text-slate-400 text-center py-6">Aún no tienes solicitudes.</p>
        )}
        <div className="space-y-2">
          {reqs.map((r) => (
            <div key={r._id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <a href={r.proofUrl} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 block bg-slate-100 shrink-0">
                  <img src={r.proofUrl} alt="" className="w-full h-full object-cover" />
                </a>
                <div className="min-w-0">
                  <p className="text-[12px] font-extrabold text-slate-800 tabular-nums">{formatCOP(r.amount)}</p>
                  <p className="text-[10px] text-slate-500">{r.paymentMethod} · {new Date(r.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
              <StatusChip status={r.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-[14px] font-black text-slate-800 mb-2">Movimientos</h3>
        {txns.length === 0 ? (
          <p className="text-[12px] text-slate-400 text-center py-6">Sin movimientos aún.</p>
        ) : (
          <div className="space-y-1">
            {txns.slice(0, 12).map((t) => <TxnRow key={t._id} txn={t} />)}
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
    rejected: { label: 'Rechazada', cls: 'bg-red-50 text-red-600 border-red-200' },
  }[status] || { label: status, cls: 'bg-slate-50 text-slate-500 border-slate-200' };
  return <span className={`px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider rounded-full border ${info.cls}`}>{info.label}</span>;
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
  const info = labels[txn.kind] || { label: txn.kind, emoji: '•', tone: 'text-slate-500' };
  const sign = txn.direction === 'in' ? '+' : '−';
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base">{info.emoji}</span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-slate-700 truncate">{info.label}</p>
          <p className="text-[10px] text-slate-400 truncate">{txn.note || new Date(txn.createdAt).toLocaleDateString('es-CO')}</p>
        </div>
      </div>
      <span className={`text-[12px] font-black tabular-nums ${info.tone}`}>{sign}{formatCOP(txn.amount)}</span>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import crewApi from '../../services/crewApi';

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', weekday: 'short' });
}

const APP_STATUS_INFO = {
  pending: { label: 'Esperando', color: 'amber', emoji: '⏳' },
  accepted: { label: 'Te aceptaron', color: 'green', emoji: '🎉' },
  rejected: { label: 'No esta vez', color: 'red', emoji: '❌' },
  cancelled_by_worker: { label: 'Cancelaste', color: 'slate', emoji: '🚫' },
  expired: { label: 'Expirada', color: 'slate', emoji: '⌛' },
};

const BOOK_STATUS_INFO = {
  confirmed: { label: 'Confirmado', color: 'blue', emoji: '✅' },
  checked_in: { label: 'En turno', color: 'green', emoji: '💼' },
  completed: { label: 'Completado', color: 'cyan', emoji: '🏆' },
  no_show: { label: 'No fui', color: 'red', emoji: '❌' },
  cancelled_by_worker: { label: 'Cancelaste', color: 'slate', emoji: '🚫' },
  cancelled_by_business: { label: 'Cancelado', color: 'slate', emoji: '🚫' },
};

export default function CrewMyShifts() {
  const [tab, setTab] = useState('pending');
  const [applications, setApplications] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        crewApi.get('/workers/me/applications'),
        crewApi.get('/workers/me/bookings'),
      ]);
      setApplications(a.data.applications || []);
      setBookings(b.data.bookings || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingApps = applications.filter((a) => a.status === 'pending');
  const activeBookings = bookings.filter((b) => ['confirmed', 'checked_in'].includes(b.status));
  const historyBookings = bookings.filter((b) => ['completed', 'no_show', 'cancelled_by_worker', 'cancelled_by_business'].includes(b.status));

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white font-geist pb-24">
      <header className="px-5 pt-5 pb-3 border-b border-white/[0.04]">
        <h1 className="text-[22px] font-extrabold">Mis turnos</h1>
        <p className="text-[12px] text-white/40 mt-0.5">Aplicaciones, activos e historial</p>
      </header>

      {/* Tabs */}
      <div className="px-5 pt-4 flex gap-1.5 overflow-x-auto">
        {[
          { id: 'pending', label: `Pendientes`, count: pendingApps.length },
          { id: 'active', label: `Activos`, count: activeBookings.length },
          { id: 'history', label: `Historial`, count: historyBookings.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all whitespace-nowrap ${
              tab === t.id
                ? 'bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] text-white shadow-md'
                : 'bg-white/[0.04] text-white/50 border border-white/[0.06]'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                tab === t.id ? 'bg-white/25' : 'bg-white/[0.08]'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <main className="px-5 pt-4 space-y-3">
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-white/[0.03] border border-white/[0.06] rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && tab === 'pending' && pendingApps.length === 0 && (
          <EmptyState emoji="📭" title="No tienes aplicaciones" subtitle="Vuelve al feed y aplica a un turno" />
        )}
        {!loading && tab === 'pending' && pendingApps.map((a) => (
          <AppCard key={a._id} app={a} />
        ))}

        {!loading && tab === 'active' && activeBookings.length === 0 && (
          <EmptyState emoji="🛌" title="Sin turnos activos" subtitle="Te aceptaron? Aparecen aquí" />
        )}
        {!loading && tab === 'active' && activeBookings.map((b) => (
          <BookingCard key={b._id} booking={b} active onCheckIn={async () => {
            try {
              await crewApi.post(`/bookings/${b._id}/checkin`, {});
              await load();
            } catch (e) { alert(e?.response?.data?.message || 'Error'); }
          }} />
        ))}

        {!loading && tab === 'history' && historyBookings.length === 0 && (
          <EmptyState emoji="📜" title="Aún no hay historial" subtitle="Completa tu primer turno!" />
        )}
        {!loading && tab === 'history' && historyBookings.map((b) => (
          <BookingCard key={b._id} booking={b} />
        ))}
      </main>
    </div>
  );
}

function EmptyState({ emoji, title, subtitle }) {
  return (
    <div className="text-center py-16 px-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
      <p className="text-[44px] mb-2">{emoji}</p>
      <p className="text-[15px] font-bold text-white/80">{title}</p>
      <p className="text-[12px] text-white/40 mt-1">{subtitle}</p>
    </div>
  );
}

function AppCard({ app }) {
  const info = APP_STATUS_INFO[app.status] || APP_STATUS_INFO.pending;
  const shift = app.shiftId || {};
  const biz = shift.businessId || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4"
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <p className="text-[14px] font-extrabold leading-tight">{shift.title || 'Turno'}</p>
          <p className="text-[12px] text-white/45 mt-0.5">{biz.businessName || 'Negocio'}</p>
        </div>
        <StatusPill info={info} />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-white/50">
        <span>📅 {formatDate(shift.date)}</span>
        <span>⏱️ {shift.hoursTotal || 0}h</span>
        <span className="font-bold text-[#4CFFB8]">{formatCOP(shift.totalPay)}</span>
      </div>
    </motion.div>
  );
}

function BookingCard({ booking, active, onCheckIn }) {
  const info = BOOK_STATUS_INFO[booking.status] || BOOK_STATUS_INFO.confirmed;
  const shift = booking.shiftId || {};
  const biz = booking.businessId || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white/[0.03] border rounded-2xl p-4 ${active ? 'border-[#4CFFB8]/30 shadow-[0_0_30px_rgba(76,255,184,0.08)]' : 'border-white/[0.06]'}`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <p className="text-[14px] font-extrabold leading-tight">{shift.title || 'Turno'}</p>
          <p className="text-[12px] text-white/45 mt-0.5">{biz.businessName || 'Negocio'}</p>
        </div>
        <StatusPill info={info} />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-white/50 mb-3">
        <span>📅 {formatDate(shift.date)}</span>
        <span>⏱️ {booking.agreedHours}h</span>
        <span className="font-bold text-[#4CFFB8]">{formatCOP(booking.agreedTotal)}</span>
      </div>

      {active && booking.status === 'confirmed' && onCheckIn && (
        <button
          onClick={onCheckIn}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#4CFFB8] to-cyan-400 text-[#0A0A14] font-extrabold text-[13px] active:scale-95 transition"
        >
          Hacer check-in
        </button>
      )}
      {active && booking.status === 'checked_in' && (
        <div className="text-center py-2 text-[12px] font-bold text-[#4CFFB8]">
          🟢 En turno · check-in {new Date(booking.checkInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {booking.status === 'completed' && booking.xpAwarded > 0 && (
        <div className="px-3 py-2 bg-gradient-to-r from-[#7B2FFF]/15 to-[#FF6B35]/15 border border-[#7B2FFF]/25 rounded-xl text-[11px] font-bold text-center">
          +{booking.xpAwarded} XP ganados ⚡
        </div>
      )}
    </motion.div>
  );
}

function StatusPill({ info }) {
  const colorMap = {
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    red: 'bg-red-500/15 text-red-300 border-red-500/30',
    blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    slate: 'bg-white/[0.05] text-white/40 border-white/10',
  };
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${colorMap[info.color] || colorMap.slate}`}>
      <span>{info.emoji}</span>
      {info.label}
    </span>
  );
}

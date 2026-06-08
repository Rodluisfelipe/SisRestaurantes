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

const APP_STATUS = {
  pending: { label: 'En revisión', tone: 'pending' },
  accepted: { label: 'Aceptada', tone: 'active' },
  rejected: { label: 'No seleccionado', tone: 'muted' },
  cancelled_by_worker: { label: 'Cancelada', tone: 'muted' },
  expired: { label: 'Expirada', tone: 'muted' },
};

const BOOK_STATUS = {
  confirmed: { label: 'Confirmado', tone: 'active' },
  checked_in: { label: 'En curso', tone: 'active' },
  completed: { label: 'Completado', tone: 'done' },
  no_show: { label: 'Inasistencia', tone: 'danger' },
  cancelled_by_worker: { label: 'Cancelado por ti', tone: 'muted' },
  cancelled_by_business: { label: 'Cancelado por el negocio', tone: 'muted' },
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
    <div className="min-h-[100dvh] bg-[#0a0a14] text-white font-geist pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <header className="sticky top-0 z-30 bg-[#0a0a14]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-md mx-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-3">
          <h1 className="text-[20px] font-extrabold text-white">Mis turnos</h1>
          <p className="text-[12px] text-white/40 mt-0.5">Revisa el estado de tus postulaciones y turnos asignados</p>
        </div>
        <div className="max-w-md mx-auto px-5 pb-3 flex gap-1.5 overflow-x-auto">
          {[
            { id: 'pending', label: 'Postulaciones', count: pendingApps.length },
            { id: 'active', label: 'Activos', count: activeBookings.length },
            { id: 'history', label: 'Historial', count: historyBookings.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition whitespace-nowrap ${
                tab === t.id
                  ? 'bg-red-500 text-white shadow-[0_4px_16px_-4px_rgba(239,68,68,0.4)]'
                  : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.10] border border-white/[0.08]'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full tabular-nums ${
                  tab === t.id ? 'bg-white/25' : 'bg-white/[0.10] border border-white/[0.08]'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-4 space-y-3">
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
            ))}
          </div>
        )}

        {!loading && tab === 'pending' && pendingApps.length === 0 && (
          <EmptyState
            title="No tienes postulaciones activas"
            subtitle="Ve al listado de turnos y postúlate al que más te interese"
          />
        )}
        {!loading && tab === 'pending' && pendingApps.map((a) => <AppCard key={a._id} app={a} />)}

        {!loading && tab === 'active' && activeBookings.length === 0 && (
          <EmptyState
            title="No tienes turnos asignados"
            subtitle="Cuando un negocio acepte tu postulación, aparecerá aquí"
          />
        )}
        {!loading && tab === 'active' && activeBookings.map((b) => (
          <BookingCard
            key={b._id}
            booking={b}
            active
            onCheckIn={async () => {
              try {
                await crewApi.post(`/bookings/${b._id}/checkin`, {});
                await load();
              } catch (e) { alert(e?.response?.data?.message || 'Error'); }
            }}
            onCheckOut={async () => {
              try {
                await crewApi.post(`/bookings/${b._id}/checkout`, {});
                await load();
              } catch (e) { alert(e?.response?.data?.message || 'Error'); }
            }}
          />
        ))}

        {!loading && tab === 'history' && historyBookings.length === 0 && (
          <EmptyState
            title="Aún no tienes historial"
            subtitle="Completa tu primer turno para verlo aquí"
          />
        )}
        {!loading && tab === 'history' && historyBookings.map((b) => <BookingCard key={b._id} booking={b} />)}
      </main>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="text-center py-12 px-6 rounded-[22px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
      <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-white/25" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
      </div>
      <p className="text-[14px] font-bold text-white/80">{title}</p>
      <p className="text-[12px] text-white/35 mt-1">{subtitle}</p>
    </div>
  );
}

function AppCard({ app }) {
  const info = APP_STATUS[app.status] || APP_STATUS.pending;
  const shift = app.shiftId || {};
  const biz = shift.businessId || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm"
    >
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold text-white leading-tight">{shift.title || 'Turno'}</p>
          <p className="text-[12px] text-white/40 mt-0.5 truncate">{biz.businessName || 'Negocio'}</p>
        </div>
        <StatusPill info={info} />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-white/40">
        <span>{formatDate(shift.date)}</span>
        <span>·</span>
        <span>{shift.hoursTotal || 0} horas</span>
        <span>·</span>
        <span className="font-bold text-red-400">{formatCOP(shift.totalPay)}</span>
      </div>
    </motion.div>
  );
}

function BookingCard({ booking, active, onCheckIn, onCheckOut }) {
  const info = BOOK_STATUS[booking.status] || BOOK_STATUS.confirmed;
  const shift = booking.shiftId || {};
  const biz = booking.businessId || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[22px] border p-4 backdrop-blur-sm ${active ? 'border-red-500/30 bg-red-500/[0.05] shadow-[0_4px_20px_-8px_rgba(239,68,68,0.2)]' : 'border-white/[0.08] bg-white/[0.03]'}`}
    >
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold text-white leading-tight">{shift.title || 'Turno'}</p>
          <p className="text-[12px] text-white/40 mt-0.5 truncate">{biz.businessName || 'Negocio'}</p>
        </div>
        <StatusPill info={info} />
      </div>

      <div className="flex items-center gap-3 text-[11px] text-white/40 mb-3">
        <span>{formatDate(shift.date)}</span>
        <span>·</span>
        <span>{booking.agreedHours} horas</span>
        <span>·</span>
        <span className="font-bold text-red-400">{formatCOP(booking.agreedTotal)}</span>
      </div>

      {booking.businessId?.address && (
        <div className="text-[11px] text-white/40 mb-3 flex items-start gap-1.5">
          <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/25" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
          <span className="line-clamp-2">{booking.businessId.address}</span>
        </div>
      )}

      {active && booking.status === 'confirmed' && onCheckIn && (
        <button
          onClick={onCheckIn}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-[13px] shadow-md shadow-red-500/20 active:scale-[0.98] transition-all"
        >
          Confirmar mi llegada (check-in)
        </button>
      )}
      {active && booking.status === 'checked_in' && (
        <div className="space-y-2">
          <div className="text-center py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[12px] font-bold text-white/80">
            En turno · check-in a las {new Date(booking.checkInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {onCheckOut && (
            <button
              onClick={onCheckOut}
              className="w-full py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white font-bold text-[13px] active:scale-[0.98] transition-all hover:bg-white/[0.10]"
            >
              Finalizar turno (check-out)
            </button>
          )}
        </div>
      )}

      {booking.status === 'completed' && booking.xpAwarded > 0 && (
        <div className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[11px] font-semibold text-center text-white/60">
          +{booking.xpAwarded} puntos de experiencia ganados
        </div>
      )}
    </motion.div>
  );
}

function StatusPill({ info }) {
  const tones = {
    pending: 'bg-white/[0.08] text-white/60 border-white/[0.12]',
    active: 'bg-red-500/15 text-red-400 border-red-500/30',
    done: 'bg-white/[0.06] text-white/50 border-white/[0.10]',
    danger: 'bg-red-500/20 text-red-300 border-red-500/30',
    muted: 'bg-white/[0.04] text-white/30 border-white/[0.06]',
  };
  return (
    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${tones[info.tone] || tones.muted}`}>
      {info.label}
    </span>
  );
}

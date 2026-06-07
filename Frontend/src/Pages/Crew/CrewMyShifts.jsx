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
  pending: { label: 'En revisión', tone: 'amber' },
  accepted: { label: 'Aceptada', tone: 'emerald' },
  rejected: { label: 'No seleccionado', tone: 'slate' },
  cancelled_by_worker: { label: 'Cancelada', tone: 'slate' },
  expired: { label: 'Expirada', tone: 'slate' },
};

const BOOK_STATUS = {
  confirmed: { label: 'Confirmado', tone: 'blue' },
  checked_in: { label: 'En curso', tone: 'emerald' },
  completed: { label: 'Completado', tone: 'cyan' },
  no_show: { label: 'Inasistencia', tone: 'red' },
  cancelled_by_worker: { label: 'Cancelado por ti', tone: 'slate' },
  cancelled_by_business: { label: 'Cancelado por el negocio', tone: 'slate' },
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-geist pb-24">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-md mx-auto px-5 pt-5 pb-3">
          <h1 className="text-[20px] font-extrabold text-slate-900">Mis turnos</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Revisa el estado de tus postulaciones y turnos asignados</p>
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
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full tabular-nums ${
                  tab === t.id ? 'bg-white/25' : 'bg-white border border-slate-200'
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
              <div key={i} className="h-32 bg-white border border-slate-200 rounded-2xl" />
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
    <div className="text-center py-12 px-6 bg-white border border-slate-200 rounded-2xl">
      <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
      </div>
      <p className="text-[14px] font-bold text-slate-700">{title}</p>
      <p className="text-[12px] text-slate-500 mt-1">{subtitle}</p>
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
      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"
    >
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold text-slate-900 leading-tight">{shift.title || 'Turno'}</p>
          <p className="text-[12px] text-slate-500 mt-0.5 truncate">{biz.businessName || 'Negocio'}</p>
        </div>
        <StatusPill info={info} />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span>{formatDate(shift.date)}</span>
        <span>·</span>
        <span>{shift.hoursTotal || 0} horas</span>
        <span>·</span>
        <span className="font-bold text-emerald-600">{formatCOP(shift.totalPay)}</span>
      </div>
    </motion.div>
  );
}

function BookingCard({ booking, active, onCheckIn }) {
  const info = BOOK_STATUS[booking.status] || BOOK_STATUS.confirmed;
  const shift = booking.shiftId || {};
  const biz = booking.businessId || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white border rounded-2xl p-4 shadow-sm ${active ? 'border-red-300 shadow-red-500/10' : 'border-slate-200'}`}
    >
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold text-slate-900 leading-tight">{shift.title || 'Turno'}</p>
          <p className="text-[12px] text-slate-500 mt-0.5 truncate">{biz.businessName || 'Negocio'}</p>
        </div>
        <StatusPill info={info} />
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-3">
        <span>{formatDate(shift.date)}</span>
        <span>·</span>
        <span>{booking.agreedHours} horas</span>
        <span>·</span>
        <span className="font-bold text-emerald-600">{formatCOP(booking.agreedTotal)}</span>
      </div>

      {booking.businessId?.address && (
        <div className="text-[11px] text-slate-500 mb-3 flex items-start gap-1.5">
          <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
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
        <div className="text-center py-2 px-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[12px] font-bold text-emerald-700">
          En turno · check-in registrado a las {new Date(booking.checkInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {booking.status === 'completed' && booking.xpAwarded > 0 && (
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-center text-slate-700">
          +{booking.xpAwarded} puntos de experiencia ganados
        </div>
      )}
    </motion.div>
  );
}

function StatusPill({ info }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${tones[info.tone] || tones.slate}`}>
      {info.label}
    </span>
  );
}

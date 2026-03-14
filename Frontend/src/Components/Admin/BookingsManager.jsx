import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { socket } from '../../services/socket';
import {
  FaCalendarAlt, FaList, FaChevronLeft, FaChevronRight,
  FaCheck, FaTimes, FaBan, FaUser, FaClock, FaPhone,
  FaChevronDown, FaFilter
} from 'react-icons/fa';

const STATUS_LABELS = {
  pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  completed: { label: 'Completada', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-600', dot: 'bg-red-400' },
  no_show: { label: 'No asistió', color: 'bg-orange-100 text-orange-600', dot: 'bg-orange-400' },
};

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDateStr(date) {
  return date.toISOString().slice(0, 10);
}

export default function BookingsManager({ businessId }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    return { from: getDateStr(today), to: getDateStr(end) };
  });
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/bookings?businessId=${businessId}&from=${dateRange.from}&to=${dateRange.to}`);
      setBookings(res.data || []);
    } catch (err) {
      console.error('Error loading bookings', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, dateRange]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Listen for real-time booking events
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchBookings();
    socket.on('new_booking', handler);
    socket.on('order_updated', handler);
    return () => {
      socket.off('new_booking', handler);
      socket.off('order_updated', handler);
    };
  }, [fetchBookings]);

  const updateBookingStatus = async (id, bookingStatus) => {
    try {
      await api.patch(`/bookings/${id}/status`, { bookingStatus });
      setBookings(prev => prev.map(b => b._id === id ? { ...b, bookingStatus, status: bookingStatus === 'cancelled' ? 'cancelled' : bookingStatus === 'completed' ? 'completed' : bookingStatus === 'confirmed' ? 'confirmed' : b.status } : b));
    } catch (err) {
      console.error('Error updating booking status', err);
    }
  };

  const filtered = bookings.filter(b => filter === 'all' || b.bookingStatus === filter);

  // Today's bookings count
  const todayStr = getDateStr(new Date());
  const todayBookings = bookings.filter(b => b.bookingDate && b.bookingDate.slice(0, 10) === todayStr && b.bookingStatus !== 'cancelled');

  // Navigate date range
  const shiftRange = (days) => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    from.setDate(from.getDate() + days);
    to.setDate(to.getDate() + days);
    setDateRange({ from: getDateStr(from), to: getDateStr(to) });
  };

  // Calendar helpers
  const calendarDayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const getCalendarWeek = () => {
    const start = new Date(calendarDate);
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + diff);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const hours = [];
  for (let h = 6; h <= 22; h++) {
    hours.push(`${String(h).padStart(2, '0')}:00`);
  }

  const getBookingsForDayHour = (day, hour) => {
    const dayStr = getDateStr(day);
    const [hourNum] = hour.split(':').map(Number);
    return bookings.filter(b => {
      if (!b.bookingDate) return false;
      const bDate = new Date(b.bookingDate);
      return bDate.toISOString().slice(0, 10) === dayStr && bDate.getUTCHours() === hourNum && b.bookingStatus !== 'cancelled';
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FaCalendarAlt className="text-indigo-500" />
            Agenda
          </h2>
          {todayBookings.length > 0 && (
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              {todayBookings.length} hoy
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="all">Todas</option>
            <option value="pending">Pendientes</option>
            <option value="confirmed">Confirmadas</option>
            <option value="completed">Completadas</option>
            <option value="cancelled">Canceladas</option>
          </select>

          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <FaList className="inline mr-1" />Lista
            </button>
            <button onClick={() => setView('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <FaCalendarAlt className="inline mr-1" />Calendario
            </button>
          </div>
        </div>
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <div className="space-y-3">
          {/* Date navigation */}
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => shiftRange(-7)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <FaChevronLeft className="text-xs" />
            </button>
            <span className="text-sm font-medium text-slate-700">
              {new Date(dateRange.from).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
              {' — '}
              {new Date(dateRange.to).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
            </span>
            <button onClick={() => shiftRange(7)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <FaChevronRight className="text-xs" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Cargando citas...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FaCalendarAlt className="text-3xl text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No hay citas en este período</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(booking => {
                const st = STATUS_LABELS[booking.bookingStatus] || STATUS_LABELS.pending;
                return (
                  <div key={booking._id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Date/Time */}
                    <div className="flex items-center gap-3 sm:w-48 flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase leading-none">
                          {new Date(booking.bookingDate).toLocaleDateString('es-CO', { weekday: 'short' })}
                        </span>
                        <span className="text-sm font-bold text-indigo-800 leading-none">
                          {new Date(booking.bookingDate).getUTCDate()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {formatTime(booking.bookingDate)}
                        </p>
                        {booking.bookingEndDate && (
                          <p className="text-[11px] text-slate-400">
                            hasta {formatTime(booking.bookingEndDate)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Customer + Service */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <FaUser className="text-[10px] text-slate-400" />
                        {booking.customerName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {booking.items?.map(i => i.name).join(', ')}
                      </p>
                      {booking.phone && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <FaPhone className="text-[8px]" />{booking.phone}
                        </p>
                      )}
                    </div>

                    {/* Status + Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${st.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>

                      {booking.bookingStatus === 'pending' && (
                        <>
                          <button onClick={() => updateBookingStatus(booking._id, 'confirmed')}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Confirmar">
                            <FaCheck className="text-xs" />
                          </button>
                          <button onClick={() => updateBookingStatus(booking._id, 'cancelled')}
                            className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="Cancelar">
                            <FaTimes className="text-xs" />
                          </button>
                        </>
                      )}
                      {booking.bookingStatus === 'confirmed' && (
                        <>
                          <button onClick={() => updateBookingStatus(booking._id, 'completed')}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Completar">
                            <FaCheck className="text-xs" />
                          </button>
                          <button onClick={() => updateBookingStatus(booking._id, 'no_show')}
                            className="p-1.5 rounded-lg bg-orange-50 text-orange-500 hover:bg-orange-100 transition-colors" title="No asistió">
                            <FaBan className="text-xs" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {view === 'calendar' && (
        <div className="space-y-3">
          {/* Week navigation */}
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => { const d = new Date(calendarDate); d.setDate(d.getDate() - 7); setCalendarDate(d); setDateRange({ from: getDateStr(new Date(d.getTime() - d.getDay() * 86400000 + 86400000)), to: getDateStr(new Date(d.getTime() + (7 - d.getDay()) * 86400000)) }); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <FaChevronLeft className="text-xs" />
            </button>
            <span className="text-sm font-medium text-slate-700">
              {calendarDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => { const d = new Date(calendarDate); d.setDate(d.getDate() + 7); setCalendarDate(d); setDateRange({ from: getDateStr(new Date(d.getTime() - d.getDay() * 86400000 + 86400000)), to: getDateStr(new Date(d.getTime() + (7 - d.getDay()) * 86400000)) }); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <FaChevronRight className="text-xs" />
            </button>
          </div>

          {/* Weekly grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Day headers */}
              <div className="grid grid-cols-8 gap-px bg-slate-200 rounded-t-xl overflow-hidden">
                <div className="bg-slate-50 p-2 text-[10px] font-bold text-slate-400 text-center">Hora</div>
                {getCalendarWeek().map((day, i) => {
                  const isToday = getDateStr(day) === todayStr;
                  return (
                    <div key={i} className={`p-2 text-center ${isToday ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                      <p className={`text-[10px] font-bold uppercase ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {calendarDayNames[i]}
                      </p>
                      <p className={`text-sm font-bold ${isToday ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {day.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Time rows */}
              <div className="bg-slate-200 space-y-px rounded-b-xl overflow-hidden">
                {hours.map(hour => (
                  <div key={hour} className="grid grid-cols-8 gap-px min-h-[40px]">
                    <div className="bg-slate-50 flex items-center justify-center text-[10px] font-medium text-slate-400">
                      {hour}
                    </div>
                    {getCalendarWeek().map((day, di) => {
                      const cellBookings = getBookingsForDayHour(day, hour);
                      return (
                        <div key={di} className={`bg-white p-0.5 ${getDateStr(day) === todayStr ? 'bg-indigo-50/30' : ''}`}>
                          {cellBookings.map(b => {
                            const st = STATUS_LABELS[b.bookingStatus] || STATUS_LABELS.pending;
                            return (
                              <div key={b._id} className={`rounded px-1 py-0.5 text-[9px] font-medium truncate ${st.color}`} title={`${b.customerName} — ${b.items?.map(i => i.name).join(', ')}`}>
                                {b.customerName}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

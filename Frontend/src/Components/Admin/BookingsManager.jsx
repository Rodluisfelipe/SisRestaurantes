import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { socket } from '../../services/socket';
import {
  FaCalendarAlt, FaList, FaChevronLeft, FaChevronRight,
  FaCheck, FaTimes, FaBan, FaUser, FaClock, FaPhone,
  FaChevronDown, FaFilter, FaChartBar, FaWhatsapp,
  FaStar, FaHistory, FaArrowLeft, FaDollarSign,
  FaUserSlash, FaCalendarCheck, FaCalendarTimes,
  FaUserMd, FaRedo, FaStickyNote
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

export default function BookingsManager({ businessId, businessConfig }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'calendar' | 'stats'
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    return { from: getDateStr(today), to: getDateStr(end) };
  });
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [filter, setFilter] = useState('all');

  // Stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsRange, setStatsRange] = useState(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    return { from: getDateStr(start), to: getDateStr(today) };
  });

  // Customer detail panel
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  // Staff state
  const [staffList, setStaffList] = useState([]);
  const [staffFilter, setStaffFilter] = useState('all'); // 'all' or staffId

  // Complete-with-note modal
  const [completeModal, setCompleteModal] = useState(null); // booking object or null
  const [completeNote, setCompleteNote] = useState('');
  const [completing, setCompleting] = useState(false);

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

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get(`/bookings/stats?businessId=${businessId}&from=${statsRange.from}&to=${statsRange.to}`);
      setStats(res.data);
    } catch (err) {
      console.error('Error loading stats', err);
    } finally {
      setStatsLoading(false);
    }
  }, [businessId, statsRange]);

  const fetchCustomer = useCallback(async (phone) => {
    setCustomerLoading(true);
    try {
      const res = await api.get(`/bookings/customer/${encodeURIComponent(phone)}?businessId=${businessId}`);
      setCustomerData(res.data);
    } catch (err) {
      console.error('Error loading customer', err);
    } finally {
      setCustomerLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Fetch staff list
  useEffect(() => {
    api.get(`/bookings/available-staff?businessId=${businessId}`)
      .then(res => setStaffList(res.data || []))
      .catch(() => setStaffList([]));
  }, [businessId]);

  useEffect(() => {
    if (view === 'stats') fetchStats();
  }, [view, fetchStats]);

  // Listen for real-time booking events
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchBookings();
    socket.on('new_booking', handler);
    socket.on('booking_updated', handler);
    return () => {
      socket.off('new_booking', handler);
      socket.off('booking_updated', handler);
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

  const confirmViaWhatsApp = async (booking) => {
    // 1. Confirm in backend
    await updateBookingStatus(booking._id, 'confirmed');
    // 2. Open WhatsApp with confirmation message
    if (!booking.phone) return;
    const phone = booking.phone.replace(/\D/g, '');
    const bName = businessConfig?.businessName || 'nuestro negocio';
    const dateStr = new Date(booking.bookingDate).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = formatTime(booking.bookingDate);
    const services = booking.items?.map(i => i.name).join(', ') || '';
    const msg = `Hola ${booking.customerName} 👋\n\n✅ Tu cita en *${bName}* ha sido *confirmada*.\n\n📅 ${dateStr}\n🕐 ${timeStr}${services ? `\n💇 ${services}` : ''}${booking.staffName ? `\n👤 ${booking.staffName}` : ''}\n\n¡Te esperamos!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const assignStaff = async (bookingId, staffId, staffName) => {
    try {
      await api.patch(`/bookings/${bookingId}/assign-staff`, { staffId, staffName });
      setBookings(prev => prev.map(b => b._id === bookingId ? { ...b, staffId, staffName } : b));
    } catch (err) {
      console.error('Error assigning staff', err);
    }
  };

  const openCustomerPanel = (phone, name) => {
    setSelectedCustomer({ phone, name });
    fetchCustomer(phone);
  };

  const closeCustomerPanel = () => {
    setSelectedCustomer(null);
    setCustomerData(null);
  };

  const filtered = bookings
    .filter(b => filter === 'all' || b.bookingStatus === filter)
    .filter(b => staffFilter === 'all' || b.staffId === staffFilter);

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

  // Stats period presets
  const setStatsPeriod = (period) => {
    const today = new Date();
    const start = new Date(today);
    if (period === '7d') start.setDate(start.getDate() - 7);
    else if (period === '30d') start.setDate(start.getDate() - 30);
    else if (period === '90d') start.setDate(start.getDate() - 90);
    setStatsRange({ from: getDateStr(start), to: getDateStr(today) });
  };

  const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

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
          {/* Filter (not shown in stats view) */}
          {view !== 'stats' && (
            <>
              <select value={filter} onChange={e => setFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                <option value="all">Todas</option>
                <option value="pending">Pendientes</option>
                <option value="confirmed">Confirmadas</option>
                <option value="completed">Completadas</option>
                <option value="cancelled">Canceladas</option>
              </select>
              {staffList.length > 0 && (
                <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                  <option value="all">Todo el equipo</option>
                  {staffList.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              )}
            </>
          )}

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
            <button onClick={() => setView('stats')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'stats' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <FaChartBar className="inline mr-1" />Reportes
            </button>
          </div>
        </div>
      </div>

      {/* KPI Strip (visible in list and calendar views) */}
      {view !== 'stats' && bookings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Pendientes', value: bookings.filter(b => b.bookingStatus === 'pending').length, icon: FaClock, color: 'text-amber-600 bg-amber-50' },
            { label: 'Confirmadas', value: bookings.filter(b => b.bookingStatus === 'confirmed').length, icon: FaCalendarCheck, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Completadas', value: bookings.filter(b => b.bookingStatus === 'completed').length, icon: FaCheck, color: 'text-blue-600 bg-blue-50' },
            { label: 'Canceladas', value: bookings.filter(b => b.bookingStatus === 'cancelled').length + bookings.filter(b => b.bookingStatus === 'no_show').length, icon: FaCalendarTimes, color: 'text-red-600 bg-red-50' },
          ].map((kpi) => (
            <div key={kpi.label} className={`rounded-xl p-3 ${kpi.color}`}>
              <div className="flex items-center gap-2">
                <kpi.icon className="text-sm opacity-60" />
                <span className="text-lg font-bold">{kpi.value}</span>
              </div>
              <p className="text-[10px] font-medium opacity-70 mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

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

                    {/* Customer + Service — clickable for customer panel */}
                    <div className="flex-1 min-w-0 cursor-pointer hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors"
                         onClick={() => booking.phone && openCustomerPanel(booking.phone, booking.customerName)}>
                      <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <FaUser className="text-[10px] text-slate-400" />
                        {booking.customerName}
                        {booking.recurrence?.type && (
                          <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <FaRedo className="text-[7px]" />
                            {booking.recurrence.type === 'weekly' ? 'Semanal' : booking.recurrence.type === 'biweekly' ? 'Quincenal' : 'Mensual'}
                          </span>
                        )}
                        {booking.phone && <span className="text-[10px] text-indigo-400 ml-1">ver ficha →</span>}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {booking.items?.map(i => i.name).join(', ')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {booking.phone && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <FaPhone className="text-[8px]" />{booking.phone}
                          </p>
                        )}
                        {booking.staffName && (
                          <p className="text-[11px] text-indigo-500 flex items-center gap-1">
                            <FaUserMd className="text-[8px]" />{booking.staffName}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Staff Assignment (for admin) */}
                    {staffList.length > 0 && booking.bookingStatus !== 'cancelled' && booking.bookingStatus !== 'completed' && (
                      <div className="flex-shrink-0">
                        <select
                          value={booking.staffId || ''}
                          onChange={(e) => {
                            const sid = e.target.value;
                            const sname = staffList.find(s => s._id === sid)?.name || null;
                            assignStaff(booking._id, sid || null, sname);
                          }}
                          className="text-[10px] border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-slate-600"
                          title="Asignar profesional"
                        >
                          <option value="">Sin asignar</option>
                          {staffList.map(s => (
                            <option key={s._id} value={s._id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Status + Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${st.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>

                      {booking.bookingStatus === 'pending' && (
                        <>
                          <button onClick={() => confirmViaWhatsApp(booking)}
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Confirmar por WhatsApp">
                            <FaWhatsapp className="text-sm" />
                          </button>
                          <button onClick={() => updateBookingStatus(booking._id, 'cancelled')}
                            className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="Cancelar">
                            <FaTimes className="text-xs" />
                          </button>
                        </>
                      )}
                      {booking.bookingStatus === 'confirmed' && (
                        <>
                          <button onClick={() => { setCompleteModal(booking); setCompleteNote(''); }}
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
                              <div key={b._id}
                                className={`rounded px-1 py-0.5 text-[9px] font-medium truncate cursor-pointer hover:opacity-80 ${st.color}`}
                                title={`${b.customerName} — ${b.items?.map(i => i.name).join(', ')}`}
                                onClick={() => b.phone && openCustomerPanel(b.phone, b.customerName)}>
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

      {/* STATS VIEW */}
      {view === 'stats' && (
        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center justify-center gap-2">
            {[
              { label: '7 días', key: '7d' },
              { label: '30 días', key: '30d' },
              { label: '90 días', key: '90d' },
            ].map(p => (
              <button key={p.key} onClick={() => setStatsPeriod(p.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors">
                {p.label}
              </button>
            ))}
          </div>

          {statsLoading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Cargando reportes...</div>
          ) : !stats ? (
            <div className="text-center py-12 text-slate-400 text-sm">Sin datos</div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Citas', value: stats.total, icon: FaCalendarAlt, color: 'text-indigo-600 bg-indigo-50' },
                  { label: 'Completadas', value: stats.byStatus.completed, icon: FaCheck, color: 'text-emerald-600 bg-emerald-50' },
                  { label: 'Confirmadas', value: stats.byStatus.confirmed, icon: FaCalendarCheck, color: 'text-blue-600 bg-blue-50' },
                  { label: 'Canceladas', value: stats.byStatus.cancelled, icon: FaCalendarTimes, color: 'text-red-600 bg-red-50' },
                  { label: 'No asistió', value: stats.byStatus.no_show, icon: FaUserSlash, color: 'text-orange-600 bg-orange-50' },
                  { label: 'Ingresos', value: `$${(stats.revenue || 0).toLocaleString()}`, icon: FaDollarSign, color: 'text-green-600 bg-green-50' },
                ].map(kpi => (
                  <div key={kpi.label} className={`rounded-xl p-3 ${kpi.color}`}>
                    <kpi.icon className="text-sm opacity-60 mb-1" />
                    <p className="text-xl font-bold">{kpi.value}</p>
                    <p className="text-[10px] font-medium opacity-70">{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* Rates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Tasa de Cancelación</h3>
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold text-red-600">{stats.cancellationRate}%</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div className="bg-red-400 h-full rounded-full transition-all" style={{ width: `${stats.cancellationRate}%` }} />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Tasa de No Asistencia</h3>
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold text-orange-600">{stats.noShowRate}%</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div className="bg-orange-400 h-full rounded-full transition-all" style={{ width: `${stats.noShowRate}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Services */}
              {stats.topServices?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Servicios Más Populares</h3>
                  <div className="space-y-2">
                    {stats.topServices.map((s, i) => {
                      const maxCount = stats.topServices[0].count;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-medium text-slate-800">{s.name}</span>
                              <span className="text-xs font-bold text-indigo-600">{s.count}</span>
                            </div>
                            <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className="bg-indigo-400 h-full rounded-full transition-all" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Daily Distribution */}
              {stats.dailyDistribution && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Citas por Día de la Semana</h3>
                  <div className="flex items-end gap-2 h-32">
                    {stats.dailyDistribution.map((count, i) => {
                      const max = Math.max(...stats.dailyDistribution, 1);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold text-indigo-600">{count || ''}</span>
                          <div className="w-full bg-slate-100 rounded-t-md overflow-hidden flex-1 flex items-end">
                            <div className="w-full bg-indigo-400 rounded-t-md transition-all" style={{ height: `${(count / max) * 100}%` }} />
                          </div>
                          <span className="text-[10px] font-medium text-slate-500">{DAY_NAMES[i]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CUSTOMER DETAIL PANEL (Slide-over) */}
      <AnimatePresence>
        {selectedCustomer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={closeCustomerPanel}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 overflow-y-auto"
            >
              {/* Panel Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center gap-3 z-10">
                <button onClick={closeCustomerPanel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                  <FaArrowLeft className="text-sm" />
                </button>
                <h3 className="font-bold text-slate-900">Ficha del Cliente</h3>
              </div>

              {customerLoading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
              ) : customerData ? (
                <div className="p-4 space-y-4">
                  {/* Customer Info Card */}
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-200 flex items-center justify-center">
                        <FaUser className="text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{customerData.customer.name}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <FaPhone className="text-[10px]" />{customerData.customer.phone}
                        </p>
                      </div>
                    </div>
                    {/* Quick actions */}
                    <div className="flex gap-2">
                      <a href={`https://wa.me/${customerData.customer.phone.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors">
                        <FaWhatsapp /> WhatsApp
                      </a>
                      <a href={`tel:${customerData.customer.phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 transition-colors">
                        <FaPhone className="text-[10px]" /> Llamar
                      </a>
                    </div>
                  </div>

                  {/* Customer Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-indigo-600">{customerData.stats.totalBookings}</p>
                      <p className="text-[10px] text-slate-500">Total Citas</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-emerald-600">{customerData.stats.completed}</p>
                      <p className="text-[10px] text-slate-500">Completadas</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-red-600">{customerData.stats.cancelled}</p>
                      <p className="text-[10px] text-slate-500">Canceladas</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-green-600">${(customerData.stats.revenue || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500">Ingresos</p>
                    </div>
                  </div>

                  {/* General customer data */}
                  {customerData.customer.totalOrders > 0 && (
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Datos Generales</p>
                      <div className="space-y-1 text-xs text-slate-600">
                        <p>Total pedidos/citas: <span className="font-bold">{customerData.customer.totalOrders}</span></p>
                        <p>Total gastado: <span className="font-bold">${(customerData.customer.totalSpent || 0).toLocaleString()}</span></p>
                        {customerData.customer.lastOrderDate && (
                          <p>Última actividad: <span className="font-bold">{new Date(customerData.customer.lastOrderDate).toLocaleDateString('es-CO')}</span></p>
                        )}
                        {customerData.customer.status && (
                          <p>Estado: <span className={`font-bold ${customerData.customer.status === 'vip' ? 'text-amber-600' : 'text-slate-800'}`}>
                            {customerData.customer.status === 'vip' ? '⭐ VIP' : customerData.customer.status === 'active' ? 'Activo' : 'Inactivo'}
                          </span></p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Booking History */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                      <FaHistory className="text-[9px]" /> Historial de Citas
                    </p>
                    {customerData.bookings.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">Sin citas registradas</p>
                    ) : (
                      <div className="space-y-2">
                        {customerData.bookings.map(b => {
                          const st = STATUS_LABELS[b.bookingStatus] || STATUS_LABELS.pending;
                          return (
                            <div key={b._id} className="bg-white border border-slate-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-900">
                                  {new Date(b.bookingDate).toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${st.color}`}>
                                  {st.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {formatTime(b.bookingDate)}
                                {b.bookingEndDate && ` — ${formatTime(b.bookingEndDate)}`}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {b.items?.map(i => i.name).join(', ')}
                              </p>
                              {(b.finalAmount || b.totalAmount) > 0 && (
                                <p className="text-[11px] font-medium text-green-600 mt-0.5">
                                  ${(b.finalAmount || b.totalAmount).toLocaleString()}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* COMPLETE WITH NOTE MODAL */}
      <AnimatePresence>
        {completeModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => !completing && setCompleteModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FaCheck className="text-emerald-500" /> Completar Cita
                </h3>
                <p className="text-xs text-slate-500">
                  {completeModal.customerName} &mdash; {formatDate(completeModal.bookingDate)} {formatTime(completeModal.bookingDate)}
                </p>
                <div>
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-1">
                    <FaStickyNote className="text-amber-500" /> Nota del servicio (opcional)
                  </label>
                  <textarea
                    value={completeNote}
                    onChange={e => setCompleteNote(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Ej: Corte + tintura castaño, preferencia para próxima vez..."
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <p className="text-[10px] text-slate-400 text-right mt-0.5">{completeNote.length}/1000</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={completing}
                    onClick={() => setCompleteModal(null)}
                    className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={completing}
                    onClick={async () => {
                      setCompleting(true);
                      try {
                        // Save note if provided and customer exists
                        if (completeNote.trim() && completeModal.customerId) {
                          try {
                            await api.post(`/customers/${completeModal.customerId}/notes`, {
                              text: completeNote.trim(),
                              bookingId: completeModal._id
                            });
                          } catch (noteErr) {
                            console.error('Could not save note', noteErr);
                          }
                        }
                        await updateBookingStatus(completeModal._id, 'completed');
                        setCompleteModal(null);
                      } finally {
                        setCompleting(false);
                      }
                    }}
                    className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {completing ? 'Guardando...' : <><FaCheck className="text-xs" /> Completar</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

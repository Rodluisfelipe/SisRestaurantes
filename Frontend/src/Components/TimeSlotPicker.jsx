import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt, FaClock } from 'react-icons/fa';

/**
 * TimeSlotPicker — date + time slot selector for booking services.
 * 
 * Props:
 *   businessId     - MongoDB _id
 *   businessConfig - full config (businessHours, bookingSettings)
 *   duration       - max service duration in minutes (for slot calculation)
 *   buttonColor    - theme color
 *   buttonTextColor- theme text color
 *   onSelect       - callback({ date: 'YYYY-MM-DD', time: 'HH:MM', dateTime: ISO })
 *   selected       - currently selected { date, time } or null
 */
export default function TimeSlotPicker({ businessId, businessConfig, duration, buttonColor, buttonTextColor, onSelect, selected }) {
  const [selectedDate, setSelectedDate] = useState(selected?.date || null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const maxDays = businessConfig?.bookingSettings?.maxAdvanceDays || 30;

  // Generate available dates (next N days, filtering by business hours)
  const availableDates = useMemo(() => {
    const dates = [];
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= maxDays; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dayName = dayKeys[d.getDay()];
      const dayHours = businessConfig?.businessHours?.[dayName];
      if (dayHours && dayHours.isOpen) {
        dates.push({
          date: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }),
          dayName: d.toLocaleDateString('es-CO', { weekday: 'short' }),
          dayNum: d.getDate(),
          monthShort: d.toLocaleDateString('es-CO', { month: 'short' })
        });
      }
    }
    return dates;
  }, [businessConfig, maxDays]);

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate || !businessId) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const res = await api.get(`/bookings/slots?businessId=${businessId}&date=${selectedDate}&duration=${duration || 30}`);
        setSlots(res.data.slots || []);
      } catch (err) {
        console.error('Error loading slots', err);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, businessId, duration]);

  const handleSelectSlot = (time) => {
    const dateTime = `${selectedDate}T${time}:00.000Z`;
    onSelect({ date: selectedDate, time, dateTime });
  };

  // Scroll state for date picker
  const [dateScrollStart, setDateScrollStart] = useState(0);
  const visibleDates = 5;
  const datesToShow = availableDates.slice(dateScrollStart, dateScrollStart + visibleDates);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <FaCalendarAlt className="text-sm" style={{ color: buttonColor }} />
        <span className="text-sm font-bold text-slate-800">Selecciona fecha y hora</span>
      </div>

      {/* Date picker horizontal scroll */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setDateScrollStart(Math.max(0, dateScrollStart - visibleDates))}
          disabled={dateScrollStart === 0}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          <FaChevronLeft className="text-[10px]" />
        </button>

        <div className="flex gap-1.5 flex-1 justify-center">
          {datesToShow.map(d => {
            const isSelected = selectedDate === d.date;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => { setSelectedDate(d.date); }}
                className={`flex flex-col items-center py-2 px-3 rounded-xl text-center transition-all min-w-[56px] ${
                  isSelected
                    ? 'text-white shadow-md scale-105'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
                style={isSelected ? { backgroundColor: buttonColor, color: buttonTextColor } : {}}
              >
                <span className="text-[10px] font-bold uppercase leading-none">{d.dayName}</span>
                <span className="text-lg font-bold leading-none mt-0.5">{d.dayNum}</span>
                <span className="text-[9px] uppercase leading-none mt-0.5">{d.monthShort}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setDateScrollStart(Math.min(availableDates.length - visibleDates, dateScrollStart + visibleDates))}
          disabled={dateScrollStart + visibleDates >= availableDates.length}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          <FaChevronRight className="text-[10px]" />
        </button>
      </div>

      {/* Slots */}
      {selectedDate && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <FaClock className="text-[10px] text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Horarios disponibles</span>
          </div>

          {loadingSlots ? (
            <div className="text-center py-6 text-slate-400 text-xs">Cargando horarios...</div>
          ) : slots.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">No hay horarios disponibles este día</div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {slots.map(slot => {
                const isSelected = selected?.date === selectedDate && selected?.time === slot.time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => slot.available && handleSelectSlot(slot.time)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      !slot.available
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed line-through'
                        : isSelected
                        ? 'text-white shadow-md'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400'
                    }`}
                    style={isSelected ? { backgroundColor: buttonColor, color: buttonTextColor } : {}}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected summary */}
      {selected && (
        <div className="flex items-center gap-2 p-3 rounded-xl border-2" style={{ borderColor: buttonColor, backgroundColor: `${buttonColor}10` }}>
          <FaCalendarAlt className="text-sm" style={{ color: buttonColor }} />
          <span className="text-sm font-bold text-slate-800">
            Tu cita: {new Date(selected.dateTime).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} a las {selected.time}
          </span>
        </div>
      )}
    </div>
  );
}

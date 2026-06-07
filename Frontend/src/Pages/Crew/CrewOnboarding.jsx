import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import { useCrew } from './useCrew';

const SKILLS = [
  { key: 'mesero', label: 'Mesero' },
  { key: 'cocinero', label: 'Cocinero' },
  { key: 'barista', label: 'Barista' },
  { key: 'bartender', label: 'Bartender' },
  { key: 'cajero', label: 'Cajero' },
  { key: 'runner', label: 'Auxiliar de cocina' },
  { key: 'host', label: 'Anfitrión' },
  { key: 'parrillero', label: 'Parrillero' },
  { key: 'lavaplatos', label: 'Lavaplatos' },
  { key: 'panadero', label: 'Panadero' },
  { key: 'reposteria', label: 'Repostería' },
  { key: 'eventos', label: 'Eventos' },
  { key: 'delivery', label: 'Domiciliario' },
];

const DAYS = [
  { i: 1, label: 'Lunes' },
  { i: 2, label: 'Martes' },
  { i: 3, label: 'Miércoles' },
  { i: 4, label: 'Jueves' },
  { i: 5, label: 'Viernes' },
  { i: 6, label: 'Sábado' },
  { i: 0, label: 'Domingo' },
];

const PERIODS = [
  { key: 'morning', label: 'Mañana', range: '6:00 – 12:00' },
  { key: 'afternoon', label: 'Tarde', range: '12:00 – 18:00' },
  { key: 'evening', label: 'Noche', range: '18:00 – 23:00' },
  { key: 'night', label: 'Madrugada', range: '23:00 – 4:00' },
];

const CITIES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Cartagena', 'Otra'];

export default function CrewOnboarding({ onDone }) {
  const { refreshMe } = useCrew();
  const [step, setStep] = useState(0);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [availability, setAvailability] = useState({});
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [acceptsSOS, setAcceptsSOS] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleSkill = (key) =>
    setSelectedSkills((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  const toggleAvail = (day, period) => {
    setAvailability((c) => {
      const slots = c[day] || [];
      return { ...c, [day]: slots.includes(period) ? slots.filter((p) => p !== period) : [...slots, period] };
    });
  };

  const finish = async () => {
    setSaving(true);
    try {
      const periodMap = {
        morning: { from: '06:00', to: '12:00' },
        afternoon: { from: '12:00', to: '18:00' },
        evening: { from: '18:00', to: '23:00' },
        night: { from: '23:00', to: '04:00' },
      };
      const availSlots = [];
      for (const [day, periods] of Object.entries(availability)) {
        for (const p of periods) {
          availSlots.push({ dayOfWeek: Number(day), from: periodMap[p].from, to: periodMap[p].to });
        }
      }
      await crewApi.put('/workers/me', {
        skills: selectedSkills.map((key) => ({ key, level: 'principiante', yearsExp: 0 })),
        availability: availSlots,
        location: { city, neighborhood, maxRadiusKm: 8 },
        acceptsSOS,
      });
      await refreshMe();
      onDone?.();
    } catch (e) {
      alert(e?.response?.data?.message || 'No se pudo guardar tu perfil');
    } finally {
      setSaving(false);
    }
  };

  const canNext =
    step === 0
      ? selectedSkills.length > 0
      : step === 1
      ? Object.values(availability).some((v) => v.length > 0)
      : step === 2
      ? !!city
      : false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-geist pb-32">
      <header className="px-5 pt-6 pb-4 bg-white border-b border-slate-200">
        <div className="max-w-md mx-auto flex items-center justify-between mb-3">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-slate-400 hover:text-slate-700 disabled:opacity-0 transition"
            aria-label="Atrás"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-[11px] font-bold text-slate-400 tabular-nums">Paso {step + 1} de 3</span>
          <div className="w-5" />
        </div>
        <div className="max-w-md mx-auto h-1 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / 3) * 100}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      </header>

      <main className="px-5 pt-6 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
              <h1 className="text-[22px] font-extrabold leading-tight">¿En qué áreas tienes experiencia?</h1>
              <p className="text-[13px] text-slate-500 mt-1.5">Selecciona todas las que apliquen. Podrás ajustarlas después.</p>

              <div className="grid grid-cols-2 gap-2 mt-5">
                {SKILLS.map((s) => {
                  const on = selectedSkills.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleSkill(s.key)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        on
                          ? 'bg-red-50 border-red-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`text-[13px] font-semibold ${on ? 'text-red-700' : 'text-slate-700'}`}>{s.label}</p>
                        {on && (
                          <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-center text-[11px] text-slate-400 mt-4">
                {selectedSkills.length === 0
                  ? 'Selecciona al menos una opción para continuar'
                  : `${selectedSkills.length} ${selectedSkills.length === 1 ? 'área seleccionada' : 'áreas seleccionadas'}`}
              </p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
              <h1 className="text-[22px] font-extrabold leading-tight">Tu disponibilidad</h1>
              <p className="text-[13px] text-slate-500 mt-1.5">Indica en qué días y horarios estás disponible para trabajar.</p>

              <div className="space-y-2.5 mt-5">
                {DAYS.map((d) => (
                  <div key={d.i} className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-[12px] font-bold text-slate-700 mb-2">{d.label}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PERIODS.map((p) => {
                        const on = (availability[d.i] || []).includes(p.key);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => toggleAvail(d.i, p.key)}
                            className={`py-1.5 rounded-lg text-[11px] font-semibold transition ${
                              on
                                ? 'bg-red-50 text-red-700 border border-red-300'
                                : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-slate-300'
                            }`}
                            title={p.range}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <label className="mt-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptsSOS}
                  onChange={(e) => setAcceptsSOS(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-red-600"
                />
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-amber-900">Acepto turnos de último minuto</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Estos turnos tienen una bonificación adicional. Los recibirás como notificación con prioridad.
                  </p>
                </div>
              </label>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
              <h1 className="text-[22px] font-extrabold leading-tight">¿Dónde te encuentras?</h1>
              <p className="text-[13px] text-slate-500 mt-1.5">Te mostraremos los turnos disponibles cerca a tu ubicación.</p>

              <div className="space-y-4 mt-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Ciudad</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CITIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCity(c)}
                        className={`py-2.5 rounded-xl text-[13px] font-semibold transition ${
                          city === c
                            ? 'bg-red-50 text-red-700 border border-red-300'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Localidad o barrio (opcional)</label>
                  <input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Ej: Chapinero, El Poblado, Granada..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-[13px] font-bold text-emerald-800">Todo listo para comenzar</p>
                <p className="text-[12px] text-emerald-700 mt-1 leading-relaxed">
                  Al terminar este registro accederás al listado de turnos disponibles. Cada turno completado suma a tu historial profesional.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <div className="fixed bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-10">
        <div className="max-w-md mx-auto">
          {step < 2 ? (
            <motion.button
              whileTap={canNext ? { scale: 0.98 } : undefined}
              onClick={() => setStep((s) => Math.min(2, s + 1))}
              disabled={!canNext}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-[14px] shadow-lg shadow-red-500/25 disabled:opacity-40 transition-all"
            >
              Continuar
            </motion.button>
          ) : (
            <motion.button
              whileTap={canNext ? { scale: 0.98 } : undefined}
              onClick={finish}
              disabled={!canNext || saving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-[14px] shadow-lg shadow-red-500/25 disabled:opacity-40 transition-all"
            >
              {saving ? 'Guardando…' : 'Finalizar registro'}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

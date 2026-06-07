import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import { useCrew } from './useCrew';

const SKILLS = [
  { key: 'mesero', label: 'Mesero', emoji: '🍽️' },
  { key: 'cocinero', label: 'Cocinero', emoji: '👨‍🍳' },
  { key: 'barista', label: 'Barista', emoji: '☕' },
  { key: 'bartender', label: 'Bartender', emoji: '🍸' },
  { key: 'cajero', label: 'Cajero', emoji: '💵' },
  { key: 'runner', label: 'Runner', emoji: '🏃' },
  { key: 'host', label: 'Host/Hostess', emoji: '🙋' },
  { key: 'parrillero', label: 'Parrillero', emoji: '🔥' },
  { key: 'lavaplatos', label: 'Lavaplatos', emoji: '🧽' },
  { key: 'panadero', label: 'Panadero', emoji: '🥖' },
  { key: 'reposteria', label: 'Repostería', emoji: '🧁' },
  { key: 'eventos', label: 'Eventos', emoji: '🎉' },
  { key: 'delivery', label: 'Delivery', emoji: '🛵' },
];

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const CITIES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Cartagena', 'Otra'];

export default function CrewOnboarding({ onDone }) {
  const { refreshMe } = useCrew();
  const [step, setStep] = useState(0);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [availability, setAvailability] = useState({}); // { 0: ['morning','evening'], ... }
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [acceptsSOS, setAcceptsSOS] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleSkill = (key) => {
    setSelectedSkills((curr) => curr.includes(key) ? curr.filter(k => k !== key) : [...curr, key]);
  };

  const toggleAvail = (day, period) => {
    setAvailability((curr) => {
      const slots = curr[day] || [];
      return { ...curr, [day]: slots.includes(period) ? slots.filter(p => p !== period) : [...slots, period] };
    });
  };

  const finish = async () => {
    setSaving(true);
    try {
      // Convertir availability simplificada a slots
      const availSlots = [];
      const periodMap = {
        morning: { from: '06:00', to: '12:00' },
        afternoon: { from: '12:00', to: '18:00' },
        evening: { from: '18:00', to: '23:00' },
        night: { from: '23:00', to: '04:00' },
      };
      for (const [day, periods] of Object.entries(availability)) {
        for (const p of periods) {
          availSlots.push({ dayOfWeek: Number(day), from: periodMap[p].from, to: periodMap[p].to });
        }
      }
      await crewApi.put('/workers/me', {
        skills: selectedSkills.map(key => ({ key, level: 'principiante', yearsExp: 0 })),
        availability: availSlots,
        location: { city, neighborhood, maxRadiusKm: 8 },
        acceptsSOS,
      });
      await refreshMe();
      onDone?.();
    } catch (e) {
      alert(e?.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const next = () => setStep((s) => Math.min(2, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const canNext =
    step === 0 ? selectedSkills.length > 0 :
    step === 1 ? Object.values(availability).some(v => v.length > 0) :
    step === 2 ? !!city :
    false;

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white font-geist relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-[#7B2FFF] opacity-20 blur-[120px] rounded-full pointer-events-none" />

      {/* Progress dots */}
      <div className="px-5 pt-8 pb-4 flex items-center justify-between">
        <button
          onClick={back}
          disabled={step === 0}
          className="text-white/40 hover:text-white disabled:opacity-0 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="flex items-center gap-1.5">
          {[0,1,2].map((i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${
              i === step ? 'w-8 bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35]' : 'w-1.5 bg-white/15'
            }`} />
          ))}
        </div>
        <span className="text-[11px] font-bold text-white/40 tabular-nums">{step + 1}/3</span>
      </div>

      <main className="px-5 pb-32 relative">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="skills"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="text-[26px] font-extrabold leading-tight mb-1">¿En qué te ves trabajando?</h1>
              <p className="text-[13px] text-white/50 mb-6">Elige todo lo que te late. Mínimo 1.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {SKILLS.map((s) => {
                  const on = selectedSkills.includes(s.key);
                  return (
                    <motion.button
                      key={s.key}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleSkill(s.key)}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        on
                          ? 'bg-gradient-to-br from-[#7B2FFF]/25 to-[#FF6B35]/25 border-[#7B2FFF]/50 shadow-[0_4px_20px_rgba(123,47,255,0.25)]'
                          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="text-[26px] mb-1">{s.emoji}</div>
                      <p className="text-[13px] font-bold">{s.label}</p>
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-[11px] text-white/30 text-center mt-4">
                {selectedSkills.length === 0 ? 'Toca cards para elegir' : `${selectedSkills.length} skill${selectedSkills.length > 1 ? 's' : ''} elegido${selectedSkills.length > 1 ? 's' : ''}`}
              </p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="avail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="text-[26px] font-extrabold leading-tight mb-1">¿Cuándo vibras?</h1>
              <p className="text-[13px] text-white/50 mb-6">Toca los bloques cuando puedes trabajar.</p>

              <div className="space-y-2.5">
                {DAYS.map((d, idx) => (
                  <div key={d} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3">
                    <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">{d}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { key: 'morning', label: 'Mañana', emoji: '🌅' },
                        { key: 'afternoon', label: 'Tarde', emoji: '☀️' },
                        { key: 'evening', label: 'Noche', emoji: '🌙' },
                        { key: 'night', label: 'Madrugada', emoji: '🌃' },
                      ].map((p) => {
                        const on = (availability[idx] || []).includes(p.key);
                        return (
                          <motion.button
                            key={p.key}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => toggleAvail(idx, p.key)}
                            className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                              on
                                ? 'bg-gradient-to-br from-[#7B2FFF]/30 to-[#FF6B35]/30 text-white border border-[#7B2FFF]/50'
                                : 'bg-white/[0.03] text-white/50 border border-white/[0.05]'
                            }`}
                          >
                            <div className="text-[14px]">{p.emoji}</div>
                            {p.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <label className="mt-5 flex items-center gap-3 p-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/25 rounded-2xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptsSOS}
                  onChange={(e) => setAcceptsSOS(e.target.checked)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <p className="text-[13px] font-bold flex items-center gap-2">🚨 Soy Hero — acepto SOS</p>
                  <p className="text-[11px] text-white/50 mt-0.5">Turnos de último minuto con bonus de pago. Desbloquea badge único.</p>
                </div>
              </label>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="loc"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="text-[26px] font-extrabold leading-tight mb-1">¿Dónde te movés?</h1>
              <p className="text-[13px] text-white/50 mb-6">Para mostrarte turnos cerca.</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Ciudad</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CITIES.map((c) => (
                      <motion.button
                        key={c}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setCity(c)}
                        className={`py-3 px-3 rounded-xl text-[13px] font-bold transition-all ${
                          city === c
                            ? 'bg-gradient-to-br from-[#7B2FFF]/30 to-[#FF6B35]/30 border border-[#7B2FFF]/50'
                            : 'bg-white/[0.03] border border-white/[0.08]'
                        }`}
                      >
                        {c}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Barrio (opcional)</label>
                  <input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Chapinero, El Poblado..."
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[15px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#7B2FFF]/60 transition"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-br from-[#4CFFB8]/10 to-cyan-500/10 border border-[#4CFFB8]/25 rounded-2xl">
                <p className="text-[13px] font-bold text-[#4CFFB8] mb-1">🎁 Listo para arrancar</p>
                <p className="text-[12px] text-white/60 leading-relaxed">
                  Tu primer turno completado = badge <strong>First Shift</strong> + 25 XP/hora trabajada.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Fixed footer button */}
      <div className="fixed bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-[#0A0A14] via-[#0A0A14] to-transparent pt-12">
        {step < 2 ? (
          <motion.button
            whileTap={canNext ? { scale: 0.97 } : undefined}
            onClick={next}
            disabled={!canNext}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] text-white font-extrabold text-[15px] shadow-[0_8px_30px_rgba(123,47,255,0.4)] disabled:opacity-40 transition-all"
          >
            Siguiente →
          </motion.button>
        ) : (
          <motion.button
            whileTap={canNext ? { scale: 0.97 } : undefined}
            onClick={finish}
            disabled={!canNext || saving}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] text-white font-extrabold text-[15px] shadow-[0_8px_30px_rgba(123,47,255,0.4)] disabled:opacity-40 transition-all"
          >
            {saving ? 'Guardando…' : 'Empezar a vibrar 🚀'}
          </motion.button>
        )}
      </div>
    </div>
  );
}

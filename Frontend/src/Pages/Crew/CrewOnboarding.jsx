import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import { useCrew } from './useCrew';
import Aurora, { Sparkles } from './components/Aurora';
import GradientText from './components/GradientText';
import GlowButton from './components/GlowButton';

const SKILLS = [
  { key: 'mesero', label: 'Mesero', icon: '🍽️' },
  { key: 'cocinero', label: 'Cocinero', icon: '👨‍🍳' },
  { key: 'barista', label: 'Barista', icon: '☕' },
  { key: 'bartender', label: 'Bartender', icon: '🍸' },
  { key: 'cajero', label: 'Cajero', icon: '💰' },
  { key: 'runner', label: 'Auxiliar de cocina', icon: '🔪' },
  { key: 'host', label: 'Anfitrión', icon: '🎙️' },
  { key: 'parrillero', label: 'Parrillero', icon: '🔥' },
  { key: 'lavaplatos', label: 'Lavaplatos', icon: '🫧' },
  { key: 'panadero', label: 'Panadero', icon: '🥖' },
  { key: 'reposteria', label: 'Repostería', icon: '🧁' },
  { key: 'eventos', label: 'Eventos', icon: '🎉' },
  { key: 'delivery', label: 'Domiciliario', icon: '🛵' },
];

const DAYS = [
  { i: 1, label: 'Lun', full: 'Lunes' },
  { i: 2, label: 'Mar', full: 'Martes' },
  { i: 3, label: 'Mié', full: 'Miércoles' },
  { i: 4, label: 'Jue', full: 'Jueves' },
  { i: 5, label: 'Vie', full: 'Viernes' },
  { i: 6, label: 'Sáb', full: 'Sábado' },
  { i: 0, label: 'Dom', full: 'Domingo' },
];

const PERIODS = [
  { key: 'morning', label: 'Mañana', range: '6 – 12h', icon: '🌅' },
  { key: 'afternoon', label: 'Tarde', range: '12 – 18h', icon: '☀️' },
  { key: 'evening', label: 'Noche', range: '18 – 23h', icon: '🌙' },
  { key: 'night', label: 'Madrugada', range: '23 – 4h', icon: '🌃' },
];

const CITIES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Cartagena', 'Otra'];

const STEP_TITLES = [
  { heading: 'Tu experiencia', accent: 'experiencia', sub: 'Selecciona todas las áreas donde puedes trabajar.' },
  { heading: 'Tu disponibilidad', accent: 'disponibilidad', sub: 'Elige los horarios en los que puedes aceptar turnos.' },
  { heading: 'Tu ubicación', accent: 'ubicación', sub: 'Te conectaremos con restaurantes cercanos a ti.' },
];

const SLIDE = {
  initial: { opacity: 0, x: 30, filter: 'blur(6px)' },
  animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, x: -30, filter: 'blur(6px)' },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
};

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

  const stepInfo = STEP_TITLES[step];

  return (
    <div className="relative min-h-screen font-geist text-white overflow-hidden">
      <Aurora variant="default" />
      <Sparkles count={14} />

      {/* Header */}
      <header className="relative z-10 px-5 pt-6 pb-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.10] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.10] disabled:opacity-0 transition-all"
              aria-label="Atrás"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    width: i === step ? 24 : 8,
                    backgroundColor: i <= step ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.15)',
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  className="h-2 rounded-full"
                  style={{ boxShadow: i === step ? '0 0 12px rgba(239,68,68,0.5)' : 'none' }}
                />
              ))}
            </div>
            <span className="text-[11px] font-bold text-white/40 tabular-nums">{step + 1}/3</span>
          </div>

          {/* Progress bar glow */}
          <div className="relative h-1 bg-white/[0.08] rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 via-orange-500 to-amber-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / 3) * 100}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.div
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-y-0 w-1/5 bg-gradient-to-r from-transparent via-white/60 to-transparent"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 px-5 pt-2 pb-36 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {/* Step header — always rendered from stepInfo */}
          <motion.div key={`title-${step}`} {...SLIDE} className="mb-5">
            <h1 className="text-[28px] sm:text-[32px] font-black leading-[1.08] tracking-tight">
              {stepInfo.heading.split(stepInfo.accent).map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <GradientText variant="sunrise">{stepInfo.accent}</GradientText>}
                </span>
              ))}
            </h1>
            <p className="text-[13px] text-white/50 mt-2 leading-relaxed">{stepInfo.sub}</p>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s1" {...SLIDE}>
              <div className="grid grid-cols-2 gap-2.5">
                {SKILLS.map((s, i) => {
                  const on = selectedSkills.includes(s.key);
                  return (
                    <motion.button
                      key={s.key}
                      type="button"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.3 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => toggleSkill(s.key)}
                      className={`relative p-3.5 rounded-2xl border text-left transition-all overflow-hidden ${
                        on
                          ? 'bg-red-500/[0.15] border-red-500/50 shadow-[0_0_20px_-4px_rgba(239,68,68,0.3)]'
                          : 'bg-white/[0.04] border-white/[0.10] hover:border-white/[0.20] hover:bg-white/[0.06]'
                      }`}
                    >
                      {on && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />}
                      <div className="flex items-center gap-2.5">
                        <span className="text-[18px]">{s.icon}</span>
                        <p className={`text-[13px] font-bold flex-1 ${on ? 'text-white' : 'text-white/70'}`}>{s.label}</p>
                        {on && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-md"
                          >
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          </motion.span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-center text-[11px] text-white/35 mt-4 font-medium">
                {selectedSkills.length === 0
                  ? 'Selecciona al menos una para continuar'
                  : `${selectedSkills.length} ${selectedSkills.length === 1 ? 'área seleccionada' : 'áreas seleccionadas'}`}
              </p>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s2" {...SLIDE}>
              <div className="space-y-3">
                {DAYS.map((d, di) => {
                  const slots = availability[d.i] || [];
                  return (
                    <motion.div
                      key={d.i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: di * 0.04 }}
                      className="rounded-2xl border border-white/[0.10] bg-white/[0.04] p-3.5 backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-[13px] font-bold text-white/90">{d.full}</p>
                        {slots.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-[10px] font-bold text-red-300 tabular-nums">
                            {slots.length} {slots.length === 1 ? 'franja' : 'franjas'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {PERIODS.map((p) => {
                          const on = slots.includes(p.key);
                          return (
                            <motion.button
                              key={p.key}
                              type="button"
                              whileTap={{ scale: 0.94 }}
                              onClick={() => toggleAvail(d.i, p.key)}
                              className={`py-2 rounded-xl text-center transition-all ${
                                on
                                  ? 'bg-gradient-to-br from-red-500/30 to-orange-500/20 border border-red-500/50 text-white shadow-[0_0_12px_-4px_rgba(239,68,68,0.3)]'
                                  : 'bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/[0.15]'
                              }`}
                              title={p.range}
                            >
                              <span className="text-[12px] block">{p.icon}</span>
                              <span className="text-[10px] font-bold block mt-0.5">{p.label}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <motion.label
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-5 flex items-start gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] cursor-pointer backdrop-blur-sm"
              >
                <input
                  type="checkbox"
                  checked={acceptsSOS}
                  onChange={(e) => setAcceptsSOS(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-amber-500 rounded"
                />
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-amber-200">Acepto turnos de último minuto</p>
                  <p className="text-[11px] text-amber-300/60 mt-0.5 leading-relaxed">
                    Turnos con bonificación extra. Te llegarán con prioridad.
                  </p>
                </div>
                <span className="text-[18px] animate-pulse">⚡</span>
              </motion.label>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s3" {...SLIDE}>
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-extrabold text-white/40 uppercase tracking-[0.15em] mb-2.5">Ciudad</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CITIES.map((c) => (
                      <motion.button
                        key={c}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setCity(c)}
                        className={`py-3 rounded-2xl text-[13px] font-bold transition-all ${
                          city === c
                            ? 'bg-gradient-to-br from-red-500/20 to-orange-500/15 border border-red-500/50 text-white shadow-[0_0_20px_-6px_rgba(239,68,68,0.35)]'
                            : 'bg-white/[0.04] text-white/60 border border-white/[0.10] hover:border-white/[0.20] hover:text-white'
                        }`}
                      >
                        {c}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-extrabold text-white/40 uppercase tracking-[0.15em] mb-2.5">Barrio (opcional)</p>
                  <input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Ej: Chapinero, El Poblado, Granada..."
                    className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.10] rounded-2xl text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:border-red-500/60 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.1)] transition-all"
                  />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="text-[20px]">🚀</span>
                  <div>
                    <p className="text-[13px] font-bold text-emerald-300">Casi listo para empezar</p>
                    <p className="text-[12px] text-emerald-300/60 mt-1 leading-relaxed">
                      Cada turno completado suma a tu historial profesional y sube tu nivel.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-5 pb-6 pt-12 bg-gradient-to-t from-[#0a0a14] via-[#0a0a14]/95 to-transparent">
        <div className="max-w-md mx-auto">
          {step < 2 ? (
            <GlowButton
              size="lg"
              variant="primary"
              fullWidth
              disabled={!canNext}
              onClick={() => setStep((s) => Math.min(2, s + 1))}
              iconRight={
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                </svg>
              }
            >
              Continuar
            </GlowButton>
          ) : (
            <GlowButton
              size="lg"
              variant="primary"
              fullWidth
              disabled={!canNext}
              loading={saving}
              onClick={finish}
              iconRight={
                !saving && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )
              }
            >
              {saving ? 'Guardando…' : 'Empezar a explorar'}
            </GlowButton>
          )}
        </div>
      </div>
    </div>
  );
}

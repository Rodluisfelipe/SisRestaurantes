/**
 * CrewLanding — pre-login pitch para el trabajador.
 *
 * Decisiones de diseño:
 *   - Logo real (CrewLogo) como ancla visual del hero, no un placeholder
 *   - Layout asimétrico tipo bento, no grids 3-col repetidos
 *   - Ticker en vivo de turnos (mock con autorotación) para dar señal de actividad
 *   - Calculadora interactiva (no estática) para que el visitante "juegue" con su ingreso
 *   - Testimonio integrado en el flujo, no como sección separada
 *   - Camino de progresión visual con niveles reales (Level 1→20)
 *   - Una sola CTA dominante; sin trust strips ni FAQ que diluyen
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CrewLogo from './CrewLogo';

const TICKER_FEED = [
  { who: 'Andrés', role: 'Mesero', biz: 'Andrés Carne de Res', pay: 85000, when: 'hace 3 min', city: 'Bogotá' },
  { who: 'Catalina', role: 'Barista', biz: 'Café San Alberto', pay: 72000, when: 'hace 7 min', city: 'Medellín' },
  { who: 'Diego', role: 'Auxiliar evento', biz: 'Boda Andrea & Luis', pay: 110000, when: 'hace 14 min', city: 'Cali' },
  { who: 'Mariana', role: 'Cajera', biz: 'Pizzería La Otra', pay: 64000, when: 'hace 22 min', city: 'Bogotá' },
  { who: 'Sebastián', role: 'Bartender', biz: 'Hotel Casa Quero', pay: 130000, when: 'hace 31 min', city: 'Cartagena' },
];

export default function CrewLanding({ onEnter }) {
  return (
    <div className="relative bg-[#08080f] text-white font-geist overflow-x-hidden">
      {/* Capa global de glow rojo que se mueve con el scroll */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <motion.div
          animate={{ x: [0, 60, 0], y: [0, -30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-20 right-[-15%] w-[640px] h-[640px] bg-red-600/25 rounded-full blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[40%] left-[-15%] w-[520px] h-[520px] bg-orange-600/15 rounded-full blur-[140px]"
        />
        {/* Grid sutil tipo blueprint */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)',
        }} />
      </div>

      {/* Top bar — minimal */}
      <header className="relative px-5 sm:px-8 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CrewLogo size={36} showText={false} />
          <span className="text-[15px] font-black tracking-tight">crew</span>
        </div>
        <button
          onClick={onEnter}
          className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-white/60 hover:text-white px-3 py-1.5 transition"
        >
          Iniciar sesión →
        </button>
      </header>

      {/* HERO — asimétrico, logo gigante a la izquierda, copy a la derecha */}
      <section className="relative px-5 sm:px-8 pt-6 pb-16 sm:pt-12 sm:pb-24">
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-16 items-center">
          {/* Logo + glow visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center justify-center order-2 lg:order-1"
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1], rotate: [0, -2, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="relative"
            >
              <div className="absolute inset-0 bg-red-500/40 blur-[80px] -z-10 rounded-full" />
              <CrewLogo size={260} showText={false} className="sm:hidden" />
              <CrewLogo size={360} showText={false} className="hidden sm:block" />
            </motion.div>
            {/* Orbiting badges */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 pointer-events-none"
            >
              <OrbitBadge angle={0} label="+85K" />
              <OrbitBadge angle={90} label="Nivel 7" />
              <OrbitBadge angle={180} label="🔥 racha 5d" />
              <OrbitBadge angle={270} label="4.9★" />
            </motion.div>
          </motion.div>

          {/* Copy */}
          <div className="order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <p className="text-[11px] sm:text-[12px] font-black uppercase tracking-[0.3em] text-red-400 mb-4">
                Trabaja por turnos
              </p>
              <h1 className="text-[40px] sm:text-[58px] lg:text-[68px] font-black leading-[0.95] tracking-tight">
                Tu trabajo.
                <br />
                Tu plata.
                <br />
                <span className="bg-gradient-to-r from-red-400 via-orange-400 to-amber-300 bg-clip-text text-transparent">
                  Tu juego.
                </span>
              </h1>
              <p className="text-[15px] sm:text-[17px] text-white/55 mt-6 max-w-md leading-relaxed">
                Postúlate a turnos en restaurantes, eventos, hoteles. Cobras el mismo día. Subes de nivel. Sin contratos.
              </p>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onEnter}
                className="group relative mt-8 inline-flex items-center gap-3 px-7 py-4 rounded-full bg-white text-black font-black text-[15px] shadow-[0_12px_40px_-8px_rgba(255,255,255,0.4)] overflow-hidden"
              >
                <span>Empezar gratis</span>
                <span className="relative w-6 h-6 rounded-full bg-black flex items-center justify-center transition-transform group-hover:translate-x-1">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                  </svg>
                </span>
              </motion.button>
              <p className="text-[11px] text-white/30 mt-3 ml-1">Crear cuenta · 2 min · 0 pesos para ti, siempre.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* TICKER EN VIVO de turnos publicados — da señal de actividad real */}
      <LiveTicker />

      {/* CALCULADORA — interactiva, no estática */}
      <Calculator onEnter={onEnter} />

      {/* TRATO CLARO — dos columnas con contraste fuerte */}
      <section className="relative px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-red-400 mb-3">El trato</p>
          <h2 className="text-[34px] sm:text-[50px] font-black leading-[0.95] tracking-tight max-w-2xl">
            Tú recibes el 100%.<br />
            Crew le cobra al negocio.
          </h2>
          <p className="text-[14px] text-white/50 mt-5 max-w-xl leading-relaxed">
            Cada peso que el empleador ofrece, llega a tu billetera. No descontamos comisión, propina, ni servicio. Esa es la regla.
          </p>

          <div className="mt-12 grid sm:grid-cols-2 gap-3">
            {/* Tu lado */}
            <div className="relative rounded-[28px] border border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.12] via-emerald-500/[0.04] to-transparent p-7 overflow-hidden">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-300">Tu lado</span>
              <p className="text-[28px] sm:text-[40px] font-black leading-[1.05] mt-2">
                $80.000<span className="text-[16px] text-white/50">/turno</span>
              </p>
              <p className="text-[13px] text-emerald-200/80 mt-1">Llegan completos a tu billetera</p>
              <ul className="mt-5 space-y-2">
                <DealItem ok>0% de comisión</DealItem>
                <DealItem ok>Retiro a Nequi/Daviplata</DealItem>
                <DealItem ok>Pago el mismo día</DealItem>
                <DealItem ok>Tus reseñas y XP son tuyos</DealItem>
              </ul>
            </div>

            {/* Lado empleador */}
            <div className="relative rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-7">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">Lado empleador</span>
              <p className="text-[28px] sm:text-[40px] font-black leading-[1.05] mt-2 text-white/50">
                $88.000<span className="text-[16px] text-white/30">/turno</span>
              </p>
              <p className="text-[13px] text-white/40 mt-1">Lo que paga el empleador (incluye 10% comisión Crew)</p>
              <ul className="mt-5 space-y-2">
                <DealItem>Tu pago: $80.000</DealItem>
                <DealItem>Comisión Crew: $8.000</DealItem>
                <DealItem>Plata bloqueada en escrow</DealItem>
                <DealItem>Solo se libera si llegas</DealItem>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIO — uno solo, grande, integrado */}
      <Testimonial />

      {/* EVOLUCIÓN — visual del progreso por niveles */}
      <Evolution />

      {/* CTA FINAL — corto y directo */}
      <section className="relative px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block relative mb-6">
              <div className="absolute inset-0 bg-red-500/40 blur-[60px] -z-10 rounded-full" />
              <CrewLogo size={100} showText={false} />
            </div>
            <h2 className="text-[36px] sm:text-[56px] font-black leading-[0.95] tracking-tight">
              Tu primer turno
              <br />
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                está esperando.
              </span>
            </h2>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onEnter}
              className="group inline-flex items-center gap-3 mt-9 px-8 py-4 rounded-full bg-white text-black font-black text-[16px] shadow-[0_12px_40px_-8px_rgba(255,255,255,0.4)]"
            >
              Quiero empezar
              <span className="w-6 h-6 rounded-full bg-black flex items-center justify-center transition-transform group-hover:translate-x-1">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                </svg>
              </span>
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Footer mínimo */}
      <footer className="relative px-5 sm:px-8 py-8 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/35">
          <div className="flex items-center gap-2">
            <CrewLogo size={20} showText={false} />
            <span className="font-bold">crew · {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://wa.me/573028181520" target="_blank" rel="noreferrer" className="hover:text-white transition">Soporte</a>
            <a href="/empleador" className="hover:text-white transition">¿Eres empleador? →</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Orbiting badge alrededor del logo ─── */
function OrbitBadge({ angle, label }) {
  return (
    <div
      className="absolute top-1/2 left-1/2 hidden sm:block"
      style={{
        transform: `rotate(${angle}deg) translateY(-220px) rotate(${-angle}deg) translate(-50%, -50%)`,
      }}
    >
      <div className="px-3 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.12] text-[11px] font-extrabold whitespace-nowrap">
        {label}
      </div>
    </div>
  );
}

function DealItem({ children, ok }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px]">
      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-emerald-400' : 'bg-white/30'}`} />
      <span className={ok ? 'text-white/90' : 'text-white/50'}>{children}</span>
    </li>
  );
}

/* ─── Ticker de turnos publicados (mock, autorotación) ─── */
function LiveTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % TICKER_FEED.length), 2800);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="relative px-5 sm:px-8 py-10 sm:py-12 border-y border-white/[0.05] bg-white/[0.015]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Turnos publicados ahora</span>
        </div>
        <div className="relative h-12 flex-1 w-full overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center gap-3 text-[13.5px]"
            >
              <span className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-[14px] font-black">
                {TICKER_FEED[idx].who[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">
                  <span className="text-white/90">{TICKER_FEED[idx].role}</span>
                  <span className="text-white/40"> · </span>
                  <span className="text-white/60">{TICKER_FEED[idx].biz}</span>
                </p>
                <p className="text-[11px] text-white/40">{TICKER_FEED[idx].city} · {TICKER_FEED[idx].when}</p>
              </div>
              <span className="shrink-0 text-emerald-300 font-black tabular-nums">
                {formatCOP(TICKER_FEED[idx].pay)}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ─── Calculadora de ingresos potenciales ─── */
function Calculator({ onEnter }) {
  const [hours, setHours] = useState(20);
  const [rate, setRate] = useState(13000);
  const monthly = useMemo(() => Math.round(hours * 4 * rate), [hours, rate]);

  return (
    <section className="relative px-5 sm:px-8 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-16 items-center">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-red-400 mb-3">¿Cuánto puedes ganar?</p>
          <h2 className="text-[34px] sm:text-[50px] font-black leading-[0.95] tracking-tight">
            Mueve los controles.
            <br />
            <span className="text-white/40">Nosotros corremos las cuentas.</span>
          </h2>
          <p className="text-[14px] text-white/50 mt-5 max-w-md leading-relaxed">
            La tarifa promedio en Bogotá es <strong className="text-white/80">$13.000/h</strong>. Con eventos urgentes (SOS) puede llegar a <strong className="text-white/80">$22.000/h</strong>.
          </p>
        </div>

        <div className="relative rounded-[28px] border border-white/[0.10] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-7 sm:p-8 backdrop-blur-sm overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/15 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative space-y-7">
            <Slider
              label="Horas a la semana"
              value={hours}
              min={5} max={60} step={1}
              onChange={setHours}
              suffix={`${hours}h`}
            />
            <Slider
              label="Tarifa por hora"
              value={rate}
              min={8000} max={25000} step={1000}
              onChange={setRate}
              suffix={formatCOP(rate)}
            />

            <div className="pt-6 border-t border-white/[0.08]">
              <p className="text-[10.5px] font-black uppercase tracking-[0.25em] text-white/40">Podrías ganar al mes</p>
              <motion.p
                key={monthly}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                className="text-[48px] sm:text-[64px] font-black leading-none tabular-nums mt-1 bg-gradient-to-r from-emerald-300 to-emerald-400 bg-clip-text text-transparent"
              >
                {formatCOP(monthly)}
              </motion.p>
              <p className="text-[11.5px] text-white/40 mt-2">100% para ti. Sin descuentos.</p>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onEnter}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-[12px] font-extrabold uppercase tracking-wider transition"
              >
                Quiero probar
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                </svg>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Slider({ label, value, min, max, step, onChange, suffix }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] font-black uppercase tracking-[0.18em] text-white/40">{label}</span>
        <span className="text-[14px] font-black text-white tabular-nums">{suffix}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full appearance-none h-1.5 rounded-full bg-white/[0.08] outline-none accent-red-500"
        style={{
          background: `linear-gradient(to right, #ef4444 0%, #f97316 ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.08) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </div>
  );
}

/* ─── Testimonio integrado ─── */
function Testimonial() {
  return (
    <section className="relative px-5 sm:px-8 py-20 sm:py-28 border-y border-white/[0.05]">
      <div className="max-w-4xl mx-auto">
        <div className="text-[120px] sm:text-[180px] font-black text-white/[0.04] leading-none -mb-12 sm:-mb-20 select-none" aria-hidden>
          “
        </div>
        <motion.blockquote
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative text-[24px] sm:text-[36px] font-black leading-[1.15] tracking-tight"
        >
          Trabajé <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">4 turnos en mi primera semana</span>. Pagué la matrícula del semestre con eso. Antes me la pasaba pidiendo prestado.
        </motion.blockquote>
        <div className="mt-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-[20px] font-black border-2 border-white/10">
            D
          </div>
          <div>
            <p className="text-[14px] font-extrabold">Diego, 22 años</p>
            <p className="text-[11px] text-white/50 uppercase tracking-wider">Mesero · Universitario · Nivel 6 en Crew</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Evolución de niveles ─── */
function Evolution() {
  const levels = [
    { lv: 1, label: 'Empiezas', desc: 'Tu primer turno', color: 'from-white/30 to-white/10' },
    { lv: 4, label: 'Activo', desc: 'Tienes reseñas', color: 'from-amber-400 to-orange-400' },
    { lv: 10, label: 'Profesional', desc: 'Turnos premium', color: 'from-red-400 to-rose-500' },
    { lv: 20, label: 'Senior', desc: 'Eventos VIP', color: 'from-fuchsia-400 to-violet-500' },
  ];
  return (
    <section className="relative px-5 sm:px-8 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-red-400 mb-3">Tu evolución</p>
        <h2 className="text-[34px] sm:text-[50px] font-black leading-[0.95] tracking-tight max-w-3xl">
          Cada turno suma.
          <br />
          <span className="text-white/40">Crew te conoce mejor con el tiempo.</span>
        </h2>

        <div className="mt-12 relative">
          {/* Línea base */}
          <div className="absolute left-0 right-0 top-[68px] h-px bg-gradient-to-r from-white/0 via-white/20 to-white/0 hidden sm:block" />
          <div className="grid sm:grid-cols-4 gap-4 sm:gap-6">
            {levels.map((l, i) => (
              <motion.div
                key={l.lv}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="relative"
              >
                <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${l.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <span className="text-[18px] font-black text-white">{l.lv}</span>
                </div>
                <p className="text-[15px] font-black">{l.label}</p>
                <p className="text-[11.5px] text-white/45 mt-0.5">{l.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Lo que destrabas */}
        <div className="mt-10 flex flex-wrap gap-2">
          {[
            '+25 XP por hora',
            'Badge "10 turnos"',
            'Boost en el feed',
            'Acceso turnos premium',
            'Reseñas verificables',
            'Match score más alto',
            'Compensación si cancelan',
          ].map((p) => (
            <span key={p} className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11.5px] font-bold text-white/65">
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

/**
 * CrewLanding — pantalla pre-login que explica qué es Crew para el trabajador.
 *
 * Estilo cosmic (oscuro con aurora animada), coherente con el resto de la app
 * del worker. Mobile-first, scroll fluido.
 *
 * Props:
 *   onEnter → ir al login del worker (sea para entrar o crear cuenta)
 */
import { useState } from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  {
    n: '1',
    emoji: '📱',
    title: 'Crea tu perfil',
    body: 'Foto, experiencia, áreas en las que sabes trabajar. Más completo, más turnos te llegan.',
  },
  {
    n: '2',
    emoji: '🔍',
    title: 'Explora turnos',
    body: 'Restaurantes, eventos, hoteles. Ves la fecha, las horas, el pago total. Cero sorpresas.',
  },
  {
    n: '3',
    emoji: '🚀',
    title: 'Postúlate',
    body: 'Tap, postulación enviada. El empleador ve tu perfil con tu nivel y calificación.',
  },
  {
    n: '4',
    emoji: '✅',
    title: 'Confirmas tu llegada',
    body: 'Al llegar al sitio, el empleador te da un código. Lo escribes en la app — eso es tu check-in oficial.',
  },
  {
    n: '5',
    emoji: '💰',
    title: 'Cobras al instante',
    body: 'Cuando el empleador confirma que terminaste, el dinero llega a tu billetera Crew en segundos.',
  },
  {
    n: '6',
    emoji: '🏦',
    title: 'Retira a Nequi',
    body: 'Saca tu plata a Nequi, Daviplata o cuenta bancaria cuando quieras. Mínimo $20.000.',
  },
];

const BENEFITS = [
  {
    emoji: '🛡',
    title: 'Pago garantizado',
    body: 'El empleador deja la plata reservada antes de publicar. Si llegaste y cumpliste, cobras sí o sí.',
  },
  {
    emoji: '⚡',
    title: 'Trabajas cuando quieras',
    body: 'Sin contratos. Sin horarios fijos. Eliges los turnos que se ajusten a tu vida.',
  },
  {
    emoji: '⭐',
    title: 'Sube de nivel',
    body: 'Cada turno completado te da XP, mejor calificación, badges y prioridad en el feed.',
  },
  {
    emoji: '💬',
    title: 'Chat directo',
    body: 'Coordina la llegada con el empleador desde la app. Sin tener que compartir tu número personal.',
  },
  {
    emoji: '🏆',
    title: 'Construye tu historial',
    body: 'Tu reputación se queda contigo. Cada turno suma a tu hoja de vida verificable.',
  },
  {
    emoji: '🎯',
    title: 'Misiones diarias',
    body: 'Postúlate, completa tu perfil, mantén una racha. Cada misión te da XP extra.',
  },
];

const EARNINGS = [
  { hours: 4, rate: 13000, label: 'Turno corto', emoji: '☕' },
  { hours: 6, rate: 15000, label: 'Turno medio', emoji: '🍽' },
  { hours: 8, rate: 16000, label: 'Turno completo', emoji: '🏨' },
];

const FAQ = [
  {
    q: '¿Cuánto cobran ustedes?',
    a: 'Nada. Cero. Tú recibes el 100% del valor del turno que publica el empleador. La comisión la paga el empleador, no tú.',
  },
  {
    q: '¿Cuándo me pagan?',
    a: 'En cuanto el empleador marca "terminado" en su app, el dinero llega a tu billetera Crew. Desde ahí puedes retirarlo a Nequi, Daviplata o cuenta bancaria en menos de 24h.',
  },
  {
    q: '¿Y si el empleador no quiere pagar después?',
    a: 'No puede. La plata ya estaba reservada desde que publicó el turno — Crew la tiene en escrow. Si cumpliste con el check-in, la plata se libera. Esa es la garantía.',
  },
  {
    q: '¿Qué pasa si llego y no me dejan trabajar?',
    a: 'Si el empleador cancela cuando ya hiciste check-in, te paga compensación completa igual. Si cancela menos de 2 horas antes, también. Estás protegido.',
  },
  {
    q: '¿Necesito experiencia previa?',
    a: 'No. Hay turnos para todos los niveles. Cuanta más experiencia y calificación tengas, más turnos premium te llegarán.',
  },
  {
    q: '¿En qué ciudades hay turnos?',
    a: 'Arrancamos en Bogotá, Medellín y Cali. Si tu ciudad no tiene actividad aún, regístrate igual — te avisamos cuando llegue.',
  },
];

export default function CrewLanding({ onEnter }) {
  return (
    <div className="relative min-h-[100dvh] bg-[#0a0a14] text-white font-geist overflow-x-hidden">
      {/* Aurora background fija */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -right-20 w-[500px] h-[500px] bg-red-500/15 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 -left-32 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[120px]"
        />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-[#0a0a14]/85 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-md shadow-red-500/30">
              <span className="text-[14px] font-black text-white">C</span>
            </div>
            <span className="text-[14px] font-black">Crew</span>
          </div>
          <button
            onClick={onEnter}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:brightness-110 text-white text-[12px] font-extrabold shadow-md shadow-red-500/30 transition"
          >
            Entrar
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-12 pb-14 sm:pt-20 sm:pb-20">
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/[0.10] border border-amber-400/30 text-[10px] font-extrabold uppercase tracking-wider text-amber-300 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Trabaja por turnos · Cobra el mismo día
            </span>
            <h1 className="text-[34px] sm:text-[52px] font-black leading-[1.05] tracking-tight">
              Tu próximo turno
              <br />
              <span className="bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                empieza acá.
              </span>
            </h1>
            <p className="text-[14.5px] sm:text-[16px] text-white/60 mt-5 max-w-xl mx-auto leading-relaxed">
              Restaurantes, hoteles, eventos. Postúlate desde tu celular y cobra al instante cuando terminas.
            </p>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onEnter}
              className="group relative mt-8 inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-extrabold text-[15px] shadow-xl shadow-red-500/40 overflow-hidden"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)' }} />
              <span className="relative">Empezar gratis</span>
              <svg className="relative w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
              </svg>
            </motion.button>
            <p className="text-[11px] text-white/35 mt-4">Crear cuenta toma 2 minutos · 100% gratis siempre</p>
          </motion.div>

          {/* Trust strip */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-bold text-white/35 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              Pago garantizado
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              0% comisión para ti
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              Retiro a Nequi
            </span>
          </div>
        </div>
      </section>

      {/* Earnings example */}
      <section className="relative px-5 py-12 sm:py-16 border-y border-white/[0.06] bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/35 mb-1.5">Lo que puedes ganar</p>
          <h2 className="text-center text-[24px] sm:text-[32px] font-black leading-tight">
            Tu plata, sin descuentos.
          </h2>
          <p className="text-center text-[13.5px] text-white/55 mt-2 max-w-xl mx-auto">
            El 100% de lo que ofrece el empleador llega a tu billetera. Nosotros le cobramos a él, no a ti.
          </p>

          <div className="mt-8 grid sm:grid-cols-3 gap-3">
            {EARNINGS.map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{e.emoji}</span>
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-white/40">{e.label}</span>
                </div>
                <p className="text-[12px] text-white/50">{e.hours}h × {formatCOP(e.rate)}/h</p>
                <p className="text-[28px] sm:text-[34px] font-black mt-1 tabular-nums bg-gradient-to-r from-emerald-300 to-emerald-400 bg-clip-text text-transparent">
                  {formatCOP(e.hours * e.rate)}
                </p>
                <p className="text-[11px] text-white/40 mt-1">Llegan completos a tu billetera</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative px-5 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/35 mb-1.5">Cómo funciona</p>
          <h2 className="text-center text-[24px] sm:text-[32px] font-black leading-tight">
            De crear cuenta a cobrar, en 6 pasos
          </h2>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 hover:border-white/[0.15] transition backdrop-blur-sm">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.10] flex items-center justify-center text-xl shrink-0">
                    {s.emoji}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-400">Paso {s.n}</span>
                    <p className="text-[15px] font-black leading-tight">{s.title}</p>
                  </div>
                </div>
                <p className="text-[12.5px] text-white/55 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="relative px-5 py-12 sm:py-16 border-y border-white/[0.06] bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/35 mb-1.5">Por qué Crew</p>
          <h2 className="text-center text-[24px] sm:text-[32px] font-black leading-tight">
            Hecho para que el trabajo sea justo.
          </h2>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BENEFITS.map((b, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-400/20 flex items-center justify-center text-xl mb-3">
                  {b.emoji}
                </div>
                <p className="text-[14px] font-black">{b.title}</p>
                <p className="text-[12.5px] text-white/55 mt-1.5 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative px-5 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/35 mb-1.5">Preguntas frecuentes</p>
          <h2 className="text-center text-[24px] sm:text-[32px] font-black leading-tight mb-8">
            Lo que más nos preguntan
          </h2>
          <div className="space-y-2.5">
            {FAQ.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-5 py-12 sm:py-16">
        <div className="relative max-w-3xl mx-auto rounded-3xl overflow-hidden border border-white/[0.10] p-8 sm:p-12 text-center bg-gradient-to-br from-red-500/[0.15] via-orange-500/[0.08] to-transparent">
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -10, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-20 -right-10 w-72 h-72 bg-red-500/30 rounded-full blur-[100px] pointer-events-none"
          />
          <div className="relative">
            <h2 className="text-[24px] sm:text-[32px] font-black leading-tight">
              Crea tu cuenta hoy.
              <br />
              <span className="bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                Trabaja esta semana.
              </span>
            </h2>
            <p className="text-[13.5px] text-white/65 mt-3 max-w-lg mx-auto leading-relaxed">
              Gratis siempre. Sin contratos. Sin comisión para ti.
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onEnter}
              className="group relative mt-6 inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white text-red-600 font-black text-[15px] shadow-xl overflow-hidden"
            >
              Empezar gratis
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
              </svg>
            </motion.button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative px-5 py-8 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/35">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">C</span>
            </div>
            <span className="font-bold">Crew by MenuBy · {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://wa.me/573028181520" target="_blank" rel="noreferrer" className="hover:text-white/80 transition font-bold">
              Soporte por WhatsApp
            </a>
            <a href="/empleador" className="hover:text-white/80 transition font-bold">
              ¿Eres empleador?
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] transition"
      >
        <span className="text-[13.5px] font-bold text-white/90 flex-1 min-w-0">{q}</span>
        <svg className={`w-4 h-4 text-white/40 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.2 }}
          className="px-4 pb-4 -mt-1"
        >
          <p className="text-[12.5px] text-white/55 leading-relaxed">{a}</p>
        </motion.div>
      )}
    </div>
  );
}

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

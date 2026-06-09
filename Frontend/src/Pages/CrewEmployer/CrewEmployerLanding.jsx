/**
 * CrewEmployerLanding — pantalla pre-login que explica qué es Crew para
 * negocios/personas: propuesta de valor, cómo funciona, precios, FAQ.
 *
 * Estilo claro MenuBy (blanco/slate/red). Mobile-first, scroll fluido,
 * CTAs siempre visibles.
 *
 * Props:
 *   onLogin     → ir a la pantalla de login
 *   onSignup    → ir al wizard de registro
 */
import { useState } from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  {
    n: '1',
    emoji: '✨',
    title: 'Crea tu cuenta',
    body: 'Elige si eres persona (eventos puntuales) o negocio (recurrente). En menos de 2 minutos.',
  },
  {
    n: '2',
    emoji: '💳',
    title: 'Recarga tu billetera',
    body: 'Paga con Llave Breve, Nequi o transferencia. Tu saldo queda como garantía del pago al trabajador.',
  },
  {
    n: '3',
    emoji: '📢',
    title: 'Publica el turno',
    body: 'Fecha, horas, cuántas personas necesitas, qué pagas por hora. Tu inversión se reserva automáticamente.',
  },
  {
    n: '4',
    emoji: '🤝',
    title: 'Acepta postulantes',
    body: 'Revisa el perfil, calificaciones, historial. Acepta a quien quieras y le aparece confirmado.',
  },
  {
    n: '5',
    emoji: '🔐',
    title: 'El día del turno',
    body: 'Le muestras un código de llegada que solo tú tienes. Sin código, no hay check-in. Garantiza presencia real.',
  },
  {
    n: '6',
    emoji: '✅',
    title: 'Marcas completado',
    body: 'El trabajador recibe su pago al instante en su billetera. Tú quedas tranquilo: solo pagas cuando se cumplió.',
  },
];

const BENEFITS = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
    title: 'Trabajadores verificados',
    body: 'Cada perfil pasa por validación de identidad. Ves su nivel, calificación promedio y turnos completados antes de aceptar.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: 'Pago protegido',
    body: 'Tu plata queda en escrow hasta que tú confirmas que se cumplió el turno. Si el trabajador no llega, no pierdes nada.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    title: 'Sin compromisos mensuales',
    body: 'No pagas suscripción ni cuota fija. Solo cobramos 10% sobre el turno completado (15% si es urgente).',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Recontrata fácil',
    body: 'A los trabajadores que te funcionaron los puedes volver a contratar con un clic. Ellos también prefieren clientes recurrentes.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    title: 'Chat directo en la app',
    body: 'Coordina hora de llegada, instrucciones, dudas. Sin compartir tu número personal y con historial de conversación.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: 'Modo SOS para urgencias',
    body: 'Marca tu turno como urgente y le aparece destacado a los trabajadores cercanos. Ideal para imprevistos del día.',
  },
];

const FAQ = [
  {
    q: '¿Qué tipos de negocios pueden publicar?',
    a: 'Restaurantes, cafés, bares, hoteles, catering, eventos, retail, salones de belleza, spas, clínicas, limpieza, mudanzas y más. También personas individuales que necesitan ayuda para eventos puntuales como bodas o fiestas.',
  },
  {
    q: '¿Cómo me protegen del incumplimiento?',
    a: 'Cada trabajador tiene un perfil verificable: nivel, calificación promedio, turnos completados, comentarios de clientes anteriores. El check-in solo se hace con un código que tú le entregas físicamente, así garantizamos presencia real. Si no se presenta, no liberas el pago.',
  },
  {
    q: '¿Cuánto cobran?',
    a: 'Comisión del 10% sobre el monto del turno completado. Si marcas el turno como urgente (SOS), sube a 15%. No hay mensualidades, ni cuota fija, ni cobros por publicar. Solo pagas cuando alguien completó tu turno.',
  },
  {
    q: '¿Y si necesito cancelar un turno?',
    a: 'Si cancelas con más de 24h de anticipación: 100% de devolución a tu billetera. Entre 2h y 24h: 50% de devolución. Menos de 2h: el trabajador recibe compensación porque ya iba camino al sitio. Las reglas son claras antes de publicar.',
  },
  {
    q: '¿Cómo se aprueba mi cuenta?',
    a: 'Revisamos los datos manualmente para garantizar la calidad del marketplace. Te avisamos en máximo 24 horas. Mientras tanto puedes explorar tu panel pero no publicar.',
  },
  {
    q: '¿En qué ciudades funciona?',
    a: 'Estamos arrancando en Bogotá, Medellín y Cali. Si tu ciudad no aparece, regístrate igual: te abrimos cuando tengamos suficiente comunidad de trabajadores.',
  },
];

export default function CrewEmployerLanding({ onLogin, onSignup }) {
  return (
    <div className="min-h-[100dvh] bg-white text-slate-800 font-geist">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500 flex items-center justify-center shadow-sm shadow-red-500/25">
              <span className="text-[14px] font-black text-white">C</span>
            </div>
            <span className="text-[14px] font-black text-slate-800">Crew · Empleadores</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onLogin} className="hidden sm:inline-flex text-[12px] font-extrabold uppercase tracking-wider text-slate-500 hover:text-slate-900 px-3 py-1.5 transition">
              Entrar
            </button>
            <button onClick={onSignup} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[12px] font-extrabold shadow-md shadow-red-500/25 transition">
              Registrarme
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-10 pb-12 sm:pt-16 sm:pb-16 overflow-hidden">
        {/* Soft gradient blobs */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-red-100 rounded-full blur-3xl opacity-60 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-100 rounded-full blur-3xl opacity-60 pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[10px] font-extrabold uppercase tracking-wider text-red-600 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Marketplace abierto para empleadores
            </span>
            <h1 className="text-[32px] sm:text-[48px] font-black text-slate-900 leading-[1.05] tracking-tight">
              Encuentra trabajadores
              <br />
              <span className="text-red-500">en minutos</span>, no en días.
            </h1>
            <p className="text-[14.5px] sm:text-[16px] text-slate-500 mt-5 max-w-xl mx-auto leading-relaxed">
              Publica un turno. Recibe postulantes verificados con calificación, historial y reputación. Paga solo cuando se cumplió.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 mt-7 max-w-md mx-auto">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onSignup}
                className="flex-1 px-6 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-[14px] shadow-md shadow-red-500/25 transition flex items-center justify-center gap-2"
              >
                Empezar gratis
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                </svg>
              </motion.button>
              <button
                onClick={onLogin}
                className="flex-1 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-[14px] border border-slate-200 transition"
              >
                Ya tengo cuenta
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              Sin mensualidades · Solo pagas 10% sobre turno completado
            </p>
          </motion.div>

          {/* Trust strip */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              Pago protegido
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              Personal verificado
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              Sin contratos
            </span>
          </div>
        </div>
      </section>

      {/* For who */}
      <section className="px-5 py-10 sm:py-12 bg-slate-50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-1.5">Para quién</p>
          <h2 className="text-center text-[24px] sm:text-[32px] font-black text-slate-900 leading-tight">
            Dos formas de usar Crew
          </h2>
          <p className="text-center text-[13.5px] text-slate-500 mt-2 max-w-xl mx-auto">
            Elige el tipo de cuenta que mejor se adapta a lo que necesitas.
          </p>

          <div className="mt-7 grid sm:grid-cols-2 gap-3">
            <UseCaseCard
              emoji="👤"
              title="Soy una persona"
              tagline="Para eventos puntuales"
              examples={[
                'Mi boda el sábado',
                'Cumpleaños grande este mes',
                'Mudanza el fin de semana',
                'Una mano para un trabajo de un día',
              ]}
              onSelect={onSignup}
            />
            <UseCaseCard
              emoji="🏢"
              title="Soy un negocio"
              tagline="Para contratación recurrente"
              examples={[
                'Restaurante / Café / Bar',
                'Hotel · Catering · Eventos',
                'Retail · Salón · Spa · Clínica',
                'Servicios (limpieza, mudanzas, etc.)',
              ]}
              onSelect={onSignup}
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-1.5">Cómo funciona</p>
          <h2 className="text-center text-[24px] sm:text-[32px] font-black text-slate-900 leading-tight">
            De publicar a tener gente trabajando, en 6 pasos
          </h2>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-xl shrink-0">
                    {s.emoji}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-500">Paso {s.n}</span>
                    <p className="text-[15px] font-black text-slate-900 leading-tight">{s.title}</p>
                  </div>
                </div>
                <p className="text-[12.5px] text-slate-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-5 py-12 sm:py-16 bg-slate-50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-1.5">Por qué Crew</p>
          <h2 className="text-center text-[24px] sm:text-[32px] font-black text-slate-900 leading-tight">
            Lo que recibes tú como empleador
          </h2>

          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BENEFITS.map((b, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-3">
                  {b.icon}
                </div>
                <p className="text-[14px] font-black text-slate-900">{b.title}</p>
                <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-5 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-1.5">Precios</p>
          <h2 className="text-center text-[24px] sm:text-[32px] font-black text-slate-900 leading-tight">
            Sin suscripciones. Sin sorpresas.
          </h2>
          <p className="text-center text-[13.5px] text-slate-500 mt-2 max-w-lg mx-auto">
            Pagas comisión solo cuando un turno se completa. Nada más.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 gap-3">
            <PriceCard
              label="Turno estándar"
              amount="10%"
              hint="del valor del turno publicado"
              body="Comisión sobre lo que pagas al trabajador. Reservada cuando publicas, cobrada cuando confirmas que se cumplió."
              tone="slate"
            />
            <PriceCard
              label="Turno urgente · SOS"
              amount="15%"
              hint="cuando necesitas a alguien YA"
              body="Aparece destacado en el feed y se notifica con prioridad a trabajadores disponibles. Ideal para imprevistos del día."
              tone="amber"
            />
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <div>
                <p className="text-[13.5px] font-black text-emerald-900">No cobramos mensualidades</p>
                <p className="text-[12px] text-emerald-700 mt-1 leading-relaxed">
                  Crear cuenta es gratis. Publicar es gratis. Solo nos pagas cuando tú nos pagas — solo si el trabajador cumplió.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-12 sm:py-16 bg-slate-50 border-t border-slate-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-1.5">Preguntas frecuentes</p>
          <h2 className="text-center text-[24px] sm:text-[32px] font-black text-slate-900 leading-tight mb-8">
            Lo que más nos preguntan
          </h2>
          <div className="space-y-2.5">
            {FAQ.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-12 sm:py-16">
        <div className="relative max-w-3xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-red-500 to-red-600 p-8 sm:p-12 text-center">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(255,255,255,0.2) 0%, transparent 50%)',
          }} />
          <div className="relative">
            <h2 className="text-[24px] sm:text-[32px] font-black text-white leading-tight">
              Publica tu primer turno hoy
            </h2>
            <p className="text-[13.5px] text-white/85 mt-2 max-w-lg mx-auto leading-relaxed">
              Crear cuenta es gratis. La aprobación toma máximo 24 horas. Después tú decides cuándo publicar.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 mt-6 max-w-md mx-auto">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onSignup}
                className="flex-1 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-red-600 font-black text-[14px] shadow-lg transition"
              >
                Empezar gratis
              </motion.button>
              <button
                onClick={onLogin}
                className="flex-1 px-6 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-[14px] border border-white/30 transition"
              >
                Ya tengo cuenta
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-8 border-t border-slate-200">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-red-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">C</span>
            </div>
            <span className="font-bold">Crew by MenuBy · {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://wa.me/573028181520" target="_blank" rel="noreferrer" className="hover:text-slate-700 transition font-bold">
              Soporte por WhatsApp
            </a>
            <a href="/" className="hover:text-slate-700 transition font-bold">
              menuby.tech
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function UseCaseCard({ emoji, title, tagline, examples, onSelect }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className="group text-left rounded-3xl border border-slate-200 bg-white p-6 hover:border-red-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-2xl shrink-0">
          {emoji}
        </div>
        <div>
          <p className="text-[16px] font-black text-slate-900 leading-tight">{title}</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{tagline}</p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {examples.map((e, i) => (
          <li key={i} className="flex items-center gap-2 text-[12.5px] text-slate-600">
            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            {e}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] font-extrabold text-red-500 uppercase tracking-wider flex items-center gap-1 group-hover:gap-1.5 transition-all">
        Empezar con este tipo
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </p>
    </motion.button>
  );
}

function PriceCard({ label, amount, hint, body, tone }) {
  const tones = {
    slate: { border: 'border-slate-200', label: 'text-slate-500', amount: 'text-slate-900', accent: 'bg-slate-100 text-slate-700' },
    amber: { border: 'border-amber-200', label: 'text-amber-700', amount: 'text-amber-700', accent: 'bg-amber-100 text-amber-800' },
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`rounded-3xl border bg-white p-6 ${t.border}`}>
      <p className={`text-[10px] font-extrabold uppercase tracking-wider ${t.label}`}>{label}</p>
      <p className={`text-[40px] font-black leading-none mt-1 ${t.amount}`}>{amount}</p>
      <p className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold rounded-full ${t.accent}`}>{hint}</p>
      <p className="text-[12.5px] text-slate-500 mt-4 leading-relaxed">{body}</p>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition"
      >
        <span className="text-[13.5px] font-bold text-slate-800 flex-1 min-w-0">{q}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
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
          <p className="text-[12.5px] text-slate-500 leading-relaxed">{a}</p>
        </motion.div>
      )}
    </div>
  );
}

/**
 * CrewEmployerLanding — pre-login pitch para el empleador.
 *
 * Decisiones de diseño (distintas del worker landing y del template "feature grid"):
 *   - Logo real (CrewLogo) presente, no placeholder
 *   - Hero split: copy izquierda, preview del producto real derecha (card turno + postulante)
 *   - "Cómo se siente" en vez de "Cómo funciona" — narrativa con 3 frames mock-up
 *   - Calculadora de costos interactiva con sliders
 *   - Breakdown visual del trato: lo que pagas / lo que protegemos / cuándo cobramos
 *   - Comparativa contra alternativas (sin Crew vs con Crew) en lugar de "Por qué Crew"
 *   - Sin FAQ accordion — una sola pregunta clave respondida en prosa
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import CrewLogo from '../Crew/CrewLogo';

export default function CrewEmployerLanding({ onLogin, onSignup }) {
  return (
    <div className="relative bg-white text-slate-900 font-geist overflow-x-hidden">
      {/* Top bar — minimal pero con logo real */}
      <header className="relative px-5 sm:px-8 pt-5 pb-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
            <CrewLogo size={28} showText={false} />
          </div>
          <div className="leading-tight">
            <span className="block text-[15px] font-black text-slate-900 tracking-tight">crew</span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">para empleadores</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onLogin}
            className="hidden sm:inline-flex text-[12px] font-extrabold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-900 px-3 py-2 transition"
          >
            Iniciar sesión
          </button>
          <button
            onClick={onSignup}
            className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-extrabold transition"
          >
            Empezar gratis
          </button>
        </div>
      </header>

      {/* HERO — split asimétrico: copy + preview real */}
      <section className="relative px-5 sm:px-8 pt-10 sm:pt-16 pb-16">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p className="inline-flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.2em] text-slate-500 mb-5">
                <span className="w-6 h-px bg-red-500" /> Marketplace de turnos
              </p>
              <h1 className="text-[44px] sm:text-[68px] lg:text-[80px] font-black leading-[0.92] tracking-[-0.02em] text-slate-900">
                Publica.
                <br />
                Recibe gente.
                <br />
                <span className="text-red-500">Paga al final.</span>
              </h1>
              <p className="text-[15px] sm:text-[17px] text-slate-500 mt-6 max-w-md leading-relaxed">
                Tu plata queda como garantía en escrow. El trabajador solo cobra si llegó con el código que tú le diste.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onSignup}
                  className="group inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-black text-[14px] transition"
                >
                  Crear cuenta
                  <span className="w-5 h-5 rounded-full bg-white text-slate-900 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                    </svg>
                  </span>
                </motion.button>
                <button
                  onClick={onLogin}
                  className="px-6 py-3.5 rounded-full bg-white text-slate-700 hover:text-slate-900 font-extrabold text-[14px] border-2 border-slate-200 hover:border-slate-400 transition"
                >
                  Ya tengo cuenta
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
                Sin mensualidades · 10% sobre turno completado · Aprobación &lt; 24h
              </p>
            </motion.div>
          </div>

          {/* PRODUCT PREVIEW — card real de un postulante */}
          <ProductPreview />
        </div>
      </section>

      {/* PROOF BAR — números, no claims */}
      <section className="relative px-5 sm:px-8 py-10 sm:py-14 border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-3 gap-6 sm:gap-12">
          <ProofItem big="< 24h" small="Tiempo de aprobación de cuenta" />
          <ProofItem big="$0" small="Mensualidad. Solo pagas si se cumplió." />
          <ProofItem big="100%" small="Pago protegido por escrow" />
        </div>
      </section>

      {/* CÓMO SE SIENTE — 3 mock frames del flujo */}
      <section className="relative px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
              <span className="w-6 h-px bg-red-500" /> El recorrido
            </p>
            <h2 className="text-[36px] sm:text-[54px] font-black leading-[0.95] tracking-[-0.02em] text-slate-900">
              Así se ve publicar
              <br />
              <span className="text-slate-400">un turno en Crew.</span>
            </h2>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6 lg:gap-8">
            <Frame
              n="01"
              title="Llenas el turno"
              body="Cargo, fecha, horas, pago. Te calculamos el costo exacto antes de confirmar."
              mock={<MockPublish />}
            />
            <Frame
              n="02"
              title="Te llegan postulantes"
              body="Ves nivel, calificación, turnos hechos, comentarios de otros clientes. Aceptas a quien quieras."
              mock={<MockApplicants />}
            />
            <Frame
              n="03"
              title="Llegó. Le das el código."
              body="Sin código no hay check-in. Cuando termina, marcas pagado y la plata vuela a su billetera."
              mock={<MockCheckin />}
            />
          </div>
        </div>
      </section>

      {/* CALCULADORA — interactiva */}
      <Cost />

      {/* COMPARATIVA — sin Crew vs con Crew */}
      <section className="relative px-5 sm:px-8 py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
              <span className="w-6 h-px bg-red-500" /> Antes y después
            </p>
            <h2 className="text-[36px] sm:text-[54px] font-black leading-[0.95] tracking-[-0.02em]">
              La diferencia es práctica,
              <br />
              <span className="text-slate-400">no marketing.</span>
            </h2>
          </div>

          <div className="mt-12 grid lg:grid-cols-2 gap-3">
            {/* Sin Crew */}
            <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-3">Hoy, sin Crew</p>
              <ul className="space-y-3.5">
                <BadItem>Llamas amigos a las 6 a.m. para cubrir el turno</BadItem>
                <BadItem>No sabes si la persona va a llegar o no</BadItem>
                <BadItem>Pagas en efectivo, sin rastro ni constancia</BadItem>
                <BadItem>Si no llega, perdiste el día y no hay protección</BadItem>
                <BadItem>Sin historial: si fue bueno, no lo encuentras al mes</BadItem>
              </ul>
            </div>
            {/* Con Crew */}
            <div className="rounded-3xl border-2 border-red-500 bg-gradient-to-br from-red-50 to-white p-8 shadow-lg shadow-red-500/10">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500 mb-3">Con Crew</p>
              <ul className="space-y-3.5">
                <GoodItem>Publicas a las 6 a.m. y recibes postulantes en minutos</GoodItem>
                <GoodItem>Ves nivel, calificación y turnos previos antes de aceptar</GoodItem>
                <GoodItem>Pago digital, trazable, con comprobante</GoodItem>
                <GoodItem>Si no llega, no pagas — la plata vuelve a tu billetera</GoodItem>
                <GoodItem>Tu lista de "trabajadores recurrentes" queda lista para volver a contratar</GoodItem>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* PREGUNTA CLAVE — una sola, en prosa */}
      <section className="relative px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto">
          <p className="inline-flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
            <span className="w-6 h-px bg-red-500" /> La pregunta que más nos hacen
          </p>
          <h2 className="text-[28px] sm:text-[42px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            "¿Y si yo le pago y el trabajador no llega?"
          </h2>
          <p className="text-[16px] sm:text-[18px] text-slate-600 leading-relaxed">
            No nos lo pagas. <strong className="text-slate-900">El dinero queda en escrow desde el momento que publicas</strong>, no antes y no después. La plata solo sale de tu billetera Crew cuando tú confirmas con un toque que el turno se completó. Si el trabajador no llega, no hace check-in con tu código, o cancela tarde, el dinero vuelve a tu balance — completo si fue con anticipación, parcial si fue cerca de la hora.
          </p>
          <p className="text-[16px] sm:text-[18px] text-slate-600 leading-relaxed mt-4">
            La protección funciona <strong className="text-slate-900">en las dos direcciones</strong>. Por eso al trabajador también le interesa cumplir: solo cobra si llegó.
          </p>
        </div>
      </section>

      {/* CTA FINAL — split distinto al hero */}
      <section className="relative px-5 sm:px-8 py-20 sm:py-28">
        <div className="relative max-w-6xl mx-auto rounded-[36px] overflow-hidden bg-slate-900 text-white p-10 sm:p-16 grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div className="absolute inset-0 opacity-30" style={{
            background: 'radial-gradient(circle at 20% 30%, rgba(239,68,68,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(251,146,60,0.3) 0%, transparent 50%)',
          }} />
          <div className="relative">
            <h2 className="text-[36px] sm:text-[56px] font-black leading-[0.95] tracking-[-0.02em]">
              Publica tu primer turno hoy.
              <br />
              <span className="text-white/40">Tu primer postulante hoy mismo.</span>
            </h2>
          </div>
          <div className="relative flex flex-col gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onSignup}
              className="group inline-flex items-center justify-between gap-3 px-7 py-5 rounded-2xl bg-white text-slate-900 font-black text-[15px] hover:bg-slate-100 transition"
            >
              <span>Crear cuenta gratis</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center transition-transform group-hover:translate-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                </svg>
              </span>
            </motion.button>
            <button
              onClick={onLogin}
              className="text-[13px] font-bold text-white/60 hover:text-white px-2 py-1 text-left transition"
            >
              Ya tengo cuenta · Entrar →
            </button>
            <p className="text-[11px] text-white/35 mt-2">
              Tu cuenta queda en revisión &lt; 24h. Después tú decides cuándo publicar.
            </p>
          </div>
        </div>
      </section>

      <footer className="relative px-5 sm:px-8 py-8 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center">
              <CrewLogo size={18} showText={false} />
            </div>
            <span className="font-bold">crew · by menuby · {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://wa.me/573028181520" target="_blank" rel="noreferrer" className="hover:text-slate-700 transition">Soporte</a>
            <a href="/crew" className="hover:text-slate-700 transition">¿Eres trabajador? →</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Preview del producto: card de postulante (mock de la app real) ─── */
function ProductPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {/* Card postulante */}
      <div className="relative rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_-20px_rgba(0,0,0,0.12)] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Nuevo postulante</p>
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center text-[20px] font-black text-white">
            M
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[15px] font-black truncate">María Sánchez</p>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                ✓ Verificada
              </span>
            </div>
            <p className="text-[11.5px] text-slate-500 mt-0.5">Nivel 8 · 4.9★ (42 reseñas) · 47 turnos completados</p>
          </div>
          <span className="shrink-0 px-2 py-0.5 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
            92% match
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1.5 text-center">
          <Stat label="Experiencia" value="3 años" />
          <Stat label="Cancelaciones" value="0" />
          <Stat label="Universidad" value="UNAL" />
        </div>

        <div className="mt-3 flex gap-2">
          <button className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-[11.5px] font-bold">Rechazar</button>
          <button className="flex-[2] py-2 rounded-xl bg-slate-900 text-white text-[11.5px] font-extrabold">Aceptar para el turno</button>
        </div>
      </div>

      {/* Card flotante del turno */}
      <motion.div
        initial={{ opacity: 0, x: -16, rotate: -3 }}
        animate={{ opacity: 1, x: 0, rotate: -3 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="absolute -bottom-6 -left-4 sm:-left-8 max-w-[260px] rounded-2xl bg-white border border-slate-200 shadow-xl p-4"
      >
        <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-red-500 mb-1">Tu turno publicado</p>
        <p className="text-[13px] font-black text-slate-900 leading-tight">Mesero sábado en la noche</p>
        <p className="text-[10.5px] text-slate-500 mt-0.5">Sáb 15 nov · 18:00–23:00 · 5h</p>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
          <span className="text-[10px] text-slate-400">Pago al trabajador</span>
          <span className="text-[14px] font-black text-emerald-600 tabular-nums">$80.000</span>
        </div>
      </motion.div>

      {/* Indicador de notificación */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-red-500 text-white text-[10.5px] font-black uppercase tracking-wider shadow-lg shadow-red-500/40"
      >
        +3 postulantes
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1.5">
      <p className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-[11.5px] font-black text-slate-900 truncate">{value}</p>
    </div>
  );
}

/* ─── Proof item del trust bar ─── */
function ProofItem({ big, small }) {
  return (
    <div>
      <p className="text-[40px] sm:text-[56px] font-black leading-none text-slate-900 tracking-[-0.02em]">{big}</p>
      <p className="text-[12px] text-slate-500 mt-2 leading-relaxed">{small}</p>
    </div>
  );
}

/* ─── Frame con mock ─── */
function Frame({ n, title, body, mock }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
    >
      <span className="text-[10.5px] font-black tracking-[0.25em] text-red-500 uppercase">{n} ·</span>
      <h3 className="text-[20px] sm:text-[24px] font-black text-slate-900 leading-tight mt-1.5 tracking-tight">{title}</h3>
      <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">{body}</p>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {mock}
      </div>
    </motion.div>
  );
}

function MockPublish() {
  return (
    <div className="space-y-2.5 text-[11.5px]">
      <Row label="Cargo" value="Mesero" />
      <Row label="Fecha · horas" value="Sáb 18:00–23:00" />
      <Row label="Pago / hora" value="$16.000" />
      <Row label="Personas" value="2" />
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Se reserva</span>
        <span className="text-[14px] font-black tabular-nums">$176.000</span>
      </div>
    </div>
  );
}

function MockApplicants() {
  return (
    <div className="space-y-1.5">
      {[
        { name: 'María', lv: 8, score: 92, color: 'from-red-400 to-orange-400' },
        { name: 'Carlos', lv: 5, score: 78, color: 'from-violet-400 to-fuchsia-400' },
        { name: 'Diana', lv: 12, score: 95, color: 'from-emerald-400 to-teal-400' },
      ].map((a, i) => (
        <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${a.color} flex items-center justify-center text-[11px] font-black text-white shrink-0`}>
            {a.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-black text-slate-900 leading-tight">{a.name}</p>
            <p className="text-[9.5px] text-slate-500">Nivel {a.lv}</p>
          </div>
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {a.score}%
          </span>
        </div>
      ))}
    </div>
  );
}

function MockCheckin() {
  return (
    <div className="space-y-3 text-center">
      <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-amber-700">Código de llegada</p>
      <div className="flex justify-center gap-1.5">
        {['F', '7', 'K', '2', 'M', '9'].map((c, i) => (
          <div key={i} className="w-9 h-11 rounded-lg bg-amber-50 border-2 border-amber-300 flex items-center justify-center text-[18px] font-black text-amber-800 tabular-nums">
            {c}
          </div>
        ))}
      </div>
      <p className="text-[10.5px] text-slate-500">El trabajador lo escribe en su app al llegar</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 font-bold">{label}</span>
      <span className="font-black text-slate-900">{value}</span>
    </div>
  );
}

/* ─── Calculadora de costos ─── */
function Cost() {
  const [pay, setPay] = useState(15000);
  const [hours, setHours] = useState(5);
  const [sos, setSos] = useState(false);

  const totalPay = pay * hours;
  const rate = sos ? 0.15 : 0.10;
  const commission = Math.round(totalPay * rate);
  const grandTotal = totalPay + commission;

  return (
    <section className="relative px-5 sm:px-8 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
            <span className="w-6 h-px bg-red-500" /> El cálculo claro
          </p>
          <h2 className="text-[36px] sm:text-[54px] font-black leading-[0.95] tracking-[-0.02em]">
            Te decimos el total
            <br />
            <span className="text-slate-400">antes de publicar.</span>
          </h2>
          <p className="text-[14px] text-slate-500 mt-5 max-w-md leading-relaxed">
            Sin sorpresas, sin letra pequeña. Comisión <strong className="text-slate-900">10%</strong> sobre el pago del turno, <strong className="text-slate-900">15%</strong> si lo marcas urgente (SOS).
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-7 sm:p-8 shadow-sm">
          <div className="space-y-6">
            <CalcSlider
              label="Pago por hora al trabajador"
              value={pay}
              min={8000} max={30000} step={1000}
              onChange={setPay}
              format={(v) => formatCOP(v)}
            />
            <CalcSlider
              label="Horas del turno"
              value={hours}
              min={2} max={12} step={1}
              onChange={setHours}
              format={(v) => `${v}h`}
            />

            <label className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={sos}
                onChange={(e) => setSos(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-[12.5px] font-bold text-amber-900">
                Marcar como urgente <span className="font-normal text-amber-700">(prioridad en el feed, comisión 15%)</span>
              </span>
            </label>

            <div className="pt-5 border-t border-slate-200 space-y-2">
              <CalcRow label="Pago al trabajador" value={formatCOP(totalPay)} />
              <CalcRow label={`Comisión Crew (${(rate * 100).toFixed(0)}%)`} value={formatCOP(commission)} sub />
              <div className="pt-2 mt-2 border-t border-slate-200 flex items-baseline justify-between">
                <span className="text-[10.5px] font-black uppercase tracking-[0.2em] text-slate-500">Total que reservas</span>
                <motion.span
                  key={grandTotal}
                  initial={{ scale: 0.96, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className="text-[28px] sm:text-[34px] font-black text-slate-900 tabular-nums"
                >
                  {formatCOP(grandTotal)}
                </motion.span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CalcSlider({ label, value, min, max, step, onChange, format }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
        <span className="text-[14px] font-black text-slate-900 tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full appearance-none h-1.5 rounded-full outline-none accent-red-500"
        style={{
          background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${pct}%, #e2e8f0 ${pct}%)`,
        }}
      />
    </div>
  );
}

function CalcRow({ label, value, sub }) {
  return (
    <div className={`flex items-center justify-between ${sub ? 'text-slate-500' : 'text-slate-900'}`}>
      <span className={`text-[13px] ${sub ? 'font-medium' : 'font-bold'}`}>{label}</span>
      <span className={`text-[14px] tabular-nums ${sub ? 'font-bold' : 'font-extrabold'}`}>{value}</span>
    </div>
  );
}

/* ─── Comparativa items ─── */
function GoodItem({ children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className="text-[13.5px] text-slate-700 leading-snug">{children}</span>
    </li>
  );
}

function BadItem({ children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
      <span className="text-[13px] text-slate-500 leading-snug">{children}</span>
    </li>
  );
}

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

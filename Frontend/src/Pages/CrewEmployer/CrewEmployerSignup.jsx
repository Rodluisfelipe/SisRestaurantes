/**
 * CrewEmployerSignup — wizard de registro con sub-tipo persona/negocio.
 * Mismo lenguaje visual cosmic que el resto del Crew worker app.
 *
 * Pasos:
 *  1. Picker: persona o negocio (set kind)
 *  2. Form contextual al kind elegido
 *  3. Confirmación → backend devuelve token + status pending_approval
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCrewEmployer } from './useCrewEmployer';

const BUSINESS_TYPES = [
  { key: 'restaurant', label: 'Restaurante', emoji: '🍽️' },
  { key: 'cafe', label: 'Café', emoji: '☕' },
  { key: 'bar', label: 'Bar', emoji: '🍸' },
  { key: 'bakery', label: 'Panadería', emoji: '🥐' },
  { key: 'hotel', label: 'Hotel', emoji: '🏨' },
  { key: 'catering', label: 'Catering', emoji: '🥗' },
  { key: 'event_organizer', label: 'Organizador eventos', emoji: '🎪' },
  { key: 'wedding', label: 'Bodas', emoji: '💍' },
  { key: 'corporate_event', label: 'Evento corporativo', emoji: '🏢' },
  { key: 'production', label: 'Producción', emoji: '🎬' },
  { key: 'retail', label: 'Retail', emoji: '🛍️' },
  { key: 'salon', label: 'Salón belleza', emoji: '💇' },
  { key: 'spa', label: 'Spa', emoji: '🧖' },
  { key: 'clinic', label: 'Clínica', emoji: '🏥' },
  { key: 'cleaning', label: 'Limpieza', emoji: '🧽' },
  { key: 'moving', label: 'Mudanzas', emoji: '📦' },
  { key: 'services', label: 'Otros servicios', emoji: '🔧' },
  { key: 'other', label: 'Otro', emoji: '✨' },
];

export default function CrewEmployerSignup({ onSwitch }) {
  const { signup, loading } = useCrewEmployer();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState(null); // 'individual' | 'business'
  const [form, setForm] = useState({
    phone: '',
    password: '',
    name: '',
    email: '',
    whatsappNumber: '',
    businessType: '',
    address: { city: '', neighborhood: '', full: '' },
  });
  const [error, setError] = useState(null);

  const submit = async () => {
    setError(null);
    if (!form.phone || !form.password || !form.name) {
      return setError('Completa tu nombre, celular y contraseña.');
    }
    if (form.password.length < 6) return setError('Contraseña mínima 6 caracteres.');
    if (kind === 'business' && !form.businessType) {
      return setError('Elige el tipo de negocio.');
    }
    try {
      await signup({ ...form, kind });
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo crear la cuenta.');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-800 font-geist">
      <header className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-red-500 flex items-center justify-center shadow-md shadow-red-500/25">
            <span className="text-base font-black text-white">C</span>
          </div>
          <div>
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Crew</p>
            <p className="text-[13px] font-black text-slate-800">Soy un empleador</p>
          </div>
        </div>
        {step === 0 && (
          <button onClick={onSwitch} className="text-[12px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition">
            Entrar
          </button>
        )}
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="text-[12px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition">
            Atrás
          </button>
        )}
      </header>

      <main className="max-w-md mx-auto px-5 py-6">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="picker" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="text-center mb-8">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-2">Paso 1 de 2</p>
                <h1 className="text-[28px] font-black leading-tight text-slate-800">¿Quién publica el turno?</h1>
                <p className="text-[12.5px] text-slate-500 mt-2 leading-relaxed">
                  Tu cuenta queda en revisión antes de publicar. Te avisamos en máximo 24 h.
                </p>
              </div>

              <div className="space-y-3">
                <KindCard
                  active={kind === 'individual'}
                  onSelect={() => { setKind('individual'); setStep(1); }}
                  emoji="🎉"
                  title="Soy una persona"
                  desc="Necesito ayuda para un evento puntual: una boda, una fiesta, una mudanza, un trabajo de un día."
                />
                <KindCard
                  active={kind === 'business'}
                  onSelect={() => { setKind('business'); setStep(1); }}
                  emoji="🏢"
                  title="Soy un negocio"
                  desc="Restaurante, hotel, catering, retail, salón. Contrato personal de forma recurrente."
                />
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="mb-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-1">Paso 2 de 2</p>
                <h1 className="text-[24px] font-black leading-tight text-slate-800">
                  {kind === 'individual' ? 'Cuéntanos sobre ti' : 'Cuéntanos sobre tu negocio'}
                </h1>
              </div>

              <div className="space-y-3">
                <Field
                  label={kind === 'individual' ? 'Tu nombre completo' : 'Nombre comercial del negocio'}
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  placeholder={kind === 'individual' ? 'Andrés Gómez' : 'Café Luna'}
                />
                <Field
                  label="Celular"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="3001234567"
                  type="tel"
                  prefix="+57"
                />
                <Field
                  label="Email (opcional)"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  placeholder="tu@correo.com"
                  type="email"
                />
                <Field
                  label="WhatsApp para que el trabajador te contacte"
                  value={form.whatsappNumber}
                  onChange={(v) => setForm({ ...form, whatsappNumber: v })}
                  placeholder="3001234567"
                  type="tel"
                />

                {kind === 'business' && (
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-2">Tipo de negocio</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {BUSINESS_TYPES.map((t) => {
                        const active = form.businessType === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => setForm({ ...form, businessType: t.key })}
                            className={`p-2 rounded-xl text-[10.5px] font-bold transition flex flex-col items-center gap-0.5 ${
                              active
                                ? 'bg-red-50 border border-red-200 text-red-700'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <span className="text-base leading-none">{t.emoji}</span>
                            <span className="leading-tight text-center">{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Field
                  label="Ciudad (opcional)"
                  value={form.address.city}
                  onChange={(v) => setForm({ ...form, address: { ...form.address, city: v } })}
                  placeholder="Bogotá"
                />
                <Field
                  label="Contraseña"
                  value={form.password}
                  onChange={(v) => setForm({ ...form, password: v })}
                  placeholder="Mínimo 6 caracteres"
                  type="password"
                />

                {error && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">
                    {error}
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={submit}
                  disabled={loading}
                  className="w-full rounded-2xl px-5 py-3.5 font-extrabold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/25 disabled:opacity-50 transition"
                >
                  {loading ? 'Creando cuenta…' : 'Crear cuenta'}
                </motion.button>

                <p className="text-center text-[10.5px] text-slate-400 leading-relaxed">
                  Al crear tu cuenta aceptas que SuperAdmin revise tu solicitud. Pagas comisión solo cuando completas un turno. <strong className="text-slate-600">10%</strong> estándar, <strong className="text-slate-600">15%</strong> en urgencias.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function KindCard({ active, onSelect, emoji, title, desc }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`group w-full overflow-hidden text-left rounded-2xl p-5 border transition-all ${
        active
          ? 'border-red-300 bg-red-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl shrink-0">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-black text-slate-800">{title}</p>
          <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{desc}</p>
        </div>
        <svg className="w-4 h-4 text-slate-300 mt-1 shrink-0 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.button>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', prefix }) {
  return (
    <div>
      <label className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-1.5">{label}</label>
      <div className="flex items-center rounded-2xl bg-slate-50 border border-slate-200 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100 transition">
        {prefix && <span className="pl-3.5 text-[14px] font-bold text-slate-500 tabular-nums">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3.5 py-3 text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>
    </div>
  );
}

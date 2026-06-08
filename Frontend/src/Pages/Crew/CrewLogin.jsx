/**
 * CrewLogin — pantalla de entrada al marketplace Crew.
 *
 * Estética: fondo cósmico animado, headline grande con gradient,
 * card glass con inputs flotantes, CTA con glow y sparkles flotando.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCrew } from './useCrew';
import Aurora, { Sparkles } from './components/Aurora';
import GradientText from './components/GradientText';
import GlowButton from './components/GlowButton';
import FloatingInput from './components/FloatingInput';

const MODES = [
  { id: 'signup', label: 'Registrarme' },
  { id: 'login', label: 'Entrar' },
];

const STAGGER = {
  initial: { opacity: 0, y: 18, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
};

export default function CrewLogin({ onAuthed }) {
  const { signup, login, loading } = useCrew();
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({ phone: '', name: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'signup') {
        if (!form.name || form.name.trim().length < 2) {
          setError('Cuéntanos tu nombre completo para empezar.');
          return;
        }
        if (form.password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres.');
          return;
        }
        await signup(form);
      } else {
        await login({ phone: form.phone, password: form.password });
      }
      onAuthed?.();
    } catch (err) {
      setError(err?.response?.data?.message || 'Algo salió mal. Vuelve a intentarlo.');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 font-geist overflow-hidden text-white">
      <Aurora variant="hero" />
      <Sparkles count={26} />

      {/* Glow del logo en la parte superior */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.1 }}
        className="absolute top-12 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-red-500/20 blur-[120px] pointer-events-none"
        aria-hidden
      />

      <motion.div
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}
        className="relative w-full max-w-[420px] z-10"
      >
        {/* Marca */}
        <motion.div variants={STAGGER} className="text-center mb-8">
          <div className="relative mx-auto w-14 h-14 mb-5">
            <motion.div
              animate={{ scale: [1, 1.08, 1], rotate: [0, 4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-600 via-red-500 to-red-400 shadow-[0_8px_32px_-4px_rgba(239,68,68,0.6)]"
            />
            <div className="relative w-full h-full rounded-2xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse" />
          </div>

          <span className="inline-block px-2.5 py-1 mb-3 rounded-full bg-white/[0.06] backdrop-blur-sm border border-white/[0.12] text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/70">
            MenuBy · Crew
          </span>

          <h1 className="text-[36px] sm:text-[40px] font-black leading-[1.05] tracking-tight">
            Tu próximo <GradientText variant="sunrise">turno</GradientText>
            <br />
            empieza acá.
          </h1>
          <p className="text-[13px] text-white/55 mt-3 max-w-[300px] mx-auto leading-relaxed">
            Conecta con restaurantes de tu ciudad. Trabaja cuando quieras, sube de nivel, hazte tu reputación.
          </p>
        </motion.div>

        {/* Card glass */}
        <motion.div
          variants={STAGGER}
          className="relative rounded-[28px] p-6 sm:p-7 border border-white/[0.10] bg-white/[0.04] backdrop-blur-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          {/* Borde brillante superior */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Tabs modo */}
          <div className="relative flex p-1 mb-6 bg-black/30 border border-white/[0.06] rounded-2xl">
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMode(m.id); setError(''); }}
                  className={`relative flex-1 py-2.5 rounded-xl text-[12px] font-extrabold uppercase tracking-wider transition-colors ${
                    active ? 'text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="crew-login-tab"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600/90 via-red-500/90 to-red-500/90 shadow-[0_4px_20px_-4px_rgba(239,68,68,0.6)]"
                    />
                  )}
                  <span className="relative">{m.label}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div className="px-4 py-3 rounded-xl bg-red-500/[0.10] border border-red-400/30 flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center text-red-300 text-[11px]">!</span>
                  <p className="text-[12.5px] text-red-200 leading-relaxed">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={submit} className="space-y-3">
            <AnimatePresence mode="popLayout">
              {mode === 'signup' && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  <FloatingInput
                    label="Tu nombre completo"
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    autoComplete="name"
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <FloatingInput
              label="Celular"
              type="tel"
              prefix="+57"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, '').slice(0, 10) })}
              autoComplete="tel"
              required
              maxLength={10}
            />
            <FloatingInput
              label="Contraseña"
              type="password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
            />

            <div className="pt-3">
              <GlowButton
                type="submit"
                size="lg"
                variant="primary"
                fullWidth
                loading={loading}
                iconRight={
                  <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                  </svg>
                }
              >
                {mode === 'signup' ? 'Crear mi cuenta' : 'Entrar a Crew'}
              </GlowButton>
            </div>
          </form>

          {/* Pruebas sociales */}
          <motion.div variants={STAGGER} className="mt-6 pt-5 border-t border-white/[0.06] flex items-center justify-between gap-3">
            <div className="flex items-center -space-x-2">
              {[
                'from-red-400 to-red-600',
                'from-red-300 to-red-500',
                'from-white/60 to-white/30',
                'from-red-500 to-red-700',
              ].map((g, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-[#0a0a14] shadow-md`}
                />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-extrabold text-white/90">+1.200 trabajando ya</p>
              <p className="text-[10px] text-white/40">Bogotá · Medellín · Cali · Barranquilla</p>
            </div>
            <div className="flex items-center gap-1 text-red-400">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z"/></svg>
              <span className="text-[11px] font-extrabold tabular-nums">4.8</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div variants={STAGGER} className="mt-6 text-center space-y-2">
          <p className="text-[11px] text-white/35 leading-relaxed">
            Al continuar aceptas los <a href="#" className="text-white/60 underline underline-offset-2 hover:text-white">términos</a> y la <a href="#" className="text-white/60 underline underline-offset-2 hover:text-white">política de privacidad</a> de MenuBy.
          </p>
          <a
            href="/admin"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white/50 hover:text-white transition group"
          >
            ¿Eres dueño de restaurante?
            <span className="text-white/40 group-hover:text-white transition">→</span>
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}

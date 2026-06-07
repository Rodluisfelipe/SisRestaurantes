import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCrew } from './useCrew';

/* Capi mascot — versión SVG inline para la pantalla de login */
const Capi = ({ size = 88 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <defs>
      <linearGradient id="capi-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7B2FFF"/>
        <stop offset="100%" stopColor="#FF6B35"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="45" fill="url(#capi-grad)" opacity="0.18"/>
    <ellipse cx="50" cy="58" rx="28" ry="22" fill="#A0784D"/>
    <circle cx="40" cy="50" r="4" fill="#1A0F08"/>
    <circle cx="60" cy="50" r="4" fill="#1A0F08"/>
    <ellipse cx="50" cy="62" rx="6" ry="3" fill="#1A0F08"/>
    <ellipse cx="35" cy="40" rx="4" ry="5" fill="#8B6340"/>
    <ellipse cx="65" cy="40" rx="4" ry="5" fill="#8B6340"/>
  </svg>
);

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
          setError('Pon tu nombre 🙏');
          return;
        }
        await signup(form);
      } else {
        await login({ phone: form.phone, password: form.password });
      }
      onAuthed?.();
    } catch (err) {
      setError(err?.response?.data?.message || 'Algo falló, vuelve a intentar');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 bg-[#0A0A14] text-white font-geist relative overflow-hidden">
      {/* Glow orbs background */}
      <div className="absolute top-[-15%] right-[-10%] w-[400px] h-[400px] bg-[#7B2FFF] opacity-25 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] bg-[#FF6B35] opacity-20 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[380px]"
      >
        {/* Brand */}
        <div className="text-center mb-7">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex justify-center mb-4"
          >
            <Capi />
          </motion.div>
          <h1 className="text-[34px] font-extrabold tracking-tight leading-none">
            <span className="bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] bg-clip-text text-transparent">Crew</span>
          </h1>
          <p className="text-[13px] text-white/50 mt-2 font-medium">Trabaja cuando vibras 🔥</p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 mb-5 bg-white/[0.04] border border-white/[0.06] rounded-full w-fit mx-auto">
          {['signup', 'login'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                mode === m
                  ? 'bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] text-white shadow-lg'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {m === 'signup' ? 'Soy nuevo' : 'Ya tengo'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-3">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[13px] text-red-300"
            >
              {error}
            </motion.div>
          )}

          {mode === 'signup' && (
            <Input
              label="¿Cómo te llamas?"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Tu nombre"
            />
          )}
          <Input
            label="Celular"
            type="tel"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            placeholder="3001234567"
          />
          <Input
            label="Contraseña"
            type="password"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            placeholder="••••••"
          />

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={loading}
            type="submit"
            className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] text-white font-bold text-[15px] shadow-[0_8px_30px_rgba(123,47,255,0.35)] disabled:opacity-50 transition-shadow hover:shadow-[0_12px_40px_rgba(123,47,255,0.5)]"
          >
            {loading ? 'Un seg…' : mode === 'signup' ? 'Empezar 🚀' : 'Entrar'}
          </motion.button>
        </form>

        <p className="text-center text-[11px] text-white/30 mt-6">
          Al continuar aceptas los términos y la política de privacidad
        </p>
      </motion.div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-white/55 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[15px] text-white placeholder:text-white/25 focus:outline-none focus:border-[#7B2FFF]/60 focus:bg-white/[0.06] transition-all"
        required
      />
    </div>
  );
}

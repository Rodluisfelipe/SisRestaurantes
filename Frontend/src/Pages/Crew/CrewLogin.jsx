import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCrew } from './useCrew';

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
          setError('Por favor ingresa tu nombre.');
          return;
        }
        await signup(form);
      } else {
        await login({ phone: form.phone, password: form.password });
      }
      onAuthed?.();
    } catch (err) {
      setError(err?.response?.data?.message || 'Algo no salió bien. Intenta de nuevo.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 font-geist">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[400px]"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/25 mb-4">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <h1 className="text-[24px] font-extrabold text-slate-900 tracking-tight">MenuBy Crew</h1>
          <p className="text-[13px] text-slate-500 mt-1.5 font-medium">Conecta con turnos en restaurantes de tu ciudad</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 mb-5 bg-slate-100 rounded-xl">
            {[
              { id: 'signup', label: 'Crear cuenta' },
              { id: 'login', label: 'Iniciar sesión' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMode(m.id); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === m.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200"
            >
              <p className="text-[12px] text-red-700">{error}</p>
            </motion.div>
          )}

          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'signup' && (
              <Input
                label="Nombre completo"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="Ej: Andrés Gómez"
                autoComplete="name"
              />
            )}
            <Input
              label="Número de celular"
              type="tel"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              placeholder="3001234567"
              autoComplete="tel"
            />
            <Input
              label="Contraseña"
              type="password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />

            <motion.button
              whileTap={loading ? undefined : { scale: 0.98 }}
              disabled={loading}
              type="submit"
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-[14px] shadow-lg shadow-red-500/25 disabled:opacity-50 transition-all hover:shadow-xl hover:shadow-red-500/30"
            >
              {loading ? 'Procesando…' : mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5 leading-relaxed">
          Al continuar aceptas los términos de uso y la política de privacidad de MenuBy.
        </p>
      </motion.div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text', autoComplete }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:bg-white transition-all"
        required
      />
    </div>
  );
}

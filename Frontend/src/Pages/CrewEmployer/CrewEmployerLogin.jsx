/**
 * CrewEmployerLogin — pantalla de login para empleadores externos.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCrewEmployer } from './useCrewEmployer';

export default function CrewEmployerLogin({ onSwitch }) {
  const { login, loading } = useCrewEmployer();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    setError(null);
    try {
      await login({ phone, password });
    } catch (e) {
      setError(e?.response?.data?.message || 'Credenciales incorrectas.');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-800 font-geist">
      <header className="max-w-md mx-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-red-500 flex items-center justify-center shadow-md shadow-red-500/25">
            <span className="text-base font-black text-white">C</span>
          </div>
          <p className="text-[13px] font-black text-slate-800">Bienvenido de vuelta</p>
        </div>
        <button onClick={onSwitch} className="text-[12px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition">
          Registrarme
        </button>
      </header>

      <main className="max-w-md mx-auto px-5 py-8">
        <form onSubmit={submit} className="space-y-3">
          <Field
            label="Celular"
            value={phone}
            onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            placeholder="3001234567"
            type="tel"
            prefix="+57"
          />
          <Field
            label="Contraseña"
            value={password}
            onChange={setPassword}
            placeholder="Tu contraseña"
            type="password"
          />
          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">
              {error}
            </div>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl px-5 py-3.5 font-extrabold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/25 disabled:opacity-50 transition"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </motion.button>
        </form>
      </main>
    </div>
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

import React, { useState } from "react";
import { forgotPassword } from "../../services/superadminApi";
import { motion } from "framer-motion";

export default function ForgotPasswordSuperAdmin({ onBack }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setMessage("Si el email existe, se ha enviado un enlace de recuperación.");
    } catch (err) {
      setError(err.response?.data?.message || "Error al enviar email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0a0a1a 0%, #0d1b2a 40%, #1b2838 70%, #0a0a1a 100%)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/[0.08] rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px]" />
      </div>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px]"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-60" />
        <div className="relative backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
          <div className="p-8 sm:p-10">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="text-center mb-8">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-white/10 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/10">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Recuperar contraseña</h1>
              <p className="mt-1.5 text-sm text-white/40">Ingresa tu correo para recibir un enlace</p>
            </motion.div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  <p className="text-sm text-red-300/90 leading-snug">{error}</p>
                </div>
              </motion.div>
            )}

            {message && (
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm text-emerald-300/90 leading-snug">{message}</p>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
                <label className="block text-xs font-medium text-white/50 mb-1.5 ml-1">Correo electrónico</label>
                <div className="relative group">
                  <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-11 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 outline-none transition-all duration-200 focus:border-blue-400/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-blue-400/20"
                    placeholder="tucorreo@ejemplo.com"
                  />
                  <svg className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-blue-400/60 transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }} className="pt-2">
                <button type="submit" disabled={loading}
                  className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-300 ${loading ? 'bg-white/[0.06] text-white/30 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-400 hover:to-indigo-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-[0.98]'}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : 'Enviar enlace de recuperación'}
                </button>
              </motion.div>
            </form>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }} className="mt-6 text-center">
              <button type="button" onClick={onBack} className="text-sm text-white/30 hover:text-blue-400/80 transition-colors duration-200">
                ← Volver al inicio de sesión
              </button>
            </motion.div>
          </div>
        </div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }} className="text-center mt-6 text-xs text-white/15">
          MenuBy — Panel de Administración
        </motion.p>
      </motion.div>
    </div>
  );
}

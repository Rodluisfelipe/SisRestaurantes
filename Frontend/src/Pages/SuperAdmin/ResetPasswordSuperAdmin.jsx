import React, { useState } from "react";
import { resetPassword } from "../../services/superadminApi";
import { motion } from "framer-motion";

export default function ResetPasswordSuperAdmin({ token, onSuccess, onBack }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (newPassword.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setMessage("Contraseña restablecida con éxito. Redirigiendo al login...");
      setSuccess(true);
      setTimeout(() => { if (onSuccess) onSuccess(); }, 2000);
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 404) {
        setTokenInvalid(true);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Error al restablecer la contraseña. Intenta nuevamente.");
      }
    } finally { setLoading(false); }
  };

  const EyeIcon = ({ show, onToggle }) => (
    <button type="button" onClick={onToggle} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors">
      {show ? (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
      ) : (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      )}
    </button>
  );

  const bgClasses = "min-h-screen relative flex items-center justify-center px-4 overflow-hidden";
  const bgStyle = { background: 'linear-gradient(145deg, #0a0a1a 0%, #0d1b2a 40%, #1b2838 70%, #0a0a1a 100%)' };

  /* ── Token inválido / expirado ── */
  if (tokenInvalid) {
    return (
      <div className={bgClasses} style={bgStyle}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-rose-500/[0.08] rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="relative w-full max-w-[420px]">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-rose-500/20 to-orange-500/20 rounded-3xl blur-xl opacity-60" />
          <div className="relative backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-[2px] bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />
            <div className="p-8 sm:p-10 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-600/20 border border-white/10 flex items-center justify-center mb-5 shadow-lg shadow-red-500/10">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Enlace inválido o expirado</h1>
              <p className="text-sm text-white/40 mb-8 leading-relaxed">
                Este enlace de restablecimiento ya no es válido.<br />Solicita uno nuevo desde la pantalla de login.
              </p>
              <button onClick={onBack}
                className="w-full py-3 px-4 rounded-xl font-medium text-sm bg-gradient-to-r from-red-500/80 to-rose-600/80 text-white hover:from-red-400 hover:to-rose-500 shadow-lg shadow-red-500/20 transition-all duration-300 active:scale-[0.98]"
              >
                Volver al login
              </button>
            </div>
          </div>
          <p className="text-center mt-6 text-xs text-white/15">MenuBy — Panel de Administración</p>
        </motion.div>
      </div>
    );
  }

  /* ── Formulario de reset ── */
  return (
    <div className={bgClasses} style={bgStyle}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/[0.08] rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px]" />
      </div>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="relative w-full max-w-[420px]">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-60" />
        <div className="relative backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
          <div className="p-8 sm:p-10">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="text-center mb-8">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-white/10 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/10">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Restablecer contraseña</h1>
              <p className="mt-1.5 text-sm text-white/40">Ingresa tu nueva contraseña</p>
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

            {!success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 ml-1">Nueva contraseña</label>
                  <div className="relative group">
                    <input type={showNew ? 'text' : 'password'} required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pl-11 pr-11 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 outline-none transition-all duration-200 focus:border-blue-400/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-blue-400/20"
                      placeholder="Mínimo 8 caracteres"
                    />
                    <svg className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-blue-400/60 transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                    <EyeIcon show={showNew} onToggle={() => setShowNew(!showNew)} />
                  </div>
                  {newPassword && newPassword.length < 8 && (
                    <p className="mt-1 text-[11px] text-amber-400/60 ml-1">Mínimo 8 caracteres</p>
                  )}
                </motion.div>

                <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 ml-1">Confirmar contraseña</label>
                  <div className="relative group">
                    <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 pl-11 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 outline-none transition-all duration-200 focus:border-blue-400/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-blue-400/20"
                      placeholder="Repite la nueva contraseña"
                    />
                    <svg className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-blue-400/60 transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1 text-[11px] text-red-400/60 ml-1">Las contraseñas no coinciden</p>
                  )}
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }} className="pt-2">
                  <button type="submit" disabled={loading}
                    className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-300 ${loading ? 'bg-white/[0.06] text-white/30 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-400 hover:to-indigo-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-[0.98]'}`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Restableciendo...
                      </span>
                    ) : 'Restablecer contraseña'}
                  </button>
                </motion.div>
              </form>
            )}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 0.4 }} className="mt-6 text-center">
              <button type="button" onClick={onBack} className="text-sm text-white/30 hover:text-blue-400/80 transition-colors duration-200">
                ← Volver al login
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

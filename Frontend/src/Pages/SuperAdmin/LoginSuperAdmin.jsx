import React, { useState } from "react";
import { loginSuperAdmin, googleLoginSuperAdmin } from "../../services/superadminApi";
import { GoogleLogin } from '@react-oauth/google';
import { motion } from "framer-motion";

export default function LoginSuperAdmin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await loginSuperAdmin(email, password);
      localStorage.setItem("superadmin_token", res.data.token);
      if (res.data.refreshToken) {
        localStorage.setItem("superadmin_refreshToken", res.data.refreshToken);
      }
      if (res.data.superAdmin) {
        localStorage.setItem("user", JSON.stringify(res.data.superAdmin));
      }
      onLogin();
    } catch (err) {
      console.error("Error de autenticación:", err);
      if (err.response?.status === 404) {
        setError("No se puede conectar con el servidor. Verifica que el backend esté funcionando.");
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message === "Network Error") {
        setError("Error de conexión. Verifica tu conexión a internet.");
      } else {
        setError("Error de autenticación. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setGoogleLoading(true);
    try {
      const res = await googleLoginSuperAdmin(credentialResponse.credential);
      localStorage.setItem("superadmin_token", res.data.token);
      if (res.data.refreshToken) {
        localStorage.setItem("superadmin_refreshToken", res.data.refreshToken);
      }
      if (res.data.superAdmin) {
        localStorage.setItem("user", JSON.stringify(res.data.superAdmin));
      }
      onLogin();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión con Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 font-geist" style={{ background: '#09090b' }}>
      {/* Subtle radial glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 600px 400px at 50% 40%, rgba(6,182,212,0.06), transparent)' }} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[380px]"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="mx-auto w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mb-4">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            MenuBy Admin
          </h1>
          <p className="mt-1 text-[13px] text-white/30">
            Inicia sesión para continuar
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20"
            >
              <p className="text-[13px] text-red-400 leading-snug">{error}</p>
            </motion.div>
          )}

          {/* Google */}
          <div className="mb-5">
            <div className="flex justify-center [&_iframe]:!rounded-lg">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Error al conectar con Google')}
                text="signin_with"
                shape="rectangular"
                size="large"
                width="340"
                theme="filled_black"
                locale="es"
              />
            </div>
            {googleLoading && (
              <div className="flex justify-center mt-3">
                <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-[11px] text-white/20 bg-[#0c0c0f]">o con email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-white/40">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20
                  focus:outline-none focus:border-cyan-500/40 transition-colors"
                placeholder="admin@menuby.tech"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-white/40">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20
                    focus:outline-none focus:border-cyan-500/40 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                loading || googleLoading
                  ? 'bg-white/[0.04] text-white/25 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-white/90 active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Verificando...
                </span>
              ) : 'Iniciar sesión'}
            </button>
          </form>

          {/* Forgot */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onLogin('forgot'); }}
              className="text-xs text-white/25 hover:text-cyan-400/70 transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-[11px] text-white/10 tracking-wide">
          MenuBy &middot; Super Admin
        </p>
      </motion.div>
    </div>
  );
}

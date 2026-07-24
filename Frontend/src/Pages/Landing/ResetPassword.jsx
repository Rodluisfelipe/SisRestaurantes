import React, { useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { resetPassword } from '../../services/authService';

const rules = [
  { key: 'len', label: 'Al menos 8 caracteres', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'Una letra mayúscula', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Una letra minúscula', test: (p) => /[a-z]/.test(p) },
  { key: 'num', label: 'Un número', test: (p) => /[0-9]/.test(p) },
];

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const checks = useMemo(() => rules.map(r => ({ ...r, ok: r.test(password) })), [password]);
  const allValid = checks.every(c => c.ok);
  const matches = password.length > 0 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!allValid) { setError('La contraseña no cumple todos los requisitos.'); return; }
    if (!matches) { setError('Las contraseñas no coinciden.'); return; }
    setIsLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'No pudimos restablecer la contraseña. El enlace pudo expirar.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFAF8]">
      <section className="min-h-screen flex items-center justify-center px-4 pt-20 pb-8 bg-gradient-to-br from-[#FBFAF8] via-[#FBEEE9] to-[#FBFAF8]">
        <div className="w-full">
          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-5"
            >
              <h1 className="text-[26px] sm:text-[28px] font-extrabold text-[#17120F] mb-1" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.025em' }}>
                Nueva contraseña
              </h1>
              <p className="text-[14px] text-[#6E655C]">
                Crea una contraseña segura para tu cuenta
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-white rounded-[26px] shadow-[0_20px_60px_rgba(23,18,15,0.10)] border border-[#EFEAE3] p-6 sm:p-7"
            >
              {done ? (
                <div className="text-center py-4">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-[#17120F] mb-2">¡Listo!</h2>
                  <p className="text-sm text-[#6E655C] mb-5">
                    Tu contraseña se actualizó. Te llevamos al inicio de sesión…
                  </p>
                  <Link
                    to="/login"
                    className="inline-block w-full py-3.5 bg-[#E8002D] hover:bg-[#A80020] text-white font-bold rounded-xl transition-all duration-200"
                    style={{ boxShadow: '0 8px 24px rgba(232,0,45,0.26)' }}
                  >
                    Iniciar sesión ahora
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                        required
                        autoFocus
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors duration-200 text-gray-900 bg-white placeholder-gray-400"
                        placeholder="Tu nueva contraseña"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Requisitos */}
                  {password.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {checks.map(c => (
                        <div key={c.key} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-green-600' : 'text-[#9A9088]'}`}>
                          <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full ${c.ok ? 'bg-green-100' : 'bg-gray-100'}`}>
                            {c.ok ? '✓' : '·'}
                          </span>
                          {c.label}
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmar contraseña
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="confirm"
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); if (error) setError(''); }}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors duration-200 text-gray-900 bg-white placeholder-gray-400"
                      placeholder="Repite la contraseña"
                    />
                    {confirm.length > 0 && !matches && (
                      <p className="mt-1.5 text-xs text-red-500">Las contraseñas no coinciden</p>
                    )}
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start"
                    >
                      <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span>{error}</span>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !allValid || !matches}
                    className="w-full py-3.5 bg-[#E8002D] hover:bg-[#A80020] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98] flex items-center justify-center"
                    style={{ boxShadow: '0 8px 24px rgba(232,0,45,0.26)' }}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Guardando...
                      </>
                    ) : (
                      'Restablecer contraseña'
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <Link to="/login" className="text-sm text-[#6E655C] hover:text-[#17120F] font-medium">
                      ← Volver a iniciar sesión
                    </Link>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ResetPassword;

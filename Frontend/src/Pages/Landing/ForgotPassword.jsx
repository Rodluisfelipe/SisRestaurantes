import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { requestPasswordReset } from '../../services/authService';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'No pudimos procesar la solicitud. Intenta de nuevo en unos minutos.'
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
                Recupera tu contraseña
              </h1>
              <p className="text-[14px] text-[#6E655C]">
                Te enviaremos un enlace para crear una nueva
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-white rounded-[26px] shadow-[0_20px_60px_rgba(23,18,15,0.10)] border border-[#EFEAE3] p-6 sm:p-7"
            >
              {sent ? (
                <div className="text-center py-4">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-[#17120F] mb-2">Revisa tu correo</h2>
                  <p className="text-sm text-[#6E655C] mb-1">
                    Si <strong className="text-[#17120F]">{email}</strong> está registrado, te enviamos un enlace para restablecer tu contraseña.
                  </p>
                  <p className="text-xs text-[#9A9088] mb-5">El enlace expira en 1 hora. Revisa también la carpeta de spam o promociones.</p>
                  <Link
                    to="/login"
                    className="inline-block w-full py-3.5 bg-[#E8002D] hover:bg-[#A80020] text-white font-bold rounded-xl transition-all duration-200"
                    style={{ boxShadow: '0 8px 24px rgba(232,0,45,0.26)' }}
                  >
                    Volver a iniciar sesión
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                      required
                      autoFocus
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E8002D] focus:border-[#E8002D] transition-colors duration-200 text-gray-900 bg-white placeholder-gray-400"
                      placeholder="tu@email.com"
                    />
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
                    disabled={isLoading}
                    className="w-full py-3.5 bg-[#E8002D] hover:bg-[#A80020] disabled:opacity-50 text-white font-bold rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98] flex items-center justify-center"
                    style={{ boxShadow: '0 8px 24px rgba(232,0,45,0.26)' }}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Enviando...
                      </>
                    ) : (
                      'Enviar enlace de recuperación'
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

export default ForgotPassword;

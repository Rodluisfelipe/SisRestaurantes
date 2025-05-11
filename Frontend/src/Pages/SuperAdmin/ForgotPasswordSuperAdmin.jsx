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
    <div className="min-h-screen bg-[#051C2C] flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full bg-[#333F50]/80 rounded-2xl shadow-xl overflow-hidden border border-[#333F50]"
      >
        <div className="p-6 sm:p-10">
          <div className="text-center mb-6 sm:mb-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Recuperar contraseña</h2>
              <p className="mt-2 text-xs sm:text-sm text-[#D1D9FF]">
                Ingresa tu correo para recibir un enlace de recuperación
              </p>
            </motion.div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-500/20 text-red-300 text-sm rounded-lg border border-red-500/30"
            >
              {error}
            </motion.div>
          )}

          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-green-500/20 text-green-300 text-sm rounded-lg border border-green-500/30"
            >
              {message}
            </motion.div>
          )}

          <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <label htmlFor="email" className="block text-sm font-medium text-[#D1D9FF]">
                Correo electrónico
              </label>
              <div className="mt-1 relative">
        <input
                  id="email"
                  name="email"
          type="email"
                  autoComplete="email"
                  required
          value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2.5 sm:py-3 border border-[#333F50] bg-[#333F50]/50 rounded-lg shadow-sm placeholder-[#A5B9FF]/70 focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-white text-sm pl-10"
                  placeholder="tucorreo@ejemplo.com"
                />
                <svg 
                  className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A5B9FF]" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
      </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="pt-2 sm:pt-4"
            >
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white 
                  ${loading 
                    ? 'bg-[#3A7AFF]/50 cursor-not-allowed' 
                    : 'bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3A7AFF]/50 hover:shadow-lg hover:shadow-[#3A7AFF]/20'
                  } transition-all duration-300`}
              >
        {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enviando enlace...
                  </div>
                ) : 'Enviar enlace de recuperación'}
      </button>
            </motion.div>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            className="mt-5 sm:mt-6 text-center"
          >
            <button 
              type="button"
              onClick={onBack}
              className="font-medium text-[#A5B9FF] hover:text-[#5FF9B4]"
            >
              Volver al inicio de sesión
        </button>
          </motion.div>
        </div>
      </motion.div>
      </div>
  );
} 
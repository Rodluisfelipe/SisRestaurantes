import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../Context/AuthContext';
import { useTheme } from '../../Context/ThemeContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Usar el email como username para el login
      await login(email, password);
      // El redirect lo maneja el AuthContext automáticamente
    } catch (err) {
      console.error('Error de login:', err);
      setError(
        err.response?.data?.message || 
        'Error al iniciar sesión. Por favor, verifica tus credenciales.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#051C2C]' : 'bg-[#F4F7FB]'} flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`max-w-md w-full ${
          theme === 'dark' 
            ? 'bg-[#333F50]/80 border border-[#333F50]' 
            : 'bg-white border border-[#DCE4F5]'
        } rounded-2xl shadow-xl overflow-hidden`}
      >
        <div className="p-6 sm:p-10">
          <div className="text-center mb-6 sm:mb-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h2 className={`text-2xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>Bienvenido de nuevo</h2>
              <p className={`mt-2 text-xs sm:text-sm ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                Ingresa a tu cuenta para continuar
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

          <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <label htmlFor="email" className={`block text-sm font-medium ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                Correo electrónico
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`appearance-none block w-full px-3 py-2.5 sm:py-3 border ${
                    theme === 'dark'
                      ? 'border-[#333F50] bg-[#333F50]/50 text-white placeholder-[#A5B9FF]/70'
                      : 'border-[#DCE4F5] bg-white text-[#1F2937] placeholder-[#6C7A92]/70'
                  } rounded-lg shadow-sm focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-sm`}
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <label htmlFor="password" className={`block text-sm font-medium ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`appearance-none block w-full px-3 py-2.5 sm:py-3 border ${
                    theme === 'dark'
                      ? 'border-[#333F50] bg-[#333F50]/50 text-white placeholder-[#A5B9FF]/70'
                      : 'border-[#DCE4F5] bg-white text-[#1F2937] placeholder-[#6C7A92]/70'
                  } rounded-lg shadow-sm focus:outline-none focus:ring-[#3A7AFF] focus:border-[#3A7AFF] text-sm`}
                  placeholder="••••••••"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0"
            >
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className={`h-4 w-4 text-[#3A7AFF] focus:ring-[#3A7AFF] ${theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} rounded`}
                />
                <label htmlFor="remember-me" className={`ml-2 block text-sm ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                  Recordarme
                </label>
              </div>

              <div className="text-sm">
                <Link to="/forgot-password" className={`font-medium ${theme === 'dark' ? 'text-[#A5B9FF] hover:text-[#5FF9B4]' : 'text-[#3A7AFF] hover:text-[#3A7AFF]/80'}`}>
                  ¿Olvidaste tu contraseña?
                </Link>
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
                disabled={isLoading}
                className={`w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white 
                  ${isLoading 
                    ? 'bg-[#3A7AFF]/50 cursor-not-allowed' 
                    : 'bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3A7AFF]/50 hover:shadow-lg hover:shadow-[#3A7AFF]/20'
                  } transition-all duration-300`}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Iniciando sesión...
                  </div>
                ) : 'Iniciar sesión'}
              </button>
            </motion.div>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            className="mt-5 sm:mt-6 text-center"
          >
            <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
              ¿No tienes una cuenta?{' '}
              <Link to="/register" className="font-medium text-[#5FF9B4] hover:text-[#5FF9B4]/80">
                Regístrate
              </Link>
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.8 }}
            className="mt-6 sm:mt-10 text-center"
          >
            <Link to="/" className={`inline-flex items-center text-xs sm:text-sm font-medium ${theme === 'dark' ? 'text-[#A5B9FF] hover:text-white' : 'text-[#6C7A92] hover:text-[#1F2937]'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Volver al inicio
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login; 
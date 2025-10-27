import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../Context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Limpiar error cuando el usuario empieza a escribir
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Usar email como username (el backend acepta ambos)
      await login(formData.email, formData.password);
      // El AuthContext se encarga de la navegación
    } catch (err) {
      console.error('Error de login:', err);
      setError(
        err.response?.status === 401
          ? 'Credenciales incorrectas. Por favor, verifica tu email y contraseña.'
          : 'Error al iniciar sesión. Por favor, intenta de nuevo.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-white via-red-50 to-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-8"
            >
              <div className="w-16 h-16 bg-[#E31E24] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-2xl">M</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Bienvenido de vuelta
              </h1>
              <p className="text-gray-600">
                Inicia sesión en tu cuenta de Menuby
              </p>
            </motion.div>

            {/* Login Form */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8"
            >
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Correo electrónico
              </label>
                <input
                    type="email"
                  id="email"
                  name="email"
                    value={formData.email}
                    onChange={handleChange}
                  required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E31E24] focus:border-[#E31E24] transition-colors duration-200 text-gray-900 bg-white placeholder-gray-400"
                    placeholder="tu@email.com"
                />
              </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
                  <div className="relative">
                <input
                      type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                      value={formData.password}
                      onChange={handleChange}
                  required
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E31E24] focus:border-[#E31E24] transition-colors duration-200 text-gray-900 bg-white placeholder-gray-400"
                      placeholder="Tu contraseña"
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

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                <input
                  type="checkbox"
                      className="w-4 h-4 text-[#E31E24] border-gray-300 rounded focus:ring-[#E31E24]"
                />
                    <span className="ml-2 text-sm text-gray-600">Recordarme</span>
                </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-[#E31E24] hover:text-[#C71A1F] font-medium"
                  >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

                {/* Error Message */}
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

                {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                  className="w-full py-3 bg-[#E31E24] hover:bg-[#C71A1F] disabled:bg-red-400 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 flex items-center justify-center"
              >
                {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Iniciando sesión...
                    </>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </button>
              </form>


              {/* Sign Up Link */}
              <div className="mt-8 text-center">
                <p className="text-gray-600">
                  ¿No tienes una cuenta?{' '}
                  <Link
                    to="/register"
                    className="text-[#E31E24] hover:text-[#C71A1F] font-semibold"
                  >
                    Regístrate gratis
              </Link>
            </p>
              </div>
          </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Login; 
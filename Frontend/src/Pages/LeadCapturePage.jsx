import React, { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const LeadCapturePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extraer el slug del pathname actual
  const slug = location.pathname.split('/').filter(Boolean)[0] || 'tu-negocio';

  // Formatear el slug para mostrarlo de forma legible
  const formatSlug = (slug) => {
    if (!slug) return 'tu negocio';
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const businessName = formatSlug(slug);

  useEffect(() => {
    // Analytics: registrar intento de acceso a URL no existente
    console.log('🎯 Lead Capture - Slug solicitado:', slug);
  }, [slug]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl w-full"
      >
        {/* Header con logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="inline-flex items-center space-x-3 mb-6"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                <span className="text-white font-bold text-2xl">M</span>
              </div>
              <div className="text-left">
                <h1 className="text-3xl font-bold text-gray-900">MenuBy</h1>
                <p className="text-sm text-gray-600">Tu menú digital en minutos</p>
              </div>
            </motion.div>
          </Link>
        </div>

        {/* Card principal */}
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Banner superior */}
          <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-1">
            <div className="bg-white rounded-t-3xl p-8 md:p-12">
              {/* Emoji animado */}
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
                className="text-6xl mb-6 text-center"
              >
                🚀
              </motion.div>

              {/* Título principal */}
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
                ¿Buscabas <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">{businessName}</span>?
              </h2>

              <p className="text-xl text-gray-600 text-center mb-8">
                ¡Este podría ser <span className="font-bold text-blue-600">tu menú digital</span>! Créalo ahora en minutos
              </p>

              {/* Características principales */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <motion.div
                  whileHover={{ y: -5 }}
                  className="text-center p-6 bg-blue-50 rounded-2xl"
                >
                  <div className="text-4xl mb-3">⚡</div>
                  <h3 className="font-bold text-gray-900 mb-2">Rápido</h3>
                  <p className="text-sm text-gray-600">Crea tu menú en menos de 5 minutos</p>
                </motion.div>

                <motion.div
                  whileHover={{ y: -5 }}
                  className="text-center p-6 bg-purple-50 rounded-2xl"
                >
                  <div className="text-4xl mb-3">💎</div>
                  <h3 className="font-bold text-gray-900 mb-2">Profesional</h3>
                  <p className="text-sm text-gray-600">Diseño moderno y atractivo</p>
                </motion.div>

                <motion.div
                  whileHover={{ y: -5 }}
                  className="text-center p-6 bg-pink-50 rounded-2xl"
                >
                  <div className="text-4xl mb-3">📱</div>
                  <h3 className="font-bold text-gray-900 mb-2">Digital</h3>
                  <p className="text-sm text-gray-600">Accesible desde cualquier dispositivo</p>
                </motion.div>
              </div>

              {/* CTA principal */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to="/register"
                  className="block w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white text-center py-5 px-8 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  🎉 Crear Mi Menú Ahora - Es Gratis
                </Link>
              </motion.div>

              {/* Texto secundario */}
              <p className="text-center text-gray-500 text-sm mt-6">
                ✨ Sin tarjeta de crédito • ⚡ Configuración instantánea • 🎯 URL personalizada
              </p>
            </div>
          </div>

          {/* Beneficios adicionales */}
          <div className="bg-gray-50 p-8 md:p-12">
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
              ¿Por qué MenuBy?
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Pedidos en Tiempo Real</h4>
                  <p className="text-sm text-gray-600">Recibe pedidos directamente en tu panel</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🎨</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Personalización Total</h4>
                  <p className="text-sm text-gray-600">Colores, logo y diseño a tu medida</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Panel de Control</h4>
                  <p className="text-sm text-gray-600">Gestiona productos, pedidos y más</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🔗</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Tu URL Personalizada</h4>
                  <p className="text-sm text-gray-600">
                    menuby.com/<span className="font-semibold text-blue-600">{slug || 'tu-negocio'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* CTA secundario */}
            <div className="mt-8 text-center">
              <button
                onClick={() => navigate('/restaurantes')}
                className="text-blue-600 hover:text-blue-700 font-semibold underline"
              >
                Ver restaurantes que ya usan MenuBy →
              </button>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-600">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LeadCapturePage;


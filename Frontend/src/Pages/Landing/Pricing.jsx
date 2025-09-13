import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useTheme } from '../../Context/ThemeContext';

const Pricing = () => {
  const { theme } = useTheme();
  const heroRef = useRef(null);
  const planRef = useRef(null);
  const faqRef = useRef(null);
  
  const isHeroInView = useInView(heroRef, { once: true, amount: 0.3 });
  const isPlanInView = useInView(planRef, { once: true, amount: 0.3 });
  const isFaqInView = useInView(faqRef, { once: true, amount: 0.3 });

  const plan = {
    name: 'Menuby Complete',
    subtitle: 'Todo lo que necesitas para digitalizar tu restaurante',
    description: 'Plan único que incluye todas las funcionalidades disponibles sin restricciones ni límites',
    features: [
      {
        category: '🍽️ Gestión de Pedidos',
        items: [
          'Pedidos ilimitados en tiempo real',
          'Pedidos en mesa, para llevar y delivery',
          'Notificaciones automáticas con sonido',
          'Panel de cocina profesional',
          'Estados de pedidos actualizados automáticamente'
        ]
      },
      {
        category: '📱 Menú Digital',
        items: [
          'Menú completamente personalizable',
          'Categorías y productos ilimitados',
          'Sistema de ingredientes y extras avanzado',
          'Imágenes de productos de alta calidad',
          'Precios dinámicos y promociones'
        ]
      },
      {
        category: '👥 Experiencia del Cliente',
        items: [
          'Códigos QR únicos para cada mesa',
          'Interfaz móvil sin necesidad de app',
          'Carrito de compras inteligente',
          'Personalización completa de productos',
          'Confirmación y seguimiento de pedidos'
        ]
      },
      {
        category: '⚙️ Administración',
        items: [
          'Panel de administración completo',
          'Gestión de mesas y códigos QR',
          'Configuración completa del negocio',
          'Múltiples usuarios y roles',
          'Personalización total de marca'
        ]
      },
      {
        category: '📊 Analíticas y Reportes',
        items: [
          'Dashboard de métricas en tiempo real',
          'Reportes de ventas detallados en PDF',
          'Historial completo de pedidos',
          'Métricas de rendimiento y eficiencia',
          'Análisis de productos más populares'
        ]
      },
      {
        category: '🚀 Tecnología Avanzada',
        items: [
          'Comunicación en tiempo real (WebSocket)',
          'Arquitectura multi-restaurante',
          'Respaldo automático de todos los datos',
          'Actualizaciones automáticas del sistema',
          'Seguridad empresarial SSL incluida'
        ]
      }
    ],
    included: [
      '✅ Configuración inicial completamente gratuita',
      '✅ Soporte técnico completo 24/7',
      '✅ Todas las actualizaciones incluidas',
      '✅ Respaldo automático de datos',
      '✅ Certificado SSL y seguridad empresarial',
      '✅ Sin límite de usuarios administradores',
      '✅ Sin límite de productos en el menú',
      '✅ Sin límite de pedidos mensuales',
      '✅ Sin límite de mesas o códigos QR',
      '✅ Personalización completa de marca'
    ]
  };

  const faqs = [
    {
      question: '¿Cómo funciona el sistema de pedidos?',
      answer: 'Los clientes escanean el código QR de su mesa, acceden al menú digital, personalizan sus productos y realizan el pedido. Tú recibes notificaciones inmediatas y puedes gestionar todo desde el panel de administración.'
    },
    {
      question: '¿Necesito instalar alguna aplicación?',
      answer: 'No, ni tú ni tus clientes necesitan descargar aplicaciones. Todo funciona desde el navegador web, tanto en computadoras como en dispositivos móviles.'
    },
    {
      question: '¿Puedo personalizar el diseño para mi restaurante?',
      answer: 'Sí, puedes personalizar completamente el logo, colores, información de contacto, redes sociales y toda la presentación para que coincida con la identidad de tu marca.'
    },
    {
      question: '¿Qué incluye el soporte técnico?',
      answer: 'Incluye configuración inicial gratuita, soporte técnico completo, resolución de problemas, actualizaciones automáticas y asistencia para optimizar el uso del sistema.'
    },
    {
      question: '¿Hay límites en el número de pedidos o productos?',
      answer: 'No hay límites. Puedes recibir pedidos ilimitados, crear productos ilimitados, tener múltiples usuarios y gestionar tantas mesas como necesites.'
    },
    {
      question: '¿Cómo empiezo a usar Menuby?',
      answer: 'Solo regístrate, configura tu restaurante con nuestra ayuda, carga tu menú y comienza a recibir pedidos. El proceso de configuración es rápido y sencillo.'
    }
  ];

  return (
    <div className={`min-h-screen pt-24 pb-20 ${theme === 'dark' ? 'bg-[#051C2C]' : 'bg-[#F4F7FB]'}`}>
      {/* Hero Section */}
      <section ref={heroRef} className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            <div className="inline-block bg-[#3A7AFF]/20 text-[#3A7AFF] px-4 py-2 rounded-full text-sm font-semibold mb-6">
              SOLUCIÓN EMPRESARIAL COMPLETA
            </div>
            
            <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
              La solución completa para
              <span className="bg-gradient-to-r from-[#3A7AFF] to-[#5FF9B4] bg-clip-text text-transparent"> tu restaurante</span>
            </h1>
            
            <p className={`text-xl sm:text-2xl mb-8 ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} max-w-3xl mx-auto`}>
              Sistema profesional con todas las funcionalidades que necesitas para digitalizar y optimizar tu negocio.
            </p>
          
          <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  to="/contact"
                  className="bg-gradient-to-r from-[#3A7AFF] to-[#5FF9B4] hover:from-[#3A7AFF]/90 hover:to-[#5FF9B4]/90 text-white py-4 px-8 rounded-lg font-bold inline-block transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Solicitar información
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  to="/register"
                  className={`border-2 border-[#3A7AFF] text-[#3A7AFF] hover:bg-[#3A7AFF] hover:text-white py-4 px-8 rounded-lg font-bold inline-block transition-all duration-300 ${theme === 'dark' ? 'hover:text-white' : ''}`}
                >
                  Ver demo
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Main Plan Section */}
      <section ref={planRef} className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isPlanInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="max-w-6xl mx-auto"
          >
            {/* Plan Card */}
            <div className={`${theme === 'dark' ? 'bg-[#333F50]/30' : 'bg-white'} rounded-3xl shadow-2xl border ${theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} overflow-hidden`}>
              {/* Header */}
              <div className="bg-gradient-to-r from-[#3A7AFF] to-[#5FF9B4] p-8 sm:p-12 text-center text-white">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">{plan.name}</h2>
                <p className="text-xl mb-6 opacity-90">{plan.subtitle}</p>
                <div className="text-4xl sm:text-5xl font-bold mb-2">Solicita información</div>
                <div className="text-xl opacity-90">Precio personalizado según tus necesidades</div>
        </div>
        
              {/* Content */}
              <div className="p-8 sm:p-12">
                <p className={`text-lg ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} mb-8 text-center`}>
                  {plan.description}
                </p>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                  {plan.features.map((category, index) => (
        <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={isPlanInView ? { opacity: 1, y: 0 } : {}}
                      transition={{ duration: 0.5, delay: 0.1 * index }}
                      className={`${theme === 'dark' ? 'bg-[#051C2C]/50' : 'bg-[#F4F7FB]'} rounded-xl p-6`}
                    >
                      <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
                        {category.category}
                      </h3>
                      <ul className="space-y-2">
                        {category.items.map((item, idx) => (
                          <li key={idx} className="flex items-start">
                            <svg className="w-5 h-5 text-[#5FF9B4] mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className={`text-sm ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </div>

                {/* What's Included */}
                <div className={`${theme === 'dark' ? 'bg-[#051C2C]/30' : 'bg-[#F4F7FB]/50'} rounded-2xl p-8 mb-8`}>
                  <h3 className={`text-2xl font-bold mb-6 text-center ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
                    Todo esto está incluido
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {plan.included.map((item, index) => (
                      <div key={index} className="flex items-center">
                        <span className={`${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
          </div>
          
                {/* CTA */}
                <div className="text-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/contact"
                      className="bg-gradient-to-r from-[#3A7AFF] to-[#5FF9B4] hover:from-[#3A7AFF]/90 hover:to-[#5FF9B4]/90 text-white py-4 px-12 rounded-lg font-bold inline-block transition-all duration-300 shadow-lg hover:shadow-xl text-lg"
              >
                      Solicitar información
              </Link>
            </motion.div>
                  <p className={`mt-4 text-sm ${theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'}`}>
                    Consulta personalizada • Configuración incluida • Soporte completo
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section ref={faqRef} className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isFaqInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
                Preguntas frecuentes
              </h2>
              <p className={`text-xl ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                Resolvemos las dudas más comunes sobre Menuby
              </p>
            </div>

            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isFaqInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                  className={`${theme === 'dark' ? 'bg-[#333F50]/30' : 'bg-white'} rounded-xl p-6 border ${theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'}`}
                >
                  <h3 className={`text-lg font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
                    {faq.question}
                  </h3>
                  <p className={theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}>
                    {faq.answer}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className={`${theme === 'dark' ? 'bg-[#333F50]/30' : 'bg-white'} rounded-3xl p-8 sm:p-12 border ${theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} shadow-2xl`}>
              <h2 className={`text-3xl sm:text-4xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
                ¿Listo para transformar tu restaurante?
              </h2>
              <p className={`text-xl mb-8 ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                Únete a los restaurantes que ya están mejorando su operación con Menuby
              </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
                <Link
                  to="/contact"
                  className="bg-gradient-to-r from-[#3A7AFF] to-[#5FF9B4] hover:from-[#3A7AFF]/90 hover:to-[#5FF9B4]/90 text-white py-4 px-12 rounded-lg font-bold inline-block transition-all duration-300 shadow-lg hover:shadow-xl text-lg"
                >
                  Solicitar información
                </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
      </section>
    </div>
  );
};

export default Pricing; 
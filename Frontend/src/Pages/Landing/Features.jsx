import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import CTA from '../../Components/Landing/CTA';

const Features = () => {
  const featuresRef = useRef(null);
  const isFeaturesInView = useInView(featuresRef, { once: true, amount: 0.2 });

  const features = [
    {
      icon: "📱",
      title: "Menú Digital Interactivo",
      description: "Crea menús atractivos con fotos profesionales, descripciones detalladas y precios actualizados en tiempo real."
    },
    {
      icon: "🛒",
      title: "Pedidos Directos",
      description: "Los clientes ordenan directamente desde su mesa sin necesidad de descargar aplicaciones o esperar meseros."
    },
    {
      icon: "📊",
      title: "Analytics en Tiempo Real",
      description: "Monitorea ventas, productos más populares, horarios pico y rendimiento de tu restaurante con datos precisos."
    },
    {
      icon: "👨‍🍳",
      title: "Gestión de Cocina",
      description: "Pantalla dedicada para cocina con órdenes organizadas por tiempo, mesa y prioridad para máxima eficiencia."
    },
    {
      icon: "📲",
      title: "QR Code Instantáneo",
      description: "Genera códigos QR únicos para cada mesa. Los clientes escanean y ordenan al instante desde su dispositivo."
    },
    {
      icon: "🔒",
      title: "Seguro y Confiable",
      description: "Protección de datos y transacciones seguras. Cumplimiento con estándares internacionales de seguridad."
    }
  ];

  const stats = [
    { value: '98%', label: 'Satisfacción del cliente' },
    { value: '+45%', label: 'Aumento en ventas' },
    { value: '-60%', label: 'Tiempo de espera' },
    { value: '24/7', label: 'Soporte disponible' }
  ];

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: (custom) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay: custom * 0.1,
        ease: [0.25, 0.1, 0.25, 1.0]
      }
    })
  };

  return (
    <div className="min-h-screen bg-white">
      
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-white via-red-50 to-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <div className="inline-flex items-center px-4 py-2 bg-red-100 text-green-800 rounded-full text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                Características profesionales
        </div>
            </motion.div>

          <motion.h1
              initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl md:text-6xl font-bold text-gray-900 mb-6"
          >
              Todo lo que necesitas para tu restaurante
          </motion.h1>

          <motion.p
              initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto"
          >
              Una plataforma completa que incluye todas las herramientas necesarias 
              para modernizar tu restaurante y aumentar tus ventas.
          </motion.p>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-[#E31E24] mb-2">{stat.value}</div>
                  <div className="text-sm md:text-base text-gray-600">{stat.label}</div>
                      </div>
          ))}
        </motion.div>
      </div>
      </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Características principales
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Descubre cómo nuestro sistema puede transformar la operación de tu restaurante
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                custom={index}
                variants={fadeUpVariants}
                initial="hidden"
                animate={isFeaturesInView ? "visible" : "hidden"}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
              >
                <div className="text-4xl mb-6">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTA />
    </div>
  );
};

export default Features; 
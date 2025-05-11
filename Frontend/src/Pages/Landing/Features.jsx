import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../Context/ThemeContext';

const Features = () => {
  const [activeTab, setActiveTab] = useState('operations');
  const { theme, colors } = useTheme();

  const featureCategories = [
    { id: 'operations', name: 'Operaciones', icon: '⚙️' },
    { id: 'customer', name: 'Experiencia del cliente', icon: '👥' },
    { id: 'analytics', name: 'Analíticas', icon: '📊' },
    { id: 'management', name: 'Administración', icon: '🏢' }
  ];

  const features = {
    operations: [
      {
        title: 'Gestión de pedidos simplificada',
        description: 'Recibe, organiza y procesa pedidos sin complicaciones, reduciendo errores y mejorando la eficiencia.',
        icon: '📋'
      },
      {
        title: 'Interfaz para cocina',
        description: 'Panel intuitivo para el personal de cocina que muestra pedidos en tiempo real con tiempos de preparación.',
        icon: '👨‍🍳'
      },
      {
        title: 'Gestión de inventario',
        description: 'Seguimiento automatizado de ingredientes y suministros para evitar quiebres de stock y reducir desperdicios.',
        icon: '📦'
      },
      {
        title: 'Personalización de menús',
        description: 'Adapta fácilmente tus menús según la temporada, disponibilidad o eventos especiales.',
        icon: '🍽️'
      }
    ],
    customer: [
      {
        title: 'Pedidos móviles',
        description: 'Permite a tus clientes hacer pedidos desde sus dispositivos sin necesidad de descargar aplicaciones.',
        icon: '📱'
      },
      {
        title: 'Sistema de fidelización',
        description: 'Recompensa a tus clientes frecuentes con puntos, descuentos y promociones personalizadas.',
        icon: '🎁'
      },
      {
        title: 'Feedback en tiempo real',
        description: 'Recibe opiniones inmediatas de tus clientes para mejorar continuamente tu servicio.',
        icon: '💬'
      },
      {
        title: 'Reservaciones online',
        description: 'Sistema integrado de reservas que se sincroniza automáticamente con tu capacidad y horarios.',
        icon: '📅'
      }
    ],
    analytics: [
      {
        title: 'Dashboards en tiempo real',
        description: 'Visualiza el rendimiento de tu restaurante con métricas actualizadas constantemente.',
        icon: '📈'
      },
      {
        title: 'Informes de ventas',
        description: 'Reportes detallados de ventas por período, categoría, producto y método de pago.',
        icon: '💰'
      },
      {
        title: 'Análisis de comportamiento',
        description: 'Comprende mejor a tus clientes con datos sobre sus preferencias y patrones de compra.',
        icon: '🔍'
      },
      {
        title: 'Predicciones de demanda',
        description: 'Anticipa períodos de alta demanda para optimizar tu personal y abastecimiento.',
        icon: '🔮'
      }
    ],
    management: [
      {
        title: 'Gestión de empleados',
        description: 'Administra horarios, roles y permisos de tu personal desde una interfaz centralizada.',
        icon: '👥'
      },
      {
        title: 'Múltiples ubicaciones',
        description: 'Controla todas tus sucursales desde una única plataforma con configuraciones específicas para cada local.',
        icon: '🏙️'
      },
      {
        title: 'Reportes financieros',
        description: 'Genera automáticamente informes de ingresos, gastos y ganancias para períodos específicos.',
        icon: '📊'
      },
      {
        title: 'Integración con proveedores',
        description: 'Conecta directamente con tus proveedores para automatizar pedidos y reabastecimiento.',
        icon: '🤝'
      }
    ]
  };

  return (
    <div className={`min-h-screen pt-24 pb-20 ${theme === 'dark' ? 'bg-[#051C2C]' : 'bg-[#F4F7FB]'} ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
      {/* Header */}
      <div className="py-16">
        <div className="container mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className={`text-4xl md:text-5xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'} mb-4`}
          >
            Características y capacidades
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`text-xl ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} max-w-3xl mx-auto`}
          >
            Descubre todas las herramientas que tenemos para potenciar tu restaurante
          </motion.p>
        </div>
      </div>

      {/* Features Content */}
      <div className="container mx-auto px-4 py-16">
        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {featureCategories.map((category) => (
            <motion.button
              key={category.id}
              onClick={() => setActiveTab(category.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`flex items-center px-6 py-3 rounded-full text-lg font-medium transition-colors duration-300 ${
                activeTab === category.id
                  ? 'bg-[#3A7AFF] text-white shadow-md shadow-[#3A7AFF]/20'
                  : theme === 'dark' 
                    ? 'bg-[#333F50] text-[#D1D9FF] hover:bg-[#333F50]/80' 
                    : 'bg-white text-[#6C7A92] hover:bg-gray-50 border border-[#DCE4F5]'
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.name}
            </motion.button>
          ))}
        </div>

        {/* Feature Grid */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {features[activeTab].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`${theme === 'dark' ? 'bg-[#333F50]' : 'bg-white border border-[#DCE4F5]'} rounded-xl shadow-md ${theme === 'dark' ? 'shadow-black/20' : 'shadow-gray-200/50'} overflow-hidden hover:shadow-lg transition-shadow duration-300`}
            >
              <div className="p-8">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className={`text-xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>{feature.title}</h3>
                <p className={theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'}>{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Integration Section */}
      <div className={theme === 'dark' ? 'bg-[#051C2C]/50' : 'bg-white'}>
        <div className="container mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className={`text-3xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>Integraciones y compatibilidad</h2>
            <p className={`text-xl ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} max-w-3xl mx-auto`}>
              Nuestro sistema se conecta perfectamente con las herramientas que ya utilizas
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
            {[
              'Procesadores de pago',
              'Servicios de entrega',
              'Contabilidad',
              'CRM',
              'POS',
              'Marketing por email',
              'Redes sociales',
              'Proveedores',
              'Servicios en la nube',
              'Aplicaciones móviles',
              'Impresoras térmicas',
              'Sistemas de inventario'
            ].map((integration, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={`${theme === 'dark' ? 'bg-[#333F50]' : 'bg-[#F4F7FB] border border-[#DCE4F5]'} rounded-lg shadow-sm p-6 flex items-center justify-center text-center`}
              >
                <p className={theme === 'dark' ? 'text-[#A5B9FF] font-medium' : 'text-[#6C7A92] font-medium'}>{integration}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Call-to-Action */}
      <div className="py-16 mt-16">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className={`text-3xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>¿Listo para transformar tu restaurante?</h2>
            <p className={`text-xl mb-10 ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} max-w-3xl mx-auto`}>
              Comienza hoy mismo y descubre cómo nuestra plataforma puede impulsar tu negocio
            </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block"
            >
              <a
                href="/register"
                className={`bg-[#5FF9B4] ${theme === 'dark' ? 'text-[#051C2C]' : 'text-[#1F2937]'} font-bold py-3 px-8 rounded-full inline-block hover:bg-[#5FF9B4]/90 hover:shadow-lg hover:shadow-[#5FF9B4]/20 transition duration-300`}
              >
                Comenzar prueba gratuita
              </a>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Features; 
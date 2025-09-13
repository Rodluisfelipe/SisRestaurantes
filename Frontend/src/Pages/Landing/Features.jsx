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
        title: 'Gestión de pedidos en tiempo real',
        description: 'Sistema completo de pedidos con seguimiento desde la recepción hasta la entrega. Notificaciones automáticas y estados actualizados.',
        icon: '📋',
        highlights: ['Pedidos en mesa', 'Para llevar', 'Delivery', 'Notificaciones sonoras']
      },
      {
        title: 'Interfaz profesional para cocina',
        description: 'Dashboard especializado para cocina con vista de pedidos activos, tiempos de preparación y control de estados.',
        icon: '👨‍🍳',
        highlights: ['Vista en tiempo real', 'Control de estados', 'Tiempos de preparación', 'Organización automática']
      },
      {
        title: 'Sistema de mesas inteligente',
        description: 'Gestión completa de mesas con códigos QR únicos para cada mesa y validación automática.',
        icon: '🪑',
        highlights: ['Códigos QR únicos', 'Validación automática', 'Gestión de capacidad', 'Estados de mesa']
      },
      {
        title: 'Menús dinámicos y personalizables',
        description: 'Crea y gestiona menús completamente personalizables con categorías, productos y opciones de ingredientes.',
        icon: '🍽️',
        highlights: ['Categorías ilimitadas', 'Productos personalizables', 'Ingredientes extras', 'Precios dinámicos']
      },
      {
        title: 'Sistema de toppings avanzado',
        description: 'Configura grupos de ingredientes con opciones múltiples, precios adicionales y subgrupos organizados.',
        icon: '🧄',
        highlights: ['Grupos de ingredientes', 'Opciones múltiples', 'Precios personalizados', 'Subgrupos organizados']
      },
      {
        title: 'Multi-negocio (Multi-tenant)',
        description: 'Una sola instalación puede manejar múltiples restaurantes con configuraciones independientes.',
        icon: '🏢',
        highlights: ['Múltiples restaurantes', 'Configuración independiente', 'Administración centralizada', 'Escalabilidad']
      }
    ],
    customer: [
      {
        title: 'Experiencia móvil sin app',
        description: 'Tus clientes pueden ordenar directamente desde sus teléfonos escaneando el código QR de la mesa, sin descargar aplicaciones.',
        icon: '📱',
        highlights: ['Sin descargas', 'Acceso por QR', 'Responsive design', 'Experiencia nativa']
      },
      {
        title: 'Carrito de compras inteligente',
        description: 'Sistema de carrito avanzado con personalización de productos, cálculo automático de precios y resumen detallado.',
        icon: '🛒',
        highlights: ['Personalización completa', 'Cálculo automático', 'Resumen detallado', 'Guardado temporal']
      },
      {
        title: 'Selector de tipo de pedido',
        description: 'Los clientes pueden elegir entre comer en el restaurante, llevar o delivery con información específica para cada tipo.',
        icon: '🎯',
        highlights: ['En mesa', 'Para llevar', 'Delivery', 'Información específica']
      },
      {
        title: 'Interfaz moderna y accesible',
        description: 'Diseño moderno, intuitivo y accesible que funciona perfectamente en cualquier dispositivo móvil.',
        icon: '✨',
        highlights: ['Diseño moderno', 'Totalmente responsive', 'Accesible', 'Carga rápida']
      },
      {
        title: 'Confirmación de pedidos',
        description: 'Sistema de confirmación con detalles completos del pedido, tiempo estimado y seguimiento en tiempo real.',
        icon: '✅',
        highlights: ['Confirmación detallada', 'Tiempo estimado', 'Seguimiento en vivo', 'Notificaciones']
      },
      {
        title: 'Personalización de marca',
        description: 'Cada restaurante puede personalizar completamente su menú digital con logo, colores y estilo único.',
        icon: '🎨',
        highlights: ['Logo personalizado', 'Colores de marca', 'Temas personalizables', 'Identidad única']
      }
    ],
    analytics: [
      {
        title: 'Dashboard de pedidos en vivo',
        description: 'Visualiza todos los pedidos activos en tiempo real con estados, tiempos y detalles completos.',
        icon: '📈',
        highlights: ['Pedidos en vivo', 'Estados actualizados', 'Tiempos de preparación', 'Métricas en tiempo real']
      },
      {
        title: 'Reportes de ventas diarios',
        description: 'Genera reportes detallados de ventas con estadísticas por tipo de pedido, productos más vendidos y totales.',
        icon: '💰',
        highlights: ['Reportes PDF', 'Ventas por tipo', 'Productos populares', 'Estadísticas detalladas']
      },
      {
        title: 'Historial de pedidos completados',
        description: 'Accede al historial completo de pedidos con búsqueda, filtros y exportación de datos.',
        icon: '📊',
        highlights: ['Historial completo', 'Búsqueda avanzada', 'Filtros múltiples', 'Exportación de datos']
      },
      {
        title: 'Métricas de rendimiento',
        description: 'Analiza el rendimiento de tu restaurante con estadísticas de eficiencia, tiempos promedio y productividad.',
        icon: '⚡',
        highlights: ['Tiempo promedio', 'Eficiencia operativa', 'Productividad', 'Análisis de tendencias']
      },
      {
        title: 'Notificaciones inteligentes',
        description: 'Recibe notificaciones automáticas por nuevos pedidos con sonidos personalizables y alertas visuales.',
        icon: '🔔',
        highlights: ['Notificaciones sonoras', 'Alertas visuales', 'Configuración personalizable', 'Múltiples dispositivos']
      },
      {
        title: 'Análisis de productos',
        description: 'Comprende qué productos son más populares, en qué horarios y con qué combinaciones de ingredientes.',
        icon: '🔍',
        highlights: ['Productos populares', 'Análisis temporal', 'Combinaciones exitosas', 'Insights de negocio']
      }
    ],
    management: [
      {
        title: 'Panel de administración completo',
        description: 'Interfaz administrativa completa para gestionar todos los aspectos de tu restaurante desde un solo lugar.',
        icon: '⚙️',
        highlights: ['Gestión centralizada', 'Interfaz intuitiva', 'Configuración avanzada', 'Control total']
      },
      {
        title: 'Gestión de productos y categorías',
        description: 'Crea, edita y organiza productos con categorías, precios, descripciones e imágenes de manera sencilla.',
        icon: '📝',
        highlights: ['CRUD completo', 'Categorías organizadas', 'Imágenes de productos', 'Precios dinámicos']
      },
      {
        title: 'Configuración de negocio',
        description: 'Personaliza completamente tu restaurante: nombre, logo, colores, información de contacto y redes sociales.',
        icon: '🏢',
        highlights: ['Personalización completa', 'Logo y colores', 'Información de contacto', 'Redes sociales']
      },
      {
        title: 'Gestión de mesas y QR',
        description: 'Administra las mesas de tu restaurante y genera códigos QR únicos para cada mesa automáticamente.',
        icon: '🪑',
        highlights: ['Gestión de mesas', 'QR automáticos', 'Capacidad configurable', 'Estados en tiempo real']
      },
      {
        title: 'Sistema de autenticación',
        description: 'Control de acceso seguro con diferentes niveles de permisos para administradores y personal.',
        icon: '🔐',
        highlights: ['Acceso seguro', 'Múltiples usuarios', 'Roles y permisos', 'Cambio de contraseñas']
      },
      {
        title: 'SuperAdmin para múltiples negocios',
        description: 'Panel de super administración para gestionar múltiples restaurantes desde una sola cuenta.',
        icon: '👑',
        highlights: ['Múltiples restaurantes', 'Gestión centralizada', 'Creación de negocios', 'Administración global']
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
                <p className={`${theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'} mb-4`}>{feature.description}</p>
                {feature.highlights && (
                  <div className="space-y-2">
                    {feature.highlights.map((highlight, idx) => (
                      <div key={idx} className="flex items-center">
                        <svg className="w-4 h-4 text-[#5FF9B4] mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className={`text-sm ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                          {highlight}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
              'Whatsapp',
              'Redes sociales'
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
                Comenzar gratis ahora
              </a>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Features; 
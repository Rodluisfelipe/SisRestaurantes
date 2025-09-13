import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useTheme } from '../../Context/ThemeContext';

const UseCases = () => {
  const { theme } = useTheme();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  const useCases = [
    {
      title: 'Restaurantes tradicionales',
      description: 'Digitaliza tu restaurante manteniendo la esencia tradicional',
      icon: '🍽️',
      color: 'from-amber-500 to-orange-500',
      features: [
        'Menú digital elegante',
        'Pedidos desde la mesa',
        'Gestión de cocina profesional',
        'Reportes de ventas detallados'
      ],
      example: 'Restaurante familiar con 15 mesas aumentó eficiencia en 40%'
    },
    {
      title: 'Cafeterías y bistrós',
      description: 'Perfecto para establecimientos de comida rápida y casual',
      icon: '☕',
      color: 'from-brown-500 to-amber-600',
      features: [
        'Pedidos rápidos para llevar',
        'Menú de bebidas especializado',
        'Personalización de productos',
        'Sistema de turnos integrado'
      ],
      example: 'Cafetería boutique triplicó pedidos para llevar'
    },
    {
      title: 'Food trucks',
      description: 'Movilidad total con gestión digital completa',
      icon: '🚚',
      color: 'from-green-500 to-teal-500',
      features: [
        'Menú móvil y adaptable',
        'Pedidos por ubicación',
        'Gestión desde cualquier lugar',
        'Notificaciones en tiempo real'
      ],
      example: 'Food truck gourmet aumentó ventas en 60% con pedidos digitales'
    },
    {
      title: 'Bares y pubs',
      description: 'Gestión especializada para establecimientos nocturnos',
      icon: '🍺',
      color: 'from-purple-500 to-indigo-500',
      features: [
        'Carta de bebidas completa',
        'Pedidos desde la mesa',
        'Gestión de eventos especiales',
        'Control de inventario de bebidas'
      ],
      example: 'Pub irlandés mejoró servicio y redujo esperas en 50%'
    },
    {
      title: 'Pizzerías',
      description: 'Especializado en pedidos con múltiples ingredientes',
      icon: '🍕',
      color: 'from-red-500 to-pink-500',
      features: [
        'Constructor de pizzas avanzado',
        'Múltiples tamaños y masas',
        'Ingredientes ilimitados',
        'Delivery y pickup optimizado'
      ],
      example: 'Pizzería artesanal duplicó pedidos online con sistema de ingredientes'
    },
    {
      title: 'Cadenas de restaurantes',
      description: 'Multi-tenant para múltiples ubicaciones',
      icon: '🏢',
      color: 'from-blue-500 to-cyan-500',
      features: [
        'Gestión centralizada',
        'Múltiples ubicaciones',
        'Reportes consolidados',
        'Configuración por sucursal'
      ],
      example: 'Cadena de 5 restaurantes unificó operaciones y redujo costos'
    }
  ];

  const testimonials = [
    {
      name: 'María González',
      role: 'Propietaria de "La Mesa Redonda"',
      content: 'Menuby transformó completamente nuestro servicio. Los clientes aman poder ver fotos de los platos y personalizar sus pedidos. Nuestras ventas aumentaron 35% en solo 2 meses.',
      avatar: '👩‍🍳',
      rating: 5,
      location: 'Madrid, España'
    },
    {
      name: 'Carlos Ramírez',
      role: 'Chef ejecutivo "Sabores del Mar"',
      content: 'La interfaz de cocina es increíble. Podemos ver todos los pedidos en tiempo real, organizar la preparación y mantener informados a los clientes. Revolucionó nuestra operación.',
      avatar: '👨‍🍳',
      rating: 5,
      location: 'Barcelona, España'
    },
    {
      name: 'Ana Martínez',
      role: 'Gerente "Coffee & Co"',
      content: 'Implementamos Menuby en nuestras 3 cafeterías. El sistema multi-negocio nos permite gestionar todo desde un solo lugar. Excelente soporte técnico y configuración súper fácil.',
      avatar: '👩‍💼',
      rating: 5,
      location: 'Valencia, España'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 30,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.4, 0.0, 0.2, 1]
      }
    }
  };

  return (
    <section 
      ref={sectionRef}
      className={`py-20 ${theme === 'dark' ? 'bg-[#051C2C]' : 'bg-[#F4F7FB]'} relative overflow-hidden`}
    >
      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="inline-block bg-[#5FF9B4]/20 text-[#5FF9B4] px-4 py-2 rounded-full text-sm font-semibold mb-6">
            CASOS DE USO REALES
          </div>
          <h2 className={`text-4xl sm:text-5xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
            Perfecto para cualquier
            <span className="bg-gradient-to-r from-[#3A7AFF] to-[#5FF9B4] bg-clip-text text-transparent"> tipo de negocio</span>
          </h2>
          <p className={`text-xl max-w-3xl mx-auto ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
            Desde restaurantes familiares hasta cadenas grandes, Menuby se adapta a tus necesidades específicas
          </p>
        </motion.div>

        {/* Use Cases Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20"
        >
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              variants={cardVariants}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className={`${theme === 'dark' ? 'bg-[#333F50]/30' : 'bg-white'} rounded-2xl p-6 border ${theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} shadow-lg hover:shadow-2xl transition-all duration-300 group`}
            >
              {/* Icon and Title */}
              <div className="mb-6">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${useCase.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  {useCase.icon}
                </div>
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'} mb-2`}>
                  {useCase.title}
                </h3>
                <p className={`${theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'} mb-4`}>
                  {useCase.description}
                </p>
              </div>

              {/* Features */}
              <div className="mb-6">
                <ul className="space-y-2">
                  {useCase.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center">
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${useCase.color} mr-3 flex-shrink-0`} />
                      <span className={`text-sm ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Example */}
              <div className={`${theme === 'dark' ? 'bg-[#051C2C]/50' : 'bg-[#F4F7FB]'} rounded-lg p-4 border-l-4 border-gradient-to-b ${useCase.color}`}>
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-[#5FF9B4]' : 'text-[#3A7AFF]'}`}>
                  Caso de éxito:
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} mt-1`}>
                  {useCase.example}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="text-center mb-12">
            <h3 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'} mb-4`}>
              Lo que dicen nuestros clientes
            </h3>
            <p className={`text-lg ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
              Testimonios reales de restaurantes que ya usan Menuby
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.5 + (index * 0.1) }}
                className={`${theme === 'dark' ? 'bg-[#333F50]/30' : 'bg-white'} rounded-2xl p-6 border ${theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} shadow-lg relative`}
              >
                {/* Quote Icon */}
                <div className="absolute -top-3 -left-3 w-6 h-6 bg-[#3A7AFF] rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 10c0-2 1-4 4-4 2 0 4 1 4 4 0 2-1 4-4 4-2 0-4-1-4-4zm10 0c0-2 1-4 4-4 2 0 4 1 4 4 0 2-1 4-4 4-2 0-4-1-4-4z" />
                  </svg>
                </div>

                {/* Rating */}
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-[#5FF9B4]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* Content */}
                <p className={`${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} mb-6 italic`}>
                  "{testimonial.content}"
                </p>

                {/* Author */}
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#3A7AFF] to-[#5FF9B4] flex items-center justify-center text-2xl mr-4">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
                      {testimonial.name}
                    </h4>
                    <p className={`text-sm ${theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'}`}>
                      {testimonial.role}
                    </p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'} mt-1`}>
                      📍 {testimonial.location}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default UseCases;

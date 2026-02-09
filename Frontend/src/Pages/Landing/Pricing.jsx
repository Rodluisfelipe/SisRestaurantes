import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import CTA from '../../Components/Landing/CTA';

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const pricingRef = useRef(null);
  const isPricingInView = useInView(pricingRef, { once: true, amount: 0.3 });

  const features = [
    "Menú digital ilimitado con fotos HD",
    "Códigos QR únicos para cada mesa",
    "Sistema de pedidos en tiempo real",
    "Pantalla de cocina dedicada",
    "Analytics y reportes detallados",
    "Soporte técnico 24/7",
    "Actualizaciones automáticas",
    "Backup de datos diario",
    "Integración con WhatsApp",
    "Gestión de inventario básica",
    "Reportes de ventas en tiempo real",
    "Soporte multi-idioma"
  ];

  const benefits = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      title: "Aumento promedio del 45% en ventas",
      description: "Los menús digitales aumentan significativamente las ventas promedio por mesa."
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Reducción del 60% en tiempo de espera",
      description: "Los pedidos llegan directamente a cocina, eliminando intermediarios."
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      title: "Mejora del 98% en satisfacción del cliente",
      description: "Experiencia más rápida y conveniente para tus clientes."
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "ROI positivo desde el primer mes",
      description: "Recupera tu inversión rápidamente con el aumento en ventas."
    }
  ];

  const testimonials = [
    {
      name: "María González",
      role: "Propietaria, Restaurante El Buen Sabor",
      content: "En solo 2 meses recuperamos la inversión. Las ventas aumentaron un 50% y los clientes están más satisfechos.",
      avatar: "👩‍🍳"
    },
    {
      name: "Carlos Rodríguez",
      role: "Gerente, Café Central",
      content: "El mejor ROI que hemos tenido en años. Menuby se paga solo con el aumento en ventas.",
      avatar: "👨‍💼"
    }
  ];

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
                Plan único, máximo valor
            </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl md:text-6xl font-bold text-gray-900 mb-6"
            >
              Inversión que se paga sola
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto"
            >
              Un solo plan que incluye todo lo que necesitas para transformar tu restaurante. 
              Sin complicaciones, sin límites, sin sorpresas.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Pricing Card */}
      <section ref={pricingRef} className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isPricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="max-w-5xl mx-auto"
          >
            <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border-4 border-green-200 relative overflow-hidden">
              {/* Badge */}
              <div className="absolute top-0 right-0 bg-[#E31E24] text-white px-6 py-2 rounded-bl-2xl font-semibold">
                Más Popular
        </div>
        
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">Plan Completo</h2>
                <div className="mb-6">
                  <span className="text-7xl font-bold text-[#E31E24]">$30,000</span>
                  <span className="text-2xl text-gray-600 ml-2">/mes</span>
                </div>
                <p className="text-gray-600 text-xl mb-4">
                  Todo incluido. Sin sorpresas. Sin límites.
                </p>
                <div className="inline-flex items-center px-4 py-2 bg-red-100 text-green-800 rounded-full text-sm font-medium">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                  Prueba gratuita de 14 días
                </div>
                </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">¿Qué incluye?</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {features.map((feature, index) => (
                      <div key={index} className="flex items-start">
                        <svg className="w-5 h-5 text-[#E31E24] mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
          </div>
          
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Beneficios comprobados</h3>
                  <div className="space-y-6">
                    {benefits.map((benefit, index) => (
                      <div key={index} className="flex items-start">
                        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-[#E31E24] mr-4 flex-shrink-0">
                          {benefit.icon}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{benefit.title}</h4>
                          <p className="text-gray-600 text-sm">{benefit.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

                <div className="text-center">
              <Link
                  to="/register"
                  className="inline-flex items-center px-10 py-5 bg-[#E31E24] hover:bg-[#C71A1F] text-white font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                  <span>Empezar Prueba Gratuita</span>
                  <svg className="w-6 h-6 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
              </Link>
                <p className="text-sm text-gray-500 mt-4">
                  Sin compromiso • Cancelación en cualquier momento • Soporte incluido
                  </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Calcula tu ROI
              </h2>
            <p className="text-xl text-gray-600 mb-12">
              Descubre cuánto puedes aumentar tus ventas con Menuby
            </p>

            <div className="bg-gray-50 rounded-2xl p-8 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#E31E24] mb-2">45%</div>
                  <div className="text-gray-600">Aumento promedio en ventas</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#E31E24] mb-2">2 meses</div>
                  <div className="text-gray-600">Tiempo promedio de ROI</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#E31E24] mb-2">$50,000+</div>
                  <div className="text-gray-600">Aumento mensual promedio</div>
                </div>
              </div>
            </div>

            <div className="bg-red-50 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                ¿Tienes un restaurante con ventas mensuales de $100,000?
                  </h3>
              <p className="text-lg text-gray-600 mb-6">
                Con Menuby podrías aumentar tus ventas a $145,000 mensuales
              </p>
              <div className="text-4xl font-bold text-[#E31E24] mb-2">
                ROI del 1,800% anual
              </div>
              <p className="text-gray-600">
                Inversión: $30,000/mes • Retorno: $45,000/mes adicionales
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Lo que dicen nuestros clientes
              </h2>
            <p className="text-xl text-gray-600">
              Casos reales de restaurantes que ya están viendo resultados
              </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((testimonial, index) => (
            <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="bg-white p-8 rounded-2xl shadow-lg"
              >
                <div className="text-4xl mb-4">{testimonial.avatar}</div>
                <p className="text-gray-700 mb-6 italic text-lg">"{testimonial.content}"</p>
                <div>
                  <div className="font-semibold text-gray-900 text-lg">{testimonial.name}</div>
                  <div className="text-gray-600">{testimonial.role}</div>
          </div>
        </motion.div>
            ))}
          </div>
      </div>
      </section>

      {/* Final CTA */}
      <CTA />
    </div>
  );
};

export default Pricing; 
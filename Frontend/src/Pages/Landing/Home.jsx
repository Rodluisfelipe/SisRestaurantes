import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import HeroSection from '../../Components/Landing/HeroSection';

const Home = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const featuresRef = useRef(null);
  const ctaRef = useRef(null);
  const testimonialsRef = useRef(null);
  const isCtaInView = useInView(ctaRef, { once: true, amount: 0.3 });
  const isFeaturesInView = useInView(featuresRef, { once: true, amount: 0.2 });
  const isTestimonialsInView = useInView(testimonialsRef, { once: true, amount: 0.3 });
  
  const { scrollYProgress } = useScroll();
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  useEffect(() => {
    setIsLoaded(true);
    
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  const features = [
    {
      icon: "🍽️",
      title: "Gestión de pedidos",
      description: "Simplifica la toma y seguimiento de pedidos para una operación más eficiente"
    },
    {
      icon: "📊",
      title: "Analíticas en tiempo real",
      description: "Datos y métricas esenciales para tomar decisiones informadas sobre tu negocio"
    },
    {
      icon: "👨‍🍳",
      title: "Interfaz para cocina",
      description: "Organiza la preparación de alimentos con nuestra intuitiva interfaz para cocina"
    },
    {
      icon: "📱",
      title: "Experiencia móvil",
      description: "Permite a tus clientes ordenar directamente desde sus dispositivos"
    },
    {
      icon: "💰",
      title: "Gestión de pagos",
      description: "Procesa pagos de forma segura y eficiente con múltiples opciones"
    },
    {
      icon: "🔍",
      title: "Personalización completa",
      description: "Adapta el sistema completamente a las necesidades específicas de tu restaurante"
    }
  ];

  const stats = [
    { value: '98%', label: 'Satisfacción de clientes' },
    { value: '+50%', label: 'Eficiencia operativa' },
    { value: '-30%', label: 'Reducción de errores' },
    { value: '+125', label: 'Restaurantes activos' }
  ];

  const stepsData = [
    {
      number: '01',
      title: 'Regístrate',
      description: 'Crea tu cuenta en minutos y comienza a configurar tu restaurante.'
    },
    {
      number: '02',
      title: 'Personaliza',
      description: 'Adapta el sistema a tus necesidades específicas y configura tu menú.'
    },
    {
      number: '03',
      title: 'Implementa',
      description: 'Capacita a tu equipo y comienza a recibir pedidos en tu plataforma.'
    },
    {
      number: '04',
      title: 'Crece',
      description: 'Analiza los datos para optimizar tu operación y expandir tu negocio.'
    }
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
    <div className="min-h-screen flex flex-col relative">
      <HeroSection />

      {/* Stats Section - Floating Card */}
      <section className="relative z-10 mb-10 md:mb-20">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div 
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: isMobile ? -40 : -80 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="relative mx-auto max-w-5xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#3A7AFF] to-[#3A7AFF]/60 rounded-2xl blur-xl opacity-20 transform -rotate-1"></div>
            <div className="relative bg-[#051C2C]/80 backdrop-blur-sm shadow-2xl rounded-2xl p-6 sm:p-8 border border-[#333F50]">
              <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
                {stats.map((stat, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.7 + index * 0.1 }}
                    className="text-center"
                  >
                    <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#5FF9B4] mb-1 sm:mb-2">{stat.value}</div>
                    <div className="text-xs sm:text-sm md:text-base text-[#D1D9FF]">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="py-16 sm:py-20 bg-[#051C2C]" style={{ marginTop: isMobile ? "-2rem" : "-6rem" }}>
        <div className="container mx-auto px-4 sm:px-6 pt-12 sm:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 sm:mb-4 text-white relative inline-block">
              Características principales
              <motion.div 
                initial={{ width: 0 }}
                animate={isFeaturesInView ? { width: "100%" } : {}}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="absolute -bottom-2 left-0 h-1 bg-gradient-to-r from-[#3A7AFF] to-[#5FF9B4] rounded-full"
              />
            </h2>
            <p className="text-lg sm:text-xl text-[#D1D9FF] max-w-3xl mx-auto">
              Descubre cómo nuestro sistema puede transformar la operación de tu restaurante
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                custom={index}
                variants={fadeUpVariants}
                initial="hidden"
                animate={isFeaturesInView ? "visible" : "hidden"}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="bg-[#333F50]/30 p-6 sm:p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-[#333F50] group"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#3A7AFF]/20 flex items-center justify-center text-2xl sm:text-3xl mb-4 sm:mb-6 group-hover:bg-[#3A7AFF]/30 transition-colors duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">{feature.title}</h3>
                <p className="text-sm sm:text-base text-[#D1D9FF]">{feature.description}</p>
                <div className="mt-4 sm:mt-6 flex items-center text-[#5FF9B4] font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-0 group-hover:translate-x-2">
                  <span>Saber más</span>
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 sm:py-20 bg-[#051C2C] relative overflow-hidden">
        <motion.div 
          style={{ y: bgY }}
          className="absolute inset-0 bg-dots-pattern opacity-10 z-0"
        />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-block bg-[#3A7AFF]/20 text-[#5FF9B4] px-4 py-1 rounded-full text-xs sm:text-sm font-semibold mb-3 sm:mb-4">
              PROCESO SIMPLE
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 sm:mb-4 text-white">
              Cómo funciona
            </h2>
            <p className="text-lg sm:text-xl text-[#D1D9FF] max-w-3xl mx-auto">
              Implementar Menuby en tu negocio es fácil y rápido
            </p>
          </div>

          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#333F50] transform -translate-y-1/2 hidden md:block"></div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
              {stepsData.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.2 }}
                  className="relative"
                >
                  <div className="bg-[#333F50]/30 rounded-xl shadow-lg p-6 sm:p-8 relative z-10 h-full border border-[#333F50]">
                    <div className="absolute -top-5 left-0 right-0 flex justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#3A7AFF] text-white flex items-center justify-center font-bold text-sm">
                        {step.number}
                      </div>
                    </div>
                    <div className="pt-4">
                      <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white mt-2">{step.title}</h3>
                      <p className="text-sm sm:text-base text-[#D1D9FF]">{step.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaRef} className="py-16 sm:py-20 bg-[#051C2C] relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isCtaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="bg-gradient-to-br from-[#333F50]/70 to-[#051C2C]/95 backdrop-blur-lg rounded-3xl overflow-hidden shadow-2xl border border-[#333F50]/50 p-8 sm:p-10 md:p-12 text-center max-w-4xl mx-auto"
          >
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={isCtaInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 sm:mb-6 text-white"
            >
              ¿Listo para llevar tu restaurante al siguiente nivel?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isCtaInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-lg sm:text-xl md:text-2xl mb-8 sm:mb-10 font-light text-[#D1D9FF] max-w-2xl mx-auto"
            >
              Únete a los cientos de restaurantes que han mejorado su operación con Menuby
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isCtaInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6"
            >
              <motion.div
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 0 15px rgba(95, 249, 180, 0.5)"
                }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  to="/register"
                  className="bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 text-white py-3 sm:py-4 px-6 sm:px-10 rounded-lg font-bold inline-block transition-all duration-300 w-full sm:w-auto"
                >
                  Empezar ahora
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  to="/contact"
                  className="bg-transparent border-2 border-[#A5B9FF]/30 hover:border-[#5FF9B4]/60 hover:text-[#5FF9B4] text-white py-3 sm:py-4 px-6 sm:px-10 rounded-lg font-bold inline-block transition-all duration-300 w-full sm:w-auto"
                >
                  Contactar ventas
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
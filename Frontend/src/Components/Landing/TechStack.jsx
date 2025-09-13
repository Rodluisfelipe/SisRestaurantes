import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useTheme } from '../../Context/ThemeContext';

const TechStack = () => {
  const { theme } = useTheme();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  const technologies = [
    {
      category: 'Frontend',
      icon: '⚛️',
      color: 'from-blue-500 to-cyan-500',
      techs: [
        { name: 'React', description: 'Interfaz moderna y reactiva' },
        { name: 'Vite', description: 'Build tool ultra rápido' },
        { name: 'TailwindCSS', description: 'Diseño responsive perfecto' },
        { name: 'Framer Motion', description: 'Animaciones fluidas' },
        { name: 'Socket.IO Client', description: 'Tiempo real en el navegador' }
      ]
    },
    {
      category: 'Backend',
      icon: '🚀',
      color: 'from-green-500 to-emerald-500',
      techs: [
        { name: 'Node.js', description: 'Runtime JavaScript escalable' },
        { name: 'Express.js', description: 'Framework web minimalista' },
        { name: 'Socket.IO', description: 'Comunicación en tiempo real' },
        { name: 'JWT', description: 'Autenticación segura' },
        { name: 'Bcrypt', description: 'Encriptación de contraseñas' }
      ]
    },
    {
      category: 'Base de Datos',
      icon: '🗄️',
      color: 'from-purple-500 to-pink-500',
      techs: [
        { name: 'MongoDB', description: 'Base de datos NoSQL flexible' },
        { name: 'Mongoose', description: 'ODM para MongoDB' },
        { name: 'Índices optimizados', description: 'Consultas ultra rápidas' },
        { name: 'Agregaciones', description: 'Reportes complejos' },
        { name: 'Respaldo automático', description: 'Datos siempre seguros' }
      ]
    },
    {
      category: 'Funcionalidades',
      icon: '✨',
      color: 'from-orange-500 to-red-500',
      techs: [
        { name: 'Multi-tenant', description: 'Múltiples restaurantes' },
        { name: 'QR dinámicos', description: 'Códigos únicos por mesa' },
        { name: 'PWA Ready', description: 'Instalable como app' },
        { name: 'Responsive', description: 'Perfecto en cualquier dispositivo' },
        { name: 'Offline capable', description: 'Funciona sin internet' }
      ]
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.9
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: [0.4, 0.0, 0.2, 1]
      }
    }
  };

  const techItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4
      }
    }
  };

  return (
    <section 
      ref={sectionRef}
      className={`py-20 ${theme === 'dark' ? 'bg-[#051C2C]' : 'bg-white'} relative overflow-hidden`}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, rotate: 0 }}
          animate={{ 
            opacity: theme === 'dark' ? 0.1 : 0.05, 
            rotate: 360 
          }}
          transition={{ 
            duration: 50, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute -top-1/2 -right-1/2 w-full h-full"
        >
          <div className="w-full h-full bg-gradient-to-r from-[#3A7AFF]/20 to-[#5FF9B4]/20 rounded-full blur-3xl" />
        </motion.div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="inline-block bg-[#3A7AFF]/20 text-[#3A7AFF] px-4 py-2 rounded-full text-sm font-semibold mb-6">
            TECNOLOGÍA DE VANGUARDIA
          </div>
          <h2 className={`text-4xl sm:text-5xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
            Construido con las mejores
            <span className="bg-gradient-to-r from-[#3A7AFF] to-[#5FF9B4] bg-clip-text text-transparent"> tecnologías</span>
          </h2>
          <p className={`text-xl max-w-3xl mx-auto ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
            Stack tecnológico moderno que garantiza performance, escalabilidad y una experiencia excepcional
          </p>
        </motion.div>

        {/* Tech Stack Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8"
        >
          {technologies.map((category, index) => (
            <motion.div
              key={category.category}
              variants={cardVariants}
              className={`${theme === 'dark' ? 'bg-[#333F50]/30' : 'bg-[#F4F7FB]'} rounded-2xl p-6 border ${theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} hover:shadow-2xl transition-all duration-500 group`}
            >
              {/* Category Header */}
              <div className="mb-6">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${category.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  {category.icon}
                </div>
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>
                  {category.category}
                </h3>
              </div>

              {/* Tech List */}
              <div className="space-y-4">
                {category.techs.map((tech, techIndex) => (
                  <motion.div
                    key={tech.name}
                    variants={techItemVariants}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    transition={{ delay: (index * 0.2) + (techIndex * 0.1) }}
                    className="group/tech"
                  >
                    <div className="flex items-start">
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${category.color} mt-2 mr-3 flex-shrink-0 group-hover/tech:scale-125 transition-transform duration-200`} />
                      <div>
                        <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'} group-hover/tech:text-[#3A7AFF] transition-colors duration-200`}>
                          {tech.name}
                        </h4>
                        <p className={`text-sm ${theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'} mt-1`}>
                          {tech.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Performance Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20"
        >
          <div className={`${theme === 'dark' ? 'bg-[#333F50]/20' : 'bg-white'} rounded-3xl p-8 border ${theme === 'dark' ? 'border-[#333F50]' : 'border-[#DCE4F5]'} shadow-2xl`}>
            <div className="text-center mb-8">
              <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'} mb-2`}>
                Performance garantizado
              </h3>
              <p className={`${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                Métricas reales de rendimiento del sistema
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: '<100ms', label: 'Tiempo de respuesta', icon: '⚡' },
                { value: '99.9%', label: 'Uptime garantizado', icon: '🔒' },
                { value: '24/7', label: 'Soporte técnico', icon: '🛠️' },
                { value: '∞', label: 'Escalabilidad', icon: '📈' }
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.5, delay: 0.7 + (index * 0.1) }}
                  className="text-center"
                >
                  <div className="text-3xl mb-2">{stat.icon}</div>
                  <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#5FF9B4]' : 'text-[#3A7AFF]'} mb-1`}>
                    {stat.value}
                  </div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}`}>
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TechStack;

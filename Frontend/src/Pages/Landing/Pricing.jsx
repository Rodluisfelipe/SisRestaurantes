import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useTheme } from '../../Context/ThemeContext';

const PricingToggle = ({ isYearly, setIsYearly }) => {
  const { theme } = useTheme();
  
  return (
    <div className="flex items-center justify-center mb-8 sm:mb-12">
      <span className={`text-base sm:text-lg mr-3 ${!isYearly ? (theme === 'dark' ? 'text-white' : 'text-[#1F2937]') + ' font-medium' : (theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]') + ' font-normal'}`}>
        Mensual
      </span>
      <div 
        className={`relative w-14 h-7 ${theme === 'dark' ? 'bg-[#333F50]' : 'bg-gray-200'} rounded-full cursor-pointer`}
        onClick={() => setIsYearly(!isYearly)}
      >
        <div className="absolute left-0 w-full h-full transition-all duration-300 overflow-hidden rounded-full">
          <motion.div
            initial={false}
            animate={{ x: isYearly ? 28 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-1 left-1 w-5 h-5 bg-[#5FF9B4] rounded-full"
          />
        </div>
      </div>
      <span className={`text-base sm:text-lg ml-3 ${isYearly ? (theme === 'dark' ? 'text-white' : 'text-[#1F2937]') + ' font-medium' : (theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]') + ' font-normal'}`}>
        Anual
      </span>
      {isYearly && (
        <div className="ml-2 sm:ml-3 bg-[#5FF9B4]/20 text-[#5FF9B4] text-xs font-semibold px-2 py-1 rounded-full">
          Ahorra 20%
        </div>
      )}
    </div>
  );
};

const PricingCard = ({ plan, isYearly, isPopular, index }) => {
  const cardRef = useRef(null);
  const isInView = useInView(cardRef, { once: true, amount: 0.3 });
  const { theme } = useTheme();
  
  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
  
  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.1 * index }}
      className={`relative rounded-2xl overflow-hidden border ${
        isPopular 
          ? 'border-[#3A7AFF] shadow-lg shadow-[#3A7AFF]/20' 
          : theme === 'dark' ? 'border-[#333F50] shadow-lg' : 'border-[#DCE4F5] shadow-lg'
      }`}
    >
      {isPopular && (
        <div className="absolute top-0 right-0 bg-[#3A7AFF] text-white text-xs font-bold py-1 px-3 rounded-bl-lg">
          Más popular
        </div>
      )}
      
      <div className={`px-6 py-8 ${isPopular ? (theme === 'dark' ? 'bg-[#333F50]/50' : 'bg-blue-50') : (theme === 'dark' ? 'bg-[#051C2C]' : 'bg-white')}`}>
        <h3 className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'} mb-2`}>{plan.name}</h3>
        <p className={`${theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'} mb-6 h-12 sm:h-10`}>{plan.description}</p>
        
        <div className="mb-6">
          <span className={`text-3xl sm:text-4xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}>${price}</span>
          <span className={`${theme === 'dark' ? 'text-[#A5B9FF]' : 'text-[#6C7A92]'} ml-1`}>/{isYearly ? 'año' : 'mes'}</span>
        </div>
        
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link
            to="/register"
            className={`block text-center py-3 px-6 rounded-lg font-semibold transition-all ${
              isPopular
                ? 'bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 text-white hover:shadow-lg hover:shadow-[#3A7AFF]/20'
                : theme === 'dark' 
                  ? 'bg-[#333F50]/50 hover:bg-[#333F50]/70 text-white' 
                  : 'bg-[#F4F7FB] hover:bg-[#DCE4F5] text-[#1F2937]'
            }`}
          >
            Comenzar {plan.name.toLowerCase()}
          </Link>
        </motion.div>
      </div>
      
      <div className={theme === 'dark' ? 'px-6 py-6 bg-[#051C2C]' : 'px-6 py-6 bg-white'}>
        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'} mb-4`}>Incluye:</p>
        <ul className="space-y-3">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start">
              <svg 
                className="w-5 h-5 text-[#5FF9B4] mt-0.5 mr-2 flex-shrink-0" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className={theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'}>{feature}</span>
            </li>
          ))}
          
          {plan.notIncluded && plan.notIncluded.map((feature, i) => (
            <li key={i} className={`flex items-start ${theme === 'dark' ? 'text-[#A5B9FF]/50' : 'text-[#6C7A92]/50'}`}>
              <svg 
                className="w-5 h-5 mt-0.5 mr-2 flex-shrink-0" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(true);
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const isInView = useInView(titleRef, { once: true, amount: 0.3 });
  const { theme } = useTheme();
  
  const plans = [
    {
      name: "Básico",
      description: "Perfecto para negocios pequeños",
      monthlyPrice: "29",
      yearlyPrice: "279",
      features: [
        "Hasta 3 usuarios",
        "Gestión de pedidos",
        "Catálogo de productos",
        "Interfaz para cocina",
        "Soporte por email"
      ],
      notIncluded: [
        "Analíticas avanzadas",
        "Integraciones personalizadas",
        "Soporte 24/7"
      ]
    },
    {
      name: "Pro",
      description: "Ideal para restaurantes en crecimiento",
      monthlyPrice: "79",
      yearlyPrice: "759",
      features: [
        "Hasta 10 usuarios",
        "Todas las características de Básico",
        "Analíticas avanzadas",
        "Gestión de múltiples locales",
        "Integraciones con pagos",
        "Soporte prioritario"
      ],
      notIncluded: [
        "API personalizada",
        "Soporte 24/7"
      ]
    },
    {
      name: "Enterprise",
      description: "Para cadenas de restaurantes",
      monthlyPrice: "149",
      yearlyPrice: "1,429",
      features: [
        "Usuarios ilimitados",
        "Todas las características de Pro",
        "API personalizada",
        "Personalización completa",
        "Integraciones con POS",
        "Soporte dedicado 24/7",
        "Onboarding personalizado"
      ]
    }
  ];

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#051C2C]' : 'bg-[#F4F7FB]'} py-16 sm:py-24`}>
      <div className="container mx-auto px-4 sm:px-6">
        <div ref={titleRef} className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className={`text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 sm:mb-6 ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'}`}
          >
            Planes diseñados para crecer junto a tu negocio
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`text-lg sm:text-xl ${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} mb-8`}
          >
            Elige el plan que mejor se adapte a las necesidades de tu restaurante. 
            Sin contratos a largo plazo, cambia o cancela cuando quieras.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <PricingToggle isYearly={isYearly} setIsYearly={setIsYearly} />
          </motion.div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          <PricingCard plan={plans[0]} isYearly={isYearly} isPopular={false} index={1} />
          <PricingCard plan={plans[1]} isYearly={isYearly} isPopular={true} index={2} />
          <PricingCard plan={plans[2]} isYearly={isYearly} isPopular={false} index={3} />
        </div>
        
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className={`mt-16 sm:mt-24 ${theme === 'dark' ? 'bg-[#333F50]/30 border border-[#333F50]' : 'bg-white border border-[#DCE4F5]'} rounded-2xl p-8 sm:p-10 max-w-4xl mx-auto`}
        >
          <div className="text-center mb-8">
            <h2 className={`text-2xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1F2937]'} mb-4`}>¿Necesitas una solución a medida?</h2>
            <p className={`${theme === 'dark' ? 'text-[#D1D9FF]' : 'text-[#6C7A92]'} max-w-2xl mx-auto`}>
              Contamos con planes personalizados para cadenas de restaurantes y necesidades especiales.
              Nuestro equipo puede crear una solución perfecta para tu negocio.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/contact"
                className="bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 text-white py-3 px-8 rounded-lg font-bold inline-block text-center w-full"
              >
                Contactar ventas
              </Link>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <a
                href="https://calendly.com/menuby/demo"
                target="_blank"
                rel="noopener noreferrer"
                className={`border ${theme === 'dark' ? 'border-[#3A7AFF] bg-transparent text-[#3A7AFF]' : 'border-[#3A7AFF] bg-white text-[#3A7AFF]'} hover:bg-[#3A7AFF]/10 py-3 px-8 rounded-lg font-bold inline-block text-center w-full`}
              >
                Solicitar demostración
              </a>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Pricing; 
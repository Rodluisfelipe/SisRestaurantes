import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useAnimation, useScroll, useTransform } from 'framer-motion';

const HeroSection = ({ 
  title = "Menuby: La Revolución Digital para Restaurantes",
  description = "Transforma tu restaurante con menús digitales interactivos. Aumenta ventas, mejora la experiencia del cliente y optimiza tu operación con nuestra plataforma todo-en-uno.",
  primaryButtonText = "Crear Mi Menú Gratis",
  primaryButtonLink = "/register",
  secondaryButtonText = "Ver Demo",
  secondaryButtonLink = "/contact",
  showButtons = true,
  backgroundClass = ""
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const heroRef = useRef(null);
  const textRef = useRef(null);
  const isInView = useInView(textRef, { once: true, amount: 0.3 });
  const mainControls = useAnimation();
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 150]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9]);
  
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    setIsLoaded(true);
    
    if (isInView) {
      mainControls.start("visible");
    }
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, [isInView, mainControls, isMobile]);

  const titleVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.4, 0.0, 0.2, 1],
        delay: 0.2
      }
    }
  };

  const descriptionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.4, 0.0, 0.2, 1],
        delay: 0.4
      }
    }
  };

  const buttonGroupVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.6,
        staggerChildren: 0.2
      }
    }
  };

  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.4, 0.0, 0.2, 1]
      }
    }
  };

  return (
    <motion.section 
      ref={heroRef}
      style={{ opacity, y, scale }}
      className={`relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-white via-green-50 to-white ${backgroundClass}`}
    >
      {/* Background Elements */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-200 rounded-full blur-3xl opacity-30"
        />
        <motion.div 
          animate={{ 
            scale: [1.1, 1, 1.1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ 
            duration: 10, 
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-green-300 rounded-full blur-3xl opacity-20"
        />
      </div>

      {/* Content Container */}
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center" ref={textRef}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={mainControls}
            className="mb-8"
          >
            <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              La solución #1 para restaurantes en Colombia
            </div>
          </motion.div>

          <motion.h1 
            variants={titleVariants}
            initial="hidden"
            animate={mainControls}
            className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight"
          >
            {title}
          </motion.h1>
          
          <motion.p 
            variants={descriptionVariants}
            initial="hidden"
            animate={mainControls}
            className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed"
          >
            {description}
          </motion.p>
          
          {showButtons && (
            <motion.div 
              variants={buttonGroupVariants}
              initial="hidden"
              animate={mainControls}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
            >
              <motion.div variants={buttonVariants}>
                <Link
                  to={primaryButtonLink}
                  className="px-8 py-4 bg-[#E31E24] hover:bg-[#C71A1F] text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center text-base sm:text-lg"
                >
                  {primaryButtonText}
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </motion.div>
              
              <motion.div variants={buttonVariants}>
                <Link
                  to={secondaryButtonLink}
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-300 transform hover:scale-105 flex items-center justify-center text-base sm:text-lg"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M19 10a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {secondaryButtonText}
                </Link>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.section>
  );
};

export default HeroSection;
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useAnimation, useScroll, useTransform } from 'framer-motion';
import { useTheme } from '../../Context/ThemeContext';

const HeroSection = ({ 
  title = "Menuby: Transformando la experiencia gastronómica",
  description = "Tu menú digital, sin costos. Configura tu carta, agrega fotos, combos y recibe pedidos directo al celular, gratis y sin descargas.",
  primaryButtonText = "Crear Menú",
  primaryButtonLink = "/register",
  secondaryButtonText = "Iniciar sesión",
  secondaryButtonLink = "/login",
  showButtons = true,
  backgroundClass = ""
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const heroRef = useRef(null);
  const textRef = useRef(null);
  const isInView = useInView(textRef, { once: true, amount: 0.3 });
  const mainControls = useAnimation();
  const { theme, colors } = useTheme();
  const isDark = theme === 'dark';
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 150]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9]);
  
  // Particles
  const [particles, setParticles] = useState([]);
  
  useEffect(() => {
    // Detectar si es dispositivo móvil para ajustar elementos visuales
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    // Generate random particles - menos en móvil para mejor rendimiento
    const particleCount = isMobile ? 15 : 30;
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 5 + 2,
      duration: Math.random() * 15 + 10
    }));
    
    setParticles(newParticles);
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

  const particleVariants = {
    animate: (custom) => ({
      y: ["0%", "-100%"],
      x: [`${custom.x}%`, `${custom.x + (Math.random() * 10 - 5)}%`],
      opacity: [0, 0.8, 0],
      scale: [0, 1, 0.5],
      transition: {
        duration: custom.duration,
        repeat: Infinity,
        ease: "linear",
        delay: Math.random() * 5
      }
    })
  };

  return (
    <motion.section 
      ref={heroRef}
      style={{ opacity, y, scale }}
      className={`relative h-[90vh] sm:h-screen flex items-center justify-center overflow-hidden ${
        backgroundClass || (isDark ? "bg-[#051C2C]" : "bg-[#F4F7FB]")
      }`}
    >
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ duration: 2 }}
          className={`absolute inset-0 ${
            isDark 
              ? "bg-gradient-to-r from-[#051C2C]/60 to-[#333F50]/40" 
              : "bg-gradient-to-r from-[#F4F7FB]/60 to-[#DCE4F5]/40"
          }`}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
          animate={{ 
            opacity: [0.3, 0.5, 0.3], 
            scale: [0.8, 1.2, 0.8], 
            rotate: 360 
          }}
          transition={{ 
            duration: 20, 
            repeat: Infinity,
            ease: "linear" 
          }}
          className={`absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full ${
            isDark ? "bg-[#3A7AFF]/20" : "bg-[#3A7AFF]/10"
          } blur-3xl`}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
          animate={{ 
            opacity: [0.4, 0.6, 0.4], 
            scale: [0.8, 1.1, 0.8], 
            rotate: -360 
          }}
          transition={{ 
            duration: 25, 
            repeat: Infinity,
            ease: "linear",
            delay: 1
          }}
          className={`absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full ${
            isDark ? "bg-[#A5B9FF]/20" : "bg-[#DCE4F5]/40"
          } blur-3xl`}
        />
      </div>

      {/* Animated Particles - solo en desktop o menos cantidad en móvil */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          custom={particle}
          variants={particleVariants}
          animate="animate"
          className={`absolute rounded-full ${isDark ? "bg-white" : "bg-[#3A7AFF]"}`}
          style={{
            left: `${particle.x}%`,
            top: `100%`,
            width: particle.size,
            height: particle.size,
            opacity: 0,
            filter: "blur(1px)"
          }}
        />
      ))}

      {/* Grid Pattern Overlay */}
      <div 
        className={`absolute inset-0 z-0 ${
          isDark ? "opacity-20" : "opacity-10"
        } bg-grid-pattern mix-blend-soft-light`}
        style={{
          backgroundSize: isMobile ? "30px 30px" : "40px 40px",
          backgroundPosition: "center center"
        }}
      />

      {/* Circle Decorations */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      >
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
          className={`absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full border border-dashed ${
            isDark ? "border-[#3A7AFF]/10" : "border-[#3A7AFF]/10"
          }`}
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
          className={`absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full border border-dashed ${
            isDark ? "border-[#5FF9B4]/10" : "border-[#5FF9B4]/10"
          }`}
        />
      </motion.div>

      {/* Content Container */}
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center" ref={textRef}>
          <motion.h1 
            variants={titleVariants}
            initial="hidden"
            animate={mainControls}
            className={`text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight md:leading-tight ${
              isDark ? "text-white" : "text-[#1F2937]"
            }`}
          >
            {title}
          </motion.h1>
          
          <motion.p 
            variants={descriptionVariants}
            initial="hidden"
            animate={mainControls}
            className={`mt-6 text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto ${
              isDark ? "text-[#D1D9FF]" : "text-[#6C7A92]"
            }`}
          >
            {description}
          </motion.p>
          
          {showButtons && (
            <motion.div 
              variants={buttonGroupVariants}
              initial="hidden"
              animate={mainControls}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
            >
              <motion.div variants={buttonVariants}>
                <Link
                  to={primaryButtonLink}
                  className={`px-8 py-3 text-white rounded-lg font-medium flex items-center justify-center ${
                    isDark 
                      ? "bg-gradient-to-r from-[#3A7AFF] to-[#3A7AFF]/90 hover:shadow-[0_0_15px_rgba(95,249,180,0.3)]" 
                      : "bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 shadow-md hover:shadow-lg"
                  } transition-all duration-300 text-base sm:text-lg`}
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
                  className={`px-8 py-3 rounded-lg font-medium flex items-center justify-center transition-all duration-300 text-base sm:text-lg ${
                    isDark 
                      ? "bg-[#333F50]/50 text-[#D1D9FF] hover:bg-[#333F50]/80 hover:text-white border border-[#333F50]" 
                      : "bg-white text-[#1F2937] hover:bg-[#DCE4F5]/30 border border-[#DCE4F5] shadow-sm"
                  }`}
                >
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
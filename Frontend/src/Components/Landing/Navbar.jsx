import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../Context/ThemeContext';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState('/');
  const location = useLocation();
  const { theme, colors } = useTheme();
  
  const isDark = theme === 'dark';

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Actualizar enlace activo y cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setActiveLink(location.pathname);
    setIsMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Características', path: '/features' },
    { name: 'Precios', path: '/pricing' },
    { name: 'Contacto', path: '/contact' }
  ];

  // Variantes para animaciones
  const navbarVariants = {
    hidden: { opacity: 0, y: -25 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: "spring", 
        stiffness: 100,
        duration: 0.4,
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const linkVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 150 }
    },
    hover: { 
      scale: 1.1, 
      color: colors.primaryButton,
      transition: { type: "spring", stiffness: 300 }
    },
    tap: { scale: 0.95 }
  };

  const logoVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { 
        type: "spring", 
        stiffness: 100 
      }
    },
    hover: { 
      rotate: [0, -5, 0, 5, 0], 
      transition: { duration: 0.5 }
    }
  };

  return (
    <motion.header
      initial={false}
      animate={{ 
        backgroundColor: isScrolled 
          ? (isDark ? "rgba(5, 28, 44, 0.95)" : "rgba(244, 247, 251, 0.95)")
          : "rgba(0, 0, 0, 0)",
        boxShadow: isScrolled 
          ? (isDark ? "0 4px 20px rgba(0, 0, 0, 0.2)" : "0 4px 20px rgba(0, 0, 0, 0.05)")
          : "none",
        padding: isScrolled ? "0.5rem 0" : "1rem 0",
        backdropFilter: isScrolled ? "blur(8px)" : "none"
      }}
      transition={{ duration: 0.4 }}
      className="fixed w-full z-50 transition-all duration-300"
    >
      <motion.div 
        className="container mx-auto px-4 sm:px-6"
        variants={navbarVariants}
        initial="hidden"
        animate="visible"
      >
        <nav className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <motion.div
              variants={logoVariants}
              whileHover="hover"
              className={`font-bold text-xl sm:text-2xl flex items-center ${
                isDark ? 'text-white' : 'text-[#1F2937]'
              }`}
            >
              <span className={`text-${isScrolled ? '[#3A7AFF]' : '[#5FF9B4]'} mr-2 text-2xl sm:text-3xl`}>
                🍽️
              </span>
              <span className="hidden xs:inline">Menuby</span>
              <span className="xs:hidden">Menuby</span>
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-4 lg:space-x-8">
            {navLinks.map((link, index) => {
              const isActive = activeLink === link.path;
              
              return (
                <motion.div
                  key={link.name}
                  variants={linkVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="relative"
                >
                  <Link
                    to={link.path}
                    className={`font-medium transition-colors duration-300 py-2 px-1 ${
                      isDark
                        ? isScrolled
                          ? 'text-[#D1D9FF] hover:text-[#5FF9B4]'
                          : 'text-[#D1D9FF] hover:text-white'
                        : isScrolled
                          ? 'text-[#6C7A92] hover:text-[#3A7AFF]'
                          : 'text-[#6C7A92] hover:text-[#1F2937]'
                    } ${isActive 
                        ? isDark 
                          ? isScrolled 
                            ? 'text-[#5FF9B4]' 
                            : 'text-white' 
                          : 'text-[#3A7AFF]' 
                        : ''}`}
                  >
                    {link.name}
                  </Link>
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      initial={false}
                      className={`absolute bottom-0 left-0 w-full h-0.5 ${
                        isDark 
                          ? isScrolled
                            ? 'bg-[#5FF9B4]'
                            : 'bg-white'
                          : 'bg-[#3A7AFF]'
                      }`}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Theme Toggle and Login/Register Buttons - Desktop */}
          <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            <motion.div
              variants={linkVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <Link
                to="/login"
                className={`font-medium transition-colors duration-300 ${
                  isDark
                    ? isScrolled
                      ? 'text-[#D1D9FF] hover:text-[#5FF9B4]'
                      : 'text-[#D1D9FF] hover:text-white'
                    : 'text-[#6C7A92] hover:text-[#3A7AFF]'
                }`}
              >
                Iniciar sesión
              </Link>
            </motion.div>
            <motion.div
              variants={linkVariants}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="overflow-hidden rounded-lg"
            >
              <Link
                to="/register"
                className={`py-2 px-4 lg:px-6 rounded-lg transition-colors duration-300 flex items-center gap-2 ${
                  isDark
                    ? isScrolled
                      ? 'bg-gradient-to-r from-[#3A7AFF] to-[#3A7AFF]/90 hover:shadow-[0_0_15px_rgba(95,249,180,0.5)] text-white'
                      : 'bg-white hover:bg-[#D1D9FF] text-[#051C2C]'
                    : 'bg-[#3A7AFF] hover:bg-[#3A7AFF]/90 text-white hover:shadow-lg'
                }`}
              >
                <span>Registrarse</span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ 
                    repeat: Infinity, 
                    repeatType: "reverse", 
                    duration: 1,
                    repeatDelay: 1
                  }}
                >
                  →
                </motion.span>
              </Link>
            </motion.div>
          </div>

          {/* Mobile Menu Button and Theme Toggle */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Theme Toggle for Mobile */}
            <ThemeToggle />
            
            <motion.button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`p-2 focus:outline-none ${
                isDark ? 'text-white' : 'text-[#1F2937]'
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Menu"
            >
              <AnimatePresence mode="wait">
                {isMobileMenuOpen ? (
                  <motion.svg
                    key="close"
                    className="w-6 h-6" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 90 }}
                    exit={{ rotate: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </motion.svg>
                ) : (
                  <motion.svg
                    key="menu"
                    className="w-6 h-6" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </nav>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className={`w-full overflow-hidden ${
              isDark ? 'bg-[#051C2C]/95' : 'bg-[#F4F7FB]/95'
            } backdrop-blur-md md:hidden`}
          >
            <div className="container mx-auto px-4 py-4">
              <div className="flex flex-col space-y-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`py-2 px-4 rounded-lg transition-colors ${
                      activeLink === link.path
                        ? isDark 
                          ? 'bg-[#333F50]/50 text-[#5FF9B4]' 
                          : 'bg-white text-[#3A7AFF] shadow-sm'
                        : isDark 
                          ? 'text-[#D1D9FF] hover:bg-[#333F50]/30' 
                          : 'text-[#6C7A92] hover:bg-white hover:shadow-sm'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                ))}
                <div className="pt-2 flex flex-col space-y-3">
                  <Link
                    to="/login"
                    className={`py-2 px-4 rounded-lg transition-colors text-center ${
                      isDark 
                        ? 'text-[#D1D9FF] hover:bg-[#333F50]/30' 
                        : 'text-[#6C7A92] hover:bg-white hover:shadow-sm'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    to="/register"
                    className={`py-2 px-4 rounded-lg transition-colors text-center ${
                      isDark 
                        ? 'bg-[#3A7AFF] text-white hover:bg-[#3A7AFF]/90' 
                        : 'bg-[#3A7AFF] text-white hover:bg-[#3A7AFF]/90 shadow-md'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Registrarse
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Navbar; 
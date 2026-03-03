import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const NICHE_LINKS = [
  { name: '🍽️ Restaurantes', to: '/menu-digital-restaurante' },
  { name: '🍺 Bares', to: '/menu-digital-bar' },
  { name: '☕ Cafeterías', to: '/menu-digital-cafeteria' },
  { name: '🍕 Pizzerías', to: '/menu-digital-pizzeria' },
  { name: '🍔 Hamburgueserías', to: '/menu-digital-hamburgueseria' },
  { name: '🏨 Hoteles', to: '/menu-digital-hotel' },
  { name: '🚚 Food Trucks', to: '/menu-digital-food-truck' },
  { name: '🥐 Panaderías', to: '/menu-digital-panaderia' },
  { name: '⚡ Comida Rápida', to: '/menu-digital-comida-rapida' },
  { name: '🍣 Sushi', to: '/menu-digital-sushi' },
  { name: '🥩 Asaderos', to: '/menu-digital-asadero' },
  { name: '🍦 Heladerías', to: '/menu-digital-heladeria' },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showSoluciones, setShowSoluciones] = useState(false);
  const [mobileSubMenu, setMobileSubMenu] = useState(false);
  const dropdownRef = useRef(null);
  const timeoutRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setMobileSubMenu(false);
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSoluciones(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDropdownEnter = () => {
    clearTimeout(timeoutRef.current);
    setShowSoluciones(true);
  };
  const handleDropdownLeave = () => {
    timeoutRef.current = setTimeout(() => setShowSoluciones(false), 200);
  };

  const navLinks = [
    { name: 'Soluciones', href: '#', dropdown: true },
    { name: 'Características', href: '/features' },
    { name: 'Precios', href: '/pricing' },
    { name: 'Demo', href: '/demo' },
    { name: 'Blog', href: '/blog' },
  ];

  const isActive = (href) => location.pathname === href;

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-xl shadow-lg shadow-black/5 border-b border-gray-100'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group relative z-50">
              <div className="relative">
                <img
                  src="/logo.jpeg"
                  alt="Menuby"
                  className="w-9 h-9 rounded-xl object-cover shadow-md group-hover:shadow-red-200 transition-shadow duration-300"
                />
              </div>
              <span className="text-lg font-black text-gray-900 tracking-tight">
                Menu<span className="text-red-600">by</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                link.dropdown ? (
                  <div
                    key={link.name}
                    ref={dropdownRef}
                    className="relative"
                    onMouseEnter={handleDropdownEnter}
                    onMouseLeave={handleDropdownLeave}
                  >
                    <button
                      className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-1"
                    >
                      {link.name}
                      <svg className={`w-3.5 h-3.5 transition-transform ${showSoluciones ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <AnimatePresence>
                      {showSoluciones && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 px-2">Menú digital por tipo de negocio</p>
                          <div className="grid grid-cols-2 gap-1">
                            {NICHE_LINKS.map((nl) => (
                              <Link
                                key={nl.to}
                                to={nl.to}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors font-medium"
                                onClick={() => setShowSoluciones(false)}
                              >
                                {nl.name}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={`relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive(link.href)
                        ? 'text-red-600 bg-red-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {link.name}
                    {isActive(link.href) && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full"
                      />
                    )}
                  </Link>
                )
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                to="/login"
                className="px-5 py-2 text-sm text-gray-700 hover:text-red-600 font-semibold transition-colors duration-200"
              >
                Iniciar Sesión
              </Link>
              <Link
                to="/register"
                className="px-5 py-2.5 bg-gray-900 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-red-500/20"
              >
                Crear Menú Gratis
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden relative z-50 w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors duration-200 active:scale-95"
              aria-label="Toggle menu"
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className={`block h-0.5 bg-gray-700 rounded-full transition-all duration-300 origin-center ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
                <span className={`block h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${isOpen ? 'opacity-0 scale-0' : ''}`} />
                <span className={`block h-0.5 bg-gray-700 rounded-full transition-all duration-300 origin-center ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Full-Screen Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-white lg:hidden"
          >
            <div className="flex flex-col h-full pt-20 pb-8 px-6 overflow-y-auto">
              {/* Nav links */}
              <nav className="flex-1 flex flex-col justify-center -mt-16">
                <div className="space-y-1">
                  {/* Soluciones expandable */}
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0 }}>
                    <button
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-lg font-semibold transition-colors duration-200 ${mobileSubMenu ? 'text-red-600 bg-red-50' : 'text-gray-800 active:bg-gray-50'}`}
                      onClick={() => setMobileSubMenu(!mobileSubMenu)}
                    >
                      Soluciones
                      <svg className={`w-5 h-5 transition-transform ${mobileSubMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <AnimatePresence>
                      {mobileSubMenu && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-1 px-3 py-2">
                            {NICHE_LINKS.map((nl) => (
                              <Link
                                key={nl.to}
                                to={nl.to}
                                className="px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                                onClick={() => setIsOpen(false)}
                              >
                                {nl.name}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {navLinks.filter(l => !l.dropdown).map((link, i) => (
                    <motion.div
                      key={link.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (i + 1) * 0.06 }}
                    >
                      <Link
                        to={link.href}
                        className={`block px-5 py-4 rounded-2xl text-lg font-semibold transition-colors duration-200 ${
                          isActive(link.href)
                            ? 'text-red-600 bg-red-50'
                            : 'text-gray-800 active:bg-gray-50'
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        {link.name}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </nav>

              {/* CTA buttons at bottom */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3 pt-6 border-t border-gray-100"
              >
                <Link
                  to="/register"
                  className="block w-full text-center py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-base rounded-2xl transition-all duration-200 shadow-lg shadow-red-500/20 active:scale-[0.98]"
                  onClick={() => setIsOpen(false)}
                >
                  Crear Menú Gratis
                </Link>
                <Link
                  to="/login"
                  className="block w-full text-center py-4 text-gray-700 font-semibold text-base rounded-2xl border border-gray-200 active:bg-gray-50 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Iniciar Sesión
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;

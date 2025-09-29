import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigation = [
    {
      name: 'Producto',
      href: '/features',
      children: [
        { name: 'Características', href: '/features' },
        { name: 'Precios', href: '/pricing' },
        { name: 'Demo', href: '/demo' }
      ]
    },
    {
      name: 'Empresa',
      href: '/contact',
      children: [
        { name: 'Contacto', href: '/contact' }
      ]
    }
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200' 
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Menuby</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigation.map((item) => (
              <div key={item.name} className="relative group">
                <button className="flex items-center space-x-1 text-gray-700 hover:text-green-600 transition-colors duration-200 font-medium">
                  <span>{item.name}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown */}
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="py-2">
                    {item.children.map((child) => (
                  <Link
                        key={child.name}
                        to={child.href}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors duration-200"
                      >
                        {child.name}
                  </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center space-x-4">
              <Link
                to="/login"
              className="text-gray-700 hover:text-green-600 transition-colors duration-200 font-medium"
            >
              Iniciar Sesión
              </Link>
              <Link
                to="/register"
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Crear Menú Gratis
              </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
            </svg>
          </button>
          </div>

        {/* Mobile Navigation */}
      <AnimatePresence>
          {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
              className="lg:hidden border-t border-gray-200 bg-white"
            >
              <div className="py-4 space-y-4">
                {navigation.map((item) => (
                  <div key={item.name}>
                    <div className="px-4 py-2 font-medium text-gray-900 border-b border-gray-100">
                      {item.name}
                    </div>
                    <div className="pl-4 space-y-2">
                      {item.children.map((child) => (
                  <Link
                          key={child.name}
                          to={child.href}
                          className="block px-4 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors duration-200"
                          onClick={() => setIsOpen(false)}
                        >
                          {child.name}
                  </Link>
                ))}
                    </div>
                  </div>
                ))}
                
                <div className="pt-4 border-t border-gray-200 px-4 space-y-3">
                  <Link
                    to="/login"
                    className="block w-full text-center py-2 text-gray-700 hover:text-green-600 transition-colors duration-200 font-medium"
                    onClick={() => setIsOpen(false)}
                  >
                    Iniciar Sesión
                  </Link>
                  <Link
                    to="/register"
                    className="block w-full text-center py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all duration-200"
                    onClick={() => setIsOpen(false)}
                  >
                    Crear Menú Gratis
                  </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.nav>
  );
};

export default Navbar; 
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_LINKS = [
  { label: 'Funciones', href: '#funciones' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Precios', href: '#pricing' },
  { label: 'Demo', href: '#demo' },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // IntersectionObserver on a top sentinel — no scroll listener, no per-frame work.
  useEffect(() => {
    const sentinel = document.getElementById('scroll-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        /* Solid background (NO backdrop-blur) so scrolling never re-rasterizes a blurred layer */
        className="fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,box-shadow] duration-300"
        style={
          isScrolled
            ? { background: '#FBFAF8', borderBottom: '1px solid #ECE7E1', boxShadow: '0 1px 24px rgba(23,18,15,0.06)' }
            : { background: 'transparent', borderBottom: '1px solid transparent' }
        }
      >
        <nav className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <img
                src="/logo.jpeg"
                alt="Menuby"
                width="34"
                height="34"
                className="w-[34px] h-[34px] rounded-[11px] object-cover"
                style={{ boxShadow: '0 2px 10px rgba(232,0,45,0.18)' }}
              />
              <span className="text-[19px] font-extrabold tracking-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: '#17120F' }}>
                Menu<span style={{ color: '#E8002D' }}>by</span>
              </span>
            </Link>

            {/* Center links (desktop) */}
            <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="px-3.5 py-2 text-[13.5px] font-medium rounded-full transition-colors duration-200"
                  style={{ color: '#4B443D' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#E8002D')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#4B443D')}
                >
                  {l.label}
                </a>
              ))}
            </div>

            {/* Right CTAs (desktop) */}
            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              <Link
                to="/login"
                className="px-4 py-2 text-[13.5px] font-semibold rounded-full transition-colors duration-200"
                style={{ color: '#17120F' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#E8002D')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#17120F')}
              >
                Iniciar sesión
              </Link>
              <Link
                to="/register"
                className="group inline-flex items-center gap-1.5 px-5 py-2.5 text-[13.5px] font-bold rounded-full text-white transition-transform duration-200 active:scale-[0.97]"
                style={{ background: '#17120F', boxShadow: '0 4px 16px rgba(23,18,15,0.18)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#E8002D')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#17120F')}
              >
                Crear menú gratis
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-0.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden relative z-50 w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200 active:scale-95"
              style={{ background: isOpen ? 'transparent' : 'rgba(23,18,15,0.05)' }}
              aria-label="Menú"
              aria-expanded={isOpen}
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className={`block h-[2px] rounded-full transition-all duration-300 origin-center ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}`} style={{ background: '#17120F' }} />
                <span className={`block h-[2px] rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`} style={{ background: '#17120F' }} />
                <span className={`block h-[2px] rounded-full transition-all duration-300 origin-center ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} style={{ background: '#17120F' }} />
              </div>
            </button>
          </div>
        </nav>
      </motion.header>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 md:hidden flex flex-col"
            style={{ background: '#FBFAF8' }}
          >
            <div className="flex-1 flex flex-col justify-center px-7 gap-1">
              {NAV_LINKS.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  onClick={() => setIsOpen(false)}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                  className="py-3 text-[30px] font-extrabold tracking-tight"
                  style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: '#17120F' }}
                >
                  {l.label}
                </motion.a>
              ))}
            </div>
            <div className="px-7 pb-10 space-y-3">
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center py-4 rounded-2xl text-white font-bold text-[15px] active:scale-[0.98] transition-transform"
                style={{ background: '#E8002D', boxShadow: '0 8px 28px rgba(232,0,45,0.28)' }}
              >
                Crear menú gratis
              </Link>
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center py-4 rounded-2xl font-semibold text-[15px]"
                style={{ color: '#17120F', border: '1px solid #ECE7E1' }}
              >
                Iniciar sesión
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;

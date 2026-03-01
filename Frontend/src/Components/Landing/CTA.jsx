import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const CTA = ({
  title = '¿Listo para transformar tu restaurante?',
  subtitle = 'Únete a los cientos de restaurantes que ya aumentan sus ventas con Menuby.',
  primaryText = 'Crear Mi Menú Gratis',
  primaryLink = '/register',
  secondaryText = 'Hablar con Ventas',
  secondaryLink = 'https://wa.me/573028181520?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Menuby',
}) => (
  <section className="py-16 sm:py-20 bg-gray-900 relative overflow-hidden">
    <div className="absolute inset-0">
      <div className="absolute top-0 right-0 w-60 sm:w-96 h-60 sm:h-96 bg-red-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 sm:w-80 h-48 sm:h-80 bg-red-500/5 rounded-full blur-3xl" />
    </div>
    <div className="relative max-w-3xl mx-auto px-5 sm:px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">{title}</h2>
        <p className="text-gray-400 text-base sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto">{subtitle}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={primaryLink}
            className="inline-flex items-center justify-center gap-2 px-7 py-4 sm:py-3.5 rounded-2xl sm:rounded-xl text-white font-bold text-base sm:text-sm shadow-lg shadow-red-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.98]"
            style={{ backgroundColor: '#E31E24' }}
          >
            {primaryText}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
          <a
            href={secondaryLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-7 py-4 sm:py-3.5 rounded-2xl sm:rounded-xl bg-white/10 text-white font-semibold text-base sm:text-sm backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-all active:scale-[0.98]"
          >
            {secondaryText}
          </a>
        </div>
      </motion.div>
    </div>
  </section>
);

export default CTA;

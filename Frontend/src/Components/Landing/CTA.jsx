import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const CTA = ({ 
  title = "¿Listo para transformar tu restaurante?",
  subtitle = "Únete a los cientos de restaurantes que ya están aumentando sus ventas con Menuby. Configuración en minutos, resultados inmediatos.",
  primaryButtonText = "Crear Mi Menú Gratis",
  primaryButtonLink = "/register",
  secondaryButtonText = "Hablar con un experto",
  secondaryButtonLink = "/contact"
}) => {
  return (
    <section className="py-20 cta-section">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {title}
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            {subtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to={primaryButtonLink}
              className="px-8 py-4 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center btn-primary"
            >
              <span>{primaryButtonText}</span>
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to={secondaryButtonLink}
              className="px-8 py-4 bg-transparent hover:bg-white hover:text-gray-900 font-semibold rounded-xl border-2 transition-all duration-300 transform hover:scale-105 flex items-center btn-secondary"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{secondaryButtonText}</span>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;

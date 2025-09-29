import React from 'react';
import { motion } from 'framer-motion';

const Contact = () => {
  return (
    <div className="min-h-screen bg-white">
      
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-white via-green-50 to-white">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Contáctanos
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              ¿Tienes preguntas? ¿Necesitas ayuda? Estamos aquí para ayudarte a transformar tu restaurante.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Información de contacto
                </h2>
                
                <div className="space-y-6">
                  {/* Phone */}
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                  </div>
                  <div>
                      <h3 className="text-lg font-semibold text-gray-900">Teléfono</h3>
                      <p className="text-gray-600">+57 3028181520</p>
                      <p className="text-sm text-gray-500">Lunes a Viernes, 9:00 AM - 6:00 PM</p>
                  </div>
                </div>

                  {/* Email */}
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                  </div>
                  <div>
                      <h3 className="text-lg font-semibold text-gray-900">Email</h3>
                      <p className="text-gray-600">administrador@menuby.tech</p>
                      <p className="text-sm text-gray-500">Respuesta en menos de 24 horas</p>
                  </div>
                </div>

                  {/* Demo */}
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                <div>
                      <h3 className="text-lg font-semibold text-gray-900">Demo en Vivo</h3>
                      <a 
                        href="https://www.menuby.tech/macdonalds" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700 font-medium"
                      >
                        Ver Demo
                      </a>
                      <p className="text-sm text-gray-500">Prueba nuestra plataforma</p>
                    </div>
                </div>
                </div>
          </motion.div>

              {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Preguntas frecuentes
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      ¿Cuánto tiempo toma configurar mi menú?
                    </h3>
                    <p className="text-gray-600">
                      Solo necesitas 15 minutos para configurar tu menú básico. Nuestro equipo te ayuda con la configuración avanzada.
                    </p>
                </div>
                
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      ¿Hay costo de configuración?
                    </h3>
                    <p className="text-gray-600">
                      No, la configuración es completamente gratuita. Solo pagas la suscripción mensual de $25,000.
                    </p>
                </div>
                
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      ¿Puedo cambiar mi menú cuando quiera?
                    </h3>
                    <p className="text-gray-600">
                      Sí, puedes actualizar tu menú en tiempo real desde cualquier dispositivo, sin costo adicional.
                    </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
          </div>
      </section>
    </div>
  );
};

export default Contact; 
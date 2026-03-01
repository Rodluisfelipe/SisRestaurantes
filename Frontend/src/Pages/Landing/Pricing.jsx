import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const BRAND = '#E31E24';

const FEATURES = [
  'Menú digital ilimitado con fotos HD',
  'Pedidos por WhatsApp e In-App',
  'Pantalla de cocina en tiempo real',
  'Zonas de entrega con mapa y cobro automático',
  'Múltiples métodos de pago',
  'Notificaciones push instantáneas',
  'QR para mesas',
  'Reseñas y calificaciones',
  'Reportes y cierre diario en PDF',
  'Personalización completa de marca',
  'Soporte por WhatsApp',
  'Actualizaciones gratis de por vida',
];

const BENEFITS = [
  { icon: '📈', title: 'Aumento del 40% en ventas', desc: 'Los menús digitales aumentan el ticket promedio.' },
  { icon: '⏱️', title: 'Setup en 5 minutos', desc: 'Registra tu negocio y sube tu menú al instante.' },
  { icon: '💰', title: 'ROI desde el primer mes', desc: 'Recupera tu inversión rápidamente con más ventas.' },
  { icon: '🛡️', title: '0% comisiones', desc: 'Tarifa fija mensual, sin importar cuántos pedidos recibas.' },
];

const Pricing = () => {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Hero */}
      <section className="pt-24 sm:pt-28 pb-12 sm:pb-16 bg-gradient-to-br from-white via-red-50/40 to-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-4 py-2 rounded-full mb-5 sm:mb-6">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Plan único, máximo valor
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Inversión que se paga sola
            </h1>
            <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Un solo plan con todo incluido. Sin sorpresas, sin límites, sin comisiones ocultas.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Card */}
      <section className="py-12 sm:py-16">
        <div className="max-w-md mx-auto px-5 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative bg-white rounded-3xl border-2 border-red-100 p-6 sm:p-8 shadow-xl shadow-red-50/50"
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[11px] sm:text-xs font-bold px-4 sm:px-5 py-1.5 rounded-full shadow-lg shadow-red-500/30 whitespace-nowrap">
              14 días gratis · Sin tarjeta
            </div>

            <div className="text-center mt-4 mb-6 sm:mb-8">
              <p className="text-sm text-gray-500 mb-1">Plan Profesional</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl sm:text-5xl font-extrabold text-gray-900">$30.000</span>
                <span className="text-gray-400 text-sm">/mes</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">COP · IVA incluido</p>
            </div>

            <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <span className="text-xs sm:text-sm text-gray-700">{f}</span>
                </div>
              ))}
            </div>

            <Link
              to="/register"
              className="block w-full text-center py-4 rounded-2xl sm:rounded-xl text-white font-bold text-base sm:text-sm shadow-lg shadow-red-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.98]"
              style={{ backgroundColor: BRAND }}
            >
              Empezar Gratis →
            </Link>
            <p className="text-center text-xs text-gray-400 mt-3 sm:mt-4">Sin compromisos · Cancela cuando quieras</p>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 text-center mb-8 sm:mb-12">Beneficios comprobados</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 text-center"
              >
                <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">{b.icon}</div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-1">{b.title}</h3>
                <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4">¿Tienes dudas?</h2>
          <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8">Escríbenos por WhatsApp y te ayudamos a empezar.</p>
          <a
            href="https://wa.me/573028181520?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Menuby"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-4 sm:py-3.5 rounded-2xl sm:rounded-xl bg-green-600 text-white font-bold text-base sm:text-sm shadow-lg hover:bg-green-700 hover:-translate-y-0.5 transition-all active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            Hablar con Ventas
          </a>
        </div>
      </section>
    </div>
  );
};

export default Pricing;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import useLandingSEO from '../../hooks/useLandingSEO';
import api from '../../services/api';

/**
 * Cifras reales de la plataforma, traídas en vivo.
 *
 * Estaban escritas a mano y decían "500+ restaurantes activos" con 28
 * registrados, y "40% aumento en ventas" sin nada que lo sustente. Una cifra
 * fija envejece hasta volverse mentira sin que nadie lo note; una que se
 * consulta siempre dice la verdad.
 */
function useCifrasReales() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let vivo = true;
    api.get('/stats/public')
      .then((r) => { if (vivo && r.data) setStats(r.data); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  return stats;
}

/** "$155M", "$1.2K M" — corto, para que quepa en la tarjeta. */
function millones(v) {
  const n = Number(v) || 0;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}MM`;
  return `$${Math.round(n / 1_000_000)}M`;
}

function redondeaAbajo(v) {
  const n = Number(v) || 0;
  if (n < 100) return String(n);
  // Se redondea HACIA ABAJO: prometer de menos y cumplir de más.
  const paso = n >= 10000 ? 1000 : n >= 1000 ? 500 : 100;
  return `+${(Math.floor(n / paso) * paso).toLocaleString('es-CO')}`;
}

const FEATURES = [
  {
    icon: '📱',
    title: 'Menú Digital + QR',
    desc: 'Menú responsivo que se adapta a cualquier dispositivo. Comparte el link o imprime códigos QR para cada mesa.',
    details: ['Diseño responsivo automático', 'QR único por mesa', 'Link compartible por redes', 'Imágenes HD de tus productos']
  },
  {
    icon: '🛵',
    title: 'Pedidos a Domicilio',
    desc: 'Sistema de zonas de entrega con verificación de cobertura y cobro automático de envío.',
    details: ['Zonas de entrega en mapa', 'Cobro automático de envío', 'Verificación instantánea', 'Múltiples zonas']
  },
  {
    icon: '💳',
    title: 'Múltiples Métodos de Pago',
    desc: 'Efectivo, Nequi, Daviplata y transferencia bancaria. Los clientes ven la info y copian el número.',
    details: ['Efectivo contra entrega', 'Nequi y Daviplata', 'Transferencia bancaria', 'Info visible y copiable']
  },
  {
    icon: '👨‍🍳',
    title: 'Pantalla de Cocina',
    desc: 'Vista dedicada fullscreen con contadores de tiempo. Tu equipo ve pedidos en orden de prioridad.',
    details: ['Vista fullscreen', 'Contadores de tiempo', 'Prioridad por antigüedad', 'Alertas de demora']
  },
  {
    icon: '📊',
    title: 'Reportes y Estadísticas',
    desc: 'Dashboard con ventas diarias, productos top, ticket promedio y cierre de caja en PDF.',
    details: ['Ventas en tiempo real', 'Productos más vendidos', 'Ticket promedio', 'Cierre diario en PDF']
  },
  {
    icon: '⭐',
    title: 'Reseñas y Calificaciones',
    desc: 'Tus clientes califican su experiencia. Tú respondes y construyes reputación online.',
    details: ['Calificación 1-5 estrellas', 'Comentarios de clientes', 'Respuesta del dueño', 'Historial de reseñas']
  },
  {
    icon: '🔔',
    title: 'Notificaciones Push',
    desc: 'Recibe alertas instantáneas en tu navegador cuando llega un pedido nuevo o un pago.',
    details: ['Alerta de nuevo pedido', 'Notificación de pago', 'Sonido personalizado', 'Funciona en Chrome y Edge']
  },
  {
    icon: '💬',
    title: 'WhatsApp Integrado',
    desc: 'Personaliza tus mensajes de WhatsApp con drag & drop. Activa o desactiva secciones.',
    details: ['Plantillas personalizables', 'Drag & drop de secciones', 'Mensaje formateado', 'Link directo al chat']
  },
  {
    icon: '🎨',
    title: 'Personalización Total',
    desc: 'Tu logo, tus colores, tus horarios. Todo configurable desde el panel de administración.',
    details: ['Logo personalizado', 'Colores de marca', 'Horarios de servicio', 'Mensaje de bienvenida']
  },
];

const Section = ({ children, className = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

const Features = () => {
  const cifras = useCifrasReales();

  useLandingSEO({
    title: 'Funcionalidades del Menú Digital para Restaurantes | Menuby',
    description: 'Menú QR, pedidos a domicilio, pantalla de cocina en tiempo real, múltiples métodos de pago, WhatsApp integrado y más. Todas las herramientas que tu restaurante necesita en una sola plataforma.',
    canonical: '/features',
    keywords: 'funcionalidades menú digital, pedidos a domicilio restaurante, pantalla cocina tiempo real, menú QR restaurante, pedidos WhatsApp restaurante',
  });

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Hero */}
      <section className="pt-24 sm:pt-28 pb-12 sm:pb-16 bg-gradient-to-br from-white via-red-50/40 to-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-4 py-2 rounded-full mb-5 sm:mb-6">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              9 funcionalidades profesionales
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Funcionalidades del Menú Digital para Restaurantes
            </h1>
            <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Menú QR, pedidos online, pantalla de cocina, pagos y WhatsApp. Todo lo que necesita tu restaurante, sin código, listo para usar.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <Section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 hover:border-red-100 hover:shadow-lg hover:shadow-red-50/50 transition-all duration-300 active:scale-[0.99]"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-red-50 flex items-center justify-center text-xl sm:text-2xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1.5 sm:mb-2">{f.title}</h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed mb-3 sm:mb-4">{f.desc}</p>
                <ul className="space-y-1.5 sm:space-y-2">
                  {f.details.map((d, j) => (
                    <li key={j} className="flex items-center gap-2 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {d}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Stats */}
      <section className="py-12 sm:py-16" style={{ background: 'linear-gradient(135deg, #E31E24 0%, #b81a1f 100%)' }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
          {[
            /* Las dos primeras vienen de la base. Si aún no cargaron, se
               muestra lo que no depende de cifras, en vez de un hueco. */
            ...(cifras?.ordersTotal
              ? [{ v: redondeaAbajo(cifras.ordersTotal), l: 'Pedidos procesados' }]
              : [{ v: '24/7', l: 'Tu menú disponible' }]),
            ...(cifras?.salesTotal
              ? [{ v: millones(cifras.salesTotal), l: 'En ventas gestionadas' }]
              : [{ v: 'QR', l: 'Sin descargar nada' }]),
            { v: '5 min', l: 'Tiempo de registro' },
            { v: '0%', l: 'Comisiones' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white">{s.v}</p>
              <p className="text-xs sm:text-sm text-red-100 mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4">¿Listo para empezar?</h2>
          <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8">Crea tu menú digital en 5 minutos. Sin tarjeta, sin compromisos.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register" className="px-7 py-4 sm:py-3.5 rounded-2xl sm:rounded-xl text-white font-bold text-base sm:text-sm shadow-lg shadow-red-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.98]" style={{ backgroundColor: '#E31E24' }}>
              Crear Mi Menú Gratis →
            </Link>
            <Link to="/demo" className="px-7 py-4 sm:py-3.5 rounded-2xl sm:rounded-xl bg-white text-gray-700 font-semibold text-base sm:text-sm border border-gray-200 hover:border-gray-300 transition-all active:scale-[0.98]">
              Ver Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Features;

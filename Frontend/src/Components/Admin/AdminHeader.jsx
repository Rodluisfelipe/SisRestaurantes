import { motion } from "framer-motion";

/**
 * Configuración de tabs — títulos y descripciones para el header.
 * Elimina los 18+ líneas repetidas de {activeTab === 'x' && 'Title'}.
 */
const TAB_CONFIG = {
  'dashboard':        { title: 'Panel Principal',         desc: 'Acceso rápido a todas las funciones' },
  'products':         { title: 'Gestión de Productos',    desc: 'Administra tu menú y productos' },
  'product-order':    { title: 'Orden de Productos',      desc: 'Reordena cómo aparecen los productos en el menú' },
  'orders':           { title: 'Panel de Pedidos',        desc: 'Gestiona pedidos en tiempo real' },
  'categories':       { title: 'Gestión de Categorías',   desc: 'Organiza tu menú por categorías' },
  'toppings':         { title: 'Gestión de Extras',       desc: 'Configura extras y complementos' },
  'customers':        { title: 'Gestión de Clientes',     desc: 'Administra información y estadísticas de clientes' },
  'coupons':          { title: 'Gestión de Cupones',      desc: 'Crea y gestiona cupones de descuento para promocionar tu restaurante' },
  'tables':           { title: 'Configuración de Mesas',  desc: 'Administra mesas y códigos QR' },
  'delivery-zones':   { title: 'Zonas de Entrega',        desc: 'Define áreas de cobertura, precios y tiempos de entrega' },
  'theme':            { title: 'Personalización de Tema',  desc: 'Personaliza la apariencia de tu restaurante' },
  'location':         { title: 'Configuración de Ubicación', desc: 'Configura tu ubicación para el catálogo' },
  'catalog':          { title: 'Gestión de Catálogo',     desc: 'Gestiona banners promocionales para el catálogo' },
  'whatsapp':         { title: 'Configuración WhatsApp',  desc: 'Personaliza el formato de mensajes WhatsApp' },
  'subscription':     { title: 'Mi Suscripción',          desc: 'Gestiona tu suscripción y pagos' },
  'business':         { title: 'Configuración del Negocio', desc: 'Información y configuración general' },
  'change-password':  { title: 'Cambiar Contraseña',      desc: 'Actualiza tu contraseña de acceso' },
  'completed_orders': { title: 'Pedidos Completados',     desc: 'Historial y resumen de pedidos' },
};

export default function AdminHeader({ activeTab }) {
  const config = TAB_CONFIG[activeTab] || { title: '', desc: '' };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="hidden md:block bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40"
    >
      <div className="px-3 sm:px-4 md:px-6 py-3 md:py-4 ml-0 lg:ml-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mt-12 lg:mt-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 capitalize truncate">
              {config.title}
            </h1>
            <p className="text-slate-600 mt-1 text-xs sm:text-sm hidden sm:block">
              {config.desc}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export { TAB_CONFIG };

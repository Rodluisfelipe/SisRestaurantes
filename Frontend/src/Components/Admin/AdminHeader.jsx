/**
 * Configuración de tabs — títulos y descripciones para el header.
 * Elimina los 18+ líneas repetidas de {activeTab === 'x' && 'Title'}.
 */
import { useBusinessConfig } from '../../Context/BusinessContext';

const TAB_CONFIG = {
  'dashboard':        { title: 'Panel Principal',         desc: 'Acceso rápido a todas las funciones' },
  'products':         { title: 'Gestión de Productos',    desc: 'Administra tu menú y productos' },
  'product-order':    { title: 'Orden de Productos',      desc: 'Reordena cómo aparecen los productos en el menú' },
  'orders':           { title: 'Panel de Pedidos',        desc: 'Gestiona pedidos en tiempo real' },
  'categories':       { title: 'Gestión de Categorías',   desc: 'Organiza tu menú por categorías' },
  'toppings':         { title: 'Gestión de Extras',       desc: 'Configura extras y complementos' },
  'customers':        { title: 'Gestión de Clientes',     desc: 'Administra información y estadísticas de clientes' },
  'coupons':          { title: 'Gestión de Cupones',      desc: 'Crea y gestiona cupones de descuento para tu negocio' },
  'tables':           { title: 'Configuración de Mesas',  desc: 'Administra mesas y códigos QR' },
  'delivery-zones':   { title: 'Zonas de Entrega',        desc: 'Define áreas de cobertura, precios y tiempos de entrega' },
  'theme':            { title: 'Personalización de Tema',  desc: 'Personaliza la apariencia de tu menú digital' },
  'location':         { title: 'Configuración de Ubicación', desc: 'Configura tu ubicación para el catálogo' },
  'catalog':          { title: 'Gestión de Catálogo',     desc: 'Gestiona banners promocionales para el catálogo' },
  'whatsapp':         { title: 'Configuración WhatsApp',  desc: 'Personaliza el formato de mensajes WhatsApp' },
  'subscription':     { title: 'Mi Suscripción',          desc: 'Gestiona tu suscripción y pagos' },
  'business':         { title: 'Configuración del Negocio', desc: 'Información y configuración general' },
  'change-password':  { title: 'Cambiar Contraseña',      desc: 'Actualiza tu contraseña de acceso' },
  'completed_orders': { title: 'Pedidos Completados',     desc: 'Historial y resumen de pedidos' },
  'payment-config':   { title: 'Configuración de Pagos',  desc: 'Configura métodos de pago y modo de pedidos' },
  'reviews':          { title: 'Reseñas y Calificaciones', desc: 'Gestiona las reseñas de tus clientes' },
  'popups':           { title: 'Anuncios del menú',        desc: 'Popups para promocionar productos y ver sus estadísticas' },
};

const HOTEL_OVERRIDES = {
  'tables':           { title: 'Habitaciones',            desc: 'Administra habitaciones y códigos QR' },
  'orders':           { title: 'Pedidos Room Service',    desc: 'Gestiona pedidos en tiempo real' },
  'theme':            { title: 'Personalización de Tema', desc: 'Personaliza la apariencia de tu hotel' },
  'coupons':          { title: 'Gestión de Cupones',      desc: 'Crea y gestiona cupones de descuento para tu hotel' },
};

const SERVICE_OVERRIDES = {
  'orders':           { title: 'Panel de Citas',          desc: 'Gestiona citas en tiempo real' },
  'products':         { title: 'Gestión de Servicios',    desc: 'Administra tus servicios' },
  'completed_orders': { title: 'Citas Completadas',       desc: 'Historial y resumen de citas' },
  'tables':           { title: 'Configuración',           desc: 'Administra configuración' },
  'toppings':         { title: 'Gestión de Opciones',     desc: 'Configura variantes y opciones' },
};

export default function AdminHeader({ activeTab }) {
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const isHotel = businessConfig?.businessType === 'hotel';

  const overrides = isHotel ? HOTEL_OVERRIDES : isService ? SERVICE_OVERRIDES : {};
  const config = overrides[activeTab] || TAB_CONFIG[activeTab] || { title: '', desc: '' };

  return (
    <div className="hidden md:block bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="px-4 md:px-6 py-2 mt-12 lg:mt-0 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-slate-700 truncate">
          {config.title}
          <span className="ml-2 text-xs font-normal text-slate-400">{config.desc}</span>
        </h1>
      </div>
    </div>
  );
}

export { TAB_CONFIG };

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from '../../Context/BusinessContext';
import AI from './AdminIcons';

/**
 * Guías explicativas por sección.
 * Se muestran al hacer clic en (?) para usuarios existentes,
 * o automáticamente al desbloquear una sección para nuevos.
 */
const SECTION_GUIDES = {
  categories: {
    icon: 'folder',
    title: 'Categorías',
    tips: [
      'Organiza tu menú en secciones: Hamburguesas, Bebidas, Postres...',
      'Arrastra para cambiar el orden en que aparecen',
      'Puedes desactivar categorías sin eliminarlas'
    ]
  },
  products: {
    icon: 'utensils',
    title: 'Productos',
    tips: [
      'Agrega productos con foto, precio y descripción',
      'Asigna cada producto a una categoría',
      'Marca productos como destacados para que aparezcan primero'
    ]
  },
  'product-order': {
    icon: 'arrowPath',
    title: 'Orden de Productos',
    tips: [
      'Arrastra para ordenar tus categorías como quieres que aparezcan',
      'El orden que definas es el que verán tus clientes',
      'También puedes destacar productos específicos'
    ]
  },
  toppings: {
    icon: 'tag',
    title: 'Extras / Toppings',
    tips: [
      'Crea grupos como "Salsas", "Extras", "Bebidas"',
      'Agrega opciones con precio dentro de cada grupo',
      'Asocia grupos a productos para que el cliente los elija'
    ]
  },
  orders: {
    icon: 'clipboard',
    title: 'Pedidos',
    tips: [
      'Aquí llegan los pedidos en tiempo real',
      'Acepta, rechaza o marca como completado',
      'Recibe notificaciones cuando llega un nuevo pedido'
    ]
  },
  completed_orders: {
    icon: 'checkCircle',
    title: 'Pedidos Completados',
    tips: [
      'Historial de todos los pedidos finalizados',
      'Filtra por fecha o estado',
      'Ve el resumen de ventas del día'
    ]
  },
  customers: {
    icon: 'users',
    title: 'Clientes',
    tips: [
      'Lista de clientes que han ordenado',
      'Ve su historial de pedidos y total gastado',
      'Exporta tu base de clientes'
    ]
  },
  coupons: {
    icon: 'ticket',
    title: 'Cupones',
    tips: [
      'Crea códigos de descuento (% o monto fijo)',
      'Establece fecha de vencimiento y límite de usos',
      'Comparte cupones con tus clientes para fidelizarlos'
    ]
  },
  reviews: {
    icon: 'star',
    title: 'Reseñas',
    tips: [
      'Ve las reseñas que dejan tus clientes',
      'Responde a los comentarios',
      'Tu calificación promedio aparece en tu menú'
    ]
  },
  tables: {
    icon: 'chair',
    title: 'Mesas',
    tips: [
      'Genera códigos QR únicos por mesa',
      'Los clientes escanean y piden desde su mesa',
      'Ideal para pedidos en el local'
    ]
  },
  'delivery-zones': {
    icon: 'map',
    title: 'Zonas de Entrega',
    tips: [
      'Define zonas con costos de envío diferentes',
      'Dibuja áreas en el mapa o usa radio por km',
      'Los clientes ven el costo según su ubicación'
    ]
  },
  catalog: {
    icon: 'megaphone',
    title: 'Catálogo',
    tips: [
      'Sube banners promocionales para tu menú',
      'Aparecen en el catálogo público de MenuBy',
      'Atrae nuevos clientes desde el directorio'
    ]
  },
  whatsapp: {
    icon: 'chat',
    title: 'WhatsApp',
    tips: [
      'Personaliza el formato de mensajes de pedido',
      'Configura tu número de WhatsApp Business',
      'Los pedidos llegan formateados a tu chat'
    ]
  },
  'payment-config': {
    icon: 'banknotes',
    title: 'Pagos',
    tips: [
      'Elige el modo de pedidos: WhatsApp, en la app o ambos',
      'Configura métodos de pago: efectivo, Nequi, transferencia',
      'Los clientes pueden pagar directamente desde el menú'
    ]
  },
  subscription: {
    icon: 'creditCard',
    title: 'Suscripción',
    tips: [
      'Administra tu plan mensual',
      'Ve el estado de tu suscripción',
      'Realiza pagos y ve historial'
    ]
  },
  business: {
    icon: 'cog',
    title: 'Configuración del Negocio',
    tips: [
      'Edita nombre, logo y datos de contacto',
      'Configura horarios de atención',
      'Agrega tus redes sociales'
    ]
  },
  theme: {
    icon: 'palette',
    title: 'Tema',
    tips: [
      'Personaliza los colores de tu menú digital',
      'Elige el color de botones y acentos',
      'Tu menú refleja la identidad de tu marca'
    ]
  },
  location: {
    icon: 'mapPin',
    title: 'Ubicación',
    tips: [
      'Configura la dirección de tu negocio',
      'Aparece en el catálogo por ciudad',
      'Los clientes pueden ver tu ubicación en el mapa'
    ]
  }
};

export default function GuideOverlay({ sectionId, isOpen, onClose }) {
  const { businessConfig } = useBusinessConfig();
  const isHotel = businessConfig?.businessType === 'hotel';
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  let guide = SECTION_GUIDES[sectionId];

  // Override tips based on business type
  if (guide && sectionId === 'tables') {
    if (isHotel) {
      guide = { ...guide, title: 'Habitaciones', tips: [
        'Genera códigos QR únicos por habitación',
        'Los huéspedes escanean y piden room service desde su habitación',
        'Ideal para pedidos de room service'
      ]};
    }
  }
  if (guide && sectionId === 'orders') {
    if (isService) {
      guide = { ...guide, title: 'Citas', tips: [
        'Aquí llegan las citas en tiempo real',
        'Acepta, rechaza o marca como completada',
        'Recibe notificaciones cuando llega una nueva cita'
      ]};
    }
  }
  if (guide && sectionId === 'products') {
    if (isService) {
      guide = { ...guide, icon: 'sparkle', title: 'Servicios', tips: [
        'Agrega servicios con foto, precio y descripción',
        'Asigna cada servicio a una categoría',
        'Marca servicios como destacados para que aparezcan primero'
      ]};
    }
  }
  if (guide && sectionId === 'completed_orders') {
    if (isService) {
      guide = { ...guide, title: 'Citas Completadas', tips: [
        'Historial de todas las citas finalizadas',
        'Filtra por fecha o estado',
        'Ve el resumen de ingresos del día'
      ]};
    }
  }
  if (guide && sectionId === 'toppings') {
    if (isService) {
      guide = { ...guide, icon: 'cog', title: 'Opciones / Variantes', tips: [
        'Crea grupos como "Duración", "Intensidad", "Extras"',
        'Agrega opciones con precio dentro de cada grupo',
        'Asocia grupos a servicios para que el cliente los elija'
      ]};
    }
  }
  if (guide && sectionId === 'customers') {
    if (isService) {
      guide = { ...guide, tips: [
        'Lista de clientes que han reservado',
        'Ve su historial de citas y total gastado',
        'Exporta tu base de clientes'
      ]};
    }
  }
  if (!guide) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                {AI[guide.icon]?.('w-8 h-8 text-white') || guide.icon}
                <div>
                  <h3 className="text-lg font-bold">{guide.title}</h3>
                  <p className="text-blue-100 text-xs">¿Cómo funciona?</p>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="px-6 py-5 space-y-3">
              {guide.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-xs font-bold">{i + 1}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors text-sm inline-flex items-center justify-center gap-1.5"
              >
                Entendido {AI.check('w-4 h-4')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { SECTION_GUIDES };

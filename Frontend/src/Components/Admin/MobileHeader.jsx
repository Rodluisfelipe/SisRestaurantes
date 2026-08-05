import { motion } from 'framer-motion';
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * Tab titles for mobile header — short versions.
 */
const TAB_TITLES = {
  'dashboard':        'Inicio',
  'products':         'Productos',
  'product-order':    'Orden',
  'orders':           'Pedidos',
  'categories':       'Categorías',
  'toppings':         'Extras',
  'customers':        'Clientes',
  'coupons':          'Cupones',
  'tables':           'Mesas',
  'delivery-zones':   'Zonas',
  'delivery':         'Domicilios',
  'theme':            'Tema',
  'location':         'Ubicación',
  'catalog':          'Catálogo',
  'whatsapp':         'WhatsApp',
  'subscription':     'Suscripción',
  'business':         'Negocio',
  'change-password':  'Contraseña',
  'completed_orders': 'Completados',
  'payment-config':   'Pagos',
  'reviews':          'Reseñas',
  'popups':           'Anuncios',
  'printer':          'Impresoras',
  'team':             'Equipo',
  'bookings':         'Agenda',
  'cash-closings':    'Cierres',
  'monthly-closing':  'Cierre mensual',
  'referrals':        'Referidos',
  'loyalty':          'Fidelidad',
};

const SERVICE_OVERRIDES = {
  'orders':           'Citas',
  'products':         'Servicios',
  'completed_orders': 'Completadas',
  'toppings':         'Opciones',
};

const HOTEL_OVERRIDES = {
  'tables':           'Habitaciones',
};

/**
 * MobileHeader v3 — iOS-style with distinct dashboard vs sub-page modes.
 *
 * Dashboard mode: No centered title (greeting is in content).
 *   Shows logo + business name on left, status badge on right.
 *
 * Sub-page mode: Standard iOS nav bar.
 *   Back chevron + "Inicio" on left, centered page title, empty right.
 *
 * Only rendered on mobile (< lg). Desktop header remains unchanged.
 */
export default function MobileHeader({ activeTab, setActiveTab }) {
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const isHotel = businessConfig?.businessType === 'hotel';
  const isDashboard = activeTab === 'dashboard';

  const overrides = isHotel ? HOTEL_OVERRIDES : isService ? SERVICE_OVERRIDES : {};
  const title = overrides[activeTab] || TAB_TITLES[activeTab] || '';

  const isOpen = businessConfig?.isOpen !== false;

  return (
    <div
      className="block lg:hidden sticky top-0 z-40"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Blur background */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-2xl border-b border-slate-200/40" />

      {isDashboard ? (
        /* ══ DASHBOARD MODE — Logo + business name + status ══ */
        <div className="relative flex items-center h-[52px] px-4">
          {/* Left — Logo + Business name */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {businessConfig?.logo ? (
              <img
                src={businessConfig.logo}
                alt=""
                className="w-8 h-8 rounded-xl object-cover shadow-sm ring-1 ring-black/[0.04]"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm">
                <span className="text-white text-[12px] font-black">M</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-slate-900 truncate leading-tight">
                {businessConfig?.businessName || 'Mi Negocio'}
              </p>
              <p className="text-[11px] text-slate-400 font-medium leading-tight">Panel de control</p>
            </div>
          </div>

          {/* Right — Status badge */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
              isOpen ? 'bg-emerald-50 ring-1 ring-emerald-500/10' : 'bg-red-50 ring-1 ring-red-500/10'
            }`}>
              <div className="relative">
                <div className={`w-[6px] h-[6px] rounded-full ${
                  isOpen ? 'bg-emerald-500' : 'bg-red-400'
                }`} />
                {isOpen && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-emerald-400"
                    animate={{ scale: [1, 2, 1], opacity: [1, 0, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </div>
              <span className={`text-[11px] font-semibold ${
                isOpen ? 'text-emerald-700' : 'text-red-600'
              }`}>
                {isOpen ? 'Abierto' : 'Cerrado'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ══ SUB-PAGE MODE — Back + centered title ══ */
        <div className="relative flex items-center h-[48px] px-4">
          {/* Left — Back button */}
          <div className="w-[80px] flex items-center">
            <motion.button
              whileTap={{ scale: 0.92, x: -3 }}
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-0.5 text-red-500 -ml-1 py-1"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              <span className="text-[15px] font-medium">Inicio</span>
            </motion.button>
          </div>

          {/* Center — Title */}
          <div className="flex-1 flex justify-center">
            <motion.h1
              key={activeTab}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-[16px] font-semibold text-slate-900 truncate"
            >
              {title}
            </motion.h1>
          </div>

          {/* Right — Spacer (for balance) */}
          <div className="w-[80px]" />
        </div>
      )}
    </div>
  );
}

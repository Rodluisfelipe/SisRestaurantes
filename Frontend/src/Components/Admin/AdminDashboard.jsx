import { motion } from "framer-motion";
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * Dashboard principal del admin — grid de accesos rápidos.
 * Extraído de Admin.jsx (~275 líneas) para reducir el monolito.
 */

const DASHBOARD_ITEMS = [
  { tab: 'orders',           icon: '📋', title: 'Pedidos',        desc: 'Gestión en tiempo real',  from: 'from-blue-500',    to: 'to-blue-600',    hasBadge: true },
  { tab: 'products',         icon: '🍔', title: 'Productos',      desc: 'Administra tu menú',      from: 'from-orange-500',  to: 'to-red-500' },
  { tab: 'categories',       icon: '📂', title: 'Categorías',     desc: 'Organiza productos',      from: 'from-yellow-500',  to: 'to-orange-500' },
  { tab: 'toppings',         icon: '🧀', title: 'Extras',         desc: 'Toppings y opciones',     from: 'from-amber-500',   to: 'to-yellow-500' },
  { tab: 'customers',        icon: '👥', title: 'Clientes',       desc: 'Base de datos',           from: 'from-teal-500',    to: 'to-cyan-500' },
  { tab: 'coupons',          icon: '🎫', title: 'Cupones',        desc: 'Descuentos y ofertas',    from: 'from-pink-500',    to: 'to-rose-500' },
  { tab: 'tables',           icon: '🪑', title: 'Mesas',          desc: 'Códigos QR',              from: 'from-indigo-500',  to: 'to-blue-500' },
  { tab: 'delivery-zones',   icon: '🗺️', title: 'Zonas',          desc: 'Áreas de entrega',        from: 'from-green-500',   to: 'to-emerald-500' },
  { tab: 'catalog',          icon: '📢', title: 'Catálogo',       desc: 'Banners y promociones',   from: 'from-violet-500',  to: 'to-purple-500' },
  { tab: 'whatsapp',         icon: '💬', title: 'WhatsApp',       desc: 'Configurar mensajes',     from: 'from-green-600',   to: 'to-green-700' },
  { tab: 'subscription',     icon: '💳', title: 'Suscripción',    desc: 'Plan y pagos',            from: 'from-blue-600',    to: 'to-indigo-600' },
  { tab: 'business',         icon: '⚙️', title: 'Configuración',  desc: 'Datos del negocio',       from: 'from-slate-600',   to: 'to-slate-700' },
  { tab: 'theme',            icon: '🎨', title: 'Tema',           desc: 'Personalización',         from: 'from-fuchsia-500', to: 'to-pink-500' },
  { tab: 'location',         icon: '📍', title: 'Ubicación',      desc: 'Dirección y mapa',        from: 'from-red-500',     to: 'to-rose-500' },
  { tab: 'product-order',    icon: '🔄', title: 'Orden',          desc: 'Ordenar productos',       from: 'from-purple-500',  to: 'to-purple-600' },
  { tab: 'completed_orders', icon: '✅', title: 'Completados',    desc: 'Historial',               from: 'from-lime-500',    to: 'to-green-500' },
  { tab: 'reviews',          icon: '⭐', title: 'Reseñas',        desc: 'Calificaciones',          from: 'from-yellow-500',  to: 'to-amber-500' },
  { tab: 'payment-config',  icon: '💰', title: 'Pagos',          desc: 'Métodos y pedidos',       from: 'from-emerald-500', to: 'to-teal-500' },
  { tab: 'change-password',  icon: '🔒', title: 'Contraseña',     desc: 'Cambiar acceso',          from: 'from-gray-600',    to: 'to-slate-600' },
];

export default function AdminDashboard({ setActiveTab, pendingOrdersCount, onboarding }) {
  const { businessConfig } = useBusinessConfig();

  const isNewUser = onboarding && !onboarding.isLegacy && onboarding.level < 6;
  const progressPercent = onboarding ? (onboarding.progress || 0) : 100;
  const nextStep = onboarding?.nextStep;

  return (
    <div className="space-y-6">
      {/* Header del Dashboard */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 md:p-8 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {isNewUser ? '¡Bienvenido! 🚀' : 'Bienvenido de nuevo 👋'}
            </h1>
            <p className="text-blue-100">
              Panel de administración - {businessConfig?.businessName || 'Tu Restaurante'}
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              {businessConfig?.logo ? (
                <img 
                  src={businessConfig.logo} 
                  alt="Logo" 
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ) : (
                <span className="text-4xl">🍔</span>
              )}
            </div>
          </div>
        </div>

        {/* Onboarding Progress Bar — only for new users */}
        {isNewUser && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-100">Tu menú está al {progressPercent}%</span>
              <span className="text-xs text-blue-200">Nivel {onboarding.level || 0} / 6</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="bg-white rounded-full h-3 shadow-sm"
              />
            </div>
            {nextStep && nextStep.action && (
              <p className="mt-2 text-sm text-blue-100">
                Siguiente paso: {nextStep.action}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Getting Started Checklist — only for new users */}
      {isNewUser && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4">📋 Primeros pasos</h2>
          <div className="space-y-3">
            {[
              { done: (onboarding?.level || 0) >= 1, label: 'Crear tu cuenta', desc: '¡Listo! Ya tienes tu cuenta', icon: '✅' },
              { done: (onboarding?.level || 0) >= 2, label: 'Agrega productos a tu menú', desc: 'Ve a Productos y crea tu primer plato', icon: '🍔', tab: 'products' },
              { done: (onboarding?.level || 0) >= 3, label: 'Configura tu modo de pedidos', desc: 'WhatsApp, en la app o ambos', icon: '⚙️', tab: 'business' },
              { done: (onboarding?.level || 0) >= 4, label: 'Recibe tus primeros pedidos', desc: 'Comparte tu menú y empieza a vender', icon: '📋', tab: 'orders' },
              { done: (onboarding?.level || 0) >= 5, label: 'Personaliza tu tema', desc: 'Dale estilo a tu menú digital', icon: '🎨', tab: 'theme' },
              { done: (onboarding?.level || 0) >= 6, label: 'Explora herramientas avanzadas', desc: 'Cupones, zonas de entrega, mesas QR y más', icon: '🚀' },
            ].map((step, i) => (
              <button
                key={i}
                onClick={() => step.tab && setActiveTab(step.tab)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                  step.done
                    ? 'bg-green-50 border border-green-200'
                    : step.tab
                      ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100 cursor-pointer'
                      : 'bg-slate-50 border border-slate-200'
                }`}
              >
                <span className="text-2xl">{step.done ? '✅' : step.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${step.done ? 'text-green-700 line-through' : 'text-slate-800'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-slate-500">{step.desc}</p>
                </div>
                {!step.done && step.tab && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full shrink-0">
                    Ir →
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid de Funciones */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {DASHBOARD_ITEMS.map((item) => (
          <motion.button
            key={item.tab}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(item.tab)}
            className={`relative bg-gradient-to-br ${item.from} ${item.to} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all group`}
          >
            <div className="text-white">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="font-bold text-lg mb-1">{item.title}</h3>
              <p className={`text-xs opacity-90`}>{item.desc}</p>
            </div>
            {item.hasBadge && pendingOrdersCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                {pendingOrdersCount}
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

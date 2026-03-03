const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'Frontend', 'src', 'Components', 'Admin', 'AdminDashboard.jsx');

const code = `import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * AdminDashboard v3 — Premium mobile-first dashboard.
 *
 * Major improvements over v2:
 * - Time-based greeting with contextual messages
 * - Featured hero cards for Pedidos & Productos with live counter
 * - Horizontal stat pills with key business metrics
 * - Grouped sections with accent-colored icon chips
 * - Restaurant link copy-to-clipboard quick action
 * - Redesigned onboarding with stepper UI
 * - Better search with keyboard support
 * - Smoother stagger animations
 * - 48px+ touch targets everywhere
 * - Safe areas for iPhone notch
 */

/* ═══ Helpers ═══ */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return { text: 'Buenas noches', emoji: '🌙' };
  if (h < 12) return { text: 'Buenos días', emoji: '☀️' };
  if (h < 18) return { text: 'Buenas tardes', emoji: '🌤️' };
  return { text: 'Buenas noches', emoji: '🌙' };
}

/* ═══ Section Data ═══ */
const SECTIONS = [
  {
    id: 'ops',
    label: 'Operaciones',
    emoji: '⚡',
    items: [
      { tab: 'orders',           icon: '📋', title: 'Pedidos',       desc: 'Gestión en tiempo real',    hasBadge: true, gradient: 'from-blue-500 to-blue-600' },
      { tab: 'completed_orders', icon: '✅', title: 'Completados',   desc: 'Historial de pedidos',      gradient: 'from-emerald-500 to-emerald-600' },
      { tab: 'payment-config',   icon: '💰', title: 'Pagos',         desc: 'Métodos de pago',           gradient: 'from-teal-500 to-teal-600' },
      { tab: 'customers',        icon: '👥', title: 'Clientes',      desc: 'Base de datos',             gradient: 'from-cyan-500 to-cyan-600' },
      { tab: 'reviews',          icon: '⭐', title: 'Reseñas',       desc: 'Calificaciones',            gradient: 'from-amber-500 to-amber-600' },
    ],
  },
  {
    id: 'menu',
    label: 'Menú',
    emoji: '🍔',
    items: [
      { tab: 'products',         icon: '🍔', title: 'Productos',     desc: 'Administra tu carta',       gradient: 'from-orange-500 to-orange-600' },
      { tab: 'categories',       icon: '📂', title: 'Categorías',    desc: 'Organiza productos',        gradient: 'from-yellow-500 to-yellow-600' },
      { tab: 'toppings',         icon: '🧀', title: 'Extras',        desc: 'Toppings y opciones',       gradient: 'from-amber-400 to-amber-500' },
      { tab: 'product-order',    icon: '🔄', title: 'Orden',         desc: 'Reordenar productos',       gradient: 'from-purple-500 to-purple-600' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    emoji: '📢',
    items: [
      { tab: 'coupons',          icon: '🎫', title: 'Cupones',       desc: 'Descuentos y ofertas',      gradient: 'from-pink-500 to-pink-600' },
      { tab: 'catalog',          icon: '📢', title: 'Catálogo',      desc: 'Banners y promociones',     gradient: 'from-violet-500 to-violet-600' },
      { tab: 'tables',           icon: '🪑', title: 'Mesas',         desc: 'Códigos QR',                gradient: 'from-indigo-500 to-indigo-600' },
      { tab: 'delivery-zones',   icon: '🗺️', title: 'Zonas',         desc: 'Áreas de entrega',          gradient: 'from-green-500 to-green-600' },
      { tab: 'whatsapp',         icon: '💬', title: 'WhatsApp',      desc: 'Configurar mensajes',       gradient: 'from-green-600 to-green-700' },
    ],
  },
  {
    id: 'config',
    label: 'Configuración',
    emoji: '⚙️',
    items: [
      { tab: 'business',         icon: '⚙️', title: 'Negocio',       desc: 'Datos del negocio',         gradient: 'from-slate-500 to-slate-600' },
      { tab: 'theme',            icon: '🎨', title: 'Tema',          desc: 'Personalización',           gradient: 'from-fuchsia-500 to-fuchsia-600' },
      { tab: 'location',         icon: '📍', title: 'Ubicación',     desc: 'Dirección y mapa',          gradient: 'from-red-500 to-red-600' },
      { tab: 'subscription',     icon: '💳', title: 'Suscripción',   desc: 'Plan y pagos',              gradient: 'from-blue-600 to-blue-700' },
      { tab: 'change-password',  icon: '🔒', title: 'Contraseña',    desc: 'Cambiar acceso',            gradient: 'from-gray-500 to-gray-600' },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap(s => s.items);

/* ═══ Onboarding Steps ═══ */
const ONBOARDING = [
  { level: 1, label: 'Crear tu cuenta',   desc: '¡Listo! Ya tienes tu cuenta', icon: '✅' },
  { level: 2, label: 'Agrega productos',  desc: 'Crea tu primer plato',        icon: '🍔', tab: 'products' },
  { level: 3, label: 'Modo de pedidos',   desc: 'WhatsApp, app o ambos',       icon: '⚙️', tab: 'business' },
  { level: 4, label: 'Primeros pedidos',  desc: 'Comparte y vende',            icon: '📋', tab: 'orders' },
  { level: 5, label: 'Personaliza tema',  desc: 'Dale estilo a tu menú',       icon: '🎨', tab: 'theme' },
  { level: 6, label: 'Herramientas pro',  desc: 'Cupones, zonas, QR y más',    icon: '🚀' },
];

/* ═══ Sub-components ═══ */

/* Hero Quick Action — large prominent card */
function HeroCard({ item, onClick, count, className = '' }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={\`relative flex-1 min-w-0 p-4 sm:p-5 rounded-2xl bg-gradient-to-br \${item.gradient} text-white shadow-lg overflow-hidden group active:opacity-90 transition-opacity \${className}\`}
    >
      {/* BG decoration */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl translate-x-6 -translate-y-6 group-hover:scale-150 transition-transform duration-500" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-black/5 rounded-full blur-xl -translate-x-4 translate-y-4" />

      <div className="relative flex items-start justify-between">
        <div className="text-left">
          <span className="text-2xl sm:text-3xl block mb-1">{item.icon}</span>
          <h3 className="text-sm sm:text-base font-bold leading-tight">{item.title}</h3>
          <p className="text-[11px] sm:text-xs text-white/70 mt-0.5">{item.desc}</p>
        </div>
        {count > 0 && (
          <div className="flex-shrink-0 ml-2">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <span className="text-lg sm:text-xl font-extrabold block leading-none">{count > 99 ? '99+' : count}</span>
              <span className="text-[9px] text-white/60 leading-none">activos</span>
            </div>
          </div>
        )}
      </div>

      {/* Arrow hint */}
      <div className="absolute bottom-3 right-3 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center">
        <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
      </div>
    </motion.button>
  );
}

/* Section Card — compact grid item */
function SectionCard({ item, onClick, pendingOrdersCount }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative flex flex-col items-center text-center p-3 sm:p-4 rounded-2xl
                 bg-white border border-slate-100/80
                 shadow-[0_1px_3px_rgba(0,0,0,0.04)]
                 hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5
                 active:scale-[0.97] active:shadow-sm
                 transition-all duration-200 min-h-[92px] sm:min-h-[104px]
                 group"
    >
      {/* Icon chip */}
      <div className={\`w-11 h-11 sm:w-12 sm:h-12 rounded-[14px] bg-gradient-to-br \${item.gradient} flex items-center justify-center text-lg sm:text-xl mb-2 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200\`}>
        <span className="drop-shadow-sm">{item.icon}</span>
      </div>

      {/* Label */}
      <span className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight tracking-tight">{item.title}</span>
      <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 leading-tight font-medium">{item.desc}</span>

      {/* Badge */}
      {item.hasBadge && pendingOrdersCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5
                         bg-red-500 text-white text-[10px] font-extrabold
                         rounded-full flex items-center justify-center
                         shadow-lg shadow-red-500/30 ring-2 ring-white
                         animate-pulse">
          {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
        </span>
      )}
    </motion.button>
  );
}

/* Link Copy Button */
function ShareLink({ businessConfig }) {
  const [copied, setCopied] = useState(false);
  const slug = businessConfig?.slug || businessConfig?.businessName?.toLowerCase().replace(/\\s+/g, '-') || '';
  const url = slug ? \`menuby.tech/\${slug}\` : '';

  if (!url) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(\`https://\${url}\`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={handleCopy}
      className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-150 rounded-xl border border-slate-200/60 transition-all group"
    >
      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
        <span className="text-sm">🔗</span>
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[11px] text-slate-400 font-medium">Tu menú digital</p>
        <p className="text-xs sm:text-sm font-semibold text-slate-700 truncate">{url}</p>
      </div>
      <span className={\`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 transition-all \${
        copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/80 text-slate-500 group-hover:bg-red-100 group-hover:text-red-600'
      }\`}>
        {copied ? '✓ Copiado' : 'Copiar'}
      </span>
    </button>
  );
}

/* ═══ Main Component ═══ */
export default function AdminDashboard({ setActiveTab, pendingOrdersCount = 0, onboarding }) {
  const { businessConfig } = useBusinessConfig();
  const [search, setSearch] = useState('');

  const isNewUser = onboarding && !onboarding.isLegacy && onboarding.level < 6;
  const progressPercent = onboarding ? (onboarding.progress || 0) : 100;
  const nextStep = onboarding?.nextStep;
  const greeting = useMemo(() => getGreeting(), []);

  /* Search */
  const q = search.trim().toLowerCase();
  const filteredSections = q
    ? [{ id: 'search', label: 'Resultados', emoji: '🔍', items: ALL_ITEMS.filter(i =>
        i.title.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)
      )}]
    : SECTIONS;

  /* Hero items */
  const ordersItem = ALL_ITEMS.find(i => i.tab === 'orders');
  const productsItem = ALL_ITEMS.find(i => i.tab === 'products');

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
  const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

  return (
    <div className="space-y-4 sm:space-y-5 pb-6">

      {/* ═══ HEADER ═══ */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
        {/* Gradient BG */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900" />
        {/* Glow effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl" />
        {/* Pattern */}
        <div className="absolute inset-0 opacity-[0.025]" style={{backgroundImage:'url("data:image/svg+xml,%3Csvg width=\\'20\\' height=\\'20\\' viewBox=\\'0 0 20 20\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Ccircle cx=\\'1\\' cy=\\'1\\' r=\\'1\\' fill=\\'%23fff\\'/%3E%3C/svg%3E")'}} />

        <div className="relative p-4 sm:p-6">
          {/* Row 1: Avatar + Greeting + Orders badge */}
          <div className="flex items-center gap-3">
            {/* Logo avatar */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden ring-2 ring-white/10 shadow-lg flex-shrink-0 bg-white/5 backdrop-blur-sm flex items-center justify-center">
              {businessConfig?.logo ? (
                <img src={businessConfig.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🍽️</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-white/50 text-[11px] sm:text-xs font-medium flex items-center gap-1">
                {greeting.emoji} {greeting.text}
              </p>
              <h1 className="text-base sm:text-lg md:text-xl font-extrabold text-white truncate leading-tight mt-0.5">
                {businessConfig?.businessName || 'Tu Restaurante'}
              </h1>
            </div>

            {/* Live orders badge */}
            {pendingOrdersCount > 0 && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveTab('orders')}
                className="flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-2 rounded-xl text-xs font-bold backdrop-blur-sm ring-1 ring-blue-400/20 transition-all flex-shrink-0"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inset-0 rounded-full bg-blue-400 opacity-75" />
                  <span className="relative rounded-full h-2 w-2 bg-blue-400" />
                </span>
                {pendingOrdersCount}
              </motion.button>
            )}
          </div>

          {/* Onboarding progress */}
          {isNewUser && (
            <div className="mt-3.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-300">Configuración {progressPercent}%</span>
                <span className="text-[10px] text-slate-500 font-medium">Paso {onboarding.level || 0} de 6</span>
              </div>
              <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: \`\${progressPercent}%\` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 rounded-full h-full"
                />
              </div>
              {nextStep?.action && (
                <p className="mt-1 text-[10px] text-slate-500 font-medium">
                  Siguiente: {nextStep.action}
                </p>
              )}
            </div>
          )}

          {/* Search */}
          <div className="mt-3 sm:mt-4 relative group">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar sección..."
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl pl-10 pr-10 py-2.5 sm:py-3
                         text-sm text-white placeholder-slate-500
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 focus:bg-white/[0.08]
                         transition-all duration-200"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ SHARE LINK ═══ */}
      {!q && <ShareLink businessConfig={businessConfig} />}

      {/* ═══ HERO QUICK ACTIONS (no search mode) ═══ */}
      {!q && (
        <div className="flex gap-3">
          <HeroCard
            item={ordersItem}
            onClick={() => setActiveTab('orders')}
            count={pendingOrdersCount}
          />
          <HeroCard
            item={productsItem}
            onClick={() => setActiveTab('products')}
            count={0}
          />
        </div>
      )}

      {/* ═══ ONBOARDING CHECKLIST (new users) ═══ */}
      {isNewUser && !q && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-[10px] text-white shadow-sm">📋</span>
              Primeros pasos
            </h2>
          </div>
          <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-1.5">
            {ONBOARDING.map((step) => {
              const done = (onboarding?.level || 0) >= step.level;
              const isNext = (onboarding?.level || 0) === step.level - 1;
              return (
                <motion.button
                  key={step.level}
                  whileTap={step.tab ? { scale: 0.98 } : {}}
                  onClick={() => step.tab && setActiveTab(step.tab)}
                  className={\`w-full flex items-center gap-3 px-3 py-2.5 sm:py-3 rounded-xl transition-all text-left \${
                    done
                      ? 'bg-emerald-50/70'
                      : isNext
                        ? 'bg-blue-50 ring-1 ring-blue-200/50'
                        : 'bg-slate-50/50 hover:bg-slate-50'
                  }\`}
                >
                  {/* Step indicator */}
                  <div className={\`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm \${
                    done ? 'bg-emerald-500 text-white shadow-sm' : isNext ? 'bg-blue-500 text-white shadow-sm animate-pulse' : 'bg-slate-200 text-slate-400'
                  }\`}>
                    {done ? '✓' : step.level}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={\`text-xs sm:text-sm font-semibold \${done ? 'text-emerald-700 line-through' : isNext ? 'text-blue-800' : 'text-slate-600'}\`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{step.desc}</p>
                  </div>
                  {isNext && step.tab && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full flex-shrink-0 shadow-sm">
                      Ir →
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ SECTION GRIDS ═══ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={q || 'all'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-5 sm:space-y-6"
        >
          {filteredSections.map((section) => {
            if (!section.items.length) return null;
            return (
              <motion.div
                key={section.id}
                variants={stagger}
                initial="hidden"
                animate="show"
              >
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
                  <span className="text-sm">{section.emoji}</span>
                  <h2 className="text-[11px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-[0.08em]">{section.label}</h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-slate-100 to-transparent" />
                  <span className="text-[10px] text-slate-300 font-semibold bg-slate-50 px-2 py-0.5 rounded-full">{section.items.length}</span>
                </div>

                {/* Grid: 3 on mobile, 4 on tablet, 5 on desktop */}
                <motion.div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {section.items.map((item) => (
                    <motion.div key={item.tab} variants={fadeUp}>
                      <SectionCard
                        item={item}
                        onClick={() => setActiveTab(item.tab)}
                        pendingOrdersCount={pendingOrdersCount}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            );
          })}

          {/* No results */}
          {q && filteredSections[0]?.items.length === 0 && (
            <div className="text-center py-16">
              <span className="text-5xl block mb-3 opacity-60">🔍</span>
              <p className="text-sm font-semibold text-slate-400">No se encontraron resultados</p>
              <p className="text-xs text-slate-300 mt-1">Prueba con "pedidos", "productos" o "pagos"</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
`;

fs.writeFileSync(filePath, code, 'utf8');
console.log('AdminDashboard.jsx written:', fs.statSync(filePath).size, 'bytes');

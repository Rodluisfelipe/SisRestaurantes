import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══ iOS-style section icon components ═══ */
const SectionIcon = ({ bg, children }) => (
  <div className={`w-[29px] h-[29px] rounded-[7px] ${bg} flex items-center justify-center flex-shrink-0`}>
    {children}
  </div>
);

const Chevron = () => (
  <svg width="7" height="12" viewBox="0 0 7 12" fill="none" className="text-slate-300 flex-shrink-0">
    <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
);

/* Mini icon SVGs */
const I = {
  orders:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
  completed:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>,
  products:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  reorder:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>,
  categories: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  toppings:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="10"/></svg>,
  customers:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  coupons:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1"/></svg>,
  loyalty:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  reviews:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  tables:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/></svg>,
  zones:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 10-16 0c0 3 2.7 7 8 11.7z"/></svg>,
  delivery:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18.5" cy="17.5" r="2.5"/><circle cx="5.5" cy="17.5" r="2.5"/><path d="M15 6h5l3 5v6h-3M2 17h1M1 12h9"/><polyline points="5 12 5 6 12 6"/></svg>,
  catalog:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  whatsapp:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  payment:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
  referrals:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
  sub:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22M7 15h4"/></svg>,
  team:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  business:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  printer:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  theme:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="white"/><circle cx="17.5" cy="10.5" r=".5" fill="white"/><circle cx="8.5" cy="7.5" r=".5" fill="white"/><circle cx="6.5" cy="12.5" r=".5" fill="white"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>,
  location:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  password:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  calendar:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  cash:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>,
  reports:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
};

/**
 * MobileNavDrawer v3 — iOS Settings-style bottom sheet with search.
 * Added: search bar to filter all 25+ items; "Clientes" item; "Analítica" item.
 */
export default function MobileNavDrawer({ isOpen, onClose, activeTab, setActiveTab, businessConfig, handleLogout, userRole, pinnedIds }) {
  const [search, setSearch] = useState('');
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const isHotel = businessConfig?.businessType === 'hotel';
  const isStaff = userRole === 'staff';

  /* Reset search whenever sheet closes */
  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const sections = [
    {
      title: 'Operaciones',
      items: [
        { id: 'reports',        label: 'Analítica',           icon: I.reports,    bg: 'bg-indigo-500' },
        { id: 'completed_orders', label: 'Completados',       icon: I.completed,  bg: 'bg-emerald-500' },
        ...(businessConfig?.features?.posBetaEnabled ? [{ id: 'cash-closings', label: 'Cierres de caja', icon: I.cash, bg: 'bg-amber-500' }] : []),
        ...(businessConfig?.enableBookings ? [{ id: 'bookings', label: 'Agenda de citas', icon: I.calendar, bg: 'bg-indigo-500' }] : []),
        ...(!isService && !isHotel ? [{ id: 'delivery', label: 'Domicilios', icon: I.delivery, bg: 'bg-cyan-500' }] : []),
      ],
    },
    {
      title: isService ? 'Servicios' : 'Menú',
      items: [
        { id: 'product-order', label: 'Orden de productos', icon: I.reorder,    bg: 'bg-purple-500' },
        { id: 'categories',    label: 'Categorías',         icon: I.categories, bg: 'bg-yellow-500' },
        { id: 'toppings',      label: isService ? 'Opciones' : 'Extras y toppings', icon: I.toppings, bg: 'bg-orange-500' },
      ],
    },
    {
      title: 'Clientes y Marketing',
      items: [
        { id: 'customers',      label: 'Clientes',             icon: I.customers, bg: 'bg-cyan-500' },
        { id: 'coupons',        label: 'Cupones',              icon: I.coupons,   bg: 'bg-pink-500' },
        { id: 'loyalty',        label: 'Programa de fidelidad',icon: I.loyalty,   bg: 'bg-rose-500' },
        { id: 'reviews',        label: 'Reseñas',              icon: I.reviews,   bg: 'bg-amber-500' },
        ...(!isService ? [{ id: 'tables', label: isHotel ? 'Habitaciones' : 'Mesas y pisos', icon: I.tables, bg: 'bg-indigo-500' }] : []),
        ...(!isService && !isHotel ? [{ id: 'delivery-zones', label: 'Zonas de entrega', icon: I.zones, bg: 'bg-green-500' }] : []),
        { id: 'catalog',        label: 'Banners y catálogo',   icon: I.catalog,   bg: 'bg-violet-500' },
        { id: 'whatsapp',       label: 'WhatsApp',             icon: I.whatsapp,  bg: 'bg-green-600' },
        { id: 'payment-config', label: 'Métodos de pago',      icon: I.payment,   bg: 'bg-teal-500' },
        { id: 'referrals',      label: 'Referidos',            icon: I.referrals, bg: 'bg-blue-500' },
      ],
    },
    {
      title: 'Herramientas',
      items: [
        { id: 'tools', label: 'Calculadoras', bg: 'bg-violet-500', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg> },
      ],
    },
    {
      title: 'Configuración',
      items: [
        { id: 'subscription',   label: 'Suscripción',    icon: I.sub,      bg: 'bg-blue-600' },
        { id: 'team',           label: 'Equipo',         icon: I.team,     bg: 'bg-slate-600' },
        { id: 'business',       label: 'Info del negocio',icon: I.business, bg: 'bg-slate-500' },
        { id: 'printer',        label: 'Impresoras',     icon: I.printer,  bg: 'bg-slate-600' },
        { id: 'theme',          label: 'Tema y colores', icon: I.theme,    bg: 'bg-fuchsia-500' },
        { id: 'location',       label: 'Ubicación',      icon: I.location, bg: 'bg-red-500' },
        { id: 'change-password',label: 'Contraseña',     icon: I.password, bg: 'bg-slate-500' },
      ],
    },
  ];

  const STAFF_ALLOWED = new Set(['orders', 'completed_orders', 'cash-closings', 'change-password']);

  /* Filter out pinned items and apply staff restrictions */
  const baseSections = sections
    .map(section => ({
      ...section,
      items: section.items
        .filter(item => !pinnedIds.has(item.id))
        .filter(item => !isStaff || STAFF_ALLOWED.has(item.id)),
    }))
    .filter(section => section.items.length > 0);

  /* Apply search filter */
  const searchQ = search.toLowerCase().trim();
  const allItems = baseSections.flatMap(s => s.items);
  const searchResults = searchQ
    ? allItems.filter(i => i.label.toLowerCase().includes(searchQ))
    : null;

  const displaySections = searchResults
    ? searchResults.length > 0 ? [{ title: 'Resultados', items: searchResults }] : []
    : baseSections;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[55] lg:hidden"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="drawer-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[56] lg:hidden bg-[#f2f2f7] rounded-t-[14px] shadow-2xl max-h-[85vh] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Handle + header */}
            <div className="flex flex-col items-center pt-2 pb-2 px-4 shrink-0">
              <div className="w-9 h-[5px] rounded-full bg-slate-300/80 mb-3" />
              <div className="flex items-center justify-between w-full mb-2.5">
                <h3 className="text-[15px] font-semibold text-slate-900">Más opciones</h3>
                <button
                  onClick={onClose}
                  className="w-[30px] h-[30px] flex items-center justify-center rounded-full bg-slate-200/80 text-slate-500 active:bg-slate-300 transition-colors"
                  aria-label="Cerrar"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Search bar */}
              <div className="w-full relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SearchIcon />
                </div>
                <input
                  type="search"
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl text-[14px] text-slate-800 placeholder-slate-400 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center"
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 space-y-5">
              {/* Empty search state */}
              {searchQ && displaySections.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-[14px] font-semibold text-slate-400">Sin resultados</p>
                  <p className="text-[12px] text-slate-300 mt-1">Intenta con otro término</p>
                </div>
              )}

              {displaySections.map((section) => (
                <div key={section.title}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1 mb-1.5">
                    {section.title}
                  </p>
                  <div className="bg-white rounded-xl overflow-hidden">
                    {section.items.map((item, idx) => {
                      const isActive = activeTab === item.id;
                      const isLast = idx === section.items.length - 1;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-[11px] active:bg-slate-50 transition-colors ${!isLast ? 'border-b border-slate-100' : ''}`}
                        >
                          <SectionIcon bg={item.bg}>
                            {item.icon}
                          </SectionIcon>
                          <span className={`flex-1 text-left text-[15px] ${isActive ? 'font-semibold text-red-500' : 'font-normal text-slate-900'}`}>
                            {item.label}
                          </span>
                          <Chevron />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Logout */}
              {!searchQ && (
                <div className="bg-white rounded-xl overflow-hidden">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-3 active:bg-red-50 transition-colors"
                  >
                    <LogoutIcon />
                    <span className="text-[15px] font-normal text-red-500">Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

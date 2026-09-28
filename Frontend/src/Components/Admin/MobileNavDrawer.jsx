import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capa } from '../ui';
import { seccionesDelPanel } from '../../utils/navegacionAdmin';

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

/**
 * MobileNavDrawer — la hoja "Más" del celular, estilo Ajustes de iOS, con
 * buscador. Mismo menú que el de escritorio (utils/navegacionAdmin).
 */
export default function MobileNavDrawer({ isOpen, onClose, activeTab, setActiveTab, businessConfig, handleLogout, userRole, pinnedIds, whatsappSinLeer = 0 }) {
  const [search, setSearch] = useState('');
  const [verMas, setVerMas] = useState(false);
  const isStaff = userRole === 'staff';

  /* Reset search whenever sheet closes */
  useEffect(() => {
    if (!isOpen) { setSearch(''); setVerMas(false); }
  }, [isOpen]);

  /* Lo que ya está en la barra de abajo no se repite acá. */
  const baseSections = seccionesDelPanel({ businessConfig, esPersonal: isStaff, whatsappSinLeer })
    .map(section => ({
      ...section,
      items: section.items
        .filter(item => !pinnedIds.has(item.id))
        .map(item => ({ ...item, bg: section.color })),
    }))
    .filter(section => section.items.length > 0);

  /* Apply search filter */
  const searchQ = search.toLowerCase().trim();
  const allItems = baseSections.flatMap(s => s.items);
  const searchResults = searchQ
    ? allItems.filter(i => i.label.toLowerCase().includes(searchQ))
    : null;

  const displaySections = searchResults
    ? searchResults.length > 0 ? [{ id: 'resultados', label: 'Resultados', items: searchResults }] : []
    : baseSections.filter(section => !section.plegada || verMas || section.items.some(i => i.id === activeTab));
  const plegadas = baseSections.filter(section => section.plegada && !displaySections.includes(section));

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
          >
            <Capa onCerrar={onClose} />
          </motion.div>

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
                <div key={section.id}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1 mb-1.5">
                    {section.label}
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
                            <item.Icon className="text-white text-[13px]" />
                          </SectionIcon>
                          <span className={`flex-1 text-left text-[15px] ${isActive ? 'font-semibold text-red-500' : 'font-normal text-slate-900'}`}>
                            {item.label}
                          </span>
                          {item.badge > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-2xs font-bold flex items-center justify-center">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                          <Chevron />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Lo que casi nadie usa, a un toque pero sin estorbar. */}
              {!searchQ && plegadas.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setVerMas(true)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl text-[15px] text-slate-700 active:bg-slate-50"
                >
                  <span>{section.label}</span>
                  <span className="text-[13px] text-slate-400">{section.items.length} más</span>
                </button>
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

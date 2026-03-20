import { motion, AnimatePresence } from 'framer-motion';
import {
  FaClipboardList, FaHamburger, FaSortAmountDown, FaFolderOpen,
  FaCheese, FaUsers, FaTicketAlt, FaChair, FaMapMarkedAlt, FaMotorcycle,
  FaCheckCircle, FaBullhorn, FaWhatsapp, FaCreditCard,
  FaPalette, FaMapMarkerAlt, FaLock, FaSignOutAlt,
  FaStore, FaTools, FaCog, FaMoneyBillWave, FaStar, FaGift,
  FaChartBar, FaPrint, FaCashRegister, FaCalendarAlt, FaTimes
} from 'react-icons/fa';

/**
 * MobileNavDrawer — Bottom sheet with all admin sections.
 * Opens from the "Más" tab in MobileBottomNav.
 */
export default function MobileNavDrawer({ isOpen, onClose, activeTab, setActiveTab, businessConfig, handleLogout, userRole, pinnedIds }) {
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const isHotel = businessConfig?.businessType === 'hotel';
  const isStaff = userRole === 'staff';

  // All sections — mirrors ModernAdminSidebar structure, excludes pinned tabs
  const allItems = [
    // Operations
    ...(businessConfig?.features?.posBetaEnabled ? [{ id: 'cash-closings', label: 'Cierres', Icon: FaCashRegister }] : []),
    ...(businessConfig?.enableBookings ? [{ id: 'bookings', label: 'Agenda', Icon: FaCalendarAlt }] : []),
    // Menu
    { id: 'product-order', label: 'Orden', Icon: FaSortAmountDown },
    { id: 'categories', label: 'Categorías', Icon: FaFolderOpen },
    { id: 'toppings', label: isService ? 'Opciones' : 'Extras', Icon: isService ? FaCog : FaCheese },
    // Clients
    { id: 'customers', label: 'Clientes', Icon: FaUsers },
    { id: 'coupons', label: 'Cupones', Icon: FaTicketAlt },
    { id: 'loyalty', label: 'Fidelidad', Icon: FaGift },
    { id: 'reviews', label: 'Reseñas', Icon: FaStar },
    ...(!isService ? [{ id: 'tables', label: isHotel ? 'Habitaciones' : 'Mesas', Icon: FaChair }] : []),
    ...(!isService && !isHotel ? [{ id: 'delivery-zones', label: 'Zonas', Icon: FaMapMarkedAlt }] : []),
    ...(!isService && !isHotel ? [{ id: 'delivery', label: 'Domicilios', Icon: FaMotorcycle }] : []),
    // Marketing
    { id: 'catalog', label: 'Catálogo', Icon: FaBullhorn },
    { id: 'whatsapp', label: 'WhatsApp', Icon: FaWhatsapp },
    { id: 'payment-config', label: 'Pagos', Icon: FaMoneyBillWave },
    // Settings
    { id: 'subscription', label: 'Suscripción', Icon: FaCreditCard },
    { id: 'team', label: 'Equipo', Icon: FaUsers },
    { id: 'business', label: 'Negocio', Icon: FaStore },
    { id: 'printer', label: 'Impresoras', Icon: FaPrint },
    { id: 'theme', label: 'Tema', Icon: FaPalette },
    { id: 'location', label: 'Ubicación', Icon: FaMapMarkerAlt },
    { id: 'change-password', label: 'Contraseña', Icon: FaLock },
  ].filter(item => !pinnedIds.has(item.id));

  // Staff whitelist
  const STAFF_ALLOWED = new Set(['orders', 'completed_orders', 'cash-closings', 'change-password']);
  const visibleItems = isStaff
    ? allItems.filter(item => STAFF_ALLOWED.has(item.id))
    : allItems;

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
            className="fixed inset-0 bg-black/40 z-[55] lg:hidden"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="drawer-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[56] lg:hidden bg-white rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Handle + header */}
            <div className="flex flex-col items-center pt-3 pb-2 px-4 border-b border-slate-100 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300 mb-3" />
              <div className="flex items-center justify-between w-full">
                <h3 className="text-sm font-bold text-slate-700">Todas las secciones</h3>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                  aria-label="Cerrar"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
            </div>

            {/* Grid of items */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              <div className="grid grid-cols-4 gap-3">
                {visibleItems.map((item) => {
                  const isActive = activeTab === item.id;
                  const ItemIcon = item.Icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl transition-all min-h-[72px] ${
                        isActive
                          ? 'bg-blue-50 ring-1 ring-blue-200'
                          : 'bg-slate-50 hover:bg-slate-100 active:scale-95'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isActive ? 'bg-blue-100' : 'bg-white shadow-sm'
                      }`}>
                        <ItemIcon className={`text-base ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                      </div>
                      <span className={`text-[11px] font-medium leading-tight text-center ${
                        isActive ? 'text-blue-700' : 'text-slate-600'
                      }`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Logout */}
            <div className="px-4 py-3 border-t border-slate-100 shrink-0">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
              >
                <FaSignOutAlt className="text-sm" />
                <span className="text-sm font-medium">Cerrar Sesión</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

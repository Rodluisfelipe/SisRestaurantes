import { motion, AnimatePresence } from 'framer-motion';

/**
 * Banner animado que muestra notificación de nuevo pedido.
 * Solo se muestra cuando showOrderBanner=true y no estamos en la pestaña 'orders'.
 */
const OrderNotificationBanner = ({
  showOrderBanner,
  newOrderNotification,
  activeTab,
  setActiveTab,
  setShowOrderBanner,
}) => (
  <AnimatePresence>
    {showOrderBanner && newOrderNotification && activeTab !== 'orders' && (
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="mb-4 relative"
      >
        <button
          onClick={() => {
            setActiveTab('orders');
            setShowOrderBanner(false);
          }}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-300 group"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Icono animado */}
            <div className="shrink-0">
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <span className="text-2xl sm:text-3xl">🔔</span>
              </motion.div>
            </div>

            {/* Contenido */}
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-bold text-base sm:text-lg">¡Nuevo Pedido!</h3>
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="inline-block w-2 h-2 bg-white rounded-full"
                />
              </div>
              <p className="text-white/90 text-xs sm:text-sm truncate">
                Pedido #{newOrderNotification.orderNumber || newOrderNotification._id?.slice(-6)}
                {newOrderNotification.customer?.name && ` - ${newOrderNotification.customer.name}`}
              </p>
              <p className="text-white/80 text-[10px] sm:text-xs mt-0.5">
                Toca aquí para gestionar el pedido
              </p>
            </div>

            {/* Flecha */}
            <div className="shrink-0">
              <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.div>
            </div>
          </div>
        </button>

        {/* Botón cerrar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowOrderBanner(false);
          }}
          className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-colors group"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </motion.div>
    )}
  </AnimatePresence>
);

export default OrderNotificationBanner;

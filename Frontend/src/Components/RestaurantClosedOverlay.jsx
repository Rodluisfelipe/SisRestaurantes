import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RestaurantClosedIllustration } from './EmptyStates';

/**
 * RestaurantClosedOverlay
 * Elegant semi-transparent overlay that sits ON TOP of the menu (you can still see
 * the food behind it). Shows opening hours, social links, and a "Notify me" option.
 */
const RestaurantClosedOverlay = ({
  businessConfig,
  businessStatus,
  onDismiss,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [notifyRequested, setNotifyRequested] = useState(false);

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const themeTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';

  if (dismissed) return null;

  const dayNames = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };

  // Build schedule display from businessHours
  const getScheduleRows = () => {
    const hours = businessConfig?.businessHours;
    if (!hours) return [];
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return dayOrder
      .filter(d => hours[d]?.isOpen)
      .map(d => ({
        day: dayNames[d],
        time: `${hours[d].openTime} – ${hours[d].closeTime}`,
      }));
  };

  const scheduleRows = getScheduleRows();
  const nextOpen = businessStatus?.nextOpenTime;
  const nextOpenLabel = nextOpen
    ? `${dayNames[nextOpen.day] || nextOpen.day} a las ${nextOpen.time}`
    : null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss && onDismiss();
  };

  const handleNotify = () => {
    setNotifyRequested(true);
    // If WhatsApp number available, open a pre-filled message
    if (businessConfig?.whatsappNumber) {
      const msg = encodeURIComponent(
        `¡Hola! Me gustaría recibir una notificación cuando abran. 🔔`
      );
      const num = businessConfig.whatsappNumber.replace(/\D/g, '');
      window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Backdrop — blurred, lets menu peek through */}
        <motion.div
          className="absolute inset-0 bg-black/40 backdrop-blur-[6px]"
          onClick={handleDismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Card — slides up from bottom (mobile-first) */}
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="relative z-10 w-full max-w-md mx-3 mb-4 sm:mb-0 bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header band ── */}
          <div
            className="px-5 pt-6 pb-4 text-center relative overflow-hidden"
            style={{
              background: `linear-gradient(145deg, ${themeColor}18 0%, ${themeColor}08 100%)`,
            }}
          >
            <RestaurantClosedIllustration themeColor={themeColor} size={140} />

            <h2 className="text-xl font-bold text-gray-800 mt-2">
              Estamos cerrados ahora
            </h2>

            {nextOpenLabel && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-1.5 text-sm text-gray-500"
              >
                Abrimos{' '}
                <span className="font-semibold" style={{ color: themeColor }}>
                  {nextOpenLabel}
                </span>
              </motion.p>
            )}
          </div>

          {/* ── Schedule table (compact) ── */}
          {scheduleRows.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Horario de apertura
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {scheduleRows.map((row) => (
                  <React.Fragment key={row.day}>
                    <span className="text-gray-600 font-medium">{row.day}</span>
                    <span className="text-gray-800 text-right">{row.time}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="px-5 pt-3 pb-5 space-y-2.5">
            {/* Notify me button */}
            {businessConfig?.whatsappNumber && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleNotify}
                disabled={notifyRequested}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm shadow-md transition-all disabled:opacity-60"
                style={{
                  backgroundColor: themeColor,
                  color: themeTextColor,
                  boxShadow: `0 4px 14px ${themeColor}30`,
                }}
              >
                {notifyRequested ? (
                  <>✅ Mensaje enviado</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Avisarme cuando abran
                  </>
                )}
              </motion.button>
            )}

            {/* Dismiss — "Ver menú de todos modos" */}
            <button
              onClick={handleDismiss}
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors text-center"
            >
              Ver el menú de todos modos 👀
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RestaurantClosedOverlay;

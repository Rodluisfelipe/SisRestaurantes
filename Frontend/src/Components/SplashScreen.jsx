import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed } from 'lucide-react';
import { derivePalette } from '../utils/menuTokens';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * SplashScreen — Branded loading screen shown on first load,
 * before skeletons kick in. Shows business logo + themed spinner.
 */
const SplashScreen = ({ businessConfig, visible }) => {
  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  /* El splash vive FUERA del <main> que publica las variables --mb-*, así que
     deriva la paleta directamente en vez de leerlas (no resolverían). */
  const palette = derivePalette(themeColor, { on: businessConfig?.theme?.buttonTextColor });
  const businessName = businessConfig?.businessName || '';
  const logoUrl = businessConfig?.logo
    ? (businessConfig.logo.startsWith('http')
        ? businessConfig.logo
        : `${API_BASE_URL}${businessConfig.logo}`)
    : null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
        >
          {/* Decorative blurred circles */}
          <div
            className="absolute top-[-20%] right-[-15%] w-[60vw] h-[60vw] rounded-full opacity-10 blur-3xl"
            style={{ backgroundColor: themeColor }}
          />
          <div
            className="absolute bottom-[-20%] left-[-15%] w-[50vw] h-[50vw] rounded-full opacity-[0.07] blur-3xl"
            style={{ backgroundColor: themeColor }}
          />

          {/* Logo dentro de un anillo que gira una vuelta: la marca del negocio
              es la que "carga", no un spinner genérico. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
            className="relative z-10"
          >
            <motion.div
              className="p-[3px] rounded-full"
              style={{ background: `conic-gradient(from 0deg, ${palette.accent}, ${palette.ringPartner}, ${palette.accent})` }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
            >
              <div
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden flex items-center justify-center"
                style={{ background: '#fff', border: '3px solid #fff' }}
              >
                {/* Contra-rotación: el logo se queda quieto mientras gira el anillo */}
                <motion.div
                  className="w-full h-full flex items-center justify-center"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt={businessName} className="w-full h-full object-cover" />
                  ) : (
                    <UtensilsCrossed className="w-10 h-10 sm:w-12 sm:h-12" style={{ color: palette.accent }} />
                  )}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>

          {/* Business name */}
          {businessName && (
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mt-5 text-xl sm:text-2xl font-bold text-gray-800 text-center px-6 relative z-10"
            >
              {businessName}
            </motion.h1>
          )}

          {/* Themed spinner */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 relative z-10"
          >
            {/* Outer ring */}
            <div
              className="w-10 h-10 rounded-full border-[3px] border-gray-100"
              style={{ borderTopColor: themeColor }}
            >
              <motion.div
                className="w-full h-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, ease: 'linear', repeat: Infinity }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '3px solid transparent',
                  borderTopColor: themeColor,
                }}
              />
            </div>
          </motion.div>

          {/* Subtle tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.7 }}
            className="mt-4 text-xs text-gray-400 relative z-10"
          >
            Cargando menú...
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;

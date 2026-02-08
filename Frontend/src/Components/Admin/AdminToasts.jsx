import { motion, AnimatePresence } from "framer-motion";

/**
 * Toast de éxito y error, extraído de Admin.jsx.
 * Muestra mensajes temporales con barra de progreso y animación.
 */
export default function AdminToasts({ successMessage, setSuccessMessage, errorMessage, setErrorMessage }) {
  return (
    <>
      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed top-20 right-4 sm:right-6 z-50 max-w-[90vw] sm:max-w-md"
          >
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-2xl overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm sm:text-base leading-tight">{successMessage}</p>
                </div>
                <button
                  onClick={() => setSuccessMessage('')}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="h-1 bg-white/30"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed top-20 right-4 sm:right-6 z-50 max-w-[90vw] sm:max-w-md"
          >
            <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl shadow-2xl overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm sm:text-base leading-tight">{errorMessage}</p>
                </div>
                <button
                  onClick={() => setErrorMessage('')}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="h-1 bg-white/30"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

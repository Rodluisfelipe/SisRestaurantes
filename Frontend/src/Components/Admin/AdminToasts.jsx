import { motion, AnimatePresence } from "framer-motion";

/* SVG Icons — consistent with menu style */
const CheckIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

/**
 * Toast de éxito y error — estilo limpio sin emojis.
 * Compacto, con iconos SVG y barra de progreso animada.
 */
export default function AdminToasts({ successMessage, setSuccessMessage, errorMessage, setErrorMessage }) {
  return (
    <>
      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-4 right-4 sm:right-6 z-50 max-w-[85vw] sm:max-w-sm"
          >
            <div className="bg-white border border-emerald-200 rounded-xl shadow-lg shadow-emerald-100/40 overflow-hidden">
              <div className="px-3.5 py-2.5 flex items-center gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                  <CheckIcon />
                </div>
                <p className="flex-1 min-w-0 text-[13px] font-semibold text-slate-700 leading-snug">{successMessage}</p>
                <button
                  onClick={() => setSuccessMessage('')}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </div>
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="h-0.5 bg-emerald-400"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-4 right-4 sm:right-6 z-50 max-w-[85vw] sm:max-w-sm"
          >
            <div className="bg-white border border-amber-200 rounded-xl shadow-lg shadow-amber-100/40 overflow-hidden">
              <div className="px-3.5 py-2.5 flex items-center gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                  <AlertIcon />
                </div>
                <p className="flex-1 min-w-0 text-[13px] font-semibold text-slate-700 leading-snug">{errorMessage}</p>
                <button
                  onClick={() => setErrorMessage('')}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </div>
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 5, ease: "linear" }}
                className="h-0.5 bg-amber-400"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

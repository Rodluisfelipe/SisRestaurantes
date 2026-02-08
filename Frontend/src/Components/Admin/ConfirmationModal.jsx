import { motion } from 'framer-motion';

/**
 * Modal de confirmación para edición de producto.
 * Muestra comparación visual old → new con indicadores de cambio.
 */
const ConfirmationModal = ({ isOpen, onClose, onConfirm, product, formData }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gradient-to-b from-white to-slate-50 rounded-2xl shadow-2xl border border-slate-200/50 p-4 sm:p-6 max-w-md w-full mx-3"
      >
        <div className="flex items-center gap-3 mb-4 sm:mb-6 pb-3 border-b border-slate-200">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Confirmar Cambios
          </h2>
        </div>

        <div className="space-y-3">
          {/* Nombre */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-slate-600 font-medium text-xs mb-1.5">Nombre:</p>
            <div className="flex items-center gap-2 flex-wrap">
              {product.name !== formData.name ? (
                <>
                  <p className="line-through text-red-500 text-sm">{product.name}</p>
                  <span className="text-slate-400">→</span>
                  <p className="text-green-600 text-sm font-semibold">{formData.name}</p>
                </>
              ) : (
                <p className="text-slate-900 text-sm font-medium">{product.name}</p>
              )}
            </div>
          </div>

          {/* Descripción */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-slate-600 font-medium text-xs mb-1.5">Descripción:</p>
            <div className="flex flex-col gap-1.5">
              {product.description !== formData.description ? (
                <>
                  <p className="line-through text-red-500 text-xs">{product.description || "Sin descripción"}</p>
                  <p className="text-green-600 text-xs font-medium">{formData.description || "Sin descripción"}</p>
                </>
              ) : (
                <p className="text-slate-900 text-xs">{product.description || "Sin descripción"}</p>
              )}
            </div>
          </div>

          {/* Precio */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-slate-600 font-medium text-xs mb-1.5">Precio:</p>
            <div className="flex items-center gap-2">
              {product.price !== formData.price ? (
                <>
                  <p className="line-through text-red-500 text-sm">${product.price}</p>
                  <span className="text-slate-400">→</span>
                  <p className="text-green-600 text-base font-bold">${formData.price}</p>
                </>
              ) : (
                <p className="text-slate-900 text-base font-bold">${product.price}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-5 pt-4 border-t border-slate-200">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-all duration-200 text-sm shadow-sm border border-slate-200"
          >
            ❌ Cancelar
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold transition-all duration-200 text-sm shadow-lg"
          >
            ✅ Confirmar Cambios
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfirmationModal;

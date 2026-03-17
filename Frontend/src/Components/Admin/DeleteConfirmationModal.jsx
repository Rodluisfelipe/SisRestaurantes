import { useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Modal de confirmación para eliminación de producto.
 * Muestra detalles del producto y pide confirmación con tema oscuro.
 */
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, product }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#333F50]/95 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 max-w-md w-full border border-[#333F50] mx-3"
      >
        <div className="flex items-center mb-3 sm:mb-4 text-red-400">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 id="delete-modal-title" className="text-lg sm:text-xl font-bold text-white">Eliminar Producto</h2>
        </div>

        <p className="text-[#D1D9FF] mb-4 sm:mb-6 text-sm sm:text-base">
          ¿Estás seguro de que deseas eliminar el producto <span className="font-bold text-white">{product.name}</span>? Esta acción no se puede deshacer.
        </p>

        <div className="bg-[#051C2C]/30 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6 border border-[#333F50]">
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-0">
            <p className="text-[#A5B9FF] sm:w-32 text-xs sm:text-sm">Nombre:</p>
            <p className="text-white font-medium text-sm sm:text-base break-words">{product.name}</p>
          </div>
          <div className="flex flex-col sm:flex-row mt-2 gap-1 sm:gap-0">
            <p className="text-[#A5B9FF] sm:w-32 text-xs sm:text-sm">Precio:</p>
            <p className="text-white font-medium text-sm sm:text-base">${product.price}</p>
          </div>
          <div className="flex flex-col sm:flex-row mt-2 gap-1 sm:gap-0">
            <p className="text-[#A5B9FF] sm:w-32 text-xs sm:text-sm">Categoría:</p>
            <p className="text-white font-medium text-sm sm:text-base">{product.categoryName || "Sin categoría"}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg text-white bg-[#333F50] hover:bg-[#333F50]/80 transition-colors text-sm sm:text-base order-2 sm:order-1"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors text-sm sm:text-base order-1 sm:order-2"
          >
            Eliminar Producto
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DeleteConfirmationModal;

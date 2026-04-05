import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * MobileBottomSheet — Reusable iOS-style bottom sheet for mobile, modal on desktop.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - title?: string (optional header title)
 *  - children: React.ReactNode
 *  - maxHeight?: string (default '92vh')
 */
export default function MobileBottomSheet({ isOpen, onClose, title, children, maxHeight = '92vh' }) {
  // Close on Escape
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKey]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 flex lg:items-center items-end justify-center lg:p-4 z-[52]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-2xl lg:rounded-xl w-full lg:max-w-lg overflow-hidden flex flex-col"
            style={{ maxHeight }}
          >
            {/* Drag handle — mobile */}
            <div className="lg:hidden flex justify-center pt-2 pb-1">
              <div className="w-9 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

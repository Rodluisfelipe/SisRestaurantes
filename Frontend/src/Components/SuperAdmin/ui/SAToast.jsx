import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

export default function SAToast({ message, type = 'success', visible, onClose, duration = 4000 }) {
  useEffect(() => {
    if (visible && duration > 0) {
      const t = setTimeout(onClose, duration);
      return () => clearTimeout(t);
    }
  }, [visible, duration, onClose]);

  const styles = {
    success: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
    error: 'bg-red-500/15 border-red-500/25 text-red-400',
    info: 'bg-cyan-500/15 border-cyan-500/25 text-cyan-400',
    warning: 'bg-amber-500/15 border-amber-500/25 text-amber-400',
  };

  const icons = {
    success: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    error: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />,
    info: <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />,
    warning: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />,
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={`fixed top-5 left-1/2 z-[70] flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium shadow-xl shadow-black/20 ${styles[type]}`}
          onClick={onClose}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            {icons[type]}
          </svg>
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

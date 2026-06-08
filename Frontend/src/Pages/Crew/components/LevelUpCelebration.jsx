import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { celebrate } from './confettiBurst';
import AnimatedCounter from './AnimatedCounter';

/**
 * Pantalla completa cuando el worker sube de nivel.
 * Confetti + número grande animado + acción opcional.
 */
export default function LevelUpCelebration({ open, fromLevel, toLevel, onClose }) {
  useEffect(() => {
    if (!open) return;
    celebrate();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#0a0a14]/95 backdrop-blur-2xl"
          onClick={onClose}
        >
          {/* Background animated mesh */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-red-300/40 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-red-400/20 rounded-full blur-[100px]" />
          </motion.div>

          <motion.div
            initial={{ scale: 0.7, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className="relative text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-red-600 mb-2"
            >
              ¡Subiste de nivel!
            </motion.p>

            {/* Rotating star halo + number */}
            <div className="relative w-44 h-44 mx-auto mb-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0"
              >
                {[...Array(12)].map((_, i) => (
                  <span
                    key={i}
                    className="absolute top-1/2 left-1/2 w-2 h-8 -translate-x-1/2 origin-bottom"
                    style={{
                      transform: `translate(-50%, -100%) rotate(${i * 30}deg) translateY(-30px)`,
                      background: 'linear-gradient(to top, transparent, #EF4444)',
                      borderRadius: '999px',
                    }}
                  />
                ))}
              </motion.div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.4 }}
                className="absolute inset-6 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-2xl shadow-red-500/50 flex items-center justify-center"
              >
                <span className="text-white text-[64px] font-black tabular-nums leading-none">
                  <AnimatedCounter from={fromLevel} value={toLevel} duration={1.4} />
                </span>
              </motion.div>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-[18px] font-extrabold text-white"
            >
              Nivel {toLevel} alcanzado
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-[13px] text-white/50 mt-1"
            >
              Sigue completando turnos para subir aún más rápido
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="mt-7 px-8 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-[14px] shadow-2xl shadow-red-500/40"
            >
              Continuar
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

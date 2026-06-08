import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { burstConfetti } from './confettiBurst';

const BADGE_INFO = {
  first_shift: { label: 'Primer turno', desc: 'Tu primer turno completado con éxito', color: 'from-red-500 to-red-700' },
  '10_shifts': { label: '10 turnos', desc: 'Has completado 10 turnos', color: 'from-red-600 to-red-800' },
  '100_hours': { label: '100 horas', desc: 'Acumulaste 100 horas de trabajo', color: 'from-red-400 to-red-600' },
  perfect_week: { label: 'Semana perfecta', desc: '5 turnos sin faltas en una semana', color: 'from-red-500 to-red-700' },
  night_owl: { label: 'Búho nocturno', desc: '5 turnos nocturnos completados', color: 'from-red-700 to-red-900' },
  early_bird: { label: 'Madrugador', desc: '5 turnos matutinos completados', color: 'from-red-400 to-red-500' },
  punctual: { label: 'Puntualidad', desc: '10 check-ins puntuales', color: 'from-red-500 to-red-600' },
  team_player: { label: 'Buen equipo', desc: 'Reconocido por colaborar', color: 'from-red-500 to-red-700' },
  sos_hero: { label: 'Disponibilidad inmediata', desc: '3 turnos urgentes aceptados', color: 'from-red-600 to-red-800' },
  explorer: { label: 'Explorador', desc: 'Trabajaste en 10 negocios distintos', color: 'from-red-400 to-red-600' },
  loyal: { label: 'Cliente recurrente', desc: 'Volviste 20 veces al mismo negocio', color: 'from-red-600 to-red-800' },
};

export default function BadgeReveal({ badgeKey, onClose }) {
  const [flipped, setFlipped] = useState(false);
  const info = BADGE_INFO[badgeKey] || { label: badgeKey, desc: 'Reconocimiento desbloqueado', color: 'from-red-500 to-red-700' };

  useEffect(() => {
    const t1 = setTimeout(() => setFlipped(true), 600);
    const t2 = setTimeout(() => burstConfetti({ origin: { x: 0.5, y: 0.45 }, particleCount: 50 }), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-[#0a0a14]/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.6, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.7, y: 20 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          className="text-center w-full max-w-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-red-400 mb-3">Reconocimiento</p>

          {/* 3D flip card */}
          <div className="perspective-[1000px] mb-5">
            <motion.div
              animate={{ rotateY: flipped ? 0 : 180 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-44 h-44 mx-auto"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Back face (sealed) */}
              <div
                className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1a1a2e] to-[#0a0a14] flex items-center justify-center shadow-2xl"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <span className="text-[60px]">?</span>
              </div>

              {/* Front face (revealed) */}
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${info.color} flex items-center justify-center shadow-2xl overflow-hidden`}
                style={{ backfaceVisibility: 'hidden' }}
              >
                {/* Holographic shimmer */}
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: 1.2 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                />
                {/* Star icon */}
                <svg className="w-20 h-20 text-white drop-shadow-2xl relative" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z" />
                </svg>
                {/* Sparkles overlay */}
                {[...Array(6)].map((_, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 1 + i * 0.2, ease: 'easeInOut' }}
                    className="absolute w-1.5 h-1.5 bg-white rounded-full"
                    style={{
                      top: `${20 + Math.random() * 60}%`,
                      left: `${20 + Math.random() * 60}%`,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: flipped ? 1 : 0, y: flipped ? 0 : 10 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-[18px] font-extrabold text-white">{info.label}</p>
            <p className="text-[13px] text-white/70 mt-1.5 leading-relaxed">{info.desc}</p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: flipped ? 1 : 0 }}
            transition={{ delay: 0.8 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="mt-6 px-7 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-[13px] shadow-2xl shadow-red-500/30"
          >
            Continuar
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

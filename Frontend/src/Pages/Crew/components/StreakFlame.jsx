import { motion } from 'framer-motion';

/**
 * Llama animada para mostrar racha de turnos consecutivos.
 * Tres tamaños: sm, md, lg.
 */
export default function StreakFlame({ days = 0, size = 'md' }) {
  if (days < 1) return null;
  const sizes = {
    sm: { wrap: 'gap-1 px-2 py-1', svg: 'w-3.5 h-3.5', text: 'text-[11px]' },
    md: { wrap: 'gap-1.5 px-2.5 py-1', svg: 'w-4 h-4', text: 'text-[12px]' },
    lg: { wrap: 'gap-2 px-3 py-1.5', svg: 'w-5 h-5', text: 'text-[14px]' },
  };
  const s = sizes[size] || sizes.md;
  return (
    <motion.span
      initial={{ scale: 0.85 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 250, damping: 16 }}
      className={`inline-flex items-center ${s.wrap} bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300 rounded-full`}
    >
      <motion.svg
        animate={{
          scale: [1, 1.12, 1],
          rotate: [0, -3, 3, 0],
        }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        className={`${s.svg} text-orange-500`}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M13.5 2c-1.5 2-2 4-2 5.5 0 1.4.5 2.5 1.5 3.5C11 12 9 13 9 16c0 3 2.5 5 4.5 5s4.5-2 4.5-5c0-1.5-.5-3-1.5-4 1 .5 1.5 1.5 1.5 3 0 1-.5 2-1.5 3 2.5-1 4-3 4-6s-2-6-5-9c-1 1-2 2-2 3z" />
      </motion.svg>
      <span className={`${s.text} font-extrabold text-orange-900 tabular-nums`}>{days}</span>
    </motion.span>
  );
}

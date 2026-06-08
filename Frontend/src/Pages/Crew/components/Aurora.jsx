/**
 * Aurora — fondo animado con blobs de gradient flotando.
 * Es el lenguaje visual base del Crew: "espacio cósmico" donde vive todo.
 *
 * Variantes:
 *   - default (dark): fondo deep navy con auroras rojas/violetas/amber
 *   - light: para overlays sobre fondos claros (auroras más sutiles)
 *   - hero: blobs más grandes, animación más lenta y dramática
 *
 * Tip: usar position absolute/fixed dentro de un contenedor relativo.
 */
import { motion } from 'framer-motion';

const VARIANTS = {
  default: {
    bg: 'bg-[#0a0a14]',
    blobs: [
      { c: 'bg-red-500/40', size: 'w-[420px] h-[420px]', x: '-15%', y: '-10%', dx: ['-15%', '5%', '-15%'], dy: ['-10%', '5%', '-10%'], dur: 14 },
      { c: 'bg-fuchsia-500/30', size: 'w-[360px] h-[360px]', x: '60%', y: '20%', dx: ['60%', '45%', '60%'], dy: ['20%', '35%', '20%'], dur: 18 },
      { c: 'bg-amber-400/30', size: 'w-[300px] h-[300px]', x: '20%', y: '70%', dx: ['20%', '35%', '20%'], dy: ['70%', '60%', '70%'], dur: 16 },
      { c: 'bg-cyan-400/20', size: 'w-[280px] h-[280px]', x: '75%', y: '75%', dx: ['75%', '65%', '75%'], dy: ['75%', '85%', '75%'], dur: 20 },
    ],
  },
  hero: {
    bg: 'bg-[#08080f]',
    blobs: [
      { c: 'bg-red-500/50', size: 'w-[560px] h-[560px]', x: '-20%', y: '-20%', dx: ['-20%', '10%', '-20%'], dy: ['-20%', '0%', '-20%'], dur: 22 },
      { c: 'bg-violet-600/40', size: 'w-[480px] h-[480px]', x: '60%', y: '10%', dx: ['60%', '40%', '60%'], dy: ['10%', '30%', '10%'], dur: 24 },
      { c: 'bg-orange-500/35', size: 'w-[400px] h-[400px]', x: '30%', y: '70%', dx: ['30%', '45%', '30%'], dy: ['70%', '55%', '70%'], dur: 20 },
    ],
  },
  light: {
    bg: 'bg-white',
    blobs: [
      { c: 'bg-red-300/40', size: 'w-[320px] h-[320px]', x: '-10%', y: '-10%', dx: ['-10%', '5%', '-10%'], dy: ['-10%', '0%', '-10%'], dur: 16 },
      { c: 'bg-amber-300/30', size: 'w-[280px] h-[280px]', x: '70%', y: '60%', dx: ['70%', '60%', '70%'], dy: ['60%', '70%', '60%'], dur: 18 },
    ],
  },
};

export default function Aurora({ variant = 'default', className = '', grid = true }) {
  const v = VARIANTS[variant] || VARIANTS.default;
  return (
    <div className={`absolute inset-0 overflow-hidden ${v.bg} ${className}`} aria-hidden>
      {v.blobs.map((b, i) => (
        <motion.div
          key={i}
          initial={{ x: b.x, y: b.y, opacity: 0 }}
          animate={{ x: b.dx, y: b.dy, opacity: 1 }}
          transition={{
            x: { duration: b.dur, repeat: Infinity, ease: 'easeInOut' },
            y: { duration: b.dur, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 1.2, delay: i * 0.15 },
          }}
          className={`absolute rounded-full blur-[100px] ${b.c} ${b.size}`}
        />
      ))}

      {/* Sutil rejilla futurista */}
      {grid && (
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 80%)',
          }}
        />
      )}

      {/* Vignette para que el contenido respire */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30 pointer-events-none" />
    </div>
  );
}

/**
 * Sparkles flotantes — capa decorativa opcional para dar vida.
 */
export function Sparkles({ count = 18, className = '' }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} aria-hidden>
      {items.map((i) => {
        const left = (i * 31 + 13) % 100;
        const top = (i * 47 + 7) % 100;
        const size = 1 + (i % 3);
        const delay = (i % 7) * 0.3;
        const duration = 2.5 + (i % 5) * 0.4;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0, 1, 0] }}
            transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              boxShadow: `0 0 ${4 + size * 2}px rgba(255,255,255,0.9), 0 0 ${8 + size * 3}px rgba(255,140,0,0.5)`,
            }}
            className="absolute rounded-full bg-white"
          />
        );
      })}
    </div>
  );
}

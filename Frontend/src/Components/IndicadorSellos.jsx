import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Gift } from 'lucide-react';
import { imageAt } from '../utils/imageCdn';

/**
 * Los sellos en la fila de historias, a la derecha: un círculo del mismo
 * tamaño cuyo anillo se llena según los sellos. Por dentro alterna solo (o
 * deslizando) entre "0/8" y "Gana" con la foto del premio.
 */
export default function IndicadorSellos({ tarjeta, fotoPremio, onAbrir }) {
  const reduce = useReducedMotion();
  const [vista, setVista] = useState(0);   // 0: sellos · 1: premio
  const [sinFoto, setSinFoto] = useState(false);
  const arrastrado = useRef(false);

  // Alterna solo cada 3 s (no si el sistema pide menos movimiento)
  useEffect(() => {
    if (reduce) return undefined;
    const t = setInterval(() => setVista((v) => 1 - v), 3000);
    return () => clearInterval(t);
  }, [reduce]);

  const { sellos, requeridos, premiosDisponibles, premio } = tarjeta;
  const listo = premiosDisponibles > 0;
  const avance = listo ? 100 : Math.round((sellos / requeridos) * 100);
  const foto = fotoPremio && !sinFoto ? fotoPremio : null;
  const entrada = { initial: { x: 18, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -18, opacity: 0 }, transition: { duration: 0.22 } };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={() => { if (!arrastrado.current) onAbrir?.(); }}
      className="flex flex-col items-center gap-1.5 w-[66px] shrink-0"
      aria-label={listo ? `Tienes tu premio: ${premio}` : `Llevas ${sellos} de ${requeridos} sellos. Gana ${premio}`}
    >
      <span
        className="w-[62px] h-[62px] rounded-full p-[3px] flex items-center justify-center"
        style={{ background: `conic-gradient(var(--mb-accent) ${avance}%, var(--mb-line) ${avance}% 100%)` }}
      >
        <motion.span
          className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center touch-pan-y"
          style={{ border: '2.5px solid var(--mb-surface)', background: 'var(--mb-surface-2)' }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.35}
          onDragStart={() => { arrastrado.current = true; }}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 12) setVista((v) => 1 - v);
            setTimeout(() => { arrastrado.current = false; }, 0);
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {vista === 0 ? (
              <motion.span key="sellos" className="flex items-baseline font-black tabular-nums leading-none" style={{ color: 'var(--mb-ink)' }} {...entrada}>
                <span className="text-[19px]">{sellos}</span>
                <span className="text-[12px]" style={{ color: 'var(--mb-ink-3)' }}>/{requeridos}</span>
              </motion.span>
            ) : (
              <motion.span key="premio" className="absolute inset-0 flex items-center justify-center" {...entrada}>
                {foto ? (
                  <img src={imageAt(foto, 160)} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setSinFoto(true)} />
                ) : (
                  <Gift className="w-[20px] h-[20px] -mt-2" style={{ color: 'var(--mb-accent)' }} strokeWidth={2.3} />
                )}
                <span
                  className="absolute bottom-[5px] left-1/2 -translate-x-1/2 px-1.5 py-[1px] rounded-full text-[9px] font-black uppercase tracking-wide"
                  style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent, #fff)' }}
                >
                  {listo ? '¡Tuyo!' : 'Gana'}
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>
      </span>
      <span className="text-[11px] font-semibold" style={{ color: 'var(--mb-ink-2)' }}>Mis sellos</span>
    </motion.button>
  );
}

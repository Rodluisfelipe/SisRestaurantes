import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Gift } from 'lucide-react';
import { imageAt } from '../utils/imageCdn';
import { ANILLO_MARCA } from '../utils/anilloMarca';

/**
 * La tarjeta de sellos en la fila de historias. Es una píldora del mismo alto
 * que los círculos, con su mismo anillo y su nombre debajo, que ocupa el
 * espacio libre a la derecha. Alterna sola cada 3,5 s (o deslizando):
 *   1) cuántos sellos lleva, con anillo de avance;
 *   2) la foto del premio y qué se gana.
 */
function Anillo({ sellos, requeridos, listo }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const avance = listo ? 1 : Math.min(1, sellos / requeridos);
  return (
    <span className="relative w-[46px] h-[46px] shrink-0 rounded-full" style={{ background: 'var(--mb-card, #fff)' }}>
      <svg viewBox="0 0 46 46" className="w-full h-full -rotate-90">
        <circle cx="23" cy="23" r={r} fill="none" stroke="var(--mb-line)" strokeWidth="4.5" />
        <motion.circle
          cx="23" cy="23" r={r} fill="none" stroke="var(--mb-accent)" strokeWidth="4.5" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - avance) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-black tabular-nums leading-none">
        <span className="text-[14px]" style={{ color: 'var(--mb-ink)' }}>{sellos}</span>
        <span className="text-[9px]" style={{ color: 'var(--mb-ink-3)' }}>/{requeridos}</span>
      </span>
    </span>
  );
}

/* Lo que se gana, en una palabra, para cuando no cabe el nombre completo */
function premioCorto(nombre = '') {
  const pct = nombre.match(/\d+\s*%/);
  if (pct) return pct[0].replace(/\s/g, '');
  const plata = nombre.match(/\$\s*[\d.]+/);
  if (plata) return plata[0].replace(/\s/g, '');
  return /gratis/i.test(nombre) ? 'gratis' : 'premio';
}

export default function IndicadorSellos({ tarjeta, fotoPremio, onAbrir }) {
  const reduce = useReducedMotion();
  const [vista, setVista] = useState(0);   // 0: sellos · 1: premio
  const [sinFoto, setSinFoto] = useState(false);
  const arrastrado = useRef(false);

  // Con tres historias queda poco espacio: los textos se acortan
  const caja = useRef(null);
  const [angosta, setAngosta] = useState(false);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => setAngosta(el.offsetWidth < 175);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) return undefined;
    const t = setInterval(() => setVista((v) => 1 - v), 3500);
    return () => clearInterval(t);
  }, [reduce, vista]);   // deslizar reinicia el conteo

  const { sellos, requeridos, premiosDisponibles, premio } = tarjeta;
  const listo = premiosDisponibles > 0;
  const faltan = Math.max(0, requeridos - sellos);
  const foto = fotoPremio && !sinFoto ? fotoPremio : null;
  const entrada = {
    initial: { y: 12, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -12, opacity: 0 },
    transition: { duration: 0.25, ease: 'easeOut' },
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={() => { if (!arrastrado.current) onAbrir?.(); }}
      className="w-full flex flex-col items-center gap-1.5"
      aria-label={listo ? `Ya ganaste ${premio}. Ver mi tarjeta` : `Llevas ${sellos} de ${requeridos} sellos. Gana ${premio}. Ver mi tarjeta`}
    >
      {/* El mismo anillo de las historias */}
      <span
        ref={caja}
        className="w-full h-[62px] rounded-full p-[2.5px]"
        style={{ background: ANILLO_MARCA }}
      >
        <span
          className="relative w-full h-full rounded-full overflow-hidden block touch-pan-y"
          style={{ border: '2.5px solid var(--mb-surface)', background: listo ? 'var(--mb-accent-soft)' : 'var(--mb-surface-2)' }}
        >
          <motion.span
            className="absolute inset-0 block"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragStart={() => { arrastrado.current = true; }}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 16) setVista((v) => 1 - v);
              setTimeout(() => { arrastrado.current = false; }, 0);
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {vista === 0 ? (
                <motion.span key="sellos" className="absolute inset-0 flex items-center gap-2 pl-[3px] pr-3" {...entrada}>
                  <Anillo sellos={sellos} requeridos={requeridos} listo={listo} />
                  {angosta ? (
                    <span className="text-left leading-none whitespace-nowrap">
                      <span className="block text-[10px] font-bold" style={{ color: 'var(--mb-ink-2)' }}>{listo ? '¡Tarjeta' : 'faltan'}</span>
                      <span className="block text-[17px] font-black tabular-nums mt-0.5" style={{ color: listo ? 'var(--mb-accent)' : 'var(--mb-ink)' }}>{listo ? 'llena!' : faltan}</span>
                    </span>
                  ) : (
                    <span className="min-w-0 text-left leading-tight">
                      <span className="block text-[12px] font-black" style={{ color: listo ? 'var(--mb-accent)' : 'var(--mb-ink)' }}>
                        {listo ? '¡Tarjeta llena!' : `Te faltan ${faltan}`}
                      </span>
                      {!listo && <span className="block text-[11px] font-semibold" style={{ color: 'var(--mb-ink-2)' }}>para tu premio</span>}
                    </span>
                  )}
                </motion.span>
              ) : (
                <motion.span key="premio" className="absolute inset-0 flex items-center gap-2 pl-[3px] pr-3" {...entrada}>
                  <span className="w-[46px] h-[46px] rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ background: 'var(--mb-card, #fff)', color: 'var(--mb-accent)' }}>
                    {foto
                      ? <img src={imageAt(foto, 120)} alt="" className="w-full h-full object-cover" onError={() => setSinFoto(true)} />
                      : <Gift className="w-5 h-5" strokeWidth={2.3} />}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-[9px] font-black uppercase tracking-[0.12em] leading-none" style={{ color: 'var(--mb-accent)' }}>
                      {listo ? '¡Es tuyo!' : 'Gana'}
                    </span>
                    {angosta ? (
                      <span className="block text-[15px] font-black leading-none mt-1 whitespace-nowrap" style={{ color: 'var(--mb-ink)' }}>
                        {premioCorto(premio)}
                      </span>
                    ) : (
                      <span className="block text-[12px] font-black leading-[1.15] break-words mt-0.5" style={{ color: 'var(--mb-ink)' }}>
                        {premio}
                      </span>
                    )}
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.span>
        </span>
      </span>
      <span className="text-[11px] font-semibold" style={{ color: 'var(--mb-ink-2)' }}>Mis sellos</span>
    </motion.button>
  );
}

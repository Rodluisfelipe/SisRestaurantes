import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Gift, ChefHat, Tag, Star } from 'lucide-react';
import { imageAt } from '../utils/imageCdn';

/**
 * Por qué pedir por aquí y no por WhatsApp, contado con lo que el negocio
 * tiene de verdad: la foto de su premio, sus productos con su precio, sus
 * medios de pago. Una diapositiva a la vez; pasa sola y se desliza con el
 * dedo. Arriba, barras como las de las historias marcan el avance.
 *
 * Cada diapositiva: { clave, kicker, titulo, texto, visual }
 *   visual: { tipo: 'sellos' | 'foto' | 'precio' | 'vivo' | 'pagos' | 'icono', ... }
 */
const DURACION = 4200;

const GoogleG = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
);


function Foto({ src, alt = '', icono: Icono = Gift, className = '' }) {
  const [falla, setFalla] = useState(!src);
  if (falla) {
    return (
      <span className={`flex items-center justify-center ${className}`} style={{ background: 'var(--mb-accent-soft)', color: 'var(--mb-accent)' }}>
        <Icono className="w-9 h-9" strokeWidth={1.8} />
      </span>
    );
  }
  return <img src={imageAt(src, 320)} alt={alt} className={`object-cover ${className}`} onError={() => setFalla(true)} />;
}

function Visual({ v, logo, compacto }) {
  const lado = compacto ? 84 : 104;
  const caja = { width: lado, height: lado };

  if (v.tipo === 'sellos') {
    return (
      <span className="relative shrink-0" style={caja}>
        <Foto src={v.foto} icono={Gift} className="w-full h-full rounded-2xl" />
        {/* El sello del negocio, estampado en la esquina */}
        <span className="absolute -bottom-2 -left-2 w-9 h-9 rounded-full overflow-hidden rotate-[-12deg]"
          style={{ boxShadow: '0 0 0 2.5px var(--mb-accent), 0 0 0 5px var(--mb-card)', background: 'var(--mb-card)' }}>
          {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : null}
        </span>
      </span>
    );
  }

  if (v.tipo === 'precio') {
    return (
      <span className="relative shrink-0" style={caja}>
        <Foto src={v.foto} icono={Tag} className="w-full h-full rounded-2xl" />
        <span className="absolute bottom-1.5 left-1.5 right-1.5 text-center rounded-lg py-0.5 text-[12px] font-black tabular-nums"
          style={{ background: 'var(--mb-card)', color: 'var(--mb-ink)' }}>
          {v.precio}
        </span>
      </span>
    );
  }

  if (v.tipo === 'foto') {
    return <span className="shrink-0" style={caja}><Foto src={v.foto} icono={ChefHat} className="w-full h-full rounded-2xl" /></span>;
  }

  if (v.tipo === 'vivo') {
    // Tres pasos y un punto que avanza: así se ve el seguimiento de verdad
    const pasos = ['Recibido', 'Preparando', v.ultimo || 'Listo'];
    return (
      <span className="shrink-0 flex flex-col justify-center gap-2 pl-1" style={{ width: lado }}>
        {pasos.map((p, i) => (
          <span key={p} className="flex items-center gap-2">
            <motion.span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: 'var(--mb-line)' }}
              animate={{ background: ['var(--mb-line)', 'var(--mb-accent)', 'var(--mb-accent)'] }}
              transition={{ duration: 3.6, times: [0, 0.2 + i * 0.25, 1], repeat: Infinity }}
            />
            <span className="text-[12px] font-bold" style={{ color: 'var(--mb-ink-2)' }}>{p}</span>
          </span>
        ))}
      </span>
    );
  }

  if (v.tipo === 'pagos') {
    return (
      <span className="shrink-0 flex flex-col justify-center gap-1.5" style={{ width: lado }}>
        {v.medios.slice(0, 3).map((m) => (
          <span key={m} className="h-7 rounded-lg px-2 flex items-center text-[12px] font-black"
            style={{ background: 'var(--mb-surface-2)', color: 'var(--mb-ink)' }}>
            {m}
          </span>
        ))}
      </span>
    );
  }

  const Icono = v.icono || Gift;
  return (
    <span className="shrink-0 rounded-2xl flex items-center justify-center" style={{ ...caja, background: 'var(--mb-accent-soft)', color: 'var(--mb-accent)' }}>
      <Icono className="w-9 h-9" strokeWidth={1.8} />
    </span>
  );
}

export default function CarruselRazones({ diapositivas, logo, compacto = false }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const total = diapositivas.length;

  useEffect(() => {
    if (reduce || pausa || total < 2) return undefined;
    const t = setTimeout(() => setI((x) => (x + 1) % total), DURACION);
    return () => clearTimeout(t);
  }, [i, reduce, pausa, total]);

  if (!total) return null;
  const d = diapositivas[Math.min(i, total - 1)];

  return (
    <section
      className="relative rounded-3xl overflow-hidden"
      style={{ background: 'var(--mb-card)', border: '1px solid var(--mb-line)' }}
      aria-roledescription="carrusel"
      aria-label="Por qué pedir por aquí y no por WhatsApp"
    >
      {/* Avance, como las historias */}
      <div className="flex gap-1 px-4 pt-3">
        {diapositivas.map((x, k) => (
          <span key={x.clave} className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: 'var(--mb-line)' }}>
            <motion.span
              key={`${x.clave}-${k === i ? i : 'x'}`}
              className="block h-full rounded-full"
              style={{ background: 'var(--mb-accent)' }}
              initial={{ width: k < i ? '100%' : '0%' }}
              animate={{ width: k < i ? '100%' : k === i ? '100%' : '0%' }}
              transition={{ duration: k === i && !reduce && !pausa ? DURACION / 1000 : 0, ease: 'linear' }}
            />
          </span>
        ))}
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDragStart={() => setPausa(true)}
        onDragEnd={(_, info) => {
          if (info.offset.x < -30) setI((x) => (x + 1) % total);
          else if (info.offset.x > 30) setI((x) => (x - 1 + total) % total);
          setPausa(false);
        }}
        className="touch-pan-y"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={d.clave}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className={`flex items-center gap-3.5 px-4 ${compacto ? 'pt-2.5 pb-3' : 'pt-3 pb-4'}`}
          >
            <div className="min-w-0 flex-1">
              {d.resena ? (
                <>
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--mb-ink-2)' }}>
                    <GoogleG /> {d.kicker}
                  </p>
                  {/* Estrellas y autor en una línea: la cita cabe también en celulares bajos */}
                  <span className="mt-1 flex items-center gap-1.5">
                    <span className="flex gap-0.5 shrink-0" aria-label={`${d.resena.rating} de 5 estrellas`}>
                      {[1, 2, 3, 4, 5].map((k) => (
                        <Star key={k} className={`w-3.5 h-3.5 ${k <= d.resena.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                      ))}
                    </span>
                    <span className="text-[12px] font-bold break-words" style={{ color: 'var(--mb-ink-2)' }}>{d.texto}</span>
                  </span>
                  <p className={`${compacto ? 'text-[13px]' : 'text-[14px]'} font-semibold leading-snug mt-1 break-words`} style={{ color: 'var(--mb-ink)' }}>
                    {d.titulo}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--mb-accent)' }}>{d.kicker}</p>
                  <p className={`${compacto ? 'text-[16px]' : 'text-[18px]'} font-black leading-[1.15] mt-1 break-words`} style={{ color: 'var(--mb-ink)' }}>
                    {d.titulo}
                  </p>
                  <p className={`${compacto ? 'text-[12px]' : 'text-[13px]'} leading-snug mt-1`} style={{ color: 'var(--mb-ink-2)' }}>{d.texto}</p>
                </>
              )}
              {d.visual.tipo === 'sellos' && d.visual.requeridos && (
                <span className="mt-2 flex gap-1" aria-hidden="true">
                  {Array.from({ length: Math.min(d.visual.requeridos, 10) }, (_, k) => (
                    <span key={k} className="w-3.5 h-3.5 rounded-full"
                      style={{ border: '1.5px dashed var(--mb-accent)', background: k === Math.min(d.visual.requeridos, 10) - 1 ? 'var(--mb-accent)' : 'transparent' }} />
                  ))}
                </span>
              )}
            </div>
            <Visual v={d.visual} logo={logo} compacto={compacto} />
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </section>
  );
}

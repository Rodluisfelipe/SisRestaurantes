import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Gift, Check } from 'lucide-react';
import { useBusinessConfig } from '../Context/BusinessContext';

/**
 * La tarjeta de sellos tal como la ve el cliente. Cada sello es el logo del
 * negocio con marco de sello de tinta; el último puesto es el premio.
 *
 * Se usa en "Mi tarjeta", en el carrito (compacta), en el pedido rápido y
 * como vista previa en el panel, para que todos vean lo mismo.
 *
 * Los colores salen de las variables del menú (tema claro u oscuro) con
 * respaldo para el panel, que no las define.
 */
const V = {
  superficie: 'var(--mb-card, #ffffff)',
  linea: 'var(--mb-line, #e2e8f0)',
  tinta: 'var(--mb-ink, #0f172a)',
  tinta2: 'var(--mb-ink-2, #475569)',
  tinta3: 'var(--mb-ink-3, #94a3b8)',
};

// Transparencias que sirven también con colores en variable CSS (var(--mb-accent))
const tinte = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

// Un giro distinto por casilla, siempre el mismo: parece estampado a mano
const GIROS = [-8, 5, -3, 9, -6, 3, -10, 6, -4, 8];

function Sello({ lleno, esPremio, indice, color, logo, tam, recien, fotoPremio }) {
  const reduce = useReducedMotion();
  const [sinLogo, setSinLogo] = useState(!logo);
  const giro = GIROS[indice % GIROS.length];

  if (lleno) {
    return (
      <motion.span
        className="relative rounded-full flex items-center justify-center shrink-0"
        style={{
          width: tam, height: tam,
          // Marco de sello: anillo de color, filo claro y un segundo aro tenue
          boxShadow: `0 0 0 3px ${color}, 0 0 0 5px ${V.superficie}, 0 0 0 6.5px ${tinte(color, 35)}`,
          background: V.superficie,
        }}
        initial={recien && !reduce ? { scale: 1.6, opacity: 0, rotate: giro - 25 } : false}
        animate={{ scale: 1, opacity: 1, rotate: giro }}
        transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.15 }}
      >
        {!sinLogo ? (
          <img src={logo} alt="" className="w-full h-full rounded-full object-cover" onError={() => setSinLogo(true)} />
        ) : (
          <span className="w-full h-full rounded-full flex items-center justify-center" style={{ background: color }}>
            <Check className="w-1/2 h-1/2 text-white" strokeWidth={3} />
          </span>
        )}
        {/* Marca de "sellado" */}
        <span className="absolute -bottom-1 -right-1 w-[38%] h-[38%] min-w-[14px] min-h-[14px] rounded-full flex items-center justify-center"
          style={{ background: color, boxShadow: `0 0 0 2px ${V.superficie}` }}>
          <Check className="w-3/5 h-3/5 text-white" strokeWidth={3.5} />
        </span>
      </motion.span>
    );
  }

  if (esPremio) {
    // La última casilla es el premio: con su foto si la tiene
    return (
      <span className="relative rounded-full flex items-center justify-center shrink-0"
        style={{ width: tam, height: tam, border: `2.5px dashed ${color}`, background: tinte(color, 8), color, padding: fotoPremio ? 3 : 0 }}>
        {fotoPremio
          ? <img src={fotoPremio} alt="" className="w-full h-full rounded-full object-cover" />
          : <Gift className="w-1/2 h-1/2" strokeWidth={2.2} />}
        {fotoPremio && (
          <span className="absolute -bottom-1 -right-1 w-[38%] h-[38%] min-w-[14px] min-h-[14px] rounded-full flex items-center justify-center"
            style={{ background: color, boxShadow: `0 0 0 2px ${V.superficie}` }}>
            <Gift className="w-3/5 h-3/5 text-white" strokeWidth={2.5} />
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="rounded-full flex items-center justify-center shrink-0 font-bold tabular-nums"
      style={{ width: tam, height: tam, border: `2px dashed ${V.linea}`, color: V.tinta3, fontSize: tam * 0.3 }}>
      {indice + 1}
    </span>
  );
}

export default function TarjetaSellos({
  requeridos = 10, sellos = 0, premio = '', color = '#f97316', compacta = false, logo, animarUltimo = false, fotoPremio = null,
}) {
  const { businessConfig } = useBusinessConfig() || {};
  const logoFinal = logo ?? businessConfig?.logo ?? '';
  const n = Math.min(Math.max(parseInt(requeridos, 10) || 10, 2), 30);
  const llenos = Math.min(Math.max(parseInt(sellos, 10) || 0, 0), n);
  const faltan = n - llenos;
  // Hasta 8 sellos van 4 por fila (más grandes); más de 8, 5 por fila
  const columnas = n <= 4 ? n : n <= 8 ? 4 : 5;
  const tam = compacta ? 34 : columnas <= 4 ? 62 : 52;

  const casillas = (
    <div
      className="grid justify-items-center"
      style={{ gridTemplateColumns: `repeat(${compacta ? Math.min(8, n) : columnas}, minmax(0, 1fr))`, rowGap: compacta ? 12 : 20, columnGap: compacta ? 8 : 12 }}
      role="img"
      aria-label={`${llenos} de ${n} sellos`}
    >
      {Array.from({ length: n }, (_, i) => (
        <Sello key={i} indice={i} lleno={i < llenos} esPremio={i === n - 1} color={color} logo={logoFinal}
          tam={tam} recien={animarUltimo && i === llenos - 1} fotoPremio={fotoPremio} />
      ))}
    </div>
  );

  if (compacta) return <div className="py-1">{casillas}</div>;

  return (
    <div className="rounded-3xl p-4 sm:p-5" style={{ background: V.superficie, border: `1px solid ${V.linea}` }}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: V.tinta3 }}>Tarjeta de sellos</p>
          <p className="text-base font-black mt-0.5 break-words" style={{ color: V.tinta }}>
            {faltan === 0 ? '¡Tarjeta llena!' : `Te ${faltan === 1 ? 'falta' : 'faltan'} ${faltan} para tu premio`}
          </p>
        </div>
        <p className="shrink-0 font-black tabular-nums leading-none" style={{ color }}>
          <span className="text-3xl">{llenos}</span>
          <span className="text-lg" style={{ color: V.tinta3 }}>/{n}</span>
        </p>
      </div>
      {casillas}
      {premio && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl p-2.5" style={{ background: tinte(color, 7) }}>
          {fotoPremio ? (
            <img src={fotoPremio} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
          ) : (
            <span className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0" style={{ background: tinte(color, 12), color }}>
              <Gift className="w-7 h-7" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>Tu premio</p>
            <p className="text-base font-black break-words" style={{ color: V.tinta }}>{premio}</p>
          </div>
        </div>
      )}
    </div>
  );
}

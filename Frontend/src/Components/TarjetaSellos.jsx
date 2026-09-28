import React from 'react';
import { Gift, Check } from 'lucide-react';

/**
 * La tarjeta de sellos tal como la ve el cliente: una casilla por pedido y el
 * premio al final. Se usa en el carrito, en "Mis puntos", en el pedido rápido
 * y como vista previa en el panel, para que todos vean lo mismo.
 */
export default function TarjetaSellos({ requeridos = 10, sellos = 0, premio = '', color = '#f97316', compacta = false }) {
  const n = Math.min(Math.max(parseInt(requeridos, 10) || 10, 2), 30);
  const llenos = Math.min(Math.max(parseInt(sellos, 10) || 0, 0), n);
  const faltan = n - llenos;
  const tam = compacta ? 'w-7 h-7' : 'w-9 h-9';

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="img" aria-label={`${llenos} de ${n} sellos`}>
        {Array.from({ length: n }, (_, i) => {
          const lleno = i < llenos;
          const esPremio = i === n - 1;
          return (
            <span
              key={i}
              className={`${tam} rounded-full flex items-center justify-center border-2 ${lleno ? 'text-white' : 'bg-white text-slate-300 border-dashed border-slate-300'}`}
              style={lleno ? { backgroundColor: color, borderColor: color } : esPremio ? { borderColor: color, color } : undefined}
            >
              {lleno ? <Check className="w-4 h-4" strokeWidth={3} /> : esPremio ? <Gift className="w-4 h-4" /> : null}
            </span>
          );
        })}
      </div>
      {!compacta && (
        <p className="mt-2 text-sm text-slate-600">
          {faltan === 0
            ? <>¡Tarjeta llena! Ganaste <strong>{premio || 'tu premio'}</strong>.</>
            : <>Te {faltan === 1 ? 'falta' : 'faltan'} <strong>{faltan} {faltan === 1 ? 'sello' : 'sellos'}</strong> para {premio || 'tu premio'}.</>}
        </p>
      )}
    </div>
  );
}

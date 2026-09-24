import React from 'react';
import { enPesos } from '../utils/presentaciones';

/**
 * Las presentaciones bajo el nombre del producto, en el menú.
 *
 * Se muestran tres y el resto se resume en "+N": la tarjeta tiene que seguir
 * cabiendo en media pantalla de celular.
 */
function Presentaciones({ datos, max = 3 }) {
  if (!datos?.varias) return null;

  const visibles = datos.lista.slice(0, max);
  const resto = datos.lista.length - visibles.length;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {visibles.map((p) => (
        <span
          key={p.etiqueta}
          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-[3px] text-2xs leading-none"
        >
          <span className="font-medium text-slate-600">{p.etiqueta}</span>
          {datos.preciosDistintos && (
            <span className="font-bold tabular-nums text-slate-800">${enPesos(p.precio)}</span>
          )}
        </span>
      ))}
      {resto > 0 && (
        <span className="text-2xs font-semibold text-slate-400">+{resto}</span>
      )}
    </div>
  );
}

export default React.memo(Presentaciones);

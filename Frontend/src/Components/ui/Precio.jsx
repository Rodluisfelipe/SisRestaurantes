import { formatearPesos } from './pesos';

/**
 * Un precio. El único lugar que sabe cómo se escribe la plata en el menú.
 *
 * Antes había cuatro funciones (enPesos, pesos, pesosCO, toLocaleString
 * sueltos) y cada tarjeta decidía su tamaño, su "Desde" y cómo tachar el
 * precio de antes. Aquí: `valor`, y opcionalmente `anterior` (tachado, para
 * las promos) y `desde` (cuando hay varias presentaciones).
 */

const TAMANOS = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl',
};

export default function Precio({ valor, anterior = null, desde = false, etiqueta = false, tamano = 'md', className = '' }) {
  const enPromo = anterior !== null && Number(anterior) > Number(valor);
  return (
    <div className={className}>
      {etiqueta && (
        <p className="text-2xs font-bold uppercase tracking-[0.12em] text-tinta-3">{desde ? 'Desde' : 'Precio'}</p>
      )}
      <p className="flex items-baseline gap-1.5 leading-none">
        {!etiqueta && desde && <span className="text-2xs font-semibold text-tinta-3">Desde</span>}
        {enPromo && (
          <span className="text-xs font-semibold text-tinta-3 line-through tabular-nums">{formatearPesos(anterior)}</span>
        )}
        <span className={`font-black tabular-nums ${TAMANOS[tamano] || TAMANOS.md} ${enPromo ? 'text-rose-600' : 'text-tinta'}`}>
          {formatearPesos(valor)}
        </span>
      </p>
    </div>
  );
}

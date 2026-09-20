import type { Producto } from './nativo';

/**
 * El tamaño o la presentación, elegido antes de tocar el producto.
 *
 * Es lo que evita el modal en el caso más frecuente del mostrador rápido: el
 * cliente pide una gaseosa mediana y el cajero toca "Gaseosa" con [Mediana] ya
 * puesto. El modal de extras queda para lo que de verdad lo necesita —quitar
 * cebolla, agregar tocineta— y no para elegir entre tres tamaños.
 *
 * **Las opciones salen del catálogo, no de una lista fija.** La tentación era
 * poner `[S] [M] [L]`, pero en este sistema la variante es texto libre que el
 * comerciante escribe en el panel: llega como "Mediana", "500 ml", "Personal"
 * o "Litro · Sin gas". Un conmutador de tres letras fijas sería un control
 * muerto en casi todos los negocios, y peor que muerto en los que usan tallas
 * de ropa. Derivarlas de lo que hay funciona con cualquiera.
 *
 * Solo aparece si en lo que se está viendo hay al menos dos presentaciones
 * distintas. Con una sola, el conmutador no decide nada y ocupa el espacio que
 * necesita la ficha del cliente.
 */

/** Cuántas caben sin que los botones dejen de ser tocables con el pulgar. */
const MAXIMO = 6;

/**
 * El producto base al que pertenece una fila del catálogo.
 *
 * El backend aplana las variantes como filas con id `<producto>:<valores>`, así
 * que el prefijo antes de los dos puntos es lo que hermana a la mediana con la
 * grande. Un producto sin variantes no tiene dos puntos y es su propio base.
 */
export function idBase(id: string): string {
  const corte = id.indexOf(':');
  return corte < 0 ? id : id.slice(0, corte);
}

/** Las presentaciones distintas que hay en lo que se está mostrando. */
export function variantesDe(productos: Producto[]): string[] {
  const vistas = new Set<string>();
  for (const p of productos) {
    if (p.variante) vistas.add(p.variante);
    if (vistas.size > MAXIMO) return [];
  }
  return [...vistas].sort();
}

/**
 * Cambia un producto por su hermano en la presentación elegida.
 *
 * Devuelve el mismo producto cuando no hay nada que cambiar: porque no hay
 * presentación elegida, porque ya es esa, o porque este producto no viene en
 * esa presentación —hay gaseosa mediana pero no hay pan mediano, y tocar el
 * pan con [Mediana] puesto tiene que marcar el pan, no fallar en silencio—.
 */
export function enVariante(
  producto: Producto,
  variante: string,
  catalogo: Producto[],
): Producto {
  if (!variante || producto.variante === variante) return producto;

  const base = idBase(producto.id);
  return catalogo.find((x) => idBase(x.id) === base && x.variante === variante) ?? producto;
}

export default function SelectorVariante({
  variantes,
  elegida,
  onElegir,
}: {
  variantes: string[];
  elegida: string;
  onElegir: (v: string) => void;
}) {
  if (variantes.length < 2) return null;

  return (
    <div className="flex-shrink-0 space-y-1.5">
      <span className="block text-[10.5px] font-black text-slate-400 uppercase tracking-wide px-1">
        Presentación
      </span>

      <div className="grid grid-cols-2 gap-1.5">
        {/* "Como venga" apaga el conmutador: el producto entra en la
            presentación de su propia casilla, que es el comportamiento de
            siempre. Sin esta opción no habría forma de volver atrás salvo
            adivinando cuál estaba puesta. */}
        <button
          onClick={() => onElegir('')}
          className={`col-span-2 h-11 rounded-xl text-[12.5px] font-bold border-2 transition-colors ${
            elegida === ''
              ? 'border-marca bg-marca text-sobre-marca'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
          }`}
        >
          Como venga
        </button>

        {variantes.map((v) => (
          <button
            key={v}
            onClick={() => onElegir(v)}
            title={v}
            className={`h-11 px-2 rounded-xl text-[12.5px] font-bold border-2 truncate transition-colors ${
              elegida === v
                ? 'border-marca bg-marca text-sobre-marca'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Las categorías, como pestañas sobre la rejilla.
 *
 * Estuvieron un tiempo apiladas en la columna de la izquierda y fue un error:
 * con quince categorías, encontrar "Bebidas" obligaba a arrastrar una lista
 * lateral con el dedo. Arrastrar es lo contrario de lo que hace rápido a un
 * mostrador —el dedo tiene que ir a un sitio y volver, no explorar— y además
 * en un monitor resistivo el arrastre marca sin querer lo que roza.
 *
 * Aquí no hay desplazamiento en ningún caso. Lo que no cabe pasa a la página
 * siguiente con dos flechas de 44 px que están siempre en el mismo sitio.
 *
 * Cuántas caben se mide del ancho real del contenedor y no de la resolución:
 * la columna central crece con el monitor, así que la misma pantalla de 1920
 * cabe más pestañas que la de 1366, y el número tiene que salir de medir, no
 * de adivinar.
 */

/** Lo que ocupa una pestaña con su separación. El mínimo es 110 px de botón. */
const ANCHO_PESTANA = 118;
/** Las dos flechas y sus separaciones, cuando hacen falta. */
const ANCHO_FLECHAS = 104;

export default function PestanasCategoria({
  rubros,
  rubro,
  onElegir,
}: {
  rubros: string[];
  /** Vacío = "Todos". */
  rubro: string;
  onElegir: (r: string) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [pagina, setPagina] = useState(0);

  /* Se mide el contenedor, no la ventana. `ResizeObserver` porque la columna
     central cambia de ancho sin que la ventana cambie de tamaño: basta con que
     aparezca el aviso de una mesa o que se abra el panel de turno. */
  useLayoutEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;

    const medir = () => setAncho(nodo.clientWidth);
    medir();

    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  // "Todos" es una pestaña más: es donde se vuelve, y tiene que estar siempre.
  const todas = ['', ...rubros];

  /* Cuántas caben sin flechas. Si con flechas no cabrían ni dos, se dejan
     todas apretadas en una página: dos flechas para navegar entre páginas de
     una sola pestaña sería peor que apretar. */
  const sinFlechas = Math.max(1, Math.floor(ancho / ANCHO_PESTANA));
  const hayPaginas = ancho > 0 && todas.length > sinFlechas;
  const porPagina = hayPaginas
    ? Math.max(2, Math.floor((ancho - ANCHO_FLECHAS) / ANCHO_PESTANA))
    : todas.length;

  const paginas = Math.max(1, Math.ceil(todas.length / porPagina));

  /* Si el negocio bajó catálogo y quedan menos categorías, la página en la que
     estaba el cajero puede ya no existir. */
  useEffect(() => {
    if (pagina >= paginas) setPagina(paginas - 1);
  }, [pagina, paginas]);

  /* La pestaña activa tiene que estar a la vista. Pasa cuando el cajero
     escanea un código de otra categoría: el filtro cambia solo, y si la
     pestaña quedara en otra página parecería que se apagó. */
  useEffect(() => {
    const i = todas.indexOf(rubro);
    if (i < 0) return;
    const suya = Math.floor(i / porPagina);
    if (suya !== pagina) setPagina(suya);
    // `pagina` fuera de las dependencias a propósito: esto corrige la página
    // cuando cambia el filtro, no cada vez que el cajero pasa de página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubro, porPagina]);

  // Con una sola categoría, una pestaña que dice "Todos" no es navegación.
  if (rubros.length <= 1) return null;

  const visibles = todas.slice(pagina * porPagina, pagina * porPagina + porPagina);

  return (
    <div ref={caja} className="flex-shrink-0 flex items-center gap-2 h-12">
      {hayPaginas && (
        <button
          onClick={() => setPagina((p) => Math.max(0, p - 1))}
          disabled={pagina === 0}
          aria-label="Categorías anteriores"
          className="flex-shrink-0 flex items-center justify-center w-toque h-12 rounded-xl border-2 border-slate-200 bg-white text-slate-600 disabled:opacity-30 active:scale-95 transition-transform duration-75"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
      )}

      {/* `flex-1` con `min-w-0` y `overflow-hidden`: si una categoría tiene un
          nombre larguísimo, se recorta en su pestaña en vez de empujar a las
          demás fuera de la barra. */}
      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
        {visibles.map((r) => (
          <button
            key={r || 'todos'}
            onClick={() => onElegir(r)}
            className={`flex-1 min-w-0 h-12 px-3 rounded-xl text-[13px] font-bold border-2 truncate transition-colors ${
              rubro === r
                ? 'border-marca bg-marca text-sobre-marca'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            }`}
            style={{ maxWidth: `${ANCHO_PESTANA * 2}px` }}
          >
            {r || 'Todos'}
          </button>
        ))}
      </div>

      {hayPaginas && (
        <button
          onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
          disabled={pagina >= paginas - 1}
          aria-label="Más categorías"
          className="flex-shrink-0 flex items-center justify-center w-toque h-12 rounded-xl border-2 border-slate-200 bg-white text-slate-600 disabled:opacity-30 active:scale-95 transition-transform duration-75"
        >
          <ChevronRight size={20} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

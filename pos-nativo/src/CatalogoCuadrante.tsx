import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ScanLine } from 'lucide-react';
import FotoProducto from './FotoProducto';
import { pesos, type ModoVista, type Producto } from './nativo';
import { colorDeCategoria } from './coloresCategoria';

/**
 * El catálogo como una rejilla que no se mueve.
 *
 * La versión anterior era una lista con scroll, y el scroll es el enemigo de la
 * memoria muscular: el producto que estaba arriba a la izquierda esta mañana
 * está a media pantalla ahora, y el cajero que se sabía dónde tocar vuelve a
 * tener que leer. Con doce casillas fijas y páginas discretas, "la tercera de
 * la segunda fila" significa lo mismo todo el día.
 *
 * Tres consecuencias de eso, todas deliberadas:
 *
 * - **Las casillas no cambian de tamaño.** Un producto de nombre largo no
 *   ensancha su celda ni encoge las vecinas. El nombre se corta; la posición se
 *   respeta.
 * - **Se pagina, no se desplaza.** Los botones de página son de 48 px y están
 *   en la misma esquina siempre. Un scroll táctil en un monitor resistivo
 *   además arrastra sin querer y termina marcando el producto equivocado.
 * - **Cada casilla lleva su número.** Es lo que permite que alguien que se sabe
 *   la carta teclee `3` en vez de buscar con el dedo. Los diez primeros con la
 *   tecla directa; del 11 en adelante no hay tecla, y está bien: a esa altura
 *   ya nadie se lo sabe de memoria.
 *
 * La rejilla se adapta a la pantalla —4×3 en un monitor de mostrador, 4×4 si
 * hay alto de sobra— pero **nunca** al contenido: cuántas caben lo decide el
 * equipo, no cuántos productos haya.
 */

/* Cuántas casillas caben según el modo.

   En visual la casilla lleva foto y necesita alto; en expandido es un
   rectángulo de color con el nombre, y ahí caben más en el mismo monitor.

   Los dos son rígidos: el modo decide cuántas, la pantalla decide cuántas
   filas, y el contenido no decide nada. Una rejilla que se acomoda a cuántos
   productos haya es una rejilla en la que el cajero no puede memorizar nada. */
export const COLUMNAS_POR_MODO: Record<ModoVista, number> = {
  visual: 4,
  compacto: 6,
};

/* Alto de una casilla más su separación.

   Los 64 px del compacto son lo que piden dos renglones de nombre más el
   precio debajo. Es además cómodo por encima del mínimo que un pulgar acierta
   en un monitor resistivo descalibrado, que es el que hay en un mostrador: por
   debajo de eso la densidad deja de ser ventaja porque cada toque fallido
   cuesta más de lo que ahorró ver la carta entera. */
const ALTO_CASILLA: Record<ModoVista, number> = {
  visual: 190,
  compacto: 64,
};

/* Cuántas filas como mucho.

   Seis por seis son treinta y seis productos de un vistazo: la carta completa
   de la mayoría de los negocios sin pasar de página, que es exactamente para
   lo que sirve este modo. */
const FILAS_MAXIMAS: Record<ModoVista, number> = {
  visual: 4,
  compacto: 6,
};

export default function CatalogoCuadrante({
  productos,
  carpeta,
  onTocar,
  /** Qué escribió el cajero, para poder decirle por qué no hay nada. */
  busqueda,
  rubro,
  /** Se desactivan los atajos mientras hay un modal encima. */
  conAtajos = true,
  modo = 'visual',
}: {
  productos: Producto[];
  carpeta: string;
  onTocar: (p: Producto) => void;
  busqueda: string;
  rubro: string;
  conAtajos?: boolean;
  modo?: ModoVista;
}) {
  const [pagina, setPagina] = useState(0);
  const [filas, setFilas] = useState(3);
  const COLUMNAS = COLUMNAS_POR_MODO[modo];

  /* Cuántas filas caben. Se mide una vez y en cada cambio de tamaño de ventana,
     no en cada render: la rejilla tiene que ser estable mientras se atiende.

     El 320 es todo lo que hay por encima y por debajo de la rejilla: cabecera
     (64), barra de cantidad (48), buscador (48), paginación (48) y los
     márgenes. Las categorías ya no cuentan: se fueron a la columna izquierda,
     donde el dedo las alcanza sin subir al borde de la pantalla.

     Si no cabe ni una fila se fuerza a dos, porque una rejilla de una fila no
     es una rejilla: sería una lista con botones de paginar. */
  useEffect(() => {
    const medir = () => {
      const alto = window.innerHeight;
      const cuantas = Math.floor((alto - 320) / ALTO_CASILLA[modo]);
      setFilas(Math.min(FILAS_MAXIMAS[modo], Math.max(2, cuantas)));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [modo]);

  const porPagina = COLUMNAS * filas;
  const paginas = Math.max(1, Math.ceil(productos.length / porPagina));

  /* Si el catálogo se encogió —el cajero filtró por categoría— la página en la
     que estaba puede ya no existir. Sin esto la rejilla quedaría en blanco y
     parecería que no hay productos. */
  useEffect(() => { setPagina(0); }, [busqueda, rubro]);
  useEffect(() => {
    if (pagina >= paginas) setPagina(paginas - 1);
  }, [pagina, paginas]);

  const visibles = useMemo(
    () => productos.slice(pagina * porPagina, pagina * porPagina + porPagina),
    [productos, pagina, porPagina],
  );

  /* Los atajos. Las flechas cambian de página y los dígitos marcan.

     `Alt` y no el dígito suelto porque el campo de búsqueda tiene el foco casi
     siempre —es lo que hace que el lector de códigos funcione sin configurar
     nada— y un `3` a secas tiene que poder escribirse: hay productos que se
     buscan por código. */
  useEffect(() => {
    if (!conAtajos) return;

    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        setPagina((p) => Math.min(paginas - 1, p + 1));
        return;
      }
      if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        setPagina((p) => Math.max(0, p - 1));
        return;
      }

      if (!e.altKey || e.ctrlKey) return;
      // Alt+1..Alt+9 y Alt+0 para la décima.
      if (!/^[0-9]$/.test(e.key)) return;
      const indice = e.key === '0' ? 9 : Number(e.key) - 1;
      const cual = visibles[indice];
      if (!cual) return;
      e.preventDefault();
      onTocar(cual);
    };

    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [conAtajos, paginas, visibles, onTocar]);

  if (productos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-300">
        <ScanLine size={40} strokeWidth={1.5} />
        <p className="text-[13.5px] font-semibold text-slate-400">
          {rubro
            ? `Nada en "${rubro}"`
            : busqueda
              ? `Nada que coincida con "${busqueda}"`
              : 'Sin productos'}
        </p>
        {!rubro && !busqueda && (
          <p className="text-[11.5px] text-slate-400">
            El catálogo baja de MenuBy a la base local de esta caja
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-2">
      {/* La rejilla. `grid-rows` explícito y `minmax(0,1fr)` es lo que impide
          que una celda con nombre largo estire su fila: sin eso, la rejilla
          "rígida" se deforma con el primer producto de nombre largo. */}
      <div
        className="flex-1 grid gap-2 min-h-0"
        style={{
          gridTemplateColumns: `repeat(${COLUMNAS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${filas}, minmax(0, 1fr))`,
        }}
      >
        {visibles.map((p, i) => (
          <button
            key={p.id + p.variante}
            onClick={() => onTocar(p)}
            className={`relative min-h-0 text-left active:scale-95 transition-transform duration-75 overflow-hidden ${
              modo === 'compacto'
                ? `${colorDeCategoria(p.categoria)} rounded-lg flex flex-col justify-center gap-0.5 px-2`
                : 'rounded-xl bg-white border border-slate-200 hover:border-marca active:border-marca flex flex-col'
            }`}
          >
            {modo === 'compacto' ? (
              /* Nombre arriba y precio debajo.

                 Estuvo un rato en una sola línea —número, nombre y precio
                 repartidos a lo ancho— y el nombre era lo que se comía: en
                 una columna de 120 px compartida con un precio, "Hamburguesa
                 Clásica" quedaba en "Hamburg…". Apilados, el nombre se lleva
                 el ancho completo y entra en dos renglones.

                 Sin número de casilla: con treinta y seis casillas los atajos
                 solo cubren las diez primeras, así que la insignia gastaba
                 espacio del nombre para señalar algo que casi nunca aplica. */
              <>
                <span className="text-[12px] font-bold leading-[1.15] line-clamp-2">
                  {p.nombre}{p.variante ? ` · ${p.variante}` : ''}
                </span>
                <span className="text-[12px] font-black tabular-nums font-mono leading-none">
                  {pesos(p.precio)}
                </span>
              </>            ) : (
              <>
                {/* El número de la casilla. Arriba a la izquierda y siempre en
                    el mismo sitio: es una referencia, no algo que se lee. */}
                <span className="absolute top-1.5 left-1.5 z-10 flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-md bg-slate-900/70 text-white text-[11px] font-black tabular-nums backdrop-blur-sm">
                  {i + 1}
                </span>

                <div className="flex-1 min-h-0 w-full bg-slate-100">
                  <FotoProducto nombre={p.nombre} archivo={p.foto} carpeta={carpeta} />
                </div>

                <div className="flex-shrink-0 p-2 flex flex-col gap-0.5">
                  <span className="text-[12.5px] font-semibold leading-tight line-clamp-2">
                    {p.nombre}{p.variante ? ` · ${p.variante}` : ''}
                  </span>
                  <span className="text-[15px] font-black tabular-nums font-mono">{pesos(p.precio)}</span>
                </div>
              </>
            )}
          </button>
        ))}
      </div>

      {/* Las páginas. Se ven siempre —aunque haya una sola— para que la rejilla
          no cambie de alto al filtrar: si aparecieran y desaparecieran, las
          casillas se moverían bajo el dedo. */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          onClick={() => setPagina((p) => Math.max(0, p - 1))}
          disabled={pagina === 0}
          aria-label="Página anterior"
          className="flex items-center justify-center w-12 h-12 rounded-xl border-2 border-slate-200 bg-white text-slate-600 disabled:opacity-30 active:scale-95 transition-transform duration-75"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>

        {/* Los puntos de página, tocables. Con más de ocho páginas se cambia
            por el contador: veinte puntos no se distinguen ni se aciertan.

            Con una sola página no hay nada que elegir: se deja el espacio
            —para que la rejilla no cambie de alto al filtrar— pero sin un
            botón. Antes era una barra del color de la marca a lo ancho de la
            pantalla con un "1" encima: lo más llamativo de la caja, y lo
            único que no servía para nada. */}
        {paginas === 1 ? (
          <span className="flex-1 h-12" aria-hidden />
        ) : paginas <= 8 ? (
          <div className="flex-1 flex items-center gap-1.5">
            {Array.from({ length: paginas }, (_, i) => (
              <button
                key={i}
                onClick={() => setPagina(i)}
                className={`flex-1 h-12 rounded-xl text-[13px] font-bold tabular-nums border-2 transition-colors ${
                  /* Oscuro neutro y no el color de la marca: es un indicador
                     de dónde está el cajero, no una acción, y en pantalla
                     compite con la carta. */
                  i === pagina
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        ) : (
          <span className="flex-1 h-12 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-[13px] font-bold tabular-nums text-slate-600">
            Página {pagina + 1} de {paginas}
          </span>
        )}

        <button
          onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
          disabled={pagina >= paginas - 1}
          aria-label="Página siguiente"
          className="flex items-center justify-center w-12 h-12 rounded-xl border-2 border-slate-200 bg-white text-slate-600 disabled:opacity-30 active:scale-95 transition-transform duration-75"
        >
          <ChevronRight size={20} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Copy } from 'lucide-react';
import { pesos, type ExtraElegido, type GrupoExtra, type Producto } from './nativo';
import { clave, cuantasEn, derivar, marcar, type Elegidas } from './reglasExtras';

/**
 * Elegir extras **dentro de la rejilla**, no encima de ella.
 *
 * Un modal tapa el ticket. En un mostrador eso importa: el cliente está
 * hablando mientras el cajero elige, y si la ventana esconde lo que lleva
 * marcado, el cajero pierde el hilo de la orden justo cuando más lo necesita.
 * Aquí la rejilla central se transforma —las casillas de la carta se
 * reemplazan por las opciones— y las dos columnas laterales siguen a la vista.
 *
 * La geometría es la misma que la de la carta: mismas columnas, mismo alto de
 * casilla, mismo sitio para la barra de abajo. No es estética; es lo que hace
 * que el dedo caiga donde ya sabe.
 *
 * **Todo en una pantalla.** Antes esto iba grupo por grupo y, con varias
 * unidades, una vuelta completa por cada una: tres combos de dos grupos eran
 * seis pantallas seguidas de "siguiente". Ahora los grupos se ven todos,
 * apilados, y se confirma una sola vez. El cajero toca únicamente lo que
 * cambia respecto de lo que ya viene premarcado, que en el pedido normal es
 * nada.
 *
 * Con varias unidades hay pestañas arriba y "todas iguales", que es el caso
 * que de verdad ocurre: tres combos normales siguen siendo dos toques.
 */
export default function RejillaInGridExtras({
  producto,
  cantidad,
  grupos,
  inicial,
  columnas,
  onListo,
  onCancelar,
}: {
  producto: Producto;
  /** Cuántas unidades hay que configurar. 1 o más. */
  cantidad: number;
  /* Qué grupos se muestran. Vienen **todos** los que tengan opciones,
     resueltos o no: el punto de abrir la rejilla es ver qué lleva cada
     unidad, y un grupo escondido por tener respuesta es justo el que después
     nadie sabe qué trae. */
  grupos: GrupoExtra[];
  inicial?: Elegidas;
  /** Las mismas que la carta, para que las casillas no cambien de tamaño. */
  columnas: number;
  onListo: (unidades: { extras: ExtraElegido[]; sobreprecio: number }[]) => void;
  onCancelar: () => void;
}) {
  const [porUnidad, setPorUnidad] = useState<Elegidas[]>(
    () => Array.from({ length: cantidad }, () => ({ ...(inicial ?? {}) })),
  );
  const [unidad, setUnidad] = useState(0);

  /* Para llevar al cajero al grupo que le falta cuando intenta confirmar sin
     resolverlo. Decirle "falta algo" sin mostrarle dónde, en una pantalla que
     puede tener seis grupos, es hacerlo buscar. */
  const seccionesRef = useRef<Record<string, HTMLDivElement | null>>({});

  const elegidas = porUnidad[unidad];

  /* Las opciones de un grupo, con las de sus subgrupos mezcladas. Se aplanan
     porque para el cajero son casillas: que una opción cuelgue de un subgrupo
     es una distinción del panel, no del mostrador. */
  const opcionesDe = (g: GrupoExtra) => {
    const sueltas = (g.opciones || []).map((o) => ({ ...o, sub: '' }));
    const anidadas = (g.subgrupos || []).flatMap((sg) =>
      (sg.opciones || []).map((o) => ({ ...o, sub: sg.titulo })),
    );
    return [...sueltas, ...anidadas];
  };

  const derivado = useMemo(() => derivar(grupos, elegidas), [grupos, elegidas]);

  /** Un grupo obligatorio sin nada marcado. Es lo que traba el confirmar. */
  const faltaEn = (g: GrupoExtra) => {
    if (!g.obligatorio) return false;
    const sueltas = cuantasEn(elegidas, g.id, '') > 0;
    const enSub = (g.subgrupos || []).some((sg) => cuantasEn(elegidas, g.id, sg.titulo) > 0);
    return !sueltas && !enSub;
  };

  const pendientes = grupos.filter(faltaEn);

  const terminar = (todas: Elegidas[]) => {
    onListo(todas.map((e) => {
      const d = derivar(grupos, e);
      return { extras: d.extras, sobreprecio: d.sobreprecio };
    }));
  };

  const tocarOpcion = (g: GrupoExtra, nombre: string, sub: string) => {
    /* Ya no avanza solo al marcar. Avanzar era lo que obligaba a recorrer la
       pantalla en orden; acá el cajero toca en el orden en que el cliente
       habla, que nunca es el orden de los grupos. */
    setPorUnidad(porUnidad.map((e, i) => (
      i === unidad ? marcar(e, g.id, sub, nombre, g.multiple, null, false) : e
    )));
  };

  const confirmar = () => {
    if (pendientes.length > 0) {
      seccionesRef.current[pendientes[0].id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    terminar(porUnidad);
  };

  /* El acelerador del caso frecuente: las N iguales. Copia lo que está armado
     a todas las unidades y cierra. */
  const todasIguales = () => {
    const modelo = porUnidad[unidad];
    terminar(porUnidad.map(() => ({ ...modelo })));
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
      if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  if (grupos.length === 0) return null;

  /** Si una unidad está lista, para el punto de la pestaña. */
  const listaLa = (i: number) => grupos.every((g) => {
    if (!g.obligatorio) return true;
    const e = porUnidad[i];
    return cuantasEn(e, g.id, '') > 0
      || (g.subgrupos || []).some((sg) => cuantasEn(e, g.id, sg.titulo) > 0);
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-2">
      {/* La cabecera: qué se está armando y, con varias unidades, cuál. */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 h-12 rounded-xl bg-slate-900 text-white">
        <span className="text-[13px] font-black truncate">{producto.nombre}</span>

        {cantidad > 1 && (
          /* Pestañas y no pasos: el cajero salta a la unidad que el cliente
             acaba de cambiar sin tener que recorrer las anteriores. */
          <div className="flex items-center gap-1 ml-2">
            {porUnidad.map((_, i) => (
              <button
                key={i}
                onClick={() => setUnidad(i)}
                className={`w-9 h-8 rounded-lg text-[12.5px] font-black tabular-nums flex items-center justify-center gap-1 ${
                  i === unidad ? 'bg-white text-slate-900' : 'bg-white/10 text-slate-300'
                }`}
              >
                {i + 1}
                <span className={`w-1.5 h-1.5 rounded-full ${listaLa(i) ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </button>
            ))}
          </div>
        )}

        <span className="ml-auto flex-shrink-0 text-[11.5px] font-bold tabular-nums">
          {derivado.sobreprecio > 0
            ? <span className="text-amber-300">+{pesos(derivado.sobreprecio)}</span>
            : <span className="text-slate-400">sin recargo</span>}
        </span>
      </div>

      {/* Todos los grupos, uno debajo de otro. Desplaza solo esta zona: la
          cabecera y la barra de abajo no se mueven, que es lo que permite
          confirmar sin volver arriba. */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
        {grupos.map((g) => {
          const falta = faltaEn(g);
          const opciones = opcionesDe(g);

          return (
            <div key={g.id} ref={(el) => { seccionesRef.current[g.id] = el; }}>
              <div className="flex items-center gap-2 mb-1.5 px-0.5">
                <span className={`text-[12px] font-black uppercase tracking-wide ${
                  falta ? 'text-amber-600' : 'text-slate-400'
                }`}>
                  {g.nombre}
                </span>

                {g.obligatorio && (
                  <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded ${
                    falta ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {falta ? 'falta elegir' : 'listo'}
                  </span>
                )}

                {g.multiple && !g.obligatorio && (
                  <span className="text-[10.5px] font-semibold text-slate-400">puedes marcar varias</span>
                )}
              </div>

              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
              >
                {opciones.map((o) => {
                  const puesta = (elegidas[clave(g.id, o.sub, o.nombre)] || 0) > 0;
                  return (
                    <button
                      key={o.sub + o.nombre}
                      onClick={() => tocarOpcion(g, o.nombre, o.sub)}
                      className={`min-h-[96px] p-3 rounded-xl border-2 text-left flex flex-col justify-between active:scale-95 transition-transform duration-75 ${
                        puesta
                          ? 'border-marca bg-marca text-sobre-marca'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-[15px] font-bold leading-tight line-clamp-2">
                        {o.nombre}
                      </span>

                      <span className="flex items-center gap-1.5">
                        {o.precio > 0 ? (
                          <span className={`text-[13px] font-black tabular-nums font-mono ${
                            puesta ? 'opacity-90' : 'text-slate-500'
                          }`}>
                            +{pesos(o.precio)}
                          </span>
                        ) : (
                          <span className={`text-[12px] font-semibold ${
                            puesta ? 'opacity-80' : 'text-slate-400'
                          }`}>
                            incluido
                          </span>
                        )}
                        {puesta && <Check size={15} strokeWidth={3} className="ml-auto" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* La barra de abajo, en el mismo sitio que la paginación de la carta. */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          onClick={onCancelar}
          className="flex items-center gap-2 px-4 h-12 rounded-xl border-2 border-slate-200 bg-white text-[13px] font-bold text-slate-600 active:scale-95 transition-transform duration-75"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
          Cancelar
        </button>

        {cantidad > 1 && pendientes.length === 0 && (
          <button
            onClick={todasIguales}
            className="flex items-center gap-2 px-4 h-12 rounded-xl bg-emerald-600 text-white text-[13px] font-black active:scale-95 transition-transform duration-75"
          >
            <Copy size={16} strokeWidth={2.5} />
            Las {cantidad} iguales
          </button>
        )}

        {/* Confirmar nunca se deshabilita: lleva al grupo que falta.
            Un botón apagado en un mostrador no explica qué falta, y con varios
            grupos en pantalla el cajero se queda mirando sin saber cuál. */}
        <button
          onClick={confirmar}
          className={`ml-auto px-6 h-12 rounded-xl text-[14px] font-black active:scale-95 transition-transform duration-75 ${
            pendientes.length > 0
              ? 'bg-amber-500 text-white'
              : 'bg-marca text-sobre-marca'
          }`}
        >
          {pendientes.length > 0
            ? `Falta ${pendientes[0].nombre}`
            : cantidad > 1
              ? `Confirmar ${cantidad}`
              : 'Confirmar'}
        </button>
      </div>
    </div>
  );
}

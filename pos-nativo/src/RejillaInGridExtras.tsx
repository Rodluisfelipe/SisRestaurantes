import { useEffect, useMemo, useState } from 'react';
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
 * que el dedo caiga donde ya sabe. Si las opciones aparecieran con otro tamaño,
 * el primer toque después de la transformación fallaría siempre.
 *
 * **Avanza sola.** Tocar una opción excluyente marca y pasa al grupo siguiente;
 * al resolver el último, la línea entra al carrito y vuelve la carta. Sin
 * botones de confirmar: cada confirmación es un toque que el cajero hace
 * trescientas veces al día para decir que sí a lo que acaba de tocar.
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
  /** Qué grupos hay que preguntar. Los ya resueltos no vienen. */
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
  const [paso, setPaso] = useState(0);

  const grupo = grupos[paso];

  /* Todo lo que hay que tocar de este grupo, sea del grupo o de un subgrupo.
     Se aplanan porque para el cajero son casillas: que una opción cuelgue de
     un subgrupo es una distinción del panel, no del mostrador. */
  const opciones = useMemo(() => {
    if (!grupo) return [];
    const sueltas = (grupo.opciones || []).map((o) => ({ ...o, sub: '' }));
    const anidadas = (grupo.subgrupos || []).flatMap((sg) =>
      (sg.opciones || []).map((o) => ({ ...o, sub: sg.titulo })),
    );
    return [...sueltas, ...anidadas];
  }, [grupo]);

  const derivados = useMemo(
    () => porUnidad.map((e) => derivar(grupos, e)),
    [grupos, porUnidad],
  );

  const terminar = (todas: Elegidas[]) => {
    const salida = todas.map((e) => {
      const d = derivar(grupos, e);
      return { extras: d.extras, sobreprecio: d.sobreprecio };
    });
    onListo(salida);
  };

  /* Avanzar: al siguiente grupo, o a la siguiente unidad, o afuera.
     Recibe el estado ya actualizado porque React no lo tiene todavía cuando
     esto corre desde el manejador del toque. */
  const avanzar = (todas: Elegidas[]) => {
    if (paso + 1 < grupos.length) {
      setPaso(paso + 1);
      return;
    }
    if (unidad + 1 < cantidad) {
      setUnidad(unidad + 1);
      setPaso(0);
      return;
    }
    terminar(todas);
  };

  const tocarOpcion = (nombre: string, sub: string) => {
    if (!grupo) return;

    const siguiente = porUnidad.map((e, i) =>
      i === unidad ? marcar(e, grupo.id, sub, nombre, grupo.multiple, null, false) : e,
    );
    setPorUnidad(siguiente);

    /* Un grupo de varias opciones no avanza solo: el cajero todavía puede
       querer marcar otra salsa. Ese sí necesita el botón de seguir. */
    if (!grupo.multiple) avanzar(siguiente);
  };

  /* El acelerador del caso frecuente: los N iguales. Se ofrece solo cuando hay
     más de una unidad y la que se está armando ya está completa, porque antes
     de eso no hay nada que copiar. */
  const copiarAlResto = () => {
    const modelo = porUnidad[unidad];
    terminar(porUnidad.map(() => ({ ...modelo })));
  };

  const atras = () => {
    if (paso > 0) { setPaso(paso - 1); return; }
    if (unidad > 0) { setUnidad(unidad - 1); setPaso(grupos.length - 1); return; }
    onCancelar();
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
      if (e.key === 'Backspace') { e.preventDefault(); atras(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  if (!grupo) return null;

  const estaCompleta = derivados[unidad].faltan.length === 0;
  const faltaEnEste = cuantasEn(porUnidad[unidad], grupo.id, '') === 0
    && (grupo.subgrupos || []).every((sg) => cuantasEn(porUnidad[unidad], grupo.id, sg.titulo) === 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-2">
      {/* La cabecera dice dónde está el cajero. Con tres combos y dos grupos
          cada uno son seis pantallas seguidas, y sin esto no hay forma de
          saber cuál se está armando. */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 h-12 rounded-xl bg-slate-900 text-white">
        <span className="text-[13px] font-black truncate">{producto.nombre}</span>
        <span className="text-slate-500">›</span>
        <span className="text-[13px] font-bold text-amber-300 uppercase truncate">
          {grupo.nombre}
        </span>

        <span className="ml-auto flex-shrink-0 text-[11.5px] font-bold text-slate-400 tabular-nums">
          {grupos.length > 1 && `Paso ${paso + 1} de ${grupos.length}`}
          {grupos.length > 1 && cantidad > 1 && ' · '}
          {cantidad > 1 && `Combo ${unidad + 1} de ${cantidad}`}
        </span>
      </div>

      {/* Las opciones, con la misma geometría que la carta. */}
      <div
        className="flex-1 grid gap-2 min-h-0 content-start"
        style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
      >
        {opciones.map((o) => {
          const puesta = (porUnidad[unidad][clave(grupo.id, o.sub, o.nombre)] || 0) > 0;
          return (
            <button
              key={o.sub + o.nombre}
              onClick={() => tocarOpcion(o.nombre, o.sub)}
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

      {/* La barra de abajo, en el mismo sitio que la paginación de la carta. */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          onClick={atras}
          className="flex items-center gap-2 px-4 h-12 rounded-xl border-2 border-slate-200 bg-white text-[13px] font-bold text-slate-600 active:scale-95 transition-transform duration-75"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
          {paso === 0 && unidad === 0 ? 'Cancelar' : 'Atrás'}
        </button>

        {/* Copiar al resto solo cuando hay resto y esta unidad ya está lista.
            Antes de eso copiaría algo a medias. */}
        {cantidad > 1 && unidad + 1 < cantidad && estaCompleta && (
          <button
            onClick={copiarAlResto}
            className="flex items-center gap-2 px-4 h-12 rounded-xl bg-emerald-600 text-white text-[13px] font-black active:scale-95 transition-transform duration-75"
          >
            <Copy size={16} strokeWidth={2.5} />
            Los {cantidad - unidad - 1} restantes iguales
          </button>
        )}

        {/* Seguir, solo para los grupos de varias opciones: los excluyentes
            avanzan con el toque y no necesitan que nadie confirme. */}
        {grupo.multiple && (
          <button
            onClick={() => avanzar(porUnidad)}
            disabled={grupo.obligatorio && faltaEnEste}
            className="ml-auto px-6 h-12 rounded-xl bg-marca text-sobre-marca text-[14px] font-black disabled:opacity-30 active:scale-95 transition-transform duration-75"
          >
            {paso + 1 < grupos.length ? 'Siguiente' : 'Confirmar'}
          </button>
        )}
      </div>
    </div>
  );
}

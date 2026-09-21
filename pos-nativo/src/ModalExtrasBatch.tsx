import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, X } from 'lucide-react';
import { pesos, type ExtraElegido, type GrupoExtra, type Producto } from './nativo';
import {
  clave, cuantasEn, derivar, marcar, quitar, type Elegidas,
} from './reglasExtras';

/**
 * Configurar varias unidades del mismo producto de una sola vez.
 *
 * El caso es concreto y es el que más se repite en un mostrador colombiano:
 * casi ningún restaurante configura un módulo de combos, crea el plato "Combo
 * Hamburguesa" y le cuelga dos grupos obligatorios —las papas y la bebida—.
 * Cuando el cliente pide tres, el modal de una unidad obliga al cajero a
 * abrirlo, elegir, guardar y repetir tres veces. En hora pico eso es la fila.
 *
 * Aquí las tres se configuran en una pantalla, y hay dos aceleradores porque
 * hay dos casos reales:
 *
 * - **Los tres iguales** (que es la mayoría): se elige una vez y se copia con
 *   un toque.
 * - **Los tres distintos**: al completar los obligatorios de uno, la vista
 *   salta sola al siguiente. El cajero nunca toca la barra de arriba.
 *
 * Las reglas de qué falta por elegir **no viven aquí**: son las mismas de
 * `reglasExtras.ts` que aplica el modal de una unidad. Dos copias de esa
 * lógica terminarían dejando pasar a la cocina un plato que la otra pantalla
 * habría frenado.
 */
export default function ModalExtrasBatch({
  producto,
  cantidad,
  inicial,
  onListo,
  onCancelar,
}: {
  producto: Producto;
  /** Cuántas unidades hay que configurar. Siempre 2 o más. */
  cantidad: number;
  /** Lo que ya viene resuelto, como el tamaño puesto en la columna. */
  inicial?: Elegidas;
  /** Una entrada por unidad, en orden. */
  onListo: (unidades: { extras: ExtraElegido[]; sobreprecio: number }[]) => void;
  onCancelar: () => void;
}) {
  const grupos: GrupoExtra[] = useMemo(
    () => (Array.isArray(producto.extras) ? producto.extras : []),
    [producto.extras],
  );

  /* Una selección por unidad. Todas arrancan con lo que ya venía resuelto: si
     el cajero tenía [Mediano] puesto, los tres combos nacen medianos y solo
     queda preguntar papas y bebida. */
  const [porUnidad, setPorUnidad] = useState<Elegidas[]>(
    () => Array.from({ length: cantidad }, () => ({ ...(inicial ?? {}) })),
  );
  const [activa, setActiva] = useState(0);
  const [intentado, setIntentado] = useState(false);

  /* Para que el auto-avance no dispare en el primer dibujado ni cuando el
     cajero vuelve a una unidad ya completa para corregirla. Solo salta cuando
     **acaba** de completarse la que está editando. */
  const completaAntes = useRef(false);

  const derivados = useMemo(
    () => porUnidad.map((e) => derivar(grupos, e)),
    [grupos, porUnidad],
  );

  const actual = derivados[activa];
  const todasListas = derivados.every((d) => d.faltan.length === 0);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
      if ((e.key === 'F2' || e.key === 'Enter') && todasListas) {
        e.preventDefault();
        onListo(derivados.map((d) => ({ extras: d.extras, sobreprecio: d.sobreprecio })));
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar, onListo, todasListas, derivados]);

  /* Auto-avance. Al completar los obligatorios de esta unidad, la vista pasa a
     la siguiente que falte. Si no falta ninguna, se queda donde está: mandar
     al cajero a la primera unidad cuando ya terminó sería devolverlo al
     principio justo cuando iba a confirmar. */
  useEffect(() => {
    const completa = actual.faltan.length === 0;
    if (completa && !completaAntes.current) {
      const siguiente = derivados.findIndex((d, i) => i > activa && d.faltan.length > 0);
      if (siguiente >= 0) setActiva(siguiente);
    }
    completaAntes.current = completa;
  }, [actual, derivados, activa]);

  const cambiar = (fn: (e: Elegidas) => Elegidas) => {
    setPorUnidad((todas) => todas.map((e, i) => (i === activa ? fn(e) : e)));
  };

  /* El botón que resuelve el 80 % de los casos: tres combos iguales. Copia
     sobre **todas** las demás, incluidas las que ya tuvieran algo elegido:
     quien lo pulsa está diciendo "todos como este", y respetar una elección
     previa a medias dejaría una unidad distinta sin que se note. */
  const copiarATodas = () => {
    const modelo = porUnidad[activa];
    setPorUnidad((todas) => todas.map(() => ({ ...modelo })));
  };

  const confirmar = () => {
    if (!todasListas) {
      setIntentado(true);
      // Llevar al cajero a la primera que falta, en vez de solo decirle que falta.
      const primera = derivados.findIndex((d) => d.faltan.length > 0);
      if (primera >= 0) setActiva(primera);
      return;
    }
    onListo(derivados.map((d) => ({ extras: d.extras, sobreprecio: d.sobreprecio })));
  };

  const total = derivados.reduce((t, d) => t + producto.precio + d.sobreprecio, 0);

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 h-14 bg-slate-900 text-white flex-shrink-0">
          <p className="text-[15px] font-black truncate">
            Configurar: {cantidad}x {producto.nombre}
          </p>
          <button
            onClick={onCancelar}
            aria-label="Cancelar"
            className="flex items-center justify-center w-toque h-toque rounded-xl text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Las pestañas. Verde = resuelta, ámbar = la que se está editando,
            gris = pendiente. El color dice de un vistazo cuánto falta, que es
            lo único que el cajero necesita saber de esta barra. */}
        <div className="flex-shrink-0 flex gap-1.5 p-3 bg-slate-100 overflow-x-auto">
          {derivados.map((d, i) => {
            const completa = d.faltan.length === 0;
            const esta = i === activa;
            return (
              <button
                key={i}
                onClick={() => setActiva(i)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-11 rounded-xl text-[12.5px] font-bold border-2 transition-colors ${
                  esta
                    ? 'border-amber-500 bg-amber-100 text-amber-900'
                    : completa
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {completa && !esta && <Check size={14} strokeWidth={3} />}
                {i + 1} de {cantidad}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {grupos.map((g) => (
            <Grupo
              key={g.id}
              titulo={g.nombre}
              obligatorio={g.obligatorio}
              multiple={g.multiple}
              maximo={null}
              repetibles={false}
              opciones={g.opciones || []}
              elegidas={porUnidad[activa]}
              grupoId={g.id}
              sub=""
              incompleto={intentado && actual.faltan.includes(g.nombre)}
              onMarcar={(o) => cambiar((e) => marcar(e, g.id, '', o, g.multiple, null, false))}
              onQuitar={(o) => cambiar((e) => quitar(e, g.id, '', o))}
            />
          ))}

          {grupos.flatMap((g) =>
            (g.subgrupos || []).map((sg) => (
              <Grupo
                key={g.id + sg.titulo}
                titulo={sg.titulo || g.nombre}
                obligatorio={sg.obligatorio}
                multiple={sg.multiple}
                maximo={sg.maximo}
                repetibles={sg.repetibles}
                opciones={sg.opciones || []}
                elegidas={porUnidad[activa]}
                grupoId={g.id}
                sub={sg.titulo}
                incompleto={intentado && actual.faltan.includes(sg.titulo || g.nombre)}
                onMarcar={(o) =>
                  cambiar((e) => marcar(e, g.id, sg.titulo, o, sg.multiple, sg.maximo, sg.repetibles))
                }
                onQuitar={(o) => cambiar((e) => quitar(e, g.id, sg.titulo, o))}
              />
            )),
          )}

          {intentado && actual.faltan.length > 0 && (
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-red-600">
              <AlertCircle size={15} strokeWidth={2.5} />
              Falta elegir: {actual.faltan.join(', ')}
            </p>
          )}
        </div>

        <div className="flex-shrink-0 p-3 border-t border-slate-200 space-y-2">
          <button
            onClick={copiarATodas}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 hover:border-marca active:scale-[0.99] transition-transform duration-75"
          >
            <Copy size={16} strokeWidth={2.25} />
            Los {cantidad} iguales a este
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-black tabular-nums leading-none">{pesos(total)}</p>
            </div>

            <button
              onClick={onCancelar}
              className="h-14 px-5 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              className={`h-14 px-6 rounded-xl text-[15px] font-black transition-colors ${
                todasListas
                  ? 'bg-marca text-sobre-marca'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {todasListas ? 'Agregar · F2' : `Falta ${derivados.filter((d) => d.faltan.length > 0).length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Un grupo de opciones, con sus reglas dibujadas. */
function Grupo({
  titulo,
  obligatorio,
  multiple,
  maximo,
  repetibles,
  opciones,
  elegidas,
  grupoId,
  sub,
  incompleto,
  onMarcar,
  onQuitar,
}: {
  titulo: string;
  obligatorio: boolean;
  multiple: boolean;
  maximo: number | null;
  repetibles: boolean;
  opciones: { nombre: string; precio: number }[];
  elegidas: Elegidas;
  grupoId: string;
  sub: string;
  incompleto: boolean;
  onMarcar: (opcion: string) => void;
  onQuitar: (opcion: string) => void;
}) {
  if (!opciones.length) return null;

  const puestas = cuantasEn(elegidas, grupoId, sub);

  return (
    <div className={`rounded-xl p-3 ${incompleto ? 'bg-red-50 ring-2 ring-red-300' : 'bg-slate-50'}`}>
      <p className="text-[12.5px] font-black mb-2">
        {titulo}
        {obligatorio && <span className="text-red-600"> *</span>}
        {maximo !== null && (
          <span className="font-semibold text-slate-400"> · hasta {maximo} ({puestas})</span>
        )}
        {!multiple && <span className="font-semibold text-slate-400"> · elige uno</span>}
      </p>

      {/* Rejilla de botones grandes. 48 px de alto mínimo: en un monitor
          resistivo de mostrador, una lista de opciones pequeñas es una lista
          en la que el dedo acierta la de al lado. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {opciones.map((o) => {
          const n = elegidas[clave(grupoId, sub, o.nombre)] || 0;
          const puesta = n > 0;
          return (
            <button
              key={o.nombre}
              onClick={() => (repetibles && puesta ? onMarcar(o.nombre) : onMarcar(o.nombre))}
              onContextMenu={(e) => { e.preventDefault(); if (puesta) onQuitar(o.nombre); }}
              className={`min-h-[48px] px-2 py-1.5 rounded-lg text-[12.5px] font-bold border-2 text-left transition-colors ${
                puesta
                  ? 'border-marca bg-marca text-sobre-marca'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className="block truncate">
                {o.nombre}
                {n > 1 && ` x${n}`}
              </span>
              {o.precio > 0 && (
                <span className={`block text-[11px] tabular-nums ${puesta ? 'opacity-80' : 'text-slate-400'}`}>
                  +{pesos(o.precio)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

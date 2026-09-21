import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Minus, Plus } from 'lucide-react';
import { pesos, type ExtraElegido, type GrupoExtra, type Producto } from './nativo';
import {
  clave, cuantasEn as cuantasDe, derivar, marcar as marcarEn, quitar as quitarDe,
  type Elegidas,
} from './reglasExtras';

/**
 * Los extras de un producto: adiciones, salsas, términos.
 *
 * Esta pantalla es lo que faltaba para que la caja pudiera vender una
 * hamburguesa con queso extra. Antes el cajero tocaba el producto y entraba el
 * precio base, sin forma de agregar nada: el cliente pagaba de menos y la
 * cocina no se enteraba de cómo lo quería.
 *
 * Las reglas —obligatorio, uno solo o varios, máximo de tres, repetibles— las
 * define el negocio en el panel y aquí solo se obedecen. Son las que hacen que
 * una comanda llegue completa a la cocina: un grupo obligatorio sin elegir es
 * un plato que alguien va a tener que ir a preguntar a la mesa.
 */
export default function Extras({
  producto,
  inicial,
  onListo,
  onCancelar,
}: {
  producto: Producto;
  /* Lo que ya viene marcado al abrir. Lo usa el conmutador de tamaño de la
     columna izquierda: si el cajero tiene [Mediano] puesto, ese grupo llega
     resuelto y solo quedan las papas y la bebida por preguntar. */
  inicial?: Elegidas;
  /** Los extras elegidos y cuánto suman por unidad. */
  onListo: (extras: ExtraElegido[], sobreprecio: number) => void;
  onCancelar: () => void;
}) {
  const grupos: GrupoExtra[] = useMemo(
    () => (Array.isArray(producto.extras) ? producto.extras : []),
    [producto.extras],
  );

  /* Cuántas veces se eligió cada opción. Cero o ausente = no elegida. Se
     guarda la cuenta y no un booleano porque hay grupos repetibles —"zanahoria
     x2"— y un booleano no sabría decirlo. */
  const [elegidas, setElegidas] = useState<Elegidas>(inicial ?? {});
  const [intentado, setIntentado] = useState(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  /* Las reglas viven en `extras.ts` y no acá: son las mismas que aplica el
     modal en lote, y dos copias de "qué falta por elegir" terminan dejando
     pasar a la cocina un plato que la otra pantalla habría frenado. */
  const cuantasEn = (grupo: string, sub: string) => cuantasDe(elegidas, grupo, sub);

  const marcar = (
    grupo: string,
    sub: string,
    opcion: string,
    multiple: boolean,
    maximo: number | null,
    repetible: boolean,
  ) => setElegidas((previas) => marcarEn(previas, grupo, sub, opcion, multiple, maximo, repetible));

  const quitar = (grupo: string, sub: string, opcion: string) =>
    setElegidas((previas) => quitarDe(previas, grupo, sub, opcion));

  /** Lo elegido y lo que falta. Misma función que usa el modal en lote. */
  const { extras, sobreprecio, faltan } = useMemo(
    () => derivar(grupos, elegidas),
    [grupos, elegidas],
  );

  const listo = faltan.length === 0;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCancelar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[620px] max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl"
      >
        <div className="p-5 pb-3 flex-shrink-0">
          <p className="text-[16px] font-black">
            {producto.nombre}
            {producto.variante ? <span className="text-slate-400"> · {producto.variante}</span> : null}
          </p>
          <p className="text-[12.5px] text-slate-500 mt-0.5">{pesos(producto.precio)} el base</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 space-y-4">
          {grupos.map((g) => (
            <div key={g.id} className="space-y-2">
              <Bloque
                titulo={g.nombre}
                obligatorio={g.obligatorio}
                multiple={g.multiple}
                maximo={null}
                repetible={false}
                opciones={g.opciones || []}
                cuenta={(o) => elegidas[clave(g.id, '', o)] || 0}
                onMarcar={(o) => marcar(g.id, '', o, g.multiple, null, false)}
                onQuitar={(o) => quitar(g.id, '', o)}
                incompleto={intentado && faltan.includes(g.nombre)}
              />

              {(g.subgrupos || []).map((sg) => (
                <Bloque
                  key={sg.titulo}
                  titulo={sg.titulo}
                  obligatorio={sg.obligatorio}
                  multiple={sg.multiple}
                  maximo={sg.maximo}
                  repetible={sg.repetibles}
                  opciones={sg.opciones || []}
                  cuenta={(o) => elegidas[clave(g.id, sg.titulo, o)] || 0}
                  onMarcar={(o) => marcar(g.id, sg.titulo, o, sg.multiple, sg.maximo, sg.repetibles)}
                  onQuitar={(o) => quitar(g.id, sg.titulo, o)}
                  incompleto={intentado && faltan.includes(sg.titulo || g.nombre)}
                  elegidas={cuantasEn(g.id, sg.titulo)}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="p-5 pt-3 space-y-2 flex-shrink-0 border-t border-slate-100">
          {/* Lo que falta se dice con nombre y apellido. "Completa los campos
              obligatorios" obliga al cajero a buscar cuál. */}
          {intentado && !listo && (
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-red-600">
              <AlertCircle size={15} strokeWidth={2.5} />
              Falta elegir: {faltan.join(', ')}
            </p>
          )}

          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-bold text-slate-500">
              {sobreprecio > 0 ? `Base + ${pesos(sobreprecio)} en extras` : 'Sin extras'}
            </span>
            <span className="text-3xl font-black tabular-nums">
              {pesos(producto.precio + sobreprecio)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCancelar}
              className="w-32 h-toque rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
            >
              Cancelar
              <span className="block text-[10px] font-semibold text-slate-400">Esc</span>
            </button>
            <button
              onClick={() => {
                if (!listo) { setIntentado(true); return; }
                onListo(extras, sobreprecio);
              }}
              className="flex-1 h-toque rounded-xl bg-marca text-sobre-marca text-[13.5px] font-bold"
            >
              Agregar al pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Un grupo o subgrupo de opciones. */
function Bloque({
  titulo,
  obligatorio,
  multiple,
  maximo,
  repetible,
  opciones,
  cuenta,
  onMarcar,
  onQuitar,
  incompleto,
  elegidas = 0,
}: {
  titulo: string;
  obligatorio: boolean;
  multiple: boolean;
  maximo: number | null;
  repetible: boolean;
  opciones: { nombre: string; precio: number }[];
  cuenta: (opcion: string) => number;
  onMarcar: (opcion: string) => void;
  onQuitar: (opcion: string) => void;
  incompleto: boolean;
  elegidas?: number;
}) {
  if (!opciones.length) return null;

  const tope = maximo !== null && elegidas >= maximo;

  return (
    <div className={`rounded-xl p-3 ${incompleto ? 'bg-red-50 ring-2 ring-red-300' : 'bg-slate-50'}`}>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[13px] font-black">
          {titulo}
          {obligatorio && <span className="text-red-600"> *</span>}
        </p>
        <p className="text-[11px] text-slate-400">
          {!multiple
            ? 'Elige una'
            : maximo !== null
              ? `${elegidas} de ${maximo}`
              : 'Elige las que quieras'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {opciones.map((o) => {
          const n = cuenta(o.nombre);
          const bloqueada = tope && n === 0;

          return (
            <button
              key={o.nombre}
              onClick={() => onMarcar(o.nombre)}
              disabled={bloqueada}
              className={`flex items-center gap-2 px-3 min-h-toque py-2 rounded-xl text-left border-2 transition-colors ${
                n > 0
                  ? 'border-marca bg-marca text-sobre-marca'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              } disabled:opacity-30`}
            >
              <span className="flex-1 text-[13px] font-semibold leading-tight">{o.nombre}</span>

              {o.precio > 0 && (
                <span className={`text-[12px] font-bold tabular-nums ${n > 0 ? 'opacity-80' : 'text-slate-400'}`}>
                  +{pesos(o.precio)}
                </span>
              )}

              {/* Los repetibles llevan su contador: "zanahoria x2" se marca
                  tocando dos veces, y se baja con el menos. */}
              {repetible && n > 0 && (
                <span
                  onClick={(e) => { e.stopPropagation(); onQuitar(o.nombre); }}
                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-black/20"
                >
                  <Minus size={13} strokeWidth={3} />
                </span>
              )}
              {repetible && n > 0 && <span className="text-[13px] font-black tabular-nums">{n}</span>}
              {repetible && n === 0 && <Plus size={13} strokeWidth={3} className="text-slate-300" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

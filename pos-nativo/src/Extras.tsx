import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Minus, Plus } from 'lucide-react';
import { pesos, type ExtraElegido, type GrupoExtra, type Producto } from './nativo';

/** Una opción elegida, identificada por dónde salió. */
type Clave = string;

const clave = (grupo: string, sub: string, opcion: string): Clave =>
  `${grupo}\u0001${sub}\u0001${opcion}`;

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
  onListo,
  onCancelar,
}: {
  producto: Producto;
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
  const [elegidas, setElegidas] = useState<Record<Clave, number>>({});
  const [intentado, setIntentado] = useState(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  /** Cuántas hay marcadas dentro de un grupo o subgrupo. */
  const cuantasEn = (grupo: string, sub: string) =>
    Object.entries(elegidas)
      .filter(([k, n]) => n > 0 && k.startsWith(`${grupo}\u0001${sub}\u0001`))
      .reduce((t, [, n]) => t + n, 0);

  const marcar = (
    grupo: string,
    sub: string,
    opcion: string,
    multiple: boolean,
    maximo: number | null,
    repetible: boolean,
  ) => {
    const k = clave(grupo, sub, opcion);

    setElegidas((previas) => {
      const actual = previas[k] || 0;

      /* De una sola opción: elegir otra reemplaza. Es lo que espera quien pulsa
         "término medio" después de haber pulsado "bien asado", y obligarlo a
         desmarcar primero sería un toque de más en cada venta. */
      if (!multiple) {
        const limpias = Object.fromEntries(
          Object.entries(previas).filter(([otra]) => !otra.startsWith(`${grupo}\u0001${sub}\u0001`)),
        );
        return actual > 0 ? limpias : { ...limpias, [k]: 1 };
      }

      // Repetible: cada toque suma uno, hasta el tope.
      if (repetible) {
        if (maximo !== null && cuantasEn(grupo, sub) >= maximo) return previas;
        return { ...previas, [k]: actual + 1 };
      }

      // Normal: enciende y apaga.
      if (actual > 0) {
        const { [k]: _fuera, ...resto } = previas;
        return resto;
      }
      if (maximo !== null && cuantasEn(grupo, sub) >= maximo) return previas;
      return { ...previas, [k]: 1 };
    });
  };

  const quitar = (grupo: string, sub: string, opcion: string) => {
    const k = clave(grupo, sub, opcion);
    setElegidas((previas) => {
      const actual = previas[k] || 0;
      if (actual <= 1) {
        const { [k]: _fuera, ...resto } = previas;
        return resto;
      }
      return { ...previas, [k]: actual - 1 };
    });
  };

  /** Lo elegido, en la forma que viaja con la venta. */
  const { extras, sobreprecio, faltan } = useMemo(() => {
    const salida: ExtraElegido[] = [];
    let suma = 0;
    const pendientes: string[] = [];

    for (const g of grupos) {
      // Las opciones que cuelgan del grupo, sin subgrupo.
      for (const o of g.opciones || []) {
        const n = elegidas[clave(g.id, '', o.nombre)] || 0;
        if (n > 0) {
          salida.push({ grupo: g.nombre, nombre: o.nombre, precio: o.precio, cantidad: n });
          suma += o.precio * n;
        }
      }
      if (g.obligatorio && cuantasEn(g.id, '') === 0 && (g.opciones || []).length) {
        pendientes.push(g.nombre);
      }

      for (const sg of g.subgrupos || []) {
        for (const o of sg.opciones || []) {
          const n = elegidas[clave(g.id, sg.titulo, o.nombre)] || 0;
          if (n > 0) {
            salida.push({
              grupo: sg.titulo || g.nombre,
              nombre: o.nombre,
              precio: o.precio,
              cantidad: n,
            });
            suma += o.precio * n;
          }
        }
        if (sg.obligatorio && cuantasEn(g.id, sg.titulo) === 0) {
          pendientes.push(sg.titulo || g.nombre);
        }
      }

      // El grupo puede cobrar por sí mismo, aparte de sus opciones.
      if (g.precio_base > 0 && salida.some((e) => e.grupo === g.nombre)) {
        suma += g.precio_base;
      }
    }

    return { extras: salida, sobreprecio: suma, faltan: pendientes };
  }, [grupos, elegidas]);

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

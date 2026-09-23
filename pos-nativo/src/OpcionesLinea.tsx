import { Check } from 'lucide-react';
import { pesos, type GrupoExtra } from './nativo';
import { clave, cuantasEn, type Elegidas } from './reglasExtras';

/**
 * Las opciones de un producto, en el centro de la caja.
 *
 * Se abre al tocar algo con obligatorios —el combo que pide bebida— o al
 * tocar una línea del ticket para cambiarla. El producto **ya está** en el
 * ticket: cada toque aquí cambia la línea al instante, precio incluido, y
 * "Listo" solo vuelve a la carta. No hay pasos: todos los grupos a la vista,
 * lo obligatorio primero.
 *
 * Ocupa el centro entero a propósito. Se probó compartirlo con la carta y
 * meterlo en la columna del ticket: en los dos casos algo quedaba aplastado
 * —casillas de 35 px o un ticket de una línea— hasta no poder leerse.
 *
 * La barra de abajo está donde la carta tiene la paginación: el dedo que va a
 * "página siguiente" es el mismo que va a "Listo".
 */
export default function OpcionesLinea({
  titulo,
  cantidad,
  precio,
  grupos,
  elegidas,
  onTocar,
  onCerrar,
}: {
  titulo: string;
  /** Si la línea es de varias unidades, todas llevan lo mismo. */
  cantidad: number;
  /** El precio de la línea con lo elegido, por unidad. */
  precio: number;
  grupos: GrupoExtra[];
  elegidas: Elegidas;
  onTocar: (g: GrupoExtra, opcion: string, sub: string) => void;
  onCerrar: () => void;
}) {
  /* Las opciones de un grupo, con las de sus subgrupos mezcladas: para el
     cajero son casillas, que cuelguen de un subgrupo es cosa del panel. */
  const opcionesDe = (g: GrupoExtra) => [
    ...(g.opciones || []).map((o) => ({ ...o, sub: '' })),
    ...(g.subgrupos || []).flatMap((sg) => (sg.opciones || []).map((o) => ({ ...o, sub: sg.titulo }))),
  ];

  const falta = (g: GrupoExtra) =>
    g.obligatorio
    && cuantasEn(elegidas, g.id, '') === 0
    && !(g.subgrupos || []).some((sg) => cuantasEn(elegidas, g.id, sg.titulo) > 0);

  /* Lo obligatorio arriba: es lo que hay que preguntar sí o sí, y lo que
     frena el cobro si se olvida. El resto conserva el orden del panel. */
  const ordenados = [...grupos].sort((a, b) => Number(b.obligatorio) - Number(a.obligatorio));
  const pendientes = grupos.filter(falta);

  return (
    <div data-opciones-linea className="flex-1 flex flex-col min-h-0 gap-2">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        {ordenados.map((g) => {
          const pendiente = falta(g);
          return (
            <section key={g.id} data-grupo={g.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[13px] font-black uppercase tracking-wide ${
                  pendiente ? 'text-amber-600' : 'text-slate-500'
                }`}>
                  {g.nombre}
                </span>
                {g.obligatorio ? (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                    pendiente ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {pendiente ? 'elige uno' : 'listo'}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400">opcional</span>
                )}
              </div>

              <div className="grid grid-cols-4 xl:grid-cols-5 gap-2">
                {opcionesDe(g).map((o) => {
                  const puesta = (elegidas[clave(g.id, o.sub, o.nombre)] || 0) > 0;
                  return (
                    <button
                      key={o.sub + o.nombre}
                      onClick={() => onTocar(g, o.nombre, o.sub)}
                      aria-pressed={puesta}
                      className={`min-h-[64px] p-2.5 rounded-xl border-2 text-left flex flex-col justify-between gap-1 active:scale-95 transition-transform duration-75 ${
                        puesta
                          ? 'border-marca bg-marca text-sobre-marca'
                          : pendiente
                            ? 'border-amber-300 bg-white text-slate-800'
                            : 'border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      <span className="text-[14px] font-bold leading-tight line-clamp-2">{o.nombre}</span>
                      <span className="flex items-center gap-1 text-[12px] font-black tabular-nums">
                        {o.precio > 0
                          ? <span className={puesta ? 'opacity-90' : 'text-slate-500'}>+{pesos(o.precio)}</span>
                          : <span className={`font-semibold ${puesta ? 'opacity-80' : 'text-slate-400'}`}>incluido</span>}
                        {puesta && <Check size={15} strokeWidth={3} className="ml-auto" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Donde la carta tiene la paginación. */}
      <div className="flex-shrink-0 flex items-center gap-3 h-14 px-4 rounded-xl bg-slate-900 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black truncate">
            {cantidad > 1 ? `${cantidad} × ` : ''}{titulo}
          </p>
          <p className={`text-[11.5px] font-semibold ${pendientes.length ? 'text-amber-300' : 'text-slate-400'}`}>
            {pendientes.length
              ? `Falta: ${pendientes.map((g) => g.nombre).join(', ')}`
              : 'Ya está en el ticket'}
          </p>
        </div>
        <span className="text-[18px] font-black tabular-nums">{pesos(precio * cantidad)}</span>
        <button
          onClick={onCerrar}
          title="Volver a la carta (Enter o Esc)"
          className="px-6 h-11 rounded-xl bg-marca text-sobre-marca text-[15px] font-black active:scale-95 transition-transform duration-75"
        >
          Listo
        </button>
      </div>
    </div>
  );
}

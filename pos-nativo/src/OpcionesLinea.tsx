import { Check, X } from 'lucide-react';
import { pesos, type GrupoExtra } from './nativo';
import { clave, cuantasEn, type Elegidas } from './reglasExtras';

/**
 * Las opciones de la línea que acaba de entrar, debajo del ticket.
 *
 * Reemplaza a la rejilla de extras, que tapaba la carta: tocar un combo
 * cambiaba de pantalla, había que elegir y tocar "Confirmar" para volver. Eran
 * un cambio de pantalla y un toque de más **por cada combo**, que es justo lo
 * que más se vende.
 *
 * Aquí no hay confirmar. El producto ya está en el ticket con lo estándar
 * marcado; si el cliente quiere otra cosa se toca y la línea cambia al
 * instante, precio incluido. Tocar el siguiente producto cierra este panel y
 * abre el del nuevo. La carta nunca se va de la pantalla.
 *
 * Va siempre en el mismo sitio —abajo del ticket, encima del total— para que
 * "Coca-Cola" quede donde el dedo ya sabe, combo tras combo.
 *
 * Lo obligatorio sin elegir no bloquea seguir marcando: bloquea cobrar y
 * mandar a cocina, y el aviso lleva de vuelta aquí.
 */
export default function OpcionesLinea({
  titulo,
  cantidad,
  grupos,
  elegidas,
  onTocar,
  onCerrar,
}: {
  titulo: string;
  /** Si la línea es de varias unidades, todas llevan lo mismo. */
  cantidad: number;
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

  return (
    <div
      data-opciones-linea
      className="flex-shrink-0 max-h-[55%] flex flex-col border-t-2 border-marca bg-slate-50"
    >
      <div className="flex-shrink-0 flex items-center gap-2 px-3 h-10 bg-white border-b border-slate-200">
        <span className="text-[12.5px] font-black truncate">
          {titulo}{cantidad > 1 ? ` · las ${cantidad}` : ''}
        </span>
        <button
          onClick={onCerrar}
          aria-label="Cerrar opciones"
          title="Listo (Esc)"
          className="ml-auto flex items-center justify-center w-9 h-9 -mr-2 rounded-lg text-slate-400 hover:text-slate-700"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {grupos.map((g) => {
          const pendiente = falta(g);
          return (
            <div key={g.id} data-grupo={g.id}>
              <div className="flex items-center gap-1.5 mb-1 px-0.5">
                <span className={`text-[10.5px] font-black uppercase tracking-wide truncate ${
                  pendiente ? 'text-amber-600' : 'text-slate-400'
                }`}>
                  {g.nombre}
                </span>
                {pendiente && (
                  <span className="flex-shrink-0 text-[9.5px] font-black px-1 rounded bg-amber-100 text-amber-700 uppercase">
                    falta
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {opcionesDe(g).map((o) => {
                  const puesta = (elegidas[clave(g.id, o.sub, o.nombre)] || 0) > 0;
                  return (
                    <button
                      key={o.sub + o.nombre}
                      onClick={() => onTocar(g, o.nombre, o.sub)}
                      aria-pressed={puesta}
                      className={`min-h-[44px] px-2 py-1 rounded-lg border-2 text-left flex items-center gap-1 active:scale-95 transition-transform duration-75 ${
                        puesta
                          ? 'border-marca bg-marca text-sobre-marca'
                          : pendiente
                            ? 'border-amber-300 bg-white text-slate-700'
                            : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <span className="flex-1 min-w-0 text-[12px] font-bold leading-tight line-clamp-2">
                        {o.nombre}
                      </span>
                      {o.precio > 0 && (
                        <span className="flex-shrink-0 text-[10.5px] font-black tabular-nums opacity-80">
                          +{pesos(o.precio)}
                        </span>
                      )}
                      {puesta && <Check size={13} strokeWidth={3} className="flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

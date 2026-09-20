import { useEffect, useState } from 'react';
import { Gift, Star, X } from 'lucide-react';
import { pesos, recompensas as leerRecompensas, type Cliente, type Recompensa } from './nativo';

/**
 * Canjear puntos por una recompensa, en el mostrador.
 *
 * La lista sale de la copia local, así que se abre al instante y sin internet.
 * El canje en sí **no**: ese va contra el servidor cuando la venta se cobra, y
 * es la única cosa del POS que exige conexión. La razón está en
 * `nativo.canjearRecompensa`, y en corto: dos cajas atendiendo al mismo cliente
 * en el mismo minuto podrían quemarle los mismos cien puntos dos veces si cada
 * una decidiera por su cuenta.
 *
 * Lo que sí se decide aquí es **qué puede pagar el cliente**, con los puntos que
 * la última sincronización dejó. Es una comprobación optimista: si el saldo
 * cambió desde entonces, el servidor rechaza y la pantalla lo dice. Vale la
 * pena igual, porque evita ofrecerle al cliente algo que no alcanza a pagar y
 * tener que retirarlo delante de él.
 *
 * Las que no alcanzan se muestran igual, apagadas y con cuánto falta. Ocultarlas
 * ahorraría una línea y quitaría lo único que hace que el programa de puntos
 * sirva de algo: que el cliente sepa para qué le faltan treinta puntos.
 */
export default function ModalRecompensas({
  cliente,
  onElegir,
  onCerrar,
}: {
  cliente: Cliente;
  onElegir: (r: Recompensa) => void;
  onCerrar: () => void;
}) {
  const [lista, setLista] = useState<Recompensa[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    leerRecompensas()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCerrar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  /* Las que alcanzan primero. Con ocho recompensas en la lista, la que el
     cliente puede llevarse no puede estar de sexta. */
  const ordenadas = [...lista].sort((a, b) => {
    const alcanzaA = a.costo_puntos <= cliente.puntos ? 0 : 1;
    const alcanzaB = b.costo_puntos <= cliente.puntos ? 0 : 1;
    return alcanzaA - alcanzaB || a.costo_puntos - b.costo_puntos;
  });

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCerrar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[560px] max-h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-5 h-14 bg-slate-900 text-white flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[15px] font-black truncate">{cliente.nombre || cliente.telefono}</p>
            <p className="text-[11.5px] text-slate-400 tabular-nums">
              {cliente.puntos} punto{cliente.puntos === 1 ? '' : 's'} disponibles
            </p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex-shrink-0 flex items-center justify-center w-toque h-toque rounded-xl text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cargando && <p className="text-center text-slate-400 py-10 text-sm">Cargando…</p>}

          {!cargando && ordenadas.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-slate-300">
              <Gift size={40} strokeWidth={1.5} />
              <p className="text-[13.5px] font-semibold text-slate-400">
                Este negocio no tiene recompensas activas
              </p>
              <p className="text-[11.5px] text-slate-400">Se configuran en el panel de MenuBy</p>
            </div>
          )}

          {ordenadas.map((r) => {
            const alcanza = r.costo_puntos <= cliente.puntos;
            const faltan = r.costo_puntos - cliente.puntos;

            return (
              <button
                key={r.id}
                onClick={() => alcanza && onElegir(r)}
                disabled={!alcanza}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-transform duration-75 ${
                  alcanza
                    ? 'bg-emerald-50 border-2 border-emerald-200 hover:border-emerald-400 active:scale-[0.98]'
                    : 'bg-slate-50 border-2 border-transparent opacity-60 cursor-not-allowed'
                }`}
              >
                <span
                  className={`flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl ${
                    alcanza ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  <Gift size={20} strokeWidth={2.25} />
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold truncate">{r.nombre}</p>
                  <p className="text-[11.5px] text-slate-500">{describir(r)}</p>
                </div>

                <span
                  className={`flex-shrink-0 flex items-center gap-1 px-3 h-9 rounded-lg text-[13px] font-black tabular-nums ${
                    alcanza ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Star size={13} strokeWidth={2.5} />
                  {r.costo_puntos}
                </span>

                {!alcanza && (
                  <span className="flex-shrink-0 text-[11.5px] font-semibold text-slate-400 tabular-nums w-20 text-right">
                    faltan {faltan}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex-shrink-0">
          <p className="text-[11.5px] text-slate-400">
            Los puntos se descuentan en MenuBy al cobrar la venta. Si no hay conexión en ese
            momento, el canje no se hace y la venta sigue normal.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Qué se lleva el cliente, en una línea que se entiende sin saber de tipos. */
function describir(r: Recompensa): string {
  if (r.tipo === 'free_product') return 'Producto gratis';
  if (r.tipo === 'discount_fixed') return `${pesos(r.valor_descuento)} de descuento`;
  if (r.tipo === 'discount_percent') return `${r.valor_descuento}% de descuento`;
  if (r.tipo === 'free_delivery') return 'Domicilio gratis';
  return 'Recompensa';
}

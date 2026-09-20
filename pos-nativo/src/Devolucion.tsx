import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Minus, Plus, Undo2 } from 'lucide-react';
import {
  lineasDevolvibles, pesos, ventasRecientes,
  type LineaDevolvible, type VentaBuscada,
} from './nativo';

/**
 * Devolver lo que ya se cobró.
 *
 * Dos pasos: encontrar la venta y elegir qué vuelve. Casi nunca vuelve la venta
 * entera —de cuatro platos vuelve uno— así que se devuelve por línea.
 *
 * Esta pantalla **no ejecuta la devolución**: arma la petición y se la pasa al
 * modal de autorización. La plata no sale de la gaveta sin el PIN de un
 * supervisor, porque una devolución es una salida de efectivo sin nada vendido
 * a cambio y es el camino más corto para vaciar una caja.
 */
export default function Devolucion({
  onListo,
  onCancelar,
}: {
  onListo: (venta: VentaBuscada, items: LineaDevolvible[], cantidades: number[], medio: string) => void;
  onCancelar: () => void;
}) {
  const [ventas, setVentas] = useState<VentaBuscada[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [elegida, setElegida] = useState<VentaBuscada | null>(null);
  const [lineas, setLineas] = useState<LineaDevolvible[]>([]);
  const [cantidades, setCantidades] = useState<number[]>([]);
  const [medio, setMedio] = useState('efectivo');
  const [error, setError] = useState('');

  useEffect(() => { ventasRecientes().then(setVentas).catch(() => {}); }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  const abrir = async (v: VentaBuscada) => {
    setError('');
    try {
      const l = await lineasDevolvibles(v.id);
      setElegida(v);
      setLineas(l);
      setCantidades(l.map(() => 0));
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    }
  };

  const cambiar = (i: number, delta: number) => {
    setCantidades((c) =>
      c.map((n, j) => (j === i ? Math.max(0, Math.min(lineas[i].quedan, n + delta)) : n)),
    );
  };

  const total = lineas.reduce((t, l, i) => t + l.precio * cantidades[i], 0);
  const algo = cantidades.some((n) => n > 0);

  const filtradas = busqueda
    ? ventas.filter((v) => String(v.consecutivo).includes(busqueda.replace(/\D/g, '')))
    : ventas;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCancelar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[560px] max-h-[92vh] overflow-y-auto bg-white rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <Undo2 size={20} strokeWidth={2.25} className="text-slate-500" />
          <div>
            <p className="text-[15px] font-black">Devolver una venta</p>
            <p className="text-[12.5px] text-slate-500">
              Lo autoriza un supervisor y queda registrado.
            </p>
          </div>
        </div>

        {!elegida ? (
          <>
            {/* Se busca por consecutivo porque es el número que el cliente
                trae impreso en la tirilla. */}
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value.replace(/\D/g, '').slice(0, 8))}
              inputMode="numeric"
              placeholder="Número de la venta"
              className="w-full h-toque px-3 rounded-xl border-2 border-slate-200 text-[14px] tabular-nums outline-none focus:border-marca"
            />

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {filtradas.map((v) => (
                <button
                  key={v.id}
                  onClick={() => abrir(v)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-left"
                >
                  <span className="text-[15px] font-black tabular-nums w-14">#{v.consecutivo}</span>
                  <span className="flex-1 text-[11.5px] text-slate-400">
                    {new Date(v.creada_en).toLocaleString('es-CO', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className="font-bold tabular-nums">{pesos(v.total)}</span>
                </button>
              ))}
              {filtradas.length === 0 && (
                <p className="text-center text-[13px] text-slate-400 py-6">
                  {busqueda
                    ? `Ninguna venta con el número ${busqueda} en esta caja.`
                    : 'Todavía no hay ventas en esta caja.'}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between px-3 py-2 rounded-xl bg-slate-50">
              <span className="text-[13px] font-bold">Venta #{elegida.consecutivo}</span>
              <button
                onClick={() => { setElegida(null); setLineas([]); }}
                className="text-[12px] font-semibold text-slate-400 hover:text-slate-700"
              >
                Cambiar
              </button>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {lineas.map((l, i) => (
                <div key={i} className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate">
                      {l.nombre}
                      {l.variante ? <span className="text-slate-400"> · {l.variante}</span> : null}
                    </p>
                    <p className="text-[11px] text-slate-400 tabular-nums">
                      {pesos(l.precio)} c/u
                      {/* Lo ya devuelto se dice, no se esconde: si no, el
                          cajero cree que el sistema falla cuando no le deja
                          devolver algo que ya devolvió. */}
                      {l.quedan < l.cantidad && (
                        <span className="text-amber-600 font-semibold">
                          {' · '}quedan {l.quedan} de {l.cantidad}
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => cambiar(i, -1)}
                    disabled={cantidades[i] === 0}
                    className="flex items-center justify-center w-toque h-toque rounded-lg border border-slate-200 text-slate-600 disabled:opacity-25"
                  >
                    <Minus size={16} strokeWidth={3} />
                  </button>
                  <span className="w-7 text-center font-bold tabular-nums">{cantidades[i]}</span>
                  <button
                    onClick={() => cambiar(i, 1)}
                    disabled={cantidades[i] >= l.quedan}
                    className="flex items-center justify-center w-toque h-toque rounded-lg border border-slate-200 text-slate-600 disabled:opacity-25"
                  >
                    <Plus size={16} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>

            {/* Con qué se devuelve. No es lo mismo al conciliar: en efectivo
                sale de la gaveta, por datáfono la reversa la hace el banco. */}
            <div className="flex gap-1.5">
              {([
                { id: 'efectivo', nombre: 'Efectivo', icono: Banknote },
                { id: 'tarjeta', nombre: 'Reversa tarjeta', icono: CreditCard },
              ]).map(({ id, nombre, icono: Icono }) => (
                <button
                  key={id}
                  onClick={() => setMedio(id)}
                  className={`flex-1 flex items-center justify-center gap-2 h-toque rounded-xl text-[13px] font-bold border-2 transition-colors ${
                    medio === id
                      ? 'border-marca bg-marca text-sobre-marca'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Icono size={16} strokeWidth={2.25} />
                  {nombre}
                </button>
              ))}
            </div>

            <div className="flex items-baseline justify-between px-3 py-2 rounded-xl bg-red-50 text-red-800">
              <span className="text-[13px] font-bold">Se devuelve</span>
              <span className="text-2xl font-black tabular-nums">{pesos(total)}</span>
            </div>
          </>
        )}

        {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="w-32 h-toque rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
          >
            Cancelar
            <span className="block text-[10px] font-semibold text-slate-400">Esc</span>
          </button>
          <button
            onClick={() => elegida && onListo(elegida, lineas, cantidades, medio)}
            disabled={!elegida || !algo}
            className="flex-1 h-toque rounded-xl bg-marca text-sobre-marca text-[13.5px] font-bold disabled:opacity-30"
          >
            Pedir autorización
          </button>
        </div>
      </div>
    </div>
  );
}

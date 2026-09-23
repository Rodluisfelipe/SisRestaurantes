import { useEffect, useState } from 'react';
import { Ban, RotateCcw, Search, X } from 'lucide-react';
import { apagados as leerApagados, catalogo, marcarAgotado, type Apagado, type Producto } from './nativo';

/**
 * Lo que se acabó.
 *
 * Marcar un agotado desde la caja lo quita también del menú web en el acto:
 * es el mismo interruptor que el dueño tiene en el panel. Antes, cuando se
 * acababa el pan de hamburguesa, la caja lo sabía de palabra y el menú seguía
 * recibiendo pedidos de hamburguesas.
 */
export default function Agotados({
  onCerrar,
  onCambio,
}: {
  onCerrar: () => void;
  /** Para que la carta de la caja se redibuje sin lo que se agotó. */
  onCambio: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [activos, setActivos] = useState<Producto[]>([]);
  const [apagados, setApagados] = useState<Apagado[]>([]);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');

  const refrescar = () => {
    leerApagados().then(setApagados).catch(() => {});
  };
  useEffect(refrescar, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      catalogo(texto, '').then((l) => setActivos(l.slice(0, 40))).catch(() => setActivos([]));
    }, 60);
    return () => window.clearTimeout(id);
  }, [texto]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  const cambiar = async (id: string, agotado: boolean) => {
    setOcupado(id);
    setError('');
    try {
      await marcarAgotado(id, agotado);
      refrescar();
      // La lista de activos se vuelve a pedir: el agotado ya no está.
      catalogo(texto, '').then((l) => setActivos(l.slice(0, 40))).catch(() => {});
      onCambio();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setOcupado('');
    }
  };

  /* Un producto con tallas son varias filas en la carta; aquí se agota
     entero, así que se muestra una sola vez. */
  const unicos = activos.filter(
    (p, i) => activos.findIndex((q) => q.id.split(':')[0] === p.id.split(':')[0]) === i,
  );

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center" onMouseDown={onCerrar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[720px] max-w-[94vw] h-[82vh] bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[17px] font-black">Agotados</p>
            <p className="text-[12px] text-slate-500">Lo que marques sale de esta caja y del menú web al instante.</p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

        <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
          <div className="flex flex-col min-h-0 gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="¿Qué se acabó?"
                className="w-full h-11 pl-9 pr-3 rounded-xl border-2 border-slate-200 text-[14px] outline-none focus:border-marca"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
              {unicos.map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                  <span className="flex-1 min-w-0 text-[13px] font-semibold truncate">{p.nombre}</span>
                  <button
                    onClick={() => cambiar(p.id, true)}
                    disabled={ocupado === p.id}
                    className="flex items-center gap-1.5 px-3 h-10 rounded-lg border-2 border-red-200 text-red-600 text-[12px] font-bold disabled:opacity-40"
                  >
                    <Ban size={14} strokeWidth={2.5} />
                    {ocupado === p.id ? '…' : 'Agotado'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col min-h-0 gap-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 pt-3">
              Sin vender ahora ({apagados.length})
            </p>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
              {apagados.length === 0 && (
                <p className="text-center text-[12.5px] text-slate-400 py-8">Todo está a la venta</p>
              )}
              {apagados.map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate">{p.nombre}</p>
                    {p.categoria && <p className="text-[11px] text-slate-500 truncate">{p.categoria}</p>}
                  </div>
                  <button
                    onClick={() => cambiar(p.id, false)}
                    disabled={ocupado === p.id}
                    className="flex items-center gap-1.5 px-3 h-10 rounded-lg bg-emerald-600 text-white text-[12px] font-bold disabled:opacity-40"
                  >
                    <RotateCcw size={14} strokeWidth={2.5} />
                    {ocupado === p.id ? '…' : 'Volver a vender'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

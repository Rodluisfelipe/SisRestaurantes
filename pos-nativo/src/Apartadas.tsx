import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { apartadas as leerApartadas, reintentarApartadas, type Apartada } from './nativo';

const QUE: Record<string, string> = {
  venta: 'Venta',
  excepcion: 'Registro de auditoría',
  turno: 'Cierre de turno',
  devolucion: 'Devolución',
};

/**
 * Lo que la nube rechazó, y por qué.
 *
 * Antes el aviso rojo decía "8 rechazadas" y nada más: ni qué eran ni cómo
 * sacarlas de ahí. Resultaron ser registros de auditoría de un tipo que el
 * servidor todavía no conocía —no ventas—, y una vez arreglado el servidor no
 * había forma de volver a subirlos.
 */
export default function Apartadas({ onCerrar }: { onCerrar: () => void }) {
  const [lista, setLista] = useState<Apartada[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState('');

  const cargar = () => leerApartadas().then(setLista).catch(() => {});
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  const reintentar = async () => {
    setOcupado(true);
    setResultado('');
    try {
      const r = await reintentarApartadas();
      await cargar();
      setResultado(
        r.error
          ? `No se pudo subir: ${r.error}`
          : r.enviadas > 0
            ? `Se subieron ${r.enviadas}.`
            : 'Siguen en la cola: se reintentan solas.',
      );
    } catch (e) {
      setResultado(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center" onMouseDown={onCerrar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[600px] max-w-[94vw] max-h-[82vh] bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-black">Rechazadas por la nube</p>
            <p className="text-[12.5px] text-slate-500">
              Están guardadas en esta caja; no se perdió nada. Si el problema era del servidor
              y ya se arregló, reintenta.
            </p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-400">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
          {lista.length === 0 && (
            <p className="text-center text-[13px] text-slate-400 py-8">No queda nada rechazado</p>
          )}
          {lista.map((a, i) => (
            <div key={i} className="p-2.5 rounded-xl bg-red-50">
              <div className="flex justify-between gap-2">
                <p className="text-[13px] font-bold">
                  {QUE[a.entidad] ?? a.entidad}{a.detalle ? ` · ${a.detalle}` : ''}
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">{a.creado_en.slice(0, 16).replace('T', ' ')}</p>
              </div>
              <p className="text-[11.5px] text-red-700 break-words">{a.error}</p>
            </div>
          ))}
        </div>

        {resultado && <p className="text-[12.5px] font-semibold text-slate-700">{resultado}</p>}

        <button
          onClick={reintentar}
          disabled={ocupado || lista.length === 0}
          className="flex items-center justify-center gap-2 h-12 rounded-xl bg-marca text-sobre-marca text-[14px] font-black disabled:opacity-30"
        >
          <RefreshCw size={16} strokeWidth={2.5} className={ocupado ? 'animate-spin' : ''} />
          Reintentar todas
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { corteX, corteZ, pesos, reimprimir, resumenTurno, type InformeCorte, type ResumenTurno } from './nativo';
import Corte from './Corte';

const MEDIO: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  mixto: 'Mixto',
};

/** La hora de una fecha RFC 3339, tal como se guardó en la caja. */
function hora(creada: string): string {
  const m = /T(\d{2}:\d{2})/.exec(creada);
  return m ? m[1] : creada;
}

/**
 * Las ventas del turno: cuántas van, qué se vende y reimprimir cualquiera.
 *
 * Antes la caja solo reimprimía la **última** venta. El cliente que vuelve a
 * los veinte minutos por su tirilla —para una cuenta de cobro, para un
 * reclamo— ya no tenía papel: detrás de él habían pasado otros cinco.
 *
 * No muestra cuánto efectivo debería haber: el arqueo es ciego.
 */
export default function VentasTurno({
  onCerrar,
  onFallo,
  conPermiso,
}: {
  onCerrar: () => void;
  onFallo: (mensaje: string) => void;
  /** Hacer algo si se puede, o pedir el PIN de quien pueda. */
  conPermiso: (permiso: string, titulo: string, accion: () => void) => void;
}) {
  const [corte, setCorte] = useState<InformeCorte | null>(null);
  /* El Z cierra el día: se pide un segundo toque en el mismo botón. */
  const [confirmandoZ, setConfirmandoZ] = useState(false);
  const sacar = (tipo: 'X' | 'Z') =>
    conPermiso('cortes', tipo === 'Z' ? 'Sacar el corte Z' : 'Sacar el corte X', () => {
      (tipo === 'Z' ? corteZ() : corteX())
        .then(setCorte)
        .catch((e) => setError(String(e).replace(/^Error:\s*/, '')))
        .finally(() => setConfirmandoZ(false));
    });
  const [datos, setDatos] = useState<ResumenTurno | null>(null);
  // Un error de carga o de un corte ("Cierra el turno antes del Z").
  const [error, setError] = useState('');
  const [imprimiendo, setImprimiendo] = useState('');

  useEffect(() => {
    resumenTurno().then(setDatos).catch((e) => setError(String(e).replace(/^Error:\s*/, '')));
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  const imprimir = async (id: string) => {
    setImprimiendo(id);
    try {
      await reimprimir(id);
    } catch (e) {
      onFallo(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setImprimiendo('');
    }
  };

  if (corte) return <Corte informe={corte} onCerrar={() => setCorte(null)} />;

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center" onMouseDown={onCerrar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[720px] max-w-[94vw] h-[82vh] bg-white rounded-2xl p-5 flex flex-col gap-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <p className="text-[17px] font-black">Ventas del turno</p>
          <div className="ml-auto mr-2 flex gap-2">
            <button
              onClick={() => sacar('X')}
              title="Cómo va el día desde el último Z. No cierra nada."
              className="h-10 px-3 rounded-lg border-2 border-slate-200 text-[12.5px] font-bold text-slate-700"
            >
              Corte X
            </button>
            <button
              onClick={() => (confirmandoZ ? sacar('Z') : setConfirmandoZ(true))}
              title="Cierra el día: se numera y sube al panel. Con los turnos cerrados."
              className={`h-10 px-3 rounded-lg text-[12.5px] font-bold border-2 ${
                confirmandoZ ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 text-slate-700'
              }`}
            >
              {confirmandoZ ? '¿Cerrar el día?' : 'Corte Z'}
            </button>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}

        {datos && (
          <div className="flex-1 min-h-0 grid grid-cols-[1fr_240px] gap-4">
            {/* La lista, la más nueva arriba: es la que el cliente vuelve a pedir. */}
            <div className="min-h-0 overflow-y-auto space-y-1.5 pr-1">
              {datos.recientes.length === 0 && (
                <p className="text-center text-[13px] text-slate-400 py-10">Todavía no hay ventas en este turno</p>
              )}
              {datos.recientes.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <div className="w-14 flex-shrink-0">
                    <p className="text-[14px] font-black tabular-nums">#{v.consecutivo}</p>
                    <p className="text-[11px] text-slate-400 tabular-nums">{hora(v.creada_en)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold truncate">{v.resumen || '—'}</p>
                    <p className="text-[11px] text-slate-500">{MEDIO[v.medio_pago] ?? v.medio_pago}</p>
                  </div>
                  <span className="text-[14px] font-black tabular-nums">{pesos(v.total)}</span>
                  <button
                    onClick={() => imprimir(v.id)}
                    disabled={imprimiendo === v.id}
                    title="Reimprimir esta venta (sale como COPIA y no abre la gaveta)"
                    className="flex items-center gap-1.5 px-3 h-11 rounded-lg border-2 border-slate-200 text-[12px] font-bold text-slate-600 disabled:opacity-40 active:scale-95 transition-transform duration-75"
                  >
                    <Printer size={15} strokeWidth={2.25} />
                    {imprimiendo === v.id ? '…' : 'Reimprimir'}
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900 text-white">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Ventas</p>
                <p className="text-3xl font-black tabular-nums">{datos.ventas}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 mb-1.5">Lo más vendido</p>
                <div className="space-y-1">
                  {datos.mas_vendidos.map((p) => (
                    <div key={p.nombre} className="flex justify-between gap-2 text-[12.5px]">
                      <span className="truncate">{p.nombre}</span>
                      <span className="font-black tabular-nums">{p.cantidad}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

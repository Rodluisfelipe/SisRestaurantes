import { useEffect, useState } from 'react';
import { autorizar } from './nativo';
import { error as bipError } from './sonido';

/**
 * Autorizar algo que el usuario de la caja no puede hacer solo.
 *
 * Pide el PIN de **alguien cuyo rol tenga ese permiso** —no de "un
 * supervisor" cualquiera—, y deja la acción habilitada una sola vez. **No
 * cambia la sesión**: el turno sigue siendo del cajero. Si quien autoriza
 * quedara adentro, el resto de la tarde se vendería bajo su nombre y la
 * trazabilidad se borraría justo en el turno que se quería vigilar.
 *
 * Tres formas:
 * - Con motivo y PIN: el cajero no tiene el permiso y la acción lo exige
 *   (anular, descontar, devolver).
 * - Solo motivo (`yo`): quien está en la caja ya tiene el permiso. No tiene
 *   sentido que un supervisor se pida el PIN a sí mismo, pero el motivo sí
 *   queda.
 * - Solo PIN (`sinMotivo`): acciones que no llevan motivo, como marcar un
 *   agotado o abrir la configuración.
 */
export default function Autorizar({
  titulo,
  detalle,
  permiso,
  yo,
  sinMotivo = false,
  onListo,
  onCancelar,
}: {
  titulo: string;
  detalle: string;
  /** El permiso que hace falta, tal como lo nombra la caja. */
  permiso: string;
  /** El nombre de quien está en la caja, si ya tiene el permiso. */
  yo?: string;
  sinMotivo?: boolean;
  onListo: (motivo: string, autorizo: string) => void;
  onCancelar: () => void;
}) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const pidePin = !yo;

  const confirmar = async () => {
    if (!sinMotivo && motivo.trim().length < 3) {
      setError('Escribe por qué');
      return;
    }
    if (!pidePin) {
      onListo(motivo.trim(), yo!);
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const quien = await autorizar(pin, permiso);
      onListo(motivo.trim(), quien);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
      bipError();
      setPin('');
    } finally {
      setOcupado(false);
    }
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
      /* Los números van al PIN solo si no se está escribiendo el motivo: un
         "descuento del 10" no puede terminar como parte del PIN. */
      const escribiendo = document.activeElement?.tagName === 'INPUT';
      if (pidePin && !escribiendo && /^[0-9]$/.test(e.key)) setPin((p) => (p + e.key).slice(0, 8));
      if (pidePin && !escribiendo && e.key === 'Backspace') setPin((p) => p.slice(0, -1));
      if (e.key === 'Enter' && (!pidePin || pin.length >= 4)) confirmar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-center justify-center" onClick={onCancelar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[360px] bg-white rounded-2xl p-5 space-y-3"
      >
        <div>
          <p className="text-[15px] font-black">{titulo}</p>
          <p className="text-[12px] text-slate-400">{detalle}</p>
        </div>

        {!sinMotivo && (
          <input
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por qué (obligatorio)"
            className="w-full h-toque px-3 rounded-xl border-2 border-slate-200 text-[13.5px] outline-none focus:border-slate-900"
          />
        )}

        {pidePin ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
              PIN de alguien que pueda hacerlo
            </p>
            <div className="flex gap-2 justify-center py-1">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} className={`w-3.5 h-3.5 rounded-full ${i < pin.length ? 'bg-slate-900' : 'bg-slate-200'}`} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => setPin((p) => (p + d).slice(0, 8))}
                  className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-lg font-bold active:scale-95"
                >
                  {d}
                </button>
              ))}
              <button onClick={() => setPin((p) => p.slice(0, -1))} className="h-12 rounded-xl bg-slate-50 text-slate-500">←</button>
              <button onClick={() => setPin((p) => (p + '0').slice(0, 8))} className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-lg font-bold active:scale-95">0</button>
              <button
                onClick={confirmar}
                disabled={pin.length < 4 || ocupado}
                className="h-12 rounded-xl bg-accion text-sobre-accion text-[12px] font-bold disabled:opacity-30"
              >
                {ocupado ? '…' : 'Autorizar'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={confirmar}
            className="w-full h-12 rounded-xl bg-accion text-sobre-accion text-[13.5px] font-black"
          >
            Confirmar
          </button>
        )}

        {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

        <button onClick={onCancelar} className="w-full h-toque text-[12.5px] font-semibold text-slate-400 hover:text-slate-700">
          Cancelar
        </button>
      </div>
    </div>
  );
}

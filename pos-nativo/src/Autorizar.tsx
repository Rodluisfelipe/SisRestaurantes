import { useEffect, useState } from 'react';
import { autorizar } from './nativo';
import { error as bipError } from './sonido';

/**
 * El supervisor pone su PIN, autoriza y se va.
 *
 * Aparece sobre la caja cuando el cajero intenta anular una línea o poner un
 * descuento a mano. **No cambia la sesión**: el turno sigue siendo del cajero.
 * Si el supervisor quedara logueado, el resto de la tarde se vendería bajo su
 * nombre y la trazabilidad se borraría justo en el turno que se quería vigilar.
 *
 * El motivo se pide en la misma pantalla y es obligatorio. Pedirlo después
 * —"ya lo anoto luego"— significa no pedirlo nunca.
 */
export default function Autorizar({
  titulo,
  detalle,
  onListo,
  onCancelar,
}: {
  titulo: string;
  detalle: string;
  onListo: (motivo: string, autorizo: string) => void;
  onCancelar: () => void;
}) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const confirmar = async () => {
    if (motivo.trim().length < 3) {
      setError('Escribe por qué');
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const quien = await autorizar(pin);
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
      if (/^[0-9]$/.test(e.key)) setPin((p) => (p + e.key).slice(0, 8));
      if (e.key === 'Backspace' && document.activeElement?.tagName !== 'INPUT') {
        setPin((p) => p.slice(0, -1));
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

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

        <input
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por qué (obligatorio)"
          className="w-full h-toque px-3 rounded-xl border-2 border-slate-200 text-[13.5px] outline-none focus:border-marca"
        />

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
            PIN de un supervisor
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

        {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

        <button onClick={onCancelar} className="w-full h-toque text-[12.5px] font-semibold text-slate-400 hover:text-slate-700">
          Cancelar
        </button>
      </div>
    </div>
  );
}

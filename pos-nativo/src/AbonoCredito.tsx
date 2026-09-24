import { useEffect, useRef, useState } from 'react';
import { pesos, registrarAbono, type Abono, type Cliente } from './nativo';

const MEDIOS = [
  ['efectivo', 'Efectivo'],
  ['tarjeta', 'Tarjeta'],
  ['transferencia', 'Transferencia'],
] as const;

/**
 * Recibir un abono de un cliente que debe.
 *
 * En efectivo la plata entra a la gaveta —la caja la anota como entrada, o el
 * arqueo saldría con sobrante— y sale un comprobante con lo que queda
 * debiendo. No se deja abonar más de lo que debe.
 */
export default function AbonoCredito({
  cliente,
  onListo,
  onCancelar,
}: {
  cliente: Cliente;
  onListo: (a: Abono) => void;
  onCancelar: () => void;
}) {
  const debe = cliente.saldo_credito ?? 0;
  const [monto, setMonto] = useState(String(debe));
  const [medio, setMedio] = useState<string>('efectivo');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { campo.current?.select(); }, []);

  const valor = Math.min(parseInt(monto || '0', 10) || 0, debe);

  const confirmar = async () => {
    if (valor <= 0 || ocupado) return;
    setOcupado(true);
    try {
      onListo(await registrarAbono(cliente.id, valor, medio));
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCancelar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
          if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
        }}
        className="w-[400px] bg-white rounded-2xl p-5 space-y-3 shadow-2xl"
      >
        <div>
          <p className="text-[16px] font-black">Abono de {cliente.nombre || 'cliente'}</p>
          <p className="text-[12.5px] text-slate-500">Debe {pesos(debe)}</p>
        </div>
        <input
          ref={campo}
          value={monto}
          onChange={(e) => setMonto(e.target.value.replace(/\D/g, '').slice(0, 9))}
          inputMode="numeric"
          aria-label="Monto del abono"
          className="w-full h-14 px-4 rounded-xl border-2 border-slate-200 text-2xl font-black tabular-nums outline-none focus:border-slate-900"
        />
        <div className="flex gap-1.5">
          {MEDIOS.map(([id, nombre]) => (
            <button
              key={id}
              onClick={() => setMedio(id)}
              className={`flex-1 h-11 rounded-xl text-[12.5px] font-bold border-2 ${
                medio === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500'
              }`}
            >
              {nombre}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-slate-500">
          Queda debiendo <span className="font-bold tabular-nums">{pesos(Math.max(0, debe - valor))}</span>
          {medio === 'efectivo' && ' · entra a la gaveta'}
        </p>
        {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCancelar} className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={valor <= 0 || ocupado}
            className="flex-[2] h-12 rounded-xl bg-accion text-sobre-accion text-[14px] font-black disabled:opacity-30"
          >
            {ocupado ? '…' : `Recibir ${pesos(valor)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { pesos, type Voucher } from './nativo';

/**
 * El voucher del datáfono, copiado a mano.
 *
 * El monto va arriba y enorme porque el cajero lo está digitando **en el
 * datáfono, mirando esta pantalla**: equivocarse ahí es cobrar de más o de
 * menos, y darse cuenta cuando el cliente ya se fue.
 *
 * Los dos campos que se piden no son burocracia: los últimos cuatro emparejan
 * el papel con la venta cuando al cierre sobra o falta un voucher, y el código
 * de aprobación es con lo que el banco responde un reclamo tres semanas
 * después. Sin ellos, el cuadre de tarjetas se hace a ojo.
 */
export default function CobroTarjeta({
  total,
  onListo,
  onCancelar,
}: {
  total: number;
  onListo: (voucher: Voucher) => void;
  onCancelar: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [ultimos, setUltimos] = useState('');
  const [franquicia, setFranquicia] = useState('');
  const [error, setError] = useState('');

  const confirmar = () => {
    if (ultimos.length !== 4) {
      setError('Los últimos cuatro de la tarjeta son cuatro números');
      return;
    }
    if (codigo.trim().length < 4) {
      setError('Copia el código de aprobación del voucher');
      return;
    }
    onListo({
      codigo_autorizacion: codigo.trim(),
      ultimos_cuatro: ultimos,
      franquicia: franquicia.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-center justify-center" onClick={onCancelar}>
      <div onClick={(e) => e.stopPropagation()} className="w-[420px] bg-white rounded-2xl p-5 space-y-4">
        <div className="text-center">
          <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
            Pasa la tarjeta por
          </p>
          <p className="text-5xl font-black tabular-nums mt-1">{pesos(total)}</p>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Últimos 4 de la tarjeta
            </label>
            <input
              autoFocus
              value={ultimos}
              onChange={(e) => setUltimos(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="4582"
              className="w-full h-12 px-3 rounded-xl border-2 border-slate-200 text-center text-2xl font-black tabular-nums tracking-[0.3em] outline-none focus:border-marca"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Código de aprobación
            </label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 20))}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }}
              placeholder="048123"
              className="w-full h-12 px-3 rounded-xl border-2 border-slate-200 text-center text-xl font-bold tracking-wider outline-none focus:border-marca"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Franquicia <span className="font-medium normal-case text-slate-300">· opcional</span>
            </label>
            <div className="flex gap-1.5 mt-1">
              {['Visa', 'Mastercard', 'Amex', 'Débito'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFranquicia(franquicia === f ? '' : f)}
                  className={`flex-1 h-toque rounded-lg text-[12px] font-bold border-2 transition-colors ${
                    franquicia === f ? 'border-marca bg-marca text-sobre-marca' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11.5px] text-slate-400">
          Cópialos del voucher que imprimió el datáfono. Es lo que permite cuadrar
          los pagos con tarjeta al cerrar el turno.
        </p>

        {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onCancelar} className="flex-1 h-12 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            className="flex-1 h-12 rounded-xl bg-marca text-sobre-marca text-[13px] font-bold"
          >
            Cobrado
          </button>
        </div>
      </div>
    </div>
  );
}

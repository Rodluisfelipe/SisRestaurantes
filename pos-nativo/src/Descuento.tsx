import { useEffect, useRef, useState } from 'react';
import { Gift, Percent, Wallet } from 'lucide-react';
import { pesos, type LineaVenta } from './nativo';

/** Los porcentajes que un negocio usa de verdad. */
const PORCENTAJES = [5, 10, 15, 20];

type Forma = 'porcentaje' | 'monto' | 'cortesia';

/**
 * Rebajarle a la cuenta.
 *
 * Tres formas, y las tres terminan en lo mismo: un monto en pesos que Rust le
 * resta al total. Se calcula aquí para que el cajero vea la cifra antes de
 * pedir la autorización —nadie autoriza "un 15%" sin saber cuánto es— pero el
 * descuento no se aplica hasta que un supervisor pone su PIN.
 *
 * La cortesía es un caso aparte y por eso tiene su propio botón: es el 100% de
 * **un** ítem, no de la cuenta, y es lo que se hace cuando un plato salió mal.
 */
export default function Descuento({
  total,
  items,
  onListo,
  onCancelar,
}: {
  total: number;
  items: LineaVenta[];
  /** El monto en pesos y cómo describirlo en la auditoría. */
  onListo: (monto: number, detalle: string) => void;
  onCancelar: () => void;
}) {
  const [forma, setForma] = useState<Forma>('porcentaje');
  const [valor, setValor] = useState('');
  const [cual, setCual] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { campo.current?.focus(); }, [forma]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  const numero = parseInt(valor || '0', 10) || 0;
  const elegido = items[cual];

  /* Redondeado al peso: un 15% de 23.900 da 3.585, y no existe el medio peso.
     Se redondea hacia abajo, a favor del negocio, que es lo que hace cualquier
     caja del mundo con los centavos. */
  const monto =
    forma === 'porcentaje'
      ? Math.floor((total * Math.min(numero, 100)) / 100)
      : forma === 'cortesia'
        ? (elegido ? elegido.precio * elegido.cantidad : 0)
        : Math.min(numero, total);

  const detalle =
    forma === 'porcentaje'
      ? `${Math.min(numero, 100)}% sobre ${pesos(total)}`
      : forma === 'cortesia'
        ? `Cortesía: ${elegido?.nombre ?? ''}`
        : `Monto fijo sobre ${pesos(total)}`;

  const valido = monto > 0 && monto <= total;

  const FORMAS: { id: Forma; nombre: string; icono: typeof Percent }[] = [
    { id: 'porcentaje', nombre: 'Porcentaje', icono: Percent },
    { id: 'monto', nombre: 'Monto fijo', icono: Wallet },
    { id: 'cortesia', nombre: 'Cortesía', icono: Gift },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCancelar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[520px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <div>
          <p className="text-[15px] font-black">Descuento</p>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Un supervisor tendrá que autorizarlo con su PIN.
          </p>
        </div>

        <div className="flex gap-1.5">
          {FORMAS.map(({ id, nombre, icono: Icono }) => (
            <button
              key={id}
              onClick={() => { setForma(id); setValor(''); }}
              className={`flex-1 flex items-center justify-center gap-2 h-toque rounded-xl text-[13px] font-bold border-2 transition-colors ${
                forma === id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <Icono size={16} strokeWidth={2.25} />
              {nombre}
            </button>
          ))}
        </div>

        {forma === 'porcentaje' && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {PORCENTAJES.map((p) => (
                <button
                  key={p}
                  onClick={() => setValor(String(p))}
                  className={`h-toque rounded-xl text-[14px] font-bold border-2 tabular-nums transition-colors ${
                    numero === p
                      ? 'border-marca text-marca'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
            <input
              ref={campo}
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              placeholder="Otro %"
              className="w-full h-toque px-3 rounded-xl border-2 border-slate-200 text-center text-[15px] font-bold tabular-nums outline-none focus:border-marca"
            />
          </div>
        )}

        {forma === 'monto' && (
          <input
            ref={campo}
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Cuánto se rebaja"
            className="w-full h-16 px-4 rounded-xl border-2 border-slate-200 text-center text-3xl font-black tabular-nums outline-none focus:border-marca"
          />
        )}

        {forma === 'cortesia' && (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {items.map((i, k) => (
              <button
                key={k}
                onClick={() => setCual(k)}
                className={`w-full flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-colors ${
                  cual === k ? 'border-marca bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="flex-1 text-[13.5px] font-semibold truncate">
                  {i.cantidad} × {i.nombre}
                  {i.variante ? <span className="text-slate-400"> · {i.variante}</span> : null}
                </span>
                <span className="font-bold tabular-nums text-[13px]">{pesos(i.precio * i.cantidad)}</span>
              </button>
            ))}
          </div>
        )}

        {/* La cifra en pesos, siempre. Nadie autoriza un porcentaje. */}
        <div className="flex items-baseline justify-between px-3 py-2 rounded-xl bg-slate-50">
          <span className="text-[13px] font-bold text-slate-500">Se rebaja</span>
          <span className="text-2xl font-black tabular-nums">{pesos(monto)}</span>
        </div>
        <div className="flex items-baseline justify-between px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800">
          <span className="text-[13px] font-bold">Queda en</span>
          <span className="text-2xl font-black tabular-nums">{pesos(Math.max(0, total - monto))}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="w-32 h-toque rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
          >
            Cancelar
            <span className="block text-[10px] font-semibold text-slate-400">Esc</span>
          </button>
          <button
            onClick={() => onListo(monto, detalle)}
            disabled={!valido}
            className="flex-1 h-toque rounded-xl bg-accion text-sobre-accion text-[13.5px] font-bold disabled:opacity-30"
          >
            Pedir autorización
          </button>
        </div>
      </div>
    </div>
  );
}

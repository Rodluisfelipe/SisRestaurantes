import { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CreditCard, HandCoins, Smartphone, Trash2 } from 'lucide-react';
import { MEDIOS, pesos, repartir, type Medio, type PagoDetalle } from './nativo';

/** Los billetes que existen en Colombia, de mayor a menor. */
const BILLETES = [100_000, 50_000, 20_000, 10_000, 5_000, 2_000];

/** Los porcentajes de propina que se usan de verdad en un restaurante. */
const PROPINAS = [0, 5, 10];

/** Las opciones de propina, con la sugerida del panel si no está ya. */
export function opcionesPropina(sugerida: number): number[] {
  const todas = sugerida > 0 && !PROPINAS.includes(sugerida) ? [...PROPINAS, sugerida] : PROPINAS;
  return [...todas].sort((a, b) => a - b);
}

const ICONO: Record<Medio, typeof Banknote> = {
  efectivo: Banknote,
  tarjeta: CreditCard,
  transferencia: Smartphone,
};

const NOMBRE: Record<Medio, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transfer.',
};

/**
 * Cobrar, con uno o con varios medios.
 *
 * "Treinta mil en efectivo y el resto con tarjeta" es diario en mostrador, y
 * antes no cabía: el cajero tenía que registrar el total en un solo medio, con
 * lo cual la gaveta cuadraba de milagro y el cuadre de tarjetas no cuadraba
 * nunca.
 *
 * El caso de siempre —un solo medio, todo de una— sigue siendo el más rápido:
 * la pantalla abre con el total puesto y el foco en el monto, así que Enter y
 * Enter cobra. Dividir el pago es lo que cuesta un toque más, no al revés.
 *
 * Esta pantalla **no decide nada**: calcula lo que falta para pintarlo, pero
 * quien valida el cobro y el vuelto es Rust al guardar.
 */
export default function CobroMixto({
  total,
  conPropina,
  propinaSugerida = 0,
  opcionSugerida = 10,
  pidiendoVoucher,
  onCambio,
  onMedio,
  onCobrar,
  onCancelar,
}: {
  total: number;
  /** Si el negocio pide propina. Un mostrador de barrio no la pide. */
  conPropina: boolean;
  /** El porcentaje que entra marcado. 0 = ninguno. */
  propinaSugerida?: number;
  /** El porcentaje del panel, para ofrecerlo aunque no entre marcado. */
  opcionSugerida?: number;
  /** Si el datáfono no está integrado, la tarjeta exige voucher a mano. */
  pidiendoVoucher: boolean;
  /** Avisa lo que lleva cobrado, para la pantalla del cliente. */
  onCambio: (pagos: PagoDetalle[]) => void;
  /** Con qué se está por pagar. La pantalla del cliente muestra el QR si es
   *  transferencia y el negocio tiene código configurado. */
  onMedio: (metodo: string) => void;
  onCobrar: (pagos: PagoDetalle[], propina: number) => void;
  onCancelar: () => void;
}) {
  const [pagos, setPagos] = useState<PagoDetalle[]>([]);
  const [metodo, setMetodo] = useState<Medio>('efectivo');
  const [monto, setMonto] = useState('');
  const [referencia, setReferencia] = useState('');
  /* La propina se elige **antes** de cobrar, no después: una vez cobrado no se
     le puede pedir más plata a alguien que ya guardó la billetera. */
  const [propinaPct, setPropinaPct] = useState(conPropina ? propinaSugerida : 0);
  const [propinaOtra, setPropinaOtra] = useState('');
  const campo = useRef<HTMLInputElement>(null);

  /* Redondeada al peso y hacia abajo: la propina es voluntaria, y un peso de
     más es un peso que el cliente no aceptó. */
  const propina = propinaOtra
    ? parseInt(propinaOtra, 10) || 0
    : Math.floor((total * propinaPct) / 100);

  /* Lo que hay que cubrir es la venta más la propina. Rust vuelve a hacer esta
     suma al guardar —es él quien manda— pero la pantalla tiene que pedir la
     cifra correcta desde el primer momento. */
  const aPagar = total + propina;

  const { falta, vuelto } = useMemo(() => repartir(aPagar, pagos), [aPagar, pagos]);

  /* El monto propuesto es siempre lo que falta. En la venta de un solo medio
     eso es el total, así que la pantalla abre lista para cobrar de una. */
  const sugerido = falta;

  useEffect(() => { campo.current?.focus(); }, [pagos.length]);

  /* El cliente ve su saldo bajar en la pantalla de enfrente a medida que el
     cajero registra cada parte. */
  useEffect(() => { onCambio(pagos); }, [pagos, onCambio]);

  /* Y ve el código de cobro en cuanto el cajero elige transferencia, sin
     tener que pedirlo: para cuando el cajero dice "escanea", el cliente ya
     está sacando el teléfono. */
  useEffect(() => { onMedio(metodo); }, [metodo, onMedio]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  const valor = parseInt(monto || '0', 10) || 0;

  const agregar = (cuanto = valor || sugerido) => {
    if (cuanto <= 0) return;
    setPagos((p) => [...p, { metodo, monto: cuanto, referencia: referencia.trim() }]);
    setMonto('');
    setReferencia('');
  };

  /* Cobrar sin haber añadido ninguna línea es el caso normal: se arma una sola
     con lo que haya en pantalla. Obligar a "agregar" y después "cobrar" sería
     un toque de más en la operación que se hace trescientas veces al día. */
  const cobrarYa = () => {
    if (pagos.length === 0) {
      const cuanto = valor || aPagar;
      onCobrar([{ metodo, monto: cuanto, referencia: referencia.trim() }], propina);
      return;
    }
    if (falta > 0 && valor > 0) {
      onCobrar([...pagos, { metodo, monto: valor, referencia: referencia.trim() }], propina);
      return;
    }
    onCobrar(pagos, propina);
  };

  const listo = falta === 0 || (pagos.length === 0 && (valor || aPagar) >= aPagar) || valor >= falta;
  const faltaRef = metodo !== 'efectivo' && pidiendoVoucher && !referencia.trim();

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCancelar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[560px] max-h-[92vh] overflow-y-auto bg-white rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        {/* El total, grande: es la cifra que el cajero le dice al cliente. */}
        <div className="space-y-1">
          {propina > 0 && (
            <>
              <div className="flex items-baseline justify-between text-slate-500">
                <span className="text-[12.5px] font-semibold">Consumo</span>
                <span className="text-[15px] font-bold tabular-nums">{pesos(total)}</span>
              </div>
              <div className="flex items-baseline justify-between text-emerald-700">
                <span className="text-[12.5px] font-semibold">Propina</span>
                <span className="text-[15px] font-bold tabular-nums">{pesos(propina)}</span>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-bold uppercase tracking-wide text-slate-400">
              {propina > 0 ? 'A pagar' : 'Total a cobrar'}
            </span>
            <span className="text-4xl font-black tabular-nums">{pesos(aPagar)}</span>
          </div>
        </div>

        {/* La propina, antes de elegir con qué se paga. Se pregunta una vez y
            se pregunta aquí: después de cobrar ya no se le puede pedir más
            plata a alguien que guardó la billetera. */}
        {conPropina && pagos.length === 0 && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Propina
            </label>
            <div className="flex gap-1.5">
              {opcionesPropina(opcionSugerida).map((p) => {
                const elegido = !propinaOtra && propinaPct === p;
                return (
                  <button
                    key={p}
                    onClick={() => { setPropinaPct(p); setPropinaOtra(''); }}
                    className={`flex-1 h-toque rounded-xl text-[13px] font-bold border-2 tabular-nums transition-colors ${
                      elegido
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {p === 0 ? 'Sin propina' : `${p}%`}
                  </button>
                );
              })}
              <input
                value={propinaOtra}
                onChange={(e) => setPropinaOtra(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="Otro"
                className="w-24 h-toque px-2 rounded-xl border-2 border-slate-200 text-center text-[13px] font-bold tabular-nums outline-none focus:border-marca"
              />
            </div>
          </div>
        )}

        {/* Lo ya cobrado */}
        {pagos.length > 0 && (
          <div className="space-y-1.5">
            {pagos.map((p, i) => {
              const Icono = ICONO[p.metodo as Medio] ?? Banknote;
              return (
                <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                  <Icono size={18} strokeWidth={2.25} className="text-slate-500 flex-shrink-0" />
                  <span className="flex-1 text-[13px] font-semibold">
                    {NOMBRE[p.metodo as Medio] ?? p.metodo}
                    {p.referencia ? <span className="text-slate-400"> · {p.referencia}</span> : null}
                  </span>
                  <span className="font-bold tabular-nums">{pesos(p.monto)}</span>
                  <button
                    onClick={() => setPagos((todos) => todos.filter((_, j) => j !== i))}
                    aria-label="Quitar este pago"
                    className="flex items-center justify-center w-toque h-toque rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} strokeWidth={2.25} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Lo que falta o lo que sobra, que es lo único que el cajero mira */}
        <div
          className={`flex items-baseline justify-between px-3 py-2 rounded-xl ${
            falta > 0 ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          <span className="flex items-center gap-1.5 text-[13px] font-bold">
            {propina > 0 && <HandCoins size={15} strokeWidth={2.25} />}
            {falta > 0 ? 'Falta' : vuelto > 0 ? 'Cambio' : 'Cubierto'}
          </span>
          <span className="text-2xl font-black tabular-nums">
            {falta > 0 ? pesos(falta) : vuelto > 0 ? pesos(vuelto) : pesos(0)}
          </span>
        </div>

        {/* Con qué se paga esta parte */}
        <div className="flex gap-1.5">
          {MEDIOS.map((m) => {
            const Icono = ICONO[m];
            const elegido = metodo === m;
            return (
              <button
                key={m}
                onClick={() => setMetodo(m)}
                className={`flex-1 flex items-center justify-center gap-2 h-toque rounded-xl text-[13px] font-bold border-2 transition-colors ${
                  elegido ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <Icono size={17} strokeWidth={2.25} />
                {NOMBRE[m]}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <input
            ref={campo}
            value={monto}
            onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              /* Enter con el pago completo cobra; con el pago a medias, añade
                 la línea y deja la siguiente lista. Es lo que permite hacer un
                 mixto sin soltar el teclado. */
              if (listo && !faltaRef) cobrarYa();
              else agregar();
            }}
            inputMode="numeric"
            placeholder={sugerido > 0 ? `${sugerido}` : '0'}
            className="w-full h-16 px-4 rounded-xl border-2 border-slate-200 text-center text-3xl font-black tabular-nums outline-none focus:border-marca"
          />

          {/* Los billetes con los que la gente paga. Ahorra teclear. */}
          {metodo === 'efectivo' && (
            <div className="grid grid-cols-3 gap-1.5">
              {BILLETES.filter((b) => b >= sugerido || sugerido === 0).slice(-3).map((b) => (
                <button
                  key={b}
                  onClick={() => setMonto(String(b))}
                  className="h-toque rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 tabular-nums hover:border-slate-300"
                >
                  {pesos(b)}
                </button>
              ))}
              <button
                onClick={() => setMonto(String(sugerido))}
                className="h-toque rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 tabular-nums hover:border-slate-300"
              >
                Justo
              </button>
            </div>
          )}

          {metodo !== 'efectivo' && pidiendoVoucher && (
            <input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value.toUpperCase().slice(0, 20))}
              placeholder="Aprobación del voucher"
              className="w-full h-toque px-3 rounded-xl border-2 border-slate-200 text-[13.5px] font-mono uppercase outline-none focus:border-marca"
            />
          )}
        </div>

        {/* Dividir es el camino largo a propósito: es el caso raro. */}
        {falta > 0 && valor > 0 && valor < falta && (
          <button
            onClick={() => agregar()}
            className="w-full h-toque rounded-xl border-2 border-dashed border-slate-300 text-[13px] font-bold text-slate-500 hover:border-marca hover:text-marca"
          >
            Añadir {pesos(valor)} y seguir con otro medio
          </button>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="w-32 h-16 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
          >
            Cancelar
            <span className="block text-[10px] font-semibold text-slate-400">Esc</span>
          </button>
          <button
            onClick={cobrarYa}
            disabled={!listo || faltaRef}
            className="flex-1 h-16 rounded-xl bg-accion text-sobre-accion text-lg font-black disabled:opacity-30"
          >
            {faltaRef ? 'Falta la aprobación' : falta > 0 && valor === 0 ? `Faltan ${pesos(falta)}` : 'Cobrar'}
            {listo && !faltaRef && <span className="block text-[10px] font-semibold opacity-60">Enter</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Plus, Printer, Receipt, UtensilsCrossed } from 'lucide-react';
import { pesos, type Cuenta } from './nativo';

/** Hace cuánto se sentó, en palabras cortas. */
function desde(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `${horas} h ${minutos % 60} min`;
}

/**
 * El tablero de mesas.
 *
 * Es la pantalla que el mesero mira entre viaje y viaje al salón, así que cada
 * tarjeta responde las tres preguntas que se hace: cuál mesa, cuánto lleva
 * sentada y cuánto va consumiendo.
 *
 * El tiempo se pinta en ámbar pasada la hora y en rojo pasadas las dos: una
 * mesa que lleva dos horas con la cuenta abierta o está esperando que alguien
 * le cobre, o ya se fue.
 */
export default function Cuentas({
  cuentas,
  onAbrir,
  onNueva,
  onPrecuenta,
  onCobrar,
}: {
  cuentas: Cuenta[];
  onAbrir: (c: Cuenta) => void;
  onNueva: (identificador: string) => void;
  onPrecuenta: (c: Cuenta) => void;
  onCobrar: (c: Cuenta) => void;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  /* El reloj de las tarjetas. Sin esto, "hace 5 min" se queda en 5 min toda la
     tarde, que es justo el dato por el que se mira esta pantalla. */
  const [, redibujar] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => redibujar((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (creando) campo.current?.focus(); }, [creando]);

  const crear = () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    onNueva(limpio);
    setNombre('');
    setCreando(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-1">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
        {/* Abrir una mesa nueva es la acción más frecuente del salón, así que
            va primero y no escondida detrás de un botón de la barra. */}
        {creando ? (
          <div className="h-40 p-3 rounded-xl border-2 border-marca bg-white flex flex-col gap-2">
            <input
              ref={campo}
              value={nombre}
              onChange={(e) => setNombre(e.target.value.slice(0, 30))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); crear(); }
                if (e.key === 'Escape') { setCreando(false); setNombre(''); }
              }}
              placeholder="Mesa 3"
              className="w-full h-toque px-3 rounded-xl border-2 border-slate-200 text-[15px] font-bold outline-none focus:border-marca"
            />
            <button
              onClick={crear}
              disabled={!nombre.trim()}
              className="flex-1 rounded-xl bg-accion text-sobre-accion text-[13px] font-bold disabled:opacity-30"
            >
              Abrir cuenta
            </button>
            <button
              onClick={() => { setCreando(false); setNombre(''); }}
              className="h-toque rounded-xl text-[12px] font-semibold text-slate-400"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreando(true)}
            className="h-40 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-marca hover:text-marca active:scale-95 transition-all"
          >
            <Plus size={28} strokeWidth={2} />
            <span className="text-[13px] font-bold">Abrir una cuenta</span>
          </button>
        )}

        {cuentas.map((c) => {
          const minutos = Math.round((Date.now() - new Date(c.creada_en).getTime()) / 60000);
          const color =
            minutos > 120 ? 'text-red-600' : minutos > 60 ? 'text-amber-600' : 'text-slate-400';

          return (
            <div key={c.id} className="h-40 rounded-xl bg-white border border-slate-200 flex flex-col overflow-hidden">
              {/* Tocar la tarjeta lleva al pedido: es lo que se hace nueve de
                  cada diez veces, así que es el objetivo más grande. */}
              <button
                onClick={() => onAbrir(c)}
                className="flex-1 p-3 text-left active:scale-[0.98] transition-transform duration-75"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[16px] font-black truncate">{c.identificador}</span>
                  <span className={`text-[11px] font-bold flex-shrink-0 ${color}`}>{desde(c.creada_en)}</span>
                </div>
                <p className="text-[11.5px] text-slate-400 mt-0.5">
                  {c.items} ítem{c.items === 1 ? '' : 's'}
                </p>
                <p className="text-2xl font-black tabular-nums mt-1">{pesos(c.total)}</p>
              </button>

              <div className="flex border-t border-slate-100">
                <button
                  onClick={() => onAbrir(c)}
                  title="Agregar lo que acaba de pedir"
                  className="flex-1 h-toque flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-marca"
                >
                  <UtensilsCrossed size={17} strokeWidth={2.25} />
                </button>
                <button
                  onClick={() => onPrecuenta(c)}
                  title="Imprimir la precuenta. No cobra ni abre el cajón."
                  className="flex-1 h-toque flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-marca border-l border-slate-100"
                >
                  <Printer size={17} strokeWidth={2.25} />
                </button>
                <button
                  onClick={() => onCobrar(c)}
                  title="Cobrar y cerrar la cuenta"
                  className="flex-1 h-toque flex items-center justify-center bg-accion text-sobre-accion hover:brightness-110"
                >
                  <Receipt size={17} strokeWidth={2.25} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {cuentas.length === 0 && !creando && (
        <p className="text-center text-[13px] text-slate-400 pt-8">
          No hay cuentas abiertas. Las mesas que abras aquí no se cobran hasta el final.
        </p>
      )}
    </div>
  );
}

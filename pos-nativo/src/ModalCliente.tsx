import { useEffect, useRef, useState } from 'react';
import { Delete, Search, Star, UserPlus, X } from 'lucide-react';
import { buscarClientes, crearCliente, pesos, type Cliente } from './nativo';

/**
 * Identificar al cliente en el mostrador, sin frenar la fila.
 *
 * El cliente dice su número o muestra su cédula y tiene que aparecer antes de
 * que termine de decirlo. Eso obliga a dos cosas:
 *
 * - **La búsqueda sale de la copia local** (`clientes_cache` en SQLite), no de
 *   la nube. Con internet lento, consultar al servidor en cada tecla convierte
 *   un gesto de dos segundos en uno de quince, y el cajero deja de usarlo.
 * - **El pad es de pantalla.** Un teclado físico en un mostrador está lleno de
 *   grasa o directamente no existe: casi todos estos equipos son un todo-en-uno
 *   táctil. El campo sigue aceptando el teclado para quien lo tenga.
 *
 * Y el alta exprés pide lo mínimo que sirve: teléfono y nombre. Con la fila
 * esperando, un formulario de seis campos es un formulario que nadie llena, y
 * un cliente a medio registrar vale más que uno que no se registró.
 */

/** Cuántos resultados caben sin que el cajero tenga que leer una lista. */
const MAXIMO = 4;

export default function ModalCliente({
  onElegir,
  onCerrar,
}: {
  onElegir: (c: Cliente) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [hallados, setHallados] = useState<Cliente[]>([]);
  const [registrando, setRegistrando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const campoNombre = useRef<HTMLInputElement>(null);

  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => { if (registrando) campoNombre.current?.focus(); }, [registrando]);

  /* La búsqueda espera a que el tecleo pare, igual que el catálogo. Aquí la
     espera es más corta —40 ms— porque nadie escanea un teléfono: lo teclea, y
     a mano no se pasa de unas ocho pulsaciones por segundo. */
  useEffect(() => {
    if (!texto.trim()) { setHallados([]); return; }
    const id = window.setTimeout(() => {
      buscarClientes(texto).then((c) => setHallados(c.slice(0, MAXIMO))).catch(() => setHallados([]));
    }, 40);
    return () => window.clearTimeout(id);
  }, [texto]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (registrando) setRegistrando(false);
        else onCerrar();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar, registrando]);

  const teclear = (d: string) => {
    setTexto((t) => (t + d).slice(0, 30));
    campo.current?.focus();
  };

  const borrar = () => {
    setTexto((t) => t.slice(0, -1));
    campo.current?.focus();
  };

  const registrar = async () => {
    const tel = texto.trim();
    const nom = nombre.trim();
    if (!tel || !nom || guardando) return;

    setGuardando(true);
    setError('');
    try {
      /* El documento no se pide acá. Quien llega al mostrador dice su número;
         la cédula la da quien necesita factura, y ese caso se atiende en el
         panel con calma, no con cuatro personas esperando. */
      const creado = await crearCliente(tel, nom);
      onElegir(creado);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setGuardando(false);
    }
  };

  /* Si lo tecleado parece un teléfono y no apareció nadie, lo que el cajero
     quiere es registrarlo. Se le ofrece en vez de dejarlo en un vacío. */
  const pareceTelefono = /^\d{7,}$/.test(texto.trim());

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCerrar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[560px] bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 h-14 bg-slate-900 text-white">
          <p className="text-[15px] font-black">
            {registrando ? 'Registrar cliente' : 'Buscar cliente'}
          </p>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex items-center justify-center w-toque h-toque rounded-xl text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {registrando ? (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide">Teléfono</p>
              <p className="text-2xl font-black tabular-nums">{texto.trim()}</p>
            </div>

            <label className="block">
              <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wide">
                ¿A nombre de quién?
              </span>
              <input
                ref={campoNombre}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') registrar(); }}
                placeholder="Nombre del cliente"
                maxLength={80}
                className="mt-1 w-full h-14 px-4 rounded-xl border-2 border-slate-200 text-lg outline-none focus:border-marca"
              />
            </label>

            {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

            <p className="text-[11.5px] text-slate-400">
              Queda guardado en esta caja al instante y sube a MenuBy cuando haya conexión.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setRegistrando(false)}
                className="h-14 px-5 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
              >
                Volver
              </button>
              <button
                onClick={registrar}
                disabled={!nombre.trim() || guardando}
                className="flex-1 h-14 rounded-xl bg-marca text-sobre-marca text-[15px] font-black disabled:opacity-30"
              >
                {guardando ? 'Guardando…' : 'Registrar y usar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="relative">
              <Search
                size={20}
                strokeWidth={2}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                ref={campo}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Teléfono, cédula o nombre"
                maxLength={30}
                className="w-full h-14 pl-12 pr-4 rounded-xl border-2 border-slate-200 text-lg outline-none focus:border-marca"
              />
            </div>

            {/* Los resultados ocupan un alto fijo. Si creciera y se encogiera
                con cada tecla, el pad numérico saltaría debajo del dedo y el
                cajero marcaría el número equivocado. */}
            <div className="h-[216px] space-y-1.5 overflow-hidden">
              {hallados.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onElegir(c)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-left active:scale-[0.98] transition-transform duration-75"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold truncate">{c.nombre || 'Sin nombre'}</p>
                    <p className="text-[11.5px] text-slate-500 tabular-nums">
                      {c.telefono}
                      {c.documento ? ` · ${c.tipo_documento} ${c.documento}` : ''}
                    </p>
                  </div>
                  {c.puntos > 0 && (
                    <span className="flex-shrink-0 flex items-center gap-1 px-2.5 h-8 rounded-lg bg-emerald-50 text-emerald-700 text-[12.5px] font-black tabular-nums">
                      <Star size={13} strokeWidth={2.5} />
                      {c.puntos}
                    </span>
                  )}
                  {c.saldo_favor > 0 && (
                    <span className="flex-shrink-0 px-2.5 h-8 flex items-center rounded-lg bg-sky-50 text-sky-700 text-[12px] font-bold tabular-nums">
                      {pesos(c.saldo_favor)} a favor
                    </span>
                  )}
                </button>
              ))}

              {texto.trim() && hallados.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                  <p className="text-[13px] font-semibold">Nadie con "{texto.trim()}"</p>
                  {pareceTelefono && (
                    <button
                      onClick={() => setRegistrando(true)}
                      className="flex items-center gap-2 h-toque px-4 rounded-xl bg-marca text-sobre-marca text-[13px] font-bold"
                    >
                      <UserPlus size={16} strokeWidth={2.5} />
                      Registrar {texto.trim()}
                    </button>
                  )}
                </div>
              )}

              {!texto.trim() && (
                <div className="h-full flex flex-col items-center justify-center gap-1.5 text-slate-300">
                  <Search size={36} strokeWidth={1.5} />
                  <p className="text-[13px] font-semibold text-slate-400">
                    Teclea el número, la cédula o el nombre
                  </p>
                  <p className="text-[11.5px] text-slate-400">Busca sin internet, en esta misma caja</p>
                </div>
              )}
            </div>

            {/* El pad. Teclas de 56 px: es lo que acierta un pulgar en un
                monitor táctil descalibrado, que es el que hay en un mostrador. */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => teclear(d)}
                  className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 text-xl font-black tabular-nums active:scale-95 transition-transform duration-75"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => setTexto('')}
                className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 text-[13px] font-bold text-slate-500 active:scale-95 transition-transform duration-75"
              >
                Limpiar
              </button>
              <button
                onClick={() => teclear('0')}
                className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 text-xl font-black tabular-nums active:scale-95 transition-transform duration-75"
              >
                0
              </button>
              <button
                onClick={borrar}
                aria-label="Borrar el último dígito"
                className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition-transform duration-75"
              >
                <Delete size={20} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

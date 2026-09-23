import { useEffect, useState } from 'react';
import { Bike, Clock, CloudOff, MapPin, Phone, Printer, ShoppingBag, Store, X } from 'lucide-react';
import { pesos, type PedidoWeb } from './nativo';
import { columnaDe, minutosDesde, PAGO, siguientePaso, TIPO, type Columna } from './reglasPedidosWeb';

/**
 * Los pedidos que entran por el menú, el WhatsApp o el panel.
 *
 * Un tablero de tres columnas —nuevos, preparando, listos— y un botón grande
 * por tarjeta con el siguiente paso. Despachar un pedido son tres toques:
 * Aceptar, Listo, Entregado. Cada toque va a la nube por el mismo camino que
 * el panel, así que el cliente recibe sus avisos igual.
 *
 * Ocupa el centro de la caja, como las mesas: el ticket de la derecha sigue a
 * la vista, porque el cajero puede estar cobrando a alguien en el mostrador
 * mientras entra un domicilio.
 */
export default function PedidosWeb({
  pedidos,
  error,
  onMover,
  onImprimir,
}: {
  pedidos: PedidoWeb[];
  /** Por qué no se pudieron traer, si no se pudieron. */
  error: string;
  onMover: (p: PedidoWeb, estado: string) => Promise<void>;
  onImprimir: (p: PedidoWeb) => Promise<void>;
}) {
  const [ahora, setAhora] = useState(Date.now());
  const [ocupado, setOcupado] = useState('');
  /* Cancelar pide un segundo toque en la misma tarjeta: un pedido cancelado
     le llega al cliente como aviso y no se deshace. */
  const [cancelando, setCancelando] = useState('');
  const [abierto, setAbierto] = useState<PedidoWeb | null>(null);

  // Los minutos de espera avanzan solos.
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const mover = async (p: PedidoWeb, estado: string) => {
    setOcupado(p.id);
    try {
      await onMover(p, estado);
    } finally {
      setOcupado('');
      setCancelando('');
    }
  };

  const columnas: { id: Columna; titulo: string }[] = [
    { id: 'nuevos', titulo: 'Nuevos' },
    { id: 'preparando', titulo: 'Preparando' },
    { id: 'listos', titulo: 'Listos' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-2">
      {error && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[12.5px] font-semibold">
          <CloudOff size={16} strokeWidth={2.25} />
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-3 gap-2">
        {columnas.map((c) => {
          const lista = pedidos.filter((p) => columnaDe(p.estado) === c.id);
          return (
            <div key={c.id} className="flex flex-col min-h-0 rounded-xl bg-slate-200/60 p-2 gap-2">
              <div className="flex-shrink-0 flex items-center justify-between px-1">
                <span className="text-[12px] font-black uppercase tracking-wide text-slate-500">{c.titulo}</span>
                <span className="text-[12px] font-black tabular-nums text-slate-500">{lista.length}</span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {lista.length === 0 && (
                  <p className="text-center text-[12px] text-slate-400 py-6">
                    {c.id === 'nuevos' ? 'Sin pedidos por aceptar' : 'Nada aquí'}
                  </p>
                )}

                {lista.map((p) => {
                  const paso = siguientePaso(p);
                  const espera = minutosDesde(p.creado, ahora);
                  const Icono = p.tipo === 'delivery' ? Bike : p.tipo === 'inSite' ? Store : ShoppingBag;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl bg-white border-2 p-2.5 space-y-1.5 ${
                        c.id === 'nuevos' ? 'border-amber-400' : 'border-transparent'
                      }`}
                    >
                      <button onClick={() => setAbierto(p)} className="w-full text-left space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[15px] font-black tabular-nums">#{p.numero}</span>
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-[10.5px] font-bold text-slate-600">
                            <Icono size={12} strokeWidth={2.5} />
                            {p.tipo === 'inSite' && p.mesa ? `Mesa ${p.mesa}` : TIPO[p.tipo] ?? p.tipo}
                          </span>
                          <span className={`ml-auto flex items-center gap-1 text-[11px] font-bold tabular-nums ${
                            espera >= 20 ? 'text-red-600' : espera >= 10 ? 'text-amber-600' : 'text-slate-400'
                          }`}>
                            <Clock size={12} strokeWidth={2.5} />
                            {espera} min
                          </span>
                        </div>
                        {p.cliente && <p className="text-[12.5px] font-semibold truncate">{p.cliente}</p>}
                        <p className="text-[11.5px] text-slate-500 leading-snug line-clamp-2">
                          {p.items.map((i) => `${i.cantidad} ${i.nombre}`).join(', ')}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-500">
                            {PAGO[p.metodo_pago] ?? p.metodo_pago}
                            {p.estado === 'pending_payment' && ' · esperando pago'}
                            {p.estado === 'payment_uploaded' && ' · revisar comprobante'}
                          </span>
                          <span className="text-[14px] font-black tabular-nums">{pesos(p.total)}</span>
                        </div>
                      </button>

                      <div className="flex gap-1.5">
                        {paso && (
                          <button
                            onClick={() => mover(p, paso.estado)}
                            disabled={ocupado === p.id}
                            className="flex-1 h-11 rounded-lg bg-accion text-sobre-accion text-[13px] font-black disabled:opacity-40 active:scale-95 transition-transform duration-75"
                          >
                            {ocupado === p.id ? '…' : paso.etiqueta}
                          </button>
                        )}
                        <button
                          onClick={() => onImprimir(p)}
                          title="Imprimir tirilla y comanda"
                          aria-label="Imprimir"
                          className="flex items-center justify-center w-11 h-11 rounded-lg border-2 border-slate-200 text-slate-500"
                        >
                          <Printer size={16} strokeWidth={2.25} />
                        </button>
                        <button
                          onClick={() => (cancelando === p.id ? mover(p, 'cancelled') : setCancelando(p.id))}
                          disabled={ocupado === p.id}
                          title="Cancelar el pedido"
                          className={`flex items-center justify-center h-11 rounded-lg border-2 text-[12px] font-bold ${
                            cancelando === p.id
                              ? 'px-3 border-red-500 bg-red-500 text-white'
                              : 'w-11 border-slate-200 text-slate-400'
                          }`}
                        >
                          {cancelando === p.id ? '¿Cancelar?' : <X size={16} strokeWidth={2.5} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {abierto && <Detalle pedido={abierto} onCerrar={() => setAbierto(null)} />}
    </div>
  );
}

/** Todo el pedido: lo que la tarjeta resume. */
function Detalle({ pedido: p, onCerrar }: { pedido: PedidoWeb; onCerrar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCerrar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[480px] max-h-[88vh] overflow-y-auto bg-white rounded-2xl p-5 space-y-3 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <p className="text-xl font-black">Pedido #{p.numero}</p>
          <button onClick={onCerrar} aria-label="Cerrar" className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-1 text-[13px]">
          <p className="font-bold">{TIPO[p.tipo] ?? p.tipo}{p.mesa ? ` · Mesa ${p.mesa}` : ''}</p>
          {p.cliente && <p className="font-semibold">{p.cliente}</p>}
          {p.telefono && <p className="flex items-center gap-1.5 text-slate-600"><Phone size={13} /> {p.telefono}</p>}
          {p.direccion && <p className="flex items-center gap-1.5 text-slate-600"><MapPin size={13} /> {p.direccion}</p>}
        </div>

        <div className="border-t border-slate-200 pt-2 space-y-1.5">
          {p.items.map((i, n) => (
            <div key={n}>
              <div className="flex justify-between text-[13px] font-semibold">
                <span>{i.cantidad} × {i.nombre}{i.variante ? ` (${i.variante})` : ''}</span>
                <span className="tabular-nums">{i.regalo ? 'GRATIS' : pesos(i.precio * i.cantidad)}</span>
              </div>
              {i.extras.length > 0 && (
                <p className="text-[11.5px] text-slate-500 pl-4">{i.extras.join(', ')}</p>
              )}
            </div>
          ))}
        </div>

        {p.notas && (
          <p className="p-2.5 rounded-lg bg-amber-50 text-amber-800 text-[12.5px] font-semibold">{p.notas}</p>
        )}

        <div className="border-t border-slate-200 pt-2 space-y-1 text-[13px]">
          {p.envio > 0 && (
            <div className="flex justify-between text-slate-500"><span>Domicilio</span><span className="tabular-nums">{pesos(p.envio)}</span></div>
          )}
          <div className="flex justify-between text-lg font-black"><span>Total</span><span className="tabular-nums">{pesos(p.total)}</span></div>
          <p className="text-slate-500">
            Pago: {PAGO[p.metodo_pago] ?? (p.metodo_pago || 'sin definir')}
            {p.comprobante ? ' · subió comprobante (revísalo en el panel)' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

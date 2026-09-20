import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { pesos, type EstadoCliente } from './nativo';

/**
 * Lo que ve el cliente desde el otro lado del mostrador.
 *
 * Está escrita para leerse **de pie, a un metro y medio y de reojo**, no para
 * mirarse con atención: tipografía enorme, contraste alto, y una sola cosa
 * importante por estado. Todo lo que no sea el total o el cambio es secundario.
 *
 * No tiene botones. El cliente no interactúa: mira. Cualquier control aquí
 * sería algo que alguien va a tocar por curiosidad mientras el cajero cobra.
 */
export default function PantallaCliente() {
  const [estado, setEstado] = useState<EstadoCliente>({ modo: 'espera', negocio: 'MenuBy' });

  useEffect(() => {
    const suelta = listen<EstadoCliente>('cliente:estado', (e) => setEstado(e.payload));
    return () => { suelta.then((f) => f()); };
  }, []);

  if (estado.modo === 'espera') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <p className="text-5xl font-black tracking-tight">{estado.negocio || 'Bienvenido'}</p>
        <p className="text-xl text-slate-400">{estado.mensaje || 'Con gusto te atendemos'}</p>
      </div>
    );
  }

  if (estado.modo === 'gracias') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-emerald-600 text-white gap-3">
        <p className="text-5xl font-black">¡Gracias por tu compra!</p>
        {/* El cambio, gigante: es lo único que el cliente necesita verificar. */}
        {(estado.vuelto ?? 0) > 0 && (
          <>
            <p className="text-2xl text-emerald-100 mt-4">Tu cambio</p>
            <p className="text-7xl font-black tabular-nums">{pesos(estado.vuelto || 0)}</p>
          </>
        )}
      </div>
    );
  }

  const items = estado.items || [];

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white">
      <div className="px-8 py-4 border-b border-slate-800">
        <p className="text-xl font-black tracking-tight">{estado.negocio || 'MenuBy'}</p>
      </div>

      {/* La lista crece hacia abajo y lo último marcado queda abajo del todo,
          que es donde el ojo del cliente ya está mirando. */}
      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-2">
        {items.map((i, k) => (
          <div
            key={k}
            className={`flex items-baseline gap-4 ${k === items.length - 1 ? 'text-white' : 'text-slate-400'}`}
          >
            <span className="text-2xl font-bold tabular-nums w-12">{i.cantidad}</span>
            <span className="flex-1 text-2xl truncate">{i.nombre}</span>
            <span className="text-2xl font-bold tabular-nums">{pesos(i.total)}</span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-2xl text-slate-500 text-center pt-10">Tu pedido aparecerá aquí</p>
        )}
      </div>

      <div className="px-8 py-6 bg-white text-slate-900">
        <div className="flex items-end justify-between">
          <span className="text-2xl font-semibold text-slate-500">Total</span>
          <span className="text-7xl font-black tabular-nums leading-none">{pesos(estado.total || 0)}</span>
        </div>

        {estado.modo === 'pago' && (estado.recibido ?? 0) > 0 && (
          <div className="mt-4 flex items-end justify-between text-slate-500">
            <span className="text-xl">Recibido {pesos(estado.recibido || 0)}</span>
            <span className="text-3xl font-black tabular-nums text-slate-900">
              Cambio {pesos(estado.vuelto || 0)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

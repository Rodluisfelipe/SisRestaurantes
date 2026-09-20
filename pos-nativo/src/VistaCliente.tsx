import { QRCodeSVG } from 'qrcode.react';
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
 *
 * ## Por qué es un componente y no una pantalla
 *
 * Vive en dos sitios a la vez: en la ventana del segundo monitor, cuando el
 * local tiene uno, y **dentro de la caja** cuando no. La mayoría de los
 * negocios pequeños tienen una sola pantalla, y ahí el cajero gira el monitor
 * un momento para que el cliente vea su cuenta o escanee el código.
 *
 * Que sea el mismo componente no es economía de código: es que lo que el
 * cliente ve tiene que ser idéntico en los dos casos. Dos copias derivarían, y
 * el día que una mostrara un total distinto de la otra nadie sabría cuál creer.
 */
export default function VistaCliente({ estado }: { estado: EstadoCliente }) {
  /* Cobro por transferencia: el código ocupa la pantalla entera.

     El monto va **al lado y enorme** porque la mayoría de los códigos de un
     negocio colombiano son estáticos: no llevan el valor dentro, y el cliente
     lo tiene que digitar en su app. Esconder esa cifra o ponerla pequeña es
     garantizar que alguien pague 4.500 en vez de 45.000. */
  if (estado.qr) {
    return (
      <div className="h-full flex items-center justify-center bg-white text-slate-900 gap-10 px-10">
        <div className="flex-shrink-0 p-5 bg-white rounded-3xl border-4 border-slate-900">
          {/* Corrección de errores media: un código de pago tiene que leerse
              con la pantalla sucia o con reflejo, que es como está siempre un
              monitor de mostrador. */}
          <QRCodeSVG value={estado.qr} size={320} level="M" marginSize={0} />
        </div>

        <div className="min-w-0">
          <p className="text-3xl font-semibold text-slate-500">Escanea y paga</p>

          {estado.qr_con_monto ? (
            <>
              <p className="text-8xl font-black tabular-nums leading-none mt-3">
                {pesos(estado.total || 0)}
              </p>
              <p className="text-2xl text-slate-500 mt-4">El valor ya va en el código.</p>
            </>
          ) : (
            <>
              {/* Cuando el código no lleva el monto, esto deja de ser
                  informativo y pasa a ser una instrucción. */}
              <p className="text-2xl font-bold text-amber-600 mt-3">Digita este valor en tu app</p>
              <p className="text-8xl font-black tabular-nums leading-none mt-1">
                {pesos(estado.total || 0)}
              </p>
            </>
          )}

          <p className="text-xl text-slate-400 mt-6">{estado.negocio}</p>
        </div>
      </div>
    );
  }

  if (estado.modo === 'espera') {
    /* En reposo, la pantalla entera es del color del negocio: es un letrero en
       el mostrador la mayor parte del día, y un rectángulo gris oscuro no dice
       de quién es el local. */
    return (
      <div className="h-full flex flex-col items-center justify-center bg-marca text-sobre-marca gap-4">
        <p className="text-6xl font-black tracking-tight text-center px-8">
          {estado.negocio || 'Bienvenido'}
        </p>
        <p className="text-xl opacity-70">{estado.mensaje || 'Con gusto te atendemos'}</p>
      </div>
    );
  }

  if (estado.modo === 'gracias') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-emerald-600 text-white gap-3">
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
    <div className="h-full flex flex-col bg-slate-900 text-white">
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

        {/* Mientras se está pagando por partes, lo que el cliente necesita ver
            es cuánto le falta, no cuánto lleva entregado. Pagar cincuenta mil
            en dos veces sin ver el saldo bajar es pedirle que confíe, y esta
            pantalla existe justamente para que no tenga que hacerlo. */}
        {estado.modo === 'pago' && (estado.falta ?? 0) > 0 && (
          <div className="mt-4 flex items-end justify-between">
            <span className="text-xl text-slate-500">Entregado {pesos(estado.recibido || 0)}</span>
            <span className="text-5xl font-black tabular-nums text-amber-600">
              Falta {pesos(estado.falta || 0)}
            </span>
          </div>
        )}

        {estado.modo === 'pago' && (estado.falta ?? 0) === 0 && (estado.recibido ?? 0) > 0 && (
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

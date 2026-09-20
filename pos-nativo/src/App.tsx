import { useEffect, useMemo, useRef, useState } from 'react';
import {
  abrirCajon, abrirPantallaCliente, anularItem, catalogo, cerrarPantallaCliente, cobrar,
  descartarPausada, enTauri, estadoSync, hayPantallaCliente, listarPausadas, mostrarAlCliente,
  pausarVenta, pesos, retomarVenta, salir, sincronizar, turnoActivo,
  type CierreTurno, type Cobro, type EnEspera, type LineaVenta, type Producto, type Turno, type Usuario,
} from './nativo';
import PantallaPin from './PantallaPin';
import Autorizar from './Autorizar';
import { AbrirTurno, PanelTurno, ResumenCierre } from './Turno';

/** A los 90 segundos sin tocar nada, la caja se bloquea sola. */
const INACTIVIDAD_MS = 90_000;

/**
 * La caja.
 *
 * Está pensada para un cajero de pie con gente esperando, no para un mouse:
 *
 * - El foco vive en la búsqueda. Un escáner de códigos de barras es un teclado
 *   que escribe rápido y manda Enter, así que escanear "simplemente funciona"
 *   sin conectar nada.
 * - F2 cobra. Sin soltar el teclado.
 * - Nada bloquea la pantalla esperando a la nube: la venta se guarda local y
 *   la barra de arriba dice cuántas faltan por subir.
 */
/**
 * Quién manda en la pantalla.
 *
 * El orden no es decorativo: sin PIN no hay caja, sin turno no hay ventas. Es
 * lo que hace que cada venta tenga dueño y que un descuadre se le pueda
 * preguntar a alguien.
 */
export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [cierre, setCierre] = useState<CierreTurno | null>(null);
  const [verTurno, setVerTurno] = useState(false);

  // Al entrar con el PIN se mira si ya había un turno abierto (relevo de cajero
  // a media jornada, o la app reabierta después de un apagón).
  useEffect(() => {
    if (!usuario) return;
    turnoActivo().then(setTurno).catch(() => setTurno(null));
  }, [usuario]);

  /* Auto-bloqueo. En un mostrador compartido, un cajero que se va a almorzar
     sin bloquear deja su usuario disponible para que otro cobre a su nombre, y
     el arqueo termina señalando a quien no fue. */
  useEffect(() => {
    if (!usuario) return;
    let reloj: number;
    const reiniciar = () => {
      window.clearTimeout(reloj);
      reloj = window.setTimeout(() => { salir(); setUsuario(null); setVerTurno(false); }, INACTIVIDAD_MS);
    };
    const eventos = ['keydown', 'pointerdown', 'wheel'];
    eventos.forEach((e) => window.addEventListener(e, reiniciar));
    reiniciar();
    return () => {
      window.clearTimeout(reloj);
      eventos.forEach((e) => window.removeEventListener(e, reiniciar));
    };
  }, [usuario]);

  if (cierre) {
    return <ResumenCierre cierre={cierre} onListo={() => { setCierre(null); setTurno(null); setUsuario(null); }} />;
  }
  if (!usuario) {
    return <PantallaPin onEntrar={setUsuario} />;
  }
  if (!turno) {
    return <AbrirTurno usuario={usuario} onAbierto={setTurno} />;
  }

  return (
    <Caja
      usuario={usuario}
      turno={turno}
      verTurno={verTurno}
      setVerTurno={setVerTurno}
      onCerrado={(c) => { setVerTurno(false); setCierre(c); }}
      onBloquear={() => { salir(); setUsuario(null); setVerTurno(false); }}
    />
  );
}

function Caja({
  usuario,
  turno,
  verTurno,
  setVerTurno,
  onCerrado,
  onBloquear,
}: {
  usuario: Usuario;
  turno: Turno;
  verTurno: boolean;
  setVerTurno: (v: boolean) => void;
  onCerrado: (c: CierreTurno) => void;
  onBloquear: () => void;
}) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState<LineaVenta[]>([]);
  const [recibido, setRecibido] = useState('');
  const [cobrando, setCobrando] = useState(false);
  const [ultimo, setUltimo] = useState<Cobro | null>(null);
  const [cola, setCola] = useState({ pendientes: 0, apartadas: 0 });
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [enEspera, setEnEspera] = useState<EnEspera[]>([]);
  const [verEspera, setVerEspera] = useState(false);
  /* La línea que el cajero quiere quitar. Mientras esté aquí, la caja está
     esperando el PIN de un supervisor: quitarla sin autorización es el vector
     número uno de robo hormiga. */
  const [anulando, setAnulando] = useState<{ indice: number; linea: LineaVenta } | null>(null);
  const [conCliente, setConCliente] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);

  useEffect(() => { hayPantallaCliente().then(setConCliente).catch(() => {}); }, []);

  const refrescarEspera = () => listarPausadas().then(setEnEspera).catch(() => {});
  useEffect(() => { refrescarEspera(); }, []);

  useEffect(() => {
    catalogo(busqueda).then(setProductos).catch(() => setProductos([]));
  }, [busqueda]);

  /* La barra se refresca sola: el hilo de Rust sube en segundo plano y esto
     solo mira el resultado. Nunca dispara la subida, para que la pantalla no
     dependa de la red. */
  useEffect(() => {
    const mirar = () => estadoSync().then(setCola).catch(() => {});
    mirar();
    const id = setInterval(mirar, 15000);
    return () => clearInterval(id);
  }, [ultimo]);

  const subirAhora = async () => {
    setSubiendo(true);
    try {
      const r = await sincronizar();
      setError(r.error ?? '');
      setCola(await estadoSync());
    } finally {
      setSubiendo(false);
    }
  };

  const total = useMemo(
    () => carrito.reduce((t, i) => t + i.precio * i.cantidad, 0),
    [carrito],
  );
  const vuelto = Math.max(0, (parseInt(recibido || '0', 10) || 0) - total);

  /* Lo que se marca aparece al instante del otro lado del mostrador. Es lo que
     evita el "yo no pedí eso" cuando ya está cobrado: el cliente ve su pedido
     mientras se arma, no después. */
  useEffect(() => {
    const recibidoNum = parseInt(recibido || '0', 10) || 0;
    mostrarAlCliente({
      modo: carrito.length === 0 ? 'espera' : recibidoNum > 0 ? 'pago' : 'venta',
      negocio: 'MenuBy',
      items: carrito.map((i) => ({
        nombre: `${i.nombre}${i.variante ? ` · ${i.variante}` : ''}`,
        cantidad: i.cantidad,
        total: i.precio * i.cantidad,
      })),
      total,
      recibido: recibidoNum,
      vuelto,
    });
  }, [carrito, recibido, total, vuelto]);

  const agregar = (p: Producto) => {
    setCarrito((c) => {
      const i = c.findIndex((x) => x.producto_id === p.id && x.variante === p.variante);
      if (i >= 0) {
        const copia = [...c];
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
        return copia;
      }
      return [...c, {
        producto_id: p.id, nombre: p.nombre, variante: p.variante,
        precio: p.precio, cantidad: 1,
      }];
    });
    // El foco vuelve al buscador siempre: el siguiente escaneo tiene que entrar.
    buscador.current?.focus();
  };

  /* Bajar de 1 es quitar la línea, y quitar una línea ya marcada necesita
     supervisor. Subir o bajar dentro de lo marcado, no: en hora pico eso sería
     insostenible. */
  const cambiarCantidad = (indice: number, delta: number) => {
    const linea = carrito[indice];
    if (delta < 0 && linea.cantidad <= 1) {
      setAnulando({ indice, linea });
      return;
    }
    setCarrito((c) => c.map((x, i) => (i === indice ? { ...x, cantidad: x.cantidad + delta } : x)));
  };

  const confirmarAnulacion = async (motivo: string, autorizo: string) => {
    if (!anulando) return;
    const { indice, linea } = anulando;
    try {
      await anularItem(
        `${linea.nombre}${linea.variante ? ` (${linea.variante})` : ''} x${linea.cantidad}`,
        linea.precio * linea.cantidad,
        motivo,
        autorizo,
      );
      setCarrito((c) => c.filter((_, i) => i !== indice));
    } catch (e) {
      setError(String(e));
    } finally {
      setAnulando(null);
      buscador.current?.focus();
    }
  };

  /* Pausar: el carrito se va a disco y la pantalla queda limpia en el mismo
     gesto. El cliente que buscaba la plata no puede frenar a los cuatro que
     tiene detrás. */
  const pausar = async () => {
    if (!carrito.length) return;
    const etiqueta = `${carrito[0].nombre}${carrito.length > 1 ? ` +${carrito.length - 1}` : ''}`;
    try {
      await pausarVenta(carrito, etiqueta, total);
      setCarrito([]);
      setRecibido('');
      await refrescarEspera();
    } catch (e) {
      setError(String(e));
    } finally {
      buscador.current?.focus();
    }
  };

  const retomar = async (id: string) => {
    const guardado = await retomarVenta(id);
    if (guardado) {
      // Lo que hubiera en pantalla se aparta también: nada se pierde por retomar.
      if (carrito.length) {
        const etiqueta = `${carrito[0].nombre}${carrito.length > 1 ? ` +${carrito.length - 1}` : ''}`;
        await pausarVenta(carrito, etiqueta, total);
      }
      setCarrito(guardado);
    }
    setVerEspera(false);
    await refrescarEspera();
    buscador.current?.focus();
  };

  const descartar = async (p: EnEspera) => {
    const motivo = window.prompt(`¿Por qué se descarta "${p.etiqueta}" (${pesos(p.total)})?`);
    if (!motivo) return;
    await descartarPausada(p.id, motivo);
    await refrescarEspera();
  };

  const finalizar = async () => {
    if (!carrito.length || cobrando) return;
    setCobrando(true);
    setError('');
    try {
      /* `cajero` y `turno_id` los rellena el lado nativo con la sesión real:
         si vinieran de aquí, bastaría abrir las herramientas del webview para
         firmar una venta a nombre de otro. */
      const r = await cobrar({
        items: carrito,
        medio_pago: 'efectivo',
        recibido: parseInt(recibido || '0', 10) || 0,
        cajero: '',
        turno_id: '',
        iva_porcentaje: 0,
      });
      setUltimo(r);
      setCarrito([]);
      setRecibido('');
      refrescarEspera();

      /* El cambio, gigante y del otro lado: es lo que el cliente está a punto
         de contar con la mano. Vuelve a la pantalla de espera solo después. */
      mostrarAlCliente({ modo: 'gracias', negocio: 'MenuBy', vuelto: r.venta.vuelto });
      window.setTimeout(() => mostrarAlCliente({ modo: 'espera', negocio: 'MenuBy' }), 8000);
    } catch (e) {
      setError(String(e));
    } finally {
      setCobrando(false);
      buscador.current?.focus();
    }
  };

  /* F2 cobra y Escape limpia. Se escucha en la ventana y no en un botón para
     que funcione sin importar dónde esté el foco. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); finalizar(); }
      if (e.key === 'F4') { e.preventDefault(); pausar(); }
      if (e.key === 'Escape') { setCarrito([]); setRecibido(''); setError(''); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  /* Enter en el buscador agrega el primer resultado: es lo que hace el escáner
     al terminar de leer un código. */
  const enterEnBusqueda = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !productos.length) return;
    agregar(productos[0]);
    setBusqueda('');
  };

  return (
    <div className="relative h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Barra: lo único que el negocio necesita saber de un vistazo */}
      <header className="flex items-center gap-3 px-4 h-12 bg-slate-900 text-white flex-shrink-0">
        <span className="font-black tracking-tight">MenuBy POS</span>
        <button
          onClick={() => setVerTurno(!verTurno)}
          title="Turno, movimientos de efectivo y cierre"
          className="text-[12px] font-semibold px-2.5 h-7 rounded-lg bg-slate-700 hover:bg-slate-600"
        >
          {usuario.nombre}
          {usuario.rol === 'supervisor' ? ' ·' : ''}
        </button>
        {!enTauri && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-400 text-amber-950">
            modo navegador · no cobra de verdad
          </span>
        )}
        {/* Lo único que el negocio necesita saber de la nube, en dos palabras. */}
        <button
          onClick={subirAhora}
          disabled={subiendo}
          title="Subir ahora lo pendiente"
          className="ml-auto text-[12px] text-slate-300 hover:text-white disabled:opacity-50"
        >
          {subiendo
            ? 'Sincronizando…'
            : cola.pendientes > 0
              ? `${cola.pendientes} venta(s) por subir`
              : 'Todo sincronizado'}
        </button>
        {enEspera.length > 0 && (
          <button
            onClick={() => setVerEspera(true)}
            className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-400 text-amber-950"
          >
            {enEspera.length} en espera
          </button>
        )}
        {cola.apartadas > 0 && (
          <span
            title="La nube rechazó estas ventas. Están guardadas, pero necesitan revisión."
            className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-500 text-white"
          >
            {cola.apartadas} sin subir
          </span>
        )}
        <button
          onClick={async () => {
            try {
              if (conCliente) {
                await cerrarPantallaCliente();
                setConCliente(false);
              } else {
                await abrirPantallaCliente();
                setConCliente(true);
              }
              setError('');
            } catch (e) {
              // Sin segunda pantalla no pasa nada: se avisa y la caja sigue igual.
              setError(String(e).replace(/^Error:\s*/, ''));
            }
          }}
          title="Mostrar el pedido en la pantalla del cliente"
          className={`text-[12px] font-semibold px-3 h-8 rounded-lg ${
            conCliente ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          Pantalla cliente
        </button>
        <button
          onClick={() => {
            const motivo = window.prompt('¿Para qué se abre la gaveta?');
            if (motivo) abrirCajon(motivo);
          }}
          title="Queda registrado quién la abre y para qué"
          className="text-[12px] font-semibold px-3 h-8 rounded-lg bg-slate-700 hover:bg-slate-600"
        >
          Abrir cajón
        </button>
      </header>

      {anulando && (
        <Autorizar
          titulo="Quitar del pedido"
          detalle={`${anulando.linea.nombre} · ${pesos(anulando.linea.precio * anulando.linea.cantidad)}`}
          onListo={confirmarAnulacion}
          onCancelar={() => setAnulando(null)}
        />
      )}

      {verEspera && (
        <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center" onClick={() => setVerEspera(false)}>
          <div className="w-[460px] max-h-[70vh] overflow-y-auto bg-white rounded-2xl p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-black">Ventas en espera</p>
            {enEspera.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold truncate">{p.etiqueta}</p>
                  <p className="text-[11.5px] text-slate-400">
                    {new Date(p.creada_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{p.items} ítem(s) · {pesos(p.total)}
                  </p>
                </div>
                <button onClick={() => descartar(p)} className="h-9 px-3 rounded-lg text-[12px] font-semibold text-slate-400 hover:text-red-600">
                  Descartar
                </button>
                <button onClick={() => retomar(p.id)} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[12.5px] font-bold">
                  Retomar
                </button>
              </div>
            ))}
            {enEspera.length === 0 && <p className="text-[13px] text-slate-400 py-4 text-center">Nada en espera</p>}
          </div>
        </div>
      )}

      {verTurno && (
        <div className="absolute inset-0 z-20 bg-black/40 flex justify-end" onClick={() => setVerTurno(false)}>
          <div className="w-[380px] bg-white h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <PanelTurno turno={turno} onCerrado={onCerrado} onSalir={onBloquear} />
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Catálogo */}
        <section className="flex-1 flex flex-col min-w-0 p-4 gap-3">
          <input
            ref={buscador}
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={enterEnBusqueda}
            placeholder="Busca o escanea un producto…"
            className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 bg-white text-lg outline-none focus:border-slate-900"
          />

          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            {productos.map((p) => (
              <button
                key={p.id + p.variante}
                onClick={() => agregar(p)}
                className="h-24 p-3 rounded-xl bg-white border border-slate-200 text-left hover:border-slate-900 active:scale-[0.98] transition-all flex flex-col justify-between"
              >
                <span className="text-[13px] font-semibold leading-tight line-clamp-2">
                  {p.nombre}{p.variante ? ` · ${p.variante}` : ''}
                </span>
                <span className="text-[15px] font-black tabular-nums">{pesos(p.precio)}</span>
              </button>
            ))}
            {productos.length === 0 && (
              <p className="col-span-full text-center text-slate-400 py-10 text-sm">
                Sin productos. El catálogo se replica desde la nube a la base local.
              </p>
            )}
          </div>
        </section>

        {/* Carrito */}
        <aside className="w-[380px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {carrito.map((i, indice) => (
              <div key={i.producto_id + i.variante} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{i.nombre}</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">{pesos(i.precio)} c/u</p>
                </div>
                <button onClick={() => cambiarCantidad(indice, -1)} className="w-9 h-9 rounded-lg border border-slate-200 text-lg leading-none">−</button>
                <span className="w-8 text-center font-bold tabular-nums">{i.cantidad}</span>
                <button onClick={() => cambiarCantidad(indice, 1)} className="w-9 h-9 rounded-lg border border-slate-200 text-lg leading-none">+</button>
                <span className="w-20 text-right font-bold tabular-nums text-[13px]">{pesos(i.precio * i.cantidad)}</span>
              </div>
            ))}

            {carrito.length === 0 && ultimo && (
              /* Después de cobrar, lo que el cajero necesita en pantalla es el
                 cambio: es lo que está contando con la mano. */
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-[12px] font-bold text-emerald-700">
                  Venta #{ultimo.venta.consecutivo} · {pesos(ultimo.venta.total)}
                </p>
                {ultimo.venta.vuelto > 0 && (
                  <p className="text-2xl font-black text-emerald-800 tabular-nums">
                    Cambio {pesos(ultimo.venta.vuelto)}
                  </p>
                )}
                {ultimo.impresion && (
                  <p className="mt-1 text-[11.5px] text-amber-700">
                    La venta quedó guardada, pero la tirilla no salió: {ultimo.impresion}
                  </p>
                )}
              </div>
            )}

            {carrito.length === 0 && !ultimo && (
              <p className="text-center text-slate-300 py-10 text-sm">Carrito vacío</p>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-500">Total</span>
              <span className="text-3xl font-black tabular-nums">{pesos(total)}</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={recibido}
                onChange={(e) => setRecibido(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="Recibido"
                className="flex-1 h-11 px-3 rounded-xl border-2 border-slate-200 tabular-nums outline-none focus:border-slate-900"
              />
              <span className="w-28 text-right text-sm font-bold text-slate-500 tabular-nums">
                {vuelto > 0 ? `Cambio ${pesos(vuelto)}` : ''}
              </span>
            </div>

            {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={pausar}
                disabled={!carrito.length}
                title="Aparta este pedido y atiende al siguiente"
                className="w-32 h-14 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 disabled:opacity-30 active:scale-[0.99]"
              >
                En espera
                <span className="block text-[10px] font-semibold text-slate-400">F4</span>
              </button>
              <button
                onClick={finalizar}
                disabled={!carrito.length || cobrando}
                className="flex-1 h-14 rounded-xl bg-slate-900 text-white text-lg font-black disabled:opacity-30 active:scale-[0.99]"
              >
                {cobrando ? 'Cobrando…' : 'Cobrar · F2'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

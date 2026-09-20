import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote, CircleUser, CloudCheck, CloudOff, CreditCard, Inbox, Minus, Monitor,
  PauseCircle, Plus, Printer, RefreshCw, ScanLine, Trash2, Wallet, X,
} from 'lucide-react';
import {
  abrirCajon, abrirPantallaCliente, anularItem, aplicarMarca, catalogo, cerrarPantallaCliente,
  cobrar, descartarPausada, enTauri, estadoSync, hayPantallaCliente, identidad, infoTerminal,
  listarPausadas, mostrarAlCliente, pausarVenta, pesos, reimprimir, retomarVenta, salir,
  sincronizar, turnoActivo,
  type CierreTurno, type Cobro, type EnEspera, type LineaVenta, type Producto, type Turno,
  type Usuario, type Voucher,
} from './nativo';
import ModalMotivo from './ModalMotivo';
import PantallaPin from './PantallaPin';
import CobroTarjeta from './CobroTarjeta';
import Impresoras from './Impresoras';
import Nube from './Nube';
import Autorizar from './Autorizar';
import { AbrirTurno, PanelTurno, ResumenCierre } from './Turno';

/** A los 90 segundos sin tocar nada, la caja se bloquea sola. */
const INACTIVIDAD_MS = 90_000;

/**
 * Un botón de la barra de arriba.
 *
 * Existe para que la altura no vuelva a ser una decisión. Estos botones
 * estaban a 32px porque así la barra se veía más compacta; en un monitor
 * táctil de mostrador —resistivo, descalibrado, operado con el pulgar— 32px es
 * un toque que falla y una pantalla que se toca dos veces. 44 es el mínimo que
 * acierta, y aquí está puesto una vez y no seis.
 *
 * El texto acompaña al icono en vez de sustituirlo: el icono se encuentra de
 * reojo, el texto confirma. Quitarlo ahorraría espacio que no hace falta.
 */
function BotonBarra({
  icono: Icono,
  children,
  activo = false,
  ...resto
}: {
  icono: typeof Printer;
  children: React.ReactNode;
  activo?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...resto}
      className={`flex items-center gap-2 px-3 h-toque rounded-xl text-[12.5px] font-semibold transition-colors ${
        activo ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-700/70 hover:bg-slate-600 text-slate-100'
      } disabled:opacity-40`}
    >
      <Icono size={16} strokeWidth={2.25} className="flex-shrink-0" />
      {children}
    </button>
  );
}

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
  const [negocio, setNegocio] = useState('');

  /* El color del negocio se aplica antes que nada, incluso antes del PIN: la
     primera pantalla de la mañana ya tiene que ser la del negocio y no la de
     un programa genérico. Si la caja nunca ha sincronizado no hay color y se
     queda con el de MenuBy, que es lo correcto: mejor sin personalizar que con
     un botón de cobrar ilegible. */
  useEffect(() => {
    identidad()
      .then((quien) => { aplicarMarca(quien); setNegocio(quien.nombre); })
      .catch(() => {});
  }, []);

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
    return <PantallaPin negocio={negocio} onEntrar={setUsuario} />;
  }
  if (!turno) {
    return <AbrirTurno usuario={usuario} onAbierto={setTurno} />;
  }

  return (
    <Caja
      usuario={usuario}
      negocio={negocio}
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
  negocio,
  turno,
  verTurno,
  setVerTurno,
  onCerrado,
  onBloquear,
}: {
  usuario: Usuario;
  negocio: string;
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
  const [medioPago, setMedioPago] = useState<'efectivo' | 'tarjeta'>('efectivo');
  /* Mientras esto esté puesto, la caja está esperando el voucher del datáfono.
     La venta todavía no existe: primero el banco, después el registro. */
  const [pidiendoVoucher, setPidiendoVoucher] = useState(false);
  const [digitaVoucher, setDigitaVoucher] = useState(true);
  const [verImpresoras, setVerImpresoras] = useState(false);
  const [verNube, setVerNube] = useState(false);
  /* El aviso de que la tirilla no salió. Va como toast y no como bloqueo: la
     venta ya está cobrada y guardada, y el cajero tiene que poder seguir
     atendiendo mientras alguien le pone papel a la impresora. */
  const [falloImpresion, setFalloImpresion] = useState('');
  const [reimprimiendo, setReimprimiendo] = useState(false);
  /* Los dos motivos que antes pedía `window.prompt`. Ahora son estado, porque
     un modal de React se dibuja con el resto de la pantalla y no congela el
     proceso mientras está abierto. */
  const [pidiendoGaveta, setPidiendoGaveta] = useState(false);
  const [descartando, setDescartando] = useState<EnEspera | null>(null);
  /* La línea que acaba de entrar al carrito, para encenderla un momento. Es la
     confirmación de que el toque llegó: sin ella el cajero tiene que leer el
     carrito entero para saber si marcó o no, y en hora pico marca dos veces.

     Lleva un contador además de la clave porque marcar el mismo producto dos
     veces seguidas deja la clave igual, y con solo la clave React no volvería
     a disparar el efecto: la línea se apagaría a los 450 ms del primer toque
     aunque el cajero siguiera marcando. Con el contador, se mantiene encendida
     mientras la toquen y se apaga 450 ms después del último toque. */
  const [recien, setRecien] = useState({ clave: '', vez: 0 });

  useEffect(() => { infoTerminal().then((t) => setDigitaVoucher(t.requiere_digitacion)).catch(() => {}); }, []);
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
      negocio: negocio || 'MenuBy',
      items: carrito.map((i) => ({
        nombre: `${i.nombre}${i.variante ? ` · ${i.variante}` : ''}`,
        cantidad: i.cantidad,
        total: i.precio * i.cantidad,
      })),
      total,
      recibido: recibidoNum,
      vuelto,
    });
  }, [carrito, recibido, total, vuelto, negocio]);

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
    setRecien((r) => ({ clave: `${p.id}${p.variante}`, vez: r.vez + 1 }));
    // El foco vuelve al buscador siempre: el siguiente escaneo tiene que entrar.
    buscador.current?.focus();
  };

  /* El destello dura lo que dura la animación y se apaga solo. Si no se
     limpiara, la última línea marcada quedaría resaltada toda la venta. */
  useEffect(() => {
    if (!recien.clave) return;
    const id = window.setTimeout(() => setRecien({ clave: '', vez: 0 }), 450);
    return () => window.clearTimeout(id);
  }, [recien]);

  /* Con quince líneas marcadas, la que acaba de entrar está fuera de la vista.
     Se trae sola: el cajero no debería tener que desplazar nada con gente
     esperando. */
  useEffect(() => {
    if (!recien.clave) return;
    document
      .querySelector(`[data-linea="${CSS.escape(recien.clave)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [recien, carrito]);

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

  const descartar = async (p: EnEspera, motivo: string) => {
    await descartarPausada(p.id, motivo);
    await refrescarEspera();
  };

  const finalizar = async (voucher?: Voucher) => {
    if (!carrito.length || cobrando) return;

    /* Con tarjeta y datáfono independiente, primero el voucher. Con uno
       integrado, el aparato lo trae y no hay nada que pedir. */
    if (medioPago === 'tarjeta' && digitaVoucher && !voucher) {
      setPidiendoVoucher(true);
      return;
    }

    setCobrando(true);
    setError('');
    try {
      /* `cajero` y `turno_id` los rellena el lado nativo con la sesión real:
         si vinieran de aquí, bastaría abrir las herramientas del webview para
         firmar una venta a nombre de otro. */
      const r = await cobrar({
        items: carrito,
        medio_pago: medioPago,
        recibido: medioPago === 'efectivo' ? parseInt(recibido || '0', 10) || 0 : 0,
        cajero: '',
        turno_id: '',
        iva_porcentaje: 0,
      }, voucher);
      setUltimo(r);
      setCarrito([]);
      setRecibido('');
      setMedioPago('efectivo');
      setPidiendoVoucher(false);
      setFalloImpresion(r.impresion ?? '');
      refrescarEspera();

      /* El cambio, gigante y del otro lado: es lo que el cliente está a punto
         de contar con la mano. Vuelve a la pantalla de espera solo después. */
      mostrarAlCliente({ modo: 'gracias', negocio: negocio || 'MenuBy', vuelto: r.venta.vuelto });
      window.setTimeout(() => mostrarAlCliente({ modo: 'espera', negocio: negocio || 'MenuBy' }), 8000);
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
      {/* La barra. Tres grupos con jerarquía, no seis rectángulos iguales:
          a la izquierda quién está en la caja, en medio el estado de la nube y
          lo que quedó en espera, a la derecha las herramientas que se usan una
          vez al día. Todo a 44px de alto, que es lo que acierta un dedo. */}
      <header className="flex items-center gap-2 px-3 h-16 bg-slate-900 text-white flex-shrink-0">
        {/* Quién responde por esta caja. Es lo primero que se lee y lo que
            abre el turno, así que lleva el color del negocio. */}
        <button
          onClick={() => setVerTurno(!verTurno)}
          title="Turno, movimientos de efectivo y cierre"
          className="flex items-center gap-2 pl-2 pr-3 h-toque rounded-xl bg-marca text-sobre-marca hover:brightness-110 transition-all"
        >
          <CircleUser size={20} strokeWidth={2} className="flex-shrink-0" />
          <span className="text-left leading-tight">
            <span className="block text-[13px] font-bold">{usuario.nombre}</span>
            <span className="block text-[10px] font-semibold opacity-70">
              {usuario.rol === 'supervisor' ? 'Supervisor' : 'Turno abierto'}
            </span>
          </span>
        </button>

        <span className="text-[13px] font-bold text-slate-400 truncate max-w-[220px] pl-1">
          {negocio || 'MenuBy POS'}
        </span>

        {!enTauri && (
          <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-400 text-amber-950">
            modo navegador · no cobra de verdad
          </span>
        )}

        {/* El estado de la nube, con el icono haciendo el trabajo: una nube
            tachada se entiende de reojo, "3 venta(s) por subir" hay que leerlo.
            El número sigue ahí porque tres pendientes y treinta no son lo
            mismo para el dueño. */}
        <button
          onClick={subirAhora}
          disabled={subiendo}
          title="Subir ahora lo pendiente"
          className={`ml-auto flex items-center gap-2 px-3 h-toque rounded-xl text-[12.5px] font-semibold transition-colors ${
            cola.pendientes > 0
              ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
          } disabled:opacity-50`}
        >
          {subiendo
            ? <RefreshCw size={16} strokeWidth={2.25} className="animate-spin" />
            : cola.pendientes > 0
              ? <CloudOff size={16} strokeWidth={2.25} />
              : <CloudCheck size={16} strokeWidth={2.25} />}
          {subiendo
            ? 'Sincronizando…'
            : cola.pendientes > 0
              ? `${cola.pendientes} por subir`
              : 'Al día'}
        </button>

        {enEspera.length > 0 && (
          <button
            onClick={() => setVerEspera(true)}
            title="Pedidos apartados esperando a que el cliente vuelva"
            className="flex items-center gap-2 px-3 h-toque rounded-xl bg-amber-400 text-amber-950 text-[12.5px] font-bold hover:bg-amber-300"
          >
            <Inbox size={16} strokeWidth={2.5} />
            {enEspera.length} en espera
          </button>
        )}

        {cola.apartadas > 0 && (
          <span
            title="La nube rechazó estas ventas. Están guardadas, pero necesitan revisión."
            className="flex items-center gap-2 px-3 h-toque rounded-xl bg-red-500 text-white text-[12.5px] font-bold"
          >
            <CloudOff size={16} strokeWidth={2.5} />
            {cola.apartadas} rechazadas
          </span>
        )}

        {/* Separador: a partir de aquí son herramientas, no estado. */}
        <span className="w-px h-8 bg-slate-700 mx-1" />

        <BotonBarra
          icono={Monitor}
          activo={conCliente}
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
        >
          Cliente
        </BotonBarra>

        <BotonBarra
          icono={Printer}
          onClick={() => reimprimir().catch((e) => setFalloImpresion(String(e)))}
          title="Reimprimir la última venta del turno"
        >
          Reimprimir
        </BotonBarra>

        <BotonBarra
          icono={Wallet}
          onClick={() => setPidiendoGaveta(true)}
          title="Queda registrado quién la abre y para qué"
        >
          Gaveta
        </BotonBarra>

        <BotonBarra icono={Printer} onClick={() => setVerImpresoras(true)} title="Configurar las impresoras">
          Impresoras
        </BotonBarra>

        <BotonBarra icono={CloudCheck} onClick={() => setVerNube(true)} title="Conectar esta caja con MenuBy">
          MenuBy
        </BotonBarra>
      </header>

      {falloImpresion && (
        <div className="absolute bottom-4 left-4 z-40 max-w-md rounded-2xl bg-slate-900 text-white shadow-xl px-4 py-3 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold">Venta guardada, pero la tirilla no salió</p>
            <p className="text-[11.5px] text-slate-400 truncate">{falloImpresion}</p>
          </div>
          <button
            onClick={async () => {
              setReimprimiendo(true);
              try {
                await reimprimir();
                setFalloImpresion('');
              } catch (e) {
                setFalloImpresion(String(e).replace(/^Error:\s*/, ''));
              } finally {
                setReimprimiendo(false);
              }
            }}
            disabled={reimprimiendo}
            className="flex-shrink-0 h-toque px-4 rounded-xl bg-white text-slate-900 text-[12.5px] font-bold disabled:opacity-50"
          >
            {reimprimiendo ? '…' : 'Reintentar'}
          </button>
          <button
            onClick={() => setFalloImpresion('')}
            className="flex-shrink-0 flex items-center justify-center w-toque h-toque rounded-xl text-slate-500 hover:text-white hover:bg-slate-700"
            aria-label="Cerrar aviso"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {verImpresoras && <Impresoras onCerrar={() => setVerImpresoras(false)} />}
      {verNube && <Nube onCerrar={() => setVerNube(false)} />}

      {/* Abrir la gaveta fuera de una venta es el movimiento que más se audita:
          es por donde sale la plata sin que haya nada vendido. El motivo no es
          burocracia, es la única fila que después explica un descuadre. */}
      {pidiendoGaveta && (
        <ModalMotivo
          titulo="Abrir la gaveta"
          detalle="Queda registrado quién la abrió, cuándo y para qué."
          etiqueta="¿Para qué se abre?"
          ejemplo="Cambio para el cliente, retiro parcial…"
          confirmar="Abrir"
          onListo={(motivo) => {
            setPidiendoGaveta(false);
            abrirCajon(motivo).catch((e) => setError(String(e).replace(/^Error:\s*/, '')));
            buscador.current?.focus();
          }}
          onCancelar={() => { setPidiendoGaveta(false); buscador.current?.focus(); }}
        />
      )}

      {descartando && (
        <ModalMotivo
          titulo="Descartar el pedido apartado"
          detalle={`${descartando.etiqueta} · ${pesos(descartando.total)}`}
          etiqueta="¿Por qué se descarta?"
          ejemplo="El cliente no volvió, se pidió por error…"
          confirmar="Descartar"
          onListo={async (motivo) => {
            const cual = descartando;
            setDescartando(null);
            try {
              await descartar(cual, motivo);
            } catch (e) {
              setError(String(e).replace(/^Error:\s*/, ''));
            }
          }}
          onCancelar={() => setDescartando(null)}
        />
      )}

      {pidiendoVoucher && (
        <CobroTarjeta
          total={total}
          onListo={(v) => { setPidiendoVoucher(false); finalizar(v); }}
          onCancelar={() => setPidiendoVoucher(false)}
        />
      )}

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
                <button
                  onClick={() => setDescartando(p)}
                  title="Descartar este pedido"
                  className="flex items-center justify-center w-toque h-toque rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={18} strokeWidth={2.25} />
                </button>
                <button onClick={() => retomar(p.id)} className="h-toque px-5 rounded-xl bg-marca text-sobre-marca text-[13px] font-bold">
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
          {/* El icono no es decoración: un cajero nuevo no sabe que el lector
              de códigos funciona sin configurar nada, y esto se lo dice. */}
          <div className="relative flex-shrink-0">
            <ScanLine
              size={22}
              strokeWidth={2}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              ref={buscador}
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={enterEnBusqueda}
              placeholder="Busca o escanea un producto…"
              className="w-full h-14 pl-12 pr-4 rounded-xl border-2 border-slate-200 bg-white text-lg outline-none focus:border-marca"
            />
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            {productos.map((p) => (
              <button
                key={p.id + p.variante}
                onClick={() => agregar(p)}
                className="h-24 p-3 rounded-xl bg-white border border-slate-200 text-left hover:border-marca active:scale-95 active:border-marca transition-transform duration-75 flex flex-col justify-between"
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
              <div
                key={i.producto_id + i.variante}
                data-linea={`${i.producto_id}${i.variante}`}
                className={`flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 ${
                  recien.clave === `${i.producto_id}${i.variante}` ? 'recien-agregado' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">
                    {i.nombre}{i.variante ? <span className="text-slate-400"> · {i.variante}</span> : null}
                  </p>
                  <p className="text-[11px] text-slate-400 tabular-nums">{pesos(i.precio)} c/u</p>
                </div>
                <button
                  onClick={() => cambiarCantidad(indice, -1)}
                  title="Quitar uno"
                  className="flex items-center justify-center w-toque h-toque rounded-lg border border-slate-200 text-slate-600 active:scale-95 transition-transform duration-75"
                >
                  <Minus size={16} strokeWidth={3} />
                </button>
                <span className="w-7 text-center font-bold tabular-nums">{i.cantidad}</span>
                <button
                  onClick={() => cambiarCantidad(indice, 1)}
                  title="Agregar uno"
                  className="flex items-center justify-center w-toque h-toque rounded-lg border border-slate-200 text-slate-600 active:scale-95 transition-transform duration-75"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
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

              </div>
            )}

            {carrito.length === 0 && !ultimo && (
              /* Un estado vacío que dice qué hacer. "Carrito vacío" no le
                 enseña nada a un cajero en su primer turno. */
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-300">
                <ScanLine size={40} strokeWidth={1.5} />
                <p className="text-[13.5px] font-semibold text-slate-400">Escanea o toca un producto</p>
                <p className="text-[11.5px] text-slate-400">Se marca aquí y el cliente lo ve al instante</p>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 space-y-2">
            <div className="flex gap-1.5">
              {(['efectivo', 'tarjeta'] as const).map((m) => {
                const Icono = m === 'efectivo' ? Banknote : CreditCard;
                const elegido = medioPago === m;
                return (
                  <button
                    key={m}
                    onClick={() => setMedioPago(m)}
                    className={`flex-1 flex items-center justify-center gap-2 h-toque rounded-xl text-[13px] font-bold border-2 transition-colors ${
                      elegido
                        ? 'border-marca bg-marca text-sobre-marca'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Icono size={17} strokeWidth={2.25} />
                    {m === 'efectivo' ? 'Efectivo' : 'Tarjeta'}
                  </button>
                );
              })}
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-500">Total</span>
              <span className="text-3xl font-black tabular-nums">{pesos(total)}</span>
            </div>

            {medioPago === 'efectivo' && (
              <div className="flex items-center gap-2">
                <input
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="Recibido"
                  className="flex-1 h-toque px-3 rounded-xl border-2 border-slate-200 tabular-nums outline-none focus:border-marca"
                />
                <span className="w-28 text-right text-sm font-bold text-slate-500 tabular-nums">
                  {vuelto > 0 ? `Cambio ${pesos(vuelto)}` : ''}
                </span>
              </div>
            )}

            {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={pausar}
                disabled={!carrito.length}
                title="Aparta este pedido y atiende al siguiente"
                className="flex flex-col items-center justify-center gap-0.5 w-32 h-16 rounded-xl border-2 border-slate-200 text-[12.5px] font-bold text-slate-600 disabled:opacity-30 active:scale-95 transition-transform duration-75"
              >
                <PauseCircle size={18} strokeWidth={2.25} />
                En espera
                <span className="text-[10px] font-semibold text-slate-400">F4</span>
              </button>
              {/* El botón que más se toca del día lleva el color del negocio.
                  Es lo único de esta pantalla que tiene que encontrarse sin
                  mirar. */}
              <button
                onClick={() => finalizar()}
                disabled={!carrito.length || cobrando}
                className="flex-1 flex items-center justify-center gap-2.5 h-16 rounded-xl bg-marca text-sobre-marca text-lg font-black disabled:opacity-30 active:scale-95 transition-transform duration-75"
              >
                {cobrando
                  ? <RefreshCw size={20} strokeWidth={2.5} className="animate-spin" />
                  : medioPago === 'tarjeta'
                    ? <CreditCard size={20} strokeWidth={2.5} />
                    : <Banknote size={20} strokeWidth={2.5} />}
                {cobrando ? 'Cobrando…' : medioPago === 'tarjeta' ? 'Cobrar tarjeta · F2' : 'Cobrar · F2'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

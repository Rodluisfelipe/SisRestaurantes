import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleUser, CloudCheck, CloudOff, Gift, Inbox, Minus, Monitor,
  LayoutGrid, MessageSquarePlus, PauseCircle, Percent, Plus, Presentation, Printer, RefreshCw, ScanLine,
  Pencil, Star, Timer, Trash2, Undo2, UserPlus, UtensilsCrossed, Volume2, VolumeX, Wallet, X,
  XCircle,
} from 'lucide-react';
import { type EstadoCliente } from './nativo';
import {
  abrirCajon, abrirPantallaCliente, anularBorrador, anularItem, aplicarMarca, catalogo, cerrarPantallaCliente,
  abrirCuenta, armarQr, carpetaFotos, categorias, cerrarCuenta, cobrar, cobroQr, descartarPausada,
  devolver, enTauri, estadoSync, qrLlevaMonto,
  guardarEnCuenta, hayPantallaCliente, identidad, imprimirPrecuenta, infoTerminal, listarCuentas,
  listarPausadas, mostrarAlCliente, pausarVenta, pesos, reimprimir, retomarVenta, salir,
  registrarDescuento, repartir, sincronizar, turnoActivo,
  canjearRecompensa, productoPorId, recompensas as listarRecompensas,
  type CierreTurno, type Cliente, type Cobro, type Cuenta, type EnEspera, type ExtraElegido,
  type LineaDevolvible, type LineaVenta, type PagoDetalle, type Producto, type Recompensa,
  type Turno, type Usuario, type VentaBuscada,
} from './nativo';
import ModalMotivo from './ModalMotivo';
import CobroMixto from './CobroMixto';
import NotaItem from './NotaItem';
import Descuento from './Descuento';
import Cuentas from './Cuentas';
import VistaCliente from './VistaCliente';
import Devolucion from './Devolucion';
import Extras from './Extras';
import { activarSonido, bip, error as bipError, sonidoActivo } from './sonido';
import PantallaPin from './PantallaPin';
import Impresoras from './Impresoras';
import Nube from './Nube';
import Autorizar from './Autorizar';
import { AbrirTurno, PanelTurno, ResumenCierre } from './Turno';
import ModalCliente from './ModalCliente';
import ModalRecompensas from './ModalRecompensas';
import CatalogoCuadrante from './CatalogoCuadrante';
import PestanasCategoria from './PestanasCategoria';
import SelectorVariante, { enVariante, variantesDe } from './SelectorVariante';
import ModalExtrasBatch from './ModalExtrasBatch';
import {
  derivar, predeterminadas, preseleccionarTamano, reconstruirElegidas, type Elegidas,
} from './reglasExtras';
import { useSpeedOfService } from './hooks/useSpeedOfService';
import {
  agregarAlCarrito, brutoDe, fijarCantidad, lineaDeRecompensa, quitarLineasDeRecompensa,
  rebajaPorRecompensa,
} from './carrito';

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
  const [rubros, setRubros] = useState<string[]>([]);
  /** Vacío = todas. */
  const [rubro, setRubro] = useState('');
  const [carrito, setCarrito] = useState<LineaVenta[]>([]);
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
  /* Mientras esto esté puesto, la caja está en la pantalla de cobro. La venta
     todavía no existe: primero se define con qué se paga, después el registro. */
  const [cobrandoAhora, setCobrandoAhora] = useState(false);
  const [digitaVoucher, setDigitaVoucher] = useState(true);
  /* Lo que se lleva cobrado en la pantalla de cobro, solo para que el cliente
     vea su saldo bajar del otro lado del mostrador. */
  const [vistaPago, setVistaPago] = useState<PagoDetalle[]>([]);
  /* El código de cobro del negocio y el medio que el cajero tiene elegido. De
     los dos sale lo que ve el cliente en su pantalla. */
  const [codigoQr, setCodigoQr] = useState({ activo: false, plantilla: '' });
  const [medioElegido, setMedioElegido] = useState('efectivo');
  /* Lo que se le está mostrando al cliente. Se guarda aquí además de mandarse
     a la otra ventana porque en un local de una sola pantalla no hay otra
     ventana: el cajero gira el monitor y esto es lo que el cliente ve. */
  const [paraElCliente, setParaElCliente] = useState<EstadoCliente>({ modo: 'espera' });
  const [girarPantalla, setGirarPantalla] = useState(false);
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
  /* La línea a la que se le está poniendo una nota: "sin cebolla", "bien
     asado". Es el índice y no la línea, porque lo que se edita es la posición
     del carrito. */
  const [anotando, setAnotando] = useState<number | null>(null);
  /* El producto al que se le están eligiendo los extras. Mientras esté puesto,
     todavía no entró al carrito: si entrara antes, el cajero que cancela la
     pantalla se quedaría con el producto marcado sin sus adiciones. */
  const [conExtras, setConExtras] = useState<Producto | null>(null);
  /* Lo que ya viene resuelto al abrir el modal: el tamaño que el cajero tiene
     puesto en la columna. Viaja aparte del producto porque depende de lo que
     esté seleccionado en ese momento, no del producto. */
  const [extrasInicial, setExtrasInicial] = useState<Elegidas | undefined>(undefined);
  /* Varias unidades del mismo producto, esperando configurarse de una. Es lo
     que evita abrir tres modales seguidos cuando el cliente pide tres combos. */
  const [enLote, setEnLote] = useState<{ producto: Producto; cantidad: number } | null>(null);
  /* La línea que se está personalizando, cuando el modal se abrió desde el
     carrito y no desde la rejilla. Null = lo que se elija entra como línea
     nueva. */
  const [editando, setEditando] = useState<number | null>(null);
  /* El último toque en una tarjeta. Un monitor táctil de mostrador rebota: un
     toque firme genera dos eventos separados por unas decenas de milisegundos,
     y el cliente termina pagando dos cafés. */
  const ultimoToque = useRef(0);
  /* El descuento va en dos pasos: primero se arma el monto, después lo autoriza
     un supervisor. Entre los dos vive aquí, sin haberse aplicado todavía. */
  const [pidiendoDescuento, setPidiendoDescuento] = useState(false);
  const [porAutorizar, setPorAutorizar] = useState<{ monto: number; detalle: string } | null>(null);
  /* El descuento ya autorizado, que se rebaja al cobrar. */
  const [descuento, setDescuento] = useState({ monto: 0, motivo: '' });
  /* El salón. `vista` alterna entre el catálogo de mostrador y el tablero de
     mesas; un negocio que no usa mesas nunca sale del catálogo. */
  const [vista, setVista] = useState<'catalogo' | 'salon'>('catalogo');
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  /* La cuenta que se está atendiendo. Mientras esté puesta, lo que se marca no
     va a un cobro sino a esa mesa. */
  const [enCuenta, setEnCuenta] = useState<Cuenta | null>(null);
  const [avisoCuenta, setAvisoCuenta] = useState('');
  /* Dónde están las fotos en este equipo. Se resuelve una vez: no cambia
     mientras la app corre. */
  const [carpeta, setCarpeta] = useState('');
  const [conSonido, setConSonido] = useState(sonidoActivo);
  /* La devolución va en dos pasos, igual que el descuento: primero se arma —qué
     venta, qué líneas, con qué se devuelve— y después la autoriza un
     supervisor. Entre los dos vive aquí, sin haberse ejecutado. */
  /* El cliente de esta venta, cuando el cajero lo identificó. Vacío es lo
     normal: la mayoría de las ventas de mostrador son anónimas, y obligar a
     preguntar el teléfono en cada café solo alarga la fila. */
  /* La línea que el cajero tiene señalada. Es lo que anula F4 y lo que abre
     la nota: un toque selecciona, y las acciones actúan sobre lo señalado. Sin
     esto, anular obligaba a bajar la cantidad de a uno —ocho toques para un
     ítem de ocho unidades— antes de llegar siquiera a la autorización. */
  const [lineaActiva, setLineaActiva] = useState<number | null>(null);
/* La cantidad que se está tecleando, como cadena y no como número.

     Es un **buffer que concatena**: 1 y después 9 componen 19, no 9 ni 10. Con
     un solo dígito, cualquier pedido de más de nueve unidades obligaba a tocar
     el producto varias veces o a corregir la línea después.

     Cadena y no número porque lo que se acumula son pulsaciones: "1" seguido de
     "9" es una operación de texto. Convertirlo en número en cada tecla obligaría
     a multiplicar por diez y sumar, que es la misma cuenta escrita más difícil.

     Vacío = ninguna cantidad tecleada, y entonces entra una unidad.

     Se vacía solo después de marcar. Un multiplicador que se queda puesto es la
     forma más fácil de vender doce empanadas cuando el cliente pidió tres: el
     cajero lo usó una vez, se le olvidó, y el siguiente producto entró
     multiplicado sin que nadie lo notara. */
  const [cantidadTecleada, setCantidadTecleada] = useState('');
  const multiplicador = Math.max(1, parseInt(cantidadTecleada, 10) || 1);
  /* Cuántas de las líneas que hay en pantalla ya salieron hacia la cocina.

     Solo tiene sentido atendiendo una mesa: en mostrador no ha salido nada. Se
     fija al abrir la cuenta, y como lo que se marca después se agrega al
     final, las primeras `comandadas` posiciones son las que la cocina ya
     tiene. Si una de esas suma unidades nuevas, la línea entera cuenta como
     comandada —que es el lado seguro: pide autorización de más, nunca de
     menos—. */
  const [comandadas, setComandadas] = useState(0);
  /* La presentación que el cajero dejó puesta: "Mediana", "Litro", lo que el
     negocio haya escrito. Vacío = cada producto entra como esté en su casilla. */
  const [variante, setVariante] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [verCliente, setVerCliente] = useState(false);
  const [verRecompensas, setVerRecompensas] = useState(false);
  /* La recompensa elegida, todavía sin canjear. El canje de verdad ocurre al
     cobrar y contra el servidor: hasta entonces esto es una promesa que la
     pantalla ya está mostrando, y por eso se puede quitar. */
  const [recompensa, setRecompensa] = useState<Recompensa | null>(null);
  const [hayRecompensas, setHayRecompensas] = useState(false);
  const [pidiendoDevolucion, setPidiendoDevolucion] = useState(false);
  const [devolucionPorAutorizar, setDevolucionPorAutorizar] = useState<
    { venta: VentaBuscada; items: LineaVenta[]; medio: string; total: number } | null
  >(null);

  /* El cronómetro de la venta. Arranca con el primer gesto y se cierra al
     cobrar; el cajero no lo toca nunca. */
  const sos = useSpeedOfService();

  useEffect(() => { infoTerminal().then((t) => setDigitaVoucher(t.requiere_digitacion)).catch(() => {}); }, []);
  const buscador = useRef<HTMLInputElement>(null);

  useEffect(() => { hayPantallaCliente().then(setConCliente).catch(() => {}); }, []);

  const refrescarEspera = () => listarPausadas().then(setEnEspera).catch(() => {});
  useEffect(() => { refrescarEspera(); }, []);

  const refrescarCuentas = () => listarCuentas().then(setCuentas).catch(() => {});
  useEffect(() => { refrescarCuentas(); }, []);

  /* Guarda lo marcado en la mesa que se está atendiendo y manda a la cocina
     solo lo nuevo. Quién decide qué es nuevo vive en Rust: esta pantalla no
     tiene forma de saber qué se imprimió antes de que la abrieran. */
  const mandarACuenta = async () => {
    if (!enCuenta || !carrito.length) return;
    try {
      const r = await guardarEnCuenta(enCuenta.identificador, carrito, total, carrito.length);
      setCarrito([]);
      setComandadas(0);
      setLineaActiva(null);
      setEnCuenta(null);
      setVista('salon');
      await refrescarCuentas();
      setAvisoCuenta(
        r.impresion
          ? `Guardado en ${r.cuenta.identificador}, pero la comanda no salió: ${r.impresion}`
          : r.a_cocina > 0
            ? `${r.a_cocina} ítem(s) a la cocina · ${r.cuenta.identificador}`
            : `Guardado en ${r.cuenta.identificador}`,
      );
      window.setTimeout(() => setAvisoCuenta(''), 6000);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      buscador.current?.focus();
    }
  };

  /* Traer el pedido de la mesa a la pantalla para agregarle la ronda nueva.
     **No la cierra**: la mesa sigue sentada. */
  const atender = async (c: Cuenta) => {
    if (carrito.length && !enCuenta) {
      setError('Termina lo que tienes marcado antes de abrir una mesa');
      return;
    }
    const pedido = await abrirCuenta(c.id);
    setCarrito(pedido ?? []);
    /* Lo que ya estaba en la mesa es lo que la cocina ya preparó: quitarlo
       necesita autorización, y hay que avisarle a la cocina. Lo que se marque
       a partir de ahora todavía no existe para nadie. */
    setComandadas(pedido?.length ?? 0);
    setLineaActiva(null);
    setEnCuenta(c);
    setVista('catalogo');
    buscador.current?.focus();
  };

  /* Cobrar una mesa: se trae su pedido y se abre el cobro normal. La cuenta se
     cierra sola cuando la venta quedó registrada, no antes. */
  const cobrarCuenta = async (c: Cuenta) => {
    const pedido = await abrirCuenta(c.id);
    if (!pedido?.length) {
      setError(`${c.identificador} no tiene nada consumido`);
      return;
    }
    setCarrito(pedido);
    setComandadas(pedido.length);
    setLineaActiva(null);
    setEnCuenta(c);
    setVista('catalogo');
    setVistaPago([]);
    setCobrandoAhora(true);
  };

  /* El filtrado espera a que el tecleo pare.

     Un lector de códigos es un teclado que escribe a menos de 10 ms por
     carácter: un EAN-13 dispara trece consultas a SQLite y trece re-dibujados
     de la rejilla en cien milisegundos. En el Celeron de un todo-en-uno eso
     atasca el hilo de la interfaz y **se pierden caracteres**, así que el
     código llega incompleto y el producto no aparece.

     60 ms es más que el intervalo del lector —así que una ráfaga entera cuenta
     como una sola consulta— y menos de lo que nadie nota escribiendo a mano. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      catalogo(busqueda, rubro).then(setProductos).catch(() => setProductos([]));
    }, 60);
    return () => window.clearTimeout(id);
  }, [busqueda, rubro]);

  /* Las categorías se piden una vez: cambian cuando baja catálogo nuevo, no
     mientras el cajero atiende. */
  useEffect(() => { categorias().then(setRubros).catch(() => {}); }, []);

  useEffect(() => { carpetaFotos().then(setCarpeta).catch(() => {}); }, []);

  useEffect(() => { cobroQr().then(setCodigoQr).catch(() => {}); }, []);

  /* Si el cliente vinculado alcanza para al menos una recompensa, la columna
     del cliente lo avisa. Sin esto el cajero tendría que abrir el panel de
     canje en cada venta para averiguar si hay algo que ofrecer, y no lo haría
     ninguna. */
  useEffect(() => {
    if (!cliente || cliente.puntos <= 0) { setHayRecompensas(false); return; }
    listarRecompensas()
      .then((rs) => setHayRecompensas(rs.some((r) => r.costo_puntos <= cliente.puntos)))
      .catch(() => setHayRecompensas(false));
  }, [cliente]);

  /* Buscar por texto manda sobre la pestaña. Si alguien escanea un código
     estando en "Bebidas" y el producto es de "Postres", tiene que aparecer:
     el lector nunca se equivoca de categoría, el dedo sí. */
  useEffect(() => { if (busqueda.trim()) setRubro(''); }, [busqueda]);

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
  /* Lo que lleva cubierto el cliente mientras el cajero arma el cobro. Sirve
     para una sola cosa, y es importante: que el cliente vea bajar su saldo del
     otro lado del mostrador según va entregando. Pagar cincuenta mil en dos
     partes sin ver el saldo es pedirle que confíe. */
  /* Lo que de verdad se cobra. Rust vuelve a hacer esta resta al guardar —es
     él quien manda— pero la pantalla tiene que mostrar la cifra correcta desde
     que se autoriza el descuento. */
  /* Las presentaciones que hay en lo que se está mostrando ahora mismo.

     Se recalcula con el catálogo filtrado y no una sola vez al arrancar:
     las bebidas vienen en tres tamaños y los postres en ninguno, así que
     el conmutador tiene que aparecer y desaparecer con la categoría. */
  const variantesDisponibles = useMemo(() => variantesDe(productos), [productos]);

  /* Una presentación que ya no existe en lo que se ve no puede quedarse
     puesta: el cajero pasa de Bebidas a Postres y, sin esto, seguiría
     marcando con [Litro] señalado sin que ningún botón lo muestre. */
  useEffect(() => {
    if (variante && !variantesDisponibles.includes(variante)) setVariante('');
  }, [variante, variantesDisponibles]);

  const aCobrar = Math.max(0, total - descuento.monto);
  const { falta, vuelto } = useMemo(() => repartir(aCobrar, vistaPago), [aCobrar, vistaPago]);
  const entregado = useMemo(
    () => vistaPago.reduce((t, p) => t + p.monto, 0),
    [vistaPago],
  );

  /* Lo que se marca aparece al instante del otro lado del mostrador. Es lo que
     evita el "yo no pedí eso" cuando ya está cobrado: el cliente ve su pedido
     mientras se arma, no después. */
  useEffect(() => {
    const paquete: EstadoCliente = {
      modo: carrito.length === 0 ? 'espera' : cobrandoAhora ? 'pago' : 'venta',
      negocio: negocio || 'MenuBy',
      items: carrito.map((i) => ({
        nombre: `${i.nombre}${i.variante ? ` · ${i.variante}` : ''}`,
        cantidad: i.cantidad,
        total: i.precio * i.cantidad,
      })),
      total: aCobrar,
      recibido: entregado,
      vuelto,
      falta,
      /* El código solo mientras se está cobrando por transferencia. Fuera de
         ese momento sobra: la pantalla tiene que mostrar el pedido, no un
         cuadro que nadie va a escanear. */
      qr:
        cobrandoAhora && medioElegido === 'transferencia' && codigoQr.activo
          ? armarQr(codigoQr.plantilla, aCobrar, String(ultimo?.venta.consecutivo ?? ''))
          : '',
      qr_con_monto: qrLlevaMonto(codigoQr.plantilla),
    };

    setParaElCliente(paquete);
    mostrarAlCliente(paquete);
  }, [carrito, aCobrar, negocio, cobrandoAhora, entregado, vuelto, falta, medioElegido, codigoQr, ultimo]);

  /* Un producto con extras no entra de una: primero hay que preguntar cómo lo
     quiere el cliente. Sin esto —que es como estaba— el cajero marcaba la
     hamburguesa, entraba el precio base, y ni el cliente pagaba el queso ni la
     cocina se enteraba de que lo llevaba. */
  const tocar = (p: Producto) => {
    /* 150 ms: por encima del rebote de cualquier pantalla resistiva y muy por
       debajo de lo que tarda un dedo en volver a la misma tarjeta a propósito.
       Nadie marca dos unidades en menos de eso. */
    const ahora = Date.now();
    if (ahora - ultimoToque.current < 150) return;
    ultimoToque.current = ahora;

    /* La presentación puesta manda sobre la casilla: con [Mediana] elegida,
       tocar "Gaseosa" marca la mediana. Si este producto no viene en esa
       presentación —hay gaseosa mediana pero no hay pan mediano— entra tal
       cual, que es lo que el cajero espera al tocar el pan. */
    const cual = enVariante(p, variante, productos);
    const grupos = Array.isArray(cual.extras) ? cual.extras : [];

    /* El tamaño puesto en la columna, ya resuelto dentro de los extras. Con
       [Mediano] elegido, ese grupo llega marcado y al cajero solo le queda
       decir papas y bebida. Devuelve null si este producto no tiene ese
       tamaño, y entonces no hay nada que preseleccionar. */
    const conTamano = preseleccionarTamano(grupos, variante) ?? undefined;

    if (!grupos.length) {
      agregar(cual);
      return;
    }

    /* Los obligatorios, resueltos con la opción estándar.

       Aquí está el cambio que quita el cuello de botella: el combo entra con
       sus papas y su gaseosa sin abrir nada. Si el cliente quiere otra cosa,
       el cajero toca [Modificar] sobre la línea, que es el 20 % de las veces
       en lugar del 100 %. */
    const resueltos = derivar(grupos, predeterminadas(grupos, conTamano ?? {}));

    if (resueltos.faltan.length === 0) {
      agregar(cual, resueltos.extras, resueltos.sobreprecio);
      return;
    }

    /* Queda algo que ningún defecto puede resolver: un grupo obligatorio de
       varias opciones, donde el negocio dijo "elige las que quieras" y no hay
       una respuesta estándar que adivinar. Ahí sí hay que preguntar.

       Con más de una unidad, las N se configuran en una sola pantalla: tres
       modales seguidos para tres combos es lo que destruye la fila. */
    const partida = predeterminadas(grupos, conTamano ?? {});

    if (multiplicador > 1) {
      setEnLote({ producto: cual, cantidad: multiplicador });
      setExtrasInicial(partida);
      return;
    }

    setConExtras(cual);
    setExtrasInicial(partida);
  };

  const agregar = (p: Producto, extras: ExtraElegido[] = [], sobreprecio = 0) => {
    /* Cómo se agrupa vive en `carrito.ts`, no acá: es aritmética que decide
       cuánto paga el cliente y equivocarse no se ve, así que tiene que poder
       probarse sin montar la caja entera. */
    const unidades = multiplicador;
    setCarrito((c) => agregarAlCarrito(c, p, extras, sobreprecio, unidades));
    // Se gasta al usarse. Ver por qué en la declaración.
    setCantidadTecleada('');
    setRecien((r) => ({ clave: `${p.id}${p.variante}`, vez: r.vez + 1 }));
    /* El primer producto de un carrito vacío es el comienzo real de la venta.
       Llamarlo en cada producto no cuesta nada: el cronómetro ignora los
       arranques posteriores. */
    sos.arrancar();
    bip();
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

  /* Bajar de 1 es quitar la línea, así que pasa por la misma puerta que el
     botón de anular: con autorización si la cocina ya la tiene, directo si es
     un borrador. Subir o bajar dentro de lo marcado no pide nada: en hora pico
     eso sería insostenible. */
  const cambiarCantidad = (indice: number, delta: number) => {
    const linea = carrito[indice];
    if (delta < 0 && linea.cantidad <= 1) {
      anularLinea(indice);
      return;
    }
    setCarrito((c) => c.map((x, i) => (i === indice ? { ...x, cantidad: x.cantidad + delta } : x)));
  };

  /* Un dígito del multiplicador.

     Hace dos cosas distintas según haya o no una línea señalada, y la
     diferencia es la que pidió la operación:

     - **Sin línea señalada**: queda pendiente para el siguiente producto.
     - **Con línea señalada**: le fija la cantidad ahí mismo. Es corregir un
       "1x" a "4x" sin tocar `+` tres veces.

     Sobre una línea que la cocina ya tiene, no hace nada: cambiarle la
     cantidad a un plato que ya se está preparando es una anulación disfrazada,
     y esa tiene su propia puerta con firma de supervisor (F4). */
  const teclearMultiplicador = (n: number) => {
    if (lineaActiva !== null && carrito[lineaActiva]) {
      if (yaComandada(lineaActiva)) {
        setError('Ese plato ya está en cocina: para cambiarlo, anúlalo con F4');
        bipError();
        return;
      }
      /* Sobre una línea señalada el dígito **fija** la cantidad en vez de
         acumular: el cajero está corrigiendo un 1x a 4x, y ahí sí es una sola
         pulsación con un solo significado. Si concatenara, teclear 4 dos veces
         dejaría la línea en 44. */
      setCarrito((c) => fijarCantidad(c, lineaActiva, n));
      setCantidadTecleada('');
      buscador.current?.focus();
      return;
    }

    setCantidadTecleada((previo) => {
      // Un cero al principio no empieza una cantidad: no existe "0 empanadas".
      if (!previo && n === 0) return '';
      // Tres dígitos. Más que 999 unidades de algo no es un pedido, es un error.
      if (previo.length >= 3) return previo;
      return previo + String(n);
    });
    buscador.current?.focus();
  };

  /* Abrir la personalización sobre una línea que ya está en el carrito.

     Es la otra mitad del combo sin modal: entra con lo estándar, y si el
     cliente dice "cámbieme las papas por cascos" se abre aquí, ya marcado con
     lo que la línea lleva, para cambiar solo eso.

     Una línea que la cocina ya tiene no se modifica: cambiarle los extras a un
     plato que se está preparando es una anulación disfrazada, y esa tiene su
     propia puerta con firma (F4). */
  const modificarLinea = async (indice: number) => {
    const linea = carrito[indice];
    if (!linea) return;

    if (yaComandada(indice)) {
      setError('Ese plato ya está en cocina: para cambiarlo, anúlalo con F4');
      bipError();
      return;
    }

    const producto = await productoPorId(linea.producto_id).catch(() => null);
    const grupos = Array.isArray(producto?.extras) ? producto!.extras : [];
    if (!producto || !grupos.length) {
      setError('Ese producto no tiene nada que personalizar');
      return;
    }

    setEditando(indice);
    setConExtras(producto);
    setExtrasInicial(reconstruirElegidas(grupos, linea.extras ?? []));
  };

  /** Si esta línea ya salió hacia la cocina. En mostrador, nunca. */
  const yaComandada = (indice: number) => Boolean(enCuenta) && indice < comandadas;

  /* Quitar una línea entera.

     La bifurcación es la que pidió la operación, y conviene tenerla escrita:

     - **Ya comandada**: la cocina la preparó. Sale plata del negocio, hay que
       avisarle a la cocina y tiene que quedar constancia de quién lo autorizó.
       PIN de supervisor, igual que siempre.
     - **Borrador**: no ha ido a cocina ni se ha impreso nada. Se quita y ya.
       Es una corrección de tecleo, y pedir un supervisor por cada dedo mal
       puesto convierte la autorización en un trámite que se firma sin leer
       —que es justo lo que la vuelve inútil cuando hace falta de verdad—. */
  const anularLinea = (indice: number) => {
    const linea = carrito[indice];
    if (!linea) return;

    if (yaComandada(indice)) {
      setAnulando({ indice, linea });
      return;
    }

    setCarrito((c) => c.filter((_, i) => i !== indice));
    setLineaActiva(null);

    /* Se anota sin pedirle nada al cajero y sin esperar la escritura: la línea
       ya salió de la pantalla y la fila avanza. Lo que importa de este registro
       no es la fila suelta sino el conteo que sale en el arqueo —diez productos
       marcados y borrados antes de cobrar es como se ve un cobro de palabra—. */
    anularBorrador(
      `${linea.nombre}${linea.variante ? ` (${linea.variante})` : ''} x${linea.cantidad}`,
      linea.precio * linea.cantidad,
    ).catch(() => {});

    buscador.current?.focus();
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
        /* De qué mesa sale. Si hay mesa, la cocina ya recibió ese plato y
           tiene que enterarse de que se anuló; en mostrador todavía no sabe
           que existía. */
        enCuenta?.identificador,
      );
      setCarrito((c) => c.filter((_, i) => i !== indice));
      /* La cocina tenía una línea menos a partir de ahora. Sin esto, la
         siguiente línea heredaría la posición de la anulada y se le pediría
         autorización para quitar algo que nunca salió. */
      if (yaComandada(indice)) setComandadas((n) => Math.max(0, n - 1));
      setLineaActiva(null);
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

  /* Vincular a quien está enfrente. También arranca el cronómetro: para el
     cajero que pregunta el teléfono antes de marcar nada, ese es el momento en
     que la venta empezó de verdad. */
  const elegirCliente = (c: Cliente) => {
    setCliente(c);
    setVerCliente(false);
    sos.arrancar();
    buscador.current?.focus();
  };

  /* Soltar al cliente suelta también la recompensa: una recompensa sin dueño
     no se puede canjear, y dejarla puesta haría que el cobro fallara al final
     con el cliente enfrente. */
  const soltarCliente = () => {
    setCliente(null);
    setRecompensa(null);
    buscador.current?.focus();
  };

  /* Aplicar una recompensa a la venta que se está armando.

     Lo que pasa aquí es **visual**: el producto entra a cero o el descuento se
     pinta en el total. Los puntos no se han tocado todavía; eso ocurre al
     cobrar y contra el servidor, porque el descuento tiene que ser atómico
     entre todas las terminales del negocio.

     Es optimista a propósito. Si al cobrar el servidor dice que no alcanzan,
     la pantalla lo avisa y la venta sigue sin la recompensa. La alternativa
     —consultar antes de mostrar nada— pondría una espera de red en medio del
     gesto más frecuente del día. */
  const aplicarRecompensa = async (r: Recompensa) => {
    setVerRecompensas(false);

    if (r.tipo === 'free_product') {
      const cual = r.producto_id ? await productoPorId(r.producto_id).catch(() => null) : null;
      if (!cual) {
        setError(`"${r.nombre}" apunta a un producto que ya no está en el catálogo`);
        return;
      }
      // Entra a cero y como línea propia, con su marca. Ver `carrito.ts`.
      setCarrito((c) => [...c, lineaDeRecompensa(cual, r)]);
      setRecompensa(r);
      bip();
      buscador.current?.focus();
      return;
    }

    /* Los descuentos por puntos **no** pasan por la autorización del
       supervisor, y esa diferencia es deliberada: un descuento a dedo es plata
       que el negocio regala y por eso necesita firma; este lo pagó el cliente
       con puntos que ya se ganó. Queda registrado igual, en el canje. */
    setDescuento({ monto: rebajaPorRecompensa(r, total), motivo: `Puntos · ${r.nombre}` });
    setRecompensa(r);
    bip();
    buscador.current?.focus();
  };

  /* Un descuento por porcentaje tiene que seguir al total.

     Si se quedara con la cifra del momento en que se aplicó, el cliente que
     agrega dos platos después de canjear su 10% recibiría el 10% de lo que
     llevaba antes. Se le estaría cobrando de más, y nadie lo notaría: la
     pantalla muestra una rebaja, solo que la equivocada.

     Los descuentos autorizados por un supervisor **no** se tocan: esos son una
     cifra que alguien firmó, no una proporción. */
  useEffect(() => {
    if (!recompensa || recompensa.tipo !== 'discount_percent') return;
    const rebaja = rebajaPorRecompensa(recompensa, brutoDe(carrito));
    setDescuento((d) => (d.monto === rebaja ? d : { monto: rebaja, motivo: d.motivo }));
  }, [carrito, recompensa]);

  /* Quitar la recompensa antes de cobrar. Devuelve el carrito a como estaba:
     si era un producto gratis se va la línea, si era descuento se va la
     rebaja. */
  const quitarRecompensa = () => {
    if (!recompensa) return;
    if (recompensa.tipo === 'free_product') {
      setCarrito(quitarLineasDeRecompensa);
    } else {
      setDescuento({ monto: 0, motivo: '' });
    }
    setRecompensa(null);
    buscador.current?.focus();
  };

  /* Abre la pantalla de cobro. No cobra: decidir con qué se paga es un paso
     aparte desde que una venta puede repartirse entre varios medios. */
  const finalizar = () => {
    if (!carrito.length || cobrando) return;
    setVistaPago([]);
    setCobrandoAhora(true);
  };

  const cobrarCon = async (pagos: PagoDetalle[], propina: number) => {
    if (!carrito.length || cobrando) return;
    setCobrandoAhora(false);
    setCobrando(true);
    setError('');
    try {
      /* `cajero` y `turno_id` los rellena el lado nativo con la sesión real:
         si vinieran de aquí, bastaría abrir las herramientas del webview para
         firmar una venta a nombre de otro.

         `medio_pago` y `recibido` van por compatibilidad; con `pagos` puesto,
         Rust se guía por la lista y recalcula el resumen. */
      const efectivo = pagos.filter((p) => p.metodo === 'efectivo').reduce((t, p) => t + p.monto, 0);

      /* El cronómetro se cierra **antes** de guardar: lo que se mide es lo que
         tardó el cajero en armar el ticket, no lo que tarde SQLite en
         escribirlo ni lo que tarde la impresora en sacar la tirilla. */
      const duracion = sos.cerrar();

      const r = await cobrar({
        items: carrito,
        medio_pago: pagos.length === 1 ? String(pagos[0].metodo) : 'mixto',
        recibido: efectivo,
        cajero: '',
        turno_id: '',
        iva_porcentaje: 0,
        pagos,
        descuento: descuento.monto,
        descuento_motivo: descuento.motivo,
        propina,
        cliente_id: cliente?.id ?? '',
        cliente_telefono: cliente?.telefono ?? '',
        duracion_toma_segundos: duracion,
      });
      setUltimo(r);

      /* El canje va **después** de que la venta quedó guardada, y su fallo no
         la deshace.

         El orden importa: la venta es lo irrecuperable —el cliente ya pagó y
         ya se llevó la comida— y los puntos son un registro que se puede
         corregir. Al revés, un canje exitoso seguido de un fallo al guardar
         dejaría al cliente sin puntos y sin venta.

         Si el canje falla, el cajero se entera por el aviso y el cliente
         conserva sus puntos. Lo que no puede pasar es que la caja se quede
         esperando a la nube con la fila detrás. */
      if (recompensa && cliente) {
        try {
          await canjearRecompensa(
            cliente.id,
            cliente.telefono,
            recompensa.id,
            r.venta.id,
            usuario.nombre,
          );
          setAvisoCuenta(`${recompensa.nombre} canjeado · ${recompensa.costo_puntos} puntos`);
          window.setTimeout(() => setAvisoCuenta(''), 6000);
        } catch (e) {
          /* Se avisa y se sigue. La venta ya está cobrada con la recompensa
             entregada; que los puntos no se hayan descontado es un problema
             del negocio con su programa, no del cliente que está esperando su
             vuelto. */
          setFalloImpresion(
            `La venta quedó, pero los puntos no se descontaron: ${String(e).replace(/^Error:\s*/, '')}`,
          );
        }
      }

      setCarrito([]);
      setVistaPago([]);
      setDescuento({ monto: 0, motivo: '' });
      setCliente(null);
      setRecompensa(null);
      setLineaActiva(null);
      setComandadas(0);
      setCantidadTecleada('');

      /* La cuenta se cierra **después** de que la venta quedó registrada. Al
         revés, un fallo al guardar dejaría la mesa borrada y su consumo
         perdido. */
      if (enCuenta) {
        await cerrarCuenta(enCuenta.id).catch(() => {});
        setEnCuenta(null);
        refrescarCuentas();
      }
      setFalloImpresion(r.impresion ?? '');
      refrescarEspera();

      /* El cambio, gigante y del otro lado: es lo que el cliente está a punto
         de contar con la mano. Vuelve a la pantalla de espera solo después. */
      mostrarAlCliente({ modo: 'gracias', negocio: negocio || 'MenuBy', vuelto: r.venta.vuelto });
      window.setTimeout(() => mostrarAlCliente({ modo: 'espera', negocio: negocio || 'MenuBy' }), 8000);
    } catch (e) {
      setError(String(e));
      bipError();
    } finally {
      setCobrando(false);
      buscador.current?.focus();
    }
  };

  /* Con cualquier ventana abierta encima, el lector no puede escribir en la
     caja: sus dígitos se meterían en el campo de texto que tenga el foco y su
     Enter final confirmaría el modal sin que nadie lo tocara.

     No hace falta interceptar nada: basta con que el buscador **no** tenga el
     foco mientras hay algo abierto, y que lo recupere al cerrarse. Cada modal
     ya devuelve el foco al cerrar; esto lo quita al abrir. */
  const hayModal =
    cobrandoAhora || conExtras !== null || enLote !== null || anulando !== null || pidiendoDescuento ||
    porAutorizar !== null || anotando !== null || pidiendoGaveta || descartando !== null ||
    pidiendoDevolucion || devolucionPorAutorizar !== null || verImpresoras || verNube ||
    verTurno || verEspera || verCliente || verRecompensas;

  useEffect(() => {
    if (hayModal) buscador.current?.blur();
    else buscador.current?.focus();
  }, [hayModal]);

  /* F2 cobra y Escape limpia. Se escucha en la ventana y no en un botón para
     que funcione sin importar dónde esté el foco. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      /* Con una ventana abierta, las teclas son de esa ventana. Sin esto, el
         Enter final de un escaneo o un F2 accidental cobran por debajo de un
         modal que el cajero todavía está llenando. */
      if (hayModal) return;

      if (e.key === 'F2') { e.preventDefault(); finalizar(); }
      /* F4 anula la línea señalada y F5 aparta la venta. F4 era "en espera"
         hasta esta versión: se movió a F5 porque la carta de atajos del POS
         industrial pone la anulación ahí, y tener dos cosas distintas en la
         misma tecla entre terminales es peor que mover una. */
      if (e.key === 'F4') {
        e.preventDefault();
        if (lineaActiva !== null) anularLinea(lineaActiva);
      }
      if (e.key === 'F5') { e.preventDefault(); pausar(); }
      if (e.key === 'F7') {
        e.preventDefault();
        if (lineaActiva !== null) modificarLinea(lineaActiva);
      }
      if (e.key === 'F3') { e.preventDefault(); if (carrito.length) setPidiendoDescuento(true); }
      if (e.key === 'F1') { e.preventDefault(); setVerCliente(true); }
      /* F6 abre el canje. Solo con cliente vinculado: sin él no hay puntos que
         gastar, y abrir un panel vacío es enseñarle al cajero que ese botón no
         sirve. */
      if (e.key === 'F6') { e.preventDefault(); if (cliente) setVerRecompensas(true); }
      /* F8 hace lo mismo que F3. Las dos porque la carta de atajos del POS
         industrial dice F8 y la caja venía usando F3 desde antes: quitar F3 le
         rompería la memoria muscular a quien ya la tiene. */
      if (e.key === 'F8') { e.preventDefault(); if (carrito.length) setPidiendoDescuento(true); }
      if (e.key === 'Escape' && !cobrandoAhora) {
        setCarrito([]);
        setDescuento({ monto: 0, motivo: '' });
        setCliente(null);
        setRecompensa(null);
        setLineaActiva(null);
        setComandadas(0);
        setCantidadTecleada('');
        /* La venta se canceló: lo medido no vale y no se guarda. Si se
           conservara, la siguiente venta empezaría con el reloj corrido y el
           promedio del día quedaría inflado. */
        sos.reiniciar();
        setError('');
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  /* Enter en el buscador agrega el primer resultado: es lo que hace el escáner
     al terminar de leer un código. */
  const enterEnBusqueda = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !productos.length) return;
    tocar(productos[0]);
    setBusqueda('');
  };

  return (
    <div className="relative h-screen flex flex-col bg-slate-100 text-slate-900 overflow-hidden">
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

        {/* El cronómetro de la venta en curso.

            Solo aparece cuando hay una venta abierta: un contador en cero toda
            la jornada es ruido, y lo que este número tiene que provocar es una
            mirada de reojo, no un vistazo permanente.

            El color es para el negocio, no una nota al cajero. Una venta de
            veinte productos tarda más que un café y eso no es lentitud: por
            eso no hay alarma, ni sonido, ni nada que interrumpa. */}
        {sos.reloj && (
          <span
            title="Lo que lleva esta venta desde el primer producto"
            className={`flex items-center gap-1.5 px-2.5 h-toque rounded-xl text-[13px] font-black tabular-nums ${
              sos.ritmo === 'lento'
                ? 'bg-red-500/20 text-red-300'
                : sos.ritmo === 'medio'
                  ? 'bg-amber-400/20 text-amber-300'
                  : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            <Timer size={15} strokeWidth={2.5} />
            {sos.reloj}
          </span>
        )}

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

        {/* Sin segundo monitor, el cajero gira el suyo. Es lo que hace la
            mitad de los locales pequeños, y hasta ahora no tenían forma:
            abrir la pantalla del cliente fallaba y ahí se acababa. */}
        {!conCliente && (
          <BotonBarra
            icono={Presentation}
            onClick={() => setGirarPantalla(true)}
            title="Mostrarle la cuenta al cliente en esta misma pantalla"
          >
            Mostrar
          </BotonBarra>
        )}

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

        <BotonBarra
          icono={Undo2}
          onClick={() => setPidiendoDevolucion(true)}
          title="Devolver una venta ya cobrada. Lo autoriza un supervisor."
        >
          Devolver
        </BotonBarra>

        <BotonBarra icono={Printer} onClick={() => setVerImpresoras(true)} title="Configurar las impresoras">
          Impresoras
        </BotonBarra>

        <BotonBarra icono={CloudCheck} onClick={() => setVerNube(true)} title="Conectar esta caja con MenuBy">
          MenuBy
        </BotonBarra>

        {/* El bip se apaga desde la barra y no desde una pantalla de ajustes:
            es lo que un cajero quiere silenciar a las once de la noche con el
            local vacío, y buscarlo en un menú sería motivo para no usarlo. */}
        <button
          onClick={() => {
            const nuevo = !conSonido;
            activarSonido(nuevo);
            setConSonido(nuevo);
            if (nuevo) bip();
          }}
          title={conSonido ? 'Silenciar la caja' : 'Activar el sonido de la caja'}
          className="flex items-center justify-center w-toque h-toque rounded-xl bg-slate-700/70 hover:bg-slate-600 text-slate-100"
        >
          {conSonido ? <Volume2 size={16} strokeWidth={2.25} /> : <VolumeX size={16} strokeWidth={2.25} />}
        </button>
      </header>

      {/* ── El multiplicador ───────────────────────────────────────────

          Full width bajo la cabecera y no dentro de una columna: es la fila que
          el pulgar alcanza sin mover el brazo, y se usa antes de cada producto
          que lleva más de una unidad.

          Los dígitos **no** están en el teclado físico a propósito. El campo de
          búsqueda tiene el foco de forma permanente —es lo que hace que el
          lector de códigos funcione sin configurar nada— y hay productos que se
          buscan tecleando su código. Un "3" que multiplicara en vez de
          escribirse rompería ese flujo todos los días. */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 flex-shrink-0">
        <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wide pr-1">
          Cantidad
        </span>

        {/* Un teclado numérico completo, no un selector de un dígito. Los
            dígitos **concatenan**: 1 y después 9 componen 19. Sin eso, un
            pedido de más de nueve unidades obligaba a tocar el producto varias
            veces o a corregir la línea después. */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
          <button
            key={n}
            onClick={() => teclearMultiplicador(n)}
            className="flex-1 h-9 rounded-lg bg-slate-700/70 text-slate-200 text-[14px] font-black tabular-nums hover:bg-slate-600 active:scale-95 transition-transform duration-75"
          >
            {n}
          </button>
        ))}

        <button
          onClick={() => { setCantidadTecleada(''); buscador.current?.focus(); }}
          title="Borrar la cantidad tecleada"
          className="flex-shrink-0 px-3 h-9 rounded-lg bg-slate-700/70 text-slate-300 text-[12px] font-bold hover:bg-slate-600"
        >
          C
        </button>

        {/* La confirmación antes de tocar el producto. Un botón encendido no
            basta cuando la cantidad tiene dos cifras: hay que poder leer "19x"
            y no deducirlo de qué tecla quedó iluminada. */}
        {lineaActiva !== null && carrito[lineaActiva] ? (
          <span className="flex-shrink-0 pl-2 text-[11.5px] font-bold text-slate-400 truncate max-w-[260px]">
            Cambia la cantidad de {carrito[lineaActiva].nombre}
          </span>
        ) : cantidadTecleada ? (
          <span className="flex-shrink-0 ml-2 px-3 h-9 flex items-center rounded-lg bg-amber-400 text-amber-950 text-[13px] font-black tabular-nums">
            CANTIDAD: {cantidadTecleada}x
          </span>
        ) : null}
      </div>

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

      {verCliente && (
        <ModalCliente
          onElegir={elegirCliente}
          onCerrar={() => { setVerCliente(false); buscador.current?.focus(); }}
        />
      )}

      {verRecompensas && cliente && (
        <ModalRecompensas
          cliente={cliente}
          onElegir={aplicarRecompensa}
          onCerrar={() => { setVerRecompensas(false); buscador.current?.focus(); }}
        />
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

      {/* La cuenta, a pantalla completa, sobre la caja.

          Se cierra tocando en cualquier parte: el cajero vuelve a girar el
          monitor y sigue cobrando. Nada de una X pequeña en una esquina, que
          es lo que hay que buscar con el cliente esperando. */}
      {girarPantalla && (
        <div className="fixed inset-0 z-50 bg-black" onClick={() => setGirarPantalla(false)}>
          <VistaCliente estado={paraElCliente} />

          <button
            onClick={() => setGirarPantalla(false)}
            className="absolute top-4 right-4 flex items-center gap-2 px-4 h-toque rounded-xl bg-black/60 text-white text-[13px] font-bold backdrop-blur"
          >
            <X size={16} strokeWidth={2.5} />
            Volver a la caja
          </button>
        </div>
      )}

      {conExtras && (
        <Extras
          producto={conExtras}
          inicial={extrasInicial}
          onListo={(extras, sobreprecio) => {
            const cual = conExtras;
            const indice = editando;
            setConExtras(null);
            setExtrasInicial(undefined);
            setEditando(null);

            if (indice !== null) {
              /* Reemplaza lo que la línea llevaba, conservando su cantidad: el
                 cliente cambió de papas, no de cantidad. El precio se recalcula
                 porque los extras nuevos pueden costar distinto. */
              setCarrito((c) =>
                c.map((l, i) =>
                  i === indice
                    ? { ...l, precio: cual.precio + sobreprecio, extras }
                    : l,
                ),
              );
              buscador.current?.focus();
              return;
            }

            agregar(cual, extras, sobreprecio);
          }}
          onCancelar={() => {
            setConExtras(null);
            setExtrasInicial(undefined);
            setEditando(null);
            buscador.current?.focus();
          }}
        />
      )}

      {enLote && (
        <ModalExtrasBatch
          producto={enLote.producto}
          cantidad={enLote.cantidad}
          inicial={extrasInicial}
          onListo={(unidades) => {
            const cual = enLote.producto;
            setEnLote(null);
            setExtrasInicial(undefined);
            setCantidadTecleada('');

            /* Cada unidad entra por separado y `agregarAlCarrito` decide si se
               agrupa: dos combos con exactamente los mismos extras quedan como
               una línea de 2, y los que difieren quedan sueltos. Esa es la
               regla que hace que la cocina reciba una comanda legible sin que
               esta pantalla tenga que saber nada de agrupar. */
            setCarrito((c) =>
              unidades.reduce(
                (acumulado, u) => agregarAlCarrito(acumulado, cual, u.extras, u.sobreprecio),
                c,
              ),
            );
            setRecien((r) => ({ clave: `${cual.id}${cual.variante}`, vez: r.vez + 1 }));
            sos.arrancar();
            bip();
            buscador.current?.focus();
          }}
          onCancelar={() => {
            setEnLote(null);
            setExtrasInicial(undefined);
            buscador.current?.focus();
          }}
        />
      )}

      {pidiendoDevolucion && (
        <Devolucion
          onListo={(venta, lineas: LineaDevolvible[], cantidades, medio) => {
            /* Solo viajan las líneas con cantidad. El precio se manda pero Rust
               lo ignora y usa el de la venta: esta pantalla no puede decidir
               cuánta plata sale de la gaveta. */
            const items: LineaVenta[] = lineas
              .map((l, i) => ({
                producto_id: l.producto_id,
                nombre: l.nombre,
                variante: l.variante,
                precio: l.precio,
                cantidad: cantidades[i],
                nota: '',
              }))
              .filter((l) => l.cantidad > 0);

            const total = items.reduce((t, l) => t + l.precio * l.cantidad, 0);
            setPidiendoDevolucion(false);
            setDevolucionPorAutorizar({ venta, items, medio, total });
          }}
          onCancelar={() => { setPidiendoDevolucion(false); buscador.current?.focus(); }}
        />
      )}

      {devolucionPorAutorizar && (
        <Autorizar
          titulo="Autorizar devolución"
          detalle={`Venta #${devolucionPorAutorizar.venta.consecutivo} · salen ${pesos(devolucionPorAutorizar.total)}`}
          onListo={async (motivo, autorizo) => {
            const cual = devolucionPorAutorizar;
            setDevolucionPorAutorizar(null);
            try {
              const d = await devolver(cual.venta.id, cual.items, cual.medio, motivo, autorizo);
              setAvisoCuenta(`Devueltos ${pesos(d.total)} de la venta #${d.consecutivo}`);
              window.setTimeout(() => setAvisoCuenta(''), 6000);
            } catch (e) {
              setError(String(e).replace(/^Error:\s*/, ''));
              bipError();
            } finally {
              buscador.current?.focus();
            }
          }}
          onCancelar={() => { setDevolucionPorAutorizar(null); buscador.current?.focus(); }}
        />
      )}

      {pidiendoDescuento && (
        <Descuento
          total={total}
          items={carrito}
          onListo={(monto, detalle) => {
            setPidiendoDescuento(false);
            setPorAutorizar({ monto, detalle });
          }}
          onCancelar={() => { setPidiendoDescuento(false); buscador.current?.focus(); }}
        />
      )}

      {/* El descuento no existe hasta que un supervisor pone su PIN. Es el
          mismo modal que autoriza una anulación, y a propósito: las dos son la
          misma clase de excepción —plata que sale sin venderse— y tienen que
          verse igual para quien las revisa después. */}
      {porAutorizar && (
        <Autorizar
          titulo="Autorizar descuento"
          detalle={`${porAutorizar.detalle} · se rebajan ${pesos(porAutorizar.monto)}`}
          onListo={async (motivo, autorizo) => {
            const cual = porAutorizar;
            setPorAutorizar(null);
            try {
              await registrarDescuento(cual.detalle, cual.monto, motivo, autorizo);
              setDescuento({ monto: cual.monto, motivo });
            } catch (e) {
              setError(String(e).replace(/^Error:\s*/, ''));
            } finally {
              buscador.current?.focus();
            }
          }}
          onCancelar={() => { setPorAutorizar(null); buscador.current?.focus(); }}
        />
      )}

      {anotando !== null && carrito[anotando] && (
        <NotaItem
          linea={carrito[anotando]}
          onListo={(nota) => {
            setCarrito((c) => c.map((x, i) => (i === anotando ? { ...x, nota } : x)));
            setAnotando(null);
            buscador.current?.focus();
          }}
          onCancelar={() => { setAnotando(null); buscador.current?.focus(); }}
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

      {cobrandoAhora && (
        <CobroMixto
          total={aCobrar}
          /* La propina se pide cuando hay mesas abiertas: es lo que separa un
             restaurante de un mostrador, y en un mostrador preguntar por la
             propina en cada café es un toque de más trescientas veces al día. */
          conPropina={cuentas.length > 0 || enCuenta !== null}
          pidiendoVoucher={digitaVoucher}
          onCambio={setVistaPago}
          onMedio={setMedioElegido}
          onCobrar={cobrarCon}
          onCancelar={() => {
            setCobrandoAhora(false);
            setVistaPago([]);
            setMedioElegido('efectivo');
            buscador.current?.focus();
          }}
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

      {/* ── La cabina: tres columnas que no se mueven ──────────────────────

          Sin scroll global y sin columnas que cambien de ancho. El cajero que
          se sabe dónde está el botón de cobrar tiene que encontrarlo en el
          mismo sitio a las siete de la mañana y a las once de la noche, con la
          pantalla llena o vacía.

          Izquierda: quién es el cliente y en qué modo se atiende.
          Centro: qué se vende.
          Derecha: qué lleva y cuánto es. */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ── Columna 1: cliente y modo de servicio ─────────────────────── */}
        <aside className="w-[264px] flex-shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0 p-3 gap-3 overflow-hidden">
          {/* La tarjeta del cliente. Es lo primero de la columna porque es lo
              primero que pasa en una venta con fidelización: el cliente dice
              su número antes de pedir. */}
          {cliente ? (
            <div className="flex-shrink-0 rounded-xl border-2 border-marca bg-white overflow-hidden">
              <div className="px-3 py-2.5">
                <p className="text-[14px] font-black truncate">{cliente.nombre || 'Sin nombre'}</p>
                <p className="text-[11.5px] text-slate-500 tabular-nums truncate">
                  {cliente.telefono}
                  {cliente.documento ? ` · ${cliente.tipo_documento} ${cliente.documento}` : ''}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="flex items-center gap-1 px-2 h-6 rounded-md bg-slate-100 text-[11.5px] font-black tabular-nums">
                    <Star size={11} strokeWidth={2.5} />
                    {cliente.puntos} pts
                  </span>
                  {cliente.saldo_favor > 0 && (
                    <span className="px-2 h-6 flex items-center rounded-md bg-sky-50 text-sky-700 text-[11px] font-bold tabular-nums">
                      {pesos(cliente.saldo_favor)} a favor
                    </span>
                  )}
                </div>
              </div>

              {/* El aviso de que hay algo que ofrecerle. Es la razón por la que
                  el programa de puntos sirve de algo en el mostrador: sin esto,
                  el cliente acumula y nadie le dice nunca que ya alcanza. */}
              {hayRecompensas && !recompensa && (
                <button
                  onClick={() => setVerRecompensas(true)}
                  className="w-full flex items-center gap-2 px-3 h-toque bg-emerald-600 text-white text-[12.5px] font-black hover:bg-emerald-500"
                >
                  <Gift size={15} strokeWidth={2.5} />
                  Recompensa disponible
                </button>
              )}

              <button
                onClick={soltarCliente}
                className="w-full flex items-center justify-center gap-1.5 px-3 h-9 border-t border-slate-100 text-[11.5px] font-bold text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                <X size={13} strokeWidth={2.5} />
                Quitar cliente
              </button>
            </div>
          ) : (
            <button
              onClick={() => setVerCliente(true)}
              className="flex-shrink-0 flex flex-col items-center justify-center gap-1 h-24 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-marca hover:text-slate-700 active:scale-[0.98] transition-transform duration-75"
            >
              <UserPlus size={22} strokeWidth={2} />
              <span className="text-[13px] font-bold">Asociar cliente</span>
              <span className="text-[10.5px] font-semibold text-slate-400">F1 · tel, cédula o nombre</span>
            </button>
          )}

          {/* La recompensa puesta, con cómo quitarla. Se ve aquí y no solo en
              el total porque el cajero tiene que poder darse cuenta antes de
              cobrar de que está entregando algo gratis. */}
          {recompensa && (
            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <Gift size={16} strokeWidth={2.25} className="flex-shrink-0 text-emerald-700" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-emerald-800 truncate">{recompensa.nombre}</p>
                <p className="text-[10.5px] font-semibold text-emerald-700 tabular-nums">
                  −{recompensa.costo_puntos} puntos al cobrar
                </p>
              </div>
              <button
                onClick={quitarRecompensa}
                aria-label="Quitar la recompensa"
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-emerald-700 hover:bg-emerald-100"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}

          <span className="flex-shrink-0 text-[10.5px] font-black text-slate-400 uppercase tracking-wide px-1">
            Modo de servicio
          </span>

          {/* Mostrador o salón. Se ve siempre —incluso sin cuentas abiertas—
              porque si estuviera escondido hasta tener una, no habría forma de
              abrir la primera. */}
          <div className="flex-shrink-0 flex flex-col gap-1.5">
            {([
              { id: 'catalogo' as const, nombre: 'Mostrador', icono: LayoutGrid },
              { id: 'salon' as const, nombre: 'Mesas', icono: UtensilsCrossed },
            ]).map(({ id, nombre, icono: Icono }) => (
              <button
                key={id}
                onClick={() => setVista(id)}
                className={`flex items-center gap-2 px-3 h-12 rounded-xl text-[13px] font-bold border-2 transition-colors ${
                  vista === id
                    ? 'border-marca bg-marca text-sobre-marca'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <Icono size={16} strokeWidth={2.25} />
                {nombre}
                {id === 'salon' && cuentas.length > 0 && (
                  <span className={`ml-auto px-1.5 rounded-md text-[11px] tabular-nums ${
                    vista === id ? 'bg-black/20' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {cuentas.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* El tamaño o la presentación, para no abrir un modal por algo
              que se decide con un toque. Las opciones salen del catálogo que
              se está viendo: en este sistema la variante es texto libre del
              comerciante, así que un [S][M][L] fijo sería un control muerto.
              Ver `SelectorVariante`. */}
          <SelectorVariante
            variantes={variantesDisponibles}
            elegida={variante}
            onElegir={setVariante}
          />

          {/* El espacio que sobra queda vacío y es deliberado: las categorías
              se fueron arriba de la rejilla, y esta columna vale más con aire
              que con algo metido para llenarla. Lo que viva aquí tiene que ser
              lo que el cajero mira antes de marcar —quién es el cliente y cómo
              se atiende—, no una lista para explorar. */}
          <div className="flex-1 min-h-0" />

          <button
            onClick={() => {
              setCarrito([]);
              setDescuento({ monto: 0, motivo: '' });
              setCliente(null);
              setRecompensa(null);
              sos.reiniciar();
              setError('');
              buscador.current?.focus();
            }}
            disabled={!carrito.length && !cliente}
            className="flex-shrink-0 flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-slate-200 text-[12.5px] font-bold text-slate-500 disabled:opacity-30 hover:border-slate-300 active:scale-[0.98] transition-transform duration-75"
          >
            <Trash2 size={15} strokeWidth={2.25} />
            Limpiar · Esc
          </button>
        </aside>

        {/* ── Columna 2: la rejilla ─────────────────────────────────────── */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0 p-3 gap-2.5 overflow-hidden">
          {avisoCuenta && (
            <span className="flex-shrink-0 flex items-center px-3 h-11 rounded-xl bg-emerald-50 text-emerald-800 text-[12.5px] font-semibold truncate">
              {avisoCuenta}
            </span>
          )}

          {vista === 'salon' ? (
            <Cuentas
              cuentas={cuentas}
              onAbrir={atender}
              onNueva={(identificador) => {
                /* Abrir una mesa vacía es solo ponerle nombre a lo que se va a
                   marcar: la cuenta nace cuando se guarda la primera ronda. */
                setEnCuenta({
                  id: '', turno_id: '', identificador, total: 0, items: 0,
                  creada_en: new Date().toISOString(), actualizada_en: '', carrito: '[]',
                });
                setCarrito([]);
                setVista('catalogo');
                buscador.current?.focus();
              }}
              onPrecuenta={async (c) => {
                try {
                  await imprimirPrecuenta(c.id);
                  setAvisoCuenta(`Precuenta de ${c.identificador} impresa`);
                  window.setTimeout(() => setAvisoCuenta(''), 5000);
                } catch (e) {
                  setError(String(e).replace(/^Error:\s*/, ''));
                }
              }}
              onCobrar={cobrarCuenta}
            />
          ) : (
            <>
              {/* El icono no es decoración: un cajero nuevo no sabe que el
                  lector de códigos funciona sin configurar nada, y esto se lo
                  dice. */}
              <div className="relative flex-shrink-0">
                <ScanLine
                  size={20}
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
                  className="w-full h-12 pl-11 pr-4 rounded-xl border-2 border-slate-200 bg-white text-[15px] outline-none focus:border-marca"
                />
              </div>

              {/* Las categorías, donde el dedo ya está: sobre la rejilla y
                  no en una lista lateral que hay que arrastrar. */}
              <PestanasCategoria rubros={rubros} rubro={rubro} onElegir={setRubro} />

              <CatalogoCuadrante
                productos={productos}
                carpeta={carpeta}
                onTocar={tocar}
                busqueda={busqueda}
                rubro={rubro}
                conAtajos={!hayModal}
              />
            </>
          )}
        </section>

        {/* ── Columna 3: la orden ───────────────────────────────────────── */}
        <aside className="w-[352px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col min-h-0 overflow-hidden">
          {enCuenta && (
            /* Saber de qué mesa es lo que hay en pantalla. Sin esto, el error
               obvio es marcar la ronda de la mesa 3 sobre la cuenta de la 5. */
            <div className="flex items-center justify-between px-3 py-2 bg-marca text-sobre-marca flex-shrink-0">
              <span className="text-[13.5px] font-black truncate">{enCuenta.identificador}</span>
              <button
                onClick={() => { setEnCuenta(null); setCarrito([]); setVista('salon'); }}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-black/20"
                aria-label="Salir de esta mesa"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
            {carrito.map((i, indice) => (
              <div
                key={i.producto_id + i.variante + indice}
                data-linea={`${i.producto_id}${i.variante}`}
                onClick={() => setLineaActiva(indice)}
                className={`flex items-center gap-1.5 p-2 rounded-lg border-2 transition-colors ${
                  lineaActiva === indice
                    ? 'border-marca'
                    : 'border-transparent'
                } ${i.precio === 0 ? 'bg-emerald-50' : 'bg-slate-50'} ${
                  recien.clave === `${i.producto_id}${i.variante}` ? 'recien-agregado' : ''
                }`}
              >
                {/* Tocar la línea la señala; el icono abre la nota. Antes el
                    nombre entero abría la nota, y con la anulación por línea
                    eso dejó de servir: señalar es lo que se hace a cada rato y
                    anotar una vez cada tantas ventas. El icono tiene 44 px de
                    zona tocable aunque se dibuje pequeño. */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-semibold truncate flex items-center gap-1">
                    {i.nombre}{i.variante ? <span className="text-slate-400"> · {i.variante}</span> : null}
                    {yaComandada(indice) && (
                      /* Lo que la cocina ya tiene. Quitarlo pide supervisor, y
                         el cajero tiene que saberlo antes de intentarlo. */
                      <span
                        title="Ya salió a la cocina"
                        className="flex-shrink-0 px-1 rounded text-[9.5px] font-black bg-slate-200 text-slate-500 uppercase"
                      >
                        cocina
                      </span>
                    )}
                  </p>
                  {/* Los extras se leen enteros, igual que la nota: media
                      línea en pantalla es peor que ninguna, porque el cajero
                      cree que ya la revisó. */}
                  {i.extras && i.extras.length > 0 && (
                    <p className="text-[11px] font-semibold text-slate-500 leading-tight">
                      {i.extras.map((e) => (e.cantidad > 1 ? `${e.nombre} x${e.cantidad}` : e.nombre)).join(', ')}
                    </p>
                  )}
                  {i.nota ? (
                    <p className="text-[11px] font-semibold text-amber-700 leading-tight">{i.nota}</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 tabular-nums">{pesos(i.precio)} c/u</p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setAnotando(indice); }}
                  title="Cómo lo pidió el cliente"
                  aria-label="Nota de la línea"
                  className={`flex items-center justify-center w-9 h-10 rounded-lg transition-colors ${
                    i.nota ? 'text-amber-600 bg-amber-50' : 'text-slate-300 hover:text-marca'
                  }`}
                >
                  <MessageSquarePlus size={15} strokeWidth={2.25} />
                </button>
                <button
                  onClick={() => cambiarCantidad(indice, -1)}
                  title="Quitar uno"
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-600 active:scale-95 transition-transform duration-75"
                >
                  <Minus size={16} strokeWidth={3} />
                </button>
                <span className="w-6 text-center font-bold tabular-nums">{i.cantidad}</span>
                <button
                  onClick={() => cambiarCantidad(indice, 1)}
                  title="Agregar uno"
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-600 active:scale-95 transition-transform duration-75"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
                <span className="w-[72px] text-right font-bold tabular-nums text-[13px]">
                  {i.precio === 0 ? 'GRATIS' : pesos(i.precio * i.cantidad)}
                </span>
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

          <div className="flex-shrink-0 p-3 border-t border-slate-200 space-y-2">
            {descuento.monto > 0 && (
              /* El descuento se ve en el carrito y no solo en la tirilla: el
                 cajero tiene que poder darse cuenta de que está cobrando de
                 menos antes de cobrar, no después. */
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-50">
                <span className="text-[12px] font-bold text-amber-800 truncate">
                  Descuento · {descuento.motivo}
                </span>
                <span className="text-[13px] font-black tabular-nums text-amber-800">
                  −{pesos(descuento.monto)}
                </span>
                <button
                  onClick={() => {
                    setDescuento({ monto: 0, motivo: '' });
                    /* Si el descuento venía de una recompensa, quitarlo quita
                       la recompensa: dejarla puesta cobraría los puntos sin
                       darle nada al cliente. */
                    if (recompensa && recompensa.tipo !== 'free_product') setRecompensa(null);
                  }}
                  aria-label="Quitar el descuento"
                  className="flex items-center justify-center w-10 h-10 ml-1 rounded-lg text-amber-700 hover:bg-amber-100"
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
              </div>
            )}

            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-500">Total</span>
              <span className="text-3xl font-black tabular-nums">{pesos(aCobrar)}</span>
            </div>

            {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

            {/* Las acciones de la orden, en un riel de cuatro. El que más se
                toca del día —cobrar— va aparte y grande: es el único que tiene
                que encontrarse sin mirar. */}
            <div className="grid grid-cols-5 gap-1.5">
              {/* La otra mitad del combo sin modal: entra con lo estándar y
                  esto es lo que se toca cuando el cliente pide algo distinto.
                  Va primero porque en un mostrador se modifica más de lo que se
                  anula. */}
              <BotonOrden
                icono={Pencil}
                texto="Modificar"
                atajo="F7"
                onClick={() => lineaActiva !== null && modificarLinea(lineaActiva)}
                disabled={lineaActiva === null}
                title={
                  lineaActiva === null
                    ? 'Toca primero la línea que quieres cambiar'
                    : 'Cambiar los extras de esta línea'
                }
              />
              <BotonOrden
                icono={XCircle}
                texto="Anular"
                atajo="F4"
                onClick={() => lineaActiva !== null && anularLinea(lineaActiva)}
                disabled={lineaActiva === null}
                title={
                  lineaActiva === null
                    ? 'Toca primero la línea que quieres quitar'
                    : yaComandada(lineaActiva)
                      ? 'Ya salió a cocina: lo autoriza un supervisor'
                      : 'Quitar esta línea del pedido'
                }
              />
              <BotonOrden
                icono={Percent}
                texto="Dcto"
                atajo="F3"
                onClick={() => setPidiendoDescuento(true)}
                disabled={!carrito.length}
                title="Rebajarle a la cuenta. Lo autoriza un supervisor."
              />
              <BotonOrden
                icono={Gift}
                texto="Puntos"
                atajo="F6"
                onClick={() => setVerRecompensas(true)}
                disabled={!cliente}
                resaltado={hayRecompensas && !recompensa}
                title={cliente ? 'Canjear puntos del cliente' : 'Primero asocia un cliente (F1)'}
              />
              <BotonOrden
                icono={PauseCircle}
                texto="Espera"
                atajo="F5"
                onClick={pausar}
                disabled={!carrito.length}
                title="Aparta este pedido y atiende al siguiente"
              />
            </div>

            <div className="flex gap-2">
              {/* Atendiendo una mesa, lo que se hace nueve de cada diez veces
                  es mandar la ronda a la cocina, no cobrar: el cobro llega una
                  vez, al final. Por eso el botón grande cambia. */}
              {enCuenta && (
                <button
                  onClick={mandarACuenta}
                  disabled={!carrito.length}
                  className="flex-1 flex flex-col items-center justify-center h-16 rounded-xl bg-marca text-sobre-marca text-[14px] font-black disabled:opacity-30 active:scale-95 transition-transform duration-75"
                >
                  Mandar a {enCuenta.identificador}
                  <span className="text-[10px] font-semibold opacity-70">solo lo nuevo va a cocina</span>
                </button>
              )}
              <button
                onClick={() => finalizar()}
                disabled={!carrito.length || cobrando}
                className={`${enCuenta ? 'w-24' : 'flex-1'} flex items-center justify-center gap-2.5 h-16 rounded-xl ${
                  enCuenta ? 'border-2 border-slate-200 text-slate-600' : 'bg-marca text-sobre-marca'
                } text-lg font-black disabled:opacity-30 active:scale-95 transition-transform duration-75`}
              >
                {cobrando
                  ? <RefreshCw size={20} strokeWidth={2.5} className="animate-spin" />
                  : <Wallet size={20} strokeWidth={2.5} />}
                {cobrando ? 'Cobrando…' : 'Cobrar · F2'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Un botón de acción de la orden.
 *
 * Existe por lo mismo que `BotonBarra`: para que el alto y el atajo dejen de
 * ser una decisión que se toma tres veces y salga distinta cada vez.
 */
function BotonOrden({
  icono: Icono,
  texto,
  atajo,
  resaltado = false,
  ...resto
}: {
  icono: typeof Percent;
  texto: string;
  atajo: string;
  resaltado?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...resto}
      className={`flex flex-col items-center justify-center gap-0.5 h-16 rounded-xl border-2 text-[12px] font-bold disabled:opacity-30 active:scale-95 transition-transform duration-75 ${
        resaltado
          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
          : 'border-slate-200 text-slate-600'
      }`}
    >
      <Icono size={17} strokeWidth={2.25} />
      {texto}
      <span className={`text-[10px] font-semibold ${resaltado ? 'text-emerald-600' : 'text-slate-400'}`}>
        {atajo}
      </span>
    </button>
  );
}

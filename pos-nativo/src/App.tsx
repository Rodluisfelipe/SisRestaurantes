import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleUser, CloudCheck, CloudOff, Inbox, Minus, Monitor,
  LayoutGrid, MessageSquarePlus, PauseCircle, Percent, Plus, Printer, RefreshCw, ScanLine,
  Trash2, Undo2, UtensilsCrossed, Volume2, VolumeX, Wallet, X,
} from 'lucide-react';
import {
  abrirCajon, abrirPantallaCliente, anularItem, aplicarMarca, catalogo, cerrarPantallaCliente,
  abrirCuenta, carpetaFotos, categorias, cerrarCuenta, cobrar, descartarPausada, devolver, enTauri, estadoSync,
  guardarEnCuenta, hayPantallaCliente, identidad, imprimirPrecuenta, infoTerminal, listarCuentas,
  listarPausadas, mostrarAlCliente, pausarVenta, pesos, reimprimir, retomarVenta, salir,
  registrarDescuento, repartir, sincronizar, turnoActivo,
  type CierreTurno, type Cobro, type Cuenta, type EnEspera, type ExtraElegido,
  type LineaDevolvible, type LineaVenta, type PagoDetalle, type Producto, type Turno,
  type Usuario, type VentaBuscada,
} from './nativo';
import ModalMotivo from './ModalMotivo';
import CobroMixto from './CobroMixto';
import NotaItem from './NotaItem';
import Descuento from './Descuento';
import Cuentas from './Cuentas';
import FotoProducto from './FotoProducto';
import Devolucion from './Devolucion';
import Extras from './Extras';
import { activarSonido, bip, error as bipError, sonidoActivo } from './sonido';
import PantallaPin from './PantallaPin';
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
  const [pidiendoDevolucion, setPidiendoDevolucion] = useState(false);
  const [devolucionPorAutorizar, setDevolucionPorAutorizar] = useState<
    { venta: VentaBuscada; items: LineaVenta[]; medio: string; total: number } | null
  >(null);

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
    setEnCuenta(c);
    setVista('catalogo');
    setVistaPago([]);
    setCobrandoAhora(true);
  };

  useEffect(() => {
    catalogo(busqueda, rubro).then(setProductos).catch(() => setProductos([]));
  }, [busqueda, rubro]);

  /* Las categorías se piden una vez: cambian cuando baja catálogo nuevo, no
     mientras el cajero atiende. */
  useEffect(() => { categorias().then(setRubros).catch(() => {}); }, []);

  useEffect(() => { carpetaFotos().then(setCarpeta).catch(() => {}); }, []);

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
    mostrarAlCliente({
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
    });
  }, [carrito, aCobrar, negocio, cobrandoAhora, entregado, vuelto, falta]);

  /* Un producto con extras no entra de una: primero hay que preguntar cómo lo
     quiere el cliente. Sin esto —que es como estaba— el cajero marcaba la
     hamburguesa, entraba el precio base, y ni el cliente pagaba el queso ni la
     cocina se enteraba de que lo llevaba. */
  const tocar = (p: Producto) => {
    if (Array.isArray(p.extras) && p.extras.length) {
      setConExtras(p);
      return;
    }
    agregar(p);
  };

  const agregar = (p: Producto, extras: ExtraElegido[] = [], sobreprecio = 0) => {
    setCarrito((c) => {
      /* Dos líneas del mismo producto con extras distintos son dos líneas
         distintas: una hamburguesa con queso y otra sin él no se pueden sumar,
         porque la cocina tiene que recibir las dos por separado. */
      const mismosExtras = (a: ExtraElegido[] = [], b: ExtraElegido[] = []) =>
        a.length === b.length &&
        a.every((x, k) => x.nombre === b[k]?.nombre && x.cantidad === b[k]?.cantidad);

      const i = c.findIndex(
        (x) => x.producto_id === p.id && x.variante === p.variante && mismosExtras(x.extras, extras),
      );
      if (i >= 0) {
        const copia = [...c];
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
        return copia;
      }
      return [...c, {
        producto_id: p.id, nombre: p.nombre, variante: p.variante,
        /* El precio de la línea es el precio **como se vendió**: base más
           extras. Que sea así es lo que permite que toda la aritmética de la
           caja —totales, vuelto, arqueo, devoluciones— siga intacta. */
        precio: p.precio + sobreprecio,
        cantidad: 1, nota: '', extras,
      }];
    });
    setRecien((r) => ({ clave: `${p.id}${p.variante}`, vez: r.vez + 1 }));
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
      });
      setUltimo(r);
      setCarrito([]);
      setVistaPago([]);
      setDescuento({ monto: 0, motivo: '' });

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

  /* F2 cobra y Escape limpia. Se escucha en la ventana y no en un botón para
     que funcione sin importar dónde esté el foco. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); finalizar(); }
      if (e.key === 'F4') { e.preventDefault(); pausar(); }
      if (e.key === 'F3') { e.preventDefault(); if (carrito.length) setPidiendoDescuento(true); }
      if (e.key === 'Escape' && !cobrandoAhora) {
        setCarrito([]);
        setDescuento({ monto: 0, motivo: '' });
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

      {conExtras && (
        <Extras
          producto={conExtras}
          onListo={(extras, sobreprecio) => {
            const cual = conExtras;
            setConExtras(null);
            agregar(cual, extras, sobreprecio);
          }}
          onCancelar={() => { setConExtras(null); buscador.current?.focus(); }}
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
          onCobrar={cobrarCon}
          onCancelar={() => { setCobrandoAhora(false); setVistaPago([]); buscador.current?.focus(); }}
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
          {/* Mostrador o salón. Se ve siempre —incluso sin cuentas abiertas—
              porque si estuviera escondido hasta tener una, no habría forma de
              abrir la primera. */}
          <div className="flex gap-1.5 flex-shrink-0">
            {([
              { id: 'catalogo' as const, nombre: 'Mostrador', icono: LayoutGrid },
              { id: 'salon' as const, nombre: 'Mesas', icono: UtensilsCrossed },
            ]).map(({ id, nombre, icono: Icono }) => (
              <button
                key={id}
                onClick={() => setVista(id)}
                className={`flex items-center gap-2 px-4 h-toque rounded-xl text-[13px] font-bold border-2 transition-colors ${
                  vista === id
                    ? 'border-marca bg-marca text-sobre-marca'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <Icono size={16} strokeWidth={2.25} />
                {nombre}
                {id === 'salon' && cuentas.length > 0 && (
                  <span className={`ml-1 px-1.5 rounded-md text-[11px] tabular-nums ${
                    vista === id ? 'bg-black/20' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {cuentas.length}
                  </span>
                )}
              </button>
            ))}

            {avisoCuenta && (
              <span className="flex items-center px-3 h-toque rounded-xl bg-emerald-50 text-emerald-800 text-[12.5px] font-semibold truncate">
                {avisoCuenta}
              </span>
            )}
          </div>

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

          {/* Las pestañas. Con cuarenta platos en carta, buscar por texto es
              más lento que tocar: el cajero se sabe la carta por secciones, no
              por nombres exactos. Se ocultan si el negocio no usa categorías,
              porque una sola pestaña que dice "Todos" no es navegación. */}
          {rubros.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto flex-shrink-0 pb-1">
              {['', ...rubros].map((r) => (
                <button
                  key={r || 'todos'}
                  onClick={() => setRubro(r)}
                  className={`flex-shrink-0 px-4 h-toque rounded-xl text-[13px] font-bold border-2 transition-colors ${
                    rubro === r
                      ? 'border-marca bg-marca text-sobre-marca'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {r || 'Todos'}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            {productos.map((p) => (
              <button
                key={p.id + p.variante}
                onClick={() => tocar(p)}
                className="h-40 rounded-xl bg-white border border-slate-200 text-left hover:border-marca active:scale-95 active:border-marca transition-transform duration-75 flex flex-col overflow-hidden"
              >
                {/* La foto ocupa más que el texto a propósito: un cajero la
                    reconoce sin leer, y eso son décimas de segundo por
                    producto multiplicadas por trescientas ventas al día. */}
                <div className="h-20 w-full flex-shrink-0 bg-slate-100">
                  <FotoProducto nombre={p.nombre} archivo={p.foto} carpeta={carpeta} />
                </div>
                <div className="flex-1 p-2.5 flex flex-col justify-between min-h-0">
                  <span className="text-[13px] font-semibold leading-tight line-clamp-2">
                    {p.nombre}{p.variante ? ` · ${p.variante}` : ''}
                  </span>
                  <span className="text-[15px] font-black tabular-nums">{pesos(p.precio)}</span>
                </div>
              </button>
            ))}
            {productos.length === 0 && (
              <p className="col-span-full text-center text-slate-400 py-10 text-sm">
                {rubro
                  ? `Nada en "${rubro}".`
                  : busqueda
                    ? `Nada que coincida con "${busqueda}".`
                    : 'Sin productos. El catálogo se replica desde la nube a la base local.'}
              </p>
            )}
          </div>
          </>
          )}
        </section>

        {/* Carrito */}
        <aside className="w-[380px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col">
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

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {carrito.map((i, indice) => (
              <div
                key={i.producto_id + i.variante}
                data-linea={`${i.producto_id}${i.variante}`}
                className={`flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 ${
                  recien.clave === `${i.producto_id}${i.variante}` ? 'recien-agregado' : ''
                }`}
              >
                {/* Tocar el nombre abre la nota. No hay botón aparte porque
                    en el carrito no sobra un milímetro, y el nombre es lo más
                    grande que hay: es el objetivo más fácil de acertar. */}
                <button
                  onClick={() => setAnotando(indice)}
                  title="Cómo lo pidió el cliente"
                  className="flex-1 min-w-0 text-left group"
                >
                  <p className="text-[13px] font-semibold truncate flex items-center gap-1">
                    {i.nombre}{i.variante ? <span className="text-slate-400"> · {i.variante}</span> : null}
                    <MessageSquarePlus
                      size={13}
                      strokeWidth={2.25}
                      className="flex-shrink-0 text-slate-300 group-hover:text-marca"
                    />
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
                </button>
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
            {/* El total y nada más. Con qué se paga se decide en la pantalla de
                cobro, porque desde que una venta puede repartirse entre varios
                medios ya no cabe en dos botones. El carrito vuelve a ser lo que
                es: la lista de lo que se lleva. */}
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
                  onClick={() => setDescuento({ monto: 0, motivo: '' })}
                  aria-label="Quitar el descuento"
                  className="flex items-center justify-center w-toque h-toque ml-1 rounded-lg text-amber-700 hover:bg-amber-100"
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

            <div className="flex gap-2">
              <button
                onClick={() => setPidiendoDescuento(true)}
                disabled={!carrito.length}
                title="Rebajarle a la cuenta. Lo autoriza un supervisor."
                className="flex flex-col items-center justify-center gap-0.5 w-20 h-16 rounded-xl border-2 border-slate-200 text-[12px] font-bold text-slate-600 disabled:opacity-30 active:scale-95 transition-transform duration-75"
              >
                <Percent size={18} strokeWidth={2.25} />
                Dcto
                <span className="text-[10px] font-semibold text-slate-400">F3</span>
              </button>
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
              {/* Atendiendo una mesa, lo que se hace nueve de cada diez veces
                  es mandar la ronda a la cocina, no cobrar: el cobro llega una
                  vez, al final. Por eso el botón grande cambia. */}
              {enCuenta && (
                <button
                  onClick={mandarACuenta}
                  disabled={!carrito.length}
                  className="flex-1 flex flex-col items-center justify-center h-16 rounded-xl bg-marca text-sobre-marca text-[15px] font-black disabled:opacity-30 active:scale-95 transition-transform duration-75"
                >
                  Mandar a {enCuenta.identificador}
                  <span className="text-[10px] font-semibold opacity-70">solo lo nuevo va a cocina</span>
                </button>
              )}
              {/* El botón que más se toca del día lleva el color del negocio.
                  Es lo único de esta pantalla que tiene que encontrarse sin
                  mirar. */}
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

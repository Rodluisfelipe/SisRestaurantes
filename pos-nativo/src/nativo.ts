/**
 * El puente con Rust.
 *
 * Todo lo que la caja necesita pasa por aquí, y por aquí solamente: así la
 * interfaz no sabe si detrás hay un `invoke` de Tauri, y se puede abrir en un
 * navegador normal para trabajar en el diseño sin compilar Rust.
 *
 * Fuera de Tauri devuelve datos de mentira. Eso es a propósito y es visible en
 * pantalla (la barra dice "modo navegador"): un POS que finge cobrar sin
 * avisar sería peligroso.
 */
import { invoke } from '@tauri-apps/api/core';

export const enTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  categoria: string;
  variante: string;
  /** Nombre del archivo de su foto en disco. Vacío = no tiene o no bajó aún. */
  foto: string;
}

export interface LineaVenta {
  producto_id: string;
  nombre: string;
  variante: string;
  precio: number;
  cantidad: number;
  /** Cómo lo pidió el cliente: "sin cebolla", "término tres cuartos". */
  nota?: string;
}

/** Los medios que acepta la caja. El orden es el que se ve en pantalla. */
export const MEDIOS = ['efectivo', 'tarjeta', 'transferencia'] as const;
export type Medio = (typeof MEDIOS)[number];

/**
 * Un pago. Una venta puede tener varios.
 *
 * El pago mixto —parte en efectivo y el resto con tarjeta— es diario en
 * mostrador. Cada línea es un cobro real, y su suma tiene que alcanzar el
 * total; el reparto y el vuelto los decide Rust, no esta pantalla.
 */
export interface PagoDetalle {
  metodo: Medio | string;
  monto: number;
  referencia?: string;
}

export interface NuevaVenta {
  items: LineaVenta[];
  medio_pago: string;
  recibido: number;
  cajero: string;
  turno_id: string;
  iva_porcentaje: number;
  /** Vacío = un solo medio, el de `medio_pago`. */
  pagos?: PagoDetalle[];
  /** Lo que se le rebaja al total. Ya autorizado por un supervisor. */
  descuento?: number;
  descuento_motivo?: string;
}

/**
 * Cuánto falta por cobrar y cuánto hay que devolver.
 *
 * Es la misma regla que aplica Rust al guardar, repetida aquí solo para pintar
 * la pantalla mientras el cajero teclea. **No decide nada**: la venta la valida
 * el núcleo, y si las dos cuentas no coincidieran, la que manda es la de allá.
 */
export function repartir(total: number, pagos: PagoDetalle[]): { falta: number; vuelto: number } {
  const suma = (cuales: PagoDetalle[]) => cuales.reduce((t, p) => t + (p.monto || 0), 0);

  const noEfectivo = suma(pagos.filter((p) => p.metodo !== 'efectivo'));
  const efectivo = suma(pagos.filter((p) => p.metodo === 'efectivo'));

  // Lo que no es efectivo ya está cobrado y no admite vuelto.
  const porCubrir = Math.max(0, total - noEfectivo);

  return {
    falta: Math.max(0, porCubrir - efectivo),
    vuelto: Math.max(0, efectivo - porCubrir),
  };
}

export interface VentaRegistrada {
  id: string;
  consecutivo: number;
  total: number;
  iva: number;
  vuelto: number;
  creada_en: string;
}

export interface Cobro {
  venta: VentaRegistrada;
  /** Aviso de la impresora. La venta ya está guardada aunque esto venga lleno. */
  impresion: string | null;
}

/* Catálogo de prueba para trabajar la interfaz en el navegador. */
const DEMO: Producto[] = [
  { id: 'd1', nombre: 'Café americano', precio: 4500, categoria: 'Bebidas', variante: '', foto: '' },
  { id: 'd2', nombre: 'Capuchino', precio: 7000, categoria: 'Bebidas', variante: '', foto: '' },
  { id: 'd3', nombre: 'Croissant', precio: 5500, categoria: 'Panadería', variante: '', foto: '' },
  { id: 'd4', nombre: 'Sándwich de pollo', precio: 15900, categoria: 'Comida', variante: '', foto: '' },
  { id: 'd5', nombre: 'Jugo de naranja', precio: 6500, categoria: 'Bebidas', variante: '', foto: '' },
  { id: 'd6', nombre: 'Torta de chocolate', precio: 8900, categoria: 'Postres', variante: '', foto: '' },
];

export async function catalogo(busqueda: string, categoria = ''): Promise<Producto[]> {
  if (!enTauri) {
    const b = busqueda.trim().toLowerCase();
    return DEMO.filter(
      (p) => (!b || p.nombre.toLowerCase().includes(b)) && (!categoria || p.categoria === categoria),
    );
  }
  return invoke<Producto[]>('catalogo', { busqueda, categoria: categoria || null });
}

/**
 * Las categorías con algo que vender.
 *
 * Alimentan las pestañas de la rejilla. Buscar por texto funciona bien con
 * veinte productos y deja de funcionar con cuarenta platos en carta: el cajero
 * no se sabe los nombres exactos y el lector no sirve para un plato.
 */
export async function categorias(): Promise<string[]> {
  if (!enTauri) return [...new Set(DEMO.map((p) => p.categoria))].sort();
  return invoke<string[]>('categorias');
}

/**
 * Dónde guarda la caja las fotos del catálogo.
 *
 * La resuelve Rust porque depende del sistema operativo y del usuario. Se pide
 * una vez al arrancar: no cambia mientras la app corre.
 */
export async function carpetaFotos(): Promise<string> {
  if (!enTauri) return '';
  return invoke<string>('carpeta_fotos');
}

export interface Voucher {
  codigo_autorizacion: string;
  ultimos_cuatro: string;
  franquicia: string;
}

export interface InfoTerminal {
  nombre: string;
  /** Si es true, la caja le pide el voucher al cajero. */
  requiere_digitacion: boolean;
}

export async function infoTerminal(): Promise<InfoTerminal> {
  if (!enTauri) return { nombre: 'Datáfono (voucher a mano)', requiere_digitacion: true };
  return invoke<InfoTerminal>('info_terminal');
}

/**
 * Cobra.
 *
 * Con tarjeta, el cobro pasa **primero** por el datáfono y solo si eso sale
 * bien se registra la venta: al revés quedaría una venta de un cobro que el
 * banco rechazó.
 */
export async function cobrar(nueva: NuevaVenta, voucher?: Voucher): Promise<Cobro> {
  if (!enTauri) {
    const total = nueva.items.reduce((t, i) => t + i.precio * i.cantidad, 0);
    return {
      venta: {
        id: 'demo',
        consecutivo: 0,
        total,
        iva: 0,
        vuelto: Math.max(0, nueva.recibido - total),
        creada_en: new Date().toISOString(),
      },
      impresion: 'Modo navegador: no se imprimió ni se guardó nada.',
    };
  }
  return invoke<Cobro>('cobrar', { nueva, voucher: voucher ?? null });
}

export interface EstadoSync {
  pendientes: number;
  /** Lo que la nube rechazó: alguien tiene que mirarlo. */
  apartadas: number;
}

export async function estadoSync(): Promise<EstadoSync> {
  if (!enTauri) return { pendientes: 0, apartadas: 0 };
  return invoke<EstadoSync>('estado_sync');
}

export interface ResumenSync {
  enviadas: number;
  fallidas: number;
  apartadas: number;
  catalogo: number;
  error: string | null;
}

/** Sube lo pendiente y baja el catálogo. También corre solo cada 30 s. */
export async function sincronizar(): Promise<ResumenSync> {
  if (!enTauri) return { enviadas: 0, fallidas: 0, apartadas: 0, catalogo: 0, error: 'Modo navegador' };
  return invoke<ResumenSync>('sincronizar');
}

export interface Identidad {
  nombre: string;
  color: string;
  color_texto: string;
}

/**
 * Cómo se llama el negocio y de qué color es.
 *
 * Llega con la bajada del catálogo, así que una caja recién instalada devuelve
 * todo vacío y la pantalla se queda con los colores de MenuBy. Eso es lo
 * correcto: es preferible una caja sin personalizar a una caja con un botón de
 * cobrar invisible.
 */
export async function identidad(): Promise<Identidad> {
  if (!enTauri) return { nombre: '', color: '', color_texto: '' };
  return invoke<Identidad>('identidad');
}

/**
 * Pinta la pantalla con el color del negocio.
 *
 * Se toca una variable CSS y no cada botón: así el color vive en un solo sitio
 * y las dos ventanas —la caja y la del cliente— lo toman igual.
 */
export function aplicarMarca(quien: Identidad): void {
  const raiz = document.documentElement;

  /* Se comprueba aquí otra vez aunque Rust ya lo haya validado al guardarlo.
     No es desconfianza del backend: es que este valor termina dentro de una
     hoja de estilos, y lo que se mete en una hoja de estilos se valida en el
     sitio donde se mete. Un color ilegible deja el botón de cobrar invisible,
     que en una caja es lo mismo que no poder cobrar. */
  if (luminancia(quien.color) === null) return;

  raiz.style.setProperty('--marca', quien.color);
  raiz.style.setProperty('--marca-viva', quien.color);
  /* El color del texto no se hereda del panel a ciegas: si el negocio tiene
     marca amarilla con letra blanca —que en una web con sombras se lee y en un
     botón plano no—, el botón de cobrar quedaría ilegible. Se decide por
     luminancia y solo se respeta el del panel cuando contrasta. */
  raiz.style.setProperty('--sobre-marca', contraste(quien.color, quien.color_texto));
}

/** Blanco o negro sobre un fondo, lo que se lea mejor. */
function contraste(fondo: string, preferido: string): string {
  const luz = luminancia(fondo);
  if (luz === null) return '#ffffff';

  const suyo = luminancia(preferido);
  // La diferencia mínima para que un texto se distinga de su fondo de un vistazo.
  if (suyo !== null && Math.abs(suyo - luz) > 0.45) return preferido;
  return luz > 0.55 ? '#0f172a' : '#ffffff';
}

/** 0 = negro, 1 = blanco. Null si el color no es un hexadecimal. */
function luminancia(hex: string): number | null {
  const limpio = (hex || '').trim().replace('#', '');
  const largo = limpio.length === 3
    ? limpio.split('').map((c) => c + c).join('')
    : limpio;
  if (largo.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(largo)) return null;

  const [r, g, b] = [0, 2, 4].map((i) => parseInt(largo.slice(i, i + 2), 16) / 255);
  // Pesos de la percepción humana: el verde ilumina mucho más que el azul.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* ── Cuentas abiertas ───────────────────────────────────────────────────────
   La mesa que pide en tandas y paga al final. */

export interface Cuenta {
  id: string;
  turno_id: string;
  /** "Mesa 3", "Barra 1". Es lo que el mesero dice en voz alta. */
  identificador: string;
  total: number;
  items: number;
  creada_en: string;
  actualizada_en: string;
  /** El pedido completo, en JSON. */
  carrito: string;
}

export interface RondaGuardada {
  cuenta: Cuenta;
  /** Cuántas líneas bajaron a la cocina en esta ronda. */
  a_cocina: number;
  /** Qué salió mal con la impresora. La cuenta quedó guardada igual. */
  impresion: string | null;
}

/**
 * Abre la cuenta o le agrega la ronda que acaba de pedir la mesa.
 *
 * A la cocina baja **solo lo nuevo**. Quién decide qué es nuevo vive en Rust y
 * se apoya en lo que ya se imprimió, guardado en disco: por eso un corte de luz
 * entre dos rondas no hace que la mesa reciba dos veces su comida.
 */
export async function guardarEnCuenta(
  identificador: string,
  carrito: LineaVenta[],
  total: number,
  items: number,
): Promise<RondaGuardada> {
  if (!enTauri) {
    return {
      cuenta: {
        id: 'demo', turno_id: 't', identificador, total, items,
        creada_en: new Date().toISOString(), actualizada_en: new Date().toISOString(),
        carrito: JSON.stringify(carrito),
      },
      a_cocina: carrito.length,
      impresion: null,
    };
  }
  return invoke<RondaGuardada>('guardar_en_cuenta', {
    identificador,
    carrito: JSON.stringify(carrito),
    total,
    items,
  });
}

export async function listarCuentas(): Promise<Cuenta[]> {
  if (!enTauri) return [];
  return invoke<Cuenta[]>('listar_cuentas');
}

/** Devuelve el pedido de la cuenta **sin cerrarla**: la mesa sigue sentada. */
export async function abrirCuenta(id: string): Promise<LineaVenta[] | null> {
  if (!enTauri) return null;
  const crudo = await invoke<string | null>('abrir_cuenta', { id });
  return crudo ? (JSON.parse(crudo) as LineaVenta[]) : null;
}

/** El papel que el cliente revisa antes de pagar. No abre el cajón. */
export async function imprimirPrecuenta(id: string): Promise<void> {
  if (!enTauri) throw new Error('Solo en la app instalada');
  await invoke('imprimir_precuenta', { id });
}

/** Se llama después de que la venta de esa cuenta ya quedó registrada. */
export async function cerrarCuenta(id: string): Promise<void> {
  if (!enTauri) return;
  await invoke('cerrar_cuenta', { id });
}

/** Abrir la gaveta sin venta. No pide supervisor, pero queda registrado. */
export async function abrirCajon(motivo: string): Promise<void> {
  if (!enTauri) return;
  await invoke('abrir_cajon', { motivo });
}

/** Pesos colombianos, sin decimales. */
export const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

/* ── Quién está en la caja y de qué turno responde ────────────────────── */

export interface Usuario {
  id: string;
  nombre: string;
  rol: 'cajero' | 'supervisor';
}

export interface Turno {
  id: string;
  usuario_id: string;
  cajero: string;
  abierto_en: string;
  fondo_inicial: number;
  estado: string;
}

export interface CierreTurno {
  turno_id: string;
  cajero: string;
  abierto_en: string;
  cerrado_en: string;
  fondo_inicial: number;
  ventas_efectivo: number;
  ventas_otros: number;
  entradas: number;
  salidas: number;
  esperado: number;
  contado: number;
  /** Negativo = falta plata en la gaveta. */
  diferencia: number;
  ventas: number;
}

/* En modo navegador hay una sesión de mentira para poder diseñar las pantallas
   sin compilar Rust. Nunca toca la base ni cobra. */
const DEMO_USUARIO: Usuario = { id: 'demo', nombre: 'Demo', rol: 'supervisor' };
let demoTurno: Turno | null = null;

export async function entrar(pin: string): Promise<Usuario> {
  if (!enTauri) {
    if (pin.length < 4) throw new Error('PIN incorrecto');
    return DEMO_USUARIO;
  }
  return invoke<Usuario>('entrar', { pin });
}

export async function salir(): Promise<void> {
  if (!enTauri) return;
  await invoke('salir');
}

export async function hayUsuarios(): Promise<boolean> {
  if (!enTauri) return true;
  return invoke<boolean>('hay_usuarios');
}

export async function crearUsuario(nombre: string, pin: string, supervisor: boolean): Promise<Usuario> {
  if (!enTauri) return DEMO_USUARIO;
  return invoke<Usuario>('crear_usuario', { nombre, pin, supervisor });
}

export async function turnoActivo(): Promise<Turno | null> {
  if (!enTauri) return demoTurno;
  return invoke<Turno | null>('turno_activo');
}

export async function abrirTurno(fondo: number): Promise<Turno> {
  if (!enTauri) {
    demoTurno = {
      id: 'demo-turno', usuario_id: 'demo', cajero: 'Demo',
      abierto_en: new Date().toISOString(), fondo_inicial: fondo, estado: 'ABIERTO',
    };
    return demoTurno;
  }
  return invoke<Turno>('abrir_turno', { fondo });
}

export async function moverEfectivo(entrada: boolean, monto: number, motivo: string): Promise<void> {
  if (!enTauri) return;
  await invoke('mover_efectivo', { entrada, monto, motivo });
}

/**
 * Cierra el turno con lo contado.
 *
 * No existe ninguna función que devuelva el esperado antes de contar, y eso es
 * deliberado: si la pantalla pudiera soplarlo, quien tomó plata escribiría esa
 * cifra exacta y el faltante nunca aparecería.
 */
export async function cerrarTurno(contado: number): Promise<CierreTurno> {
  if (!enTauri) {
    demoTurno = null;
    return {
      turno_id: 'demo', cajero: 'Demo', abierto_en: '', cerrado_en: new Date().toISOString(),
      fondo_inicial: 0, ventas_efectivo: 0, ventas_otros: 0, entradas: 0, salidas: 0,
      esperado: 0, contado, diferencia: contado, ventas: 0,
    };
  }
  return invoke<CierreTurno>('cerrar_turno', { contado });
}

/* ── La fila de la hora pico ──────────────────────────────────────────── */

export interface EnEspera {
  id: string;
  turno_id: string;
  etiqueta: string;
  total: number;
  items: number;
  creada_en: string;
  carrito: string;
}

let demoEspera: EnEspera[] = [];

/** Aparta el carrito para cobrarle al siguiente de la fila. */
export async function pausarVenta(
  carrito: LineaVenta[],
  etiqueta: string,
  total: number,
): Promise<EnEspera> {
  const payload = JSON.stringify(carrito);
  const items = carrito.reduce((t, i) => t + i.cantidad, 0);

  if (!enTauri) {
    const ficha: EnEspera = {
      id: String(Date.now()), turno_id: 'demo', etiqueta, total, items,
      creada_en: new Date().toISOString(), carrito: payload,
    };
    demoEspera = [...demoEspera, ficha];
    return ficha;
  }
  return invoke<EnEspera>('pausar_venta', { carrito: payload, etiqueta, total, items });
}

export async function listarPausadas(): Promise<EnEspera[]> {
  if (!enTauri) return demoEspera;
  return invoke<EnEspera[]>('listar_pausadas');
}

/** Devuelve el carrito y lo saca de la lista: retomar no deja copia. */
export async function retomarVenta(id: string): Promise<LineaVenta[] | null> {
  if (!enTauri) {
    const ficha = demoEspera.find((p) => p.id === id);
    demoEspera = demoEspera.filter((p) => p.id !== id);
    return ficha ? (JSON.parse(ficha.carrito) as LineaVenta[]) : null;
  }
  const carrito = await invoke<string | null>('retomar_venta', { id });
  return carrito ? (JSON.parse(carrito) as LineaVenta[]) : null;
}

export async function descartarPausada(id: string, motivo: string): Promise<void> {
  if (!enTauri) {
    demoEspera = demoEspera.filter((p) => p.id !== id);
    return;
  }
  await invoke('descartar_pausada', { id, motivo });
}

/* ── Autorizaciones de supervisor ─────────────────────────────────────── */

/**
 * Verifica el PIN de un supervisor **sin cambiar la sesión**.
 *
 * El supervisor autoriza y se va; el turno sigue siendo del cajero. Si la
 * sesión cambiara, la trazabilidad del turno se borraría de un plumazo.
 */
export async function autorizar(pin: string): Promise<string> {
  if (!enTauri) {
    if (pin.length < 4) throw new Error('PIN incorrecto');
    return 'Supervisor demo';
  }
  return invoke<string>('autorizar', { pin });
}

export async function anularItem(
  detalle: string,
  monto: number,
  motivo: string,
  autorizo: string,
): Promise<void> {
  if (!enTauri) return;
  await invoke('anular_item', { detalle, monto, motivo, autorizo });
}

export async function registrarDescuento(
  detalle: string,
  monto: number,
  motivo: string,
  autorizo: string,
): Promise<void> {
  if (!enTauri) return;
  await invoke('registrar_descuento', { detalle, monto, motivo, autorizo });
}

/* ── La pantalla del cliente ──────────────────────────────────────────── */

export interface ItemCliente {
  nombre: string;
  cantidad: number;
  total: number;
}

/**
 * Lo que se le muestra al cliente. Un solo objeto y un solo evento: la pantalla
 * de allá no calcula nada ni consulta nada, solo pinta lo que le llega.
 */
export interface EstadoCliente {
  modo: 'espera' | 'venta' | 'pago' | 'gracias';
  negocio?: string;
  mensaje?: string;
  items?: ItemCliente[];
  total?: number;
  recibido?: number;
  vuelto?: number;
  /** Lo que todavía falta por cubrir, cuando se está pagando por partes. */
  falta?: number;
}

export async function abrirPantallaCliente(): Promise<void> {
  if (!enTauri) throw new Error('Solo en la app instalada');
  await invoke('abrir_pantalla_cliente');
}

export async function cerrarPantallaCliente(): Promise<void> {
  if (!enTauri) return;
  await invoke('cerrar_pantalla_cliente');
}

export async function hayPantallaCliente(): Promise<boolean> {
  if (!enTauri) return false;
  return invoke<boolean>('hay_pantalla_cliente');
}

/**
 * Manda el estado a la pantalla del cliente.
 *
 * Se llama en cada cambio del carrito. Si la segunda pantalla no está abierta,
 * el evento no lo escucha nadie y no pasa nada: por eso esto nunca falla ni
 * bloquea, y la caja no tiene que saber si hay monitor o no.
 */
export async function mostrarAlCliente(estado: EstadoCliente): Promise<void> {
  if (!enTauri) return;
  try {
    const { emit } = await import('@tauri-apps/api/event');
    await emit('cliente:estado', estado);
  } catch {
    /* La pantalla del cliente es un extra: que falle no puede frenar un cobro. */
  }
}

/* ── Impresoras ───────────────────────────────────────────────────────── */

export type Impresora =
  | { tipo: 'red'; host: string; puerto: number }
  | { tipo: 'serie'; puerto: string; baudios: number }
  | { tipo: 'archivo'; ruta: string }
  | { tipo: 'ninguna' };

export interface ConfigImpresora {
  impresora: Impresora;
  /** 48 = papel de 80 mm, 32 = 58 mm. Si se equivoca, la tirilla sale torcida. */
  ancho: number;
}

export interface Impresoras {
  caja: ConfigImpresora;
  cocina: ConfigImpresora;
  /** Los puertos COM que ve el sistema, para elegir de una lista. */
  puertos: string[];
}

export async function impresoras(): Promise<Impresoras> {
  if (!enTauri) {
    return {
      caja: { impresora: { tipo: 'ninguna' }, ancho: 48 },
      cocina: { impresora: { tipo: 'ninguna' }, ancho: 48 },
      puertos: [],
    };
  }
  return invoke<Impresoras>('impresoras');
}

export async function configurarImpresora(rol: 'caja' | 'cocina', config: ConfigImpresora): Promise<void> {
  if (!enTauri) return;
  await invoke('configurar_impresora', { rol, config });
}

/** Saca un papel de prueba, con tildes y Ñ para verificar la tabla de caracteres. */
export async function probarImpresora(rol: 'caja' | 'cocina'): Promise<void> {
  if (!enTauri) throw new Error('Solo en la app instalada');
  await invoke('probar_impresora', { rol });
}

/**
 * Reimprime una venta ya cobrada. Sin id, la última del turno.
 *
 * No vuelve a cobrar nada ni abre el cajón: la venta ya ocurrió. La copia sale
 * marcada como tal, para que un segundo papel no pase por un comprobante nuevo.
 */
export async function reimprimir(ventaId?: string): Promise<void> {
  if (!enTauri) return;
  await invoke('reimprimir', { ventaId: ventaId ?? null });
}

/* ── Conexión con MenuBy ──────────────────────────────────────────────── */

export interface Emparejada {
  negocio: string;
  vence_en_dias: number;
}

/**
 * Cambia la sesión del panel por el token largo de esta caja.
 *
 * La del panel vence en 24 horas y no se guarda en ninguna parte: se usa una
 * vez y se descarta. El token de la caja va al llavero del sistema.
 */
/**
 * Vincula esta caja con el código que el dueño sacó del panel.
 *
 * Es la vía normal: ocho caracteres que se pueden dictar por teléfono. Nadie
 * tiene que abrir las herramientas del navegador ni saber qué es un token.
 */
export async function vincular(url: string, codigo: string): Promise<Emparejada> {
  if (!enTauri) throw new Error('Solo en la app instalada');
  return invoke<Emparejada>('vincular', { url, codigo });
}

/** La vía de soporte: cambiar una sesión del panel por el token de la caja. */
export async function emparejar(url: string, tokenPanel: string, caja: string): Promise<Emparejada> {
  if (!enTauri) throw new Error('Solo en la app instalada');
  return invoke<Emparejada>('emparejar', { url, tokenPanel, caja });
}

export async function probarNube(): Promise<void> {
  if (!enTauri) throw new Error('Solo en la app instalada');
  await invoke('probar_nube');
}

export async function urlNube(): Promise<string> {
  if (!enTauri) return '';
  return invoke<string>('url_nube');
}

export async function conectada(): Promise<boolean> {
  if (!enTauri) return false;
  return invoke<boolean>('conectada');
}

export async function desconectarNube(): Promise<void> {
  if (!enTauri) return;
  await invoke('desconectar_nube');
}

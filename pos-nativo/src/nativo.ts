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
}

export interface LineaVenta {
  producto_id: string;
  nombre: string;
  variante: string;
  precio: number;
  cantidad: number;
}

export interface NuevaVenta {
  items: LineaVenta[];
  medio_pago: string;
  recibido: number;
  cajero: string;
  turno_id: string;
  iva_porcentaje: number;
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
  { id: 'd1', nombre: 'Café americano', precio: 4500, categoria: 'Bebidas', variante: '' },
  { id: 'd2', nombre: 'Capuchino', precio: 7000, categoria: 'Bebidas', variante: '' },
  { id: 'd3', nombre: 'Croissant', precio: 5500, categoria: 'Panadería', variante: '' },
  { id: 'd4', nombre: 'Sándwich de pollo', precio: 15900, categoria: 'Comida', variante: '' },
  { id: 'd5', nombre: 'Jugo de naranja', precio: 6500, categoria: 'Bebidas', variante: '' },
  { id: 'd6', nombre: 'Torta de chocolate', precio: 8900, categoria: 'Postres', variante: '' },
];

export async function catalogo(busqueda: string): Promise<Producto[]> {
  if (!enTauri) {
    const b = busqueda.trim().toLowerCase();
    return DEMO.filter((p) => !b || p.nombre.toLowerCase().includes(b));
  }
  return invoke<Producto[]>('catalogo', { busqueda });
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

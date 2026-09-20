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

export async function cobrar(nueva: NuevaVenta): Promise<Cobro> {
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
  return invoke<Cobro>('cobrar', { nueva });
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

export async function abrirCajon(): Promise<void> {
  if (!enTauri) return;
  await invoke('abrir_cajon');
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

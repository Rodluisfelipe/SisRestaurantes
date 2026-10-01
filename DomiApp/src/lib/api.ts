/**
 * Hablar con el servidor.
 *
 * La sesión dura 12 h y se renueva sola con el token largo: el domi no vuelve
 * a escribir su PIN a mitad de turno. Funciona también desde la tarea de GPS
 * en segundo plano, donde la app no está "abierta", por eso lee la sesión del
 * almacenamiento y no de la pantalla.
 */
import { API } from './config';
import { CLAVES, guardar, leer, borrar } from './almacen';

export type Sesion = { token: string; renovacion: string; telefono: string };

export class ErrorApi extends Error {
  status: number;
  codigo?: string;
  datos?: unknown;
  constructor(status: number, mensaje: string, codigo?: string, datos?: unknown) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.datos = datos;
  }
}

/** Sin conexión (o el servidor no contestó a tiempo). */
export const esSinRed = (e: unknown) => e instanceof ErrorApi && e.status === 0;

let sesionEnMemoria: Sesion | null = null;
let alSalir: (() => void) | null = null;

export async function sesionActual(): Promise<Sesion | null> {
  if (sesionEnMemoria) return sesionEnMemoria;
  sesionEnMemoria = await leer<Sesion | null>(CLAVES.sesion, null);
  return sesionEnMemoria;
}

export async function ponerSesion(s: Sesion | null) {
  sesionEnMemoria = s;
  if (s) await guardar(CLAVES.sesion, s);
  else await borrar(CLAVES.sesion);
}

/** La pantalla se entera cuando la sesión muere del todo (hay que volver a entrar). */
export function alCerrarseSesion(fn: () => void) {
  alSalir = fn;
}

let renovando: Promise<boolean> | null = null;

async function renovar(): Promise<boolean> {
  if (renovando) return renovando;
  renovando = (async () => {
    const s = await sesionActual();
    if (!s?.renovacion) return false;
    try {
      const r = await fetchConTiempo(`${API}/domi-app/renovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renovacion: s.renovacion }),
      }, 15_000);
      if (r.status === 401) {
        await ponerSesion(null);
        alSalir?.();
        return false;
      }
      if (!r.ok) return false;
      const j = await r.json();
      await ponerSesion({ ...s, token: j.token, renovacion: j.renovacion });
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { renovando = null; }, 0);
    }
  })();
  return renovando;
}

async function fetchConTiempo(url: string, opciones: RequestInit, ms: number): Promise<Response> {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ms);
  try {
    return await fetch(url, { ...opciones, signal: control.signal });
  } finally {
    clearTimeout(t);
  }
}

type Opciones = { metodo?: string; cuerpo?: unknown; formulario?: FormData; tiempo?: number; sinSesion?: boolean };

export async function llamar<T = any>(ruta: string, op: Opciones = {}, reintento = true): Promise<T> {
  const s = op.sinSesion ? null : await sesionActual();
  const headers: Record<string, string> = {};
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  if (op.cuerpo !== undefined) headers['Content-Type'] = 'application/json';

  let r: Response;
  try {
    r = await fetchConTiempo(`${API}${ruta}`, {
      method: op.metodo || (op.cuerpo !== undefined || op.formulario ? 'POST' : 'GET'),
      headers,
      body: op.formulario ?? (op.cuerpo !== undefined ? JSON.stringify(op.cuerpo) : undefined),
    }, op.tiempo ?? 20_000);
  } catch (e) {
    // Queda en el registro del celular: así un error que no es de red no se esconde como "Sin conexión"
    console.warn('[api]', ruta, e instanceof Error ? e.message : e);
    throw new ErrorApi(0, 'Sin conexión');
  }

  if (r.status === 401 && !op.sinSesion && reintento && (await renovar())) {
    return llamar<T>(ruta, op, false);
  }

  let j: any = null;
  try { j = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) {
    if (r.status === 401 && !op.sinSesion) {
      await ponerSesion(null);
      alSalir?.();
    }
    throw new ErrorApi(r.status, j?.message || 'Algo falló. Intenta de nuevo.', j?.codigo, j);
  }
  return j as T;
}

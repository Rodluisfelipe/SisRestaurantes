/**
 * La cola sin señal.
 *
 * Todo lo que el domi hace ("llegué", "recogí", "entregué", la foto, el GPS)
 * entra primero aquí y se guarda en el celular. Después se manda, en orden,
 * cuando haya red. Cada evento lleva un id hecho en el celular: si se manda
 * dos veces porque la señal se cayó justo al responder, el servidor lo
 * reconoce y no entrega dos veces ni gasta dos intentos del código.
 *
 * Se lee y escribe entera en cada cambio y con candado: la pantalla y la
 * tarea de GPS en segundo plano la tocan a la vez.
 */
import { Platform } from 'react-native';
import { CLAVES, guardar, leer } from './almacen';
import { ErrorApi, esSinRed, llamar } from './api';
import type { Evento, ResultadoEvento } from './tipos';

type ItemEvento = { evento: Evento; esperaFoto?: string; intentos: number };
type ItemFoto = { id: string; pedidoId: string; uri: string; intentos: number };
/** simulada: Android dice que el punto viene de una app de GPS falso */
export type PuntoGps = { lat: number; lng: number; at: string; rumbo?: number | null; velocidad?: number | null; simulada?: boolean };

type Cola = { eventos: ItemEvento[]; fotos: ItemFoto[]; gps: PuntoGps[] };
const VACIA: Cola = { eventos: [], fotos: [], gps: [] };
const MAX_GPS = 600;
const MAX_INTENTOS = 25;

let candado: Promise<unknown> = Promise.resolve();
function conCandado<T>(fn: () => Promise<T>): Promise<T> {
  const r = candado.then(fn, fn);
  candado = r.catch(() => undefined);
  return r;
}

async function cargar(): Promise<Cola> {
  const c = await leer<Cola>(CLAVES.cola, VACIA);
  return { eventos: c.eventos || [], fotos: c.fotos || [], gps: c.gps || [] };
}

/* ── Avisos a la pantalla ── */
type Oyente = (r: ResultadoEvento) => void;
const oyentes = new Set<Oyente>();
export function alResultado(fn: Oyente) {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}
type OyenteCuenta = (n: { eventos: number; fotos: number; gps: number }) => void;
const oyentesCuenta = new Set<OyenteCuenta>();
export function alCambiarCola(fn: OyenteCuenta) {
  oyentesCuenta.add(fn);
  cargar().then((c) => fn({ eventos: c.eventos.length, fotos: c.fotos.length, gps: c.gps.length }));
  return () => { oyentesCuenta.delete(fn); };
}

async function escribir(c: Cola) {
  await guardar(CLAVES.cola, c);
  const n = { eventos: c.eventos.length, fotos: c.fotos.length, gps: c.gps.length };
  oyentesCuenta.forEach((f) => f(n));
}

/* ── Encolar ── */

export function nuevoId(): string {
  // UUID v4 sin depender de nada nativo (sirve también en la tarea de fondo)
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function encolarEvento(evento: Evento, esperaFoto?: string) {
  return conCandado(async () => {
    const c = await cargar();
    if (!c.eventos.some((e) => e.evento.id === evento.id)) c.eventos.push({ evento, esperaFoto, intentos: 0 });
    await escribir(c);
  });
}

export function encolarFoto(pedidoId: string, uri: string) {
  const id = nuevoId();
  return conCandado(async () => {
    const c = await cargar();
    c.fotos.push({ id, pedidoId, uri, intentos: 0 });
    await escribir(c);
    return id;
  });
}

export function encolarGps(puntos: PuntoGps[]) {
  if (!puntos.length) return Promise.resolve();
  return conCandado(async () => {
    const c = await cargar();
    c.gps.push(...puntos);
    if (c.gps.length > MAX_GPS) c.gps = c.gps.slice(-MAX_GPS);
    await escribir(c);
  });
}

/** ¿Qué pedidos tienen algo sin mandar? (para mostrar "se enviará al volver la señal") */
export async function pendientesPorPedido(): Promise<Record<string, Evento[]>> {
  const c = await cargar();
  const out: Record<string, Evento[]> = {};
  for (const e of c.eventos) (out[e.evento.pedidoId] ||= []).push(e.evento);
  return out;
}

/* ── Vaciar ── */

async function subirFoto(f: ItemFoto): Promise<string> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(f.uri)).blob();
    form.append('foto', blob, 'entrega.jpg');
  } else {
    form.append('foto', { uri: f.uri, name: 'entrega.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  const r = await llamar<{ url: string }>(`/domi-app/pedidos/${f.pedidoId}/foto`, { formulario: form, tiempo: 60_000 });
  return r.url;
}

let vaciando: Promise<void> | null = null;

/** Manda todo lo que se pueda. Nunca lanza: lo que no sale se queda para después. */
export function vaciar(): Promise<void> {
  if (vaciando) return vaciando;
  vaciando = conCandado(vaciarYa).finally(() => { vaciando = null; });
  return vaciando;
}

async function vaciarYa(): Promise<void> {
  const c = await cargar();
  let cambio = false;

  // 1. Fotos primero: el "entregado" que las espera no sale sin ellas
  for (const f of [...c.fotos]) {
    try {
      const url = await subirFoto(f);
      c.fotos = c.fotos.filter((x) => x.id !== f.id);
      for (const e of c.eventos) {
        if (e.esperaFoto === f.id) {
          e.evento.datos = { ...(e.evento.datos || {}), fotoUrl: url };
          e.esperaFoto = undefined;
        }
      }
      cambio = true;
    } catch (err) {
      if (esSinRed(err)) { if (cambio) await escribir(c); return; }
      f.intentos += 1;
      // Una foto que el servidor no acepta no puede frenar la entrega: sale sin foto.
      if ((err instanceof ErrorApi && err.status >= 400 && err.status < 500) || f.intentos >= MAX_INTENTOS) {
        c.fotos = c.fotos.filter((x) => x.id !== f.id);
        for (const e of c.eventos) if (e.esperaFoto === f.id) e.esperaFoto = undefined;
      }
      cambio = true;
    }
  }

  // 2. Eventos, en orden; se para en el primero que aún espera su foto
  const listos: ItemEvento[] = [];
  for (const e of c.eventos) {
    if (e.esperaFoto) break;
    listos.push(e);
    if (listos.length >= 20) break;
  }
  if (listos.length) {
    try {
      const r = await llamar<{ resultados: ResultadoEvento[] }>('/domi-app/eventos', { cuerpo: { eventos: listos.map((e) => e.evento) } });
      const porId = new Map(r.resultados.map((x) => [x.id, x]));
      c.eventos = c.eventos.filter((e) => {
        const res = porId.get(e.evento.id);
        if (!res) return true;
        const listo = res.ok || res.definitivo;
        if (!listo) e.intentos += 1;
        if (listo || e.intentos >= MAX_INTENTOS) {
          const conPedido = { ...res, pedidoId: e.evento.pedidoId, tipo: e.evento.tipo };
          oyentes.forEach((f) => f(conPedido));
          return false;
        }
        return true;
      });
      cambio = true;
    } catch (err) {
      if (esSinRed(err)) { if (cambio) await escribir(c); return; }
      for (const e of listos) e.intentos += 1;
      c.eventos = c.eventos.filter((e) => e.intentos < MAX_INTENTOS);
      cambio = true;
    }
  }

  // 3. GPS acumulado
  if (c.gps.length) {
    const lote = c.gps.slice(0, 200);
    try {
      await llamar('/domi-app/ubicacion', { cuerpo: { puntos: lote } });
      c.gps = c.gps.slice(lote.length);
      cambio = true;
    } catch (err) {
      if (!esSinRed(err)) { c.gps = c.gps.slice(lote.length); cambio = true; }
    }
  }

  if (cambio) await escribir(c);
}

/**
 * Para lo que el domi espera ver resuelto ya (el código de entrega): encola,
 * intenta mandar y espera la respuesta un rato. Si no hay señal, devuelve
 * 'pendiente' y el evento sale solo cuando vuelva.
 */
export async function enviarYEsperar(evento: Evento, esperaFoto: string | undefined, ms = 12_000): Promise<ResultadoEvento | 'pendiente'> {
  let resolver!: (r: ResultadoEvento | 'pendiente') => void;
  const promesa = new Promise<ResultadoEvento | 'pendiente'>((res) => { resolver = res; });
  const quitar = alResultado((r) => { if (r.id === evento.id) resolver(r); });
  const t = setTimeout(() => resolver('pendiente'), ms);
  await encolarEvento(evento, esperaFoto);
  // Si ya había un envío en curso, este evento no iba en él: se manda justo después.
  vaciar().then(() => vaciar());
  const r = await promesa;
  clearTimeout(t);
  quitar();
  return r;
}

export async function limpiarCola() {
  await conCandado(async () => { await escribir({ ...VACIA }); });
}

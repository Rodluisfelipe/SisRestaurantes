/**
 * El estado de la app en un solo lugar.
 *
 * Lo que dijo el servidor la última vez se guarda en el celular: sin señal la
 * app abre igual, con los pedidos que tenía. Encima de eso van los avances
 * "locales": cuando el domi toca "Recogí", la pantalla avanza YA, aunque el
 * evento siga en la cola esperando señal. Si el servidor después lo rechaza,
 * el avance se deshace y se le dice por qué.
 */
import { create } from 'zustand';
import { CLAVES, guardar, leer } from '@/lib/almacen';
import { alCerrarseSesion, ErrorApi, esSinRed, llamar, ponerSesion, sesionActual, type Sesion } from '@/lib/api';
import { alResultado, encolarEvento, limpiarCola, nuevoId, vaciar } from '@/lib/cola';
import { alteradaEnElCelular, datosDispositivo } from '@/lib/seguridad';
import { reporteIntegridad } from '@/lib/sistema';
import type { EstadoPedido, EstadoServidor, Evento, Pedido, Punto, ResultadoEvento, TipoEvento } from '@/lib/tipos';

export type Ajustes = { navegador: 'google' | 'waze'; sonido: boolean; vibrar: boolean };

const DEJA_EN: Record<TipoEvento, EstadoPedido> = {
  llegue_local: 'en_local',
  recogido: 'hacia_cliente',
  llegue_cliente: 'con_cliente',
  entregado: 'entregado',
  no_entregado: 'no_entregado',
};
const ORDEN: EstadoPedido[] = ['hacia_local', 'en_local', 'hacia_cliente', 'con_cliente', 'entregado'];

export const MENSAJE_ERROR: Record<string, string> = {
  codigo_incorrecto: 'El código no es correcto.',
  codigo_bloqueado: 'Se acabaron los intentos del código. Llama al local para que lo confirmen ellos.',
  codigo_recogida_incorrecto: 'El código de recogida no es correcto. Pídeselo al local.',
  fuera_de_orden: 'Ese paso no se pudo guardar. Revisa el estado del pedido.',
  cancelado: 'El local canceló este pedido.',
  cerrado: 'Este pedido ya se cerró.',
  no_es_tuyo: 'Este pedido ya no está a tu nombre.',
  muy_viejo: 'Ese paso quedó guardado hace demasiado tiempo y ya no se puede enviar.',
};

type Estado = {
  listo: boolean;
  sesion: Sesion | null;
  servidor: EstadoServidor | null;
  actualizadoAt: number | null;
  cargando: boolean;
  hayRed: boolean;
  ubicacion: Punto | null;
  /** Avances hechos en el celular que el servidor aún no confirma */
  locales: Record<string, { estado: EstadoPedido; at: number }>;
  errores: Record<string, string>;
  ajustes: Ajustes;
  enLineaLocal: boolean | null;
  /** El GPS viene de una app de ubicación falsa */
  gpsSimulado: boolean;
  /** La app fue modificada (lo vio el celular o lo dijo el servidor) */
  appAlterada: boolean;

  iniciar: () => Promise<void>;
  entrar: (telefono: string, pin: string) => Promise<void>;
  salir: () => Promise<void>;
  refrescar: () => Promise<void>;
  ponerRed: (hay: boolean) => void;
  ponerUbicacion: (p: Punto, simulada?: boolean) => void;
  conectarse: (enLinea: boolean) => Promise<void>;
  avanzar: (pedido: Pedido, tipo: TipoEvento, datos?: Evento['datos']) => Promise<void>;
  marcarLocal: (pedidoId: string, estado: EstadoPedido) => void;
  limpiarError: (pedidoId: string) => void;
  cambiarAjustes: (a: Partial<Ajustes>) => void;
  quitarOferta: (id: string) => void;
};

const AJUSTES: Ajustes = { navegador: 'google', sonido: true, vibrar: true };

export const useApp = create<Estado>((set, get) => ({
  listo: false,
  sesion: null,
  servidor: null,
  actualizadoAt: null,
  cargando: false,
  hayRed: true,
  ubicacion: null,
  locales: {},
  errores: {},
  ajustes: AJUSTES,
  enLineaLocal: null,
  gpsSimulado: false,
  appAlterada: false,

  async iniciar() {
    reporteIntegridad().then((r) => { if (alteradaEnElCelular(r)) set({ appAlterada: true }); });
    const [sesion, cache, ajustes] = await Promise.all([
      sesionActual(),
      leer<{ servidor: EstadoServidor; at: number } | null>(CLAVES.estado, null),
      leer<Ajustes>(CLAVES.ajustes, AJUSTES),
    ]);
    set({
      sesion,
      servidor: sesion && cache ? cache.servidor : null,
      actualizadoAt: sesion && cache ? cache.at : null,
      ajustes: { ...AJUSTES, ...ajustes },
      listo: true,
    });
    if (sesion) get().refrescar();
  },

  async entrar(telefono, pin) {
    const r = await llamar<{ token: string; renovacion: string }>('/domi-app/entrar', {
      cuerpo: { telefono, pin, dispositivo: await datosDispositivo() },
      sinSesion: true,
    }).catch(marcarAlterada);
    const sesion = { token: r.token, renovacion: r.renovacion, telefono: telefono.replace(/\D/g, '') };
    await ponerSesion(sesion);
    set({ sesion, servidor: null, locales: {}, errores: {} });
    await get().refrescar();
  },

  async salir() {
    try { await llamar('/domi-app/salir', { cuerpo: {}, tiempo: 5000 }); } catch { /* igual se sale */ }
    await ponerSesion(null);
    await limpiarCola();
    await guardar(CLAVES.estado, null);
    set({ sesion: null, servidor: null, actualizadoAt: null, locales: {}, errores: {}, enLineaLocal: null });
  },

  async refrescar() {
    if (!get().sesion || get().cargando) return;
    set({ cargando: true });
    try {
      await vaciar(); // primero lo pendiente: así el estado que llega ya lo incluye
      const servidor = await llamar<EstadoServidor>('/domi-app/estado');
      // Un avance local ya reflejado por el servidor deja de ser "local"
      const locales = { ...get().locales };
      for (const [id, l] of Object.entries(locales)) {
        const p = servidor.pedidos.find((x) => x.id === id);
        const confirmado = !p || ORDEN.indexOf(p.estado) >= ORDEN.indexOf(l.estado);
        if (confirmado && Date.now() - l.at > 3000) delete locales[id];
      }
      const at = Date.now();
      set({ servidor, actualizadoAt: at, hayRed: true, locales, enLineaLocal: null });
      guardar(CLAVES.estado, { servidor, at });
    } catch (e) {
      if (esSinRed(e)) set({ hayRed: false });
    } finally {
      set({ cargando: false });
    }
  },

  ponerRed(hay) {
    const antes = get().hayRed;
    set({ hayRed: hay });
    if (hay && !antes) get().refrescar();
  },

  ponerUbicacion(p, simulada = false) {
    // Con GPS falso no se usa el punto: el mapa y las distancias quedan como estaban
    if (simulada) { if (!get().gpsSimulado) set({ gpsSimulado: true }); return; }
    set(get().gpsSimulado ? { ubicacion: p, gpsSimulado: false } : { ubicacion: p });
  },

  async conectarse(enLinea) {
    set({ enLineaLocal: enLinea });
    const u = get().ubicacion;
    try {
      const integridad = enLinea ? (await datosDispositivo()).integridad : undefined;
      await llamar('/domi-app/disponible', { cuerpo: { enLinea, lat: u?.lat, lng: u?.lng, integridad } }).catch(marcarAlterada);
      await get().refrescar();
    } catch (e) {
      set({ enLineaLocal: null });
      throw e;
    }
  },

  async avanzar(pedido, tipo, datos) {
    const u = get().ubicacion;
    const evento: Evento = {
      id: nuevoId(), tipo, pedidoId: pedido.id, at: new Date().toISOString(),
      ...(u ? { lat: u.lat, lng: u.lng } : {}), ...(datos ? { datos } : {}),
    };
    get().marcarLocal(pedido.id, DEJA_EN[tipo]);
    await encolarEvento(evento);
    vaciar().then(() => get().refrescar());
  },

  marcarLocal(pedidoId, estado) {
    set((s) => ({ locales: { ...s.locales, [pedidoId]: { estado, at: Date.now() } }, errores: { ...s.errores, [pedidoId]: '' } }));
  },

  limpiarError(pedidoId) {
    set((s) => ({ errores: { ...s.errores, [pedidoId]: '' } }));
  },

  cambiarAjustes(a) {
    const ajustes = { ...get().ajustes, ...a };
    set({ ajustes });
    guardar(CLAVES.ajustes, ajustes);
  },

  quitarOferta(id) {
    const s = get().servidor;
    if (s) set({ servidor: { ...s, ofertas: s.ofertas.filter((o) => o.id !== id) } });
  },
}));

/** Si el servidor dice que la app está modificada, se bloquea la pantalla. */
function marcarAlterada(e: unknown): never {
  if (e instanceof ErrorApi && e.codigo === 'app_alterada') useApp.setState({ appAlterada: true });
  throw e;
}

/** Pedidos tal como los debe ver el domi: lo del servidor + sus avances locales. */
export function pedidosVisibles(servidor: EstadoServidor | null, locales: Estado['locales']): Pedido[] {
  if (!servidor) return [];
  return servidor.pedidos
    .map((p) => {
      const l = locales[p.id];
      if (l && ORDEN.indexOf(l.estado) > ORDEN.indexOf(p.estado)) return { ...p, estado: l.estado };
      if (l && (l.estado === 'no_entregado')) return { ...p, estado: l.estado };
      return p;
    })
    .filter((p) => !['entregado', 'no_entregado', 'cancelado'].includes(p.estado));
}

// Un evento que el servidor rechazó para siempre deshace su avance local
alResultado((r: ResultadoEvento) => {
  if (r.ok || !r.definitivo) return;
  const s = useApp.getState();
  const pedidoId = r.pedidoId || '';
  const locales = { ...s.locales };
  let mensaje = MENSAJE_ERROR[r.error || ''] || 'No se pudo guardar ese paso.';
  if (r.error === 'codigo_incorrecto' && r.intentosRestantes != null) {
    mensaje = `El código no es correcto. Te quedan ${r.intentosRestantes} ${r.intentosRestantes === 1 ? 'intento' : 'intentos'}.`;
  }
  if (pedidoId) delete locales[pedidoId];
  useApp.setState({ locales, errores: pedidoId ? { ...s.errores, [pedidoId]: mensaje } : s.errores });
  s.refrescar();
});

alCerrarseSesion(() => {
  useApp.setState({ sesion: null, servidor: null, locales: {}, errores: {} });
});

export { ErrorApi };

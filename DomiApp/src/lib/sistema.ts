/**
 * El módulo nativo propio (modules/domi-sistema): abrirse encima de otras apps,
 * mostrarse sobre el bloqueo y revisar que la app no esté modificada.
 *
 * En web y en iOS no existe: todo responde "no se puede" sin romper nada.
 */
import { requireOptionalNativeModule } from 'expo';

export type ReporteIntegridad = {
  firmas: string[];
  depurable: boolean;
  depuradorConectado: boolean;
  instalador: string | null;
  root: boolean;
  emulador: boolean;
  ganchos: string[];
};

type Nativo = {
  puedeSuperponer(): boolean;
  abrirPermisoSuperponer(): void;
  traerAlFrente(): boolean;
  mostrarSobreBloqueo(activo: boolean): Promise<void>;
  integridad(): Promise<ReporteIntegridad>;
  permisosXiaomi(): { aplica: boolean; segundoPlano: boolean; bloqueo: boolean };
  abrirPermisosXiaomi(): boolean;
  llamadas?: boolean;
  appALaVista?(): boolean;
  cancelarLlamada?(clave: string): void;
  cancelarLlamadas?(): void;
  llamadaPendiente?(): Llamada | null;
  puedePantallaCompleta?(): boolean;
  abrirPermisoPantallaCompleta?(): void;
  addListener?(evento: 'llamada', f: (l: Llamada) => void): { remove(): void };
};

/** Un pedido que llegó como llamada: `oferta:<id>` o `pedido:<id>` (asignado), o que la colgaron. */
export type Llamada = { clave: string | null; tipo: 'oferta' | 'asignado' | 'colgar' | null };

const nativo = requireOptionalNativeModule<Nativo>('DomiSistema');

/** ¿Existe el módulo? (solo en la app de Android) */
export const hayModuloSistema = !!nativo;

export function puedeSuperponer(): boolean {
  try { return nativo ? nativo.puedeSuperponer() : true; } catch { return true; }
}

export function abrirPermisoSuperponer() {
  try { nativo?.abrirPermisoSuperponer(); } catch { /* sin ajuste en este celular */ }
}

export function traerAlFrente(): boolean {
  try { return nativo ? nativo.traerAlFrente() : false; } catch { return false; }
}

export async function mostrarSobreBloqueo(activo: boolean) {
  try { await nativo?.mostrarSobreBloqueo(activo); } catch { /* sin actividad a la vista */ }
}

/**
 * Xiaomi tiene permisos propios: sin "ventanas emergentes en segundo plano"
 * la oferta suena pero la app no se abre sola. true = no hace falta nada.
 */
export function xiaomiListo(): boolean {
  try {
    const p = nativo?.permisosXiaomi();
    return !p || !p.aplica || (p.segundoPlano && p.bloqueo);
  } catch {
    return true;
  }
}

export function abrirPermisosXiaomi() {
  try { nativo?.abrirPermisosXiaomi(); } catch { /* sin pantalla de permisos */ }
}

export async function reporteIntegridad(): Promise<ReporteIntegridad | null> {
  try { return nativo ? await nativo.integridad() : null; } catch { return null; }
}

/* ── Pedidos como llamada entrante ──
   El servidor manda el pedido por Firebase y el código nativo lo pinta como una
   llamada (suena en bucle, prende la pantalla, abre la app sobre el bloqueo).
   Aquí: enterarse para refrescar, y colgarla cuando la app ya lo muestra. */

/** Esta instalación trae la llamada nativa (una actualización OTA sobre una versión vieja no). */
export const hayLlamadas = !!nativo?.llamadas;

export const claveOferta = (id: string) => `oferta:${id}`;
export const clavePedido = (id: string) => `pedido:${id}`;

/**
 * ¿El domi está viendo la app de verdad? (actividad al frente y pantalla
 * prendida). No sale de AppState: con el celular bloqueado, ColorOS sigue
 * diciendo "active".
 */
export function appALaVista(): boolean {
  try { return nativo?.appALaVista ? nativo.appALaVista() : true; } catch { return true; }
}

export function cancelarLlamada(clave: string) {
  try { nativo?.cancelarLlamada?.(clave); } catch { /* ya no estaba */ }
}

export function cancelarLlamadas() {
  try { nativo?.cancelarLlamadas?.(); } catch { /* nada que colgar */ }
}

/** La llamada con la que se abrió la app (solo la primera vez que se pregunta). */
export function llamadaPendiente(): Llamada | null {
  try { return nativo?.llamadaPendiente?.() ?? null; } catch { return null; }
}

export function escucharLlamadas(f: (l: Llamada) => void): () => void {
  try {
    const sub = nativo?.addListener?.('llamada', f);
    return () => sub?.remove();
  } catch {
    return () => {};
  }
}

/** Android 14+: sin "pantalla completa", con el celular bloqueado la llamada solo suena. */
export function puedePantallaCompleta(): boolean {
  try { return nativo?.puedePantallaCompleta ? nativo.puedePantallaCompleta() : true; } catch { return true; }
}

export function abrirPermisoPantallaCompleta() {
  try { nativo?.abrirPermisoPantallaCompleta?.(); } catch { /* sin ajuste en este celular */ }
}

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
};

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

export async function reporteIntegridad(): Promise<ReporteIntegridad | null> {
  try { return nativo ? await nativo.integridad() : null; } catch { return null; }
}

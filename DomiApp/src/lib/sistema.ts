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

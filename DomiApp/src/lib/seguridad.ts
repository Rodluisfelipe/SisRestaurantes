/**
 * Contra trampas: app modificada y GPS falso.
 *
 * El celular revisa lo que puede (herramientas de modificación en vivo,
 * depurador pegado, ubicación simulada) y le manda el reporte al servidor, que
 * es quien decide: compara la firma de la app con la oficial y descarta los
 * puntos de GPS falsos o imposibles.
 */
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { reporteIntegridad, type ReporteIntegridad } from './sistema';

export async function datosDispositivo() {
  return {
    plataforma: Platform.OS,
    version: Application.nativeApplicationVersion || '2.0.0',
    integridad: await reporteIntegridad(),
  };
}

/** Lo que el propio celular ya puede ver como app modificada. */
export function alteradaEnElCelular(r: ReporteIntegridad | null): boolean {
  if (!r) return false;
  return r.ganchos.length > 0 || (!__DEV__ && r.depuradorConectado);
}

/** A dónde habla la app. En desarrollo se cambia con EXPO_PUBLIC_API_URL. */
export const API = (process.env.EXPO_PUBLIC_API_URL || 'https://api.menuby.tech/api').replace(/\/$/, '');
export const SERVIDOR = API.replace(/\/api$/, '');

/** Cada cuánto se refresca el estado con la app abierta y en línea. */
export const REFRESCO_MS = 15_000;
/** Cada cuánto se manda la ubicación mientras hay pedidos en curso. */
export const GPS_EN_RUTA_MS = 5_000;
/** Y mientras solo se espera trabajo (para que la asignación sepa dónde está). */
export const GPS_ESPERANDO_MS = 30_000;

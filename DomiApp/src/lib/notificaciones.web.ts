/** En el navegador no hay Firebase nativo: las ofertas llegan por el socket. */
export const CANAL_OFERTAS = 'incoming-orders';
export const CANAL_AVISOS = 'avisos';
export async function crearCanales() {}
export async function permisoNotificaciones() { return true; }
export async function pedirNotificaciones() { return true; }
export async function registrarToken() { return false; }
export function escucharAvisos(_alLlegar: () => void) { return () => {}; }

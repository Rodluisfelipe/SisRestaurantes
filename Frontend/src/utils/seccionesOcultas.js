/**
 * Secciones del panel que existen pero hoy no se muestran, porque no se usan.
 * Su código sigue ahí: para volver a mostrar una, se quita de esta lista.
 *
 * - `delivery`: domiciliarios y empresas de domicilio. Ningún negocio los
 *   tiene asignados; mientras tanto, el pedido se marca "En camino" desde el
 *   detalle del pedido.
 * - `extension`: la extensión de Chrome, que se descartó.
 * - `location`: departamento y ciudad para el catálogo público, que solo
 *   funciona en Chía y no se usa.
 */
export const SECCIONES_OCULTAS = new Set(['delivery', 'extension', 'location']);

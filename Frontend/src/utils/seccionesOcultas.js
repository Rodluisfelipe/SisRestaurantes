/**
 * Secciones del panel que existen pero hoy no se muestran, porque no se usan.
 * Su código sigue ahí: para volver a mostrar una, se quita de esta lista.
 *
 * - `extension`: la extensión de Chrome, que se descartó.
 * - `location`: departamento y ciudad para el catálogo público, que solo
 *   funciona en Chía y no se usa.
 */
export const SECCIONES_OCULTAS = new Set(['extension', 'location']);

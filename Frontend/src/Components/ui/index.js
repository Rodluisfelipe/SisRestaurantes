/**
 * El sistema de diseño de MenuBy.
 *
 * Tokens en tailwind.config.js (colores `marca`, `tinta`, `superficie`,
 * `linea`, `accion`, `peligro`…, letra `text-2xs` como mínimo, radios
 * `rounded-tarjeta`/`rounded-boton`/`rounded-hoja`), con sus valores en
 * utils/menuTokens.js. Íconos: `lucide-react` y nada más.
 *
 * En código nuevo, estas piezas antes que clases sueltas.
 */
export { default as Boton } from './Boton';
export { default as Insignia } from './Insignia';
export { default as Precio } from './Precio';
export { formatearPesos } from './pesos';
export { default as Cantidad } from './Cantidad';
export { default as Hoja } from './Hoja';
export { default as useCapa, Capa } from './useCapa';

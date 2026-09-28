/**
 * El anillo de los círculos del menú (historias, logo, sellos), al estilo de
 * Instagram pero con un solo color: el del negocio, que se difumina hacia un
 * tono muy claro y vuelve. Antes eran dos colores distintos.
 */
const mezcla = (pct) => `color-mix(in srgb, var(--mb-accent) ${pct}%, var(--mb-surface, #ffffff))`;

export const ANILLO_MARCA = `conic-gradient(from 210deg, var(--mb-accent), ${mezcla(70)}, ${mezcla(30)}, ${mezcla(70)}, var(--mb-accent))`;

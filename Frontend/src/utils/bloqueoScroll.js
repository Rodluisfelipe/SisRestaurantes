import { useEffect } from 'react';

/**
 * Bloquea el scroll de la página mientras hay una pantalla encima (sección,
 * carrito, historias…).
 *
 * `overflow: hidden` en el body no basta: Safari del iPhone lo ignora, y al
 * seguir deslizando dentro de una sección corta se movía el menú de atrás;
 * al cerrarla, el cliente aparecía en otra parte del menú. Aquí la página se
 * fija en su sitio (position: fixed) y, al cerrar, vuelve exactamente a donde
 * estaba.
 *
 * Lleva la cuenta: con dos pantallas abiertas (una sección y su hoja), la
 * página se suelta solo cuando se cierra la última.
 */

let abiertas = 0;
let guardado = null;

export function bloquearScroll() {
  if (typeof document === 'undefined') return;
  abiertas += 1;
  if (abiertas > 1) return;
  const b = document.body.style;
  const y = window.scrollY || window.pageYOffset || 0;
  guardado = { y, position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow };
  b.position = 'fixed';
  b.top = `-${y}px`;
  b.left = '0';
  b.right = '0';
  b.width = '100%';
  b.overflow = 'hidden';
}

export function desbloquearScroll() {
  if (typeof document === 'undefined' || abiertas === 0) return;
  abiertas -= 1;
  if (abiertas > 0) return;
  const b = document.body.style;
  const g = guardado || { y: 0 };
  b.position = g.position || '';
  b.top = g.top || '';
  b.left = g.left || '';
  b.right = g.right || '';
  b.width = g.width || '';
  b.overflow = g.overflow || '';
  guardado = null;
  // Sin animación: el cliente tiene que quedar donde estaba, no verlo desplazarse
  window.scrollTo({ top: g.y, left: 0, behavior: 'instant' });
}

/** Bloquea mientras `activo` sea verdadero. */
export function useBloqueoScroll(activo) {
  useEffect(() => {
    if (!activo) return undefined;
    bloquearScroll();
    return desbloquearScroll;
  }, [activo]);
}

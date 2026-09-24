import { useEffect, useRef } from 'react';

/**
 * Lo que toda capa encima de la página (modal, hoja, visor) le debe a quien
 * la usa, y que a casi todas las que se armaron a mano les faltaba:
 *
 * - **"Atrás" la cierra.** En Android, el botón de atrás sacaba del menú o
 *   del panel con el modal abierto. La capa deja una entrada en el historial
 *   y "atrás" la consume cerrándola.
 * - **Esc la cierra.**
 * - **La página de atrás no se desplaza** mientras está abierta.
 *
 * Con varias abiertas (un modal y su confirmación encima), "atrás" y Esc
 * cierran solo la de arriba: las capas forman una pila.
 */

const pila = [];
let overflowPrevio = '';
/* Cuántos `popstate` provocamos nosotros al cerrar con la X: esos no son el
   usuario pidiendo "atrás" y no deben cerrar la capa que queda debajo. */
let propios = 0;

function alVolver() {
  if (propios > 0) { propios -= 1; return; }
  const arriba = pila[pila.length - 1];
  if (!arriba) return;
  arriba.porAtras = true;
  arriba.cerrar.current?.();
}

function alTeclear(e) {
  if (e.key !== 'Escape') return;
  const arriba = pila[pila.length - 1];
  if (!arriba) return;
  e.stopPropagation();
  arriba.cerrar.current?.();
}

/* Se escucha una sola vez y para siempre: si se soltara al cerrar la última
   capa, el `popstate` de nuestro propio `history.back()` no llegaría y el
   contador se tragaría el siguiente "atrás" de verdad. */
let instalado = false;
function instalar() {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  window.addEventListener('popstate', alVolver);
  window.addEventListener('keydown', alTeclear, true);
}

export default function useCapa(abierta, onCerrar, { bloquearScroll = true } = {}) {
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    if (!abierta) return undefined;

    const capa = { marca: `capa-${Date.now()}-${Math.random().toString(36).slice(2)}`, cerrar, porAtras: false, bloquearScroll };
    instalar();
    if (bloquearScroll && !pila.some((c) => c.bloquearScroll)) {
      overflowPrevio = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    pila.push(capa);
    try { window.history.pushState({ ...(window.history.state || {}), capa: capa.marca }, ''); } catch { /* sin historial */ }

    return () => {
      const i = pila.indexOf(capa);
      if (i >= 0) pila.splice(i, 1);
      /* Cerrada con la X, tocando afuera o al terminar: la entrada que dejamos
         sigue arriba del historial y se consume, o el próximo "atrás" no haría
         nada. Si ya no está arriba (se navegó a otra pantalla), se deja. */
      if (!capa.porAtras && window.history.state?.capa === capa.marca) {
        propios += 1;
        try { window.history.back(); } catch { propios -= 1; }
      }
      if (bloquearScroll && !pila.some((c) => c.bloquearScroll)) document.body.style.overflow = overflowPrevio;
    };
  }, [abierta, bloquearScroll]);
}

/**
 * Para los modales que ya existen y se muestran con `{abierto && (...)}`:
 * una línea dentro del bloque les da todo lo de arriba sin tocar su diseño.
 *
 *   {abierto && (
 *     <div className="fixed inset-0 ...">
 *       <Capa onCerrar={() => setAbierto(false)} />
 *       ...
 */
export function Capa({ onCerrar, bloquearScroll = true }) {
  useCapa(true, onCerrar, { bloquearScroll });
  return null;
}

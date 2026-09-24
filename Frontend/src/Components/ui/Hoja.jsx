import { useEffect, useRef } from 'react';
import useCapa from './useCapa';

/**
 * La hoja: lo que sube desde abajo en el celular y se centra en pantallas
 * grandes. La ficha de producto, el carrito, las opiniones.
 *
 * "Atrás" y Esc la cierran y la página de atrás no se desplaza (ver
 * `useCapa`). Además es un diálogo modal de verdad para el lector de
 * pantalla: el foco entra al abrir y vuelve adonde estaba al cerrar.
 */
export default function Hoja({
  abierta = true,
  onCerrar,
  etiqueta,
  cabecera = null,
  pie = null,
  ancho = 'max-w-lg',
  /* 'auto': crece con su contenido. 'completo': en el celular ocupa casi toda
     la pantalla aunque el contenido sea corto (la ficha de producto). */
  alto = 'auto',
  className = '',
  children,
}) {
  const panel = useRef(null);
  useCapa(abierta, onCerrar);

  useEffect(() => {
    if (!abierta) return undefined;
    const focoPrevio = document.activeElement;
    const id = requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(id);
      if (focoPrevio && typeof focoPrevio.focus === 'function') focoPrevio.focus({ preventScroll: true });
    };
  }, [abierta]);

  if (!abierta) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar?.(); }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        tabIndex={-1}
        className={`w-full ${ancho} ${alto === 'completo' ? 'hoja-completa' : 'max-h-[94dvh]'} sm:max-h-[90vh] flex flex-col bg-superficie-tarjeta rounded-t-[28px] sm:rounded-3xl shadow-2xl outline-none pb-safe ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {cabecera && <div className="flex-shrink-0">{cabecera}</div>}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
        {pie && <div className="flex-shrink-0">{pie}</div>}
      </div>
    </div>
  );
}

import { forwardRef } from 'react';

/**
 * El botón del sistema. Uno solo, en vez de los más de 1.300 `<button>` que
 * cada pantalla estilizaba a su manera —cada uno con su alto, su radio y su
 * forma de verse deshabilitado—.
 *
 * - `primario`: el color del negocio. La acción principal de la pantalla.
 * - `accion`: verde fijo. Pagar y confirmar, sea cual sea la marca.
 * - `secundario`: con borde. La alternativa.
 * - `fantasma`: sin fondo. Cancelar, cerrar, "ver más".
 * - `peligro`: rojo. Borrar, anular.
 * - `oscuro`: gris casi negro. Avanzar un paso sin decidir nada.
 * - `peligro-suave`: rojo claro. Lo destructivo que no es la acción principal.
 *
 * Los tamaños respetan el mínimo táctil de 44 px desde `md`.
 */
const VARIANTES = {
  primario: 'bg-marca text-sobre-marca hover:brightness-105',
  accion: 'bg-accion text-white hover:brightness-110',
  secundario: 'bg-superficie-tarjeta text-tinta border-2 border-linea hover:border-tinta-3',
  fantasma: 'bg-transparent text-tinta-2 hover:bg-superficie-2 hover:text-tinta',
  peligro: 'bg-peligro text-white hover:brightness-110',
  // Avanzar sin decidir nada ("Iniciar preparación"): firme pero sin color.
  oscuro: 'bg-slate-800 text-white hover:bg-slate-900',
  // Destructivo pero secundario ("Cancelar pedido"): no debe gritar como el rojo lleno.
  'peligro-suave': 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
};

const TAMANOS = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-14 px-5 text-[15px] gap-2',
};

const Boton = forwardRef(function Boton(
  {
    variante = 'primario',
    tamano = 'md',
    bloque = false,
    redondo = true,
    mayusculas = false,
    cargando = false,
    icono = null,
    final = null,
    className = '',
    children,
    disabled,
    type = 'button',
    ...resto
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={[
        'inline-flex items-center justify-center font-black transition-all select-none',
        'active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-marca',
        VARIANTES[variante] || VARIANTES.primario,
        TAMANOS[tamano] || TAMANOS.md,
        redondo ? 'rounded-full' : 'rounded-boton',
        bloque ? 'w-full' : '',
        mayusculas ? 'uppercase tracking-wide' : '',
        className,
      ].join(' ')}
      {...resto}
    >
      {cargando ? (
        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
      ) : icono}
      {children !== undefined && children !== null && <span className="min-w-0 truncate">{children}</span>}
      {/* Lo que no se debe cortar nunca, como el total: si falta espacio,
          se acorta la etiqueta, no el precio. */}
      {final && <span className="flex-shrink-0 tabular-nums">{final}</span>}
    </button>
  );
});

export default Boton;

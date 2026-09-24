/**
 * Una etiqueta corta: "Obligatorio", "Destacado", "Agotado", "#1".
 *
 * Nunca por debajo de 11 px: una etiqueta que no se lee no etiqueta nada.
 */
const TONOS = {
  neutro: 'bg-superficie-2 text-tinta-2',
  marca: 'bg-marca text-sobre-marca',
  suave: 'bg-marca-suave text-tinta',
  exito: 'bg-emerald-50 text-emerald-700',
  aviso: 'bg-amber-50 text-amber-800',
  peligro: 'bg-red-50 text-red-600',
  oscuro: 'bg-slate-900/85 text-white',
  promo: 'bg-gradient-to-r from-red-500 to-orange-500 text-white',
};

export default function Insignia({ tono = 'neutro', icono = null, className = '', children, ...resto }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold whitespace-nowrap ${TONOS[tono] || TONOS.neutro} ${className}`}
      {...resto}
    >
      {icono}
      {children}
    </span>
  );
}

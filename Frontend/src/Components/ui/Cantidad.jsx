/**
 * Menos, el número, más. En la ficha de producto, en el carrito y donde haga
 * falta, siempre igual.
 */
export default function Cantidad({ valor, onCambiar, min = 1, max = 99, tamano = 'md', className = '' }) {
  const alto = tamano === 'lg' ? 'h-14' : tamano === 'sm' ? 'h-9' : 'h-11';
  const boton = tamano === 'lg' ? 'w-10 sm:w-11 h-11' : tamano === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  return (
    <div className={`flex-shrink-0 inline-flex items-center ${alto} rounded-full border-2 border-linea px-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => valor > min && onCambiar(valor - 1)}
        disabled={valor <= min}
        className={`${boton} rounded-full flex items-center justify-center text-tinta disabled:text-tinta-3 active:scale-90 transition-transform`}
        aria-label="Menos"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14" /></svg>
      </button>
      <span className="min-w-[1.75rem] text-center text-lg font-black text-tinta tabular-nums" aria-live="polite">{valor}</span>
      <button
        type="button"
        onClick={() => valor < max && onCambiar(valor + 1)}
        disabled={valor >= max}
        className={`${boton} rounded-full flex items-center justify-center text-tinta disabled:text-tinta-3 active:scale-90 transition-transform`}
        aria-label="Más"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}

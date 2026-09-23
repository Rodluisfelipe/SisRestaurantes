import { useEffect, useRef, useState } from 'react';
import { pesos, type LineaVenta } from './nativo';

/**
 * Las notas que se repiten todo el día.
 *
 * Están puestas a mano y no salen de una tabla a propósito: son las mismas en
 * cualquier cocina, se tocan cien veces al día y tienen que estar donde el dedo
 * ya sabe. El campo libre cubre el resto.
 */
const FRECUENTES = [
  'Sin cebolla',
  'Sin salsa',
  'Sin picante',
  'Bien asado',
  'Término medio',
  'Para llevar',
  'Sin hielo',
  'Aparte',
];

/**
 * Cómo lo pidió el cliente.
 *
 * En gastronomía no se vende "hamburguesa", se vende "hamburguesa sin cebolla":
 * si esa frase no llega a la cocina, el plato vuelve y el negocio pierde el
 * plato y la mesa.
 *
 * Las notas se acumulan separadas por coma en vez de reemplazarse, porque un
 * cliente pide dos cosas a la vez —"sin cebolla y bien asado"— y tener que
 * escribirlas juntas a mano sería más lento que no tener los botones.
 */
export default function NotaItem({
  linea,
  onListo,
  onCancelar,
}: {
  linea: LineaVenta;
  onListo: (nota: string) => void;
  onCancelar: () => void;
}) {
  const [nota, setNota] = useState(linea.nota || '');
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { campo.current?.focus(); }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  const sumar = (frase: string) => {
    setNota((actual) => {
      const partes = actual.split(',').map((p) => p.trim()).filter(Boolean);
      // Tocar dos veces la misma quita, que es lo que espera quien se equivocó.
      if (partes.includes(frase)) return partes.filter((p) => p !== frase).join(', ');
      return [...partes, frase].join(', ');
    });
    campo.current?.focus();
  };

  const puestas = nota.split(',').map((p) => p.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCancelar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[520px] bg-white rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <div>
          <p className="text-[15px] font-black">
            {linea.nombre}
            {linea.variante ? <span className="text-slate-400"> · {linea.variante}</span> : null}
          </p>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            {linea.cantidad} × {pesos(linea.precio)} · va impreso en la comanda de cocina
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {FRECUENTES.map((f) => {
            const activa = puestas.includes(f);
            return (
              <button
                key={f}
                onClick={() => sumar(f)}
                className={`h-toque px-3 rounded-xl text-[13px] font-bold border-2 transition-colors ${
                  activa
                    ? 'border-marca bg-marca text-sobre-marca'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>

        <input
          ref={campo}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onListo(nota.trim()); } }}
          placeholder="O escríbelo: sin tomate, poco sal…"
          maxLength={120}
          className="w-full h-12 px-3 rounded-xl border-2 border-slate-200 text-[14px] outline-none focus:border-marca"
        />

        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="w-32 h-toque rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
          >
            Cancelar
            <span className="block text-[10px] font-semibold text-slate-400">Esc</span>
          </button>
          {/* Quitar la nota es una acción aparte: vaciar el campo a mano con el
              dedo, en un teclado táctil, es de lo más incómodo que hay. */}
          {linea.nota && (
            <button
              onClick={() => onListo('')}
              className="h-toque px-4 rounded-xl text-[13px] font-bold text-slate-400 hover:text-red-600 hover:bg-red-50"
            >
              Quitar
            </button>
          )}
          <button
            onClick={() => onListo(nota.trim())}
            className="flex-1 h-toque rounded-xl bg-accion text-sobre-accion text-[13.5px] font-bold"
          >
            Guardar
            <span className="block text-[10px] font-semibold opacity-60">Enter</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { pesos } from './nativo';

/**
 * Un producto que no está en la carta, con su precio a mano.
 *
 * Entra como una línea más —se imprime, sube y se devuelve igual— pero sin
 * producto detrás: no mueve inventario ni cuenta en "lo más vendido" de la
 * carta. El atajo rápido es escribir `$5000` en el buscador.
 */
export default function ProductoLibre({
  onListo,
  onCancelar,
}: {
  onListo: (nombre: string, precio: number) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const campoMonto = useRef<HTMLInputElement>(null);

  useEffect(() => { campoMonto.current?.focus(); }, []);

  const valor = parseInt(monto || '0', 10) || 0;
  const valido = valor >= 100 && valor <= 9_999_999;

  const aceptar = () => {
    if (!valido) return;
    onListo(nombre.trim().slice(0, 60) || 'Varios', valor);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCancelar}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); aceptar(); }
          if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
        }}
        className="w-[380px] bg-white rounded-2xl p-5 space-y-3 shadow-2xl"
      >
        <p className="text-[15px] font-black">Precio libre</p>
        <input
          ref={campoMonto}
          value={monto}
          onChange={(e) => setMonto(e.target.value.replace(/\D/g, '').slice(0, 7))}
          inputMode="numeric"
          placeholder="Monto"
          aria-label="Monto"
          className="w-full h-14 px-4 rounded-xl border-2 border-slate-200 text-2xl font-black tabular-nums outline-none focus:border-marca"
        />
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Qué es (opcional): Varios"
          aria-label="Descripción"
          className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 text-[14px] outline-none focus:border-marca"
        />
        <div className="flex gap-2">
          <button onClick={onCancelar} className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600">
            Cancelar
          </button>
          <button
            onClick={aceptar}
            disabled={!valido}
            className="flex-[2] h-12 rounded-xl bg-accion text-sobre-accion text-[14px] font-black disabled:opacity-30"
          >
            {valido ? `Agregar ${pesos(valor)}` : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}

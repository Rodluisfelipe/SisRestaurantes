import { useEffect, useRef, useState } from 'react';

/**
 * Pedir un motivo por escrito, sin salirse de la app.
 *
 * Reemplaza a `window.prompt`, que era lo único de esta caja que se veía como
 * una página web de hace veinte años: una caja gris del sistema operativo, con
 * el botón en el idioma de Windows y no en el del negocio, imposible de
 * dibujar y encima bloqueante —congela el proceso entero mientras está abierta,
 * así que ni el reloj de inactividad ni la subida en segundo plano avanzan—.
 *
 * Lo que sí se conserva de `prompt` es lo único bueno que tenía: se opera
 * completa con el teclado. El foco entra solo en el campo, Enter confirma y
 * Escape cancela, porque el cajero tiene una mano en el dinero.
 */
export default function ModalMotivo({
  titulo,
  detalle,
  etiqueta,
  ejemplo,
  confirmar = 'Confirmar',
  onListo,
  onCancelar,
}: {
  titulo: string;
  /** La línea que dice sobre qué se está pidiendo el motivo. Opcional. */
  detalle?: string;
  etiqueta: string;
  ejemplo?: string;
  confirmar?: string;
  onListo: (motivo: string) => void;
  onCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { campo.current?.focus(); }, []);

  /* Escape se escucha en la ventana y no en el input: si el cajero tocó fuera
     del campo con el dedo, la tecla tiene que seguir cerrando igual. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCancelar]);

  // Un motivo en blanco no es motivo: el registro quedaría con una fila vacía.
  const valido = motivo.trim().length >= 3;
  const aceptar = () => { if (valido) onListo(motivo.trim()); };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center"
      onMouseDown={onCancelar}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[440px] bg-white rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <div>
          <p className="text-[15px] font-black">{titulo}</p>
          {detalle && <p className="text-[12.5px] text-slate-500 mt-0.5">{detalle}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {etiqueta}
          </label>
          <input
            ref={campo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aceptar(); } }}
            placeholder={ejemplo}
            maxLength={120}
            className="w-full h-12 px-3 rounded-xl border-2 border-slate-200 text-[14px] outline-none focus:border-marca"
          />
        </div>

        <div className="flex gap-2">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCancelar}
            className="w-32 h-toque rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
          >
            Cancelar
            <span className="block text-[10px] font-semibold text-slate-400">Esc</span>
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={aceptar}
            disabled={!valido}
            className="flex-1 h-toque rounded-xl bg-accion text-sobre-accion text-[13.5px] font-bold disabled:opacity-30"
          >
            {confirmar}
            <span className="block text-[10px] font-semibold opacity-60">Enter</span>
          </button>
        </div>
      </div>
    </div>
  );
}

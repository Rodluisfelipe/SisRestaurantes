import { useState } from 'react';
import { FaTimes, FaPlus, FaStar, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import ImageUploader from './ImageUploader';

/**
 * Galería de fotos de un producto.
 *
 * La primera foto es la principal: es la que se ve en el menú, el catálogo y
 * el POS. Las demás solo aparecen al abrir el producto, así el menú sigue
 * cargando igual de rápido para quien entra con datos móviles.
 */
export default function GaleriaProducto({ valor = [], onChange, max = 5 }) {
  const [agregando, setAgregando] = useState(false);
  const fotos = (Array.isArray(valor) ? valor : []).filter(Boolean);

  const cambiar = (nuevas) => onChange(nuevas.filter(Boolean).slice(0, max));

  const agregar = (url) => {
    const limpia = (url || '').trim();
    if (!limpia) return;
    if (fotos.includes(limpia)) {
      setAgregando(false);
      return;
    }
    cambiar([...fotos, limpia]);
    setAgregando(false);
  };

  const quitar = (i) => cambiar(fotos.filter((_, j) => j !== i));

  const mover = (i, paso) => {
    const j = i + paso;
    if (j < 0 || j >= fotos.length) return;
    const copia = [...fotos];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    cambiar(copia);
  };

  return (
    <div className="space-y-2">
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {fotos.map((url, i) => (
            <div
              key={url + i}
              className={`relative group rounded-lg overflow-hidden border bg-slate-50 ${
                i === 0 ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'
              }`}
            >
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-24 object-cover" />

              {i === 0 && (
                <span className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-600 text-white text-2xs font-bold">
                  <FaStar className="text-[7px]" /> PRINCIPAL
                </span>
              )}

              <button
                type="button"
                onClick={() => quitar(i)}
                title="Quitar esta foto"
                className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/55 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
              >
                <FaTimes className="text-2xs" />
              </button>

              <div className="absolute bottom-1 left-1 right-1 flex justify-between opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  title="Mover antes"
                  className="w-6 h-6 rounded-md bg-black/55 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/75"
                >
                  <FaChevronLeft className="text-2xs" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === fotos.length - 1}
                  title="Mover después"
                  className="w-6 h-6 rounded-md bg-black/55 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/75"
                >
                  <FaChevronRight className="text-2xs" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {agregando ? (
        <div className="rounded-lg border border-slate-200 p-2 space-y-2">
          <ImageUploader value="" onChange={agregar} folder="products" maxWidth={800} quality={80} />
          <button
            type="button"
            onClick={() => setAgregando(false)}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Cancelar
          </button>
        </div>
      ) : (
        fotos.length < max && (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
          >
            <FaPlus className="text-2xs" />
            {fotos.length === 0 ? 'Agregar foto' : 'Agregar otra foto'}
          </button>
        )
      )}

      <p className="text-[11px] text-slate-400">
        {fotos.length}/{max} fotos. La primera es la que se ve en el menú; las demás aparecen al
        abrir el producto.
      </p>
    </div>
  );
}

import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, X, Check, Ban } from 'lucide-react';
import { Hoja } from '../ui';

/**
 * "Se acabó": pausar o volver a activar productos en un toque, sin entrar a
 * Productos ni abrir la ficha.
 *
 * Es de lo que más se hace en el panel (más de 230 veces en un mes) y antes
 * pedía: ir a Productos, buscar, abrir el menú de la tarjeta y cambiarlo.
 * Acá: se escribe un pedazo del nombre y se toca el botón grande.
 */
export default function DisponibilidadRapida({ abierta, onCerrar, productos = [], categorias = [], onCambiar }) {
  const [busqueda, setBusqueda] = useState('');
  const [soloPausados, setSoloPausados] = useState(false);
  const [cambiando, setCambiando] = useState(() => new Set());
  const entrada = useRef(null);

  useEffect(() => {
    if (!abierta) return undefined;
    setBusqueda('');
    setSoloPausados(false);
    const id = setTimeout(() => entrada.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [abierta]);

  const nombreCategoria = useMemo(() => {
    const m = new Map(categorias.map((c) => [c._id, c.name]));
    return (id) => m.get(id) || '';
  }, [categorias]);

  const pausados = productos.filter((p) => p.active === false).length;

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return productos
      .filter((p) => !soloPausados || p.active === false)
      .filter((p) => {
        if (!q) return true;
        const texto = `${p.name} ${nombreCategoria(p.category)}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        return texto.includes(q);
      })
      // Los pausados primero: son los que hay que acordarse de volver a activar.
      .sort((a, b) => (a.active === false ? 0 : 1) - (b.active === false ? 0 : 1) || a.name.localeCompare(b.name));
  }, [productos, busqueda, soloPausados, nombreCategoria]);

  const cambiar = async (p) => {
    if (cambiando.has(p._id)) return;
    setCambiando((s) => new Set(s).add(p._id));
    try {
      await onCambiar?.(p._id);
    } finally {
      setCambiando((s) => { const n = new Set(s); n.delete(p._id); return n; });
    }
  };

  const cabecera = (
    <div className="px-5 pt-5 pb-3 border-b border-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">¿Qué hay y qué no hay?</h2>
          <p className="text-sm text-slate-500 mt-0.5">Lo que marques como no disponible deja de salir en el menú.</p>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar" className="shrink-0 w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="relative mt-4">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={entrada}
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Escribe el producto… (ej: limonada)"
          className="w-full pl-11 pr-4 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
        />
      </div>
      {pausados > 0 && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setSoloPausados(false)}
            className={`px-3.5 h-9 rounded-full text-sm font-semibold border ${!soloPausados ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setSoloPausados(true)}
            className={`px-3.5 h-9 rounded-full text-sm font-semibold border ${soloPausados ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            No disponibles ({pausados})
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} etiqueta="Disponibilidad de productos" cabecera={cabecera} ancho="max-w-xl" alto="completo">
      <ul className="px-3 py-2">
        {lista.map((p) => {
          const disponible = p.active !== false;
          const ocupado = cambiando.has(p._id);
          return (
            <li key={p._id} className="flex items-center gap-3 px-2 py-2.5 border-b border-slate-100 last:border-b-0">
              {p.image ? (
                <img src={p.image} alt="" loading="lazy" className={`w-12 h-12 rounded-xl object-cover shrink-0 ${disponible ? '' : 'grayscale opacity-60'}`} />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-[15px] font-semibold leading-snug break-words ${disponible ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{p.name}</p>
                {nombreCategoria(p.category) && <p className="text-xs text-slate-400 mt-0.5">{nombreCategoria(p.category)}</p>}
              </div>
              <button
                onClick={() => cambiar(p)}
                disabled={ocupado}
                aria-pressed={disponible}
                className={`shrink-0 min-w-[132px] h-11 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 border transition-colors disabled:opacity-60 ${
                  disponible
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                }`}
              >
                {disponible ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                {ocupado ? 'Guardando…' : disponible ? 'Disponible' : 'No disponible'}
              </button>
            </li>
          );
        })}
      </ul>
      {lista.length === 0 && (
        <div className="text-center py-14 px-6">
          <p className="text-base font-semibold text-slate-500">
            {busqueda ? `No hay productos con “${busqueda}”` : 'Todo está disponible'}
          </p>
        </div>
      )}
    </Hoja>
  );
}

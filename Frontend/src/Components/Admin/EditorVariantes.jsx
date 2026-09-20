import { useMemo, useState } from 'react';
import { FaPlus, FaTimes, FaTags } from 'react-icons/fa';

/**
 * Variantes del producto para las tiendas (ecommerce).
 *
 * El negocio inventa sus propios ejes —Talla, Fragancia, Color, Material— y
 * aquí se arma una fila por combinación. Precio y costo vacíos significan "los
 * del producto", así una talla que cuesta lo mismo no obliga a repetir nada.
 *
 * Deliberadamente no se genera nada solo: el negocio decide qué combinaciones
 * existen de verdad (puede haber camiseta negra en S y M, pero blanca solo en M).
 */
const MAX_OPCIONES = 3;
const MAX_VALORES = 30;
const MAX_VARIANTES = 100;

const iguales = (a, b) => a.length === b.length && a.every((v, i) => v.toLowerCase() === b[i]?.toLowerCase());

export default function EditorVariantes({ opciones = [], variantes = [], fotos = [], onChange }) {
  const [nuevoEje, setNuevoEje] = useState('');
  const [nuevoValor, setNuevoValor] = useState({});

  const ejes = Array.isArray(opciones) ? opciones : [];
  const filas = Array.isArray(variantes) ? variantes : [];

  const cambiar = (nuevosEjes, nuevasFilas) => {
    // Al quitar un valor, sus combinaciones dejan de existir: si no, quedarían
    // filas que el cliente podría pedir y el negocio ya no vende.
    const permitidos = nuevosEjes.map((e) => e.valores.map((v) => v.toLowerCase()));
    const vivas = nuevasFilas.filter(
      (f) => f.valores.length === nuevosEjes.length &&
        f.valores.every((valor, i) => permitidos[i]?.includes(String(valor).toLowerCase())),
    );
    onChange({ opciones: nuevosEjes, variantes: vivas });
  };

  const agregarEje = () => {
    const nombre = nuevoEje.trim();
    if (!nombre || ejes.length >= MAX_OPCIONES) return;
    if (ejes.some((e) => e.nombre.toLowerCase() === nombre.toLowerCase())) return;
    cambiar([...ejes, { nombre, valores: [] }], filas);
    setNuevoEje('');
  };

  const quitarEje = (i) => cambiar(ejes.filter((_, j) => j !== i), []);

  const agregarValor = (i) => {
    const valor = (nuevoValor[i] || '').trim();
    if (!valor) return;
    const eje = ejes[i];
    if (eje.valores.length >= MAX_VALORES) return;
    if (eje.valores.some((v) => v.toLowerCase() === valor.toLowerCase())) return;
    const nuevos = ejes.map((e, j) => (j === i ? { ...e, valores: [...e.valores, valor] } : e));
    cambiar(nuevos, filas);
    setNuevoValor((prev) => ({ ...prev, [i]: '' }));
  };

  const quitarValor = (i, valor) => {
    const nuevos = ejes.map((e, j) => (j === i ? { ...e, valores: e.valores.filter((v) => v !== valor) } : e));
    cambiar(nuevos, filas);
  };

  // Combinaciones posibles según los ejes, para ofrecer las que faltan.
  const posibles = useMemo(() => {
    if (!ejes.length || ejes.some((e) => !e.valores.length)) return [];
    return ejes.reduce(
      (acumulado, eje) => acumulado.flatMap((previa) => eje.valores.map((valor) => [...previa, valor])),
      [[]],
    );
  }, [ejes]);

  const faltantes = posibles.filter((combo) => !filas.some((f) => iguales(f.valores, combo)));

  const agregarFila = (valores) =>
    cambiar(ejes, [...filas, { valores, sku: '', precio: '', costo: '', stock: 0, imagen: '', activo: true }]);

  const agregarTodas = () => cambiar(ejes, [...filas, ...faltantes.slice(0, MAX_VARIANTES - filas.length).map((valores) => ({
    valores, sku: '', precio: '', costo: '', stock: 0, imagen: '', activo: true,
  }))]);

  const editarFila = (i, cambios) => cambiar(ejes, filas.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  const quitarFila = (i) => cambiar(ejes, filas.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      {/* ── Ejes ── */}
      <div className="rounded-lg border border-slate-200 p-3 space-y-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <FaTags className="text-slate-400 text-[10px]" />
          Opciones del producto
        </p>

        {ejes.map((eje, i) => (
          <div key={eje.nombre + i} className="rounded-lg bg-slate-50 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">{eje.nombre}</span>
              <button
                type="button"
                onClick={() => quitarEje(i)}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title={`Quitar ${eje.nombre}`}
              >
                <FaTimes className="text-xs" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {eje.valores.map((valor) => (
                <span
                  key={valor}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-xs text-slate-700"
                >
                  {valor}
                  <button
                    type="button"
                    onClick={() => quitarValor(i, valor)}
                    className="text-slate-300 hover:text-red-500"
                    title={`Quitar ${valor}`}
                  >
                    <FaTimes className="text-[9px]" />
                  </button>
                </span>
              ))}
              {eje.valores.length === 0 && (
                <span className="text-[11px] text-amber-600">Agrega al menos un valor</span>
              )}
            </div>

            <div className="flex gap-1.5">
              <input
                value={nuevoValor[i] || ''}
                onChange={(e) => setNuevoValor((prev) => ({ ...prev, [i]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarValor(i); } }}
                placeholder={eje.nombre === 'Talla' ? 'S, M, L…' : 'Agregar valor'}
                className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => agregarValor(i)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200"
              >
                Agregar
              </button>
            </div>
          </div>
        ))}

        {ejes.length < MAX_OPCIONES && (
          <div className="flex gap-1.5">
            <input
              value={nuevoEje}
              onChange={(e) => setNuevoEje(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarEje(); } }}
              placeholder="Talla, Color, Fragancia, Material…"
              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={agregarEje}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100"
            >
              <FaPlus className="text-[9px]" /> Opción
            </button>
          </div>
        )}

        <p className="text-[11px] text-slate-400">
          Hasta {MAX_OPCIONES} opciones. Sin opciones, el producto se vende con un solo precio y un
          solo stock, como siempre.
        </p>
      </div>

      {/* ── Combinaciones ── */}
      {posibles.length > 0 && (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-600">
              Combinaciones ({filas.length}/{posibles.length})
            </span>
            {faltantes.length > 0 && filas.length < MAX_VARIANTES && (
              <button
                type="button"
                onClick={agregarTodas}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Agregar las {faltantes.length} que faltan
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {filas.map((fila, i) => (
              <div key={fila.valores.join('/') + i} className={`p-2.5 space-y-2 ${fila.activo === false ? 'bg-slate-50/70' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">
                    {fila.valores.join(' · ')}
                  </span>
                  <label className="flex items-center gap-1 text-[11px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={fila.activo !== false}
                      onChange={(e) => editarFila(i, { activo: e.target.checked })}
                    />
                    A la venta
                  </label>
                  <button
                    type="button"
                    onClick={() => quitarFila(i)}
                    className="text-slate-400 hover:text-red-500"
                    title="Quitar combinación"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input
                    value={fila.sku || ''}
                    onChange={(e) => editarFila(i, { sku: e.target.value })}
                    placeholder="Referencia"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={fila.precio ?? ''}
                    onChange={(e) => editarFila(i, { precio: e.target.value })}
                    inputMode="numeric"
                    placeholder="Precio"
                    title="Vacío = el precio del producto"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={fila.stock ?? 0}
                    onChange={(e) => editarFila(i, { stock: e.target.value })}
                    inputMode="numeric"
                    placeholder="Stock"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  <select
                    value={fila.imagen || ''}
                    onChange={(e) => editarFila(i, { imagen: e.target.value })}
                    title="Qué foto se muestra al elegir esta combinación"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  >
                    <option value="">Foto principal</option>
                    {fotos.map((url, j) => (
                      <option key={url} value={url}>Foto {j + 1}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {filas.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-slate-400">
                Todavía no has agregado combinaciones.
              </p>
            )}
          </div>

          {faltantes.length > 0 && filas.length < MAX_VARIANTES && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2.5 border-t border-slate-100 bg-slate-50/60">
              {faltantes.slice(0, 12).map((combo) => (
                <button
                  key={combo.join('/')}
                  type="button"
                  onClick={() => agregarFila(combo)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-slate-200 text-[11px] text-slate-600 hover:border-blue-300 hover:text-blue-600"
                >
                  <FaPlus className="text-[8px]" /> {combo.join(' · ')}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        El precio vacío usa el del producto. El stock de cada combinación es el que ve el cliente:
        cuando llega a cero, esa talla o color aparece agotado.
      </p>
    </div>
  );
}

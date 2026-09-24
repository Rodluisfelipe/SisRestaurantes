import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * Cuánto se gana: ventas menos lo que costó lo vendido.
 *
 * El negocio sabía cuánto vendía, no cuánto ganaba ni qué productos le dejan
 * margen. Junta la caja y el menú, como Completados. Lo que no tiene costo
 * registrado se lista aparte para completarlo: no se inventa.
 */

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const hoy = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const haceDias = (n) => new Date(Date.now() - 5 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);

const RAPIDOS = [
  { id: 'hoy', nombre: 'Hoy', desde: hoy, hasta: hoy },
  { id: '7', nombre: '7 días', desde: () => haceDias(6), hasta: hoy },
  { id: 'mes', nombre: 'Este mes', desde: () => hoy().slice(0, 8) + '01', hasta: hoy },
  { id: '30', nombre: '30 días', desde: () => haceDias(29), hasta: hoy },
];

const colorMargen = (m) => (m === null ? 'text-slate-400' : m >= 60 ? 'text-emerald-700' : m >= 35 ? 'text-amber-700' : 'text-red-600');

export default function Rentabilidad() {
  const { businessId } = useBusinessConfig();
  const [rapido, setRapido] = useState('mes');
  const [desde, setDesde] = useState(hoy().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy());
  const [vista, setVista] = useState('productos');
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setCargando(true);
    try {
      setD((await api.get(`/rentabilidad?businessId=${businessId}&desde=${desde}&hasta=${hasta}`)).data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo calcular');
    } finally {
      setCargando(false);
    }
  }, [businessId, desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-2xl p-2">
        {RAPIDOS.map((r) => (
          <button key={r.id} onClick={() => { setRapido(r.id); setDesde(r.desde()); setHasta(r.hasta()); }}
            className={`h-9 px-3 rounded-lg text-[12.5px] font-semibold ${rapido === r.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            {r.nombre}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-auto text-[12.5px] text-slate-500">
          <input type="date" value={desde} max={hasta} onChange={(e) => { setRapido(''); setDesde(e.target.value); }} className="h-9 px-2 rounded-lg border border-slate-200" />
          <span>a</span>
          <input type="date" value={hasta} min={desde} onChange={(e) => { setRapido(''); setHasta(e.target.value); }} className="h-9 px-2 rounded-lg border border-slate-200" />
        </div>
      </div>

      {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}
      {cargando && !d && <p className="text-[13px] text-slate-400">Calculando…</p>}

      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tarjeta titulo="Ventas netas" valor={pesos(d.ventasNetas)} pie={`${d.pedidos} pedidos · descuentos ${pesos(d.descuentos)}`} />
            <Tarjeta titulo="Costo de lo vendido" valor={pesos(d.costo)} />
            <Tarjeta titulo="Utilidad bruta" valor={pesos(d.utilidad)} fuerte />
            <Tarjeta titulo="Margen" valor={`${d.margen}%`} pie={`Sobre el ${d.cobertura}% de las ventas que tiene costo`} />
          </div>

          {d.cobertura < 80 && d.ventas > 0 && (
            <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12.5px] text-amber-800">
              Solo el {d.cobertura}% de lo vendido tiene costo registrado ({pesos(d.sinCostoVentas)} sin costo).
              Completa el costo de esos productos —o su receta— para que el margen hable de todo el negocio.
            </p>
          )}
          <p className="text-[11.5px] text-slate-400">
            Precios con impuesto incluido, como se cobran. El costo de los extras no se incluye.
          </p>

          <div className="flex gap-1.5">
            {[['productos', 'Por producto'], ['categorias', 'Por categoría'], ['sincosto', `Sin costo (${d.sinCosto.length})`]].map(([id, n]) => (
              <button key={id} onClick={() => setVista(id)}
                className={`h-9 px-3 rounded-lg text-[12.5px] font-semibold ${vista === id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                {n}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-semibold p-3">{vista === 'categorias' ? 'Categoría' : 'Producto'}</th>
                  {vista !== 'categorias' && <th className="text-right font-semibold p-3">Cant.</th>}
                  <th className="text-right font-semibold p-3">Ventas</th>
                  {vista !== 'sincosto' && <th className="text-right font-semibold p-3">Costo</th>}
                  {vista !== 'sincosto' && <th className="text-right font-semibold p-3">Utilidad</th>}
                  {vista !== 'sincosto' && <th className="text-right font-semibold p-3">Margen</th>}
                </tr>
              </thead>
              <tbody>
                {(vista === 'categorias' ? d.categorias : vista === 'sincosto' ? d.sinCosto : d.productos.filter((p) => p.utilidad !== null)).map((f) => (
                  <tr key={f.productoId || f.nombre || f.categoria} className="border-t border-slate-100">
                    <td className="p-3 font-semibold text-slate-800">
                      {f.nombre || f.categoria}
                      {f.categoria && f.nombre && <span className="block text-[11px] font-normal text-slate-400">{f.categoria}</span>}
                    </td>
                    {vista !== 'categorias' && <td className="p-3 text-right tabular-nums">{f.cantidad}</td>}
                    <td className="p-3 text-right tabular-nums">{pesos(f.ventas)}</td>
                    {vista !== 'sincosto' && <td className="p-3 text-right tabular-nums text-slate-500">{pesos(f.costo)}</td>}
                    {vista !== 'sincosto' && <td className="p-3 text-right tabular-nums font-bold">{pesos(f.utilidad)}</td>}
                    {vista !== 'sincosto' && <td className={`p-3 text-right tabular-nums font-bold ${colorMargen(f.margen)}`}>{f.margen}%</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {vista === 'sincosto' && d.sinCosto.length === 0 && (
              <p className="p-6 text-center text-[13px] text-slate-400">Todo lo vendido tiene costo.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Tarjeta({ titulo, valor, pie, fuerte }) {
  return (
    <div className={`rounded-2xl border p-4 ${fuerte ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200'}`}>
      <p className={`text-[11.5px] font-bold uppercase tracking-wide ${fuerte ? 'text-slate-400' : 'text-slate-400'}`}>{titulo}</p>
      <p className="text-2xl font-black tabular-nums mt-1">{valor}</p>
      {pie && <p className={`text-[12px] mt-0.5 ${fuerte ? 'text-slate-400' : 'text-slate-500'}`}>{pie}</p>}
    </div>
  );
}

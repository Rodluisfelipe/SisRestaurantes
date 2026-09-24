import { useEffect, useState } from 'react';
import superadminApi from '../../services/superadminApi';
import { BarrasEmbudo } from '../Admin/EmbudoPedidos';

/**
 * Dónde se caen los pedidos del menú, en todos los negocios o en uno.
 *
 * Arriba el embudo (vieron el menú → abrieron el carrito → … → pidieron) y
 * abajo cada negocio con sus visitas, cuántos llegaron a tener carrito y
 * cuántos pidieron. Tocar un negocio filtra el embudo a ese negocio.
 */
export default function EmbudoPedidosGlobal() {
  const [dias, setDias] = useState(7);
  const [negocio, setNegocio] = useState(null); // { id, nombre } | null = todos
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setError('');
    superadminApi.get('/embudo-pedidos', { params: { dias, ...(negocio ? { businessId: negocio.id } : {}) } })
      .then(({ data }) => { if (vivo) setDatos(data); })
      .catch(() => { if (vivo) setError('No se pudo cargar el embudo'); });
    return () => { vivo = false; };
  }, [dias, negocio]);

  const pasos = datos?.pasos || [];
  const total = pasos[0]?.llegaron || 0;
  const pidieron = pasos[pasos.length - 1]?.llegaron || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Embudo de pedidos</h2>
          <p className="text-sm text-slate-500">
            {negocio ? <>Solo <b>{negocio.nombre}</b> · <button type="button" onClick={() => setNegocio(null)} className="underline">ver todos</button></> : 'Todos los negocios'}
          </p>
        </div>
        <div className="flex p-0.5 bg-slate-100 rounded-lg" role="radiogroup" aria-label="Periodo">
          {[1, 7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={dias === d}
              onClick={() => setDias(d)}
              className={`h-8 px-3 rounded-md text-xs font-semibold ${dias === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {d === 1 ? 'Hoy' : `${d} días`}
            </button>
          ))}
        </div>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-4">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !datos ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-7 rounded bg-slate-100 animate-pulse" />)}</div>
        ) : total === 0 ? (
          <p className="text-sm text-slate-500">Sin visitas en este periodo.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Dato etiqueta="Visitas" valor={total.toLocaleString('es-CO')} />
              <Dato etiqueta="Pidieron" valor={pidieron.toLocaleString('es-CO')} />
              <Dato etiqueta="Conversión" valor={`${total ? Math.round((pidieron / total) * 1000) / 10 : 0}%`} />
            </div>
            <BarrasEmbudo pasos={pasos} />
          </>
        )}
      </section>

      {datos?.negocios?.length > 0 && !negocio && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Por negocio</h3>
            <p className="text-xs text-slate-500">Los 30 con más visitas. Toca uno para ver su embudo.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 bg-slate-50">
                <tr>
                  <th className="text-left font-semibold px-4 py-2">Negocio</th>
                  <th className="text-right font-semibold px-3 py-2">Visitas</th>
                  <th className="text-right font-semibold px-3 py-2">Con carrito</th>
                  <th className="text-right font-semibold px-3 py-2">Pidieron</th>
                  <th className="text-right font-semibold px-4 py-2">Conversión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datos.negocios.map((n) => (
                  <tr key={n.id} onClick={() => setNegocio({ id: n.id, nombre: n.nombre })} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{n.nombre}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n.visitas}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n.conCarrito}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{n.pidieron}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${n.conversion >= 10 ? 'text-emerald-700' : n.conversion > 0 ? 'text-slate-700' : 'text-slate-400'}`}>{n.conversion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{etiqueta}</p>
      <p className="text-lg font-black text-slate-900 tabular-nums">{valor}</p>
    </div>
  );
}

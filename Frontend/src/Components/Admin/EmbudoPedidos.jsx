import { useEffect, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import api from '../../services/api';

/**
 * Dónde se caen los pedidos del menú.
 *
 * De las visitas de los últimos días, cuántas llegaron a cada paso: abrir el
 * carrito, ir a finalizar, elegir cómo recibirlo, poner la dirección, elegir
 * cómo pagar y pedir. El paso donde más gente se va queda marcado: ahí es
 * donde vale la pena mejorar (y donde muchos terminan escribiendo por
 * WhatsApp en vez de pedir).
 */
export default function EmbudoPedidos({ businessId }) {
  const [dias, setDias] = useState(7);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!businessId) return undefined;
    let vivo = true;
    setError('');
    api.get('/dashboard/embudo', { params: { businessId, dias } })
      .then(({ data }) => { if (vivo) setDatos(data); })
      .catch(() => { if (vivo) setError('No se pudo cargar el embudo'); });
    return () => { vivo = false; };
  }, [businessId, dias]);

  const pasos = datos?.pasos || [];
  const total = pasos[0]?.llegaron || 0;
  // El paso (después del primero) donde más gente se va, en porcentaje.
  const peor = pasos.slice(1).reduce((m, p) => (p.pctCaida > (m?.pctCaida || 0) ? p : m), null);

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">¿Dónde se caen los pedidos?</h3>
          <p className="text-xs text-slate-500">De las visitas al menú, cuántas llegaron a cada paso</p>
        </div>
        <div className="flex p-0.5 bg-slate-100 rounded-lg shrink-0" role="radiogroup" aria-label="Periodo">
          {[7, 30].map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={dias === d}
              onClick={() => setDias(d)}
              className={`h-7 px-2.5 rounded-md text-xs font-semibold ${dias === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !datos ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-7 rounded bg-slate-100 animate-pulse" />)}</div>
      ) : total === 0 ? (
        <p className="text-sm text-slate-500">Aún no hay visitas en este periodo. El embudo se llena a medida que los clientes usan el menú.</p>
      ) : (
        <>
          <ol className="space-y-1.5">
            {pasos.map((p, i) => {
              const esPeor = peor && p.clave === peor.clave && p.pctCaida >= 15;
              const ancho = total ? Math.max(2, (p.llegaron / total) * 100) : 0;
              return (
                <li key={p.clave}>
                  {i > 0 && p.seCayeron > 0 && (
                    <p className={`text-[11px] pl-1 mb-0.5 ${esPeor ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>
                      ↓ se fueron {p.seCayeron} ({p.pctCaida}%)
                    </p>
                  )}
                  <div className={`relative h-8 rounded-lg overflow-hidden ${esPeor ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-slate-50'}`}>
                    <div
                      className={`absolute inset-y-0 left-0 rounded-lg ${p.clave === 'pidieron' ? 'bg-emerald-200' : esPeor ? 'bg-amber-200' : 'bg-slate-200'}`}
                      style={{ width: `${ancho}%` }}
                    />
                    <div className="relative h-full flex items-center justify-between px-2.5 text-xs">
                      <span className="font-semibold text-slate-800">{p.nombre}</span>
                      <span className="tabular-nums text-slate-700">
                        <b>{p.llegaron.toLocaleString('es-CO')}</b> <span className="text-slate-500">· {p.deTodos}%</span>
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {peor && peor.pctCaida >= 15 && (
            <p className="mt-3 flex items-start gap-2 text-xs text-slate-600">
              <TrendingDown className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                La mayor caída está en <b>{peor.nombre.toLowerCase()}</b>: {peor.pctCaida}% de los que llegaron al paso anterior no siguieron.
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}

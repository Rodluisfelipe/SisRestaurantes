import { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Dónde va el paquete, según la transportadora.
 *
 * La misma vista la usan el cliente (en su seguimiento) y el negocio (en el
 * pedido): los dos hacen exactamente la misma pregunta y no tiene sentido
 * pintarla dos veces con dos criterios distintos.
 *
 * Se ramifica por `fase`, nunca por el texto del estado: la transportadora
 * cambia la redacción ("EN TRANSITO", "En tránsito hacia BOGOTA") y el backend
 * ya la agrupó. Repetir aquí esas expresiones sueltas es cómo se termina
 * pintando el mismo estado de dos colores.
 */

const COLOR_FASE = {
  entregado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  en_reparto: 'bg-blue-50 text-blue-700 border-blue-200',
  en_transito: 'bg-blue-50 text-blue-700 border-blue-200',
  admitido: 'bg-amber-50 text-amber-700 border-amber-200',
  novedad: 'bg-red-50 text-red-700 border-red-200',
  desconocido: 'bg-slate-50 text-slate-600 border-slate-200',
};

const TITULO_FASE = {
  entregado: 'Entregado',
  en_reparto: 'En reparto',
  en_transito: 'En camino',
  admitido: 'Admitido',
  novedad: 'Con novedad',
  desconocido: 'En proceso',
};

export default function RastreoEnvio({ guia, transportadora, urlRastreo, compacto = false }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!guia) return;
    const ac = new AbortController();
    /* Tope del lado del cliente: si la consulta se cuelga, el spinner giraría
       para siempre y el cliente se queda sin ver ni siquiera su guía. */
    const reloj = setTimeout(() => ac.abort(), 20000);

    setCargando(true);
    api.get(`/rastreo?guia=${encodeURIComponent(guia)}&transportadora=${encodeURIComponent(transportadora || '')}`,
      { signal: ac.signal })
      .then((res) => { setDatos(res.data); setError(''); })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.error || 'No pudimos consultar el estado del envío.');
      })
      .finally(() => { clearTimeout(reloj); setCargando(false); });

    return () => { clearTimeout(reloj); ac.abort(); };
  }, [guia, transportadora]);

  const cabecera = (
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tu envío</p>
      <p className="text-[11px] text-slate-400 tabular-nums">Guía {guia}</p>
    </div>
  );

  if (cargando) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
        {cabecera}
        <p className="mt-2 text-[12.5px] text-slate-400">Consultando a {transportadora || 'la transportadora'}…</p>
      </div>
    );
  }

  /* Si el rastreo falla, la guía y la transportadora siguen a la vista: el
     cliente puede consultarla él mismo. Perder el dato sería peor que no
     poder mostrar el detalle. */
  if (error || !datos?.encontrado) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
        {cabecera}
        <p className="mt-1 text-[13.5px] font-bold text-slate-800">{transportadora}</p>
        <p className="mt-0.5 text-[12px] text-slate-400">{error || 'Todavía no hay movimientos registrados.'}</p>
        {urlRastreo && (
          <a href={urlRastreo} target="_blank" rel="noopener noreferrer"
            className="inline-flex mt-2.5 px-3.5 py-2 rounded-full bg-slate-900 text-white text-[12px] font-bold">
            Rastrear en {transportadora}
          </a>
        )}
      </div>
    );
  }

  const movimientos = compacto ? datos.movimientos.slice(0, 3) : datos.movimientos.slice(0, 8);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      {cabecera}

      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${COLOR_FASE[datos.fase] || COLOR_FASE.desconocido}`}>
          {TITULO_FASE[datos.fase] || 'En proceso'}
        </span>
        {/* El texto de la transportadora, tal cual, debajo de la fase. */}
        <span className="text-[12px] font-semibold text-slate-700">{datos.estado}</span>
      </div>

      {(datos.origen || datos.destino) && (
        <p className="mt-1 text-[11.5px] text-slate-400">
          {datos.origen || '—'} → {datos.destino || '—'}
          {datos.fechaEntrega ? ` · entregado ${datos.fechaEntrega}` : ''}
        </p>
      )}

      {movimientos.length > 0 && (
        <div className="mt-3 space-y-2">
          {movimientos.map((m, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="flex flex-col items-center pt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-slate-900' : 'bg-slate-300'}`} />
                {i < movimientos.length - 1 && <span className="flex-1 w-px bg-slate-200 mt-1" />}
              </div>
              <div className="pb-1 min-w-0">
                <p className={`text-[12.5px] leading-snug ${i === 0 ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                  {m.descripcion}
                </p>
                <p className="text-[11px] text-slate-400">
                  {/* Siempre la fecha cruda de la transportadora: si algún día
                      cambia el formato, se degrada el orden, no lo que se lee. */}
                  {m.fecha}{m.ubicacion ? ` · ${m.ubicacion}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {datos.totalMovimientos > movimientos.length && (
        <p className="mt-2 text-[11px] text-slate-400">
          y {datos.totalMovimientos - movimientos.length} movimiento(s) más
        </p>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * Las cajas registradoras del negocio.
 *
 * Dos cosas, y las dos importan a horas distintas:
 *
 * - **Vincular** una caja nueva. Genera un código de ocho caracteres que el
 *   dueño dicta o escribe en la terminal. Reemplaza al flujo anterior —copiar
 *   un token desde las herramientas del navegador—, que funcionaba solo para
 *   quien ya sabía qué es un token.
 * - **Desvincular** una que se perdió. Esto se usa un martes a las nueve de la
 *   noche, cuando alguien se llevó la terminal, y por eso está a un clic y no
 *   detrás de una llamada a soporte.
 */
export default function Cajas() {
  const { businessId } = useBusinessConfig();
  const [cajas, setCajas] = useState([]);
  const [codigo, setCodigo] = useState(null);
  const [nombre, setNombre] = useState('Caja principal');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setCargando(true);
    try {
      const res = await api.get(`/cajas?businessId=${businessId}`);
      setCajas(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar las cajas');
    } finally {
      setCargando(false);
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  const vincular = async () => {
    try {
      const res = await api.post('/cajas/vincular', { businessId, nombre });
      setCodigo(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo generar el código');
    }
  };

  const revocar = async (caja) => {
    /* Se pregunta porque no tiene vuelta: el token muere y esa terminal deja de
       poder subir. Lo que no se pierde son sus ventas, y el mensaje lo dice
       para que nadie crea que desvincular borra plata. */
    if (!window.confirm(
      `¿Desvincular "${caja.nombre}"?\n\nEsa terminal dejará de subir ventas. Las que tenga sin subir se quedan guardadas en esa máquina.`
    )) return;

    try {
      await api.post(`/cajas/${caja._id}/revocar`, { businessId });
      cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo desvincular');
    }
  };

  const cuando = (fecha) => {
    if (!fecha) return 'nunca';
    const minutos = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
    if (minutos < 2) return 'ahora mismo';
    if (minutos < 60) return `hace ${minutos} min`;
    if (minutos < 60 * 24) return `hace ${Math.round(minutos / 60)} h`;
    return `hace ${Math.round(minutos / 1440)} días`;
  };

  return (
    <div className="space-y-4">
      {/* Vincular */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div>
          <h3 className="text-[15px] font-bold text-slate-900">Conectar una caja</h3>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Genera un código y escríbelo en la caja registradora. No hace falta nada más.
          </p>
        </div>

        {!codigo ? (
          <div className="flex gap-2">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cómo se llama esta caja"
              className="flex-1 h-11 px-3 rounded-xl border-2 border-slate-200 text-[13.5px] outline-none focus:border-slate-900"
            />
            <button
              onClick={vincular}
              className="h-11 px-5 rounded-xl bg-slate-900 text-white text-[13px] font-bold"
            >
              Vincular nueva caja
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-900 text-white p-5 text-center">
            <p className="text-[11.5px] uppercase tracking-wide text-slate-400">
              Escribe este código en la caja
            </p>
            {/* Enorme y espaciado: esto se lee en voz alta por teléfono o se
                copia mirando la pantalla desde el otro lado del local. */}
            <p className="text-5xl font-black tracking-[0.15em] my-3 tabular-nums">{codigo.codigo}</p>
            <p className="text-[12px] text-slate-400">
              Para “{codigo.nombre}” · vence en {codigo.expira_en_minutos} minutos · sirve una sola vez
            </p>
            <button
              onClick={() => { setCodigo(null); cargar(); }}
              className="mt-4 h-10 px-4 rounded-xl bg-white text-slate-900 text-[12.5px] font-bold"
            >
              Ya la conecté
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}

      {/* Las que ya existen */}
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {cargando && <p className="p-4 text-[13px] text-slate-400">Cargando…</p>}

        {!cargando && cajas.length === 0 && (
          <p className="p-6 text-center text-[13px] text-slate-400">
            Todavía no hay cajas conectadas.
          </p>
        )}

        {cajas.map((c) => (
          <div key={c._id} className="flex items-center gap-3 p-3.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[13.5px] font-bold text-slate-800">{c.nombre}</p>
                {c.revocada ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">
                    Desvinculada
                  </span>
                ) : c.vencida ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    Vencida · hay que vincularla otra vez
                  </span>
                ) : c.callada ? (
                  /* Vinculada pero muda: casi siempre es que alguien la
                     desconectó del internet, y el dueño tiene que poder verlo. */
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                    Sin señal
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Activa
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-slate-400 mt-0.5">
                Última vez {cuando(c.ultimaVezVista)}
                {c.ultimaActividad ? ` · ${c.ultimaActividad}` : ''}
              </p>
            </div>

            {!c.revocada && (
              <button
                onClick={() => revocar(c)}
                className="h-9 px-3 rounded-lg text-[12px] font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                Desvincular
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

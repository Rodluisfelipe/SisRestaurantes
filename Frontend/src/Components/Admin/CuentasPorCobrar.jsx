import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * Cuentas por cobrar: a quién se le fía, cuánto debe y sus abonos.
 *
 * La caja fía (medio "Crédito", solo a clientes habilitados y hasta su cupo)
 * y recibe abonos. Aquí el dueño ve la cartera completa, decide a quién le
 * presta y cuánto, y anota los abonos que llegan por fuera de la caja.
 */

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const fecha = (f) => (f ? new Date(f).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '');

export default function CuentasPorCobrar() {
  const { businessId } = useBusinessConfig();
  const [datos, setDatos] = useState(null);
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    if (!businessId) return;
    try {
      setDatos((await api.get(`/credito?businessId=${businessId}`)).data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo cargar la cartera');
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!q.trim()) { setBusqueda(null); return; }
    const id = setTimeout(async () => {
      try {
        setBusqueda((await api.get(`/credito?businessId=${businessId}&q=${encodeURIComponent(q.trim())}`)).data.clientes);
      } catch { setBusqueda([]); }
    }, 250);
    return () => clearTimeout(id);
  }, [q, businessId]);

  const verMovimientos = async (c) => {
    if (abierto === c._id) { setAbierto(null); return; }
    setAbierto(c._id);
    try {
      setMovimientos((await api.get(`/credito/${c._id}/movimientos?businessId=${businessId}`)).data.movimientos);
    } catch { setMovimientos([]); }
  };

  const avisar = (t) => { setAviso(t); setError(''); setTimeout(() => setAviso(''), 4000); };

  const guardarCredito = async (c, cambios, texto) => {
    try {
      await api.put(`/credito/${c._id}?businessId=${businessId}`, cambios);
      avisar(texto);
      setQ('');
      cargar();
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo guardar');
    }
  };

  const abonar = async (c) => {
    const monto = parseInt(String(window.prompt(`Abono de ${c.name} (debe ${pesos(c.credito?.saldo)})`) || '').replace(/\D/g, ''), 10);
    if (!monto) return;
    const medio = window.confirm('¿Fue en efectivo? (Cancelar = transferencia)') ? 'efectivo' : 'transferencia';
    try {
      await api.post(`/credito/${c._id}/abono?businessId=${businessId}`, { monto, medio });
      avisar(`Abono de ${pesos(monto)} registrado`);
      cargar();
      if (abierto === c._id) setMovimientos((await api.get(`/credito/${c._id}/movimientos?businessId=${businessId}`)).data.movimientos);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo registrar el abono');
    }
  };

  const fila = (c, deBusqueda) => {
    const cr = c.credito || {};
    return (
      <div key={c._id}>
        <div className="flex flex-wrap items-center gap-3 p-3.5">
          <button onClick={() => !deBusqueda && verMovimientos(c)} className="flex-1 min-w-[160px] text-left">
            <p className="text-[13.5px] font-bold text-slate-800">{c.name || 'Sin nombre'}</p>
            <p className="text-[11.5px] text-slate-400">{c.phone}{c.documento ? ` · ${c.documento}` : ''}</p>
          </button>
          {cr.habilitado ? (
            <>
              <div className="text-right">
                <p className={`text-[14px] font-black tabular-nums ${cr.saldo > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{pesos(cr.saldo)}</p>
                <p className="text-[11px] text-slate-400">de {pesos(cr.cupo)} de cupo</p>
              </div>
              <button
                onClick={() => {
                  const cupo = parseInt(String(window.prompt(`Cupo de crédito para ${c.name}`, String(cr.cupo || 0)) || '').replace(/\D/g, ''), 10);
                  if (Number.isFinite(cupo)) guardarCredito(c, { cupo }, `Cupo de ${c.name}: ${pesos(cupo)}`);
                }}
                className="h-9 px-3 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cupo
              </button>
              {cr.saldo > 0 && (
                <button onClick={() => abonar(c)} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-bold">
                  Abono
                </button>
              )}
              <button
                onClick={() => guardarCredito(c, { habilitado: false }, `${c.name} ya no tiene crédito`)}
                title="Deja de fiarle. Lo que debe sigue debiéndolo."
                className="h-9 px-3 rounded-lg text-[12px] font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                Quitar crédito
              </button>
            </>
          ) : (
            <>
              {cr.saldo > 0 && <p className="text-[13px] font-bold text-amber-700 tabular-nums">Debe {pesos(cr.saldo)}</p>}
              <button
                onClick={() => {
                  const cupo = parseInt(String(window.prompt(`Cupo de crédito para ${c.name}`, '100000') || '').replace(/\D/g, ''), 10);
                  if (cupo > 0) guardarCredito(c, { habilitado: true, cupo }, `${c.name} ya puede comprar a crédito`);
                }}
                className="h-9 px-3 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-700"
              >
                Darle crédito
              </button>
              {cr.saldo > 0 && (
                <button onClick={() => abonar(c)} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-bold">Abono</button>
              )}
            </>
          )}
        </div>
        {abierto === c._id && !deBusqueda && (
          <div className="px-4 pb-4 space-y-1">
            {movimientos.length === 0 && <p className="text-[12.5px] text-slate-400">Sin movimientos.</p>}
            {movimientos.map((m) => (
              <div key={m._id} className="flex justify-between gap-3 text-[12.5px]">
                <span className="text-slate-600">
                  {fecha(m.fecha)} · {m.tipo === 'cargo' ? 'Fiado' : `Abono (${m.medio || '—'})`}
                  {m.referencia ? ` · ${m.referencia}` : ''}{m.usuario ? ` · ${m.usuario}` : ''}
                </span>
                <span className={`font-bold tabular-nums ${m.tipo === 'cargo' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {m.tipo === 'cargo' ? '+' : '−'}{pesos(m.monto)} → {pesos(m.saldoDespues)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-900 text-white p-4">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">Cartera por cobrar</p>
          <p className="text-2xl font-black tabular-nums mt-1">{pesos(datos?.cartera)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">Clientes con crédito</p>
          <p className="text-2xl font-black tabular-nums mt-1">{datos?.clientes?.filter((c) => c.credito?.habilitado).length ?? 0}</p>
        </div>
      </div>

      {aviso && <p className="text-[13px] font-semibold text-emerald-700">{aviso}</p>}
      {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar un cliente para darle crédito (nombre o teléfono)"
        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-[13.5px] bg-white"
      />

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {busqueda
          ? (busqueda.length ? busqueda.map((c) => fila(c, true)) : <p className="p-5 text-center text-[13px] text-slate-400">Nadie coincide</p>)
          : (datos?.clientes?.length
            ? datos.clientes.map((c) => fila(c, false))
            : <p className="p-6 text-center text-[13px] text-slate-400">Nadie tiene crédito todavía. Busca un cliente arriba para darle.</p>)}
      </div>
    </div>
  );
}

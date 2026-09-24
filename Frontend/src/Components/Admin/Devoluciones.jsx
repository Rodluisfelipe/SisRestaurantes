import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * Devoluciones y cambios de la tienda.
 *
 * El orden importa: primero las que están esperando que el cliente traiga el
 * producto, porque esas son las que tienen plata y unidades en el aire. Una
 * devolución solo mueve inventario cuando alguien dice "ya llegó", y ese botón
 * es el centro de esta pantalla.
 */

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

const ESTADOS = {
  pendiente: { label: 'Esperando el producto', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  recibida: { label: 'Recibida', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  resuelta: { label: 'Resuelta', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rechazada: { label: 'Rechazada', color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const MOTIVOS = {
  talla: 'Talla equivocada',
  defecto: 'Llegó defectuoso',
  no_era_lo_esperado: 'No era lo que esperaba',
  llego_tarde: 'Llegó tarde',
  arrepentimiento: 'Se arrepintió',
  otro: 'Otro',
};

/* Qué se puede hacer desde cada estado. Una devolución rechazada o resuelta no
   vuelve atrás: si hubo un error, se registra otra. */
const SIGUIENTES = {
  pendiente: [
    { estado: 'recibida', label: 'Ya llegó', principal: true },
    { estado: 'rechazada', label: 'Rechazar' },
  ],
  recibida: [
    { estado: 'resuelta', label: 'Resuelta', principal: true },
  ],
  resuelta: [],
  rechazada: [],
};

export default function Devoluciones() {
  const { businessId, businessConfig } = useBusinessConfig();
  const themeColor = businessConfig?.theme?.buttonColor || '#2563eb';

  const [datos, setDatos] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setCargando(true);
    try {
      const res = await api.get(`/devoluciones?businessId=${businessId}&limit=100`);
      setDatos(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar las devoluciones');
    } finally {
      setCargando(false);
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  const avanzar = async (devolucion, estado) => {
    setOcupado(devolucion._id);
    try {
      const res = await api.patch(`/devoluciones/${devolucion._id}/estado`, { businessId, estado });
      setDatos((d) => ({
        ...d,
        devoluciones: d.devoluciones.map((x) => (x._id === devolucion._id ? res.data : x)),
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo actualizar');
    } finally {
      setOcupado(null);
    }
  };

  const lista = (datos?.devoluciones || []).filter((d) => filtro === 'todas' || d.estado === filtro);
  const resumen = datos?.resumen;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { label: 'Esperando producto', valor: resumen.pendientes, resaltar: resumen.pendientes > 0 },
            { label: 'Por resolver', valor: resumen.porResolver, resaltar: resumen.porResolver > 0 },
            { label: 'Devuelto en plata', valor: pesos(resumen.montoDevuelto) },
            { label: 'Motivo más común', valor: MOTIVOS[resumen.motivoMasComun] || '—', pequeno: true },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-2xl border border-slate-200 p-3">
              <p className="text-2xs font-semibold text-slate-400 uppercase tracking-wide">{c.label}</p>
              <p className={`mt-0.5 font-black text-slate-900 ${c.pequeno ? 'text-[13px]' : 'text-lg'}`}
                 style={c.resaltar ? { color: themeColor } : undefined}>
                {c.valor}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {[{ id: 'todas', label: 'Todas' }, ...Object.entries(ESTADOS).map(([id, e]) => ({ id, label: e.label }))].map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
              filtro === f.id ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200'
            }`}
            style={filtro === f.id ? { backgroundColor: themeColor } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {cargando && <p className="text-sm text-slate-400 px-1">Cargando…</p>}
      {error && <p className="text-sm text-red-600 px-1">{error}</p>}

      {!cargando && !error && lista.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">
            {filtro === 'todas'
              ? 'Todavía no hay devoluciones. Se registran desde el pedido, en Completados.'
              : 'Nada en este estado.'}
          </p>
        </div>
      )}

      {/* Listado */}
      <div className="space-y-2">
        {lista.map((d) => {
          const estado = ESTADOS[d.estado] || ESTADOS.pendiente;
          return (
            <div key={d._id} className="bg-white rounded-2xl border border-slate-200 p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-slate-900">
                      {d.tipo === 'cambio' ? 'Cambio' : 'Devolución'}
                      {d.orderNumber ? ` · #${d.orderNumber}` : ''}
                    </span>
                    <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-md border ${estado.color}`}>
                      {estado.label}
                    </span>
                    {!d.reingresaStock && (
                      <span className="text-2xs font-bold px-1.5 py-0.5 rounded-md border border-red-200 bg-red-50 text-red-600">
                        No vuelve a bodega
                      </span>
                    )}
                  </div>

                  <p className="text-[11.5px] text-slate-400 mt-0.5">
                    {MOTIVOS[d.motivo] || 'Otro'}
                    {d.customerName ? ` · ${d.customerName}` : ''}
                    {' · '}
                    {new Date(d.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  </p>

                  <div className="mt-2 space-y-0.5">
                    {(d.items || []).map((i, k) => (
                      <p key={k} className="text-[12.5px] text-slate-700">
                        {i.quantity} × {i.name}
                        {i.variante?.valores?.length ? ` (${i.variante.valores.join(' · ')})` : ''}
                      </p>
                    ))}
                    {(d.cambioPor || []).map((i, k) => (
                      <p key={`c${k}`} className="text-[12.5px] text-emerald-700">
                        ↳ se lleva {i.quantity} × {i.name}
                        {i.variante?.valores?.length ? ` (${i.variante.valores.join(' · ')})` : ''}
                      </p>
                    ))}
                  </div>

                  {d.nota && <p className="text-[11.5px] text-slate-500 italic mt-1">“{d.nota}”</p>}
                </div>

                <div className="text-right flex-shrink-0">
                  {d.tipo === 'devolucion' ? (
                    <p className="text-[13px] font-black text-slate-900">-{pesos(d.montoDevuelto)}</p>
                  ) : d.diferencia !== 0 ? (
                    <p className={`text-[13px] font-black ${d.diferencia > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {d.diferencia > 0 ? '+' : '-'}{pesos(Math.abs(d.diferencia))}
                    </p>
                  ) : (
                    <p className="text-[12px] font-semibold text-slate-400">Parejo</p>
                  )}
                </div>
              </div>

              {SIGUIENTES[d.estado]?.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {SIGUIENTES[d.estado].map((accion) => (
                    <button
                      key={accion.estado}
                      onClick={() => avanzar(d, accion.estado)}
                      disabled={ocupado === d._id}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors disabled:opacity-40 ${
                        accion.principal ? 'text-white' : 'border border-slate-200 text-slate-500'
                      }`}
                      style={accion.principal ? { backgroundColor: themeColor } : undefined}
                    >
                      {ocupado === d._id ? '…' : accion.label}
                    </button>
                  ))}
                  {d.estado === 'pendiente' && (
                    <span className="self-center text-[11px] text-slate-400">
                      Al marcarla recibida vuelve al inventario
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

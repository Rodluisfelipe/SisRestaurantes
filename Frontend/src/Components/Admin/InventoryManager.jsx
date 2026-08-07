import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useBusinessConfig } from '../../Context/BusinessContext';
import api from '../../services/api';

/**
 * Inventario.
 *
 * El stock vivía dentro del formulario de cada producto, así que para saber
 * qué se estaba agotando había que abrirlos uno por uno. Aquí se ve todo junto
 * y se ajusta sin entrar a editar el producto.
 */

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

const NIVELES = [
  { id: 'off', label: 'Sin control', desc: 'No se lleva inventario.' },
  { id: 'basic', label: 'Básico', desc: 'Cantidad por producto, historial de movimientos, costo y aviso cuando algo se agota.' },
  { id: 'advanced', label: 'Avanzado', desc: 'Además insumos y recetas: vender un plato descuenta pan, carne y queso.' },
];

const FILTROS = [
  { id: 'urgente', label: 'Requieren atención' },
  { id: 'control', label: 'Con control' },
  { id: 'sin', label: 'Sin control' },
  { id: 'todos', label: 'Todos' },
];

/** En qué estado está una línea: agotado, bajo, bien, o sin control. */
function estadoDe(p) {
  if (!p.trackStock) return 'sin';
  const s = p.stock ?? 0;
  if (s <= 0) return 'agotado';
  if (s <= (p.lowStockAlert || 5)) return 'bajo';
  return 'bien';
}

const COLOR = {
  agotado: 'bg-red-50 text-red-700 border-red-200',
  bajo: 'bg-amber-50 text-amber-700 border-amber-200',
  bien: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  sin: 'bg-slate-50 text-slate-400 border-slate-200',
};
const ETIQUETA = { agotado: 'Agotado', bajo: 'Por acabarse', bien: 'Disponible', sin: 'Sin control' };

function Tarjeta({ label, valor, tono = 'slate' }) {
  const tonos = {
    slate: 'text-slate-900', red: 'text-red-600', amber: 'text-amber-600', emerald: 'text-emerald-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-black tabular-nums mt-1 ${tonos[tono]}`}>{valor}</p>
    </div>
  );
}

export default function InventoryManager() {
  const { businessConfig } = useBusinessConfig();
  const businessId = businessConfig?._id;
  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('urgente');
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const [editando, setEditando] = useState(null);   // id cuyo campo exacto está abierto
  const [valorExacto, setValorExacto] = useState('');
  const [historial, setHistorial] = useState(null);   // { producto, movimientos }
  const [modo, setModo] = useState(businessConfig?.inventory?.mode || 'off');

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setCargando(true);
    try {
      const res = await api.get(`/products/inventory?businessId=${businessId}`);
      setDatos(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar el inventario');
    } finally {
      setCargando(false);
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  /* Se actualiza la fila en el sitio en vez de recargar todo: con el listado
     ordenado por urgencia, recargar haría saltar el producto de posición justo
     mientras se le está ajustando la cantidad. */
  const ajustar = useCallback(async (producto, cambios) => {
    if (ocupado) return;
    setOcupado(producto._id);
    try {
      const res = await api.patch(`/products/${producto._id}/stock`, { businessId, ...cambios });
      setDatos((d) => {
        if (!d) return d;
        const productos = d.productos.map((p) => (p._id === producto._id ? { ...p, ...res.data } : p));
        return { ...d, productos, resumen: recalcular(productos) };
      });
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo ajustar el inventario');
    } finally {
      setOcupado(null);
      setEditando(null);
    }
  }, [businessId, ocupado]);

  // El resumen se recalcula en el cliente para que los contadores de arriba
  // reaccionen al instante, sin volver a pedirlo al servidor.
  const recalcular = (productos) => {
    const conControl = productos.filter((p) => p.trackStock);
    return {
      total: productos.length,
      conControl: conControl.length,
      sinControl: productos.length - conControl.length,
      agotados: conControl.filter((p) => (p.stock ?? 0) <= 0).length,
      bajos: conControl.filter((p) => { const s = p.stock ?? 0; return s > 0 && s <= (p.lowStockAlert || 5); }).length,
      // A costo cuando existe; si no, cae al precio de venta
      valorInventario: conControl.reduce((s, p) => s + ((p.cost ?? p.price) || 0) * Math.max(0, p.stock ?? 0), 0),
      conCosto: conControl.filter((p) => p.cost != null).length,
    };
  };

  const verHistorial = useCallback(async (producto) => {
    setHistorial({ producto, movimientos: null });
    try {
      const res = await api.get(
        `/products/inventory/movements?businessId=${businessId}&productId=${producto._id}&limit=60`
      );
      setHistorial({ producto, movimientos: res.data.movimientos, tipos: res.data.tipos });
    } catch {
      setHistorial({ producto, movimientos: [], error: true });
    }
  }, [businessId]);

  const visibles = useMemo(() => {
    if (!datos) return [];
    const q = busqueda.trim().toLowerCase();
    return datos.productos.filter((p) => {
      if (q && !(p.name || '').toLowerCase().includes(q)) return false;
      const e = estadoDe(p);
      if (filtro === 'urgente') return e === 'agotado' || e === 'bajo';
      if (filtro === 'control') return p.trackStock;
      if (filtro === 'sin') return !p.trackStock;
      return true;
    });
  }, [datos, filtro, busqueda]);

  if (!businessId) return null;

  const r = datos?.resumen;

  const cambiarModo = async (nuevo) => {
    const antes = modo;
    setModo(nuevo);   // respuesta inmediata; se revierte si falla
    try {
      await api.patch('/products/inventory/mode', { businessId, mode: nuevo });
    } catch (err) {
      setModo(antes);
      alert(err.response?.data?.message || 'No se pudo cambiar el nivel');
    }
  };

  return (
    <div className="space-y-4">
      {/* Nivel de inventario */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Nivel de inventario</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {NIVELES.map((n) => (
            <button
              key={n.id}
              onClick={() => cambiarModo(n.id)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                modo === n.id ? 'border-transparent' : 'border-slate-200 hover:border-slate-300'
              }`}
              style={modo === n.id ? { backgroundColor: `${themeColor}14`, borderColor: themeColor } : undefined}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${modo === n.id ? '' : 'bg-slate-300'}`}
                  style={modo === n.id ? { backgroundColor: themeColor } : undefined} />
                <span className="text-[13px] font-bold text-slate-800">{n.label}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug mt-1">{n.desc}</p>
            </button>
          ))}
        </div>
        {modo === 'advanced' && (
          <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
            Con receta, vender un plato descuenta sus insumos y no un contador del plato.
            Los productos sin receta siguen controlándose por unidad, como una gaseosa.
          </p>
        )}
      </div>

      {modo === 'off' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-500">
          El inventario está desactivado. Puedes seguir ajustando cantidades abajo, pero no se
          descontará al vender ni recibirás avisos cuando algo se agote.
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta label="Agotados" valor={r?.agotados ?? '—'} tono="red" />
        <Tarjeta label="Por acabarse" valor={r?.bajos ?? '—'} tono="amber" />
        <Tarjeta label="Con control" valor={r ? `${r.conControl}/${r.total}` : '—'} />
        <Tarjeta label="Valor en bodega" valor={r ? money(r.valorInventario) : '—'} tono="emerald" />
      </div>

      {/* Si faltan costos, la valoración cae al precio de venta y NO es lo que
          el negocio tiene invertido. Decirlo evita que se tome por cierta. */}
      {r && r.conControl > 0 && (r.conCosto ?? 0) < r.conControl && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          El valor en bodega usa el precio de venta en {r.conControl - (r.conCosto ?? 0)} de {r.conControl} productos,
          porque aún no tienen costo registrado. Agrégalo para que la cifra refleje lo que de verdad invertiste.
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              filtro === f.id ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            style={filtro === f.id ? { backgroundColor: themeColor } : undefined}
          >
            {f.label}
            {f.id === 'urgente' && r && (r.agotados + r.bajos) > 0 && (
              <span className="ml-1.5 opacity-80">{r.agotados + r.bajos}</span>
            )}
          </button>
        ))}
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      {cargando && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-white rounded-2xl border border-slate-200 animate-pulse" />)}
        </div>
      )}

      {!cargando && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{error}</div>
      )}

      {!cargando && !error && visibles.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">
            {filtro === 'urgente'
              ? 'Nada por acabarse. Todo el inventario controlado está en orden.'
              : 'No hay productos que coincidan.'}
          </p>
        </div>
      )}

      {/* Listado */}
      {!cargando && !error && visibles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {visibles.map((p) => {
            const e = estadoDe(p);
            const trabajando = ocupado === p._id;
            return (
              <div key={p._id} className="flex items-center gap-3 p-3">
                {p.image
                  ? <img src={p.image} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-100" />
                  : <div className="w-11 h-11 rounded-xl bg-slate-100 shrink-0" />}

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${COLOR[e]}`}>{ETIQUETA[e]}</span>
                    <span className="text-[11px] text-slate-400">{money(p.price)}</span>
                    {p.active === false && <span className="text-[10px] text-slate-400">· oculto</span>}
                  </div>
                </div>

                {p.trackStock ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => ajustar(p, { delta: -1 })}
                      disabled={trabajando || (p.stock ?? 0) <= 0}
                      className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14" /></svg>
                    </button>

                    {editando === p._id ? (
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        value={valorExacto}
                        onChange={(ev) => setValorExacto(ev.target.value)}
                        onBlur={() => { const v = parseInt(valorExacto, 10); Number.isInteger(v) && v >= 0 ? ajustar(p, { stock: v }) : setEditando(null); }}
                        onKeyDown={(ev) => { if (ev.key === 'Enter') ev.currentTarget.blur(); if (ev.key === 'Escape') setEditando(null); }}
                        className="w-14 h-8 text-center text-[13px] font-bold rounded-lg border-2 border-slate-300 outline-none tabular-nums"
                      />
                    ) : (
                      <button
                        onClick={() => { setEditando(p._id); setValorExacto(String(p.stock ?? 0)); }}
                        title="Escribir la cantidad exacta"
                        className="w-14 h-8 rounded-lg text-[13px] font-black tabular-nums text-slate-800 hover:bg-slate-100 transition-colors"
                      >
                        {trabajando ? '·' : (p.stock ?? 0)}
                      </button>
                    )}

                    <button
                      onClick={() => ajustar(p, { delta: 1 })}
                      disabled={trabajando}
                      className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>

                    <button
                      onClick={() => verHistorial(p)}
                      title="Ver el historial de movimientos"
                      className="ml-1 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                      </svg>
                    </button>
                    <button
                      onClick={() => ajustar(p, { trackStock: false })}
                      disabled={trabajando}
                      title="Dejar de controlar el inventario de este producto"
                      className="px-2 h-8 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => ajustar(p, { trackStock: true })}
                    disabled={trabajando}
                    className="shrink-0 px-3 h-8 rounded-lg text-[11px] font-bold text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: themeColor }}
                  >
                    {trabajando ? '...' : 'Controlar'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400 leading-relaxed px-1">
        Al vender, la cantidad baja sola y nunca queda por debajo de cero. Al cancelar un pedido
        o quitarle productos, vuelve. Cada movimiento queda registrado con su fecha y su motivo,
        así que un conteo que no cuadre siempre se puede reconstruir.
      </p>

      {/* Historial de un producto */}
      {historial && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40" onClick={() => setHistorial(null)}>
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800 truncate">{historial.producto.name}</h3>
                <p className="text-[11px] text-slate-400">Historial de movimientos</p>
              </div>
              <button onClick={() => setHistorial(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {historial.movimientos === null && (
                <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />)}</div>
              )}

              {historial.movimientos?.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">
                  Todavía no hay movimientos. Aparecerán aquí en cuanto se venda, se ajuste o se cancele un pedido.
                </p>
              )}

              {historial.movimientos?.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {historial.movimientos.map((m) => (
                    <div key={m._id} className="flex items-center gap-3 py-2.5">
                      <span className={`text-[13px] font-black tabular-nums w-12 text-right shrink-0 ${
                        m.quantity > 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-700">
                          {historial.tipos?.[m.type] || m.type}
                          {m.orderNumber && <span className="font-normal text-slate-400"> · pedido #{m.orderNumber}</span>}
                        </p>
                        {m.note && <p className="text-[11px] text-slate-400 truncate">{m.note}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-semibold text-slate-500 tabular-nums">
                          {m.stockBefore} → {m.stockAfter}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(m.createdAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

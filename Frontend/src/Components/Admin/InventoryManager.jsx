import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useBusinessConfig } from '../../Context/BusinessContext';
import api from '../../services/api';
import SuppliesPanel from './SuppliesPanel';
import RecipeEditor from './RecipeEditor';
import { Capa } from '../ui';
import { pesos } from '../../utils/pedidos';

/**
 * Inventario.
 *
 * El stock vivía dentro del formulario de cada producto, así que para saber
 * qué se estaba agotando había que abrirlos uno por uno. Aquí se ve todo junto
 * y se ajusta sin entrar a editar el producto.
 */


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

/* Con variantes el inventario no está en el producto sino repartido entre las
   tallas o fragancias: lo que hay es la suma. El contador del producto se queda
   en cero y no significa nada. */
function unidades(p) {
  if (Array.isArray(p.variantes) && p.variantes.length) {
    return p.variantes.reduce((t, v) => t + (Number(v.stock) || 0), 0);
  }
  return p.stock ?? 0;
}

/** En qué estado está una línea: agotado, bajo, bien, o sin control. */
function estadoDe(p) {
  if (!p.trackStock) return 'sin';
  const s = unidades(p);
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
  const [pestana, setPestana] = useState('productos');
  const [recetaDe, setRecetaDe] = useState(null);
  /* Fila desplegada para editar costo y umbral de aviso. Estos campos existían
     en el modelo pero no había dónde escribirlos: el costo se guardaba y la
     valoración lo usaba, pero nadie podía introducirlo. */
  const [abierto, setAbierto] = useState(null);
  const [campos, setCampos] = useState({ cost: '', lowStockAlert: '' });

  /* Avisos en la pantalla en vez de alert(): la ventana del navegador asusta
     y en el celular a veces ni se ve. */
  const [aviso, setAviso] = useState('');
  const avisoTimer = useRef(null);
  const mostrarAviso = useCallback((texto) => {
    setAviso(texto);
    clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAviso(''), 6000);
  }, []);
  const mensajeDe = (err, porDefecto) => err?.response?.data?.message || (err?.response ? porDefecto : 'Sin conexión. Revisa el internet.');

  const datosRef = useRef(null);
  datosRef.current = datos;

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setCargando(true);
    try {
      const res = await api.get(`/products/inventory?businessId=${businessId}`);
      setDatos(res.data);
      if (res.data?.modo) setModo(res.data.modo);
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
  /* Qué producto tiene desplegadas sus presentaciones. Es aparte de
     `abierto` (costo y umbral), que ya usaba esa fila. */
  const [verVariantes, setVerVariantes] = useState(null);

  /* +/−: cada toque cuenta. Antes, mientras viajaba el primer toque los
     botones quedaban bloqueados y tocar "+" cinco veces seguidas sumaba dos o
     tres. Ahora el número cambia al instante y los toques se juntan y se
     mandan en uno solo medio segundo después. */
  const pendientes = useRef({});   // clave -> { producto, variante, delta, timer }

  const aplicarDelta = (d, id, delta, variante) => {
    if (!d) return d;
    const productos = d.productos.map((p) => {
      if (p._id !== id) return p;
      if (variante) {
        const clave = variante.join('|');
        return { ...p, variantes: p.variantes.map((v) => (v.valores.join('|') === clave ? { ...v, stock: Math.max(0, (Number(v.stock) || 0) + delta) } : v)) };
      }
      return { ...p, stock: Math.max(0, (p.stock ?? 0) + delta) };
    });
    return { ...d, productos, resumen: recalcular(productos) };
  };

  // Mezcla la respuesta del servidor y vuelve a aplicar los toques que aún no se han enviado.
  const aplicarServidor = (id, del) => {
    setDatos((d) => {
      if (!d) return d;
      const productos = d.productos.map((p) => (p._id === id ? { ...p, ...del } : p));
      let nuevo = { ...d, productos, resumen: recalcular(productos) };
      Object.values(pendientes.current).forEach((pen) => {
        if (pen.producto._id === id && pen.delta) nuevo = aplicarDelta(nuevo, id, pen.delta, pen.variante);
      });
      return nuevo;
    });
  };

  const enviarPendiente = useCallback(async (clave) => {
    const pen = pendientes.current[clave];
    if (!pen) return;
    delete pendientes.current[clave];
    clearTimeout(pen.timer);
    if (!pen.delta) return;
    try {
      const res = await api.patch(`/products/${pen.producto._id}/stock`, {
        businessId, delta: pen.delta, ...(pen.variante ? { variante: pen.variante } : {}),
      });
      aplicarServidor(pen.producto._id, res.data);
    } catch (err) {
      setDatos((d) => aplicarDelta(d, pen.producto._id, -pen.delta, pen.variante));
      mostrarAviso(mensajeDe(err, 'No se pudo guardar la cantidad de ' + pen.producto.name));
    }
  }, [businessId]);

  const sumar = (producto, delta, variante) => {
    const actual = datosRef.current?.productos.find((p) => p._id === producto._id);
    if (!actual) return;
    const antes = variante
      ? Number(actual.variantes?.find((v) => v.valores.join('|') === variante.join('|'))?.stock) || 0
      : (actual.stock ?? 0);
    // Lo que de verdad cambia (no baja de cero), para que el total enviado cuadre con lo que se ve
    const real = Math.max(0, antes + delta) - antes;
    if (!real) return;
    setDatos((d) => aplicarDelta(d, producto._id, real, variante));
    const clave = variante ? `${producto._id}:${variante.join('|')}` : producto._id;
    const pen = pendientes.current[clave] || { producto, variante, delta: 0 };
    clearTimeout(pen.timer);
    pen.delta += real;
    pen.timer = setTimeout(() => enviarPendiente(clave), 500);
    pendientes.current[clave] = pen;
  };

  // Al salir de la pantalla no se pierden los últimos toques
  useEffect(() => () => {
    Object.keys(pendientes.current).forEach((clave) => enviarPendiente(clave));
    clearTimeout(avisoTimer.current);
  }, [enviarPendiente]);

  const ocupadoRef = useRef(false);
  const ajustar = useCallback(async (producto, cambios) => {
    if (ocupadoRef.current) return false;   // un cambio a la vez, aunque se toque dos veces
    ocupadoRef.current = true;
    setOcupado(producto._id);
    // Una cantidad exacta reemplaza lo que hubiera: los toques pendientes ya no aplican
    if (cambios.stock !== undefined) {
      Object.keys(pendientes.current).forEach((clave) => {
        if (pendientes.current[clave].producto._id === producto._id) {
          clearTimeout(pendientes.current[clave].timer);
          delete pendientes.current[clave];
        }
      });
    }
    try {
      const res = await api.patch(`/products/${producto._id}/stock`, { businessId, ...cambios });
      aplicarServidor(producto._id, res.data);
      return true;
    } catch (err) {
      mostrarAviso(mensajeDe(err, 'No se pudo ajustar el inventario'));
      return false;
    } finally {
      ocupadoRef.current = false;
      setOcupado(null);
      setEditando(null);
    }
  }, [businessId]);

  // El resumen se recalcula en el cliente para que los contadores de arriba
  // reaccionen al instante, sin volver a pedirlo al servidor.
  const recalcular = (productos) => {
    const conControl = productos.filter((p) => p.trackStock);
    return {
      total: productos.length,
      conControl: conControl.length,
      sinControl: productos.length - conControl.length,
      agotados: conControl.filter((p) => unidades(p) <= 0).length,
      bajos: conControl.filter((p) => { const s = unidades(p); return s > 0 && s <= (p.lowStockAlert || 5); }).length,
      // A costo cuando existe; si no, cae al precio de venta
      valorInventario: conControl.reduce((s, p) => s + ((p.cost ?? p.price) || 0) * Math.max(0, unidades(p)), 0),
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
      mostrarAviso(mensajeDe(err, 'No se pudo cambiar el nivel'));
    }
  };

  return (
    <div className="space-y-4">
      {aviso && (
        <div role="alert" className="fixed left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 z-[130] w-[calc(100%-32px)] max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-lg flex items-start gap-3">
          <span className="flex-1">{aviso}</span>
          <button onClick={() => setAviso('')} className="text-red-500 font-bold" aria-label="Cerrar">✕</button>
        </div>
      )}
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

      {/* Pestañas: los insumos solo existen en el nivel avanzado */}
      {modo === 'advanced' && (
        <div className="flex gap-2">
          {[['productos', 'Productos'], ['insumos', 'Insumos']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPestana(id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                pestana === id ? 'text-white' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              style={pestana === id ? { backgroundColor: themeColor } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {modo === 'advanced' && pestana === 'insumos' ? (
        <SuppliesPanel businessId={businessId} themeColor={themeColor} onCambio={cargar} />
      ) : (
      <>
      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta label="Agotados" valor={r?.agotados ?? '—'} tono="red" />
        <Tarjeta label="Por acabarse" valor={r?.bajos ?? '—'} tono="amber" />
        <Tarjeta label="Con control" valor={r ? `${r.conControl}/${r.total}` : '—'} />
        <Tarjeta label="Valor en bodega" valor={r ? pesos(r.valorInventario) : '—'} tono="emerald" />
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
              <div key={p._id}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                {p.image
                  ? <img src={p.image} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-100" />
                  : <div className="w-11 h-11 rounded-xl bg-slate-100 shrink-0" />}

                <div className="flex-1 min-w-[140px]">
                  <p className="text-sm font-bold text-slate-800 break-words">{p.name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md border ${COLOR[e]}`}>{ETIQUETA[e]}</span>
                    <span className="text-xs text-slate-500">{pesos(p.price)}</span>
                    {p.active === false && <span className="text-xs text-slate-400">· no disponible</span>}
                  </div>
                </div>

                {p.trackStock && Array.isArray(p.variantes) && p.variantes.length > 0 ? (
                  <button
                    onClick={() => setVerVariantes(verVariantes === p._id ? null : p._id)}
                    title="Ver el stock de cada presentación"
                    className="shrink-0 flex items-center gap-2 px-3 h-10 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-[13px] font-black tabular-nums text-slate-800">
                      {unidades(p)}
                    </span>
                    <span className="text-xs text-slate-500">
                      en {p.variantes.length} {p.variantes.length === 1 ? 'presentación' : 'presentaciones'}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${verVariantes === p._id ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                ) : p.trackStock ? (
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <button
                      onClick={() => sumar(p, -1)}
                      disabled={(p.stock ?? 0) <= 0}
                      aria-label="Quitar una unidad"
                      className="w-10 h-10 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center justify-center"
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
                        className="w-16 h-10 text-center text-[15px] font-bold rounded-lg border-2 border-slate-300 outline-none tabular-nums"
                      />
                    ) : (
                      <button
                        onClick={() => { setEditando(p._id); setValorExacto(String(p.stock ?? 0)); }}
                        title="Escribir la cantidad exacta"
                        className="w-16 h-10 rounded-lg text-[15px] font-black tabular-nums text-slate-800 hover:bg-slate-100 transition-colors"
                      >
                        {p.stock ?? 0}
                      </button>
                    )}

                    <button
                      onClick={() => sumar(p, 1)}
                      aria-label="Agregar una unidad"
                      className="w-10 h-10 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>

                    {modo === 'advanced' && (
                      <button
                        onClick={() => setRecetaDe(p)}
                        title={p.recipe?.length
                          ? `Receta: ${p.recipe.length} insumo(s)`
                          : 'Definir la receta'}
                        className={`ml-1 px-2 h-10 rounded-lg text-xs font-bold transition-colors ${
                          p.recipe?.length ? 'text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                        style={p.recipe?.length ? { backgroundColor: themeColor } : undefined}
                      >
                        Receta{p.recipe?.length ? ` ${p.recipe.length}` : ''}
                      </button>
                    )}
                    <button
                      onClick={() => verHistorial(p)}
                      title="Ver el historial de movimientos"
                      aria-label="Historial"
                      className="ml-auto sm:ml-1 w-10 h-10 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                      </svg>
                    </button>
                    <button
                      onClick={() => ajustar(p, { trackStock: false })}
                      disabled={trabajando}
                      title="Dejar de controlar el inventario de este producto"
                      className="px-2 h-10 rounded-lg text-xs font-semibold whitespace-nowrap text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      No controlar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => ajustar(p, { trackStock: true })}
                    disabled={trabajando}
                    className="shrink-0 px-3 h-10 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: themeColor }}
                  >
                    {trabajando ? '...' : 'Controlar'}
                  </button>
                )}
              </div>

              {/* Cada presentación con su propio contador: es donde de verdad
                  está el inventario de una tienda. */}
              {verVariantes === p._id && Array.isArray(p.variantes) && (
                <div className="px-3 pb-2 space-y-1">
                  {p.variantes.map((v) => {
                    const clave = v.valores.join('|');
                    const editandoEsta = editando === `${p._id}:${clave}`;
                    return (
                      <div key={clave} className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-slate-700 break-words">
                            {v.valores.join(' · ')}
                            {v.activo === false && <span className="ml-1.5 text-2xs font-normal text-slate-400">· no está a la venta</span>}
                          </p>
                          {v.sku && <p className="text-2xs text-slate-400 break-words">{v.sku}</p>}
                        </div>

                        <button
                          onClick={() => sumar(p, -1, v.valores)}
                          disabled={(Number(v.stock) || 0) <= 0}
                          aria-label="Quitar una unidad"
                          className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center justify-center"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14" /></svg>
                        </button>

                        {editandoEsta ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            value={valorExacto}
                            onChange={(ev) => setValorExacto(ev.target.value)}
                            onBlur={() => {
                              const n = parseInt(valorExacto, 10);
                              Number.isInteger(n) && n >= 0
                                ? ajustar(p, { variante: v.valores, stock: n })
                                : setEditando(null);
                            }}
                            onKeyDown={(ev) => { if (ev.key === 'Enter') ev.currentTarget.blur(); if (ev.key === 'Escape') setEditando(null); }}
                            className="w-14 h-9 text-center text-sm font-bold rounded-lg border-2 border-slate-300 outline-none tabular-nums"
                          />
                        ) : (
                          <button
                            onClick={() => { setEditando(`${p._id}:${clave}`); setValorExacto(String(Number(v.stock) || 0)); }}
                            title="Escribir la cantidad exacta"
                            className="w-14 h-9 rounded-lg text-sm font-black tabular-nums text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                          >
                            {Number(v.stock) || 0}
                          </button>
                        )}

                        <button
                          onClick={() => sumar(p, 1, v.valores)}
                          aria-label="Agregar una unidad"
                          className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center justify-center"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Costo y umbral de aviso: se abren desde la propia fila para no
                  tener que entrar a editar el producto entero. */}
              {p.trackStock && (
                <div className="px-3 pb-2 -mt-1">
                  {abierto === p._id ? (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[120px]">
                        <label className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Costo por unidad
                        </label>
                        <input
                          type="text" inputMode="numeric"
                          value={campos.cost === '' ? '' : pesos(campos.cost).replace('$', '')}
                          onChange={(ev) => setCampos({ ...campos, cost: ev.target.value.replace(/\D/g, '') })}
                          placeholder="Lo que te cuesta"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px] outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Avisar cuando queden
                        </label>
                        <input
                          type="number" min="0" inputMode="numeric"
                          value={campos.lowStockAlert}
                          onChange={(ev) => setCampos({ ...campos, lowStockAlert: ev.target.value })}
                          placeholder="5"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px] outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          const ok = await ajustar(p, {
                            cost: campos.cost === '' ? null : campos.cost,
                            lowStockAlert: campos.lowStockAlert === '' ? 5 : campos.lowStockAlert,
                          });
                          if (ok) setAbierto(null);   // si falla, lo escrito sigue ahí
                        }}
                        disabled={trabajando}
                        className="px-4 h-10 rounded-lg text-white text-sm font-bold disabled:opacity-50"
                        style={{ backgroundColor: themeColor }}
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setAbierto(null)}
                        className="px-3 h-10 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAbierto(p._id);
                        setCampos({
                          cost: p.cost != null ? String(Math.round(p.cost)) : '',
                          lowStockAlert: p.lowStockAlert ?? '',
                        });
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline transition-colors text-left"
                    >
                      {p.cost != null
                        ? `Costo ${pesos(p.cost)} · avisa en ${p.lowStockAlert ?? 5}`
                        : 'Sin costo · toca para configurarlo'}
                    </button>
                  )}
                </div>
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
        {modo === 'advanced' && ' Los productos con receta descuentan sus insumos en vez de un contador propio.'}
      </p>
      </>
      )}

      {/* Editor de receta */}
      {recetaDe && (
        <RecipeEditor
          producto={recetaDe}
          businessId={businessId}
          themeColor={themeColor}
          onClose={() => setRecetaDe(null)}
          onGuardado={(actualizado) => {
            setDatos((d) => d && ({
              ...d,
              productos: d.productos.map((p) => (p._id === actualizado._id ? { ...p, recipe: actualizado.recipe } : p)),
            }));
          }}
        />
      )}

      {/* Historial de un producto */}
      {historial && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40" onClick={() => setHistorial(null)}>
          <Capa onCerrar={() => setHistorial(null)} />
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800 break-words">{historial.producto.name}</h3>
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
                        {m.note && <p className="text-[11px] text-slate-400 break-words">{m.note}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-semibold text-slate-500 tabular-nums">
                          {m.stockBefore ?? '—'} → {m.stockAfter ?? '—'}
                        </p>
                        <p className="text-2xs text-slate-400">
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

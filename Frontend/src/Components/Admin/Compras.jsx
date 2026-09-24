import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * Compras a proveedores: lo que entra, a qué costo y qué se les debe.
 *
 * Registrar una compra mete la mercancía al inventario (kardex: "Entrada"),
 * deja el último costo en cada insumo o producto —que es lo que usa
 * Rentabilidad— y deja por pagar lo que no se pagó de contado. "Qué comprar"
 * arma el pedido con lo que está en o bajo su mínimo.
 */

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-CO') : '');
const PESTANAS = [['compras', 'Compras'], ['nueva', 'Nueva compra'], ['reponer', 'Qué comprar'], ['pagar', 'Por pagar'], ['proveedores', 'Proveedores']];

export default function Compras() {
  const { businessId } = useBusinessConfig();
  const [pestana, setPestana] = useState('compras');
  const [proveedores, setProveedores] = useState([]);
  const [borrador, setBorrador] = useState(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  const cargarProveedores = useCallback(async () => {
    if (!businessId) return;
    try { setProveedores((await api.get(`/compras/proveedores?businessId=${businessId}`)).data.proveedores); } catch { /* la pestaña lo muestra */ }
  }, [businessId]);

  useEffect(() => { cargarProveedores(); }, [cargarProveedores]);

  /* Estables a propósito: las pestañas las usan como dependencia de sus
     consultas, y una función nueva en cada render haría que un error
     disparara otra consulta, y otro error, sin fin. */
  const avisar = useCallback((t) => { setAviso(t); setError(''); setTimeout(() => setAviso(''), 5000); }, []);
  const fallar = useCallback((e, t) => { setError(e.response?.data?.message || t); setAviso(''); }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap gap-2">
        {PESTANAS.map(([id, n]) => (
          <button key={id} onClick={() => setPestana(id)}
            className={`h-10 px-4 rounded-xl text-[13px] font-bold ${pestana === id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {n}
          </button>
        ))}
      </div>
      {aviso && <p className="text-[13px] font-semibold text-emerald-700">{aviso}</p>}
      {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}

      {pestana === 'compras' && <ListaCompras businessId={businessId} porPagar={false} avisar={avisar} fallar={fallar} />}
      {pestana === 'pagar' && <ListaCompras businessId={businessId} porPagar avisar={avisar} fallar={fallar} />}
      {pestana === 'nueva' && (
        <NuevaCompra
          businessId={businessId}
          proveedores={proveedores.filter((p) => p.activo)}
          inicial={borrador}
          onListo={(sinInventario) => {
            setBorrador(null);
            avisar(sinInventario?.length ? `Compra registrada. No se encontraron: ${sinInventario.join(', ')}` : 'Compra registrada: la mercancía ya está en el inventario');
            cargarProveedores();
            setPestana('compras');
          }}
          fallar={fallar}
        />
      )}
      {pestana === 'reponer' && (
        <Reponer businessId={businessId} onArmar={(b) => { setBorrador(b); setPestana('nueva'); }} fallar={fallar} />
      )}
      {pestana === 'proveedores' && (
        <Proveedores businessId={businessId} proveedores={proveedores} recargar={cargarProveedores} avisar={avisar} fallar={fallar} />
      )}
    </div>
  );
}

function ListaCompras({ businessId, porPagar, avisar, fallar }) {
  const [datos, setDatos] = useState(null);
  const [abierta, setAbierta] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDatos((await api.get(`/compras?businessId=${businessId}${porPagar ? '&porPagar=1' : ''}`)).data);
    } catch (e) { fallar(e, 'No se pudieron cargar las compras'); }
  }, [businessId, porPagar, fallar]);

  useEffect(() => { cargar(); }, [cargar]);

  const pagar = async (c) => {
    const monto = parseInt(String(window.prompt(`Pago a ${c.proveedorNombre} (se debe ${pesos(c.saldo)})`, String(c.saldo)) || '').replace(/\D/g, ''), 10);
    if (!monto) return;
    try {
      await api.post(`/compras/${c._id}/pago?businessId=${businessId}`, { monto, medio: 'transferencia' });
      avisar(`Pago de ${pesos(Math.min(monto, c.saldo))} registrado`);
      cargar();
    } catch (e) { fallar(e, 'No se pudo registrar el pago'); }
  };

  if (!datos) return <p className="text-[13px] text-slate-400">Cargando…</p>;
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate-600">
        {porPagar ? <>Se debe a proveedores: <b className="tabular-nums">{pesos(datos.porPagar)}</b></> : <>{datos.compras.length} compras · <b className="tabular-nums">{pesos(datos.total)}</b></>}
      </p>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {datos.compras.length === 0 && <p className="p-6 text-center text-[13px] text-slate-400">{porPagar ? 'No se le debe nada a nadie.' : 'Todavía no hay compras registradas.'}</p>}
        {datos.compras.map((c) => (
          <div key={c._id}>
            <div className="flex flex-wrap items-center gap-3 p-3.5">
              <button onClick={() => setAbierta(abierta === c._id ? null : c._id)} className="flex-1 min-w-[180px] text-left">
                <p className="text-[13.5px] font-bold text-slate-800">{c.proveedorNombre}{c.factura ? ` · Fact. ${c.factura}` : ''}</p>
                <p className="text-[11.5px] text-slate-400">{fecha(c.fecha)} · {c.lineas.length} líneas{c.usuario ? ` · ${c.usuario}` : ''}</p>
              </button>
              <div className="text-right">
                <p className="text-[14px] font-black tabular-nums">{pesos(c.total)}</p>
                {c.saldo > 0 && <p className="text-[11.5px] font-bold text-amber-700">Debe {pesos(c.saldo)}</p>}
              </div>
              {c.saldo > 0 && <button onClick={() => pagar(c)} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-bold">Pagar</button>}
            </div>
            {abierta === c._id && (
              <div className="px-4 pb-4 text-[12.5px] space-y-1">
                {c.lineas.map((l, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span className="text-slate-600">{l.cantidad} {l.unidad} · {l.nombre} <span className="text-slate-400">({l.tipo})</span></span>
                    <span className="tabular-nums">{pesos(l.costoUnitario)} c/u · <b>{pesos(l.subtotal)}</b></span>
                  </div>
                ))}
                {c.pagos.map((p, i) => (
                  <p key={`p${i}`} className="text-emerald-700">Pagado {pesos(p.monto)} ({p.medio}) el {fecha(p.fecha)}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NuevaCompra({ businessId, proveedores, inicial, onListo, fallar }) {
  const [proveedorId, setProveedorId] = useState(inicial?.proveedorId || proveedores[0]?._id || '');
  const [factura, setFactura] = useState('');
  const [lineas, setLineas] = useState(inicial?.lineas || []);
  const [pagado, setPagado] = useState('');
  const [q, setQ] = useState('');
  const [opciones, setOpciones] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!proveedorId && proveedores[0]) setProveedorId(proveedores[0]._id);
  }, [proveedores, proveedorId]);

  useEffect(() => {
    if (!q.trim()) { setOpciones([]); return; }
    const id = setTimeout(async () => {
      try { setOpciones((await api.get(`/compras/catalogo?businessId=${businessId}&q=${encodeURIComponent(q.trim())}`)).data.opciones); } catch { setOpciones([]); }
    }, 250);
    return () => clearTimeout(id);
  }, [q, businessId]);

  const total = lineas.reduce((t, l) => t + (Number(l.cantidad) || 0) * (Number(l.costoUnitario) || 0), 0);
  const cambiar = (i, campo, valor) => setLineas(lineas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await api.post(`/compras?businessId=${businessId}`, {
        proveedorId, factura, pagado: pagado === '' ? total : Number(pagado),
        lineas: lineas.map((l) => ({ ...l, cantidad: Number(l.cantidad), costoUnitario: Number(l.costoUnitario) })),
      });
      onListo(r.data.sinInventario);
    } catch (e) {
      fallar(e, 'No se pudo registrar la compra');
    } finally {
      setGuardando(false);
    }
  };

  if (!proveedores.length) {
    return <p className="p-6 text-center text-[13px] text-slate-500 bg-white rounded-2xl border border-slate-200">Primero agrega un proveedor en la pestaña Proveedores.</p>;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className="h-10 px-2 rounded-lg border border-slate-200 text-[13px]">
          {proveedores.map((p) => <option key={p._id} value={p._id}>{p.nombre}</option>)}
        </select>
        <input value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="N.º de factura (opcional)" className="h-10 px-3 rounded-lg border border-slate-200 text-[13px] flex-1 min-w-[160px]" />
      </div>

      <div className="relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Agregar insumo o producto…" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px]" />
        {opciones.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-64 overflow-y-auto">
            {opciones.map((o) => (
              <button key={`${o.tipo}${o.refId}`} onClick={() => {
                setLineas([...lineas, { tipo: o.tipo, refId: o.refId, nombre: o.nombre, unidad: o.unidad, cantidad: '1', costoUnitario: String(o.costo ?? '') }]);
                setQ('');
              }} className="w-full flex justify-between px-3 py-2 text-left text-[13px] hover:bg-slate-50">
                <span>{o.nombre} <span className="text-slate-400">({o.tipo}{o.unidad ? `, ${o.unidad}` : ''})</span></span>
                <span className="text-slate-400 tabular-nums">hay {o.stock}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {lineas.length === 0 && <p className="text-[12.5px] text-slate-400">Busca arriba lo que llegó.</p>}
        {lineas.map((l, i) => (
          <div key={`${l.refId}${i}`} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-50">
            <span className="flex-1 min-w-[140px] text-[13px] font-semibold">{l.nombre} <span className="text-slate-400 font-normal">{l.unidad}</span></span>
            <label className="text-[11.5px] text-slate-500">Cant.
              <input value={l.cantidad} onChange={(e) => cambiar(i, 'cantidad', e.target.value.replace(/[^\d.]/g, ''))} className="ml-1 w-20 h-9 px-2 rounded-lg border border-slate-200 text-[13px] tabular-nums" />
            </label>
            <label className="text-[11.5px] text-slate-500">Costo c/u
              <input value={l.costoUnitario} onChange={(e) => cambiar(i, 'costoUnitario', e.target.value.replace(/\D/g, ''))} className="ml-1 w-28 h-9 px-2 rounded-lg border border-slate-200 text-[13px] tabular-nums" />
            </label>
            <span className="w-28 text-right text-[13px] font-bold tabular-nums">{pesos((Number(l.cantidad) || 0) * (Number(l.costoUnitario) || 0))}</span>
            <button onClick={() => setLineas(lineas.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-600 px-1">×</button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <p className="text-[15px] font-black">Total {pesos(total)}</p>
        <label className="text-[12.5px] text-slate-600 ml-auto">Pagado ahora
          <input value={pagado} onChange={(e) => setPagado(e.target.value.replace(/\D/g, ''))} placeholder={String(total)} className="ml-2 w-32 h-10 px-2 rounded-lg border border-slate-200 text-[13px] tabular-nums" />
        </label>
        <button
          disabled={!lineas.length || guardando || lineas.some((l) => !(Number(l.cantidad) > 0) || l.costoUnitario === '')}
          onClick={guardar}
          className="h-10 px-5 rounded-lg bg-slate-900 text-white text-[13px] font-bold disabled:opacity-30"
        >
          {guardando ? 'Guardando…' : 'Registrar compra'}
        </button>
      </div>
      <p className="text-[11.5px] text-slate-400">Vacío en "Pagado ahora" = se pagó todo. Lo que falte queda en Por pagar.</p>
    </div>
  );
}

function Reponer({ businessId, onArmar, fallar }) {
  const [filas, setFilas] = useState(null);
  useEffect(() => {
    api.get(`/compras/reposicion?businessId=${businessId}`)
      .then((r) => setFilas(r.data.reposicion))
      .catch((e) => { fallar(e, 'No se pudo calcular qué comprar'); setFilas([]); });
  }, [businessId, fallar]);

  if (!filas) return <p className="text-[13px] text-slate-400">Calculando…</p>;
  if (!filas.length) return <p className="p-6 text-center text-[13px] text-slate-500 bg-white rounded-2xl border border-slate-200">Nada está en su mínimo. (El mínimo de cada insumo o producto se define en Inventario.)</p>;

  /* Agrupado por el proveedor de la última compra: es el pedido que se arma. */
  const grupos = filas.reduce((acc, f) => {
    const k = f.ultimoProveedorId || 'sin';
    (acc[k] = acc[k] || { proveedorId: f.ultimoProveedorId, nombre: f.ultimoProveedor || 'Sin proveedor anterior', filas: [] }).filas.push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.values(grupos).map((g) => (
        <div key={g.nombre} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between p-3.5 border-b border-slate-100">
            <p className="text-[13.5px] font-black text-slate-800">{g.nombre}</p>
            <button
              onClick={() => onArmar({
                proveedorId: g.proveedorId,
                lineas: g.filas.map((f) => ({ tipo: f.tipo, refId: f.refId, nombre: f.nombre, unidad: f.unidad, cantidad: String(f.sugerido), costoUnitario: String(f.ultimoCosto ?? '') })),
              })}
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-bold"
            >
              Armar compra
            </button>
          </div>
          {g.filas.map((f) => (
            <div key={`${f.tipo}${f.refId}`} className="flex justify-between gap-3 px-3.5 py-2 text-[12.5px] border-b border-slate-50 last:border-0">
              <span className="text-slate-700">{f.nombre} <span className="text-slate-400">· hay {f.stock} {f.unidad}, mínimo {f.minimo}</span></span>
              <span className="font-bold tabular-nums">Pedir {f.sugerido} {f.unidad}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Proveedores({ businessId, proveedores, recargar, avisar, fallar }) {
  const [nuevo, setNuevo] = useState({ nombre: '', nit: '', telefono: '', contacto: '' });

  const crear = async () => {
    try {
      await api.post(`/compras/proveedores?businessId=${businessId}`, nuevo);
      avisar(`${nuevo.nombre} agregado`);
      setNuevo({ nombre: '', nit: '', telefono: '', contacto: '' });
      recargar();
    } catch (e) { fallar(e, 'No se pudo crear el proveedor'); }
  };

  const alternar = async (p) => {
    try {
      await api.patch(`/compras/proveedores/${p._id}?businessId=${businessId}`, { activo: !p.activo });
      recargar();
    } catch (e) { fallar(e, 'No se pudo guardar'); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="divide-y divide-slate-100">
        {proveedores.length === 0 && <p className="p-6 text-center text-[13px] text-slate-400">Todavía no hay proveedores.</p>}
        {proveedores.map((p) => (
          <div key={p._id} className={`flex flex-wrap items-center gap-3 p-3.5 ${p.activo ? '' : 'opacity-50'}`}>
            <div className="flex-1 min-w-[180px]">
              <p className="text-[13.5px] font-bold text-slate-800">{p.nombre}</p>
              <p className="text-[11.5px] text-slate-400">{[p.nit && `NIT ${p.nit}`, p.telefono, p.contacto].filter(Boolean).join(' · ')}</p>
            </div>
            {p.saldo > 0 && <span className="text-[12.5px] font-bold text-amber-700 tabular-nums">Se le debe {pesos(p.saldo)}</span>}
            <button onClick={() => alternar(p)} className="h-9 px-3 rounded-lg text-[12px] font-semibold text-slate-500 hover:bg-slate-100">
              {p.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 p-3.5 bg-slate-50 border-t border-slate-100">
        {[['nombre', 'Nombre'], ['nit', 'NIT'], ['telefono', 'Teléfono'], ['contacto', 'Contacto']].map(([k, ph]) => (
          <input key={k} value={nuevo[k]} onChange={(e) => setNuevo({ ...nuevo, [k]: e.target.value })} placeholder={ph}
            className={`h-10 px-3 rounded-lg border border-slate-200 text-[13px] ${k === 'nombre' ? 'flex-1 min-w-[160px]' : 'w-36'}`} />
        ))}
        <button disabled={!nuevo.nombre.trim()} onClick={crear} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-bold disabled:opacity-30">
          Agregar
        </button>
      </div>
    </div>
  );
}

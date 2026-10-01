import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Circle, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../services/api';
import { MAP_ATTRIBUTION, MAP_TILE_URL } from '../../utils/mapTiles';

/**
 * Lo que la empresa de reparto necesita para trabajar con SUS clientes (por
 * fuera de MenuBy): sus envíos, sus clientes, su tarifa y zonas, su página
 * pública y el cuadre con sus domiciliarios. Todo contra
 * /api/delivery-partners/portal/* (ver Backend/services/envios.js).
 */
const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const hora = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const ETAPA = {
  buscando: ['Buscando domi', 'bg-amber-100 text-amber-800'], va_a_recoger: ['Va a recoger', 'bg-sky-100 text-sky-800'],
  recogiendo: ['Recogiendo', 'bg-sky-100 text-sky-800'], en_camino: ['En camino', 'bg-indigo-100 text-indigo-800'],
  llegando: ['Llegando', 'bg-indigo-100 text-indigo-800'], entregado: ['Entregado', 'bg-emerald-100 text-emerald-800'],
  no_entregado: ['No entregado', 'bg-rose-100 text-rose-700'], cancelado: ['Cancelado', 'bg-slate-200 text-slate-600'],
};
const Caja = ({ children, className = '' }) => <div className={`bg-white rounded-2xl border border-slate-200 p-5 ${className}`}>{children}</div>;
const Titulo = ({ children, sub }) => <div className="mb-4"><h2 className="text-lg font-bold text-slate-800">{children}</h2>{sub && <p className="text-sm text-slate-500">{sub}</p>}</div>;

function useError(handle401) {
  return useCallback((e, porDefecto) => { if (!handle401(e)) toast.error(e?.response?.data?.message || porDefecto); }, [handle401]);
}

/* ═══════════════ Envíos ═══════════════ */
export function EnviosView({ authCfg, handle401, drivers }) {
  const [filtro, setFiltro] = useState('activos');
  const [lista, setLista] = useState(null);
  const [asignando, setAsignando] = useState({});
  const error = useError(handle401);

  const cargar = useCallback(() => api.get('/delivery-partners/portal/envios', { ...authCfg, params: { estado: filtro === 'todos' ? undefined : filtro } })
    .then((r) => setLista(r.data)).catch((e) => error(e, 'No se pudieron cargar los envíos')), [authCfg, filtro, error]);
  useEffect(() => { cargar(); const t = setInterval(cargar, 10000); return () => clearInterval(t); }, [cargar]);

  const accion = async (ruta, cuerpo, ok) => {
    try { await api.post(`/delivery-partners/portal/envios/${ruta}`, cuerpo, authCfg); toast.success(ok); cargar(); } catch (e) { error(e, 'No se pudo'); }
  };
  const libres = (drivers || []).filter((d) => d.active !== false);

  return (
    <div>
      <Titulo sub="Los envíos que te piden tus clientes desde tu página.">Envíos</Titulo>
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit mb-4">
        {[['activos', 'En curso'], ['entregado', 'Entregados'], ['todos', 'Todos']].map(([id, t]) => (
          <button key={id} onClick={() => setFiltro(id)} className={`px-3.5 py-1.5 rounded-md text-xs font-semibold ${filtro === id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>
      {lista === null ? <div className="h-40 bg-white rounded-2xl animate-pulse" /> : lista.length === 0 ? (
        <Caja><p className="text-center text-slate-400 py-6">No hay envíos {filtro === 'activos' ? 'en curso' : ''}.</p></Caja>
      ) : (
        <div className="space-y-3">
          {lista.map((e) => {
            const [t, c] = ETAPA[e.etapa] || [e.etapa, 'bg-slate-100'];
            return (
              <Caja key={e.id} className="!p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">#{e.numero}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c}`}>{t}</span>
                  <span className="text-sm text-slate-500">{e.cliente?.nombre} · {hora(e.creadoAt)}</span>
                  <span className="ml-auto font-bold">{fmt(e.precio)}{e.zona ? <span className="text-xs text-slate-400 font-medium"> · {e.zona}</span> : ''}</span>
                </div>
                <p className="mt-2 text-sm"><span className="text-slate-400">De</span> {e.origen?.direccion} <span className="text-slate-400">→</span> {e.destino?.nombre}, {e.destino?.direccion}</p>
                {e.valorACobrar > 0 && <p className="text-xs text-amber-700 font-semibold mt-1">Cobrar {fmt(e.valorACobrar + (e.pagaEnvio === 'destinatario' ? e.precio : 0))} al entregar</p>}
                {e.domi && <p className="text-xs text-slate-500 mt-1">Lo lleva {e.domi.nombre}</p>}
                {e.estado === 'buscando' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select value={asignando[e.id] || ''} onChange={(ev) => setAsignando((a) => ({ ...a, [e.id]: ev.target.value }))} className="h-9 px-2 rounded-lg border border-slate-200 text-sm">
                      <option value="">Elegir domiciliario…</option>
                      {libres.map((d) => <option key={d._id} value={d._id}>{d.name}{d.isOnline ? ' · conectado' : ''}</option>)}
                    </select>
                    <button disabled={!asignando[e.id]} onClick={() => accion(`${e.id}/asignar`, { driverId: asignando[e.id] }, 'Asignado')} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-40">Asignar</button>
                    <button onClick={() => accion(`${e.id}/despachar`, {}, 'Ofrecido otra vez')} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-bold">Ofrecer al más cercano</button>
                  </div>
                )}
                {['buscando', 'asignado'].includes(e.estado) && !e.marcas?.recogido && (
                  <button onClick={() => window.confirm(`¿Cancelar el envío #${e.numero}?`) && accion(`${e.id}/cancelar`, {}, 'Cancelado')} className="mt-2 text-xs font-bold text-rose-600">Cancelar envío</button>
                )}
              </Caja>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ Clientes ═══════════════ */
export function ClientesView({ authCfg, handle401, slug }) {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const error = useError(handle401);
  const cargar = useCallback(() => api.get('/delivery-partners/portal/clientes', authCfg).then((r) => setLista(r.data)).catch((e) => error(e, 'No se pudieron cargar')), [authCfg, error]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (form.id) await api.put(`/delivery-partners/portal/clientes/${form.id}`, form, authCfg);
      else await api.post('/delivery-partners/portal/clientes', form, authCfg);
      toast.success(form.id ? 'Cliente actualizado' : `Cliente creado. Entra en menuby.tech/reparto/${slug || 'tu-empresa'}`);
      setForm(null);
      cargar();
    } catch (err) { error(err, 'No se pudo guardar'); } finally { setGuardando(false); }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <Titulo sub="Las tiendas o personas a las que les haces envíos. Cada una entra a tu página con su usuario.">Clientes</Titulo>
        <button onClick={() => setForm({ nombre: '', negocio: '', telefono: '', email: '', clave: '', direccion: '' })} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold shrink-0">+ Nuevo cliente</button>
      </div>
      {!slug && <p className="mb-3 text-sm text-amber-700 bg-amber-50 rounded-xl p-3">Primero crea tu página en "Mi página": es donde tus clientes entran a pedir.</p>}
      {form && (
        <Caja className="mb-4">
          <form onSubmit={guardar} className="grid sm:grid-cols-2 gap-3">
            <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre de contacto" className="h-10 px-3 rounded-lg border border-slate-200 text-sm" />
            <input value={form.negocio} onChange={(e) => setForm({ ...form, negocio: e.target.value })} placeholder="Negocio (opcional)" className="h-10 px-3 rounded-lg border border-slate-200 text-sm" />
            {!form.id && <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Celular (con esto entra)" className="h-10 px-3 rounded-lg border border-slate-200 text-sm" />}
            {!form.id && <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo (opcional)" className="h-10 px-3 rounded-lg border border-slate-200 text-sm" />}
            <input value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} placeholder={form.id ? 'Nueva clave (vacío = no cambia)' : 'Clave (mínimo 6)'} className="h-10 px-3 rounded-lg border border-slate-200 text-sm" />
            <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección de recogida habitual" className="h-10 px-3 rounded-lg border border-slate-200 text-sm" />
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setForm(null)} className="h-10 px-4 rounded-lg border border-slate-200 text-sm font-semibold">Cancelar</button>
              <button disabled={guardando} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </Caja>
      )}
      <Caja className="!p-0 overflow-hidden">
        {lista.length === 0 ? <p className="text-center text-slate-400 py-8">Aún no tienes clientes.</p> : lista.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-0">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">{(c.negocio || c.nombre)[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{c.negocio || c.nombre} {!c.activo && <span className="text-xs text-rose-600">· inactivo</span>}</p>
              <p className="text-xs text-slate-400 truncate">{c.nombre} · {c.telefono || c.email} · {c.totalEnvios} envíos</p>
            </div>
            <button onClick={() => setForm({ id: c.id, nombre: c.nombre, negocio: c.negocio, clave: '', direccion: c.direccion })} className="text-xs font-bold text-slate-600">Editar</button>
            <button onClick={async () => { try { await api.put(`/delivery-partners/portal/clientes/${c.id}`, { activo: !c.activo }, authCfg); cargar(); } catch (e) { error(e, 'No se pudo'); } }} className="text-xs font-bold text-slate-400">{c.activo ? 'Desactivar' : 'Activar'}</button>
          </div>
        ))}
      </Caja>
    </div>
  );
}

/* ═══════════════ Tarifas y zonas ═══════════════ */
function ClicMapa({ alClic }) { useMapEvents({ click: (e) => alClic({ lat: e.latlng.lat, lng: e.latlng.lng }) }); return null; }

export function TarifasView({ authCfg, handle401, config, alGuardar }) {
  const [t, setT] = useState(config?.tarifaEnvios || {});
  const [zonas, setZonas] = useState(config?.zonasEnvio || []);
  const [auto, setAuto] = useState(!!config?.autoDispatch);
  const [nueva, setNueva] = useState(null);
  const error = useError(handle401);
  useEffect(() => { setT(config?.tarifaEnvios || {}); setZonas(config?.zonasEnvio || []); setAuto(!!config?.autoDispatch); }, [config]);
  const centro = config?.ubicacion || zonas.find((z) => z.centro)?.centro || { lat: 4.711, lng: -74.0721 };

  const guardar = async () => {
    try { const r = await api.put('/delivery-partners/portal/config', { tarifaEnvios: t, zonasEnvio: zonas, autoDispatch: auto }, authCfg); alGuardar(r.data); toast.success('Tarifas guardadas'); } catch (e) { error(e, 'No se pudo guardar'); }
  };
  const campo = (k, titulo, u = '$') => (
    <label className="text-xs text-slate-500">{titulo}
      <div className="mt-1 flex items-center rounded-lg border border-slate-200">{u === '$' && <span className="pl-2 text-slate-400">$</span>}
        <input type="number" min="0" value={t[k] ?? 0} onChange={(e) => setT({ ...t, [k]: Number(e.target.value) })} className="w-full h-9 px-2 rounded-lg text-sm font-semibold outline-none" />
        {u !== '$' && <span className="pr-2 text-slate-400">{u}</span>}</div>
    </label>
  );

  return (
    <div className="space-y-4">
      <Titulo sub="Lo que ven tus clientes antes de pedir. Si el destino cae en una zona, se cobra la zona; si no, la tarifa por distancia.">Tarifas y zonas</Titulo>
      <Caja>
        <div className="grid sm:grid-cols-3 gap-3">
          {campo('base', 'Tarifa base')}{campo('porKm', 'Por km')}{campo('kmIncluidos', 'Km incluidos en la base', 'km')}
          {campo('minimo', 'Mínimo por envío')}{campo('maximoKm', 'Distancia máxima (0 = sin límite)', 'km')}{campo('redondeo', 'Redondear a')}
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-0.5 w-4 h-4" />
          <span><b>Reparto automático.</b> Cada envío se le ofrece solo a tu domiciliario conectado más cercano. Si lo apagas, los asignas tú.</span>
        </label>
      </Caja>
      <Caja>
        <p className="font-bold text-slate-800">Zonas con precio fijo</p>
        <p className="text-sm text-slate-500 mb-3">Toca el mapa para poner el centro de una zona nueva.</p>
        <div className="h-72 rounded-xl overflow-hidden border border-slate-200">
          <MapContainer center={[centro.lat, centro.lng]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
            <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
            <ClicMapa alClic={(c) => setNueva({ nombre: '', precio: 5000, tipo: 'circulo', centro: c, radioKm: 1, activa: true })} />
            {zonas.filter((z) => z.tipo === 'circulo').map((z, i) => <Circle key={i} center={[z.centro.lat, z.centro.lng]} radius={z.radioKm * 1000} pathOptions={{ color: z.activa ? '#0F9D58' : '#94a3b8', weight: 2 }} />)}
            {nueva && <Circle center={[nueva.centro.lat, nueva.centro.lng]} radius={nueva.radioKm * 1000} pathOptions={{ color: '#E11D2A', dashArray: '6 6' }} />}
          </MapContainer>
        </div>
        {nueva && (
          <div className="mt-3 flex flex-wrap items-end gap-2 p-3 rounded-xl bg-slate-50">
            <label className="text-xs text-slate-500">Nombre<input value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Centro" className="block mt-1 h-9 px-2 rounded-lg border border-slate-200 text-sm" /></label>
            <label className="text-xs text-slate-500">Precio<input type="number" value={nueva.precio} onChange={(e) => setNueva({ ...nueva, precio: Number(e.target.value) })} className="block mt-1 w-28 h-9 px-2 rounded-lg border border-slate-200 text-sm" /></label>
            <label className="text-xs text-slate-500">Radio: {nueva.radioKm} km<input type="range" min="0.3" max="10" step="0.1" value={nueva.radioKm} onChange={(e) => setNueva({ ...nueva, radioKm: Number(e.target.value) })} className="block mt-2 w-40" /></label>
            <button onClick={() => { if (!nueva.nombre.trim()) return toast.error('Ponle un nombre a la zona'); setZonas([...zonas, nueva]); setNueva(null); }} className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-bold">Agregar zona</button>
            <button onClick={() => setNueva(null)} className="h-9 px-3 text-xs font-bold text-slate-500">Cancelar</button>
          </div>
        )}
        <div className="mt-3 divide-y divide-slate-100">
          {zonas.map((z, i) => (
            <div key={i} className="flex items-center gap-3 py-2 text-sm">
              <span className={`w-2.5 h-2.5 rounded-full ${z.activa ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span className="font-semibold flex-1">{z.nombre}{z.radioKm ? <span className="text-slate-400 font-normal"> · {z.radioKm} km</span> : ''}</span>
              <span className="font-bold">{fmt(z.precio)}</span>
              <button onClick={() => setZonas(zonas.map((x, j) => (j === i ? { ...x, activa: !x.activa } : x)))} className="text-xs font-bold text-slate-500">{z.activa ? 'Pausar' : 'Activar'}</button>
              <button onClick={() => setZonas(zonas.filter((_, j) => j !== i))} className="text-xs font-bold text-rose-600">Quitar</button>
            </div>
          ))}
        </div>
      </Caja>
      <div className="flex justify-end"><button onClick={guardar} className="h-11 px-5 rounded-xl bg-slate-900 text-white text-sm font-bold">Guardar tarifas y zonas</button></div>
    </div>
  );
}

/* ═══════════════ Mi página ═══════════════ */
export function PaginaView({ authCfg, handle401, config, alGuardar }) {
  const [slug, setSlug] = useState(config?.slug || '');
  const [l, setL] = useState(config?.landing || {});
  const error = useError(handle401);
  useEffect(() => { setSlug(config?.slug || ''); setL(config?.landing || {}); }, [config]);
  const url = useMemo(() => `${window.location.origin}/reparto/${config?.slug || slug || 'tu-empresa'}`, [config?.slug, slug]);

  const guardar = async () => {
    try { const r = await api.put('/delivery-partners/portal/config', { slug, landing: l }, authCfg); alGuardar(r.data); toast.success('Página guardada'); } catch (e) { error(e, 'No se pudo guardar'); }
  };
  const input = (k, t, ph) => (
    <label className="text-xs text-slate-500">{t}<input value={l[k] || ''} onChange={(e) => setL({ ...l, [k]: e.target.value })} placeholder={ph} className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-800" /></label>
  );

  return (
    <div className="space-y-4">
      <Titulo sub="Tu página pública: la compartes con tus clientes y ahí entran a pedir sus domis.">Mi página</Titulo>
      <Caja>
        <label className="text-xs text-slate-500">Dirección de tu página
          <div className="mt-1 flex items-center rounded-lg border border-slate-200 overflow-hidden">
            <span className="pl-3 pr-1 text-sm text-slate-400 whitespace-nowrap">menuby.tech/reparto/</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="mi-empresa" className="w-full h-10 pr-3 text-sm font-semibold outline-none" />
          </div>
        </label>
        {config?.slug && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center">Ver mi página</a>
            <button onClick={() => { navigator.clipboard?.writeText(url); toast.success('Enlace copiado'); }} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-bold">Copiar enlace</button>
          </div>
        )}
      </Caja>
      <Caja className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-slate-500 sm:col-span-2">Qué hacen (lo primero que se lee)
          <textarea value={l.descripcion || ''} onChange={(e) => setL({ ...l, descripcion: e.target.value })} rows={2} maxLength={400} placeholder="Domicilios en Chía y Cajicá en menos de 40 minutos." className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800" />
        </label>
        {input('ciudad', 'Ciudad', 'Chía')}
        {input('horario', 'Horario', 'Lun a sáb · 8 a. m. a 9 p. m.')}
        {input('cobertura', 'A dónde llegan', 'Chía, Cajicá y norte de Bogotá')}
        {input('whatsapp', 'WhatsApp de contacto', '320 111 2233')}
        <label className="text-xs text-slate-500">Color de la marca
          <div className="mt-1 flex items-center gap-2"><input type="color" value={l.color || '#E11D2A'} onChange={(e) => setL({ ...l, color: e.target.value })} className="w-12 h-10 rounded-lg border border-slate-200" /><span className="text-sm text-slate-600">{l.color || '#E11D2A'}</span></div>
        </label>
      </Caja>
      <div className="flex justify-end"><button onClick={guardar} className="h-11 px-5 rounded-xl bg-slate-900 text-white text-sm font-bold">Guardar página</button></div>
    </div>
  );
}

/* ═══════════════ Cuadre ═══════════════ */
export function CuadreView({ authCfg, handle401 }) {
  const [lista, setLista] = useState(null);
  const error = useError(handle401);
  const cargar = useCallback(() => api.get('/delivery-partners/portal/cuadre', authCfg).then((r) => setLista(r.data)).catch((e) => error(e, 'No se pudo cargar')), [authCfg, error]);
  useEffect(() => { cargar(); }, [cargar]);
  const liquidar = async (c) => {
    const monto = c.debeEntregar ? `recibiste ${fmt(c.debeEntregar)}` : `le pagaste ${fmt(c.leDeben)}`;
    if (!window.confirm(`Cerrar el cuadre de ${c.nombre}: confirma que ${monto}.`)) return;
    try { await api.post('/delivery-partners/portal/liquidar', { driverId: c.driverId }, authCfg); toast.success('Cuadre cerrado'); cargar(); } catch (e) { error(e, 'No se pudo'); }
  };
  const con = (lista || []).filter((c) => c.entregas > 0);
  return (
    <div>
      <Titulo sub="Lo que cada domiciliario cobró en efectivo por tus envíos y lo que le toca.">Cuadre de efectivo</Titulo>
      <Caja className="!p-0 overflow-hidden">
        {lista === null ? <div className="h-24 animate-pulse" /> : con.length === 0 ? <p className="text-center text-slate-400 py-8">Todos están a paz y salvo.</p> : con.map((c) => (
          <div key={c.driverId} className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-0">
            <div className="flex-1 min-w-[180px]">
              <p className="font-semibold">{c.nombre}</p>
              <p className="text-xs text-slate-400">{c.entregas} envíos · cobró {fmt(c.efectivo)} · le toca {fmt(c.ganancias)}</p>
            </div>
            <p className={`font-extrabold ${c.debeEntregar ? 'text-amber-700' : 'text-sky-700'}`}>{c.debeEntregar ? `Te entrega ${fmt(c.debeEntregar)}` : `Le debes ${fmt(c.leDeben)}`}</p>
            <button onClick={() => liquidar(c)} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-bold">Liquidar</button>
          </div>
        ))}
      </Caja>
    </div>
  );
}

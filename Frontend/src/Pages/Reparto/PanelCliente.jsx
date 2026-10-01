import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SelectorPunto from '../../Components/Reparto/SelectorPunto';
import { guardarSesionReparto, pesos, repartoApi, sesionReparto } from '../../services/repartoApi';

/**
 * El panel del cliente de una empresa de reparto: pedir un domi y seguir sus
 * envíos. El precio se cotiza mientras escribe (lo calcula el servidor) y al
 * pedir se le da el enlace de seguimiento listo para mandárselo a quien recibe.
 */
const ETAPAS = {
  buscando: { texto: 'Buscando domiciliario', color: 'bg-amber-100 text-amber-800' },
  va_a_recoger: { texto: 'Va a recoger', color: 'bg-sky-100 text-sky-800' },
  recogiendo: { texto: 'Recogiendo', color: 'bg-sky-100 text-sky-800' },
  en_camino: { texto: 'En camino', color: 'bg-indigo-100 text-indigo-800' },
  llegando: { texto: 'Llegando', color: 'bg-indigo-100 text-indigo-800' },
  entregado: { texto: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
  no_entregado: { texto: 'No se entregó', color: 'bg-rose-100 text-rose-700' },
  cancelado: { texto: 'Cancelado', color: 'bg-slate-200 text-slate-600' },
};

const vacio = (c) => ({
  origen: { nombre: c?.negocio || c?.nombre || '', telefono: c?.telefono || '', direccion: c?.direccion || '', ubicacion: c?.ubicacion || null, notas: '' },
  destino: { nombre: '', telefono: '', direccion: '', ubicacion: null, notas: '' },
  descripcion: '', valorACobrar: '', pagaEnvio: 'cliente',
});

export default function PanelCliente() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const api = useMemo(() => repartoApi(slug), [slug]);
  const [yo, setYo] = useState(null);
  const [vista, setVista] = useState('pedir');
  const [form, setForm] = useState(null);
  const [cotizacion, setCotizacion] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState(null);
  const [envios, setEnvios] = useState([]);

  const salir = useCallback(() => { guardarSesionReparto(slug, null); navigate(`/reparto/${slug}`); }, [slug, navigate]);

  useEffect(() => {
    if (!sesionReparto(slug)?.token) { navigate(`/reparto/${slug}`); return; }
    api.get('/cliente/yo').then(({ data }) => { setYo(data); setForm(vacio(data.cliente)); document.title = `${data.empresa.nombre} · Pedir domi`; })
      .catch(() => salir());
  }, [api, slug, navigate, salir]);

  const cargarEnvios = useCallback(() => api.get('/cliente/envios').then(({ data }) => setEnvios(data)).catch(() => {}), [api]);
  useEffect(() => { cargarEnvios(); const t = setInterval(cargarEnvios, 10000); return () => clearInterval(t); }, [cargarEnvios]);

  // Cotizar mientras se llena
  const o = form?.origen?.ubicacion;
  const d = form?.destino?.ubicacion;
  useEffect(() => {
    if (!o || !d) { setCotizacion(null); return undefined; }
    const t = setTimeout(() => api.post('/cliente/cotizar', { origen: o, destino: d }).then(({ data }) => setCotizacion(data)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [api, o?.lat, o?.lng, d?.lat, d?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!yo || !form) return <div className="min-h-screen bg-slate-50 animate-pulse" />;
  const color = yo.empresa.color || '#E11D2A';
  const poner = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const pedir = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const { data } = await api.post('/cliente/envios', { ...form, valorACobrar: Number(String(form.valorACobrar).replace(/\D/g, '')) || 0 });
      setCreado(data);
      setForm(vacio(yo.cliente));
      cargarEnvios();
      // Recordar la recogida de siempre
      if (!yo.cliente.ubicacion && data.origen?.ubicacion) api.put('/cliente/yo', { direccion: data.origen.direccion, ubicacion: data.origen.ubicacion }).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo pedir el domi.');
    } finally {
      setEnviando(false);
    }
  };

  const listo = form.origen.ubicacion && form.destino.ubicacion && form.destino.nombre.trim() && form.destino.telefono.replace(/\D/g, '').length >= 7 && cotizacion?.cubre;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" data-testid="panel-cliente">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-[1100]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link to={`/reparto/${slug}`} className="flex items-center gap-2 min-w-0">
            {yo.empresa.logo ? <img src={yo.empresa.logo} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: color }}>🛵</span>}
            <span className="font-extrabold truncate">{yo.empresa.nombre}</span>
          </Link>
          <span className="ml-auto text-sm text-slate-500 truncate hidden sm:block">{yo.cliente.negocio || yo.cliente.nombre}</span>
          <button onClick={salir} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Salir</button>
        </div>
        <div className="max-w-3xl mx-auto px-4 flex gap-1">
          {[['pedir', 'Pedir domi'], ['envios', `Mis envíos${envios.filter((x) => !['entregado', 'cancelado', 'no_entregado'].includes(x.etapa)).length ? ` (${envios.filter((x) => !['entregado', 'cancelado', 'no_entregado'].includes(x.etapa)).length})` : ''}`]].map(([id, t]) => (
            <button key={id} onClick={() => setVista(id)} className={`px-4 py-3 text-sm font-bold border-b-2 ${vista === id ? 'text-slate-900' : 'border-transparent text-slate-400'}`} style={vista === id ? { borderColor: color } : undefined}>{t}</button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">
        {creado && (
          <Creado envio={creado} color={color} empresa={yo.empresa.nombre} alCerrar={() => { setCreado(null); setVista('envios'); }} />
        )}

        {vista === 'pedir' && !creado && (
          <form onSubmit={pedir} className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
              <SelectorPunto etiqueta="📦 Recoger en" valor={form.origen} alCambiar={(v) => poner('origen', v)} color="#0E0E10" prueba="origen" />
              <input value={form.origen.notas} onChange={(e) => poner('origen', { ...form.origen, notas: e.target.value })} placeholder="Indicaciones para recoger (opcional)" className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 text-sm" />
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
              <SelectorPunto etiqueta="🏠 Entregar en" valor={form.destino} alCambiar={(v) => poner('destino', v)} color={color} centroInicial={form.origen.ubicacion} prueba="destino" />
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={form.destino.nombre} onChange={(e) => poner('destino', { ...form.destino, nombre: e.target.value })} placeholder="¿Quién recibe?" className="h-11 px-4 rounded-xl border-2 border-slate-200 text-sm" data-testid="destino-nombre" />
                <input value={form.destino.telefono} onChange={(e) => poner('destino', { ...form.destino, telefono: e.target.value })} placeholder="Su celular" inputMode="tel" className="h-11 px-4 rounded-xl border-2 border-slate-200 text-sm" data-testid="destino-telefono" />
              </div>
              <input value={form.destino.notas} onChange={(e) => poner('destino', { ...form.destino, notas: e.target.value })} placeholder="Apto, torre, referencias (opcional)" className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 text-sm" />
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
              <input value={form.descripcion} onChange={(e) => poner('descripcion', e.target.value)} placeholder="¿Qué se lleva? (ej. caja pequeña)" className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 text-sm" data-testid="descripcion" />
              <label className="block text-sm">
                <span className="font-bold text-slate-700">¿El domi le cobra algo a quien recibe?</span>
                <div className="mt-1.5 flex items-center rounded-xl border-2 border-slate-200">
                  <span className="pl-4 text-slate-400">$</span>
                  <input value={form.valorACobrar} onChange={(e) => poner('valorACobrar', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="0 si ya está pagado" className="w-full h-11 px-2 rounded-xl text-sm outline-none" data-testid="valor-cobrar" />
                </div>
              </label>
              <div>
                <p className="text-sm font-bold text-slate-700">¿Quién paga el envío?</p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {[['cliente', 'Yo (a mi cuenta)'], ['destinatario', 'Quien recibe']].map(([v, t]) => (
                    <button type="button" key={v} onClick={() => poner('pagaEnvio', v)} className={`h-11 rounded-xl border-2 text-sm font-bold ${form.pagaEnvio === v ? 'text-white' : 'border-slate-200 text-slate-600'}`} style={form.pagaEnvio === v ? { background: color, borderColor: color } : undefined}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-50 pt-2 pb-4">
              {cotizacion && !cotizacion.cubre && <p className="mb-2 text-sm font-semibold text-rose-600">{cotizacion.motivo}</p>}
              {error && <p className="mb-2 text-sm font-semibold text-rose-600">{error}</p>}
              <button disabled={!listo || enviando} className="w-full h-14 rounded-2xl text-white text-base font-extrabold flex items-center justify-between px-5 disabled:opacity-40" style={{ background: color }} data-testid="pedir">
                <span>{enviando ? 'Pidiendo…' : 'Pedir domiciliario'}</span>
                <span>{cotizacion?.cubre ? `${pesos(cotizacion.precio)}${cotizacion.zona ? ` · ${cotizacion.zona}` : ''}` : '—'}</span>
              </button>
            </div>
          </form>
        )}

        {vista === 'envios' && !creado && (
          <div className="space-y-3">
            {envios.length === 0 && <p className="text-center text-slate-400 py-10">Aún no has pedido domis.</p>}
            {envios.map((e) => <Tarjeta key={e.id} envio={e} api={api} alCambiar={cargarEnvios} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function enlaceSeguimiento(e) {
  return `${window.location.origin}/reparto/seguimiento/${e.seguimiento}`;
}

function mensajeWhatsapp(e, empresa) {
  const cobro = e.valorACobrar + (e.pagaEnvio === 'destinatario' ? e.precio : 0);
  return `Hola ${e.destino.nombre}, tu envío va en camino con ${empresa}. Síguelo aquí: ${enlaceSeguimiento(e)}${cobro ? ` · Ten listos ${pesos(cobro)}` : ''}`;
}

function Creado({ envio, color, empresa, alCerrar }) {
  const wa = `https://wa.me/${envio.destino.telefono.replace(/\D/g, '').replace(/^3/, '573')}?text=${encodeURIComponent(mensajeWhatsapp(envio, empresa))}`;
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center space-y-4" data-testid="envio-creado">
      <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl text-white" style={{ background: color }}>✓</div>
      <div>
        <h2 className="text-xl font-extrabold">Envío #{envio.numero} pedido</h2>
        <p className="text-sm text-slate-500 mt-1">Estamos buscando al domiciliario más cercano.</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-4 text-left text-sm">
        <p className="font-bold">Mándale a {envio.destino.nombre} su enlace</p>
        <p className="text-slate-500">Ahí ve el mapa y el código que le dicta al domi al recibir.</p>
      </div>
      <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-12 rounded-xl bg-[#25D366] text-white font-bold">Enviar por WhatsApp</a>
      <button onClick={() => navigator.clipboard?.writeText(enlaceSeguimiento(envio))} className="w-full h-11 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-700">Copiar enlace</button>
      <button onClick={alCerrar} className="text-sm font-bold text-slate-500">Ver mis envíos</button>
    </div>
  );
}

function Tarjeta({ envio: e, api, alCambiar }) {
  const et = ETAPAS[e.etapa] || { texto: e.etapa, color: 'bg-slate-100 text-slate-600' };
  const puedeCancelar = ['buscando', 'va_a_recoger'].includes(e.etapa);
  const cancelar = async () => {
    if (!window.confirm(`¿Cancelar el envío #${e.numero}?`)) return;
    try { await api.post(`/cliente/envios/${e.id}/cancelar`); alCambiar(); } catch (err) { window.alert(err.response?.data?.message || 'No se pudo cancelar.'); }
  };
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100" data-testid={`envio-${e.numero}`}>
      <div className="flex items-center gap-2">
        <span className="font-extrabold">#{e.numero}</span>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${et.color}`}>{et.texto}</span>
        <span className="ml-auto font-bold">{pesos(e.precio)}</span>
      </div>
      <p className="mt-2 text-sm"><span className="text-slate-400">Para</span> <b>{e.destino.nombre}</b> · {e.destino.direccion}</p>
      {e.descripcion && <p className="text-sm text-slate-500">{e.descripcion}</p>}
      {e.motivoFalla && <p className="text-sm text-rose-600 mt-1">{e.motivoFalla}</p>}
      <div className="mt-3 flex gap-2">
        <a href={enlaceSeguimiento(e)} target="_blank" rel="noopener noreferrer" className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center">Ver seguimiento</a>
        {puedeCancelar && <button onClick={cancelar} className="h-9 px-3 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold">Cancelar</button>}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import {
  Clock, Copy, Check, ExternalLink, KeyRound, Plus, Trash2, Send, FileSpreadsheet, RefreshCw, Pencil, X, MapPin, Navigation, Loader2, Store,
} from 'lucide-react';
import api from '../../services/api';
import MapaPunto from '../Catalog/MapaPunto';
import { descargarExcel } from '../../utils/jornadasAsistencia';

/**
 * Asistencia del equipo, dentro de Equipo:
 *   - Sedes: nombre, ubicación (link de Google Maps o GPS) y el link de la
 *     pantalla con el QR.
 *   - Personas con su PIN y las sedes donde pueden marcar (aparte de las
 *     cuentas con rol del panel).
 *   - Telegram: una sola persona recibe todos los avisos.
 *   - Reporte en Excel por empleado y por sede.
 */

const hoyYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const inicioMesYmd = () => `${hoyYmd().slice(0, 8)}01`;
const input = 'w-full px-3 h-10 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';
const tarjeta = 'bg-white rounded-2xl border border-slate-200 p-4 lg:p-5';
const botonSec = 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-40';
const botonPri = 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl lg:rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-40';
const iconoBtn = 'h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700';

function Titulo({ icono: Icono, children, detalle }) {
  return (
    <div className="mb-3">
      <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2"><Icono className="w-4 h-4 text-slate-500" /> {children}</h3>
      {detalle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{detalle}</p>}
    </div>
  );
}

function gpsActual() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Este navegador no comparte la ubicación.')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? 'Bloqueaste la ubicación en este navegador.' : 'No se pudo obtener la ubicación.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export default function AsistenciaEquipo({ businessId, businessName }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/asistencia/config', { params: { businessId } });
      setDatos(data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo cargar la asistencia');
    }
  }, [businessId]);

  useEffect(() => { if (businessId) cargar(); }, [businessId, cargar]);

  const avisar = useCallback((t) => { setAviso(t); setTimeout(() => setAviso(''), 3000); }, []);

  if (error) return <p className="mt-8 text-sm text-red-600">{error}</p>;
  if (!datos) return <div className="mt-10 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}</div>;

  return (
    <section className="mt-10 space-y-4">
      <div>
        <h2 className="text-lg lg:text-xl font-bold text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> Asistencia</h2>
        <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
          Cada persona escanea el QR de su sede, comparte su ubicación, pone su PIN y confirma. Si ya marcó entrada, lo siguiente es la salida.
        </p>
      </div>
      {aviso && <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800">{aviso}</p>}

      <Sedes businessId={businessId} sedes={datos.sedes} onCambio={cargar} avisar={avisar} />
      <Personas businessId={businessId} personas={datos.personas} sedes={datos.sedes} onCambio={cargar} avisar={avisar} />
      <Telegram businessId={businessId} telegram={datos.telegram} onCambio={cargar} avisar={avisar} />
      <Reporte businessId={businessId} personas={datos.personas} sedes={datos.sedes} businessName={businessName} />
    </section>
  );
}

/* ─────────────── Ubicación de una sede: link de Maps o GPS ─────────────── */
function EditorUbicacion({ onGuardar, onCancelar, guardando, textoBoton = 'Guardar ubicación' }) {
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [gps, setGps] = useState(false);

  const conGps = async () => {
    setError('');
    setGps(true);
    try { await onGuardar({ ubicacion: await gpsActual() }); } catch (e) { setError(e.response?.data?.message || e.message); }
    setGps(false);
  };
  const conLink = async (e) => {
    e.preventDefault();
    setError('');
    try { await onGuardar({ mapsUrl: link.trim() }); } catch (err) { setError(err.response?.data?.message || err.message); }
  };

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2.5">
      <form onSubmit={conLink} className="flex gap-2">
        <input className={input} placeholder="Pega el link de Google Maps del local" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Link de Google Maps" />
        <button type="submit" disabled={!link.trim() || guardando} className={`${botonPri} shrink-0`}>{guardando && !gps ? <Loader2 className="w-4 h-4 animate-spin" /> : textoBoton}</button>
      </form>
      <p className="text-[11.5px] text-slate-500">En Google Maps abre el local → Compartir → Copiar vínculo.</p>
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-slate-200" /><span className="text-[11px] text-slate-400">o</span><span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={conGps} disabled={guardando} className={botonSec}>
          {gps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />} Estoy en el local: usar mi ubicación
        </button>
        {onCancelar && <button type="button" onClick={onCancelar} className={botonSec}>Cancelar</button>}
      </div>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

/* ───────────────────────────── Sedes ───────────────────────────── */
function Sedes({ businessId, sedes, onCambio, avisar }) {
  const [copiado, setCopiado] = useState(null);
  const [editandoUbic, setEditandoUbic] = useState(null);
  const [renombrando, setRenombrando] = useState(null); // { id, nombre }
  const [creando, setCreando] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [guardando, setGuardando] = useState(false);
  const link = (s) => `${window.location.origin}/asistencia/${s.clave}`;

  const copiar = async (s) => {
    try { await navigator.clipboard.writeText(link(s)); } catch { window.prompt('Copia este link:', link(s)); }
    setCopiado(s._id);
    setTimeout(() => setCopiado(null), 2000);
  };
  const guardarUbicacion = async (s, cambio) => {
    setGuardando(true);
    try {
      await api.put(`/asistencia/sedes/${s._id}`, { businessId, ...cambio });
      setEditandoUbic(null);
      avisar(`Ubicación de ${s.nombre} guardada.`);
      onCambio();
    } finally { setGuardando(false); }
  };
  const guardarNombre = async () => {
    if (!renombrando.nombre.trim()) return;
    await api.put(`/asistencia/sedes/${renombrando.id}`, { businessId, nombre: renombrando.nombre });
    setRenombrando(null);
    onCambio();
  };
  const linkNuevo = async (s) => {
    if (!window.confirm(`¿Cambiar el link de ${s.nombre}? El actual deja de funcionar y tendrás que abrir el nuevo en la pantalla del local.`)) return;
    await api.put(`/asistencia/sedes/${s._id}`, { businessId, nuevoLink: true });
    avisar(`Link de ${s.nombre} cambiado. Ábrelo en la pantalla del local.`);
    onCambio();
  };
  const borrar = async (s) => {
    if (!window.confirm(`¿Eliminar la sede ${s.nombre}? Las marcas que ya hay se quedan en los reportes.`)) return;
    try { await api.delete(`/asistencia/sedes/${s._id}`, { params: { businessId } }); onCambio(); } catch (err) { window.alert(err.response?.data?.message || 'No se pudo eliminar'); }
  };
  const crear = async (cambio) => {
    setGuardando(true);
    try {
      await api.post('/asistencia/sedes', { businessId, nombre: nombreNueva, ...cambio });
      avisar(`Sede ${nombreNueva} creada. Copia su link y ábrelo en la pantalla del local.`);
      setNombreNueva('');
      setCreando(false);
      onCambio();
    } finally { setGuardando(false); }
  };

  return (
    <div className={tarjeta}>
      <Titulo icono={Store} detalle="Cada sede tiene su link. Ábrelo en la tablet o el computador del local: muestra el QR, que cambia cada vez que alguien lo escanea.">Sedes</Titulo>
      <ul className="space-y-3">
        {sedes.map((s) => (
          <li key={s._id} className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-3">
              <div className="flex items-center gap-2">
                {renombrando?.id === s._id ? (
                  <>
                    <input className={input} value={renombrando.nombre} onChange={(e) => setRenombrando({ ...renombrando, nombre: e.target.value })} autoFocus maxLength={60} aria-label="Nombre de la sede" onKeyDown={(e) => e.key === 'Enter' && guardarNombre()} />
                    <button type="button" onClick={guardarNombre} className={`${botonPri} h-10 shrink-0`}>Guardar</button>
                    <button type="button" onClick={() => setRenombrando(null)} className={iconoBtn} aria-label="Cancelar"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <p className="flex-1 text-[15px] font-bold text-slate-900">{s.nombre}</p>
                    <button type="button" onClick={() => setRenombrando({ id: s._id, nombre: s.nombre })} className={iconoBtn} aria-label={`Cambiar nombre de ${s.nombre}`}><Pencil className="w-4 h-4" /></button>
                    {sedes.length > 1 && <button type="button" onClick={() => borrar(s)} className={`${iconoBtn} hover:bg-red-50 hover:text-red-500`} aria-label={`Eliminar ${s.nombre}`}><Trash2 className="w-4 h-4" /></button>}
                  </>
                )}
              </div>

              {s.ubicacion ? (
                <div className="mt-2.5 rounded-lg overflow-hidden border border-slate-200">
                  <MapaPunto lat={s.ubicacion.lat} lon={s.ubicacion.lng} alto={110} etiqueta="Cambiar ubicación de la sede" onAjustar={() => setEditandoUbic(s._id)} />
                </div>
              ) : editandoUbic !== s._id && (
                <button type="button" onClick={() => setEditandoUbic(s._id)} className="mt-2.5 w-full flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-[13px] font-semibold text-amber-800">
                  <MapPin className="w-4 h-4 shrink-0" /> Agrega la ubicación de esta sede
                </button>
              )}
              {editandoUbic === s._id && (
                <div className="mt-2.5">
                  <EditorUbicacion guardando={guardando} onGuardar={(c) => guardarUbicacion(s, c)} onCancelar={() => setEditandoUbic(null)} />
                </div>
              )}

              <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <p className="flex-1 min-w-0 text-xs text-slate-600 truncate" title={link(s)}>{link(s)}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => copiar(s)} className={botonSec}>{copiado === s._id ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar link</>}</button>
                <a href={link(s)} target="_blank" rel="noopener noreferrer" className={botonSec}><ExternalLink className="w-3.5 h-3.5" /> Abrir pantalla</a>
                {s.ubicacion && (
                  <>
                    <a href={`https://maps.google.com/?q=${s.ubicacion.lat},${s.ubicacion.lng}`} target="_blank" rel="noopener noreferrer" className={botonSec}><MapPin className="w-3.5 h-3.5" /> Ver en Maps</a>
                    <button type="button" onClick={() => setEditandoUbic(s._id)} className={botonSec}><Navigation className="w-3.5 h-3.5" /> Cambiar ubicación</button>
                  </>
                )}
                <button type="button" onClick={() => linkNuevo(s)} className={botonSec}><RefreshCw className="w-3.5 h-3.5" /> Link nuevo</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!creando ? (
        <button type="button" onClick={() => setCreando(true)} className={`${botonSec} mt-3 h-10 px-4`}><Plus className="w-4 h-4" /> Agregar sede</button>
      ) : (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2.5">
          <p className="text-sm font-bold text-slate-900">Nueva sede</p>
          <input className={input} placeholder="Nombre (ej: Sede La Montaña)" value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)} maxLength={60} aria-label="Nombre de la sede nueva" autoFocus />
          {nombreNueva.trim() ? (
            <EditorUbicacion guardando={guardando} textoBoton="Crear sede" onGuardar={crear} onCancelar={() => { setCreando(false); setNombreNueva(''); }} />
          ) : (
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-500">Escribe el nombre y luego su ubicación.</p>
              <button type="button" onClick={() => setCreando(false)} className={botonSec}>Cancelar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Personas ─────────────────────────── */
function SelectorSedes({ sedes, valor, onChange }) {
  if (sedes.length < 2) return null;
  const alternar = (id) => onChange(valor.includes(id) ? valor.filter((v) => v !== id) : [...valor, id]);
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-1.5">Puede marcar en</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange([])} className={`h-8 px-3 rounded-full text-xs font-semibold border ${valor.length === 0 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>Todas las sedes</button>
        {sedes.map((s) => (
          <button key={s._id} type="button" onClick={() => alternar(s._id)} aria-pressed={valor.includes(s._id)} className={`h-8 px-3 rounded-full text-xs font-semibold border ${valor.includes(s._id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{s.nombre}</button>
        ))}
      </div>
    </div>
  );
}

function Personas({ businessId, personas, sedes, onCambio, avisar }) {
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [sedesSel, setSedesSel] = useState([]);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null); // { id, nombre, pin, sedes }
  const nombreSede = (id) => sedes.find((s) => s._id === String(id))?.nombre;

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/asistencia/personas', { businessId, nombre, pin, sedes: sedesSel });
      avisar(`${nombre} ya puede marcar con el PIN ${pin}.`);
      setNombre(''); setPin(''); setSedesSel([]);
      onCambio();
    } catch (err) { setError(err.response?.data?.message || 'No se pudo crear'); }
  };
  const guardar = async () => {
    setError('');
    try {
      await api.put(`/asistencia/personas/${editando.id}`, { businessId, nombre: editando.nombre, sedes: editando.sedes, ...(editando.pin ? { pin: editando.pin } : {}) });
      setEditando(null);
      onCambio();
    } catch (err) { setError(err.response?.data?.message || 'No se pudo guardar'); }
  };
  const alternar = async (p) => { await api.put(`/asistencia/personas/${p._id}`, { businessId, activo: !p.activo }); onCambio(); };
  const borrar = async (p) => {
    if (!window.confirm(`¿Eliminar a ${p.nombre}? Sus marcas se quedan en los reportes.`)) return;
    await api.delete(`/asistencia/personas/${p._id}`, { params: { businessId } });
    onCambio();
  };

  return (
    <div className={tarjeta}>
      <Titulo icono={KeyRound} detalle="Cada persona tiene su PIN de 4 números (no se puede repetir). Son aparte de las cuentas con rol del panel.">Personas y PIN</Titulo>
      <form onSubmit={crear} className="space-y-2.5 rounded-xl bg-slate-50 border border-slate-200 p-3">
        <div className="grid grid-cols-[1fr_92px] gap-2">
          <input className={input} placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} aria-label="Nombre" />
          <input className={`${input} tabular-nums tracking-[0.3em] text-center`} placeholder="PIN" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="PIN de 4 números" />
        </div>
        <SelectorSedes sedes={sedes} valor={sedesSel} onChange={setSedesSel} />
        <button type="submit" disabled={!nombre.trim() || pin.length !== 4} className={botonPri}><Plus className="w-4 h-4" /> Agregar persona</button>
        {error && !editando && <p className="text-xs font-semibold text-red-600">{error}</p>}
      </form>

      <ul className="mt-3 divide-y divide-slate-100">
        {personas.length === 0 && <li className="py-3 text-sm text-slate-400">Aún no hay personas. Agrega la primera arriba.</li>}
        {personas.map((p) => (
          <li key={p._id} className="py-3">
            {editando?.id === p._id ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <input className={input} value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} aria-label="Nombre" />
                  <input className={`${input} text-center tabular-nums`} placeholder="PIN nuevo" inputMode="numeric" autoComplete="off" value={editando.pin} onChange={(e) => setEditando({ ...editando, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} aria-label="PIN nuevo (opcional)" />
                </div>
                <SelectorSedes sedes={sedes} valor={editando.sedes} onChange={(v) => setEditando({ ...editando, sedes: v })} />
                <div className="flex gap-2">
                  <button type="button" onClick={guardar} disabled={!editando.nombre.trim() || (editando.pin && editando.pin.length !== 4)} className={botonPri}>Guardar</button>
                  <button type="button" onClick={() => { setEditando(null); setError(''); }} className={`${botonSec} h-10`}>Cancelar</button>
                </div>
                {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${p.activo ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>{p.nombre.charAt(0).toUpperCase()}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${p.activo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{p.nombre}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {p.sedes?.length ? p.sedes.map(nombreSede).filter(Boolean).join(' · ') : 'Todas las sedes'}
                    {!p.activo && ' · desactivada'}
                  </p>
                </div>
                <button type="button" onClick={() => alternar(p)} className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 h-8">{p.activo ? 'Desactivar' : 'Activar'}</button>
                <button type="button" onClick={() => setEditando({ id: p._id, nombre: p.nombre, pin: '', sedes: (p.sedes || []).map(String) })} className={iconoBtn} aria-label={`Editar a ${p.nombre}`}><Pencil className="w-4 h-4" /></button>
                <button type="button" onClick={() => borrar(p)} className={`${iconoBtn} hover:bg-red-50 hover:text-red-500`} aria-label={`Eliminar a ${p.nombre}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────── Telegram ─────────────────────────── */
function Telegram({ businessId, telegram, onCambio, avisar }) {
  const [enlace, setEnlace] = useState(null);
  const [comprobando, setComprobando] = useState(false);
  const [error, setError] = useState('');

  const vincular = async () => {
    setError('');
    try {
      const { data } = await api.post('/asistencia/telegram/vincular', { businessId });
      setEnlace(data.enlace);
      window.open(data.enlace, '_blank', 'noopener');
    } catch (err) { setError(err.response?.data?.message || 'No se pudo generar el enlace'); }
  };
  const comprobar = useCallback(async (solo = false) => {
    if (!solo) { setComprobando(true); setError(''); }
    try {
      await api.post('/asistencia/telegram/comprobar', { businessId });
      setEnlace(null);
      avisar('Telegram conectado. Te llegó un mensaje de prueba.');
      onCambio();
      return true;
    } catch (err) {
      if (!solo) setError(err.response?.data?.message || 'No se pudo comprobar');
      return false;
    } finally {
      if (!solo) setComprobando(false);
    }
  }, [businessId, onCambio, avisar]);

  /* Mientras el enlace está abierto, se comprueba solo cada 3 s (hasta 5 min):
     en Fraise tocaron "Iniciar" en Telegram pero nunca volvieron a tocar
     "comprobar", y el chat quedó sin conectar. */
  useEffect(() => {
    if (!enlace) return undefined;
    let vivo = true;
    let intentos = 0;
    const t = setInterval(async () => {
      intentos += 1;
      if (!vivo || intentos > 100) { clearInterval(t); return; }
      if (await comprobar(true)) clearInterval(t);
    }, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, [enlace, comprobar]);
  const quitar = async () => {
    if (!window.confirm('¿Dejar de enviar los avisos por Telegram?')) return;
    await api.delete('/asistencia/telegram', { params: { businessId } });
    onCambio();
  };

  return (
    <div className={tarjeta}>
      <Titulo icono={Send} detalle="Una sola persona recibe todos los avisos: nombre, sede y hora apenas alguien marca.">Aviso por Telegram</Titulo>
      {!telegram.disponible ? (
        <p className="text-sm text-amber-700">El bot de Telegram todavía no está configurado en el servidor.</p>
      ) : (
        <>
          {telegram.chat && !enlace && (
            <div className="flex items-center gap-3 rounded-xl bg-sky-50 border border-sky-100 px-3 py-2.5 mb-3">
              <span className="w-9 h-9 rounded-full bg-sky-500 text-white flex items-center justify-center"><Send className="w-4 h-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{telegram.chat.nombre || 'Chat conectado'}</p>
                <p className="text-xs text-slate-500">Recibe todos los avisos</p>
              </div>
              <button type="button" onClick={quitar} className="text-xs font-semibold text-slate-500 hover:text-red-600 px-2 h-8">Quitar</button>
            </div>
          )}
          {!enlace ? (
            <button type="button" onClick={vincular} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl lg:rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold">
              <Send className="w-4 h-4" /> {telegram.chat ? 'Cambiar la persona que recibe' : 'Conectar Telegram'}
            </button>
          ) : (
            <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-sm text-sky-900 space-y-1">
              <p>1. En Telegram toca <b>Iniciar</b> (se abrió en otra pestaña; si no, <a href={enlace} target="_blank" rel="noopener noreferrer" className="underline font-semibold">ábrelo aquí</a>).</p>
              <p className="flex items-center gap-1.5">2. Vuelve aquí: lo detectamos solo <Loader2 className="w-3.5 h-3.5 animate-spin" /></p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => comprobar()} disabled={comprobando} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-sky-500 text-white text-sm font-semibold disabled:opacity-60">
                  {comprobando ? <><Loader2 className="w-4 h-4 animate-spin" /> Comprobando…</> : 'Comprobar ahora'}
                </button>
                <button type="button" onClick={() => setEnlace(null)} className={botonSec}>Cancelar</button>
              </div>
            </div>
          )}
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── Reporte ─────────────────────────── */
function Reporte({ businessId, personas, sedes, businessName }) {
  const [desde, setDesde] = useState(inicioMesYmd());
  const [hasta, setHasta] = useState(hoyYmd());
  const [personaId, setPersonaId] = useState('');
  const [sedeId, setSedeId] = useState('');
  const [estado, setEstado] = useState('');

  const descargar = async () => {
    setEstado('cargando');
    try {
      const { data } = await api.get('/asistencia/marcas', { params: { businessId, desde, hasta, ...(personaId ? { personaId } : {}), ...(sedeId ? { sedeId } : {}) } });
      if (!data.marcas.length) { setEstado('vacio'); return; }
      await descargarExcel({
        marcas: data.marcas,
        personas: data.personas,
        sedes: data.sedes,
        desde,
        hasta,
        negocio: businessName,
        sedeFiltro: sedes.find((s) => s._id === sedeId)?.nombre || '',
      });
      setEstado('');
    } catch {
      setEstado('error');
    }
  };

  return (
    <div className={tarjeta}>
      <Titulo icono={FileSpreadsheet} detalle="Una hoja de resumen y una por empleado: entradas, salidas, sede, distancia a la sede y horas trabajadas.">Reporte en Excel</Titulo>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-slate-500">Desde<input type="date" className={`${input} mt-1`} value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-500">Hasta<input type="date" className={`${input} mt-1`} value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-500">Empleado
          <select className={`${input} mt-1`} value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
            <option value="">Todos</option>
            {personas.map((p) => <option key={p._id} value={p._id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">Sede
          <select className={`${input} mt-1`} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">Todas</option>
            {sedes.map((s) => <option key={s._id} value={s._id}>{s.nombre}</option>)}
          </select>
        </label>
      </div>
      <button type="button" onClick={descargar} disabled={estado === 'cargando'} className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-xl lg:rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60">
        {estado === 'cargando' ? <><Loader2 className="w-4 h-4 animate-spin" /> Armando el Excel…</> : <><FileSpreadsheet className="w-4 h-4" /> Descargar Excel</>}
      </button>
      {estado === 'vacio' && <p className="mt-2 text-xs text-slate-500">No hay marcas con esos filtros.</p>}
      {estado === 'error' && <p className="mt-2 text-xs text-red-600">No se pudo generar el reporte.</p>}
    </div>
  );
}

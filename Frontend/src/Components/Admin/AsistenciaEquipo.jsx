import { useCallback, useEffect, useState } from 'react';
import { Clock, Copy, Check, ExternalLink, KeyRound, Plus, Trash2, Send, FileSpreadsheet, RefreshCw, Pencil, X } from 'lucide-react';
import api from '../../services/api';
import { descargarExcel } from '../../utils/jornadasAsistencia';

/**
 * Asistencia del equipo, en la sección Equipo:
 *   - Personas con su PIN (aparte de las cuentas con rol del panel).
 *   - El link de la pantalla con el QR, uno por sede.
 *   - El aviso por Telegram de cada entrada y salida.
 *   - El reporte en Excel por empleado.
 */

const hoyYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const inicioMesYmd = () => `${hoyYmd().slice(0, 8)}01`;
const input = 'w-full px-3 py-2.5 lg:py-2 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';
const tarjeta = 'bg-white rounded-2xl border border-slate-200 p-4 lg:p-5';
const botonSec = 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold';

function Titulo({ children, detalle }) {
  return (
    <div className="mb-3">
      <h3 className="text-[15px] font-bold text-slate-900">{children}</h3>
      {detalle && <p className="text-xs text-slate-500 mt-0.5">{detalle}</p>}
    </div>
  );
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

  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(''), 2500); };

  if (error) return <p className="mt-8 text-sm text-red-600">{error}</p>;
  if (!datos) return <div className="mt-8 h-24 rounded-2xl bg-slate-100 animate-pulse" />;

  return (
    <section className="mt-10 space-y-4">
      <div>
        <h2 className="text-lg lg:text-xl font-bold text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> Asistencia</h2>
        <p className="text-sm text-slate-500 mt-0.5">Cada persona escanea el QR del local, comparte su ubicación y pone su PIN. Si ya marcó entrada, la siguiente marca es la salida.</p>
      </div>
      {aviso && <p role="status" className="text-sm font-semibold text-emerald-700">{aviso}</p>}

      <Personas businessId={businessId} personas={datos.personas} onCambio={cargar} avisar={avisar} />
      <Sedes businessId={businessId} sedes={datos.sedes} onCambio={cargar} avisar={avisar} />
      <Telegram businessId={businessId} telegram={datos.telegram} onCambio={cargar} avisar={avisar} />
      <Reporte businessId={businessId} personas={datos.personas} businessName={businessName} />
    </section>
  );
}

function Personas({ businessId, personas, onCambio, avisar }) {
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null); // { id, nombre, pin }

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/asistencia/personas', { businessId, nombre, pin });
      avisar(`${nombre} ya puede marcar con el PIN ${pin}`);
      setNombre(''); setPin('');
      onCambio();
    } catch (err) { setError(err.response?.data?.message || 'No se pudo crear'); }
  };

  const guardar = async () => {
    setError('');
    const cambios = { businessId, nombre: editando.nombre };
    if (editando.pin) cambios.pin = editando.pin;
    try {
      await api.put(`/asistencia/personas/${editando.id}`, cambios);
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
      <Titulo detalle="Cada persona tiene su propio PIN de 4 números. No puede repetirse.">Personas y PIN</Titulo>
      <form onSubmit={crear} className="grid grid-cols-[1fr_96px_auto] gap-2">
        <input className={input} placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} aria-label="Nombre" />
        <input className={`${input} tabular-nums tracking-widest text-center`} placeholder="PIN" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="PIN de 4 números" />
        <button type="submit" disabled={!nombre.trim() || pin.length !== 4} className="inline-flex items-center gap-1.5 px-4 rounded-xl lg:rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </form>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

      <ul className="mt-3 divide-y divide-slate-100">
        {personas.length === 0 && <li className="py-3 text-sm text-slate-400">Aún no hay personas. Agrega la primera arriba.</li>}
        {personas.map((p) => (
          <li key={p._id} className="py-2.5 flex items-center gap-2">
            {editando?.id === p._id ? (
              <>
                <input className={`${input} flex-1`} value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} aria-label="Nombre" />
                <input className={`${input} w-24 text-center tabular-nums`} placeholder="PIN nuevo" inputMode="numeric" value={editando.pin} onChange={(e) => setEditando({ ...editando, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} aria-label="PIN nuevo (opcional)" />
                <button type="button" onClick={guardar} disabled={editando.pin && editando.pin.length !== 4} className="h-9 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40">Guardar</button>
                <button type="button" onClick={() => setEditando(null)} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" aria-label="Cancelar"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <KeyRound className={`w-4 h-4 shrink-0 ${p.activo ? 'text-blue-500' : 'text-slate-300'}`} />
                <span className={`flex-1 text-sm font-medium ${p.activo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{p.nombre}</span>
                <button type="button" onClick={() => alternar(p)} className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2">{p.activo ? 'Desactivar' : 'Activar'}</button>
                <button type="button" onClick={() => setEditando({ id: p._id, nombre: p.nombre, pin: '' })} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" aria-label={`Editar a ${p.nombre}`}><Pencil className="w-4 h-4" /></button>
                <button type="button" onClick={() => borrar(p)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label={`Eliminar a ${p.nombre}`}><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sedes({ businessId, sedes, onCambio, avisar }) {
  const [nueva, setNueva] = useState('');
  const [copiado, setCopiado] = useState(null);
  const link = (s) => `${window.location.origin}/asistencia/${s.clave}`;

  const copiar = async (s) => {
    try { await navigator.clipboard.writeText(link(s)); } catch { window.prompt('Copia este link:', link(s)); }
    setCopiado(s._id);
    setTimeout(() => setCopiado(null), 2000);
  };
  const crear = async (e) => {
    e.preventDefault();
    await api.post('/asistencia/sedes', { businessId, nombre: nueva });
    setNueva('');
    onCambio();
  };
  const renombrar = async (s) => {
    const nombre = window.prompt('Nombre de la sede', s.nombre);
    if (!nombre?.trim()) return;
    await api.put(`/asistencia/sedes/${s._id}`, { businessId, nombre });
    onCambio();
  };
  const linkNuevo = async (s) => {
    if (!window.confirm(`¿Cambiar el link de ${s.nombre}? El link actual deja de funcionar y tendrás que abrir el nuevo en la pantalla del local.`)) return;
    await api.put(`/asistencia/sedes/${s._id}`, { businessId, nuevoLink: true });
    avisar('Link cambiado. Ábrelo en la pantalla del local.');
    onCambio();
  };
  const borrar = async (s) => {
    if (!window.confirm(`¿Eliminar la sede ${s.nombre}?`)) return;
    try { await api.delete(`/asistencia/sedes/${s._id}`, { params: { businessId } }); onCambio(); } catch (err) { window.alert(err.response?.data?.message || 'No se pudo eliminar'); }
  };

  return (
    <div className={tarjeta}>
      <Titulo detalle="Abre el link en la tablet o el computador del local. El QR cambia cada vez que alguien lo escanea.">Pantalla del QR</Titulo>
      <ul className="space-y-2.5">
        {sedes.map((s) => (
          <li key={s._id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm font-bold text-slate-900">{s.nombre}</p>
              <button type="button" onClick={() => renombrar(s)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" aria-label={`Cambiar nombre de ${s.nombre}`}><Pencil className="w-4 h-4" /></button>
              {sedes.length > 1 && <button type="button" onClick={() => borrar(s)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label={`Eliminar ${s.nombre}`}><Trash2 className="w-4 h-4" /></button>}
            </div>
            <p className="mt-1 text-xs text-slate-500 break-all">{link(s)}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => copiar(s)} className={botonSec}>{copiado === s._id ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar link</>}</button>
              <a href={link(s)} target="_blank" rel="noopener noreferrer" className={botonSec}><ExternalLink className="w-3.5 h-3.5" /> Abrir pantalla</a>
              <button type="button" onClick={() => linkNuevo(s)} className={botonSec}><RefreshCw className="w-3.5 h-3.5" /> Link nuevo</button>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={crear} className="mt-3 flex gap-2">
        <input className={input} placeholder="Otra sede (ej: Sede La Montaña)" value={nueva} onChange={(e) => setNueva(e.target.value)} maxLength={60} aria-label="Nombre de la sede nueva" />
        <button type="submit" disabled={!nueva.trim()} className={`${botonSec} h-auto px-4 disabled:opacity-40`}><Plus className="w-4 h-4" /> Agregar sede</button>
      </form>
    </div>
  );
}

function Telegram({ businessId, telegram, onCambio, avisar }) {
  const [enlace, setEnlace] = useState(null);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');

  const vincular = async () => {
    setError('');
    try {
      const { data } = await api.post('/asistencia/telegram/vincular', { businessId });
      setEnlace(data.enlace);
      window.open(data.enlace, '_blank', 'noopener');
    } catch (err) { setError(err.response?.data?.message || 'No se pudo generar el enlace'); }
  };
  const comprobar = async () => {
    setEstado('comprobando');
    setError('');
    try {
      await api.post('/asistencia/telegram/comprobar', { businessId });
      setEnlace(null);
      avisar('Telegram conectado. Te llegó un mensaje de prueba.');
      onCambio();
    } catch (err) { setError(err.response?.data?.message || 'No se pudo comprobar'); }
    setEstado('');
  };
  const quitar = async (c) => {
    if (!window.confirm(`¿Dejar de avisar a ${c.nombre || 'este chat'}?`)) return;
    await api.delete(`/asistencia/telegram/${c.chatId}`, { params: { businessId } });
    onCambio();
  };

  return (
    <div className={tarjeta}>
      <Titulo detalle="Te llega un mensaje con el nombre, la sede y la hora apenas alguien marca.">Aviso por Telegram</Titulo>
      {!telegram.disponible ? (
        <p className="text-sm text-amber-700">El bot de Telegram todavía no está configurado en el servidor.</p>
      ) : (
        <>
          {telegram.chats.length > 0 && (
            <ul className="mb-3 divide-y divide-slate-100">
              {telegram.chats.map((c) => (
                <li key={c.chatId} className="py-2 flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-500" />
                  <span className="flex-1 text-sm text-slate-800">{c.nombre || `Chat ${c.chatId}`}</span>
                  <button type="button" onClick={() => quitar(c)} className="text-xs font-semibold text-slate-500 hover:text-red-600">Quitar</button>
                </li>
              ))}
            </ul>
          )}
          {!enlace ? (
            <button type="button" onClick={vincular} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl lg:rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold">
              <Send className="w-4 h-4" /> {telegram.chats.length ? 'Agregar otro chat' : 'Conectar Telegram'}
            </button>
          ) : (
            <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-sm text-sky-900">
              <p>1. En Telegram toca <b>Iniciar</b> (se abrió en otra pestaña; si no, <a href={enlace} target="_blank" rel="noopener noreferrer" className="underline font-semibold">ábrelo aquí</a>).</p>
              <p className="mt-1">2. Vuelve y toca comprobar.</p>
              <button type="button" onClick={comprobar} disabled={estado === 'comprobando'} className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-sky-500 text-white text-sm font-semibold disabled:opacity-60">
                {estado === 'comprobando' ? 'Comprobando…' : 'Ya toqué Iniciar, comprobar'}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}

function Reporte({ businessId, personas, businessName }) {
  const [desde, setDesde] = useState(inicioMesYmd());
  const [hasta, setHasta] = useState(hoyYmd());
  const [personaId, setPersonaId] = useState('');
  const [estado, setEstado] = useState('');

  const descargar = async () => {
    setEstado('cargando');
    try {
      const { data } = await api.get('/asistencia/marcas', { params: { businessId, desde, hasta, ...(personaId ? { personaId } : {}) } });
      if (!data.marcas.length) { setEstado('vacio'); return; }
      await descargarExcel({ marcas: data.marcas, desde, hasta, negocio: businessName });
      setEstado('');
    } catch {
      setEstado('error');
    }
  };

  return (
    <div className={tarjeta}>
      <Titulo detalle="Horas por jornada, entradas sin salida y el total, en Excel.">Reporte</Titulo>
      <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1.3fr] gap-2">
        <label className="text-xs font-semibold text-slate-500">Desde<input type="date" className={`${input} mt-1`} value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-500">Hasta<input type="date" className={`${input} mt-1`} value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-500 col-span-2 sm:col-span-1">Empleado
          <select className={`${input} mt-1`} value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
            <option value="">Todos (una hoja por persona)</option>
            {personas.map((p) => <option key={p._id} value={p._id}>{p.nombre}</option>)}
          </select>
        </label>
      </div>
      <button type="button" onClick={descargar} disabled={estado === 'cargando'} className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-xl lg:rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60">
        <FileSpreadsheet className="w-4 h-4" /> {estado === 'cargando' ? 'Armando el Excel…' : 'Descargar Excel'}
      </button>
      {estado === 'vacio' && <p className="mt-2 text-xs text-slate-500">No hay marcas en esas fechas.</p>}
      {estado === 'error' && <p className="mt-2 text-xs text-red-600">No se pudo generar el reporte.</p>}
    </div>
  );
}

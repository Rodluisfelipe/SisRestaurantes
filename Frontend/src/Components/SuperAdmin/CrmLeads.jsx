import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Plus, X, MessageCircle, Phone, Send, Clock, AlertTriangle, CheckCircle2, LayoutGrid, List,
  Loader2, Link2, StickyNote, PhoneCall, Users, Pencil, ExternalLink, Inbox,
} from 'lucide-react';
import superadminApi from '../../services/superadminApi';

/**
 * CRM de leads de Menuby.
 *
 * Los leads entran solos (WhatsApp de Menuby, formulario de la web, registro)
 * o se crean a mano, y avanzan por etapas en un tablero. Cada lead tiene su
 * conversación de WhatsApp, su actividad y sus datos en un panel lateral.
 */

const ETAPAS = [
  { id: 'nuevo', nombre: 'Nuevo', color: '#64748B' },
  { id: 'contactado', nombre: 'Contactado', color: '#0EA5E9' },
  { id: 'interesado', nombre: 'Interesado', color: '#8B5CF6' },
  { id: 'demo', nombre: 'Demo', color: '#F59E0B' },
  { id: 'negociacion', nombre: 'Negociación', color: '#F97316' },
  { id: 'ganado', nombre: 'Ganado', color: '#10B981' },
  { id: 'perdido', nombre: 'Perdido', color: '#EF4444' },
];
const ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.id, e]));
const FUENTES = {
  whatsapp: 'WhatsApp', formulario: 'Formulario web', registro: 'Se registró', referido: 'Referido', manual: 'Manual', evento: 'Evento', otro: 'Otro',
};
const PLANES = ['Gratis', 'Starter', 'Pro', 'Pro Max'];

const pesos = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const telVisible = (t) => (t?.startsWith('57') && t.length === 12 ? `${t.slice(2, 5)} ${t.slice(5, 8)} ${t.slice(8)}` : t ? `+${t}` : '');
const hace = (f) => {
  if (!f) return '';
  const min = Math.round((Date.now() - new Date(f)) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} d` : new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};
const vencida = (l) => l.proximaAccion?.fecha && new Date(l.proximaAccion.fecha) <= new Date() && !['ganado', 'perdido'].includes(l.etapa);
const tituloLead = (l) => l.negocio || l.nombre || telVisible(l.telefono) || 'Sin nombre';

const input = 'w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';
const btnSec = 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-40';
const btnPri = 'inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-40';

function errorDe(e, porDefecto) { return e?.response?.data?.message || porDefecto; }

export default function CrmLeads() {
  const [leads, setLeads] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('tablero');
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState({ fuente: '', mios: false, pendientes: false, sinLeer: false });
  const [abierto, setAbierto] = useState(null);
  const [creando, setCreando] = useState(false);
  const [whatsapp, setWhatsapp] = useState(null);
  const [conectando, setConectando] = useState(false);
  const [equipo, setEquipo] = useState([]);
  const [perdiendo, setPerdiendo] = useState(null); // { lead } al soltar en "Perdido"

  const cargar = useCallback(async () => {
    try {
      const params = {
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(filtro.fuente ? { fuente: filtro.fuente } : {}),
        ...(filtro.mios ? { responsable: 'yo' } : {}),
        ...(filtro.pendientes ? { pendientes: 1 } : {}),
        ...(filtro.sinLeer ? { sinLeer: 1 } : {}),
      };
      const [l, r] = await Promise.all([superadminApi.get('/crm/leads', { params }), superadminApi.get('/crm/resumen')]);
      setLeads(l.data.leads);
      setResumen(r.data);
    } finally {
      setCargando(false);
    }
  }, [q, filtro]);

  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);
  // Lo que entra por WhatsApp aparece solo.
  useEffect(() => { const t = setInterval(cargar, 15000); return () => clearInterval(t); }, [cargar]);
  useEffect(() => {
    superadminApi.get('/crm/whatsapp').then(({ data }) => setWhatsapp(data)).catch(() => setWhatsapp({ cuenta: null }));
    superadminApi.get('/crm/equipo').then(({ data }) => setEquipo(data.equipo)).catch(() => {});
  }, []);

  const moverEtapa = async (lead, etapa, motivoPerdida) => {
    if (lead.etapa === etapa) return;
    if (etapa === 'perdido' && !motivoPerdida) { setPerdiendo({ lead }); return; }
    setLeads((ls) => ls.map((l) => (l._id === lead._id ? { ...l, etapa } : l)));
    try {
      await superadminApi.put(`/crm/leads/${lead._id}`, { etapa, ...(motivoPerdida ? { motivoPerdida } : {}) });
    } catch (e) {
      window.alert(errorDe(e, 'No se pudo mover el lead'));
    }
    cargar();
  };

  const conversion = useMemo(() => {
    if (!resumen) return 0;
    const cerrados = resumen.etapas.filter((e) => ['ganado', 'perdido'].includes(e.etapa)).reduce((s, e) => s + e.n, 0);
    const ganados = resumen.etapas.find((e) => e.etapa === 'ganado')?.n || 0;
    return cerrados ? Math.round((ganados / cerrados) * 100) : 0;
  }, [resumen]);

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Leads</h2>
          <p className="text-sm text-slate-500">Los negocios que pueden volverse clientes de Menuby, de la primera conversación al cierre.</p>
        </div>
        <div className="flex items-center gap-2">
          <EstadoWhatsapp whatsapp={whatsapp} onConectar={() => setConectando(true)} />
          <button type="button" onClick={() => setCreando(true)} className={btnPri}><Plus className="w-4 h-4" /> Nuevo lead</button>
        </div>
      </div>

      {/* Números */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <Kpi etiqueta="Nuevos (30 días)" valor={resumen.nuevos30} />
          <Kpi etiqueta="Ganados (30 días)" valor={resumen.ganados30} tono="emerald" />
          <Kpi etiqueta="Conversión" valor={`${conversion}%`} detalle="ganados / cerrados" />
          <Kpi etiqueta="Acciones vencidas" valor={resumen.vencidas} tono={resumen.vencidas ? 'amber' : undefined} onClick={() => setFiltro((f) => ({ ...f, pendientes: !f.pendientes }))} activo={filtro.pendientes} />
          <Kpi etiqueta="Sin leer" valor={resumen.sinLeer} tono={resumen.sinLeer ? 'blue' : undefined} onClick={() => setFiltro((f) => ({ ...f, sinLeer: !f.sinLeer }))} activo={filtro.sinLeer} />
        </div>
      )}

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className={`${input} pl-9`} placeholder="Buscar por nombre, negocio, ciudad o teléfono" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar leads" />
        </div>
        <select className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200" value={filtro.fuente} onChange={(e) => setFiltro((f) => ({ ...f, fuente: e.target.value }))} aria-label="Fuente">
          <option value="">Todas las fuentes</option>
          {Object.entries(FUENTES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <button type="button" onClick={() => setFiltro((f) => ({ ...f, mios: !f.mios }))} aria-pressed={filtro.mios} className={`${btnSec} h-10 ${filtro.mios ? '!bg-blue-50 !border-blue-300 !text-blue-700' : ''}`}>
          <Users className="w-4 h-4" /> Mis leads
        </button>
        <div className="ml-auto inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="radiogroup" aria-label="Vista">
          {[['tablero', LayoutGrid, 'Tablero'], ['lista', List, 'Lista']].map(([id, Icono, n]) => (
            <button key={id} type="button" role="radio" aria-checked={vista === id} onClick={() => setVista(id)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold ${vista === id ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}>
              <Icono className="w-3.5 h-3.5" /> {n}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-48 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : leads.length === 0 && !q && !filtro.fuente && !filtro.mios && !filtro.pendientes && !filtro.sinLeer ? (
        <Vacio onCrear={() => setCreando(true)} whatsapp={whatsapp} onConectar={() => setConectando(true)} />
      ) : vista === 'tablero' ? (
        <Tablero leads={leads} resumen={resumen} onAbrir={setAbierto} onMover={moverEtapa} />
      ) : (
        <Lista leads={leads} onAbrir={setAbierto} />
      )}

      {abierto && (
        <FichaLead
          id={abierto}
          equipo={equipo}
          whatsapp={whatsapp}
          onCerrar={() => { setAbierto(null); cargar(); }}
          onCambio={cargar}
          onEliminado={() => { setAbierto(null); cargar(); }}
        />
      )}
      {creando && <NuevoLead onCerrar={() => setCreando(false)} onCreado={(id) => { setCreando(false); cargar(); setAbierto(id); }} />}
      {conectando && <ConectarWhatsapp onCerrar={() => setConectando(false)} onConectado={() => superadminApi.get('/crm/whatsapp').then(({ data }) => setWhatsapp(data))} />}
      {perdiendo && (
        <MotivoPerdida
          lead={perdiendo.lead}
          onCancelar={() => setPerdiendo(null)}
          onGuardar={(motivo) => { const l = perdiendo.lead; setPerdiendo(null); moverEtapa(l, 'perdido', motivo); }}
        />
      )}
    </div>
  );
}

/* ─────────────── Piezas pequeñas ─────────────── */
function Kpi({ etiqueta, valor, detalle, tono, onClick, activo }) {
  const colores = { emerald: 'text-emerald-700', amber: 'text-amber-700', blue: 'text-blue-700' };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`h-full flex flex-col items-start justify-start text-left rounded-xl border bg-white px-3.5 py-3 ${activo ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} ${onClick ? 'hover:border-slate-300' : ''}`}>
      <p className="text-xs text-slate-500">{etiqueta}</p>
      <p className={`text-xl font-black tabular-nums ${colores[tono] || 'text-slate-900'}`}>{valor}</p>
      {detalle && <p className="text-[11px] text-slate-400">{detalle}</p>}
    </Tag>
  );
}

function EstadoWhatsapp({ whatsapp, onConectar }) {
  if (!whatsapp) return null;
  if (whatsapp.cuenta?.estado === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
        <span className="w-2 h-2 rounded-full bg-emerald-500" /> WhatsApp {whatsapp.cuenta.numero}
      </span>
    );
  }
  return <button type="button" onClick={onConectar} className={`${btnSec} !border-amber-300 !bg-amber-50 !text-amber-800`}><MessageCircle className="w-4 h-4" /> Conectar WhatsApp</button>;
}

function Vacio({ onCrear, whatsapp, onConectar }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
      <p className="mt-3 text-base font-bold text-slate-900">Todavía no hay leads</p>
      <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
        Entran solos cuando alguien escribe al WhatsApp de Menuby, deja sus datos en la web o se registra. También puedes crearlos a mano.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={onCrear} className={btnPri}><Plus className="w-4 h-4" /> Crear el primero</button>
        {whatsapp?.cuenta?.estado !== 'active' && <button type="button" onClick={onConectar} className={btnSec}><MessageCircle className="w-4 h-4" /> Conectar WhatsApp</button>}
      </div>
    </div>
  );
}

function TarjetaLead({ lead, onAbrir, arrastrable }) {
  return (
    <button
      type="button"
      draggable={arrastrable}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', lead._id); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => onAbrir(lead._id)}
      className="w-full text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 hover:shadow-sm transition cursor-pointer active:scale-[0.99]"
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 min-w-0 text-sm font-bold text-slate-900 leading-snug">{tituloLead(lead)}</p>
        {lead.noLeidos > 0 && <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">{lead.noLeidos}</span>}
      </div>
      {lead.negocio && lead.nombre && <p className="text-xs text-slate-500 truncate">{lead.nombre}</p>}
      {lead.ultimoMensaje?.texto && (
        <p className={`mt-1.5 text-xs leading-snug line-clamp-2 ${lead.noLeidos ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
          {lead.ultimoMensaje.direccion === 'out' && <span className="text-slate-400">Tú: </span>}{lead.ultimoMensaje.texto}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{FUENTES[lead.fuente] || lead.fuente}</span>
        {lead.valorEstimado > 0 && <span className="text-slate-600 font-semibold tabular-nums">{pesos(lead.valorEstimado)}/mes</span>}
        {lead.proximaAccion?.fecha && (
          <span className={`inline-flex items-center gap-1 font-semibold ${vencida(lead) ? 'text-red-600' : 'text-slate-500'}`}>
            {vencida(lead) ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {new Date(lead.proximaAccion.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </span>
        )}
        <span className="ml-auto text-slate-400">{hace(lead.ultimoContacto || lead.updatedAt)}</span>
      </div>
    </button>
  );
}

function Tablero({ leads, resumen, onAbrir, onMover }) {
  const [sobre, setSobre] = useState(null);
  const porEtapa = (id) => leads.filter((l) => l.etapa === id);
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
      {ETAPAS.map((e) => {
        const lista = porEtapa(e.id);
        const valor = resumen?.etapas.find((x) => x.etapa === e.id)?.valor || 0;
        return (
          <section
            key={e.id}
            onDragOver={(ev) => { ev.preventDefault(); setSobre(e.id); }}
            onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
            onDrop={(ev) => { ev.preventDefault(); setSobre(null); const lead = leads.find((l) => l._id === ev.dataTransfer.getData('text/plain')); if (lead) onMover(lead, e.id); }}
            className={`w-[236px] shrink-0 rounded-xl p-2 transition-colors ${sobre === e.id ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-slate-100/70'}`}
            aria-label={`Etapa ${e.nombre}`}
          >
            <header className="flex items-center gap-2 px-1.5 py-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
              <h3 className="text-sm font-bold text-slate-800">{e.nombre}</h3>
              <span className="text-xs font-semibold text-slate-500 tabular-nums">{lista.length}</span>
              {valor > 0 && <span className="ml-auto text-[11px] font-semibold text-slate-500 tabular-nums">{pesos(valor)}</span>}
            </header>
            <div className="space-y-2 min-h-[120px] max-h-[62vh] overflow-y-auto pr-0.5">
              {lista.map((l) => <TarjetaLead key={l._id} lead={l} onAbrir={onAbrir} arrastrable />)}
              {lista.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-400">Arrastra un lead aquí</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Lista({ leads, onAbrir }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            {['Lead', 'Etapa', 'Fuente', 'Teléfono', 'Próxima acción', 'Responsable', 'Último contacto'].map((h) => <th key={h} className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((l) => (
            <tr key={l._id} onClick={() => onAbrir(l._id)} className="cursor-pointer hover:bg-slate-50">
              <td className="px-3 py-2.5">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">{tituloLead(l)} {l.noLeidos > 0 && <span className="px-1.5 rounded-full bg-blue-600 text-white text-[11px]">{l.noLeidos}</span>}</p>
                {l.negocio && l.nombre && <p className="text-xs text-slate-500">{l.nombre}</p>}
              </td>
              <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"><span className="w-2 h-2 rounded-full" style={{ background: ETAPA[l.etapa]?.color }} />{ETAPA[l.etapa]?.nombre}</span></td>
              <td className="px-3 py-2.5 text-xs text-slate-600">{FUENTES[l.fuente]}</td>
              <td className="px-3 py-2.5 text-xs text-slate-600 tabular-nums whitespace-nowrap">{telVisible(l.telefono)}</td>
              <td className={`px-3 py-2.5 text-xs ${vencida(l) ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>{l.proximaAccion?.texto || ''}{l.proximaAccion?.fecha ? ` · ${new Date(l.proximaAccion.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : ''}</td>
              <td className="px-3 py-2.5 text-xs text-slate-600">{l.responsable?.nombre}</td>
              <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{hace(l.ultimoContacto || l.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {leads.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nada con esos filtros.</p>}
    </div>
  );
}

/* ─────────────── Ficha del lead (panel lateral) ─────────────── */
function FichaLead({ id, equipo, whatsapp, onCerrar, onCambio, onEliminado }) {
  const [datos, setDatos] = useState(null);
  const [pestana, setPestana] = useState('conversacion');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await superadminApi.get(`/crm/leads/${id}`);
      setDatos(data);
      if (data.lead.noLeidos) { superadminApi.post(`/crm/leads/${id}/leido`).then(onCambio).catch(() => {}); }
    } catch (e) { setError(errorDe(e, 'No se pudo abrir el lead')); }
  }, [id, onCambio]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { const t = setInterval(cargar, 8000); return () => clearInterval(t); }, [cargar]);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  const guardar = async (cambios) => {
    const { data } = await superadminApi.put(`/crm/leads/${id}`, cambios);
    setDatos((d) => ({ ...d, lead: data.lead }));
    onCambio();
    cargar();
  };

  const lead = datos?.lead;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onCerrar}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-[640px] bg-white shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-label="Ficha del lead">
        {!lead ? (
          <div className="flex-1 flex items-center justify-center">{error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />}</div>
        ) : (
          <>
            {/* Cabecera */}
            <div className="shrink-0 border-b border-slate-200 px-5 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{tituloLead(lead)}</h3>
                  <p className="text-sm text-slate-500">
                    {[lead.negocio && lead.nombre, telVisible(lead.telefono), lead.ciudad].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {lead.telefono && (
                  <>
                    <a href={`tel:+${lead.telefono}`} className={btnSec} aria-label="Llamar"><PhoneCall className="w-4 h-4" /></a>
                    <a href={`https://wa.me/${lead.telefono}`} target="_blank" rel="noopener noreferrer" className={btnSec} aria-label="Abrir en WhatsApp"><MessageCircle className="w-4 h-4" /></a>
                  </>
                )}
                <button type="button" onClick={onCerrar} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X className="w-5 h-5" /></button>
              </div>
              {/* Etapas */}
              <div className="mt-3 flex gap-1 overflow-x-auto" role="radiogroup" aria-label="Etapa">
                {ETAPAS.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={lead.etapa === e.id}
                    onClick={() => {
                      if (e.id === lead.etapa) return;
                      if (e.id === 'perdido') {
                        const motivo = window.prompt('¿Por qué se perdió?', lead.motivoPerdida || '');
                        if (motivo?.trim()) guardar({ etapa: 'perdido', motivoPerdida: motivo });
                        return;
                      }
                      guardar({ etapa: e.id });
                    }}
                    className="shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition-colors"
                    style={lead.etapa === e.id ? { background: e.color, borderColor: e.color, color: '#fff' } : { borderColor: '#E2E8F0', color: '#475569' }}
                  >
                    {e.nombre}
                  </button>
                ))}
              </div>
              {lead.businessId && datos.negocio && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Registrado en Menuby: {datos.negocio.businessName}
                  <a href={`/${datos.negocio.slug}`} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">ver menú <ExternalLink className="w-3 h-3" /></a>
                </p>
              )}
            </div>

            {/* Pestañas */}
            <div className="shrink-0 flex gap-1 px-5 pt-2 border-b border-slate-200" role="tablist">
              {[['conversacion', 'Conversación'], ['actividad', 'Actividad'], ['datos', 'Datos']].map(([pid, n]) => (
                <button key={pid} type="button" role="tab" aria-selected={pestana === pid} onClick={() => setPestana(pid)} className={`h-9 px-3 text-sm font-semibold border-b-2 -mb-px ${pestana === pid ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  {n}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              {pestana === 'conversacion' && <Conversacion id={id} lead={lead} mensajes={datos.mensajes} ventanaAbierta={datos.ventanaAbierta} whatsapp={whatsapp} onEnviado={() => { cargar(); onCambio(); }} />}
              {pestana === 'actividad' && <Actividad id={id} actividades={datos.actividades} onNueva={() => { cargar(); onCambio(); }} />}
              {pestana === 'datos' && <Datos lead={lead} equipo={equipo} onGuardar={guardar} onEliminado={onEliminado} />}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Conversacion({ id, lead, mensajes, ventanaAbierta, whatsapp, onEnviado }) {
  const [texto, setTexto] = useState('');
  const [plantilla, setPlantilla] = useState('');
  const [variables, setVariables] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const fondo = useRef(null);
  const conectado = whatsapp?.cuenta?.estado === 'active';

  useEffect(() => { fondo.current?.scrollIntoView({ block: 'end' }); }, [mensajes.length]);

  const enviar = async (e) => {
    e?.preventDefault();
    setError('');
    setEnviando(true);
    try {
      if (ventanaAbierta) await superadminApi.post(`/crm/leads/${id}/whatsapp`, { texto });
      else {
        const p = whatsapp.plantillas.find((x) => x.nombre === plantilla);
        await superadminApi.post(`/crm/leads/${id}/whatsapp`, { plantilla, idioma: p?.idioma, variables: variables ? variables.split('|').map((v) => v.trim()) : [] });
      }
      setTexto(''); setVariables('');
      onEnviado();
    } catch (err) {
      setError(errorDe(err, 'No se pudo enviar'));
    }
    setEnviando(false);
  };

  if (!lead.telefono) return <p className="p-5 text-sm text-slate-500">Este lead no tiene teléfono. Agrégalo en Datos para conversar por WhatsApp.</p>;

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-slate-50">
        {mensajes.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Aún no hay mensajes con este lead.</p>}
        {mensajes.map((m) => (
          <div key={m._id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug ${m.direction === 'out' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'}`}>
              <p className="whitespace-pre-wrap break-words">{m.text || m.transcripcion || `[${m.type}]`}</p>
              <p className={`mt-0.5 text-2xs ${m.direction === 'out' ? 'text-blue-100' : 'text-slate-400'}`}>
                {new Date(m.sentAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                {m.direction === 'out' && m.status === 'read' && ' · leído'}
                {m.status === 'failed' && ` · falló${m.errorMessage ? `: ${m.errorMessage}` : ''}`}
              </p>
            </div>
          </div>
        ))}
        <div ref={fondo} />
      </div>
      <div className="shrink-0 border-t border-slate-200 p-3">
        {!conectado ? (
          <p className="text-sm text-slate-500">Conecta el WhatsApp de Menuby para conversar desde aquí. Mientras tanto, <a className="text-blue-700 underline" href={`https://wa.me/${lead.telefono}`} target="_blank" rel="noopener noreferrer">ábrelo en WhatsApp</a>.</p>
        ) : ventanaAbierta ? (
          <form onSubmit={enviar} className="flex items-end gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (texto.trim()) enviar(); } }}
              rows={2}
              placeholder="Escribe un mensaje… (Enter para enviar)"
              className="flex-1 resize-none px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button type="submit" disabled={!texto.trim() || enviando} className={`${btnPri} h-10`} aria-label="Enviar">{enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
          </form>
        ) : (
          <form onSubmit={enviar} className="space-y-2">
            <p className="text-xs text-amber-700 font-semibold">Pasaron más de 24 h desde su último mensaje: Meta solo deja escribir con una plantilla aprobada.</p>
            {whatsapp.plantillas.length === 0 ? (
              <p className="text-xs text-slate-500">No hay plantillas aprobadas. Créalas en el Administrador de WhatsApp de Meta.</p>
            ) : (
              <div className="flex gap-2">
                <select className={input} value={plantilla} onChange={(e) => setPlantilla(e.target.value)} aria-label="Plantilla">
                  <option value="">Elige una plantilla</option>
                  {whatsapp.plantillas.map((p) => <option key={`${p.nombre}-${p.idioma}`} value={p.nombre}>{p.nombre}</option>)}
                </select>
                <button type="submit" disabled={!plantilla || enviando} className={`${btnPri} h-10`}>{enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar'}</button>
              </div>
            )}
            {plantilla && (
              <>
                <p className="text-xs text-slate-500 whitespace-pre-wrap">{whatsapp.plantillas.find((p) => p.nombre === plantilla)?.cuerpo}</p>
                <input className={input} placeholder="Variables separadas por | (ej: Ana|Fraise)" value={variables} onChange={(e) => setVariables(e.target.value)} aria-label="Variables de la plantilla" />
              </>
            )}
          </form>
        )}
        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      </div>
    </>
  );
}

const ICONO_ACTIVIDAD = { nota: StickyNote, llamada: PhoneCall, reunion: Users, etapa: LayoutGrid, sistema: Link2, whatsapp: MessageCircle };

function Actividad({ id, actividades, onNueva }) {
  const [tipo, setTipo] = useState('nota');
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const agregar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try { await superadminApi.post(`/crm/leads/${id}/actividades`, { tipo, texto }); setTexto(''); onNueva(); } finally { setGuardando(false); }
  };
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <form onSubmit={agregar} className="rounded-xl border border-slate-200 p-3 space-y-2">
        <div className="flex gap-1" role="radiogroup" aria-label="Tipo">
          {[['nota', 'Nota'], ['llamada', 'Llamada'], ['reunion', 'Reunión']].map(([t, n]) => (
            <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(t)} className={`h-8 px-3 rounded-full text-xs font-semibold border ${tipo === t ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600'}`}>{n}</button>
          ))}
        </div>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder={tipo === 'llamada' ? '¿Qué se habló en la llamada?' : tipo === 'reunion' ? '¿Cómo fue la reunión o demo?' : 'Escribe una nota'} className="w-full resize-none px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        <div className="flex justify-end"><button type="submit" disabled={!texto.trim() || guardando} className={btnPri}>Guardar</button></div>
      </form>
      <ol className="mt-4 space-y-3">
        {actividades.map((a) => {
          const Icono = ICONO_ACTIVIDAD[a.tipo] || StickyNote;
          return (
            <li key={a._id} className="flex gap-3">
              <span className="w-8 h-8 shrink-0 rounded-full bg-slate-100 flex items-center justify-center"><Icono className="w-4 h-4 text-slate-500" /></span>
              <div className="min-w-0">
                <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{a.texto}</p>
                <p className="text-[11px] text-slate-400">{a.por?.nombre ? `${a.por.nombre} · ` : ''}{new Date(a.fecha).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Campo({ etiqueta, children }) {
  return <label className="block text-xs font-semibold text-slate-500">{etiqueta}<div className="mt-1">{children}</div></label>;
}

function Datos({ lead, equipo, onGuardar, onEliminado }) {
  const [f, setF] = useState(() => ({
    nombre: lead.nombre, negocio: lead.negocio, telefono: lead.telefono ? telVisible(lead.telefono) : '', email: lead.email, ciudad: lead.ciudad,
    tipoNegocio: lead.tipoNegocio, fuente: lead.fuente, origen: lead.origen, valorEstimado: lead.valorEstimado || '', planInteres: lead.planInteres,
    responsableId: lead.responsable?.id || '', etiquetas: (lead.etiquetas || []).join(', '), motivoPerdida: lead.motivoPerdida,
    accionTexto: lead.proximaAccion?.texto || '', accionFecha: lead.proximaAccion?.fecha ? new Date(lead.proximaAccion.fecha).toISOString().slice(0, 10) : '',
  }));
  const [estado, setEstado] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    setEstado('guardando');
    try {
      await onGuardar({
        nombre: f.nombre, negocio: f.negocio, telefono: f.telefono, email: f.email, ciudad: f.ciudad, tipoNegocio: f.tipoNegocio, fuente: f.fuente,
        origen: f.origen, valorEstimado: f.valorEstimado, planInteres: f.planInteres, responsableId: f.responsableId || null, motivoPerdida: f.motivoPerdida,
        etiquetas: f.etiquetas.split(',').map((t) => t.trim()).filter(Boolean),
        proximaAccion: { texto: f.accionTexto, fecha: f.accionFecha ? `${f.accionFecha}T12:00:00-05:00` : null },
      });
      setEstado('ok');
      setTimeout(() => setEstado(''), 2000);
    } catch (err) {
      setEstado(errorDe(err, 'No se pudo guardar'));
    }
  };
  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar el lead ${tituloLead(lead)}? No se puede deshacer.`)) return;
    try { await superadminApi.delete(`/crm/leads/${lead._id}`); onEliminado(); } catch (err) { window.alert(errorDe(err, 'No se pudo eliminar')); }
  };

  return (
    <form onSubmit={guardar} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
        <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Próxima acción</p>
        <div className="grid grid-cols-[1fr_150px] gap-2">
          <input className={input} placeholder="Ej: Llamar para agendar la demo" value={f.accionTexto} onChange={set('accionTexto')} aria-label="Próxima acción" />
          <input type="date" className={input} value={f.accionFecha} onChange={set('accionFecha')} aria-label="Fecha de la próxima acción" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Nombre"><input className={input} value={f.nombre} onChange={set('nombre')} /></Campo>
        <Campo etiqueta="Negocio"><input className={input} value={f.negocio} onChange={set('negocio')} /></Campo>
        <Campo etiqueta="WhatsApp / teléfono"><input className={input} value={f.telefono} onChange={set('telefono')} inputMode="tel" /></Campo>
        <Campo etiqueta="Email"><input className={input} value={f.email} onChange={set('email')} type="email" /></Campo>
        <Campo etiqueta="Ciudad"><input className={input} value={f.ciudad} onChange={set('ciudad')} /></Campo>
        <Campo etiqueta="Tipo de negocio"><input className={input} value={f.tipoNegocio} onChange={set('tipoNegocio')} placeholder="Hamburguesería, café…" /></Campo>
        <Campo etiqueta="Fuente">
          <select className={input} value={f.fuente} onChange={set('fuente')}>{Object.entries(FUENTES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        </Campo>
        <Campo etiqueta="Origen / campaña"><input className={input} value={f.origen} onChange={set('origen')} placeholder="landing, feria, referido de…" /></Campo>
        <Campo etiqueta="Valor estimado (COP/mes)"><input className={input} value={f.valorEstimado} onChange={set('valorEstimado')} inputMode="numeric" /></Campo>
        <Campo etiqueta="Plan de interés">
          <select className={input} value={f.planInteres} onChange={set('planInteres')}><option value="">—</option>{PLANES.map((p) => <option key={p}>{p}</option>)}</select>
        </Campo>
        <Campo etiqueta="Responsable">
          <select className={input} value={f.responsableId} onChange={set('responsableId')}><option value="">Sin asignar</option>{equipo.map((p) => <option key={p._id} value={p._id}>{p.nombre}</option>)}</select>
        </Campo>
        <Campo etiqueta="Etiquetas (separadas por coma)"><input className={input} value={f.etiquetas} onChange={set('etiquetas')} placeholder="caliente, 2 sedes" /></Campo>
      </div>
      {lead.etapa === 'perdido' && <Campo etiqueta="Motivo de pérdida"><input className={input} value={f.motivoPerdida} onChange={set('motivoPerdida')} /></Campo>}
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={estado === 'guardando'} className={btnPri}>{estado === 'guardando' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} Guardar cambios</button>
        {estado === 'ok' && <span className="text-xs font-semibold text-emerald-700">Guardado</span>}
        {estado && !['ok', 'guardando'].includes(estado) && <span className="text-xs font-semibold text-red-600">{estado}</span>}
        <button type="button" onClick={eliminar} className="ml-auto text-xs font-semibold text-slate-400 hover:text-red-600">Eliminar lead</button>
      </div>
    </form>
  );
}

/* ─────────────── Modales ─────────────── */
function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">{titulo}</h3>
          <button type="button" onClick={onCerrar} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function NuevoLead({ onCerrar, onCreado }) {
  const [f, setF] = useState({ nombre: '', negocio: '', telefono: '', ciudad: '', tipoNegocio: '', fuente: 'manual', origen: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const crear = async (e) => {
    e.preventDefault();
    setError(''); setGuardando(true);
    try {
      const { data } = await superadminApi.post('/crm/leads', f);
      onCreado(data.lead._id);
    } catch (err) {
      setError(errorDe(err, 'No se pudo crear'));
      if (err.response?.data?.leadId) setTimeout(() => onCreado(err.response.data.leadId), 1200);
    }
    setGuardando(false);
  };
  return (
    <Modal titulo="Nuevo lead" onCerrar={onCerrar}>
      <form onSubmit={crear} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Nombre"><input className={input} value={f.nombre} onChange={set('nombre')} autoFocus /></Campo>
          <Campo etiqueta="Negocio"><input className={input} value={f.negocio} onChange={set('negocio')} /></Campo>
          <Campo etiqueta="WhatsApp"><input className={input} value={f.telefono} onChange={set('telefono')} inputMode="tel" placeholder="300 123 4567" /></Campo>
          <Campo etiqueta="Ciudad"><input className={input} value={f.ciudad} onChange={set('ciudad')} /></Campo>
          <Campo etiqueta="Tipo de negocio"><input className={input} value={f.tipoNegocio} onChange={set('tipoNegocio')} /></Campo>
          <Campo etiqueta="Fuente">
            <select className={input} value={f.fuente} onChange={set('fuente')}>{Object.entries(FUENTES).filter(([k]) => k !== 'registro' && k !== 'formulario').map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          </Campo>
        </div>
        <Campo etiqueta="Origen / campaña (opcional)"><input className={input} value={f.origen} onChange={set('origen')} placeholder="Feria gastronómica, referido de…" /></Campo>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className={btnSec}>Cancelar</button>
          <button type="submit" disabled={guardando} className={btnPri}>{guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear lead'}</button>
        </div>
      </form>
    </Modal>
  );
}

function MotivoPerdida({ lead, onCancelar, onGuardar }) {
  const [motivo, setMotivo] = useState('');
  const opciones = ['Precio', 'Eligió otra plataforma', 'No responde', 'No es el momento', 'Cerró el negocio'];
  return (
    <Modal titulo={`¿Por qué se perdió ${tituloLead(lead)}?`} onCerrar={onCancelar}>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => <button key={o} type="button" onClick={() => setMotivo(o)} className={`h-8 px-3 rounded-full text-xs font-semibold border ${motivo === o ? 'bg-red-600 border-red-600 text-white' : 'border-slate-200 text-slate-600'}`}>{o}</button>)}
      </div>
      <input className={`${input} mt-3`} placeholder="U otro motivo…" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onCancelar} className={btnSec}>Cancelar</button>
        <button type="button" disabled={!motivo.trim()} onClick={() => onGuardar(motivo.trim())} className={`${btnPri} !bg-red-600 hover:!bg-red-700`}>Marcar como perdido</button>
      </div>
    </Modal>
  );
}

function ConectarWhatsapp({ onCerrar, onConectado }) {
  const [modo, setModo] = useState('coexistencia');
  const [f, setF] = useState({ phoneNumberId: '', wabaId: '', accessToken: '' });
  const [estado, setEstado] = useState('');
  /* Ventana emergente de Meta con registro de sesión: es la que ofrece
     conectar el número de la app WhatsApp Business (Coexistencia). Se prepara
     al abrir el modal para que el navegador no bloquee la ventana. */
  const [configMeta, setConfigMeta] = useState(null);
  useEffect(() => {
    superadminApi.get('/crm/whatsapp/config')
      .then(({ data }) => { setConfigMeta(data); import('../../utils/registroWhatsapp'); })
      .catch(() => setConfigMeta(false));
  }, []);
  const conectarVentana = async () => {
    setEstado('abriendo');
    try {
      const { registrarWhatsapp } = await import('../../utils/registroWhatsapp');
      const r = await registrarWhatsapp(configMeta);
      setEstado('sincronizando');
      const { data } = await superadminApi.post('/crm/whatsapp/embedded', r);
      setEstado(data.coexistencia ? 'coexistencia' : 'ok');
      onConectado();
    } catch (err) {
      setEstado(err.cancelado ? '' : errorDe(err, err.message || 'No se pudo conectar'));
    }
  };
  const abrirEnlace = async () => {
    setEstado('');
    try {
      const { data } = await superadminApi.get('/crm/whatsapp/enlace');
      window.open(data.enlace, '_blank', 'noopener');
      setEstado('enlace');
    } catch (err) { setEstado(errorDe(err, 'No se pudo generar el enlace')); }
  };
  const manual = async (e) => {
    e.preventDefault();
    setEstado('guardando');
    try {
      const { data } = await superadminApi.post('/crm/whatsapp/manual', f);
      setEstado(data.aviso || 'ok');
      onConectado();
    } catch (err) { setEstado(errorDe(err, 'No se pudo conectar')); }
  };
  return (
    <Modal titulo="Conectar el WhatsApp de Menuby" onCerrar={onCerrar}>
      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 mb-4" role="radiogroup">
        {[['coexistencia', 'Usarlo en el celular y aquí'], ['manual', 'Conexión manual (API)']].map(([m, n]) => (
          <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => setModo(m)} className={`h-8 px-3 rounded-md text-xs font-semibold ${modo === m ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}>{n}</button>
        ))}
      </div>
      {modo === 'coexistencia' ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p>El número sigue funcionando en la app de WhatsApp Business del celular y los chats también llegan aquí.</p>
          <ol className="list-decimal pl-5 space-y-1 text-[13px]">
            <li>Toca <b>Conectar con Facebook</b> y, en la ventana de Meta, elige el portafolio <b>"Menuby Ventas"</b> (no el dueño de la app).</li>
            <li>Elige <b>conectar tu cuenta existente de WhatsApp Business</b> y escribe el número.</li>
            <li>En el celular, abre el mensaje de Meta en WhatsApp Business, toca <b>Conectar</b> y pega el código.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={conectarVentana} disabled={!configMeta || ['abriendo', 'sincronizando'].includes(estado)} className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-[#1877F2] hover:bg-[#166fe0] text-white text-sm font-semibold disabled:opacity-50">
              {estado === 'sincronizando' ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando y sincronizando…</> : estado === 'abriendo' ? <><Loader2 className="w-4 h-4 animate-spin" /> Abriendo Meta…</> : 'Conectar con Facebook'}
            </button>
            <button type="button" onClick={abrirEnlace} className={btnSec}><ExternalLink className="w-4 h-4" /> Usar el enlace</button>
          </div>
          {estado === 'sincronizando' && <p className="text-xs text-emerald-700">Deja la app WhatsApp Business abierta en el celular mientras traemos contactos y chats.</p>}
          {estado === 'coexistencia' && <p className="text-xs text-emerald-700 font-semibold">Conectado. El número sigue en tu celular y los chats también llegan aquí.</p>}
          {estado === 'enlace' && <p className="text-xs text-emerald-700 font-semibold">Al terminar en Meta, vuelve y recarga esta página.</p>}
        </div>
      ) : (
        <form onSubmit={manual} className="space-y-3">
          <p className="text-[13px] text-slate-600">Con esta opción el número deja de funcionar en la app del celular.</p>
          <Campo etiqueta="Phone number ID"><input className={input} value={f.phoneNumberId} onChange={(e) => setF({ ...f, phoneNumberId: e.target.value })} /></Campo>
          <Campo etiqueta="WhatsApp Business Account ID"><input className={input} value={f.wabaId} onChange={(e) => setF({ ...f, wabaId: e.target.value })} /></Campo>
          <Campo etiqueta="Token permanente (usuario del sistema)"><input className={input} value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} type="password" autoComplete="off" /></Campo>
          <button type="submit" disabled={!f.phoneNumberId || !f.accessToken || estado === 'guardando'} className={btnPri}>{estado === 'guardando' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Conectar'}</button>
        </form>
      )}
      {estado && !['enlace', 'guardando', 'abriendo', 'sincronizando', 'coexistencia'].includes(estado) && <p className={`mt-3 text-xs font-semibold ${estado === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{estado === 'ok' ? 'Conectado.' : estado}</p>}
    </Modal>
  );
}

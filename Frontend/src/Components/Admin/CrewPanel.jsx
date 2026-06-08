/**
 * CrewPanel — vista del lado business para publicar turnos y revisar postulantes.
 * Estilo MenuBy formal: blanco, slate, accent rojo.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';
import CrewWorkerProfileModal from './CrewWorkerProfileModal';
import BusinessCrewChatModal from './BusinessCrewChatModal';

function makeApi(businessId) {
  return {
    base: `${API_URL}/crew`,
    bizId: businessId,
    headers: () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    }),
    // Para GET: añade ?businessId= a la URL
    withBiz: (path) => `${path}${path.includes('?') ? '&' : '?'}businessId=${businessId}`,
    // Para POST/PATCH/DELETE: mezcla businessId en el body
    body: (obj = {}) => JSON.stringify({ ...obj, businessId }),
  };
}

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

const SKILLS = [
  { key: 'mesero', label: 'Mesero' },
  { key: 'cocinero', label: 'Cocinero' },
  { key: 'barista', label: 'Barista' },
  { key: 'bartender', label: 'Bartender' },
  { key: 'cajero', label: 'Cajero' },
  { key: 'runner', label: 'Auxiliar' },
  { key: 'host', label: 'Anfitrión' },
  { key: 'lavaplatos', label: 'Lavaplatos' },
  { key: 'parrillero', label: 'Parrillero' },
  { key: 'eventos', label: 'Eventos' },
];

const PERKS = [
  { key: 'cena_incluida', label: 'Comida incluida' },
  { key: 'transporte_final', label: 'Transporte al cierre' },
  { key: 'propinas_garantizadas', label: 'Propinas garantizadas' },
  { key: 'flexibilidad_horario', label: 'Horario flexible' },
  { key: 'ambiente_juvenil', label: 'Ambiente juvenil' },
  { key: 'pago_inmediato', label: 'Pago inmediato' },
];

export default function CrewPanel({ businessId }) {
  const [view, setView] = useState('mine');
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState(null);

  const api = makeApi(businessId);

  const loadShifts = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const r = await fetch(api.withBiz(`${api.base}/businesses/shifts`), { headers: api.headers() });
      const data = await r.json();
      setShifts(data.shifts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  if (!businessId) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <p className="text-sm text-slate-600">Cargando información del negocio…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[20px] font-extrabold text-slate-900 leading-tight flex items-center gap-2">
              Personal por turnos
              <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-red-50 text-red-700 border border-red-200 rounded">BETA</span>
            </h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Publica turnos puntuales y recibe postulaciones de trabajadores verificados de tu ciudad.
            </p>
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
            <button
              onClick={() => { setView('mine'); setSelectedShift(null); }}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition ${
                view === 'mine' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Mis turnos
            </button>
            <button
              onClick={() => { setView('new'); setSelectedShift(null); }}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition ${
                view === 'new' ? 'bg-red-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Publicar turno
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence mode="wait">
        {view === 'mine' && !selectedShift && (
          <motion.div key="mine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {loading && (
              <div className="space-y-2.5 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white border border-slate-200 rounded-2xl" />)}
              </div>
            )}
            {!loading && shifts.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg>
                </div>
                <p className="text-[14px] font-bold text-slate-700">Aún no has publicado turnos</p>
                <p className="text-[12px] text-slate-500 mt-1 mb-4">Publica el primer turno para empezar a recibir postulantes</p>
                <button
                  onClick={() => setView('new')}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[13px] transition"
                >
                  Publicar turno
                </button>
              </div>
            )}
            {!loading && shifts.length > 0 && (
              <div className="space-y-2.5">
                {shifts.map((s) => <ShiftRow key={s._id} shift={s} onClick={() => setSelectedShift(s)} />)}
              </div>
            )}
          </motion.div>
        )}

        {view === 'mine' && selectedShift && (
          <motion.div key="applicants" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <ApplicantsView api={api} shift={selectedShift} onBack={() => { setSelectedShift(null); loadShifts(); }} />
          </motion.div>
        )}

        {view === 'new' && (
          <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NewShiftForm
              api={api}
              onCreated={() => { setView('mine'); loadShifts(); }}
              onCancel={() => setView('mine')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShiftRow({ shift, onClick }) {
  const tones = {
    open: 'bg-blue-50 text-blue-700 border-blue-200',
    partially_filled: 'bg-amber-50 text-amber-700 border-amber-200',
    filled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-slate-50 text-slate-600 border-slate-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };
  const labels = {
    open: 'Abierto', partially_filled: 'Parcial', filled: 'Completo',
    completed: 'Finalizado', cancelled: 'Cancelado',
  };
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-sm transition shadow-sm"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold text-slate-900 truncate">{shift.title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {new Date(shift.date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
            {' · '}{shift.startTime} a {shift.endTime}
            {' · '}{shift.hoursTotal} horas
          </p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold border rounded-full ${tones[shift.status] || tones.open}`}>
          {labels[shift.status] || shift.status}
        </span>
      </div>
      <div className="flex items-center justify-between text-[12px] pt-2 border-t border-slate-100">
        <span className="text-slate-600">
          <strong className="font-extrabold text-slate-900">{shift.workersBooked}</strong>
          <span className="text-slate-400"> de </span>
          <strong className="font-extrabold text-slate-900">{shift.workersNeeded}</strong> postulantes aceptados
        </span>
        <span className="font-extrabold text-emerald-600 tabular-nums">{formatCOP(shift.totalPay)}</span>
      </div>
    </button>
  );
}

function ApplicantsView({ api, shift, onBack }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openApp, setOpenApp] = useState(null); // application abierta en el modal
  const [chatApp, setChatApp] = useState(null); // application con chat abierto

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(api.withBiz(`${api.base}/businesses/shifts/${shift._id}/applicants`), { headers: api.headers() });
      const data = await r.json();
      setApps(data.applications || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [shift._id]);

  useEffect(() => { load(); }, [load]);

  const respond = async (appId, action) => {
    try {
      const r = await fetch(`${api.base}/businesses/applications/${appId}/${action}`, {
        method: 'POST', headers: api.headers(), body: api.body({}),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        alert(e.message || 'No se pudo procesar la respuesta');
        return;
      }
      load();
    } catch { alert('No se pudo procesar la respuesta'); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <button onClick={onBack} className="mb-3 text-[12px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        Volver al listado
      </button>
      <h2 className="text-[16px] font-extrabold text-slate-900">{shift.title}</h2>
      <p className="text-[12px] text-slate-500 mb-4">
        {apps.length} {apps.length === 1 ? 'postulante' : 'postulantes'} · Toca una tarjeta para ver el perfil completo
      </p>

      {loading && <p className="text-sm text-slate-500">Cargando postulantes…</p>}
      {!loading && apps.length === 0 && (
        <div className="text-center py-10">
          <p className="text-[14px] font-bold text-slate-700">Aún no hay postulantes</p>
          <p className="text-[12px] text-slate-500 mt-1">Considera agregar beneficios al turno para atraer más interesados</p>
        </div>
      )}

      <div className="space-y-2.5">
        {apps.map((a) => (
          <ApplicantCard
            key={a._id}
            app={a}
            onOpenProfile={() => setOpenApp(a)}
            onAccept={() => respond(a._id, 'accept')}
            onReject={() => respond(a._id, 'reject')}
            onChat={() => setChatApp(a)}
          />
        ))}
      </div>

      {openApp && (
        <CrewWorkerProfileModal
          workerId={openApp.workerId?._id || openApp.workerId}
          businessId={api.bizId}
          matchScore={openApp.matchScore}
          canChat={openApp.status === 'accepted'}
          onClose={() => setOpenApp(null)}
          onChat={openApp.status === 'accepted' ? () => { setChatApp(openApp); setOpenApp(null); } : undefined}
          onAccept={openApp.status === 'pending' ? () => { respond(openApp._id, 'accept'); setOpenApp(null); } : undefined}
          onReject={openApp.status === 'pending' ? () => { respond(openApp._id, 'reject'); setOpenApp(null); } : undefined}
        />
      )}

      {chatApp && (
        <BusinessCrewChatModal
          workerId={chatApp.workerId?._id || chatApp.workerId}
          businessId={api.bizId}
          workerName={chatApp.workerId?.name}
          workerPhoto={chatApp.workerId?.photo}
          onClose={() => setChatApp(null)}
        />
      )}
    </div>
  );
}

function ApplicantCard({ app, onAccept, onReject, onOpenProfile, onChat }) {
  const w = app.workerId || {};
  const matchTone = app.matchScore >= 75 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                   app.matchScore >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                   'text-slate-600 bg-slate-50 border-slate-200';

  const kycStatus = w.kyc?.status;
  const expCount = (w.experiences || []).length;
  const eduCount = (w.education || []).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-shadow">
      {/* Header clickeable abre el perfil completo */}
      <button onClick={onOpenProfile} className="w-full text-left p-4 hover:bg-slate-50 transition">
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar con foto real */}
          {w.photo ? (
            <img src={w.photo} alt={w.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 border border-slate-200 flex items-center justify-center text-[18px] font-extrabold text-slate-600 shrink-0">
              {(w.name || '?').slice(0,1).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[14px] font-extrabold text-slate-900 truncate">{w.name || 'Postulante'}</p>
              {kycStatus === 'approved' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  Verificado
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
              <span className="font-bold text-red-600">Nivel {w.level || 1}</span>
              <span>·</span>
              <span>{(w.rating?.avg || 0).toFixed(1)}★ ({w.rating?.count || 0})</span>
              <span>·</span>
              <span>{w.stats?.shiftsCompleted || 0} turnos</span>
              {w.university && <><span>·</span><span className="truncate">{w.university}</span></>}
            </div>
            {/* Bio preview */}
            {w.bio && (
              <p className="text-[12px] text-slate-700 mt-1.5 line-clamp-2 leading-snug">{w.bio}</p>
            )}
          </div>

          <span className={`shrink-0 px-2 py-0.5 text-[10px] font-extrabold border rounded-full tabular-nums ${matchTone}`}>
            {app.matchScore}%
          </span>
        </div>

        {/* Resumen rápido del CV */}
        <div className="flex items-center gap-3 text-[11px] text-slate-600 mb-2 flex-wrap">
          {expCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              {expCount} {expCount === 1 ? 'experiencia' : 'experiencias'}
            </span>
          )}
          {eduCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>
              {eduCount} {eduCount === 1 ? 'estudio' : 'estudios'}
            </span>
          )}
          {(w.references || []).length > 0 && (
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              {w.references.length} {w.references.length === 1 ? 'referencia' : 'referencias'}
            </span>
          )}
        </div>

        {w.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {w.skills.slice(0, 5).map((s) => (
              <span key={s.key} className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-full">
                {s.key} · {s.level}
              </span>
            ))}
          </div>
        )}

        <p className="text-[10px] font-bold text-red-600 mt-2 text-right hover:underline">Ver perfil completo →</p>
      </button>

      {/* Acciones */}
      <div className="px-4 pb-3 pt-3 border-t border-slate-100">
        {app.status === 'pending' ? (
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold transition"
            >Rechazar</button>
            <button
              onClick={onAccept}
              className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[12px] font-extrabold transition shadow-sm"
            >Aceptar</button>
          </div>
        ) : app.status === 'accepted' ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-[11px] font-bold text-center py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              Aceptado
            </p>
            <button
              onClick={onChat}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-extrabold transition shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              Mensaje
            </button>
          </div>
        ) : (
          <p className="text-[11px] font-bold text-center py-2 rounded-lg border bg-slate-50 text-slate-500 border-slate-200">
            {app.status === 'rejected' ? 'Rechazado' : app.status}
          </p>
        )}
      </div>
    </div>
  );
}

function NewShiftForm({ api, onCreated, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    role: 'mesero',
    date: new Date().toISOString().split('T')[0],
    startTime: '18:00',
    endTime: '23:00',
    hoursTotal: 5,
    workersNeeded: 1,
    hourlyRate: 13000,
    perks: [],
    isSOS: false,
  });
  const [saving, setSaving] = useState(false);

  const togglePerk = (p) =>
    setForm((f) => ({ ...f, perks: f.perks.includes(p) ? f.perks.filter((x) => x !== p) : [...f.perks, p] }));

  const submit = async () => {
    if (!form.title.trim()) return alert('Por favor ingresa un título descriptivo');
    setSaving(true);
    try {
      const r = await fetch(`${api.base}/businesses/shifts`, {
        method: 'POST', headers: api.headers(),
        body: api.body(form),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        alert(e.message || 'No se pudo publicar el turno');
        setSaving(false);
        return;
      }
      onCreated?.();
    } catch {
      alert('Error de conexión. Intenta nuevamente.');
    } finally { setSaving(false); }
  };

  const total = (form.hoursTotal || 0) * (form.hourlyRate || 0);
  const commission = Math.round(total * 0.10);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Título del turno</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Ej: Mesero sábado en la noche"
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:border-red-500 focus:bg-white transition"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Cargo requerido</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {SKILLS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setForm({ ...form, role: s.key })}
              className={`py-2 rounded-lg text-[11px] font-semibold transition ${
                form.role === s.key
                  ? 'bg-red-50 text-red-700 border border-red-300'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Fecha">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-red-500"/>
        </Field>
        <Field label="Hora inicio">
          <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-red-500"/>
        </Field>
        <Field label="Hora fin">
          <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-red-500"/>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Horas">
          <input type="number" min={1} max={16} value={form.hoursTotal} onChange={(e) => setForm({ ...form, hoursTotal: Number(e.target.value) })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-red-500"/>
        </Field>
        <Field label="Cantidad personas">
          <input type="number" min={1} max={20} value={form.workersNeeded} onChange={(e) => setForm({ ...form, workersNeeded: Number(e.target.value) })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-red-500"/>
        </Field>
        <Field label="Pago por hora (COP)">
          <input type="number" min={5000} step={500} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-red-500"/>
        </Field>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Beneficios adicionales (opcional)</label>
        <div className="flex flex-wrap gap-1.5">
          {PERKS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => togglePerk(p.key)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
                form.perks.includes(p.key)
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
        <input type="checkbox" checked={form.isSOS} onChange={(e) => setForm({ ...form, isSOS: e.target.checked })} className="mt-0.5 w-4 h-4 accent-red-600"/>
        <div>
          <p className="text-[12px] font-bold text-amber-900">Marcar como urgente</p>
          <p className="text-[11px] text-amber-800 mt-0.5">El turno aparece destacado y se notifica a trabajadores cercanos con prioridad.</p>
        </div>
      </label>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inversión total</p>
          <p className="text-[20px] font-extrabold text-slate-900 tabular-nums">{formatCOP(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comisión MenuBy (10%)</p>
          <p className="text-[14px] font-extrabold text-slate-700 tabular-nums">{formatCOP(commission)}</p>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13px] transition"
        >Cancelar</button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex-[2] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-[13px] shadow-md shadow-red-500/20 disabled:opacity-50 transition"
        >
          {saving ? 'Publicando…' : 'Publicar turno'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

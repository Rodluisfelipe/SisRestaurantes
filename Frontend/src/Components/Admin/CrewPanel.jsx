/**
 * CrewPanel — vista del lado business para publicar turnos y revisar aplicantes.
 *
 * Usa la API tenant ya autenticada del negocio (header Authorization con accessToken).
 * Endpoints consumidos: /api/crew/businesses/*
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';

function api() {
  return {
    base: `${API_URL}/crew`,
    headers: () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    }),
  };
}

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

const SKILLS = [
  { key: 'mesero', label: 'Mesero', emoji: '🍽️' },
  { key: 'cocinero', label: 'Cocinero', emoji: '👨‍🍳' },
  { key: 'barista', label: 'Barista', emoji: '☕' },
  { key: 'bartender', label: 'Bartender', emoji: '🍸' },
  { key: 'cajero', label: 'Cajero', emoji: '💵' },
  { key: 'runner', label: 'Runner', emoji: '🏃' },
  { key: 'host', label: 'Host', emoji: '🙋' },
  { key: 'lavaplatos', label: 'Lavaplatos', emoji: '🧽' },
  { key: 'parrillero', label: 'Parrillero', emoji: '🔥' },
  { key: 'eventos', label: 'Eventos', emoji: '🎉' },
];

const PERKS = [
  'cena_incluida', 'transporte_final', 'propinas_garantizadas',
  'flexibilidad_horario', 'ambiente_juvenil', 'pago_inmediato',
];

export default function CrewPanel() {
  const [view, setView] = useState('mine'); // mine | new | applicants
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState(null);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const a = api();
      const r = await fetch(`${a.base}/businesses/shifts`, { headers: a.headers() });
      const data = await r.json();
      setShifts(data.shifts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-extrabold text-slate-900 leading-tight flex items-center gap-2">
            Crew <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-[#7B2FFF]/15 to-[#FF6B35]/15 text-[#7B2FFF] rounded-full">BETA</span>
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Contrata personal por turnos en minutos</p>
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-full">
          <button
            onClick={() => setView('mine')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${view === 'mine' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
          >Mis turnos</button>
          <button
            onClick={() => { setView('new'); setSelectedShift(null); }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${view === 'new' ? 'bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] text-white shadow' : 'text-slate-500'}`}
          >+ Publicar</button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          {view === 'mine' && !selectedShift && (
            <motion.div key="mine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading && (
                <div className="space-y-3 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-24 bg-slate-100 rounded-xl" />
                  ))}
                </div>
              )}
              {!loading && shifts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-[48px] mb-2">📋</p>
                  <p className="text-sm font-bold text-slate-700">No has publicado turnos aún</p>
                  <button
                    onClick={() => setView('new')}
                    className="mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] text-white font-bold text-xs"
                  >Publica el primero 🚀</button>
                </div>
              )}
              {!loading && shifts.length > 0 && (
                <div className="space-y-3">
                  {shifts.map((s) => (
                    <ShiftRow key={s._id} shift={s} onClick={() => setSelectedShift(s)} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'mine' && selectedShift && (
            <motion.div key="applicants" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <ApplicantsView shift={selectedShift} onBack={() => { setSelectedShift(null); loadShifts(); }} />
            </motion.div>
          )}

          {view === 'new' && (
            <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <NewShiftForm
                onCreated={() => { setView('mine'); loadShifts(); }}
                onCancel={() => setView('mine')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Components ─── */

function ShiftRow({ shift, onClick }) {
  const statusColor = {
    open: 'bg-blue-100 text-blue-700',
    partially_filled: 'bg-amber-100 text-amber-700',
    filled: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-slate-100 text-slate-600',
    cancelled: 'bg-red-100 text-red-700',
  }[shift.status] || 'bg-slate-100 text-slate-600';

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-slate-900 truncate">{shift.title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {new Date(shift.date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })} · {shift.startTime}-{shift.endTime} · {shift.hoursTotal}h
          </p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full ${statusColor}`}>
          {shift.status === 'partially_filled' ? 'parcial' : shift.status}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-600 font-bold">{shift.workersBooked}/{shift.workersNeeded} contratados</span>
        <span className="text-emerald-600 font-extrabold">{formatCOP(shift.totalPay)}</span>
      </div>
    </button>
  );
}

function ApplicantsView({ shift, onBack }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const a = api();
      const r = await fetch(`${a.base}/businesses/shifts/${shift._id}/applicants`, { headers: a.headers() });
      const data = await r.json();
      setApps(data.applications || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [shift._id]);

  useEffect(() => { load(); }, [load]);

  const respond = async (appId, action) => {
    try {
      const a = api();
      await fetch(`${a.base}/businesses/applications/${appId}/${action}`, {
        method: 'POST', headers: a.headers(),
      });
      load();
    } catch (e) {
      alert('Error');
    }
  };

  return (
    <div>
      <button onClick={onBack} className="mb-3 text-[12px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1">
        ← Volver
      </button>
      <h2 className="text-[16px] font-extrabold text-slate-900">{shift.title}</h2>
      <p className="text-[12px] text-slate-500 mb-4">
        {new Date(shift.date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} · {apps.length} aplicantes
      </p>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}
      {!loading && apps.length === 0 && (
        <div className="text-center py-10">
          <p className="text-[40px] mb-1">📭</p>
          <p className="text-sm text-slate-600">Nadie ha aplicado todavía</p>
          <p className="text-[11px] text-slate-400 mt-1">Comparte el turno o agrega bonus para atraer más workers</p>
        </div>
      )}

      <div className="space-y-3">
        {apps.map((a) => (
          <ApplicantCard key={a._id} app={a} onAccept={() => respond(a._id, 'accept')} onReject={() => respond(a._id, 'reject')} />
        ))}
      </div>
    </div>
  );
}

function ApplicantCard({ app, onAccept, onReject }) {
  const w = app.workerId || {};
  const matchColor = app.matchScore >= 75 ? 'text-emerald-600' : app.matchScore >= 50 ? 'text-amber-600' : 'text-slate-500';
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#7B2FFF]/20 to-[#FF6B35]/20 flex items-center justify-center text-sm font-extrabold text-slate-700 shrink-0">
          {(w.name || '?').slice(0,1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-extrabold text-slate-900 truncate">{w.name || 'Worker'}</p>
            <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-gradient-to-r from-[#7B2FFF]/15 to-[#FF6B35]/15 text-[#7B2FFF] rounded-full">
              Nivel {w.level || 1}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
            <span>⭐ {(w.rating?.avg || 0).toFixed(1)} ({w.rating?.count || 0})</span>
            <span>🎯 {w.stats?.shiftsCompleted || 0} turnos</span>
            {w.university && <span className="truncate">🎓 {w.university}</span>}
          </div>
        </div>
        <span className={`text-[11px] font-extrabold ${matchColor} tabular-nums`}>
          {app.matchScore}%
        </span>
      </div>

      {w.skills?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {w.skills.slice(0, 4).map((s) => (
            <span key={s.key} className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-full">
              {s.key} · {s.level}
            </span>
          ))}
        </div>
      )}

      {app.status === 'pending' ? (
        <div className="flex gap-2">
          <button
            onClick={onReject}
            className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >Rechazar</button>
          <button
            onClick={onAccept}
            className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] text-white text-xs font-extrabold shadow-sm transition active:scale-95"
          >Aceptar ✓</button>
        </div>
      ) : (
        <p className={`text-[11px] font-bold text-center py-2 rounded-lg ${
          app.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {app.status === 'accepted' ? '✓ Aceptado' : app.status === 'rejected' ? '✗ Rechazado' : app.status}
        </p>
      )}
    </div>
  );
}

function NewShiftForm({ onCreated, onCancel }) {
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

  const togglePerk = (p) => {
    setForm((f) => ({ ...f, perks: f.perks.includes(p) ? f.perks.filter(x => x !== p) : [...f.perks, p] }));
  };

  const submit = async () => {
    if (!form.title.trim()) return alert('Pon un título');
    setSaving(true);
    try {
      const a = api();
      const r = await fetch(`${a.base}/businesses/shifts`, {
        method: 'POST', headers: a.headers(), body: JSON.stringify(form),
      });
      if (!r.ok) {
        const e = await r.json();
        alert(e.message || 'Error');
        setSaving(false);
        return;
      }
      onCreated?.();
    } catch (e) {
      alert('Error al publicar');
    } finally {
      setSaving(false);
    }
  };

  const total = (form.hoursTotal || 0) * (form.hourlyRate || 0);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Título</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Mesero turno noche sábado"
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#7B2FFF]/50"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Rol</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {SKILLS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setForm({ ...form, role: s.key })}
              className={`p-2 rounded-lg text-[11px] font-bold transition ${
                form.role === s.key
                  ? 'bg-gradient-to-br from-[#7B2FFF]/15 to-[#FF6B35]/15 border border-[#7B2FFF]/30 text-slate-900'
                  : 'bg-slate-50 border border-slate-200 text-slate-500'
              }`}
            >
              <div className="text-[16px]">{s.emoji}</div>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Fecha</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#7B2FFF]/50"/>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Inicio</label>
          <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#7B2FFF]/50"/>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Fin</label>
          <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#7B2FFF]/50"/>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Horas</label>
          <input type="number" min={1} max={16} value={form.hoursTotal} onChange={(e) => setForm({ ...form, hoursTotal: Number(e.target.value) })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#7B2FFF]/50"/>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5"># Workers</label>
          <input type="number" min={1} max={20} value={form.workersNeeded} onChange={(e) => setForm({ ...form, workersNeeded: Number(e.target.value) })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#7B2FFF]/50"/>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">$/hora</label>
          <input type="number" min={5000} step={500} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#7B2FFF]/50"/>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Perks (opcional)</label>
        <div className="flex flex-wrap gap-1.5">
          {PERKS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePerk(p)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition ${
                form.perks.includes(p)
                  ? 'bg-gradient-to-r from-[#4CFFB8]/20 to-cyan-500/20 text-emerald-700 border border-emerald-300'
                  : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}
            >
              {p.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer">
        <input type="checkbox" checked={form.isSOS} onChange={(e) => setForm({ ...form, isSOS: e.target.checked })} />
        <div>
          <p className="text-[13px] font-bold text-red-700">🚨 Modo SOS</p>
          <p className="text-[11px] text-red-600">Aparece destacado y se envía push a workers cercanos</p>
        </div>
      </label>

      <div className="p-3.5 bg-gradient-to-r from-[#7B2FFF]/8 to-[#FF6B35]/8 border border-[#7B2FFF]/20 rounded-xl flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Total</p>
          <p className="text-[20px] font-extrabold text-slate-900 tabular-nums">{formatCOP(total)}</p>
        </div>
        <p className="text-[11px] text-slate-500 text-right">
          Comisión MenuBy<br/>
          <span className="font-extrabold text-slate-700 tabular-nums">{formatCOP(Math.round(total * 0.10))}</span>
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
        >Cancelar</button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] text-white font-extrabold text-sm shadow-md disabled:opacity-50 transition active:scale-95"
        >
          {saving ? 'Publicando…' : 'Publicar turno 🚀'}
        </button>
      </div>
    </div>
  );
}

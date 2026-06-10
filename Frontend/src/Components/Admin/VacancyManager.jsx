/**
 * VacancyManager — gestor de vacantes reutilizable para business y crew_employer.
 *
 * Estilo claro MenuBy (blanco/slate/red).
 *
 * Props:
 *   apiBase: '/api/crew/businesses' o '/api/crew/employers'
 *   authHeaders(): función que devuelve los headers de auth (Bearer accessToken para business, crew_employer_token para employer)
 *   bizQueryParam?: 'businessId=...' opcional (negocio MenuBy lo necesita en query)
 *   onBalanceChange?: callback tras publicar para refrescar wallet
 *
 * Sub-vistas:
 *   - list (mis vacantes)
 *   - publish (formulario con question builder)
 *   - candidates (postulantes de una vacante)
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

const SKILLS = [
  { key: 'mesero', label: 'Mesero', emoji: '🍽️' },
  { key: 'cocinero', label: 'Cocinero', emoji: '👨‍🍳' },
  { key: 'barista', label: 'Barista', emoji: '☕' },
  { key: 'bartender', label: 'Bartender', emoji: '🍸' },
  { key: 'cajero', label: 'Cajero', emoji: '💳' },
  { key: 'runner', label: 'Auxiliar', emoji: '🏃' },
  { key: 'host', label: 'Anfitrión', emoji: '🤝' },
  { key: 'lavaplatos', label: 'Lavaplatos', emoji: '🧽' },
  { key: 'parrillero', label: 'Parrillero', emoji: '🔥' },
  { key: 'panadero', label: 'Panadero', emoji: '🥐' },
  { key: 'reposteria', label: 'Repostería', emoji: '🍰' },
  { key: 'limpieza', label: 'Limpieza', emoji: '🧼' },
  { key: 'eventos', label: 'Eventos', emoji: '🎉' },
  { key: 'delivery', label: 'Domicilio', emoji: '🛵' },
];

const SCHEDULES = [
  { key: 'full_time', label: 'Tiempo completo' },
  { key: 'part_time', label: 'Medio tiempo' },
  { key: 'freelance', label: 'Freelance' },
  { key: 'flexible', label: 'Flexible' },
  { key: 'shift_based', label: 'Por turnos' },
];

const QUESTION_TYPES = [
  { key: 'text', label: 'Texto corto', emoji: '📝' },
  { key: 'longtext', label: 'Texto largo', emoji: '📄' },
  { key: 'choice', label: 'Opción única', emoji: '🔘' },
  { key: 'multichoice', label: 'Múltiples', emoji: '☑️' },
  { key: 'number', label: 'Número', emoji: '🔢' },
  { key: 'yes_no', label: 'Sí / No', emoji: '✓' },
];

const STATUS_TONES = {
  draft:    { label: 'Borrador',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  published:{ label: 'Activa',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  paused:   { label: 'Pausada',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed:   { label: 'Cerrada',    cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  expired:  { label: 'Expirada',   cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function VacancyManager({ apiBase, authHeaders, bizQueryParam, onBalanceChange }) {
  const [view, setView] = useState('list');
  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openVacancy, setOpenVacancy] = useState(null);
  const [fee, setFee] = useState(10000);

  const withParam = (path) => bizQueryParam ? `${path}${path.includes('?') ? '&' : '?'}${bizQueryParam}` : path;

  const loadFee = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase.replace(/\/(businesses|employers)$/, '')}/vacancies/quote`);
      const data = await r.json();
      if (data.success) setFee(data.fee);
    } catch {}
  }, [apiBase]);

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(withParam(`${apiBase}/vacancies`), { headers: authHeaders() });
      const data = await r.json();
      setVacancies(data.vacancies || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [apiBase, bizQueryParam]);

  useEffect(() => { loadVacancies(); loadFee(); }, [loadVacancies, loadFee]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200 w-fit">
        <SubTab active={view === 'list'} onClick={() => { setView('list'); setOpenVacancy(null); }}>📋 Mis vacantes</SubTab>
        <SubTab active={view === 'publish'} onClick={() => { setView('publish'); setOpenVacancy(null); }}>✨ Publicar nueva</SubTab>
      </div>

      <AnimatePresence mode="wait">
        {view === 'list' && !openVacancy && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {loading && <p className="text-[12px] text-slate-500 text-center py-6">Cargando…</p>}
            {!loading && vacancies.length === 0 && (
              <EmptyState
                title="Aún no has publicado vacantes"
                body={`Publicar una vacante cuesta ${formatCOP(fee)} fijos. Recibes postulaciones ilimitadas.`}
                cta={{ label: 'Publicar mi primera vacante', onClick: () => setView('publish') }}
              />
            )}
            {!loading && vacancies.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3">
                {vacancies.map((v) => (
                  <VacancyRowCard key={v._id} vacancy={v} onOpen={() => setOpenVacancy(v)} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {view === 'list' && openVacancy && (
          <motion.div key="candidates" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <CandidatesView
              vacancy={openVacancy}
              apiBase={apiBase}
              authHeaders={authHeaders}
              withParam={withParam}
              onBack={() => { setOpenVacancy(null); loadVacancies(); }}
              onLifecycleChange={() => { loadVacancies(); }}
            />
          </motion.div>
        )}

        {view === 'publish' && (
          <motion.div key="publish" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PublishForm
              apiBase={apiBase}
              authHeaders={authHeaders}
              withParam={withParam}
              fee={fee}
              onCreated={() => { setView('list'); loadVacancies(); onBalanceChange?.(); }}
              onCancel={() => setView('list')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── sub helpers ─── */

function SubTab({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`px-3.5 py-1.5 rounded-xl text-[12px] font-extrabold uppercase tracking-wider transition flex items-center gap-1.5 ${
      active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`}>
      {children}
    </button>
  );
}

function EmptyState({ title, body, cta }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center mb-3 text-xl">📋</div>
      <p className="text-[15px] font-black text-slate-900">{title}</p>
      <p className="text-[12px] text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">{body}</p>
      {cta && (
        <button onClick={cta.onClick} className="mt-5 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-extrabold shadow-md shadow-red-500/25 transition">
          {cta.label}
        </button>
      )}
    </div>
  );
}

function VacancyRowCard({ vacancy, onOpen }) {
  const tone = STATUS_TONES[vacancy.status] || STATUS_TONES.draft;
  return (
    <button onClick={onOpen} className="text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-black text-slate-900 truncate">{vacancy.title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{vacancy.role}</p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${tone.cls}`}>{tone.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <MiniBox label="Postulantes" value={vacancy.applicationCount || 0} />
        <MiniBox label="Vistas" value={vacancy.viewCount || 0} />
        <MiniBox label="Costo pagado" value={formatCOP(vacancy.pricePaid)} small />
      </div>
    </button>
  );
}

function MiniBox({ label, value, small }) {
  return (
    <div className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
      <p className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`font-black text-slate-900 tabular-nums truncate ${small ? 'text-[10.5px]' : 'text-[13px]'}`}>{value}</p>
    </div>
  );
}

/* ─── Publish form con question builder ─── */

function PublishForm({ apiBase, authHeaders, withParam, fee, onCreated, onCancel }) {
  const [form, setForm] = useState({
    title: '', role: 'mesero', description: '',
    schedule: 'full_time', hoursPerWeek: 0,
    responsibilities: [], benefits: [],
    requirements: { minExperienceYears: 0, languages: [], education: '', minLevel: 1, minRating: 0 },
    salary: { min: '', max: '', period: 'monthly', negotiable: false, hideFromCandidates: false },
    location: { city: '', neighborhood: '', address: '', isRemote: false, isHybrid: false },
    customQuestions: [],
    requireCv: false,
    applicationDeadline: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setNested = (k, sub, v) => setForm((f) => ({ ...f, [k]: { ...f[k], [sub]: v } }));

  const submit = async () => {
    setError(null);
    if (!form.title.trim()) return setError('El título es requerido');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        salary: {
          ...form.salary,
          min: form.salary.min ? Number(form.salary.min) : null,
          max: form.salary.max ? Number(form.salary.max) : null,
        },
        hoursPerWeek: form.hoursPerWeek ? Number(form.hoursPerWeek) : null,
        applicationDeadline: form.applicationDeadline || null,
      };

      const r = await fetch(withParam(`${apiBase}/vacancies`), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.code === 'INSUFFICIENT_FUNDS') {
          setError(`Saldo insuficiente. Necesitas ${formatCOP(data.required)} y tienes ${formatCOP(data.available)}. Recarga tu billetera antes de publicar.`);
        } else {
          setError(data.message || 'Error al publicar');
        }
        return;
      }
      onCreated?.(data.vacancy);
    } catch (e) {
      setError('Error de conexión');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-5">
      {/* Cost banner */}
      <div className="flex items-start gap-3 p-3 rounded-2xl bg-violet-50 border border-violet-200">
        <span className="text-xl">💼</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-extrabold text-violet-900">Publicar vacante: <span className="tabular-nums">{formatCOP(fee)}</span></p>
          <p className="text-[11px] text-violet-700 mt-0.5">Pago único. Postulaciones ilimitadas. Activa por 30 días.</p>
        </div>
      </div>

      {/* Title */}
      <Field label="Título de la vacante" required>
        <input value={form.title} onChange={(e) => setField('title', e.target.value)}
          placeholder="Ej: Mesero permanente para nuestro restaurante"
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[14px] text-slate-800 focus:outline-none focus:border-red-400 focus:bg-white" />
      </Field>

      {/* Role */}
      <Field label="Cargo">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {SKILLS.map((s) => (
            <button key={s.key} type="button" onClick={() => setField('role', s.key)}
              className={`py-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                form.role === s.key ? 'bg-red-500 text-white border border-red-500' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}>
              <span>{s.emoji}</span>{s.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Description */}
      <Field label="Descripción del puesto">
        <textarea value={form.description} onChange={(e) => setField('description', e.target.value.slice(0, 4000))}
          rows={4} placeholder="Cuéntale a los candidatos sobre el rol, el equipo, el ambiente…"
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-red-400 focus:bg-white resize-none" />
        <p className="text-[10px] text-slate-400 mt-1 text-right">{form.description.length} / 4000</p>
      </Field>

      {/* Schedule + hours */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Horario">
          <select value={form.schedule} onChange={(e) => setField('schedule', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-red-400">
            {SCHEDULES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Horas / semana (opcional)">
          <input type="number" min={0} max={80} value={form.hoursPerWeek}
            onChange={(e) => setField('hoursPerWeek', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 tabular-nums focus:outline-none focus:border-red-400" />
        </Field>
      </div>

      {/* Salary */}
      <div>
        <label className="block text-[10.5px] font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">Salario</label>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input type="number" placeholder="Mínimo" value={form.salary.min}
            onChange={(e) => setNested('salary', 'min', e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 tabular-nums focus:outline-none focus:border-red-400" />
          <input type="number" placeholder="Máximo" value={form.salary.max}
            onChange={(e) => setNested('salary', 'max', e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 tabular-nums focus:outline-none focus:border-red-400" />
          <select value={form.salary.period} onChange={(e) => setNested('salary', 'period', e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-red-400">
            <option value="hourly">por hora</option>
            <option value="monthly">por mes</option>
            <option value="yearly">por año</option>
            <option value="per_project">por proyecto</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 text-[11.5px] text-slate-600">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={form.salary.negotiable} onChange={(e) => setNested('salary', 'negotiable', e.target.checked)} className="accent-red-500" />
            Negociable
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={form.salary.hideFromCandidates} onChange={(e) => setNested('salary', 'hideFromCandidates', e.target.checked)} className="accent-red-500" />
            Ocultar a candidatos (mostrar como "A convenir")
          </label>
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-[10.5px] font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">Ubicación</label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input placeholder="Ciudad" value={form.location.city} onChange={(e) => setNested('location', 'city', e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-red-400" />
          <input placeholder="Barrio" value={form.location.neighborhood} onChange={(e) => setNested('location', 'neighborhood', e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-red-400" />
        </div>
        <input placeholder="Dirección completa (opcional)" value={form.location.address} onChange={(e) => setNested('location', 'address', e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] mb-2 focus:outline-none focus:border-red-400" />
        <div className="flex flex-wrap gap-3 text-[11.5px] text-slate-600">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={form.location.isRemote} onChange={(e) => setNested('location', 'isRemote', e.target.checked)} className="accent-red-500" />
            🏠 Remoto
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={form.location.isHybrid} onChange={(e) => setNested('location', 'isHybrid', e.target.checked)} className="accent-red-500" />
            🔀 Híbrido
          </label>
        </div>
      </div>

      {/* List builder helpers */}
      <ListBuilder label="Responsabilidades" placeholder="Ej: Atender a los comensales con amabilidad"
        items={form.responsibilities} onChange={(items) => setField('responsibilities', items)} max={20} />

      <ListBuilder label="Beneficios" placeholder="Ej: Almuerzo incluido"
        items={form.benefits} onChange={(items) => setField('benefits', items)} max={15} />

      {/* Requirements */}
      <div>
        <label className="block text-[10.5px] font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">Requisitos</label>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Experiencia mínima (años)" small>
            <input type="number" min={0} max={50} value={form.requirements.minExperienceYears}
              onChange={(e) => setNested('requirements', 'minExperienceYears', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[12.5px] tabular-nums focus:outline-none focus:border-red-400" />
          </Field>
          <Field label="Educación" small>
            <input value={form.requirements.education}
              placeholder="Bachiller / Técnico / Profesional"
              onChange={(e) => setNested('requirements', 'education', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[12.5px] focus:outline-none focus:border-red-400" />
          </Field>
        </div>
      </div>

      {/* Custom question builder */}
      <QuestionBuilder
        questions={form.customQuestions}
        onChange={(qs) => setField('customQuestions', qs)}
      />

      {/* Misc */}
      <div className="flex flex-wrap gap-3 text-[11.5px] text-slate-600">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.requireCv} onChange={(e) => setField('requireCv', e.target.checked)} className="accent-red-500" />
          Exigir que suban hoja de vida (PDF)
        </label>
      </div>

      <Field label="Fecha límite de postulación (opcional)" small>
        <input type="date" value={form.applicationDeadline} onChange={(e) => setField('applicationDeadline', e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-red-400" />
      </Field>

      {error && (
        <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[12px] text-rose-700">{error}</div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} disabled={submitting}
          className="px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-[13px] font-bold">
          Cancelar
        </button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={submitting}
          className="flex-1 px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[13px] font-extrabold shadow-md shadow-violet-500/25 disabled:opacity-50">
          {submitting ? 'Publicando…' : `Publicar y cobrar ${formatCOP(fee)}`}
        </motion.button>
      </div>
    </div>
  );
}

function Field({ label, hint, required, small, children }) {
  return (
    <div>
      <label className={`block font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-1.5 ${small ? 'text-[9.5px]' : 'text-[10.5px]'}`}>
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {hint && <p className="text-[10.5px] text-slate-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function ListBuilder({ label, placeholder, items, onChange, max = 20 }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    if (items.length >= max) return;
    onChange([...items, draft.trim()]);
    setDraft('');
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="block text-[10.5px] font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">{label} <span className="text-slate-400 normal-case font-medium">({items.length}/{max})</span></label>
      <div className="space-y-1.5 mb-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="flex-1 text-[12.5px] text-slate-700">{item}</span>
            <button onClick={() => remove(i)} className="text-slate-400 hover:text-rose-500 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-[13px] focus:outline-none focus:border-red-400" />
        <button onClick={add} disabled={!draft.trim() || items.length >= max}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-extrabold disabled:opacity-40 transition">
          + Agregar
        </button>
      </div>
    </div>
  );
}

function QuestionBuilder({ questions, onChange }) {
  const addQuestion = () => {
    if (questions.length >= 15) return;
    onChange([...questions, { question: '', type: 'text', options: [], required: false, helpText: '' }]);
  };
  const updateQuestion = (i, patch) => {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const removeQuestion = (i) => onChange(questions.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10.5px] font-extrabold uppercase tracking-[0.15em] text-slate-500">
          Formulario personalizado <span className="text-slate-400 normal-case font-medium">({questions.length}/15)</span>
        </label>
        <button onClick={addQuestion} disabled={questions.length >= 15}
          className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full bg-violet-100 hover:bg-violet-200 text-violet-700 border border-violet-200 disabled:opacity-40 transition">
          + Pregunta
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
        Las preguntas que agregues serán parte del formulario que el postulante debe responder.
      </p>

      <div className="space-y-2">
        {questions.length === 0 && (
          <div className="text-center py-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300">
            <p className="text-[12px] text-slate-500">Aún no hay preguntas. Toca "+ Pregunta" para empezar.</p>
          </div>
        )}
        {questions.map((q, i) => (
          <QuestionEditor key={i} index={i} question={q}
            onChange={(patch) => updateQuestion(i, patch)}
            onRemove={() => removeQuestion(i)} />
        ))}
      </div>
    </div>
  );
}

function QuestionEditor({ index, question, onChange, onRemove }) {
  const needsOptions = ['choice', 'multichoice'].includes(question.type);
  const [optDraft, setOptDraft] = useState('');

  const addOption = () => {
    if (!optDraft.trim()) return;
    onChange({ options: [...(question.options || []), optDraft.trim()] });
    setOptDraft('');
  };
  const removeOption = (i) => onChange({ options: (question.options || []).filter((_, idx) => idx !== i) });

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Pregunta {index + 1}</span>
        <button onClick={onRemove} className="text-rose-500 hover:text-rose-600 text-[10.5px] font-extrabold uppercase tracking-wider">
          Eliminar
        </button>
      </div>

      <input value={question.question} onChange={(e) => onChange({ question: e.target.value })}
        placeholder="Escribe tu pregunta…"
        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[13px] mb-2 focus:outline-none focus:border-violet-400" />

      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {QUESTION_TYPES.map((t) => {
          const active = question.type === t.key;
          return (
            <button key={t.key} onClick={() => onChange({ type: t.key, options: ['choice', 'multichoice'].includes(t.key) ? (question.options || []) : [] })}
              className={`py-2 rounded-lg text-[10.5px] font-bold border transition flex items-center justify-center gap-1 ${
                active ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-slate-600 border-slate-200'
              }`}>
              <span>{t.emoji}</span>{t.label}
            </button>
          );
        })}
      </div>

      {needsOptions && (
        <div className="mb-2 p-3 rounded-xl bg-white border border-slate-200">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Opciones</p>
          <div className="space-y-1.5 mb-2">
            {(question.options || []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="flex-1 text-[12px] text-slate-700">{opt}</span>
                <button onClick={() => removeOption(i)} className="text-slate-400 hover:text-rose-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={optDraft} onChange={(e) => setOptDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
              placeholder="Agregar opción…"
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[12px] focus:outline-none focus:border-violet-400" />
            <button onClick={addOption} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-extrabold">+</button>
          </div>
        </div>
      )}

      <input value={question.helpText || ''} onChange={(e) => onChange({ helpText: e.target.value })}
        placeholder="Ayuda al postulante (opcional)"
        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-[12px] mb-2 focus:outline-none focus:border-violet-400" />

      <label className="flex items-center gap-2 text-[11.5px] text-slate-600 cursor-pointer">
        <input type="checkbox" checked={!!question.required} onChange={(e) => onChange({ required: e.target.checked })} className="accent-violet-500" />
        Esta pregunta es obligatoria
      </label>
    </div>
  );
}

/* ─── Candidates view ─── */

const CANDIDATE_TABS = [
  { key: 'pending', label: 'Nuevos' },
  { key: 'shortlisted', label: 'Preseleccionados' },
  { key: 'interviewing', label: 'En entrevista' },
  { key: 'hired', label: 'Contratados' },
  { key: 'rejected', label: 'Descartados' },
];

function CandidatesView({ vacancy, apiBase, authHeaders, withParam, onBack, onLifecycleChange }) {
  const [status, setStatus] = useState('pending');
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(withParam(`${apiBase}/vacancies/${vacancy._id}/applications?status=${status}`), { headers: authHeaders() });
      const data = await r.json();
      setApps(data.applications || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [vacancy._id, status]);

  useEffect(() => { load(); }, [load]);

  const decide = async (appId, action) => {
    try {
      await fetch(withParam(`${apiBase}/vacancy-applications/${appId}/${action}`), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({}),
      });
      load();
    } catch (e) {
      alert('Error al procesar');
    }
  };

  const lifecycle = async (action) => {
    try {
      await fetch(withParam(`${apiBase}/vacancies/${vacancy._id}/${action}`), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({}),
      });
      onLifecycleChange?.();
      onBack();
    } catch (e) {
      alert('Error');
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <button onClick={onBack} className="mb-3 text-[12px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Volver
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-[18px] font-black text-slate-900">{vacancy.title}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {vacancy.applicationCount || 0} postulantes · {STATUS_TONES[vacancy.status]?.label}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {vacancy.status === 'published' && (
            <button onClick={() => lifecycle('pause')} className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-extrabold border border-amber-200">Pausar</button>
          )}
          {vacancy.status === 'paused' && (
            <button onClick={() => lifecycle('resume')} className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-extrabold border border-emerald-200">Reactivar</button>
          )}
          {['published', 'paused', 'draft'].includes(vacancy.status) && (
            <button onClick={() => lifecycle('close')} className="px-2.5 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-extrabold border border-rose-200">Cerrar</button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1 mb-4 rounded-xl bg-slate-100 border border-slate-200 w-fit overflow-x-auto">
        {CANDIDATE_TABS.map((t) => (
          <button key={t.key} onClick={() => setStatus(t.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition whitespace-nowrap ${
              status === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {loading && <p className="text-[12px] text-slate-500 text-center py-6">Cargando…</p>}
      {!loading && apps.length === 0 && (
        <p className="text-[12px] text-slate-400 text-center py-8">No hay postulantes en este estado.</p>
      )}

      <div className="space-y-2.5">
        {apps.map((a) => (
          <CandidateCard key={a._id} app={a} onDecide={decide} currentStatus={status} />
        ))}
      </div>
    </div>
  );
}

function CandidateCard({ app, onDecide, currentStatus }) {
  const w = app.workerId || {};
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full p-3.5 text-left hover:bg-slate-50 transition">
        <div className="flex items-start gap-3 mb-2">
          {w.photo ? (
            <img src={w.photo} alt={w.name} className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-white text-[16px] font-black">
              {(w.name || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-black text-slate-900 truncate">{w.name || 'Postulante'}</p>
            <p className="text-[11px] text-slate-500">Nivel {w.level || 1} · {(w.rating?.avg || 0).toFixed(1)}★ · {w.stats?.shiftsCompleted || 0} turnos</p>
            {w.university && <p className="text-[11px] text-slate-400 truncate">{w.university}</p>}
          </div>
        </div>
        {app.coverLetter && !open && (
          <p className="text-[12px] text-slate-600 line-clamp-2 mt-1">{app.coverLetter}</p>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3.5 pb-3.5 border-t border-slate-100 space-y-3">
              {app.coverLetter && (
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Mensaje</p>
                  <p className="text-[12.5px] text-slate-700 leading-relaxed whitespace-pre-line">{app.coverLetter}</p>
                </div>
              )}
              {app.answers?.length > 0 && (
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">Respuestas</p>
                  <div className="space-y-2">
                    {app.answers.map((a, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-[11px] font-bold text-slate-500">{a.question}</p>
                        <p className="text-[12.5px] text-slate-800 mt-0.5">{Array.isArray(a.value) ? a.value.join(', ') : String(a.value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {w.bio && (
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Bio</p>
                  <p className="text-[12px] text-slate-600 leading-relaxed">{w.bio}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="px-3.5 py-2.5 border-t border-slate-100 flex gap-1.5 flex-wrap">
        {currentStatus === 'pending' && (
          <>
            <button onClick={() => onDecide(app._id, 'shortlisted')} className="flex-1 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[11px] font-extrabold">Preseleccionar</button>
            <button onClick={() => onDecide(app._id, 'rejected')} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold">Descartar</button>
          </>
        )}
        {currentStatus === 'shortlisted' && (
          <>
            <button onClick={() => onDecide(app._id, 'interviewing')} className="flex-1 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-extrabold">Citar a entrevista</button>
            <button onClick={() => onDecide(app._id, 'rejected')} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold">Descartar</button>
          </>
        )}
        {currentStatus === 'interviewing' && (
          <>
            <button onClick={() => onDecide(app._id, 'hired')} className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-extrabold">¡Contratado!</button>
            <button onClick={() => onDecide(app._id, 'rejected')} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold">Descartar</button>
          </>
        )}
        {currentStatus === 'hired' && (
          <p className="flex-1 text-[11px] font-extrabold text-center py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Contratado</p>
        )}
        {currentStatus === 'rejected' && (
          <button onClick={() => onDecide(app._id, 'shortlisted')} className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold">Reconsiderar</button>
        )}
      </div>
    </div>
  );
}

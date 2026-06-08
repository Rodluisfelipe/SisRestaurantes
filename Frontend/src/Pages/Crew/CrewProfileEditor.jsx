/**
 * CrewProfileEditor — pantalla completa de edición del perfil.
 * Foto, bio, cédula, experiencias, educación, referencias, KYC.
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import { useCrew } from './useCrew';
import { crewToast } from './components/crewToast';

const RELATIONS = ['Ex jefe', 'Ex compañero', 'Profesor', 'Cliente', 'Mentor', 'Familiar'];

export default function CrewProfileEditor({ onBack }) {
  const { worker, refreshMe } = useCrew();
  const [section, setSection] = useState('basic'); // basic | experience | education | references | kyc

  if (!worker) return null;

  return (
    <div className="min-h-[100dvh] bg-[#0a0a14] text-white font-geist pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <header className="sticky top-0 z-20 bg-[#0a0a14]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-md mx-auto px-5 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 flex items-center gap-2">
          <button onClick={onBack} className="text-white/50 hover:text-white transition" aria-label="Atrás">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-[16px] font-extrabold text-white">Mi perfil profesional</h1>
        </div>
        <div className="max-w-md mx-auto px-5 pb-3 flex gap-1.5 overflow-x-auto">
          {[
            { id: 'basic', label: 'Básicos' },
            { id: 'experience', label: 'Experiencia' },
            { id: 'education', label: 'Educación' },
            { id: 'references', label: 'Referencias' },
            { id: 'kyc', label: 'Verificación' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${
                section === s.id ? 'bg-red-500 text-white shadow-[0_4px_16px_-4px_rgba(239,68,68,0.4)]' : 'bg-white/[0.06] text-white/50 border border-white/[0.08]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {section === 'basic' && <BasicEditor worker={worker} refreshMe={refreshMe} />}
            {section === 'experience' && <ExperienceEditor worker={worker} refreshMe={refreshMe} />}
            {section === 'education' && <EducationEditor worker={worker} refreshMe={refreshMe} />}
            {section === 'references' && <ReferencesEditor worker={worker} refreshMe={refreshMe} />}
            {section === 'kyc' && <KycSection worker={worker} refreshMe={refreshMe} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ─── BASIC: foto + bio + universidad ─── */
function BasicEditor({ worker, refreshMe }) {
  const [bio, setBio] = useState(worker.bio || '');
  const [university, setUniversity] = useState(worker.university || '');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setSaving(true);
    try {
      const { data } = await crewApi.post('/workers/me/photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshMe();
      crewToast.success('Foto actualizada');
    } catch (err) {
      crewToast.error(err?.response?.data?.message || 'Error al subir foto');
    } finally { setSaving(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await crewApi.put('/workers/me', { bio, university });
      await refreshMe();
      crewToast.success('Perfil actualizado');
    } catch (err) {
      crewToast.error(err?.response?.data?.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Foto */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 flex items-center gap-4">
        <div className="relative shrink-0">
          {worker.photo ? (
            <img src={worker.photo} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-white/[0.10]" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/[0.06] border-2 border-white/[0.10] flex items-center justify-center text-[28px] font-extrabold text-white/40">
              {(worker.name || '?').slice(0,1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-white/90 mb-1">Foto de perfil</p>
          <p className="text-[11px] text-white/40 mb-2 leading-relaxed">
            Una buena foto duplica tus posibilidades de ser contratado.
          </p>
          <input ref={fileInput} type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[12px] font-bold disabled:opacity-50 transition"
          >
            {worker.photo ? 'Cambiar' : 'Subir foto'}
          </button>
        </div>
      </div>

      {/* Bio */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
          Sobre ti
          <span className="text-[10px] text-white/30 normal-case font-normal ml-2">{bio.length}/400</span>
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 400))}
          placeholder="Cuenta brevemente quién eres, qué experiencia tienes y qué buscas. Esto lo verá el dueño del restaurante."
          rows={4}
          className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-red-500 focus:bg-white/[0.06] transition resize-none"
        />
        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 mt-4">
          Universidad o institución (opcional)
        </label>
        <input
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
          placeholder="Universidad Nacional, SENA, etc."
          className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] focus:outline-none focus:border-red-500 focus:bg-white/[0.06] transition"
        />
        <button
          onClick={save}
          disabled={saving}
          className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-[13px] shadow-md shadow-red-500/25 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

/* ─── EXPERIENCIA ─── */
function ExperienceEditor({ worker, refreshMe }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ company: '', role: '', startDate: '', endDate: '', description: '', city: '', isCurrent: false });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.company || !form.role || !form.startDate) {
      crewToast.error('Empresa, cargo y fecha de inicio son requeridos');
      return;
    }
    setSaving(true);
    try {
      await crewApi.post('/workers/me/experiences', {
        ...form, endDate: form.isCurrent ? null : form.endDate || null,
      });
      await refreshMe();
      setAdding(false);
      setForm({ company: '', role: '', startDate: '', endDate: '', description: '', city: '', isCurrent: false });
      crewToast.success('Experiencia agregada');
    } catch (e) {
      crewToast.error(e?.response?.data?.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const removeExp = async (id) => {
    if (!confirm('¿Eliminar esta experiencia?')) return;
    try {
      await crewApi.delete(`/workers/me/experiences/${id}`);
      await refreshMe();
      crewToast.success('Eliminada');
    } catch { crewToast.error('Error al eliminar'); }
  };

  const exps = worker.experiences || [];

  return (
    <div className="space-y-3">
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-white/[0.12] hover:border-red-500/40 hover:bg-red-500/[0.06] text-white/50 hover:text-red-400 font-bold text-[13px] transition flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Agregar experiencia
        </button>
      )}

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white/[0.04] border border-red-500/30 rounded-2xl p-4 space-y-3"
          >
            <Input label="Empresa o restaurante" value={form.company} onChange={(v) => setForm({ ...form, company: v })} placeholder="Bogotá Beer Company" />
            <Input label="Cargo" value={form.role} onChange={(v) => setForm({ ...form, role: v })} placeholder="Mesero principal" />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Fecha inicio" type="month" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
              <Input label="Fecha fin" type="month" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} disabled={form.isCurrent} />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-white/70">
              <input type="checkbox" checked={form.isCurrent} onChange={(e) => setForm({ ...form, isCurrent: e.target.checked, endDate: '' })} className="accent-red-600" />
              Actualmente trabajo aquí
            </label>
            <Input label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="Bogotá" />
            <div>
              <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">Descripción (opcional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 400) })}
                rows={2}
                placeholder="Atendía 5 mesas en simultáneo, manejo de POS, propinas..."
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] resize-none focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/70 font-bold text-[12px]">Cancelar</button>
              <button onClick={submit} disabled={saving} className="flex-[2] py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[12px] disabled:opacity-50">
                {saving ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {exps.length === 0 && !adding && (
        <div className="text-center py-10 text-[12px] text-white/40">Aún no has agregado experiencia laboral</div>
      )}
      {exps.map((e) => (
        <ExperienceCard key={e._id} exp={e} onDelete={() => removeExp(e._id)} />
      ))}
    </div>
  );
}

function ExperienceCard({ exp, onDelete }) {
  const start = new Date(exp.startDate).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
  const end = exp.endDate ? new Date(exp.endDate).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) : 'Actual';
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold text-white">{exp.role}</p>
          <p className="text-[12px] text-white/50">{exp.company}{exp.city && ` · ${exp.city}`}</p>
          <p className="text-[11px] text-white/30 mt-1">{start} — {end}</p>
        </div>
        <button onClick={onDelete} className="text-white/30 hover:text-red-600 transition shrink-0" aria-label="Eliminar">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22"/></svg>
        </button>
      </div>
      {exp.description && <p className="text-[12px] text-white/70 mt-2 leading-relaxed">{exp.description}</p>}
    </motion.div>
  );
}

/* ─── EDUCACIÓN ─── */
function EducationEditor({ worker, refreshMe }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '', isCurrent: false });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.institution) return crewToast.error('Institución requerida');
    setSaving(true);
    try {
      await crewApi.post('/workers/me/education', {
        ...form,
        startYear: form.startYear ? Number(form.startYear) : null,
        endYear: form.isCurrent ? null : (form.endYear ? Number(form.endYear) : null),
      });
      await refreshMe();
      setAdding(false);
      setForm({ institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '', isCurrent: false });
      crewToast.success('Educación agregada');
    } catch (e) { crewToast.error(e?.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const removeEdu = async (id) => {
    if (!confirm('¿Eliminar?')) return;
    try {
      await crewApi.delete(`/workers/me/education/${id}`);
      await refreshMe();
    } catch { crewToast.error('Error'); }
  };

  const edus = worker.education || [];

  return (
    <div className="space-y-3">
      {!adding && (
        <button onClick={() => setAdding(true)} className="w-full py-3 rounded-2xl border-2 border-dashed border-white/[0.12] hover:border-red-500/40 hover:bg-red-500/[0.06] text-white/50 hover:text-red-400 font-bold text-[13px] transition flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Agregar educación
        </button>
      )}
      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-white/[0.04] border border-red-500/30 rounded-2xl p-4 space-y-3">
            <Input label="Institución" value={form.institution} onChange={(v) => setForm({ ...form, institution: v })} placeholder="Universidad de los Andes" />
            <Input label="Título / Programa" value={form.degree} onChange={(v) => setForm({ ...form, degree: v })} placeholder="Administración de empresas" />
            <Input label="Área (opcional)" value={form.fieldOfStudy} onChange={(v) => setForm({ ...form, fieldOfStudy: v })} placeholder="Gastronomía" />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Año inicio" type="number" value={form.startYear} onChange={(v) => setForm({ ...form, startYear: v })} placeholder="2020" />
              <Input label="Año fin" type="number" value={form.endYear} onChange={(v) => setForm({ ...form, endYear: v })} placeholder="2024" disabled={form.isCurrent} />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-white/70">
              <input type="checkbox" checked={form.isCurrent} onChange={(e) => setForm({ ...form, isCurrent: e.target.checked, endYear: '' })} className="accent-red-600" />
              Aún estoy estudiando
            </label>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-lg bg-white/[0.06] text-white/70 font-bold text-[12px]">Cancelar</button>
              <button onClick={submit} disabled={saving} className="flex-[2] py-2 rounded-lg bg-red-600 text-white font-bold text-[12px] disabled:opacity-50">{saving ? 'Guardando…' : 'Agregar'}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {edus.length === 0 && !adding && <div className="text-center py-10 text-[12px] text-white/40">Aún no has agregado educación</div>}
      {edus.map((e) => (
        <motion.div key={e._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-extrabold">{e.degree || 'Estudios'}</p>
            <p className="text-[12px] text-white/50">{e.institution}</p>
            <p className="text-[11px] text-white/30 mt-1">{e.startYear || '—'} — {e.isCurrent ? 'En curso' : e.endYear || '—'}</p>
          </div>
          <button onClick={() => removeEdu(e._id)} className="text-white/30 hover:text-red-600 transition shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22"/></svg>
          </button>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── REFERENCIAS ─── */
function ReferencesEditor({ worker, refreshMe }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', relation: 'Ex jefe', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name || !form.relation) return crewToast.error('Nombre y relación requeridos');
    setSaving(true);
    try {
      await crewApi.post('/workers/me/references', form);
      await refreshMe();
      setAdding(false);
      setForm({ name: '', relation: 'Ex jefe', phone: '', email: '' });
      crewToast.success('Referencia agregada');
    } catch (e) { crewToast.error(e?.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const refs = worker.references || [];

  return (
    <div className="space-y-3">
      {!adding && (
        <button onClick={() => setAdding(true)} className="w-full py-3 rounded-2xl border-2 border-dashed border-white/[0.12] hover:border-red-500/40 hover:bg-red-500/[0.06] text-white/50 hover:text-red-400 font-bold text-[13px] transition flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Agregar referencia
        </button>
      )}
      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white/[0.04] border border-red-500/30 rounded-2xl p-4 space-y-3">
            <Input label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <div>
              <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">Relación</label>
              <select value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px]">
                {RELATIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <Input label="Teléfono" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-lg bg-white/[0.06] text-white/70 font-bold text-[12px]">Cancelar</button>
              <button onClick={submit} disabled={saving} className="flex-[2] py-2 rounded-lg bg-red-600 text-white font-bold text-[12px] disabled:opacity-50">{saving ? 'Guardando…' : 'Agregar'}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {refs.length === 0 && !adding && <div className="text-center py-10 text-[12px] text-white/40">Aún no has agregado referencias</div>}
      {refs.map((r) => (
        <motion.div key={r._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
          <p className="text-[14px] font-extrabold">{r.name}</p>
          <p className="text-[11px] text-white/40 mb-1">{r.relation}</p>
          {r.phone && <p className="text-[12px] text-white/70">📞 {r.phone}</p>}
          {r.email && <p className="text-[12px] text-white/70">✉️ {r.email}</p>}
        </motion.div>
      ))}
    </div>
  );
}

/* ─── KYC ─── */
function KycSection({ worker, refreshMe }) {
  const kyc = worker.kyc || {};
  const [cedulaNumber, setCedulaNumber] = useState(worker.cedula || '');
  const [files, setFiles] = useState({ cedulaFront: null, cedulaBack: null, selfie: null });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!cedulaNumber.trim()) return crewToast.error('Ingresa tu número de cédula');
    if (!files.cedulaFront || !files.cedulaBack || !files.selfie) {
      return crewToast.error('Sube las 3 imágenes');
    }
    const fd = new FormData();
    fd.append('cedulaNumber', cedulaNumber.trim());
    fd.append('cedulaFront', files.cedulaFront);
    fd.append('cedulaBack', files.cedulaBack);
    fd.append('selfie', files.selfie);
    setSubmitting(true);
    try {
      await crewApi.post('/workers/me/kyc/submit', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshMe();
      crewToast.success('Documentos enviados. Te notificaremos cuando se aprueben (24-48h).');
    } catch (e) {
      crewToast.error(e?.response?.data?.message || 'Error al enviar');
    } finally { setSubmitting(false); }
  };

  if (kyc.status === 'pending') {
    return (
      <div className="rounded-2xl border border-white/[0.10] bg-white/[0.04] p-5 text-center">
        <p className="text-[40px] mb-2">⏳</p>
        <p className="text-[14px] font-extrabold text-white">Tus documentos están en revisión</p>
        <p className="text-[12px] text-white/50 mt-1">Te avisaremos en 24-48 horas. Enviados el {new Date(kyc.submittedAt).toLocaleDateString('es-CO')}.</p>
      </div>
    );
  }

  if (kyc.status === 'approved') {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5 text-center">
        <p className="text-[40px] mb-2">✓</p>
        <p className="text-[14px] font-extrabold text-white">Cuenta verificada</p>
        <p className="text-[12px] text-white/50 mt-1">Tu cédula fue verificada el {new Date(kyc.reviewedAt).toLocaleDateString('es-CO')}. Tienes acceso completo a todos los turnos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {kyc.status === 'rejected' && kyc.rejectionReason && (
        <div className="bg-red-500/[0.08] border border-red-500/30 rounded-xl p-4">
          <p className="text-[13px] font-bold text-red-300">Tu envío anterior fue rechazado</p>
          <p className="text-[12px] text-red-300/70 mt-1">{kyc.rejectionReason}</p>
          <p className="text-[11px] text-red-300/50 mt-2">Por favor vuelve a enviar las imágenes corregidas.</p>
        </div>
      )}

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <p className="text-[14px] font-extrabold text-white mb-1">Verifica tu identidad</p>
        <p className="text-[12px] text-white/50 leading-relaxed mb-4">
          Necesitamos validar quién eres antes de que puedas acceder a turnos premium. Tus datos son privados.
        </p>

        <Input label="Número de cédula" value={cedulaNumber} onChange={setCedulaNumber} placeholder="1234567890" />

        <div className="mt-4 space-y-3">
          <FilePicker label="Cédula — frente" file={files.cedulaFront} onChange={(f) => setFiles({ ...files, cedulaFront: f })} />
          <FilePicker label="Cédula — reverso" file={files.cedulaBack} onChange={(f) => setFiles({ ...files, cedulaBack: f })} />
          <FilePicker label="Selfie sosteniendo la cédula" file={files.selfie} onChange={(f) => setFiles({ ...files, selfie: f })} subtitle="Tu rostro y la cédula deben verse claramente en la misma foto" />
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-extrabold text-[14px] shadow-md shadow-red-500/25 disabled:opacity-50"
        >
          {submitting ? 'Enviando…' : 'Enviar para verificación'}
        </button>

        <p className="text-[10px] text-white/30 mt-3 leading-relaxed text-center">
          Tus imágenes se almacenan cifradas y solo el equipo de revisión de MenuBy las verá. Nunca se comparten con negocios.
        </p>
      </div>
    </div>
  );
}

function FilePicker({ label, file, onChange, subtitle }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(null);
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onChange(f);
    setPreview(URL.createObjectURL(f));
  };
  return (
    <div>
      <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">{label}</p>
      {subtitle && <p className="text-[10px] text-white/40 mb-2">{subtitle}</p>}
      {/* Sin `capture` → el navegador muestra galería + cámara */}
      <input ref={ref} type="file" accept="image/*" onChange={onFile} className="hidden" />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`w-full p-3 rounded-xl border-2 border-dashed flex items-center gap-3 transition ${
          file ? 'bg-red-500/[0.06] border-red-500/30' : 'bg-white/[0.04] border-white/[0.12] hover:border-red-500/40 hover:bg-red-500/[0.06]'
        }`}
      >
        {preview ? (
          <img src={preview} alt="" className="w-12 h-12 rounded-lg object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-white/30">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
        )}
        <div className="flex-1 text-left">
          <p className={`text-[12px] font-bold ${file ? 'text-red-400' : 'text-white/70'}`}>
            {file ? '✓ Imagen seleccionada' : 'Tocar para subir'}
          </p>
          <p className="text-[10px] text-white/40">{file ? file.name : 'Desde galería o cámara · JPG, PNG o WebP · máx 8MB'}</p>
        </div>
      </button>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type} value={value || ''} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-red-500 focus:bg-white/[0.06] transition disabled:opacity-50"
      />
    </div>
  );
}

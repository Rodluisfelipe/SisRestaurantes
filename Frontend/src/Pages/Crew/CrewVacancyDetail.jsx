/**
 * CrewVacancyDetail — vista full-screen del detalle de una vacante + form de postulación.
 * Cosmic dark, mismo lenguaje que CrewShiftDetail.
 *
 * Flujo:
 *   1. Mostrar todo el detalle (descripción, requisitos, beneficios, etc)
 *   2. Si el worker no ha postulado: mostrar CTA "Postularme"
 *   3. Al tocar CTA: pasar a vista de formulario (cover letter + answers + opcional CV)
 *   4. Al enviar: confirmar y volver
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import { crewToast } from './components/crewToast';
import { cannon } from './components/confettiBurst';

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

const SCHEDULE_LABEL = {
  full_time: 'Tiempo completo',
  part_time: 'Medio tiempo',
  freelance: 'Freelance',
  flexible: 'Horario flexible',
  shift_based: 'Por turnos',
};

const SALARY_PERIOD_LABEL = {
  hourly: '/hora', monthly: '/mes', yearly: '/año', per_project: '/proyecto',
};

export default function CrewVacancyDetail({ vacancyId, onBack, onApplied }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('detail'); // 'detail' | 'apply'
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    crewApi.get(`/vacancies/${vacancyId}`)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.message || 'Error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [vacancyId]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a14] text-white font-geist flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (error || !data?.vacancy) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a14] text-white font-geist flex flex-col items-center justify-center p-8">
        <p className="text-[14px] text-rose-300 font-bold mb-3">{error || 'No se encontró la vacante'}</p>
        <button onClick={onBack} className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/70 font-bold text-[13px]">Volver</button>
      </div>
    );
  }

  const v = data.vacancy;
  const owner = v.ownerDisplay || {};
  const alreadyApplied = !!data.myApplication;

  return (
    <div className="min-h-[100dvh] bg-[#0a0a14] text-white font-geist pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a14]/85 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 flex items-center gap-3">
          <button onClick={() => view === 'apply' ? setView('detail') : onBack()} className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-white/70 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">{view === 'detail' ? 'Vacante' : 'Postularme'}</p>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {view === 'detail' && (
          <motion.div key="detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {/* Cover hero */}
            <div className="relative h-44 bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-orange-500/15 overflow-hidden">
              {owner.coverImage && (
                <img src={owner.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a14] via-transparent to-transparent" />
            </div>

            <main className="max-w-md mx-auto px-5 -mt-12 relative space-y-4">
              {/* Owner card */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.10] backdrop-blur-md">
                {owner.logo ? (
                  <img src={owner.logo} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/20 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-[16px] font-black text-white shrink-0">
                    {(owner.name || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black truncate">{owner.name || 'Empleador'}</p>
                  {owner.verified && (
                    <p className="text-[10px] text-emerald-300 inline-flex items-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                      Verificado
                    </p>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <h1 className="text-[24px] font-black leading-tight tracking-tight">{v.title}</h1>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip>{SCHEDULE_LABEL[v.schedule] || v.schedule}</Chip>
                  {v.hoursPerWeek && <Chip>{v.hoursPerWeek}h/semana</Chip>}
                  {v.location?.isRemote && <Chip>🏠 Remoto</Chip>}
                  {v.location?.isHybrid && <Chip>🔀 Híbrido</Chip>}
                  {v.location?.city && !v.location.isRemote && <Chip>📍 {v.location.city}</Chip>}
                </div>
              </div>

              {/* Salary */}
              {v.salary && !v.salary.hideFromCandidates && (v.salary.min || v.salary.max) && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.10] p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">Salario</p>
                  <p className="text-[22px] font-black text-emerald-300 tabular-nums mt-0.5">
                    {salaryDisplay(v.salary)}
                  </p>
                  {v.salary.negotiable && <p className="text-[10.5px] text-emerald-200/80 mt-0.5">Negociable</p>}
                </div>
              )}
              {v.salary?.hideFromCandidates && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <p className="text-[12px] font-bold text-white/70">💼 Salario a convenir en la entrevista</p>
                </div>
              )}

              {/* Description */}
              {v.description && (
                <Section title="Descripción">
                  <p className="text-[13px] text-white/75 leading-relaxed whitespace-pre-line">{v.description}</p>
                </Section>
              )}

              {/* Responsibilities */}
              {v.responsibilities?.length > 0 && (
                <Section title="Responsabilidades">
                  <ul className="space-y-1.5">
                    {v.responsibilities.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12.5px] text-white/75">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Requirements */}
              {v.requirements && (
                <Section title="Requisitos">
                  <div className="space-y-1.5 text-[12.5px] text-white/75">
                    {v.requirements.minExperienceYears > 0 && (
                      <ReqItem>{v.requirements.minExperienceYears} año(s) de experiencia mínima</ReqItem>
                    )}
                    {v.requirements.education && <ReqItem>{v.requirements.education}</ReqItem>}
                    {v.requirements.languages?.length > 0 && (
                      <ReqItem>Idiomas: {v.requirements.languages.join(', ')}</ReqItem>
                    )}
                    {v.requirements.certifications?.length > 0 && (
                      <ReqItem>Certificaciones: {v.requirements.certifications.join(', ')}</ReqItem>
                    )}
                    {v.requirements.skillsRequired?.length > 0 && (
                      <ReqItem>Habilidades requeridas: {v.requirements.skillsRequired.join(', ')}</ReqItem>
                    )}
                  </div>
                </Section>
              )}

              {/* Benefits */}
              {v.benefits?.length > 0 && (
                <Section title="Beneficios">
                  <div className="flex flex-wrap gap-1.5">
                    {v.benefits.map((b, i) => (
                      <span key={i} className="px-2.5 py-1 text-[11.5px] font-bold rounded-full bg-emerald-500/10 text-emerald-200 border border-emerald-400/25">
                        ✨ {b}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Deadline */}
              {v.applicationDeadline && (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-3.5">
                  <p className="text-[11px] font-bold text-amber-200">
                    ⏰ Cierra el {new Date(v.applicationDeadline).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
            </main>

            {/* Sticky CTA */}
            <div className="fixed bottom-0 left-0 right-0 px-5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 bg-gradient-to-t from-[#0a0a14] via-[#0a0a14]/95 to-transparent">
              <div className="max-w-md mx-auto">
                {alreadyApplied ? (
                  <div className="text-center px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/30">
                    <p className="text-[12.5px] font-extrabold text-emerald-200">
                      ✓ Ya te postulaste · Estado: <span className="capitalize">{data.myApplication.status}</span>
                    </p>
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setView('apply')}
                    className="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-extrabold text-[14px] shadow-lg shadow-violet-500/40"
                  >
                    Postularme a esta vacante
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {view === 'apply' && (
          <ApplyForm
            key="apply"
            vacancy={v}
            onCancel={() => setView('detail')}
            onSuccess={() => {
              cannon();
              crewToast.success('¡Postulación enviada!');
              onApplied?.();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ApplyForm({ vacancy, onCancel, onSuccess }) {
  const [coverLetter, setCoverLetter] = useState('');
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const setAnswer = (qId, val) => setAnswers((prev) => ({ ...prev, [qId]: val }));
  const toggleMulti = (qId, opt) => {
    setAnswers((prev) => {
      const cur = prev[qId] || [];
      return { ...prev, [qId]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const answersArr = (vacancy.customQuestions || []).map((q) => ({
        questionId: q._id, value: answers[q._id] ?? null,
      })).filter((a) => a.value != null && a.value !== '' && !(Array.isArray(a.value) && a.value.length === 0));

      await crewApi.post(`/vacancies/${vacancy._id}/apply`, {
        coverLetter, answers: answersArr,
      });
      onSuccess?.();
    } catch (e) {
      setError(e?.response?.data?.message || 'Error al enviar postulación');
    } finally { setSubmitting(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto px-5 pt-5 space-y-4">
      <div>
        <h2 className="text-[20px] font-black leading-tight">Postularme a {vacancy.title}</h2>
        <p className="text-[11.5px] text-white/45 mt-1">Una sola oportunidad — responde con tiempo.</p>
      </div>

      {/* Cover letter */}
      <Field label="Mensaje al empleador (opcional)">
        <textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value.slice(0, 2000))}
          placeholder="Cuéntale brevemente por qué encajas en esta vacante…"
          rows={4}
          className="w-full px-3.5 py-3 rounded-2xl bg-black/40 border border-white/[0.08] text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-violet-400/60 resize-none"
        />
        <p className="text-[10px] text-white/30 mt-1 text-right">{coverLetter.length} / 2000</p>
      </Field>

      {/* Custom questions */}
      {vacancy.customQuestions?.map((q) => (
        <Field key={q._id} label={`${q.question}${q.required ? ' *' : ''}`} hint={q.helpText}>
          <QuestionInput
            question={q}
            value={answers[q._id]}
            onChange={(v) => setAnswer(q._id, v)}
            onToggleMulti={(opt) => toggleMulti(q._id, opt)}
          />
        </Field>
      ))}

      {error && (
        <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/[0.10] border border-rose-400/30 text-[12px] text-rose-200">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} disabled={submitting} className="px-5 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.10] text-white/70 text-[13px] font-bold">
          Cancelar
        </button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={submitting}
          className="flex-1 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-extrabold text-[14px] shadow-lg shadow-violet-500/40 disabled:opacity-50"
        >
          {submitting ? 'Enviando…' : 'Enviar postulación'}
        </motion.button>
      </div>
    </motion.div>
  );
}

function QuestionInput({ question, value, onChange, onToggleMulti }) {
  const base = 'w-full px-3.5 py-3 rounded-2xl bg-black/40 border border-white/[0.08] text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-violet-400/60';

  if (question.type === 'longtext') {
    return <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={3} className={`${base} resize-none`} />;
  }
  if (question.type === 'number') {
    return <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${base} tabular-nums`} />;
  }
  if (question.type === 'yes_no') {
    return (
      <div className="flex gap-2">
        {['Sí', 'No'].map((opt) => {
          const active = value === opt;
          return (
            <button key={opt} type="button" onClick={() => onChange(opt)} className={`flex-1 py-2.5 rounded-xl text-[12.5px] font-extrabold border transition ${
              active ? 'bg-violet-500/25 text-violet-100 border-violet-400/50' : 'bg-white/[0.04] text-white/50 border-white/[0.08]'
            }`}>{opt}</button>
          );
        })}
      </div>
    );
  }
  if (question.type === 'choice') {
    return (
      <div className="space-y-1.5">
        {(question.options || []).map((opt) => {
          const active = value === opt;
          return (
            <button key={opt} type="button" onClick={() => onChange(opt)} className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[12.5px] font-bold border transition ${
              active ? 'bg-violet-500/15 text-white border-violet-400/50' : 'bg-white/[0.03] text-white/60 border-white/[0.08]'
            }`}>
              <span className={`inline-block w-3 h-3 rounded-full border mr-2 align-middle ${active ? 'bg-violet-400 border-violet-400' : 'border-white/30'}`} />
              {opt}
            </button>
          );
        })}
      </div>
    );
  }
  if (question.type === 'multichoice') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        {(question.options || []).map((opt) => {
          const active = selected.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => onToggleMulti(opt)} className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[12.5px] font-bold border transition ${
              active ? 'bg-violet-500/15 text-white border-violet-400/50' : 'bg-white/[0.03] text-white/60 border-white/[0.08]'
            }`}>
              <span className={`inline-block w-3 h-3 rounded border mr-2 align-middle ${active ? 'bg-violet-400 border-violet-400' : 'border-white/30'}`} />
              {opt}
            </button>
          );
        })}
      </div>
    );
  }
  return <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={base} />;
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[10.5px] font-extrabold uppercase tracking-[0.15em] text-white/50 mb-1.5">{label}</label>
      {hint && <p className="text-[10.5px] text-white/35 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-white/40 mb-2">{title}</h3>
      {children}
    </section>
  );
}

function ReqItem({ children }) {
  return (
    <div className="flex items-start gap-2">
      <svg className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
      <span>{children}</span>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span className="px-2 py-0.5 text-[10.5px] font-bold rounded-full bg-white/[0.05] text-white/70 border border-white/[0.08]">
      {children}
    </span>
  );
}

function salaryDisplay(s) {
  const period = SALARY_PERIOD_LABEL[s.period] || '';
  if (s.min && s.max) return `${formatCOP(s.min)} – ${formatCOP(s.max)}${period}`;
  if (s.min) return `Desde ${formatCOP(s.min)}${period}`;
  if (s.max) return `Hasta ${formatCOP(s.max)}${period}`;
  return '';
}

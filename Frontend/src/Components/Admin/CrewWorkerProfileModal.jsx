/**
 * CrewWorkerProfileModal — modal con TODO el perfil del postulante:
 * foto grande, KYC status, bio, experiencias, educación, referencias,
 * idiomas, skills detalladas, historial con tu negocio, etc.
 *
 * Props:
 *   workerId: ID del worker a mostrar
 *   businessId: ID del negocio (para auth)
 *   matchScore: opcional, el score precalculado de la application
 *   onClose
 *   onAccept / onReject: opcional. Si pasas estas funciones, muestra los botones.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

function formatRange(start, end) {
  const s = start ? new Date(start).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) : '—';
  const e = end ? new Date(end).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) : 'Actual';
  return `${s} — ${e}`;
}

const SKILL_LABEL = {
  mesero: 'Mesero', cocinero: 'Cocinero', barista: 'Barista', cajero: 'Cajero',
  runner: 'Auxiliar', lavaplatos: 'Lavaplatos', host: 'Anfitrión',
  recepcionista: 'Recepcionista', bartender: 'Bartender', parrillero: 'Parrillero',
  panadero: 'Panadero', reposteria: 'Repostería', limpieza: 'Limpieza',
  eventos: 'Eventos', delivery: 'Domiciliario',
};

export default function CrewWorkerProfileModal({ workerId, businessId, matchScore, onClose, onAccept, onReject }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API_URL}/crew/businesses/workers/${workerId}?businessId=${businessId}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          setError(e.message || 'No se pudo cargar el perfil');
          return;
        }
        setData(await r.json());
      } catch (e) {
        setError('Error de conexión');
      } finally { setLoading(false); }
    };
    load();
  }, [workerId, businessId]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const worker = data?.worker;
  const pastBookings = data?.pastBookings || [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-lg max-h-[92vh] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/95 backdrop-blur-sm shadow-md flex items-center justify-center text-slate-600 hover:text-slate-900"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          {loading && (
            <div className="p-10 text-center text-sm text-slate-500">Cargando perfil…</div>
          )}

          {error && (
            <div className="p-8 text-center">
              <p className="text-sm text-red-700 font-bold">{error}</p>
              <button onClick={onClose} className="mt-3 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold">Cerrar</button>
            </div>
          )}

          {worker && (
            <>
              {/* Hero */}
              <div className="relative bg-gradient-to-br from-slate-100 to-slate-200 px-5 pt-6 pb-5 border-b border-slate-200">
                <div className="flex items-start gap-4">
                  {worker.photo ? (
                    <img src={worker.photo} alt={worker.name} className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg" />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-[36px] font-extrabold text-white">
                      {(worker.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pt-1">
                    <h1 className="text-[20px] font-extrabold text-slate-900 leading-tight">{worker.name}</h1>
                    {worker.university && (
                      <p className="text-[12px] text-slate-600 mt-0.5">{worker.university}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-extrabold bg-red-600 text-white rounded-full">
                        Nivel {worker.level || 1}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-white border border-slate-200 text-slate-700 rounded-full">
                        {(worker.rating?.avg || 0).toFixed(1)}★ · {worker.rating?.count || 0} reseñas
                      </span>
                      <KycPill status={worker.kyc?.status} />
                      {matchScore != null && (
                        <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                          matchScore >= 75 ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' :
                          matchScore >= 50 ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                          'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {matchScore}% afinidad
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mt-4">
                  <HeroStat label="Turnos" value={worker.stats?.shiftsCompleted || 0} />
                  <HeroStat label="Horas" value={`${worker.stats?.hoursWorked || 0}h`} />
                  <HeroStat label="Inasistencias" value={worker.stats?.noShows || 0} accent={(worker.stats?.noShows || 0) > 0 ? 'red' : 'slate'} />
                  <HeroStat label="Idiomas" value={(worker.languages || []).length || 1} />
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Bio */}
                {worker.bio && (
                  <Section title="Acerca de">
                    <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{worker.bio}</p>
                  </Section>
                )}

                {/* Skills */}
                {worker.skills?.length > 0 && (
                  <Section title="Áreas de experiencia">
                    <div className="flex flex-wrap gap-1.5">
                      {worker.skills.map((s) => (
                        <span key={s.key} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-full">
                          {SKILL_LABEL[s.key] || s.key}
                          <span className="text-[9px] text-slate-500 uppercase">· {s.level}</span>
                          {s.yearsExp > 0 && <span className="text-[9px] text-slate-500">· {s.yearsExp}{s.yearsExp === 1 ? 'a' : 'a'}</span>}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Experiencias */}
                {worker.experiences?.length > 0 && (
                  <Section title="Experiencia laboral">
                    <div className="space-y-2.5">
                      {worker.experiences.map((e, i) => (
                        <div key={e._id || i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <p className="text-[13px] font-extrabold text-slate-900">{e.role}</p>
                          <p className="text-[12px] text-slate-600">{e.company}{e.city && ` · ${e.city}`}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{formatRange(e.startDate, e.endDate)}</p>
                          {e.description && <p className="text-[12px] text-slate-700 mt-1.5 leading-relaxed">{e.description}</p>}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Educación */}
                {worker.education?.length > 0 && (
                  <Section title="Educación">
                    <div className="space-y-2.5">
                      {worker.education.map((e, i) => (
                        <div key={e._id || i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <p className="text-[13px] font-extrabold text-slate-900">{e.degree || 'Estudios'}</p>
                          <p className="text-[12px] text-slate-600">{e.institution}{e.fieldOfStudy && ` · ${e.fieldOfStudy}`}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {e.startYear || '—'} — {e.isCurrent ? 'En curso' : (e.endYear || '—')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Referencias */}
                {worker.references?.length > 0 && (
                  <Section title="Referencias">
                    <div className="space-y-1.5">
                      {worker.references.map((r, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <div>
                            <p className="text-[13px] font-extrabold text-slate-800">{r.name}</p>
                            <p className="text-[11px] text-slate-500">{r.relation}</p>
                          </div>
                          {r.hasContact && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Contacto disponible al contratar
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Badges */}
                {worker.badgesEarned?.length > 0 && (
                  <Section title="Reconocimientos">
                    <div className="flex flex-wrap gap-1.5">
                      {worker.badgesEarned.map((b) => (
                        <span key={b.key} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6L12 2z"/></svg>
                          {b.key.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Historial con tu negocio */}
                {pastBookings.length > 0 && (
                  <Section title={`Turnos previos en tu negocio (${pastBookings.length})`}>
                    <div className="space-y-2">
                      {pastBookings.map((b, i) => (
                        <div key={b._id || i} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                          <div>
                            <p className="text-[12px] font-bold text-emerald-900">
                              {new Date(b.completedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                            {b.reviewByBusiness?.rating && (
                              <p className="text-[10px] text-emerald-700">Calificación que le diste: {b.reviewByBusiness.rating}★</p>
                            )}
                          </div>
                          <p className="text-[13px] font-extrabold text-emerald-700 tabular-nums">{formatCOP(b.agreedTotal)}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Languages */}
                {worker.languages?.length > 0 && (
                  <Section title="Idiomas">
                    <div className="flex flex-wrap gap-1.5">
                      {worker.languages.map((l) => (
                        <span key={l} className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 border border-slate-200 rounded-full uppercase">{l}</span>
                      ))}
                    </div>
                  </Section>
                )}

                <p className="text-[10px] text-slate-400 text-center pt-2">
                  Datos privados del trabajador. No compartir con terceros.
                </p>
              </div>

              {/* Sticky footer with actions */}
              {(onAccept || onReject) && (
                <div className="border-t border-slate-200 px-5 py-3 bg-white flex gap-2">
                  {onReject && (
                    <button
                      onClick={onReject}
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13px] transition"
                    >
                      Rechazar
                    </button>
                  )}
                  {onAccept && (
                    <button
                      onClick={onAccept}
                      className="flex-[2] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-[13px] shadow-md shadow-red-500/25 transition"
                    >
                      Aceptar postulante
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function KycPill({ status }) {
  if (status === 'approved') return <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full flex items-center gap-1">
    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    Verificado
  </span>;
  if (status === 'pending') return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 rounded-full">Verificación en revisión</span>;
  if (status === 'rejected') return <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 rounded-full">No verificado</span>;
  return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-full">Sin verificar</span>;
}

function HeroStat({ label, value, accent = 'slate' }) {
  const colors = {
    slate: 'text-slate-900',
    red: 'text-red-700',
  };
  return (
    <div className="bg-white/80 border border-slate-200 rounded-xl p-2 text-center">
      <p className={`text-[15px] font-extrabold tabular-nums ${colors[accent] || colors.slate}`}>{value}</p>
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </section>
  );
}

/**
 * CrewVacanciesFeed — descubrimiento de vacantes para el worker.
 * Estilo cosmic dark (coherente con el resto de la app del worker).
 *
 * Diferente del feed de turnos: una vacante no tiene "fecha exacta", es
 * una posición de largo plazo. La card muestra rol + horario + salario + ubicación.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';
import CrewVacancyDetail from './CrewVacancyDetail';

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

const ROLE_LABEL = {
  mesero: 'Mesero', cocinero: 'Cocinero', barista: 'Barista', cajero: 'Cajero',
  runner: 'Auxiliar de cocina', lavaplatos: 'Lavaplatos', host: 'Anfitrión',
  recepcionista: 'Recepcionista', bartender: 'Bartender', parrillero: 'Parrillero',
  panadero: 'Panadero', reposteria: 'Repostería', limpieza: 'Limpieza',
  eventos: 'Eventos', delivery: 'Domiciliario',
};

export default function CrewVacanciesFeed() {
  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await crewApi.get('/vacancies/feed');
      setVacancies(data.vacancies || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (openId) {
    return (
      <CrewVacancyDetail
        vacancyId={openId}
        onBack={() => setOpenId(null)}
        onApplied={() => {
          setVacancies((prev) => prev.filter((v) => v._id !== openId));
          setOpenId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      )}

      {!loading && vacancies.length === 0 && (
        <div className="text-center py-12 px-6 rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-[14px] font-black text-white/90">No hay vacantes nuevas</p>
          <p className="text-[12px] text-white/45 mt-1">Vuelve más tarde. Los empleadores publican vacantes todos los días.</p>
        </div>
      )}

      {!loading && vacancies.length > 0 && (
        <AnimatePresence>
          {vacancies.map((v, i) => (
            <VacancyCard key={v._id} vacancy={v} index={i} onOpen={() => setOpenId(v._id)} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

function VacancyCard({ vacancy, index, onOpen }) {
  const owner = vacancy.ownerDisplay || {};
  const showSalary = vacancy.salary && !vacancy.salary.hideFromCandidates && (vacancy.salary.min || vacancy.salary.max);
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ delay: index * 0.04 }}
      whileTap={{ scale: 0.99 }}
      onClick={onOpen}
      className="w-full text-left rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.15] backdrop-blur-sm overflow-hidden transition"
    >
      {/* Banner del owner */}
      <div className="relative h-20 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/15 to-orange-500/10 overflow-hidden">
        {owner.coverImage && (
          <img src={owner.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute top-2 right-2 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider rounded-full bg-violet-500/25 text-violet-200 border border-violet-400/30 backdrop-blur-sm">
          Vacante
        </span>
        <div className="absolute bottom-2 left-3 right-3 flex items-end gap-2.5">
          {owner.logo ? (
            <img src={owner.logo} alt="" className="w-10 h-10 rounded-xl object-cover border-2 border-white/30 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-[14px] font-black text-white border-2 border-white/30 shrink-0">
              {(owner.name || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <p className="text-[12px] font-extrabold text-white truncate drop-shadow-md">{owner.name || 'Empleador'}</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-[15px] font-black text-white leading-tight">{vacancy.title}</p>
        <p className="text-[11px] text-white/50 mt-0.5">{ROLE_LABEL[vacancy.role] || vacancy.role}</p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Chip>{SCHEDULE_LABEL[vacancy.schedule] || vacancy.schedule}</Chip>
          {vacancy.location?.isRemote && <Chip>🏠 Remoto</Chip>}
          {vacancy.location?.isHybrid && <Chip>🔀 Híbrido</Chip>}
          {vacancy.location?.city && !vacancy.location.isRemote && <Chip>📍 {vacancy.location.city}</Chip>}
          {showSalary && (
            <span className="px-2 py-0.5 text-[10.5px] font-extrabold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 tabular-nums">
              {salaryLabel(vacancy.salary)}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <span className="text-[10.5px] text-white/40">
            {vacancy.applicationCount > 0 ? `${vacancy.applicationCount} postulantes` : 'Sé el primero en postular'}
          </span>
          <span className="text-[10.5px] font-extrabold text-violet-300 inline-flex items-center gap-1">
            Ver detalle
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function Chip({ children }) {
  return (
    <span className="px-2 py-0.5 text-[10.5px] font-bold rounded-full bg-white/[0.05] text-white/70 border border-white/[0.08]">
      {children}
    </span>
  );
}

function salaryLabel(s) {
  const period = { hourly: '/h', monthly: '/mes', yearly: '/año', per_project: '/proyecto' }[s.period] || '';
  if (s.min && s.max) return `${formatCOP(s.min)} – ${formatCOP(s.max)}${period}`;
  if (s.min) return `Desde ${formatCOP(s.min)}${period}`;
  if (s.max) return `Hasta ${formatCOP(s.max)}${period}`;
  return s.negotiable ? 'A convenir' : '';
}

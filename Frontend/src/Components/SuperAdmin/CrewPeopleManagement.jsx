/**
 * CrewPeopleManagement — vista panorámica de TODAS las personas registradas
 * en Crew (trabajadores + empleadores externos + negocios MenuBy con actividad).
 *
 * Filtros:
 *   - Type tabs: Todos / Trabajadores / Empleadores
 *   - Source chips: Todos / MenuBy / Externo (Crew directo)
 *   - Search por nombre/teléfono/email
 *
 * Cada card muestra el origen con un badge claro para que el SuperAdmin
 * sepa de un vistazo si una persona vino vía MenuBy o se registró directo en Crew.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import superadminApi from '../../services/superadminApi';
import { SAModal, SABadge, SAEmptyState, SAToast } from './ui';

const TYPE_TABS = [
  { key: 'all', label: 'Todos' },
  { key: 'worker', label: 'Trabajadores' },
  { key: 'crew_employer', label: 'Empleadores' },
  { key: 'menuby_business', label: 'Negocios MenuBy' },
];

const SOURCE_CHIPS = [
  { key: 'all', label: 'Todos' },
  { key: 'menuby', label: 'Integrado MenuBy' },
  { key: 'external', label: 'Crew externo' },
];

const BUSINESS_TYPE_LABEL = {
  restaurant: 'Restaurante', cafe: 'Café', bar: 'Bar', bakery: 'Panadería',
  hotel: 'Hotel', catering: 'Catering', event_organizer: 'Org. eventos',
  wedding: 'Bodas', corporate_event: 'Evento corporativo', production: 'Producción',
  retail: 'Retail', salon: 'Salón belleza', spa: 'Spa', clinic: 'Clínica',
  cleaning: 'Limpieza', moving: 'Mudanzas', services: 'Otros servicios', other: 'Otro',
  ice_cream: 'Heladería', fast_food: 'Comida rápida', food_truck: 'Food truck',
  home_service: 'Servicio a domicilio', private_party: 'Fiesta privada',
};

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

function formatRelative(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `Hace ${days}d`;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CrewPeopleManagement() {
  const [type, setType] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [people, setPeople] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });

  // Debounce del search para no martillar el endpoint
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await superadminApi.get('/crew/people', {
        params: { type, source: sourceFilter, search: debouncedSearch, limit: 80 },
      });
      setPeople(data.people || []);
      setCounts(data.counts || {});
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'Error al cargar' });
    } finally { setLoading(false); }
  }, [type, sourceFilter, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const groupCounts = useMemo(() => ({
    worker: people.filter((p) => p.type === 'worker').length,
    crew_employer: people.filter((p) => p.type === 'crew_employer').length,
    menuby_business: people.filter((p) => p.type === 'menuby_business').length,
  }), [people]);

  return (
    <div className="space-y-4">
      {/* Header con KPIs globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard label="Total registrados" value={counts.all || 0} tone="slate" />
        <KpiCard label="Trabajadores" value={counts.worker || 0} tone="emerald" />
        <KpiCard label="Empleadores externos" value={counts.crew_employer || 0} tone="violet" />
        <KpiCard label="Negocios MenuBy activos" value={counts.menuby_business || 0} tone="sky" />
      </div>

      {/* Type tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${
 type === t.key
 ? 'bg-white text-slate-900 shadow-sm'
 : 'text-slate-500 hover:text-slate-700'
 }`}
          >
            {t.label}
            {t.key !== 'all' && counts[t.key] != null && (
              <span className="ml-1.5 text-[10px] font-bold opacity-60 tabular-nums">{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Source filter + search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mr-1">Origen:</span>
          {SOURCE_CHIPS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSourceFilter(s.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
 sourceFilter === s.key
 ? 'bg-slate-900 text-white border-slate-900'
 : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
 }`}
            >
              {s.key === 'menuby' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
              {s.key === 'external' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email…"
            className="w-full sm:w-72 pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-2 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <SAEmptyState
          title="No hay personas que coincidan"
          description={search ? 'Prueba con otro término de búsqueda o cambia los filtros.' : 'Cambia los filtros para ver más resultados.'}
        />
      ) : (
        <>
          <p className="text-[11px] text-slate-500">
            Mostrando {people.length} {people.length === 1 ? 'persona' : 'personas'}
            {type !== 'all' && <> en <strong>{TYPE_TABS.find(t => t.key === type)?.label.toLowerCase()}</strong></>}
            {sourceFilter !== 'all' && <> · origen <strong>{SOURCE_CHIPS.find(s => s.key === sourceFilter)?.label}</strong></>}
            {Object.values(groupCounts).filter(v => v > 0).length > 1 && (
              <> · <span className="text-emerald-600">{groupCounts.worker} workers</span>, <span className="text-violet-600">{groupCounts.crew_employer} externos</span>, <span className="text-sky-600">{groupCounts.menuby_business} MenuBy</span></>
            )}
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {people.map((p) => (
              <PersonCard key={`${p.type}-${p.id}`} person={p} onClick={() => setTarget(p)} />
            ))}
          </div>
        </>
      )}

      {/* Detail modal */}
      <SAModal
        isOpen={!!target}
        onClose={() => setTarget(null)}
        title={target?.name}
        subtitle={target ? `${typeLabel(target.type)}${target.subtitle ? ` · ${target.subtitle}` : ''}` : ''}
        width="max-w-2xl"
      >
        {target && <PersonDetail person={target} />}
      </SAModal>

      <SAToast
        type={toast.type}
        message={toast.message}
        isVisible={toast.visible}
        onClose={() => setToast({ ...toast, visible: false })}
      />
    </div>
  );
}

function typeLabel(type) {
  if (type === 'worker') return 'Trabajador';
  if (type === 'crew_employer') return 'Empleador externo';
  if (type === 'menuby_business') return 'Negocio MenuBy';
  return type;
}

function KpiCard({ label, value, tone }) {
  const tones = {
    slate: 'border-slate-200 bg-white',
    emerald: 'border-emerald-200 bg-emerald-50',
    violet: 'border-violet-200 bg-violet-50',
    sky: 'border-sky-200 bg-sky-50',
  };
  return (
    <div className={`rounded-xl border p-3.5 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-[22px] font-extrabold text-slate-900 tabular-nums mt-0.5 leading-none">{value}</p>
    </div>
  );
}

function PersonCard({ person, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="text-left p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition flex items-start gap-3"
    >
      <Avatar person={person} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-slate-900 truncate">{person.name}</p>
          {person.type === 'worker' && person.kycStatus === 'approved' && (
            <SABadge variant="success" dot>KYC</SABadge>
          )}
        </div>
        <p className="text-[11px] text-slate-500 truncate">
          {person.phone || '—'}
          {person.subtitle && <> · {person.type === 'crew_employer' && person.kind === 'business' ? (BUSINESS_TYPE_LABEL[person.subtitle] || person.subtitle) : person.subtitle}</>}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <TypeBadge type={person.type} kind={person.kind} />
          <SourceBadge source={person.source} />
          <StatusBadge status={person.status} />
          <span className="text-[10px] text-slate-400 ml-auto">{formatRelative(person.createdAt)}</span>
        </div>
      </div>
    </motion.button>
  );
}

function Avatar({ person }) {
  const colors = {
    worker: 'from-emerald-400 to-teal-500',
    crew_employer: person.kind === 'individual' ? 'from-violet-400 to-fuchsia-500' : 'from-amber-400 to-orange-500',
    menuby_business: 'from-sky-400 to-blue-500',
  };
  if (person.photo) {
    return <img src={person.photo} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0" />;
  }
  return (
    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colors[person.type] || colors.worker} flex items-center justify-center text-[16px] font-bold text-white shrink-0`}>
      {(person.name || '?').slice(0, 1).toUpperCase()}
    </div>
  );
}

function TypeBadge({ type, kind }) {
  if (type === 'worker') return <SABadge variant="success">Trabajador</SABadge>;
  if (type === 'crew_employer') {
    return kind === 'individual'
      ? <SABadge variant="purple">Persona</SABadge>
      : <SABadge variant="warning">Negocio externo</SABadge>;
  }
  if (type === 'menuby_business') return <SABadge variant="info">Negocio MenuBy</SABadge>;
  return <SABadge variant="neutral">{type}</SABadge>;
}

function SourceBadge({ source }) {
  if (source === 'menuby') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-extrabold rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200 uppercase tracking-wider">
        <span className="w-1 h-1 rounded-full bg-cyan-500" />
        MenuBy
      </span>
    );
  }
  if (source === 'external') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-extrabold rounded-md bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
        <span className="w-1 h-1 rounded-full bg-amber-500" />
        Crew externo
      </span>
    );
  }
  if (source === 'mixed') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-extrabold rounded-md bg-gradient-to-r from-cyan-50 to-amber-50 text-slate-700 border border-slate-300 uppercase tracking-wider">
        Mixto
      </span>
    );
  }
  if (source === 'new') {
    return <SABadge variant="neutral">Sin actividad</SABadge>;
  }
  return null;
}

function StatusBadge({ status }) {
  if (status === 'approved' || status === 'active') return <SABadge variant="success">Activo</SABadge>;
  if (status === 'pending_approval') return <SABadge variant="warning">En revisión</SABadge>;
  if (status === 'rejected') return <SABadge variant="danger">Rechazado</SABadge>;
  if (status === 'suspended') return <SABadge variant="warning">Suspendido</SABadge>;
  if (status === 'banned') return <SABadge variant="danger">Bloqueado</SABadge>;
  if (status === 'pending_verification') return <SABadge variant="warning">Sin verificar</SABadge>;
  return <SABadge variant="neutral">{status}</SABadge>;
}

function PersonDetail({ person }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Avatar person={person} />
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-slate-900">{person.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{typeLabel(person.type)}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <SourceBadge source={person.source} />
            <StatusBadge status={person.status} />
            {person.type === 'worker' && person.kycStatus === 'approved' && <SABadge variant="success">KYC aprobado</SABadge>}
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <DetailStat label="Teléfono" value={person.phone || '—'} />
        <DetailStat label="Email" value={person.email || '—'} />
        {person.city && <DetailStat label="Ciudad" value={person.city} />}
        {person.subtitle && (
          <DetailStat
            label={person.type === 'worker' ? 'Universidad' : person.kind === 'individual' ? 'Tipo' : 'Categoría'}
            value={person.type === 'crew_employer' && person.kind === 'business' ? (BUSINESS_TYPE_LABEL[person.subtitle] || person.subtitle) : person.subtitle}
          />
        )}
        {person.slug && <DetailStat label="Slug" value={person.slug} />}
      </div>

      {/* Worker-specific */}
      {person.type === 'worker' && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Perfil de trabajador</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <DetailStat label="Nivel" value={person.level} />
            <DetailStat label="XP" value={person.xp?.toLocaleString('es-CO') || 0} />
            <DetailStat label="Rating" value={`${person.rating?.avg.toFixed(1)}★ (${person.rating?.count})`} />
            <DetailStat label="Turnos hechos" value={person.stats?.shiftsCompleted || 0} />
            <DetailStat label="Horas trabajadas" value={`${person.stats?.hoursWorked || 0}h`} />
            <DetailStat label="Ganancias totales" value={formatCOP(person.stats?.totalEarned)} />
          </div>
        </div>
      )}

      {/* Employer stats */}
      {(person.type === 'crew_employer' || person.type === 'menuby_business') && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Actividad en Crew</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <DetailStat label="Turnos publicados" value={person.stats?.shiftsPublished || 0} />
            {person.type === 'crew_employer' && (
              <>
                <DetailStat label="Turnos completados" value={person.stats?.shiftsCompleted || 0} />
                <DetailStat label="Workers contratados" value={person.stats?.workersHired || 0} />
              </>
            )}
            <DetailStat label="Pagado a trabajadores" value={formatCOP(person.stats?.totalSpent)} />
          </div>
        </div>
      )}

      {/* Trace meta */}
      <div className="text-xs text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
        <p>Registro: {new Date(person.createdAt).toLocaleString('es-CO')}</p>
        <p>Última actividad: {formatRelative(person.lastActiveAt)}</p>
      </div>

      {/* Quick link to specific management panel */}
      <div className="pt-2 text-[11px] text-slate-500">
        {person.type === 'worker' && person.kycStatus === 'pending' && (
          <p>💡 Tiene KYC pendiente — revísalo en la pestaña <strong>Verificación KYC</strong>.</p>
        )}
        {person.type === 'crew_employer' && person.status === 'pending_approval' && (
          <p>💡 Cuenta pendiente — apruébala o rechazala en la pestaña <strong>Empleadores</strong>.</p>
        )}
      </div>
    </div>
  );
}

function DetailStat({ label, value }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="text-sm font-semibold text-slate-900 mt-0.5 break-words">{value}</div>
    </div>
  );
}

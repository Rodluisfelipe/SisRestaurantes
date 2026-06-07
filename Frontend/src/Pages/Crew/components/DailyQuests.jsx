import { motion } from 'framer-motion';

/**
 * Lista de misiones diarias estilo battle pass.
 * Renderiza mock data por ahora — endpoint real en el sprint siguiente.
 *
 * Props.worker: el objeto worker para calcular progreso real-ish.
 */
const MISSIONS = [
  {
    id: 'apply_today',
    title: 'Postúlate a un turno',
    desc: 'Envía al menos una postulación hoy',
    reward: 30,
    progress: (w) => Math.min(1, (w?.stats?.shiftsCompleted || 0) > 0 ? 1 : 0),
    icon: 'send',
  },
  {
    id: 'profile_complete',
    title: 'Perfil completo',
    desc: 'Agrega tu universidad y bio',
    reward: 50,
    progress: (w) => (w?.university && w?.bio ? 1 : w?.university || w?.bio ? 0.5 : 0),
    icon: 'user',
  },
  {
    id: 'week_streak',
    title: 'Racha de 3 días',
    desc: 'Trabaja 3 días esta semana',
    reward: 100,
    progress: (w) => Math.min(1, (w?.streakDays || 0) / 3),
    icon: 'fire',
  },
];

const ICONS = {
  send: <path d="M22 2l-7 20-4-9-9-4 20-7z" />,
  user: <><circle cx="12" cy="8" r="4"/><path d="M3 21a9 9 0 0118 0"/></>,
  fire: <path d="M13.5 2c-1.5 2-2 4-2 5.5 0 1.4.5 2.5 1.5 3.5C11 12 9 13 9 16c0 3 2.5 5 4.5 5s4.5-2 4.5-5c0-1.5-.5-3-1.5-4 1 .5 1.5 1.5 1.5 3 0 1-.5 2-1.5 3 2.5-1 4-3 4-6s-2-6-5-9c-1 1-2 2-2 3z"/>,
};

export default function DailyQuests({ worker }) {
  const missions = MISSIONS.map((m) => ({ ...m, pct: m.progress(worker) }));
  const allDone = missions.every((m) => m.pct >= 1);

  return (
    <section>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Misiones de hoy</h2>
        {allDone && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full"
          >
            ¡Completaste todas!
          </motion.span>
        )}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
        {missions.map((m, i) => (
          <QuestRow key={m.id} mission={m} index={i} last={i === missions.length - 1} />
        ))}
      </div>
    </section>
  );
}

function QuestRow({ mission, index, last }) {
  const done = mission.pct >= 1;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`flex items-center gap-3 px-3 py-3 ${!last ? 'border-b border-slate-100' : ''}`}
    >
      <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
        done
          ? 'bg-emerald-500 shadow-md shadow-emerald-500/30'
          : 'bg-slate-100 border border-slate-200'
      }`}>
        {done ? (
          <motion.svg
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 16 }}
            className="w-4 h-4 text-white"
            fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </motion.svg>
        ) : (
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            {ICONS[mission.icon]}
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className={`text-[13px] font-bold ${done ? 'text-emerald-700' : 'text-slate-800'}`}>{mission.title}</p>
          <span className={`text-[11px] font-extrabold ${done ? 'text-emerald-700' : 'text-slate-500'}`}>
            +{mission.reward} XP
          </span>
        </div>
        <p className="text-[11px] text-slate-500">{mission.desc}</p>
        <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(mission.pct * 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 + index * 0.06 }}
            className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-gradient-to-r from-red-500 to-red-600'}`}
          />
        </div>
      </div>
    </motion.div>
  );
}

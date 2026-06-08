import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import crewApi from '../../../services/crewApi';
import { crewToast } from './crewToast';
import { cannon } from './confettiBurst';

/**
 * Misiones diarias. Datos servidos por GET /crew/workers/me/quests,
 * progreso y reclamos persistidos backend-side (no más mocks).
 *
 * Props.onRewardClaimed: callback opcional que recibe { reward, leveledUp, worker }
 * cuando el usuario reclama una misión — útil para refrescar el header con XP nuevo.
 */
const ICONS = {
  send: <path d="M22 2l-7 20-4-9-9-4 20-7z" />,
  user: <><circle cx="12" cy="8" r="4"/><path d="M3 21a9 9 0 0118 0"/></>,
  fire: <path d="M13.5 2c-1.5 2-2 4-2 5.5 0 1.4.5 2.5 1.5 3.5C11 12 9 13 9 16c0 3 2.5 5 4.5 5s4.5-2 4.5-5c0-1.5-.5-3-1.5-4 1 .5 1.5 1.5 1.5 3 0 1-.5 2-1.5 3 2.5-1 4-3 4-6s-2-6-5-9c-1 1-2 2-2 3z"/>,
  shield: <path d="M12 2l8 4v6c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V6l8-4z"/>,
};

export default function DailyQuests({ onRewardClaimed }) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await crewApi.get('/workers/me/quests');
      setQuests(data.quests || []);
    } catch (e) {
      console.error('crew quests load error', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const claim = async (key) => {
    setClaiming(key);
    try {
      const { data } = await crewApi.post(`/workers/me/quests/${key}/claim`);
      setQuests(data.quests || quests);
      cannon();
      crewToast.success(`¡+${data.reward} XP reclamados!`);
      onRewardClaimed?.(data);
    } catch (e) {
      crewToast.error(e?.response?.data?.message || 'No se pudo reclamar');
    } finally { setClaiming(null); }
  };

  if (loading && quests.length === 0) {
    return (
      <section>
        <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Misiones de hoy</h2>
        <div className="h-32 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      </section>
    );
  }

  if (quests.length === 0) return null;

  const allDone = quests.every((q) => q.progress >= 1 && q.claimed);

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
        {quests.map((m, i) => (
          <QuestRow
            key={m.key}
            mission={m}
            index={i}
            last={i === quests.length - 1}
            claiming={claiming === m.key}
            onClaim={() => claim(m.key)}
          />
        ))}
      </div>
    </section>
  );
}

function QuestRow({ mission, index, last, claiming, onClaim }) {
  const done = mission.progress >= 1;
  const claimed = mission.claimed;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`flex items-center gap-3 px-3 py-3 ${!last ? 'border-b border-slate-100' : ''}`}
    >
      <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
        claimed
          ? 'bg-emerald-500 shadow-md shadow-emerald-500/30'
          : done
          ? 'bg-amber-500 shadow-md shadow-amber-500/30'
          : 'bg-slate-100 border border-slate-200'
      }`}>
        {claimed ? (
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
          <svg className={`w-4 h-4 ${done ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            {ICONS[mission.icon]}
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className={`text-[13px] font-bold ${claimed ? 'text-emerald-700' : done ? 'text-amber-700' : 'text-slate-800'}`}>{mission.title}</p>
          <span className={`text-[11px] font-extrabold ${claimed ? 'text-emerald-700' : 'text-slate-500'}`}>
            +{mission.reward} XP
          </span>
        </div>
        <p className="text-[11px] text-slate-500">{mission.desc}</p>
        <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(mission.progress * 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 + index * 0.06 }}
            className={`h-full rounded-full ${claimed ? 'bg-emerald-500' : done ? 'bg-amber-500' : 'bg-gradient-to-r from-red-500 to-red-600'}`}
          />
        </div>
      </div>

      {done && !claimed && (
        <button
          onClick={onClaim}
          disabled={claiming}
          className="shrink-0 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-extrabold shadow-md shadow-amber-500/30 disabled:opacity-50 active:scale-95 transition"
        >
          {claiming ? '…' : 'Reclamar'}
        </button>
      )}
    </motion.div>
  );
}

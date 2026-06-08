/**
 * MissionsDial — botón flotante con badge animado para las misiones diarias.
 * Mantiene el feed enfocado en los turnos (que es el "para qué" de la app)
 * y deja las misiones a un tap de distancia sin robar pantalla.
 *
 * - Si hay misiones reclamables (done & no claimed): pulse rojo + número.
 * - Si todas completadas: pulse verde con check.
 * - Si nada listo: discreto, sin badge.
 *
 * Props.onRewardClaimed: callback opcional (refresca al worker).
 */
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../../services/crewApi';
import { crewToast } from './crewToast';
import { cannon } from './confettiBurst';

const ICONS = {
  send: <path d="M22 2l-7 20-4-9-9-4 20-7z" />,
  user: <><circle cx="12" cy="8" r="4"/><path d="M3 21a9 9 0 0118 0"/></>,
  fire: <path d="M13.5 2c-1.5 2-2 4-2 5.5 0 1.4.5 2.5 1.5 3.5C11 12 9 13 9 16c0 3 2.5 5 4.5 5s4.5-2 4.5-5c0-1.5-.5-3-1.5-4 1 .5 1.5 1.5 1.5 3 0 1-.5 2-1.5 3 2.5-1 4-3 4-6s-2-6-5-9c-1 1-2 2-2 3z"/>,
  shield: <path d="M12 2l8 4v6c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V6l8-4z"/>,
};

export default function MissionsDial({ onRewardClaimed }) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

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

  const claimableCount = quests.filter((q) => q.progress >= 1 && !q.claimed).length;
  const allDone = quests.length > 0 && quests.every((q) => q.claimed);
  const progress = quests.length
    ? quests.reduce((s, q) => s + Math.min(1, q.progress), 0) / quests.length
    : 0;

  if (loading && quests.length === 0) return null;
  if (quests.length === 0) return null;

  return (
    <>
      {/* Trigger inline — se renderiza donde lo pongas, ej. en el header del feed */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(true)}
        className="relative shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/[0.05] border border-white/[0.10] hover:bg-white/[0.08] hover:border-white/[0.18] transition"
        aria-label="Misiones diarias"
      >
        {/* Anillo de progreso alrededor del ícono */}
        <span className="relative w-7 h-7 flex items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2.5" />
            <motion.circle
              cx="16" cy="16" r="14" fill="none"
              stroke={allDone ? '#34d399' : '#f59e0b'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 14}
              initial={{ strokeDashoffset: 2 * Math.PI * 14 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 14 * (1 - progress) }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <span className="text-base relative">{allDone ? '🏆' : '🎯'}</span>
        </span>

        <div className="flex flex-col items-start leading-tight">
          <span className="text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-white/40">Misiones</span>
          <span className="text-[12px] font-extrabold text-white tabular-nums">
            {quests.filter((q) => q.claimed).length}/{quests.length}
          </span>
        </div>

        {claimableCount > 0 && (
          <>
            {/* Pulse glow */}
            <span className="absolute inset-0 rounded-2xl bg-amber-500/30 blur-md animate-pulse pointer-events-none" />
            {/* Badge */}
            <motion.span
              key={claimableCount}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center shadow-lg shadow-amber-500/40 border-2 border-[#0a0a14]"
            >
              {claimableCount}
            </motion.span>
          </>
        )}
      </motion.button>

      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm font-geist"
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full sm:max-w-md max-h-[80vh] bg-[#0a0a14] border border-white/[0.08] sm:rounded-[28px] rounded-t-[28px] shadow-2xl text-white overflow-hidden flex flex-col"
            >
              <motion.div
                animate={{ x: [0, 16, 0], y: [0, -8, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-20 -right-12 w-64 h-64 bg-amber-500/20 rounded-full blur-[100px] pointer-events-none"
              />

              {/* Handle */}
              <div className="relative flex justify-center pt-2 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="relative px-5 pt-3 pb-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40">Diarias</p>
                  <h2 className="text-[18px] font-black">Misiones de hoy</h2>
                </div>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white" aria-label="Cerrar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {allDone && (
                <div className="relative mx-5 mb-3 px-3 py-2 rounded-xl bg-emerald-500/[0.10] border border-emerald-400/30 text-center">
                  <span className="text-[12px] font-extrabold text-emerald-300">🎉 Completaste todas las misiones de hoy</span>
                </div>
              )}

              <div className="relative flex-1 overflow-y-auto px-3 pb-4 space-y-1">
                {quests.map((m, i) => (
                  <QuestRow
                    key={m.key}
                    mission={m}
                    index={i}
                    claiming={claiming === m.key}
                    onClaim={() => claim(m.key)}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function QuestRow({ mission, index, claiming, onClaim }) {
  const done = mission.progress >= 1;
  const claimed = mission.claimed;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-3 px-3 py-3 rounded-2xl border ${
        claimed
          ? 'border-emerald-400/20 bg-emerald-500/[0.04]'
          : done
            ? 'border-amber-400/30 bg-amber-500/[0.08]'
            : 'border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
        claimed
          ? 'bg-emerald-500 shadow-md shadow-emerald-500/40'
          : done
            ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-md shadow-amber-500/40'
            : 'bg-white/[0.06] border border-white/[0.10]'
      }`}>
        {claimed ? (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className={`w-4 h-4 ${done ? 'text-white' : 'text-white/40'}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            {ICONS[mission.icon]}
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <p className={`text-[13px] font-extrabold truncate ${claimed ? 'text-white/60 line-through' : 'text-white'}`}>{mission.title}</p>
          <span className={`shrink-0 text-[11px] font-extrabold tabular-nums ${claimed ? 'text-emerald-300' : done ? 'text-amber-200' : 'text-white/40'}`}>+{mission.reward} XP</span>
        </div>
        <p className="text-[10.5px] text-white/40 leading-tight">{mission.desc}</p>
        <div className="mt-1.5 h-1 bg-white/[0.08] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(mission.progress * 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${claimed ? 'bg-emerald-500/60' : done ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-red-500 to-red-600'}`}
          />
        </div>
      </div>

      {done && !claimed && (
        <button
          onClick={onClaim}
          disabled={claiming}
          className="shrink-0 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-black uppercase tracking-wider shadow-md shadow-amber-500/40 disabled:opacity-50 active:scale-95 transition"
        >
          {claiming ? '…' : 'Reclamar'}
        </button>
      )}
    </motion.div>
  );
}

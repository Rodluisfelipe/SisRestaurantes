import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCrew } from './useCrew';
import CrewLogin from './CrewLogin';
import CrewOnboarding from './CrewOnboarding';
import CrewFeed from './CrewFeed';
import CrewMyShifts from './CrewMyShifts';
import CrewProfile from './CrewProfile';
import CrewChat from './CrewChat';
import CrewProfileEditor from './CrewProfileEditor';
import CrewWallet from './CrewWallet';
import CrewFavorites from './CrewFavorites';
import CrewWorkHistory from './CrewWorkHistory';
import LevelUpCelebration from './components/LevelUpCelebration';

const TABS = [
  {
    id: 'feed',
    label: 'Explorar',
    icon: (a) => (
      <svg className="w-[22px] h-[22px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
    ),
  },
  {
    id: 'shifts',
    label: 'Turnos',
    icon: (a) => (
      <svg className="w-[22px] h-[22px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: (a) => (
      <svg className="w-[22px] h-[22px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Perfil',
    icon: (a) => (
      <svg className="w-[22px] h-[22px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
    ),
  },
];

export default function CrewApp() {
  const { isAuthed, worker, refreshMe } = useCrew();
  const [tab, setTab] = useState('feed');
  const [editingProfile, setEditingProfile] = useState(false);
  const [subView, setSubView] = useState(null); // 'wallet' | 'favorites' | 'history' | null
  const [levelUp, setLevelUp] = useState(null);
  const prevLevelRef = useRef(null);

  // Onboarding incompleto = sin skills configurados
  const needsOnboarding = useMemo(() => {
    if (!worker) return false;
    return !worker.skills || worker.skills.length === 0;
  }, [worker]);

  // Detectar level up automático
  useEffect(() => {
    if (!worker?.level) return;
    if (prevLevelRef.current == null) {
      prevLevelRef.current = worker.level;
      return;
    }
    if (worker.level > prevLevelRef.current) {
      setLevelUp({ from: prevLevelRef.current, to: worker.level });
    }
    prevLevelRef.current = worker.level;
  }, [worker?.level]);

  if (!isAuthed) return <CrewLogin onAuthed={refreshMe} />;
  if (needsOnboarding) return <CrewOnboarding onDone={refreshMe} />;

  return (
    <div className="bg-[#0a0a14] min-h-[100dvh]">
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === 'feed' && <CrewFeed />}
          {tab === 'shifts' && <CrewMyShifts />}
          {tab === 'chat' && <CrewChat />}
          {tab === 'profile' && (
            subView === 'wallet' ? <CrewWallet onBack={() => setSubView(null)} /> :
            subView === 'favorites' ? <CrewFavorites onBack={() => setSubView(null)} /> :
            subView === 'history' ? <CrewWorkHistory onBack={() => setSubView(null)} /> :
            editingProfile ? <CrewProfileEditor onBack={() => setEditingProfile(false)} /> :
            <CrewProfile
              onEdit={() => setEditingProfile(true)}
              onWallet={() => setSubView('wallet')}
              onFavorites={() => setSubView('favorites')}
              onHistory={() => setSubView('history')}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Level Up Celebration */}
      <LevelUpCelebration
        open={!!levelUp}
        fromLevel={levelUp?.from || 1}
        toLevel={levelUp?.to || 1}
        onClose={() => setLevelUp(null)}
      />

      {/* Bottom nav — cosmic glass with pill glow */}
      <nav className="fixed bottom-0 left-0 right-0 z-40">
        {/* Gradient fade */}
        <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[#0a0a14] to-transparent pointer-events-none" />
        <div className="relative bg-[#0f0f1a]/90 backdrop-blur-2xl border-t border-white/[0.06]">
          <div className="flex items-center justify-around px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] max-w-md mx-auto">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <motion.button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  whileTap={{ scale: 0.92 }}
                  className="relative flex-1 flex flex-col items-center gap-1 py-1.5"
                >
                  {/* Active pill glow behind icon */}
                  {active && (
                    <motion.div
                      layoutId="crew-nav-pill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute -top-0.5 w-12 h-12 rounded-2xl bg-gradient-to-b from-red-500/25 to-transparent"
                      style={{ boxShadow: '0 -4px 20px -2px rgba(239,68,68,0.35)' }}
                    />
                  )}
                  {/* Top dot indicator */}
                  {active && (
                    <motion.span
                      layoutId="crew-nav-dot"
                      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                      className="absolute -top-1 w-5 h-[3px] rounded-full bg-gradient-to-r from-red-500 to-red-400"
                      style={{ boxShadow: '0 0 10px rgba(239,68,68,0.7)' }}
                    />
                  )}
                  <span className={`relative transition-colors duration-200 ${active ? 'text-white' : 'text-white/30'}`}>
                    {t.icon(active)}
                  </span>
                  <span className={`relative text-[10px] font-bold tracking-wide transition-colors duration-200 ${active ? 'text-white' : 'text-white/25'}`}>
                    {t.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

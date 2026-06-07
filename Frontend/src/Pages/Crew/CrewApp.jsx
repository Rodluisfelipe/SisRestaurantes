import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCrew } from './useCrew';
import CrewLogin from './CrewLogin';
import CrewOnboarding from './CrewOnboarding';
import CrewFeed from './CrewFeed';
import CrewMyShifts from './CrewMyShifts';
import CrewProfile from './CrewProfile';

const TABS = [
  {
    id: 'feed',
    label: 'Explorar',
    icon: (active) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
    ),
  },
  {
    id: 'shifts',
    label: 'Mis turnos',
    icon: (active) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Perfil',
    icon: (active) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
    ),
  },
];

export default function CrewApp() {
  const { isAuthed, worker, refreshMe } = useCrew();
  const [tab, setTab] = useState('feed');

  // Onboarding incompleto = sin skills configurados
  const needsOnboarding = useMemo(() => {
    if (!worker) return false;
    return !worker.skills || worker.skills.length === 0;
  }, [worker]);

  if (!isAuthed) return <CrewLogin onAuthed={refreshMe} />;
  if (needsOnboarding) return <CrewOnboarding onDone={refreshMe} />;

  return (
    <div className="bg-[#0A0A14]">
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'feed' && <CrewFeed />}
          {tab === 'shifts' && <CrewMyShifts />}
          {tab === 'profile' && <CrewProfile />}
        </motion.div>
      </AnimatePresence>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A14]/85 backdrop-blur-xl border-t border-white/[0.06] safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-2 max-w-md mx-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex-1 flex flex-col items-center gap-0.5 py-1.5"
              >
                {active && (
                  <motion.div
                    layoutId="crew-nav-indicator"
                    className="absolute top-0 w-10 h-0.5 bg-gradient-to-r from-[#7B2FFF] to-[#FF6B35] rounded-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />
                )}
                <span className={active ? 'text-[#FF6B35]' : 'text-white/40'}>
                  {t.icon(active)}
                </span>
                <span className={`text-[10px] font-bold transition-colors ${active ? 'text-white' : 'text-white/40'}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/**
 * CrewFavorites — restaurantes guardados por el worker.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import crewApi from '../../services/crewApi';

export default function CrewFavorites({ onBack }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await crewApi.get('/workers/me/favorites');
      setFavorites(data.favorites || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const removeFav = async (businessId) => {
    try {
      await crewApi.delete(`/workers/me/favorites/${businessId}`);
      setFavorites((prev) => prev.filter((f) => String(f.businessId?._id || f.businessId) !== String(businessId)));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a14] text-white font-geist pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a14]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-md mx-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-4 flex items-center gap-3">
          <button onClick={onBack} className="text-white/50 hover:text-white transition" aria-label="Atrás">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-[18px] font-extrabold text-white">Mis Favoritos</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-4 space-y-3">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-white/25" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            </div>
            <p className="text-[14px] font-bold text-white/60 mb-1">Sin favoritos aún</p>
            <p className="text-[12px] text-white/35 max-w-[240px] mx-auto">Guarda restaurantes donde te gustó trabajar para encontrarlos rápido.</p>
          </div>
        ) : (
          <AnimatePresence>
            {favorites.map((fav, i) => {
              const biz = fav.businessId || {};
              return (
                <motion.div
                  key={fav._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                >
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    {biz.logo ? (
                      <img src={biz.logo} alt={biz.businessName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[16px] font-black text-white/40">{(biz.businessName || 'R').charAt(0)}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-white truncate">{biz.businessName || 'Restaurante'}</p>
                    <p className="text-[11px] text-white/40 truncate">{biz.businessType || ''} {biz.address?.neighborhood ? `· ${biz.address.neighborhood}` : ''}</p>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeFav(biz._id)}
                    className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition flex-shrink-0"
                    aria-label="Quitar de favoritos"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

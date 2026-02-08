import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { API_URL } from '../../config';

const BannerCarousel = () => {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const autoplayRef = useRef(null);

  useEffect(() => { loadBanners(); }, []);

  const loadBanners = async () => {
    try {
      const response = await fetch(`${API_URL}/banners`);
      if (response.ok) {
        const data = await response.json();
        setBanners(data.banners || []);
      }
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBannerClick = async (bannerId) => {
    try { await fetch(`${API_URL}/banners/${bannerId}/click`, { method: 'PUT' }); } catch {}
  };

  const goTo = useCallback((idx) => {
    setDirection(idx > currentIndex ? 1 : -1);
    setCurrentIndex(idx);
  }, [currentIndex]);

  const next = useCallback(() => {
    if (banners.length <= 1) return;
    setDirection(1);
    setCurrentIndex(prev => prev === banners.length - 1 ? 0 : prev + 1);
  }, [banners.length]);

  const prev = useCallback(() => {
    if (banners.length <= 1) return;
    setDirection(-1);
    setCurrentIndex(prev => prev === 0 ? banners.length - 1 : prev - 1);
  }, [banners.length]);

  // Autoplay with pause on interaction
  const startAutoplay = useCallback(() => {
    if (autoplayRef.current) clearInterval(autoplayRef.current);
    if (banners.length > 1) {
      autoplayRef.current = setInterval(next, 5000);
    }
  }, [banners.length, next]);

  useEffect(() => {
    startAutoplay();
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current); };
  }, [startAutoplay]);

  // Touch handling for swipe
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    if (autoplayRef.current) clearInterval(autoplayRef.current);
  };

  const handleTouchMove = (e) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    const threshold = 50;
    if (touchDeltaX.current < -threshold) next();
    else if (touchDeltaX.current > threshold) prev();
    startAutoplay();
  };

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0.5 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0.5 }),
  };

  if (loading) {
    return (
      <div className="w-full aspect-[2.5/1] md:aspect-[3/1] bg-gray-100 rounded-2xl overflow-hidden">
        <div className="w-full h-full bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
      </div>
    );
  }

  if (banners.length === 0) {
    return (
      <div className="relative w-full aspect-[2.5/1] md:aspect-[3/1] rounded-2xl overflow-hidden bg-gradient-to-r from-red-500 via-red-600 to-orange-500 shadow-lg shadow-red-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative h-full flex items-center justify-center text-white px-6">
          <div className="text-center">
            <h3 className="text-xl md:text-2xl font-extrabold mb-1 tracking-tight">MenuBy</h3>
            <p className="text-xs md:text-sm opacity-80 font-medium">Descubre los mejores restaurantes cerca de ti</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full aspect-[2.5/1] md:aspect-[3/1] rounded-2xl overflow-hidden shadow-lg shadow-black/5 group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ x: { type: 'spring', stiffness: 350, damping: 35 }, opacity: { duration: 0.2 } }}
          className="absolute inset-0"
        >
          <Link
            to={`/${banners[currentIndex].businessSlug}`}
            onClick={() => handleBannerClick(banners[currentIndex]._id)}
            className="block w-full h-full relative"
          >
            <img
              src={`${API_URL.replace('/api', '')}${banners[currentIndex].image}`}
              alt={banners[currentIndex].title}
              className="w-full h-full object-cover"
              loading={currentIndex === 0 ? 'eager' : 'lazy'}
            />
          </Link>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === currentIndex ? 'bg-white w-5 shadow-sm' : 'bg-white/50 w-1.5 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}

      {/* Nav arrows (show on hover / desktop) */}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => { prev(); startAutoplay(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white active:bg-gray-100 flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10"
          >
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => { next(); startAutoplay(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white active:bg-gray-100 flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10"
          >
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
};

export default BannerCarousel;

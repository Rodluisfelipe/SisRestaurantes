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
      <div className="w-full aspect-[2.5/1] md:aspect-[3/1] bg-white rounded-2xl overflow-hidden shadow-sm">
        <div className="w-full h-full bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-gray-100 via-white to-gray-100" />
      </div>
    );
  }

  if (banners.length === 0) {
    return (
      <div className="relative w-full aspect-[2.5/1] md:aspect-[3/1] rounded-2xl overflow-hidden bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="relative h-full flex items-center justify-center text-white px-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
              <img src="/logo.jpeg" alt="" className="w-8 h-8 rounded-lg object-cover" />
            </div>
            <h3 className="text-lg md:text-xl font-bold mb-0.5">MenuBy</h3>
            <p className="text-[13px] text-white/70 font-medium">Los mejores restaurantes cerca de ti</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full aspect-[2.5/1] md:aspect-[3/1] rounded-2xl overflow-hidden shadow-lg shadow-black/8 group"
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
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentIndex ? 'bg-red-500 w-5 shadow-sm shadow-red-500/50' : 'bg-white/60 w-1.5 hover:bg-white/80'
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
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white/90 hover:bg-white active:bg-gray-50 flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => { next(); startAutoplay(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white/90 hover:bg-white active:bg-gray-50 flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
};

export default BannerCarousel;

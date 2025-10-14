import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { API_URL } from '../../config';

const BannerCarousel = () => {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBanners();
  }, []);

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
    try {
      await fetch(`${API_URL}/banners/${bannerId}/click`, {
        method: 'PUT'
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  };

  // Auto-rotate banners every 5 seconds
  useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => 
          prevIndex === banners.length - 1 ? 0 : prevIndex + 1
        );
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [banners.length]);

  if (loading) {
    return (
      <div className="w-full h-32 bg-slate-100 rounded-2xl animate-pulse mb-6"></div>
    );
  }

  if (banners.length === 0) {
    // Mostrar banner promocional por defecto
    return (
      <div className="relative w-full mb-6">
        <div className="relative w-full h-32 md:h-40 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-r from-red-500 via-red-600 to-orange-500">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative h-full flex items-center justify-center text-white">
            <div className="text-center">
              <h3 className="text-2xl md:text-3xl font-bold mb-2">🚀 MenuBy BETA</h3>
              <p className="text-sm md:text-base opacity-90">Descubre los mejores restaurantes de Chía</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full mb-6">
      {/* Banner Container */}
      <div className="relative w-full h-32 md:h-40 rounded-2xl overflow-hidden shadow-lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <Link
              to={`/${banners[currentIndex].businessSlug}`}
              onClick={() => handleBannerClick(banners[currentIndex]._id)}
              className="block w-full h-full relative group cursor-pointer"
            >
              <img
                src={`${API_URL.replace('/api', '')}${banners[currentIndex].image}`}
                alt={banners[currentIndex].title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              
              {/* Overlay removed - clean image only */}
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Dots */}
      {banners.length > 1 && (
        <div className="flex justify-center space-x-2 mt-4">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-blue-500 w-6'
                  : 'bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      )}

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex(currentIndex === 0 ? banners.length - 1 : currentIndex - 1)}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={() => setCurrentIndex(currentIndex === banners.length - 1 ? 0 : currentIndex + 1)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
};

export default BannerCarousel;

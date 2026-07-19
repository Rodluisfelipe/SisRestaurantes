import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';
import { Siren, TriangleAlert, Megaphone, Info, Check } from 'lucide-react';

const priorityConfig = {
  urgent: {
    color: 'bg-red-500',
    border: 'border-red-500',
    badge: 'bg-red-100 text-red-700',
    icon: Siren,
    label: 'Urgente'
  },
  high: {
    color: 'bg-orange-500',
    border: 'border-orange-500',
    badge: 'bg-orange-100 text-orange-700',
    icon: TriangleAlert,
    label: 'Importante'
  },
  medium: {
    color: 'bg-blue-500',
    border: 'border-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    icon: Megaphone,
    label: 'Información'
  },
  low: {
    color: 'bg-gray-500',
    border: 'border-gray-500',
    badge: 'bg-gray-100 text-gray-700',
    icon: Info,
    label: 'Nota'
  }
};

// Construir URL base para imágenes (sin /api)
const getBaseUrl = () => {
  const apiUrl = API_URL;
  return apiUrl.replace(/\/api$/, '');
};

function AnnouncementPopup() {
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchPendingAnnouncements = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/announcements/pending/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data && data.length > 0) {
        setAnnouncements(data);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  }, []);

  useEffect(() => {
    // Pequeño delay para que el dashboard cargue primero
    const timer = setTimeout(fetchPendingAnnouncements, 1500);
    return () => clearTimeout(timer);
  }, [fetchPendingAnnouncements]);

  const markAsSeen = async (announcementId) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${API_URL}/announcements/${announcementId}/seen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error marking announcement as seen:', error);
    }
  };

  const handleClose = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    const current = announcements[currentIndex];
    if (current) {
      await markAsSeen(current._id);
    }

    setIsClosing(true);
    
    setTimeout(() => {
      setIsClosing(false);
      setImageLoaded(false);
      
      if (currentIndex < announcements.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setIsVisible(false);
      }
      setIsProcessing(false);
    }, 300);
  };

  if (!isVisible || announcements.length === 0) return null;

  const current = announcements[currentIndex];
  const priority = priorityConfig[current.priority] || priorityConfig.medium;
  const baseUrl = getBaseUrl();

  return (
    <AnimatePresence>
      {!isClosing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border-t-4 ${priority.border}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Priority Bar */}
            <div className={`${priority.color} px-5 py-3 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <priority.icon className="w-5 h-5 text-white" />
                <span className="text-white font-bold text-sm uppercase tracking-wider">
                  {priority.label}
                </span>
              </div>
              {announcements.length > 1 && (
                <span className="text-white/80 text-xs font-medium">
                  {currentIndex + 1} de {announcements.length}
                </span>
              )}
            </div>

            {/* Image */}
            {current.image && (
              <div className="relative w-full bg-gray-100">
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                )}
                <img
                  src={`${baseUrl}${current.image}`}
                  alt={current.title}
                  className={`w-full max-h-64 object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    setImageLoaded(true);
                  }}
                />
              </div>
            )}

            {/* Content */}
            <div className="p-5 sm:p-6">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 leading-tight">
                {current.title}
              </h3>
              <div className="text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto pr-1">
                {current.body}
              </div>
              
              {/* Date */}
              <p className="text-xs text-gray-400 mt-4">
                {new Date(current.createdAt).toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            {/* Action Button */}
            <div className="px-5 sm:px-6 pb-5 sm:pb-6">
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className={`w-full ${priority.color} hover:opacity-90 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] text-sm sm:text-base disabled:opacity-50 inline-flex items-center justify-center gap-1.5`}
              >
                {currentIndex < announcements.length - 1
                  ? `Entendido — Siguiente (${announcements.length - currentIndex - 1} más)`
                  : <>Entendido <Check className="w-4 h-4" /></>
                }
              </button>
            </div>

            {/* Close X Button */}
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-50"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AnnouncementPopup;

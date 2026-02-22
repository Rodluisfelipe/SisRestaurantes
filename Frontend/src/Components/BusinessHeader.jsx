import React, { useEffect, useState } from 'react';
import { FaUser, FaHeart, FaClock, FaMapMarkerAlt } from 'react-icons/fa';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useBusinessStatus } from '../hooks/useBusinessStatus';
import { socket } from '../services/socket';
import AccountManagementModal from './AccountManagementModal';
import { useCustomerData } from '../hooks/useCustomerData';

const BusinessHeader = ({ 
  comesFromCatalog = false,
  onShowFavorites,
  onShowHistory,
  showFavoritesButton = false,
  showHistoryButton = false,
  onShowReviews,
  reviewStats
}) => {
  const [businessConfig, setBusinessConfig] = useState({
    businessName: '',
    logo: '',
    coverImage: '',
    isOpen: true,
    whatsappNumber: '',
    address: '',
    googleMapsUrl: '',
    socialMedia: {
      facebook: { url: '', isVisible: true },
      instagram: { url: '', isVisible: true },
      tiktok: { url: '', isVisible: true }
    },
    extraLink: { url: '', isVisible: true }
  });
  const [logoError, setLogoError] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [activeOrderType, setActiveOrderType] = useState('');
  const { businessId } = useBusinessConfig();
  const { businessStatus, getStatusDisplay } = useBusinessStatus(businessId);
  const { customerData, customerOrders, reloadCustomerData } = useCustomerData();

  // Detectar pedidos activos
  useEffect(() => {
    if (customerOrders && customerOrders.length > 0) {
      const activeOrder = customerOrders.find(order => 
        order.status === 'pending' || 
        order.status === 'preparing' || 
        order.status === 'ready' ||
        order.status === 'pending_payment' ||
        order.status === 'payment_uploaded' ||
        order.status === 'payment_confirmed' ||
        order.status === 'inProgress' ||
        order.status === 'confirmed'
      );
      
      if (activeOrder) {
        setHasActiveOrder(true);
        setActiveOrderType(activeOrder.orderType || '');
      } else {
        setHasActiveOrder(false);
        setActiveOrderType('');
      }
    }
  }, [customerOrders]);

  // Listener para recargar datos cuando se actualice la dirección
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key && e.key.includes('customerAddress')) {
        reloadCustomerData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [reloadCustomerData]);

  useEffect(() => {
    const fetchBusinessConfig = async () => {
      try {
        const response = await api.get(`/business-config?businessId=${businessId}`);
        if (response.data && typeof response.data === 'object') {
          setBusinessConfig(prevConfig => ({
            ...prevConfig,
            ...response.data,
            coverImage: response.data.coverImage || '',
            isOpen: response.data.isOpen !== undefined ? response.data.isOpen : true,
            whatsappNumber: response.data.whatsappNumber || '',
            address: response.data.address || '',
            googleMapsUrl: response.data.googleMapsUrl || '',
            socialMedia: {
              facebook: { url: '', isVisible: false, ...response.data?.socialMedia?.facebook },
              instagram: { url: '', isVisible: false, ...response.data?.socialMedia?.instagram },
              tiktok: { url: '', isVisible: false, ...response.data?.socialMedia?.tiktok }
            },
            extraLink: {
              url: '',
              isVisible: false,
              ...response.data?.extraLink
            }
          }));
        }
      } catch (error) {
        // Error silencioso
      }
    };
    fetchBusinessConfig();
    // --- WebSocket: Conexión y listeners ---
    if (socket) {
      socket.connect();
      socket.emit('joinBusiness', businessId);
      socket.on('business_config_update', (data) => {
      setBusinessConfig(prevConfig => ({
        ...prevConfig,
        ...data,
        coverImage: data.coverImage || '',
        isOpen: data.isOpen !== undefined ? data.isOpen : true,
        whatsappNumber: data.whatsappNumber || '',
        address: data.address || '',
        googleMapsUrl: data.googleMapsUrl || '',
        socialMedia: {
          facebook: { url: '', isVisible: false, ...data?.socialMedia?.facebook },
          instagram: { url: '', isVisible: false, ...data?.socialMedia?.instagram },
          tiktok: { url: '', isVisible: false, ...data?.socialMedia?.tiktok }
        },
        extraLink: {
          url: '',
          isVisible: false,
          ...data?.extraLink
        }
      }));
    });
    }
    
    return () => {
      if (socket) {
        socket.emit('leaveBusiness', businessId);
        socket.off('business_config_update');
        socket.disconnect();
      }
    };
    // Reducir la frecuencia de actualización a cada 5 minutos
    // const intervalId = setInterval(fetchBusinessConfig, 5 * 60 * 1000);
    // return () => clearInterval(intervalId);
  }, [businessId]);

  const defaultLogo = 'https://placehold.co/150x150?text=Logo';


  return (
    <div className="w-full text-center relative min-h-[160px] sm:min-h-[200px]">
      {/* Cover Image Background */}
      {businessConfig.coverImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: `url(${businessConfig.coverImage})`,
            filter: 'brightness(0.7)'
          }}
        />
      )}
      
      {/* Overlay for better text readability */}
      <div className={`absolute inset-0 ${businessConfig.coverImage ? 'bg-black bg-opacity-40' : 'bg-white'}`} />
      
      {/* Content Container */}
      <div className={`relative z-10 pt-3 pb-2 ${businessConfig.coverImage ? 'text-white' : 'text-gray-800'}`}>
        {/* Top-right action buttons — compact icon-only row */}
        <div className="absolute right-2.5 top-3 z-20 flex items-center gap-1.5">
          {showFavoritesButton && (
            <button
              onClick={onShowFavorites}
              className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-sm active:scale-90 transition-transform"
              aria-label="Favoritos"
            >
              <FaHeart className="text-[10px]" />
            </button>
          )}
          {showHistoryButton && (
            <button
              onClick={onShowHistory}
              className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-sm active:scale-90 transition-transform"
              aria-label="Historial de pedidos"
            >
              <FaClock className="text-[10px]" />
            </button>
          )}
          <button
            onClick={() => setShowAccountModal(true)}
            className="relative w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-sm active:scale-90 transition-transform"
            aria-label={hasActiveOrder ? 'Ver estado del pedido' : 'Mi cuenta'}
          >
            <FaUser className="text-[10px]" />
            {hasActiveOrder && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-1 ring-white/50 animate-pulse" />
            )}
          </button>
        </div>

        {/* Status Badge — top left */}
        <div className={`absolute ${comesFromCatalog ? 'right-3 top-10' : 'left-2.5 top-3'} z-20`}>
          <span 
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs rounded-full font-bold shadow-md ${getStatusDisplay().color} text-white`}
          >
            {getStatusDisplay().text}
          </span>
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-1">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-white shadow-lg border-2 border-white">
            <img 
              src={businessConfig.logo || defaultLogo}
              alt={`Logo de ${businessConfig.businessName || 'negocio'}`}
              className="w-full h-full object-cover"
              loading="eager"
              width="80"
              height="80"
              fetchPriority="high"
              onError={(e) => {
                if (!logoError) { setLogoError(true); e.target.src = defaultLogo; }
              }}
            />
          </div>
        </div>

        {/* Business Name & Info */}
        <div className="flex flex-col items-center px-4">
          <h1 className={`text-xl sm:text-2xl font-bold mb-0.5 ${businessConfig.coverImage ? 'text-white' : 'text-gray-800'}`}>
            {businessConfig.businessName || 'Mi Restaurante'}
          </h1>
          
          {/* Rating chip */}
          {reviewStats && reviewStats.totalReviews > 0 && (
            <button
              onClick={onShowReviews}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                businessConfig.coverImage
                  ? 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <span>⭐</span>
              <span>{reviewStats.averageRating.toFixed(1)}</span>
              <span className={businessConfig.coverImage ? 'text-white/60' : 'text-amber-400'}>·</span>
              <span className={businessConfig.coverImage ? 'text-white/80' : 'text-amber-600'}>{reviewStats.totalReviews} reseñas</span>
              <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}

          {/* Address + Social — compact inline row */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
          {businessConfig?.address && (
            <a 
              href={businessConfig?.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(businessConfig.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-xs transition-colors max-w-[200px] truncate ${
                businessConfig.coverImage 
                  ? 'text-white/80 hover:text-white' 
                  : 'text-gray-500 hover:text-blue-600'
              }`}
            >
              <FaMapMarkerAlt className="text-[10px] flex-shrink-0" />
              <span className="truncate">{businessConfig.address}</span>
            </a>
          )}
          
          {/* Social Media Icons */}
          <div className="flex items-center gap-3">
            {businessConfig?.socialMedia?.facebook?.isVisible && businessConfig?.socialMedia?.facebook?.url && (
              <a 
                href={businessConfig?.socialMedia?.facebook?.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`transition-colors ${
                  businessConfig.coverImage 
                    ? 'text-white hover:text-blue-300' 
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"/>
                </svg>
              </a>
            )}
            
            {businessConfig?.socialMedia?.instagram?.isVisible && businessConfig?.socialMedia?.instagram?.url && (
              <a 
                href={businessConfig?.socialMedia?.instagram?.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`transition-colors ${
                  businessConfig.coverImage 
                    ? 'text-white hover:text-pink-300' 
                    : 'text-gray-600 hover:text-pink-600'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            )}
            
            {businessConfig?.socialMedia?.tiktok?.isVisible && businessConfig?.socialMedia?.tiktok?.url && (
              <a 
                href={businessConfig?.socialMedia?.tiktok?.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`transition-colors ${
                  businessConfig.coverImage 
                    ? 'text-white hover:text-gray-300' 
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 00-1-.08A6.34 6.34 0 003 15.66a6.34 6.34 0 0010.86 4.49v.02h3.45v-9.4a7.29 7.29 0 004.28 1.38V8.7a4.78 4.78 0 01-2-2.01z"/>
                </svg>
              </a>
            )}
            
            {businessConfig?.extraLink?.isVisible && businessConfig?.extraLink?.url && (
              <a 
                href={businessConfig?.extraLink?.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`transition-colors ${
                  businessConfig.coverImage 
                    ? 'text-white hover:text-blue-300' 
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </a>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Account Management Modal */}
      <AccountManagementModal 
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        customerData={customerData}
        orders={customerOrders}
        initialTab={hasActiveOrder ? 'orders' : 'profile'}
      />
    </div>
  );
};

export default BusinessHeader; 
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
  showHistoryButton = false
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
        order.status === 'ready'
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
  const buttonColor = businessConfig.theme?.buttonColor || '#3B82F6';
  const hasCover = !!businessConfig.coverImage;

  // Collect social links
  const socialLinks = [
    businessConfig?.socialMedia?.facebook?.isVisible && businessConfig?.socialMedia?.facebook?.url && {
      key: 'fb', href: businessConfig.socialMedia.facebook.url,
      icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"/></svg>
    },
    businessConfig?.socialMedia?.instagram?.isVisible && businessConfig?.socialMedia?.instagram?.url && {
      key: 'ig', href: businessConfig.socialMedia.instagram.url,
      icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
    },
    businessConfig?.socialMedia?.tiktok?.isVisible && businessConfig?.socialMedia?.tiktok?.url && {
      key: 'tt', href: businessConfig.socialMedia.tiktok.url,
      icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 00-1-.08A6.34 6.34 0 003 15.66a6.34 6.34 0 0010.86 4.49v.02h3.45v-9.4a7.29 7.29 0 004.28 1.38V8.7a4.78 4.78 0 01-2-2.01z"/></svg>
    },
    businessConfig?.extraLink?.isVisible && businessConfig?.extraLink?.url && {
      key: 'link', href: businessConfig.extraLink.url,
      icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
    }
  ].filter(Boolean);

  return (
    <div className="w-full relative">
      {/* ═══════════════ HERO COVER SECTION ═══════════════ */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/7', minHeight: '140px', maxHeight: '220px' }}>
        {/* Cover image or gradient fallback */}
        {hasCover ? (
          <img
            src={businessConfig.coverImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${buttonColor}, ${buttonColor}dd, ${buttonColor}99)` }}
          />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />

        {/* ── Top action bar (glassmorphic icons) ── */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between">
          {/* Status badge — top left */}
          <div className={`${comesFromCatalog ? 'opacity-0 pointer-events-none' : ''}`}>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-full shadow-lg backdrop-blur-md ${
              getStatusDisplay().color === 'bg-green-500' 
                ? 'bg-green-500/80 text-white' 
                : 'bg-red-500/80 text-white'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                getStatusDisplay().color === 'bg-green-500' ? 'bg-green-200' : 'bg-red-200'
              }`} />
              {getStatusDisplay().text}
            </span>
          </div>

          {/* Action buttons — top right */}
          <div className="flex items-center gap-1.5">
            {showFavoritesButton && (
              <button
                onClick={onShowFavorites}
                className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform"
                aria-label="Favoritos"
              >
                <FaHeart className="text-xs" />
              </button>
            )}
            {showHistoryButton && (
              <button
                onClick={onShowHistory}
                className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform"
                aria-label="Historial de pedidos"
              >
                <FaClock className="text-xs" />
              </button>
            )}
            <button
              onClick={() => setShowAccountModal(true)}
              className="relative w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform"
              aria-label={hasActiveOrder ? 'Ver estado del pedido' : 'Mi cuenta'}
            >
              <FaUser className="text-xs" />
              {hasActiveOrder && (
                <>
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-black/30 animate-pulse" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ INFO SECTION (below cover) ═══════════════ */}
      <div className="relative bg-white px-4 pb-3 pt-12">
        {/* Logo — overlapping the cover/info boundary */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-10 z-10">
          <div className="w-[76px] h-[76px] sm:w-[88px] sm:h-[88px] rounded-2xl overflow-hidden bg-white shadow-xl ring-[3px] ring-white">
            <img 
              src={businessConfig.logo || defaultLogo}
              alt={`Logo de ${businessConfig.businessName || 'negocio'}`}
              className="w-full h-full object-cover"
              loading="eager"
              width="88"
              height="88"
              fetchPriority="high"
              onError={(e) => {
                if (!logoError) { setLogoError(true); e.target.src = defaultLogo; }
              }}
            />
          </div>
        </div>

        {/* Business name */}
        <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 text-center leading-tight">
          {businessConfig.businessName || 'Mi Restaurante'}
        </h1>

        {/* Address chip + social icons — single compact row */}
        <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
          {businessConfig?.address && (
            <a 
              href={businessConfig?.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(businessConfig.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-gray-500 hover:text-gray-700 transition-colors max-w-[220px] truncate"
            >
              <FaMapMarkerAlt className="text-[10px] flex-shrink-0 text-gray-400" />
              <span className="truncate">{businessConfig.address}</span>
            </a>
          )}

          {/* Divider between address and social */}
          {businessConfig?.address && socialLinks.length > 0 && (
            <span className="w-px h-3 bg-gray-200" />
          )}

          {/* Social icons inline */}
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-2">
              {socialLinks.map(link => (
                <a
                  key={link.key}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {link.icon}
                </a>
              ))}
            </div>
          )}
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
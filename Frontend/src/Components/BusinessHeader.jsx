import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import AccountManagementModal from './AccountManagementModal';
import { useCustomerData } from '../hooks/useCustomerData';

/* ── Minimal SVG icons (stroke-based, admin panel style) ── */
const HI = {
  user: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  heart: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  clock: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  mapPin: (cls = 'w-3 h-3') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  star: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  chevron: (cls = 'w-3 h-3') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7"/></svg>,
};

const BusinessHeader = ({ 
  comesFromCatalog = false,
  onShowFavorites,
  onShowHistory,
  onShowLoyalty,
  showFavoritesButton = false,
  showHistoryButton = false,
  showLoyaltyButton = false,
  onShowReviews,
  reviewStats,
  subscriptionPlanType,
  subscriptionCommercialPlan
}) => {
  const [logoError, setLogoError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const coverRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [activeOrderType, setActiveOrderType] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState(null);
  const { businessId, businessConfig, businessStatus, getStatusDisplay } = useBusinessConfig();
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

  const defaultLogo = 'https://placehold.co/150x150?text=Logo';
  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';

  /* La portada colapsa a un header compacto al hacer scroll. El listener es
     pasivo y se agrupa con rAF para no penalizar el scroll en gama baja. */
  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const h = coverRef.current?.offsetHeight || 260;
      // Colapsa cuando la portada ya salió casi por completo de la vista
      setCollapsed(window.scrollY > Math.max(120, h - 90));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  /* Publica la altura del header compacto para que otros elementos sticky
     (las pills de categoría) se peguen justo debajo y no se superpongan. */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--mb-header-h', collapsed ? '52px' : '0px');
    return () => root.style.setProperty('--mb-header-h', '0px');
  }, [collapsed]);

  // Fetch loyalty points for the customer
  useEffect(() => {
    if (!showLoyaltyButton || !customerData?.phone || !businessId) return;
    api.get('/loyalty/balance', { params: { businessId, phone: customerData.phone } })
      .then(res => {
        if (res.data?.active) setLoyaltyPoints(res.data.points ?? 0);
      })
      .catch(() => {});
  }, [showLoyaltyButton, customerData?.phone, businessId]);

  // Collect visible action buttons for the pill bar
  const actionButtons = [];
  if (showLoyaltyButton) actionButtons.push({ key: 'loyalty', icon: HI.star, label: 'Puntos de fidelidad', onClick: onShowLoyalty, color: 'text-yellow-300', colorLight: 'text-amber-500', badge: loyaltyPoints !== null ? loyaltyPoints : false });
  if (showFavoritesButton) actionButtons.push({ key: 'favs', icon: HI.heart, label: 'Favoritos', onClick: onShowFavorites, color: 'text-white', colorLight: 'text-rose-500' });
  if (showHistoryButton) actionButtons.push({ key: 'history', icon: HI.clock, label: 'Historial', onClick: onShowHistory, color: 'text-white', colorLight: 'text-blue-500' });
  actionButtons.push({ key: 'account', icon: HI.user, label: hasActiveOrder ? 'Ver pedido' : 'Mi cuenta', onClick: () => setShowAccountModal(true), color: 'text-white', colorLight: 'text-slate-600', badge: hasActiveOrder });

  const hasCover = !!businessConfig.coverImage;
  const normalizedCommercialPlan = (subscriptionCommercialPlan || '').toLowerCase();
  const hasVerifiedBadge =
    ['starter', 'pro', 'pro_max'].includes(normalizedCommercialPlan) ||
    (!normalizedCommercialPlan && (subscriptionPlanType === 'annual' || subscriptionPlanType === 'semiannual'));

  const verifiedToneClass = normalizedCommercialPlan === 'pro_max'
    ? (hasCover ? 'text-amber-300 drop-shadow' : 'text-amber-500')
    : normalizedCommercialPlan === 'starter'
      ? (hasCover ? 'text-rose-300 drop-shadow' : 'text-rose-500')
      : normalizedCommercialPlan === 'pro'
        ? (hasCover ? 'text-blue-300 drop-shadow' : 'text-blue-500')
        : (hasCover ? 'text-slate-300 drop-shadow' : 'text-slate-500');

  const verifiedLabel = normalizedCommercialPlan === 'pro_max'
    ? 'Negocio verificado Pro Max'
    : normalizedCommercialPlan === 'pro'
      ? 'Negocio verificado Pro'
      : normalizedCommercialPlan === 'starter'
        ? 'Negocio verificado Starter'
        : 'Negocio verificado';

  return (
    <div className="w-full relative -mt-[env(safe-area-inset-top,0px)]">
      {/* ── Portada cinematográfica — todo vive dentro de la foto ── */}
      <div
        ref={coverRef}
        className="relative flex flex-col"
        style={hasCover ? { minHeight: '44vh' } : undefined}
      >
        {/* Background: cover image or fallback gradient */}
        {hasCover ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${businessConfig.coverImage})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />
            {/* El contenido "emerge" de la foto: funde hacia el fondo de la página */}
            <div
              className="absolute inset-x-0 bottom-0 h-28 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, rgba(249,250,251,0), #F9FAFB)' }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${themeColor}30 0%, ${themeColor}15 50%, ${themeColor}25 100%)` }}
          />
        )}

        {/* ── Content floating inside the cover ── */}
        <div className="relative z-10 px-4 pt-[max(env(safe-area-inset-top,4px),4px)] pb-4 flex-1 flex flex-col">
          {/* Top row: Status left — Action buttons right */}
          <div className="flex items-center justify-between mb-2">
            {/* Status Badge */}
            <span 
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-full ${
                hasCover
                  ? 'bg-black/30 backdrop-blur-sm text-white border border-white/10'
                  : `${getStatusDisplay().color} text-white`
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                businessStatus?.isOpen ? 'bg-emerald-400' : 'bg-red-400'
              } ${businessStatus?.isOpen ? 'animate-pulse' : ''}`} />
              {getStatusDisplay().text}
            </span>

            {/* Frosted Action Pill */}
            <div className={`inline-flex items-center gap-0.5 px-0.5 py-0.5 rounded-2xl ${
              hasCover
                ? 'bg-black/25 backdrop-blur-md border border-white/10'
                : 'bg-slate-100 border border-slate-200'
            }`}>
              {actionButtons.map((btn) => (
                <button
                  key={btn.key}
                  onClick={btn.onClick}
                  className={`relative w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                    hasCover ? `${btn.color} hover:bg-white/15` : `${btn.colorLight} hover:bg-slate-200`
                  }`}
                  aria-label={btn.label}
                >
                  {btn.icon('w-3.5 h-3.5')}
                  {btn.badge !== undefined && btn.badge !== false && (
                    typeof btn.badge === 'number' ? (
                      <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-[16px] flex items-center justify-center px-1 rounded-full text-[8px] font-bold ring-1 ${
                        hasCover
                          ? 'bg-amber-400 text-amber-950 ring-black/20'
                          : 'bg-amber-400 text-amber-950 ring-white'
                      }`}>
                        {btn.badge}
                      </span>
                    ) : (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-1 ring-white/50 animate-pulse" />
                    )
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Empuja la identidad al centro-inferior de la portada */}
          {hasCover && <div className="flex-1 min-h-[8px]" />}

          {/* Center: Logo + Name + Info — centered column */}
          <div className="flex flex-col items-center gap-1.5">
            {/* Logo */}
            <div
              className="w-[88px] h-[88px] rounded-full p-[3px] shadow-xl"
              style={{ 
                background: businessStatus?.isOpen 
                  ? `linear-gradient(135deg, ${themeColor}, ${themeColor}90)` 
                  : 'linear-gradient(135deg, #94a3b8, #cbd5e1)'
              }}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-white">
                <img 
                  src={businessConfig.logo || defaultLogo}
                  alt={`Logo de ${businessConfig.businessName || 'negocio'}`}
                  className="w-full h-full object-cover"
                  loading="eager"
                  width="92"
                  height="92"
                  fetchPriority="high"
                  onError={(e) => {
                    if (!logoError) { setLogoError(true); e.target.src = defaultLogo; }
                  }}
                />
              </div>
            </div>

            {/* Name + Verified badge */}
            <div className="flex items-center justify-center gap-1.5">
              <h1 className={`text-lg sm:text-xl font-extrabold tracking-tight leading-tight text-center ${hasCover ? 'text-white drop-shadow-md' : 'text-slate-800'}`}>
                {businessConfig.businessName || 'Mi Negocio'}
              </h1>
              {hasVerifiedBadge && (
                <span className={`inline-flex items-center shrink-0 ${verifiedToneClass}`} title={verifiedLabel}>
                  <svg className="w-[18px] h-[18px] sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </div>

            {/* Meta row: rating + address + socials */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
                {/* Rating interno — según preferencia del negocio (both/internal) */}
                {['both', 'internal'].includes(businessConfig?.reviewsDisplay || 'both') && reviewStats && reviewStats.totalReviews > 0 && (
                  <button
                    onClick={() => onShowReviews('internal')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                      hasCover ? 'bg-white/15 backdrop-blur-sm text-white' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <span className={hasCover ? 'text-amber-300' : 'text-amber-400'}>{HI.star('w-3 h-3')}</span>
                    <span className="font-bold">{reviewStats.averageRating.toFixed(1)}</span>
                    <span className="opacity-50">·</span>
                    <span className="opacity-70">{reviewStats.totalReviews}</span>
                  </button>
                )}

                {/* Google rating badge — según preferencia del negocio (both/google) */}
                {['both', 'google'].includes(businessConfig?.reviewsDisplay || 'both') && businessConfig?.google?.rating > 0 && (
                  <button
                    onClick={() => {
                      if (businessConfig.google.reviews?.length > 0) onShowReviews('google');
                      else window.open(businessConfig.google.mapsUrl || businessConfig.google.reviewUrl || '#', '_blank', 'noopener');
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                      hasCover ? 'bg-white/15 backdrop-blur-sm text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    aria-label={`Calificación de Google: ${businessConfig.google.rating}`}
                  >
                    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                    <span className="font-bold">{businessConfig.google.rating.toFixed(1)}</span>
                    <span className={hasCover ? 'text-amber-300' : 'text-amber-400'}>{HI.star('w-3 h-3')}</span>
                    {businessConfig.google.reviewCount > 0 && (
                      <span className="opacity-60">{businessConfig.google.reviewCount}</span>
                    )}
                  </button>
                )}

                {/* Address / Maps button */}
                {(businessConfig?.address || businessConfig?.googleMapsUrl || businessConfig?.location?.coordinates?.lat) && (
                  <a
                    href={(() => {
                      const lat = businessConfig?.location?.coordinates?.lat;
                      const lng = businessConfig?.location?.coordinates?.lng;
                      if (businessConfig?.googleMapsUrl) return businessConfig.googleMapsUrl;
                      if (lat && lng) return `https://maps.google.com/?q=${lat},${lng}`;
                      return `https://maps.google.com/?q=${encodeURIComponent(businessConfig.address)}`;
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                      hasCover
                        ? 'bg-white/15 backdrop-blur-sm text-white/80 hover:text-white hover:bg-white/25'
                        : 'bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {HI.mapPin('w-3 h-3 flex-shrink-0')}
                    <span className="truncate max-w-[160px]">{businessConfig.address || 'Ver en el mapa'}</span>
                  </a>
                )}

                {/* Social icons inline */}
                {businessConfig?.socialMedia?.facebook?.isVisible && businessConfig?.socialMedia?.facebook?.url && (
                  <a href={businessConfig.socialMedia.facebook.url} target="_blank" rel="noopener noreferrer" className={`${hasCover ? 'text-white/40 hover:text-white/80' : 'text-slate-300 hover:text-blue-600'} transition-colors`}>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"/></svg>
                  </a>
                )}
                {businessConfig?.socialMedia?.instagram?.isVisible && businessConfig?.socialMedia?.instagram?.url && (
                  <a href={businessConfig.socialMedia.instagram.url} target="_blank" rel="noopener noreferrer" className={`${hasCover ? 'text-white/40 hover:text-white/80' : 'text-slate-300 hover:text-pink-600'} transition-colors`}>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12s.014 3.668.072 4.948c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24s3.668-.014 4.948-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  </a>
                )}
                {businessConfig?.socialMedia?.tiktok?.isVisible && businessConfig?.socialMedia?.tiktok?.url && (
                  <a href={businessConfig.socialMedia.tiktok.url} target="_blank" rel="noopener noreferrer" className={`${hasCover ? 'text-white/40 hover:text-white/80' : 'text-slate-300 hover:text-black'} transition-colors`}>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 00-1-.08A6.34 6.34 0 003 15.66a6.34 6.34 0 0010.86 4.49v.02h3.45v-9.4a7.29 7.29 0 004.28 1.38V8.7a4.78 4.78 0 01-2-2.01z"/></svg>
                  </a>
                )}
                {businessConfig?.extraLink?.isVisible && businessConfig?.extraLink?.url && (
                  <a href={businessConfig.extraLink.url} target="_blank" rel="noopener noreferrer" className={`${hasCover ? 'text-white/40 hover:text-white/80' : 'text-slate-300 hover:text-blue-600'} transition-colors`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  </a>
                )}
              </div>
          </div>
        </div>
      </div>

      {/* ── Header compacto sticky: aparece cuando la portada sale de vista ── */}
      <AnimatePresence>
        {collapsed && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { y: -64, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: -64, opacity: 0 }}
            transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed top-0 left-0 right-0 z-40"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div
              className="flex items-center gap-2.5 px-3 py-2 border-b"
              style={{
                background: 'rgba(255,255,255,0.86)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                borderColor: 'rgba(15,23,42,0.07)',
              }}
            >
              <img
                src={businessConfig.logo || defaultLogo}
                alt=""
                aria-hidden="true"
                className="w-8 h-8 rounded-full object-cover shrink-0"
                style={{ boxShadow: `0 0 0 2px ${themeColor}33` }}
                onError={(e) => { e.target.src = defaultLogo; }}
              />
              <p className="flex-1 min-w-0 truncate text-[14px] font-extrabold tracking-tight text-slate-800">
                {businessConfig.businessName || 'Mi Negocio'}
              </p>
              {/* Estado, para no perder la señal de abierto/cerrado al colapsar */}
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${
                  businessStatus?.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${businessStatus?.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {businessStatus?.isOpen ? 'Abierto' : 'Cerrado'}
              </span>
              {/* Acciones compactas (mismas del hero) */}
              <div className="flex items-center gap-1 shrink-0">
                {actionButtons.slice(-2).map((btn) => (
                  <button
                    key={btn.key}
                    onClick={btn.onClick}
                    aria-label={btn.label}
                    title={btn.label}
                    className="relative w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    <span className={btn.colorLight}>{btn.icon('w-4 h-4')}</span>
                    {btn.badge && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full text-[8px] font-bold text-white bg-emerald-500 ring-2 ring-white">
                        {typeof btn.badge === 'number' ? btn.badge : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import AccountManagementModal from './AccountManagementModal';
import { useCustomerData } from '../hooks/useCustomerData';

/* ── Iconos SVG (mismo patrón que el resto del menú) ── */
const PH = {
  star: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  heart: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>,
  clock: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  mapPin: (cls = 'w-3 h-3') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  share: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" /></svg>,
  history: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 106 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>,
  whatsapp: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" /></svg>,
  verified: (cls = 'w-[18px] h-[18px]') => <svg className={cls} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
};

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DEFAULT_LOGO = 'https://placehold.co/150x150?text=Logo';

/**
 * ProfileHeader — cabecera del menú V2, patrón "perfil".
 * Banner delgado + avatar montado + stats tocables + botonera.
 * Solo presentación: toda la lógica (carrito, sheets, lealtad) sigue en Menu.jsx.
 */
export default function ProfileHeader({
  onShowFavorites,
  onShowHistory,
  onShowReviews,
  showFavoritesButton = false,
  showHistoryButton = false,
  reviewStats,
  subscriptionCommercialPlan,
}) {
  const { businessId, businessConfig, businessStatus } = useBusinessConfig();
  const { customerData, customerOrders } = useCustomerData();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [deliveryRange, setDeliveryRange] = useState(null);
  const headerRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const name = businessConfig?.businessName || 'Mi Negocio';
  const logo = businessConfig?.logo || DEFAULT_LOGO;
  const isOpen = !!businessStatus?.isOpen;

  /* Rango de entrega REAL: sale de las zonas de entrega del negocio.
     (deliverySettings no tiene tiempos: solo config de asignación de domis.) */
  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    api.get(`/delivery-zones/public?businessId=${businessId}`)
      .then((res) => {
        if (!alive) return;
        const zones = res.data?.zones || [];
        const mins = zones.map((z) => z?.estimatedTime?.min).filter((n) => typeof n === 'number');
        const maxs = zones.map((z) => z?.estimatedTime?.max).filter((n) => typeof n === 'number');
        if (mins.length && maxs.length) {
          setDeliveryRange({ min: Math.min(...mins), max: Math.max(...maxs) });
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [businessId]);

  /* Colapso al scroll — publica su altura para que las pills de categoría
     (sticky) se peguen justo debajo en vez de superponerse. */
  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const h = headerRef.current?.offsetHeight || 260;
      setCollapsed(window.scrollY > Math.max(120, h - 80));
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

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--mb-header-h', collapsed ? '52px' : '0px');
    return () => root.style.setProperty('--mb-header-h', '0px');
  }, [collapsed]);

  const hasActiveOrder = (customerOrders || []).some((o) =>
    ['pending', 'preparing', 'ready', 'confirmed', 'inProgress', 'pending_payment', 'payment_uploaded', 'payment_confirmed'].includes(o.status)
  );

  /* Chip de estado: "Abierto · cierra 22:00" / "Cerrado · abre 10:00" */
  const todayHours = businessConfig?.businessHours?.[DAYS[new Date().getDay()]];
  const statusLabel = isOpen
    ? (todayHours?.closeTime ? `Abierto · cierra ${todayHours.closeTime}` : 'Abierto')
    : (businessStatus?.nextOpenTime?.time ? `Cerrado · abre ${businessStatus.nextOpenTime.time}` : 'Cerrado');

  /* Rating: Google si está permitido, si no el interno */
  const display = businessConfig?.reviewsDisplay || 'both';
  const googleRating = ['both', 'google'].includes(display) ? businessConfig?.google?.rating : null;
  const internalRating = ['both', 'internal'].includes(display) && reviewStats?.totalReviews > 0 ? reviewStats.averageRating : null;
  const rating = googleRating || internalRating;
  const reviewCount = googleRating ? businessConfig?.google?.reviewCount : reviewStats?.totalReviews;

  const mapsUrl = businessConfig?.googleMapsUrl
    || (businessConfig?.location?.coordinates?.lat
      ? `https://maps.google.com/?q=${businessConfig.location.coordinates.lat},${businessConfig.location.coordinates.lng}`
      : businessConfig?.address ? `https://maps.google.com/?q=${encodeURIComponent(businessConfig.address)}` : null);

  const waNumber = (businessConfig?.whatsappNumber || '').replace(/\D/g, '');
  const waHref = waNumber
    ? `https://wa.me/${waNumber.length <= 10 ? (businessConfig?.phoneCountryCode || '+57').replace(/\D/g, '') + waNumber : waNumber}`
    : null;

  const plan = (subscriptionCommercialPlan || '').toLowerCase();
  const isVerified = ['starter', 'pro', 'pro_max'].includes(plan);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else await navigator.clipboard.writeText(url);
    } catch { /* el usuario canceló */ }
  };

  const glassBtn = 'w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors';
  const glassStyle = { background: 'rgba(0,0,0,0.34)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' };

  return (
    <div ref={headerRef} className="relative">
      {/* ── Banner 128px ── */}
      <div className="relative h-32 overflow-hidden">
        {businessConfig?.coverImage ? (
          <>
            <img src={businessConfig.coverImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)' }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--mb-accent-soft), var(--mb-accent-softer))' }} />
        )}
        {/* Funde hacia el fondo del menú */}
        <div className="absolute inset-x-0 bottom-0 h-14" style={{ background: 'linear-gradient(to bottom, transparent, var(--mb-surface))' }} />

        {/* Chip de estado */}
        <div className="absolute top-3 left-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
            style={glassStyle}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {statusLabel}
          </span>
        </div>

        {/* Acciones glass */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {showHistoryButton && (
            <button onClick={onShowHistory} className={glassBtn} style={glassStyle} aria-label="Mis pedidos" title="Mis pedidos">
              {PH.history()}
            </button>
          )}
          <button onClick={handleShare} className={glassBtn} style={glassStyle} aria-label="Compartir" title="Compartir">
            {PH.share()}
          </button>
        </div>
      </div>

      {/* ── Perfil ── */}
      <div className="px-4">
        {/* Avatar montado sobre el banner */}
        <div className="-mt-[42px] relative z-10 flex items-end justify-between">
          <div
            className="w-[92px] h-[92px] rounded-full p-[3px]"
            style={{ background: 'conic-gradient(from 180deg, var(--mb-accent), var(--mb-ring-partner), var(--mb-accent))' }}
          >
            <div className="w-full h-full rounded-full overflow-hidden" style={{ border: '3.5px solid var(--mb-surface)', background: 'var(--mb-card)' }}>
              <img
                src={logoError ? DEFAULT_LOGO : logo}
                alt={`Logo de ${name}`}
                className="w-full h-full object-cover"
                loading="eager"
                fetchPriority="high"
                onError={() => setLogoError(true)}
              />
            </div>
          </div>

          {/* Stats — tocables */}
          <div className="flex items-center gap-5 pb-1.5">
            {rating > 0 && (
              <button onClick={() => onShowReviews(googleRating ? 'google' : 'internal')} className="text-center active:scale-95 transition-transform">
                <span className="flex items-center justify-center gap-1 text-[17px] font-extrabold tabular-nums" style={{ color: 'var(--mb-ink)' }}>
                  <span className="text-amber-400">{PH.star('w-4 h-4')}</span>{rating.toFixed(1)}
                </span>
                <span className="block text-[11px] font-medium" style={{ color: 'var(--mb-ink-2)' }}>calificación</span>
              </button>
            )}
            {reviewCount > 0 && (
              <button onClick={() => onShowReviews(googleRating ? 'google' : 'internal')} className="text-center active:scale-95 transition-transform">
                <span className="block text-[17px] font-extrabold tabular-nums" style={{ color: 'var(--mb-ink)' }}>{reviewCount}</span>
                <span className="block text-[11px] font-medium" style={{ color: 'var(--mb-ink-2)' }}>reseñas</span>
              </button>
            )}
            {deliveryRange && (
              <div className="text-center">
                <span className="block text-[17px] font-extrabold tabular-nums" style={{ color: 'var(--mb-ink)' }}>
                  {deliveryRange.min}-{deliveryRange.max}′
                </span>
                <span className="block text-[11px] font-medium" style={{ color: 'var(--mb-ink-2)' }}>entrega</span>
              </div>
            )}
          </div>
        </div>

        {/* Nombre + verificado */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <h1 className="text-[21px] font-extrabold tracking-tight leading-tight" style={{ color: 'var(--mb-ink)' }}>{name}</h1>
          {isVerified && (
            <span style={{ color: 'var(--mb-accent)' }} title="Negocio verificado">{PH.verified()}</span>
          )}
        </div>

        {/* Tagline / descripción */}
        {(businessConfig?.tagline || businessConfig?.description) && (
          <p className="text-[13.5px] leading-snug mt-0.5 line-clamp-1" style={{ color: 'var(--mb-ink-2)' }}>
            {businessConfig.tagline || businessConfig.description}
          </p>
        )}

        {/* Dirección / mapa */}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-[12.5px] font-semibold"
            style={{ color: 'var(--mb-ink-2)' }}
          >
            {PH.mapPin()}
            <span className="truncate max-w-[240px]">{businessConfig?.address || 'Ver en el mapa'}</span>
          </a>
        )}

        {/* Botonera — sin "Pedir ahora": el menú ya está justo debajo y el
            carrito vive en el bottom nav, así que ese CTA sobraba. */}
        {(waHref || showFavoritesButton) && (
          <div className="flex items-stretch gap-2 mt-3.5">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 flex items-center justify-center gap-1.5 rounded-[var(--mb-radius-btn)] text-[13.5px] font-bold active:scale-[0.98] transition-transform"
                style={{ background: 'var(--mb-surface-2)', color: 'var(--mb-ink)', border: '1px solid var(--mb-line)' }}
              >
                <span className="text-[#25D366]">{PH.whatsapp()}</span>
                WhatsApp
              </a>
            )}
            {showFavoritesButton && (
              <button
                onClick={onShowFavorites}
                className={`${waHref ? 'w-12' : 'flex-1'} py-2.5 flex items-center justify-center gap-1.5 rounded-[var(--mb-radius-btn)] text-[13.5px] font-bold active:scale-[0.95] transition-transform`}
                style={{ background: 'var(--mb-surface-2)', color: 'var(--mb-ink-2)', border: '1px solid var(--mb-line)' }}
                aria-label="Favoritos"
                title="Favoritos"
              >
                {PH.heart()}
                {!waHref && <span>Favoritos</span>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Header compacto sticky ── */}
      <AnimatePresence>
        {collapsed && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { y: -64, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: -64, opacity: 0 }}
            transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed top-0 left-0 right-0"
            style={{ zIndex: 45, paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div
              className="flex items-center gap-2.5 px-3 py-2 border-b"
              style={{
                background: 'color-mix(in srgb, var(--mb-surface) 88%, transparent)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                borderColor: 'var(--mb-line)',
              }}
            >
              <img
                src={logoError ? DEFAULT_LOGO : logo}
                alt=""
                aria-hidden="true"
                className="w-8 h-8 rounded-full object-cover shrink-0"
                style={{ boxShadow: '0 0 0 2px var(--mb-ring)' }}
              />
              <p className="flex-1 min-w-0 truncate text-[14px] font-extrabold tracking-tight" style={{ color: 'var(--mb-ink)' }}>{name}</p>
              <span
                className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold"
                style={isOpen
                  ? { background: 'rgba(16,185,129,0.12)', color: '#047857' }
                  : { background: 'var(--mb-surface-2)', color: 'var(--mb-ink-2)' }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {isOpen ? 'Abierto' : 'Cerrado'}
              </span>
              <button
                onClick={() => setShowAccountModal(true)}
                className="relative w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--mb-surface-2)', color: 'var(--mb-ink-2)' }}
                aria-label={hasActiveOrder ? 'Ver mi pedido' : 'Mi cuenta'}
              >
                {PH.clock('w-4 h-4')}
                {hasActiveOrder && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2" style={{ '--tw-ring-color': 'var(--mb-surface)' }} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AccountManagementModal
        fullScreen
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        customerData={customerData}
        orders={customerOrders}
        initialTab={hasActiveOrder ? 'orders' : 'profile'}
      />
    </div>
  );
}

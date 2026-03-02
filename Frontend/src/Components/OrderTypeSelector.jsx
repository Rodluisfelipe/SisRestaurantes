import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from '../Context/BusinessContext';
import * as SessionManager from '../utils/sessionManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ─── Inline check badge ─── */
const CheckBadge = ({ color }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0, opacity: 0 }}
    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    className="absolute right-3 top-1/2 -translate-y-1/2"
  >
    <svg className="w-[18px] h-[18px]" viewBox="0 0 20 20" fill={color}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  </motion.div>
);

function OrderTypeSelector({ onComplete, initialTableNumber }) {
  const isQRMode = Boolean(initialTableNumber);

  const [orderInfo, setOrderInfo] = useState(() => {
    const saved = SessionManager.getFromSession('orderInfo');
    if (saved) {
      if (isQRMode && initialTableNumber) return { ...saved, tableNumber: initialTableNumber };
      return saved;
    }
    const base = { customerName: '', orderType: '', tableNumber: initialTableNumber || '' };
    if (!isQRMode) {
      const n = SessionManager.getSavedCustomerName();
      if (n) base.customerName = n;
      const p = SessionManager.getFromLocalStorage('customerPhone');
      if (p) base.phone = p;
    }
    return base;
  });

  const isReturning = useRef(Boolean(SessionManager.getSavedCustomerName())).current;

  const [showOrderTypes, setShowOrderTypes] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const { businessConfig } = useBusinessConfig();
  const nameRef = useRef(null);
  const phoneRef = useRef(null);

  const themeColor = businessConfig?.theme?.buttonColor || '#2563eb';
  const themeTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';
  const hasCover = Boolean(businessConfig?.coverImage);

  const logoUrl = businessConfig?.logo
    ? (businessConfig.logo.startsWith('http') ? businessConfig.logo : `${API_BASE_URL}${businessConfig.logo}`)
    : null;
  const coverUrl = businessConfig?.coverImage
    ? (businessConfig.coverImage.startsWith('http') ? businessConfig.coverImage : `${API_BASE_URL}${businessConfig.coverImage}`)
    : null;
  const defaultLogo = 'https://placehold.co/150x150?text=Logo';

  /* ── Keyboard detect ── */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  /* ── Table sync ── */
  useEffect(() => {
    if (initialTableNumber && orderInfo.tableNumber !== initialTableNumber) {
      setOrderInfo(prev => ({ ...prev, tableNumber: initialTableNumber }));
    }
  }, [initialTableNumber, orderInfo.tableNumber]);

  /* ── Auto-focus ── */
  useEffect(() => {
    const t = setTimeout(() => { if (!showOrderTypes) nameRef.current?.focus(); }, 700);
    return () => clearTimeout(t);
  }, [showOrderTypes]);

  /* ── Submit ── */
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!orderInfo.customerName.trim()) return;
    if (isQRMode) {
      if (showOrderTypes) {
        if (!orderInfo.orderType) { alert('Por favor selecciona el tipo de pedido'); return; }
        const final = { ...orderInfo, tableNumber: initialTableNumber || '' };
        SessionManager.saveOrderInfo(final);
        onComplete(final);
      } else {
        setShowOrderTypes(true);
      }
    } else {
      const info = { customerName: orderInfo.customerName.trim(), phone: orderInfo.phone?.trim() || '', orderType: '', tableNumber: '' };
      SessionManager.saveCustomerName(info.customerName);
      if (orderInfo.phone) SessionManager.saveToLocalStorage('customerPhone', orderInfo.phone);
      SessionManager.saveOrderInfo(info);
      onComplete(info);
    }
  }, [orderInfo, isQRMode, showOrderTypes, initialTableNumber, onComplete]);

  const handleOrderTypeChange = (type) => setOrderInfo(prev => ({ ...prev, orderType: type }));

  const nameValid = orderInfo.customerName.trim().length > 0;
  const phoneValid = (orderInfo.phone?.trim().length || 0) >= 7;
  const isFormValid = nameValid && phoneValid;

  /* ── Shared input style helper ── */
  const inputWrapStyle = (focused) => ({
    borderColor: focused ? themeColor : '#e8eaed',
    backgroundColor: focused ? '#fff' : '#f8f9fb',
    boxShadow: focused ? `0 0 0 3px ${themeColor}15` : 'none'
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden touch-none">

      {/* ═══════════════════════════════════════════
          HERO — top section with cover/gradient + logo
          ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative flex-shrink-0 flex flex-col items-center justify-end"
        style={{
          height: keyboardOpen ? '20vh' : '42vh',
          transition: 'height 0.3s ease'
        }}
      >
        {/* Background: cover image or themed gradient */}
        {coverUrl ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${coverUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 50%, ${themeColor}aa 100%)`
              }}
            />
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)`,
              backgroundSize: '24px 24px'
            }} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
          </>
        )}

        {/* Logo — overlapping the card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.15 }}
          className="relative z-20"
          style={{ marginBottom: keyboardOpen ? -28 : -36 }}
        >
          <div className="relative">
            <div
              className="w-[76px] h-[76px] rounded-2xl overflow-hidden shadow-2xl ring-[3px] ring-white/90"
              style={{ boxShadow: `0 8px 32px ${themeColor}40, 0 2px 8px rgba(0,0,0,0.15)` }}
            >
              <img
                src={logoUrl || defaultLogo}
                alt={businessConfig.businessName || 'Logo'}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = defaultLogo; }}
              />
            </div>
            {/* Online pulse */}
            <div
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[2.5px] border-white"
              style={{ backgroundColor: '#22c55e' }}
            >
              <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: '#22c55e' }} />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ═══════════════════════════════════════════
          CARD — bottom sheet with form
          ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 26, delay: 0.2 }}
        className="relative z-10 flex-1 bg-white rounded-t-[28px] flex flex-col"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.08)'
        }}
      >
        <div className="flex-1 flex flex-col px-6 pt-12">
          {/* Business name + info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-center mb-1"
            style={{ display: keyboardOpen ? 'none' : 'block' }}
          >
            <h1 className="text-[22px] font-bold text-gray-800 leading-tight">
              {businessConfig.businessName || 'Nuestro restaurante'}
            </h1>

            {/* Rating chip */}
            {businessConfig?.reviewStats?.totalReviews > 0 && (
              <div className="flex items-center justify-center gap-1 mt-1.5">
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} className="w-3 h-3" viewBox="0 0 20 20" fill={s <= Math.round(businessConfig.reviewStats.averageRating) ? '#facc15' : '#e5e7eb'}>
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-[12px] font-semibold text-gray-700">{businessConfig.reviewStats.averageRating.toFixed(1)}</span>
                <span className="text-[11px] text-gray-400">({businessConfig.reviewStats.totalReviews})</span>
              </div>
            )}

            {/* Address */}
            {businessConfig?.address && (
              <a
                href={businessConfig?.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(businessConfig.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors max-w-[260px]"
              >
                <svg className="w-3 h-3 flex-shrink-0 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="truncate">{businessConfig.address}</span>
              </a>
            )}

            {/* Social media icons */}
            {(() => {
              const sm = businessConfig?.socialMedia;
              const el = businessConfig?.extraLink;
              const hasAny = (sm?.facebook?.isVisible && sm?.facebook?.url) ||
                             (sm?.instagram?.isVisible && sm?.instagram?.url) ||
                             (sm?.tiktok?.isVisible && sm?.tiktok?.url) ||
                             (el?.isVisible && el?.url);
              if (!hasAny) return null;
              return (
                <div className="flex items-center justify-center gap-3 mt-2">
                  {sm?.facebook?.isVisible && sm?.facebook?.url && (
                    <a href={sm.facebook.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-[#1877F2] transition-colors">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"/></svg>
                    </a>
                  )}
                  {sm?.instagram?.isVisible && sm?.instagram?.url && (
                    <a href={sm.instagram.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-[#E4405F] transition-colors">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </a>
                  )}
                  {sm?.tiktok?.isVisible && sm?.tiktok?.url && (
                    <a href={sm.tiktok.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-black transition-colors">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 00-1-.08A6.34 6.34 0 003 15.66a6.34 6.34 0 0010.86 4.49v.02h3.45v-9.4a7.29 7.29 0 004.28 1.38V8.7a4.78 4.78 0 01-2-2.01z"/></svg>
                    </a>
                  )}
                  {el?.isVisible && el?.url && (
                    <a href={el.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </a>
                  )}
                </div>
              );
            })()}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42 }}
            className="text-[13px] text-gray-400 text-center"
            style={{ marginBottom: keyboardOpen ? 12 : 24, display: keyboardOpen && showOrderTypes ? 'none' : 'block' }}
          >
            {isReturning && orderInfo.customerName
              ? <>Hola de nuevo, <span className="font-semibold text-gray-600">{orderInfo.customerName.split(' ')[0]}</span></>
              : 'Ingresa tus datos para ver el menú'
            }
          </motion.p>

          {/* QR progress */}
          {isQRMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="flex justify-center gap-1.5 mb-5"
            >
              <div className="h-1 rounded-full transition-all duration-300" style={{ width: !showOrderTypes ? 24 : 10, backgroundColor: !showOrderTypes ? themeColor : '#d1d5db' }} />
              <div className="h-1 rounded-full transition-all duration-300" style={{ width: showOrderTypes ? 24 : 10, backgroundColor: showOrderTypes ? themeColor : '#d1d5db' }} />
            </motion.div>
          )}

          {/* ── Forms ── */}
          <AnimatePresence mode="wait">
            {/* STEP 1 */}
            {!showOrderTypes && (
              <motion.form
                key="step-info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit}
                className="space-y-3"
              >
                {/* Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1 tracking-wider uppercase pl-0.5">
                    Tu nombre
                  </label>
                  <div className="relative rounded-xl border transition-all duration-200" style={inputWrapStyle(nameFocused)}>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-[17px] h-[17px]" style={{ color: nameFocused ? themeColor : '#b5bcc7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      ref={nameRef}
                      type="text"
                      value={orderInfo.customerName}
                      onChange={(e) => setOrderInfo({ ...orderInfo, customerName: e.target.value })}
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                      className="w-full pl-10 pr-10 py-3 bg-transparent text-gray-800 text-[15px] placeholder-gray-300 rounded-xl outline-none"
                      placeholder="Ingresa tu nombre"
                      autoComplete="given-name"
                      enterKeyHint="next"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); phoneRef.current?.focus(); } }}
                      required
                    />
                    <AnimatePresence>{nameValid && <CheckBadge color={themeColor} />}</AnimatePresence>
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1 tracking-wider uppercase pl-0.5">
                    Tu teléfono
                  </label>
                  <div className="relative rounded-xl border transition-all duration-200" style={inputWrapStyle(phoneFocused)}>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-[17px] h-[17px]" style={{ color: phoneFocused ? themeColor : '#b5bcc7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <input
                      ref={phoneRef}
                      type="tel"
                      inputMode="tel"
                      value={orderInfo.phone || ''}
                      onChange={(e) => setOrderInfo({ ...orderInfo, phone: e.target.value })}
                      onFocus={() => setPhoneFocused(true)}
                      onBlur={() => setPhoneFocused(false)}
                      className="w-full pl-10 pr-10 py-3 bg-transparent text-gray-800 text-[15px] placeholder-gray-300 rounded-xl outline-none"
                      placeholder="Ej: 3001234567"
                      autoComplete="tel"
                      enterKeyHint="go"
                      required
                    />
                    <AnimatePresence>{phoneValid && <CheckBadge color={themeColor} />}</AnimatePresence>
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-2">
                  <motion.button
                    type="submit"
                    disabled={!isFormValid}
                    whileTap={{ scale: 0.97 }}
                    className="relative w-full py-3.5 rounded-2xl text-[15px] font-semibold transition-all duration-200 overflow-hidden disabled:opacity-30"
                    style={{
                      backgroundColor: isFormValid ? themeColor : '#e5e7eb',
                      color: isFormValid ? themeTextColor : '#9ca3af',
                      boxShadow: isFormValid ? `0 4px 20px ${themeColor}35` : 'none'
                    }}
                  >
                    {isFormValid && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3 }}
                      />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      Ver menú
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </motion.button>
                </div>
              </motion.form>
            )}

            {/* STEP 2: QR order type */}
            {showOrderTypes && (
              <motion.form
                key="step-order-type"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit}
                className="space-y-3.5"
              >
                <p className="text-sm text-gray-500 text-center leading-relaxed">
                  Hola <span className="font-semibold text-gray-700">{orderInfo.customerName}</span>, mesa{' '}
                  <span className="font-bold" style={{ color: themeColor }}>{initialTableNumber}</span>
                </p>

                <div className="space-y-2">
                  {[
                    { type: 'inSite', title: 'En sitio', sub: 'Comer en el local', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
                    { type: 'takeaway', title: 'Para llevar', sub: 'Recoger y llevar', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg> }
                  ].map(({ type, title, sub, icon }, i) => {
                    const active = orderInfo.orderType === type;
                    return (
                      <motion.button
                        key={type}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 + i * 0.06 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleOrderTypeChange(type)}
                        className="w-full py-3.5 rounded-xl flex items-center gap-3 px-4 border transition-all duration-200"
                        style={{
                          borderColor: active ? themeColor : '#e8eaed',
                          backgroundColor: active ? `${themeColor}08` : '#fafafa',
                          boxShadow: active ? `0 0 0 3px ${themeColor}10` : 'none'
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: active ? `${themeColor}12` : '#f0f1f3', color: active ? themeColor : '#9ca3af' }}
                        >
                          {icon}
                        </div>
                        <div className="text-left flex-1">
                          <span className={`text-[15px] font-semibold block ${active ? 'text-gray-800' : 'text-gray-500'}`}>{title}</span>
                          <span className="text-xs text-gray-400">{sub}</span>
                        </div>
                        {active && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: themeColor }}>
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                <div className="pt-1">
                  <motion.button
                    type="submit"
                    disabled={!orderInfo.orderType}
                    whileTap={{ scale: 0.97 }}
                    className="relative w-full py-3.5 rounded-2xl text-[15px] font-semibold transition-all duration-200 overflow-hidden disabled:opacity-30"
                    style={{
                      backgroundColor: orderInfo.orderType ? themeColor : '#e5e7eb',
                      color: orderInfo.orderType ? themeTextColor : '#9ca3af',
                      boxShadow: orderInfo.orderType ? `0 4px 20px ${themeColor}35` : 'none'
                    }}
                  >
                    {orderInfo.orderType && (
                      <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3 }} />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      Ver Menú
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </span>
                  </motion.button>
                </div>

                <button type="button" onClick={() => setShowOrderTypes(false)} className="w-full text-center text-xs text-gray-400 py-1 active:text-gray-600">
                  ← Cambiar datos
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {!keyboardOpen && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 0.8 }}
            className="text-center text-[10px] text-gray-400 pb-3 pt-2"
          >
            Powered by <span className="font-medium">MenuBy</span>
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

export default OrderTypeSelector;
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
  const [kb, setKb] = useState(false);
  const { businessConfig } = useBusinessConfig();
  const nameRef = useRef(null);
  const phoneRef = useRef(null);

  const themeColor = businessConfig?.theme?.buttonColor || '#2563eb';
  const themeTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';

  const logoUrl = businessConfig?.logo
    ? (businessConfig.logo.startsWith('http') ? businessConfig.logo : `${API_BASE_URL}${businessConfig.logo}`)
    : null;
  const coverUrl = businessConfig?.coverImage
    ? (businessConfig.coverImage.startsWith('http') ? businessConfig.coverImage : `${API_BASE_URL}${businessConfig.coverImage}`)
    : null;
  const defaultLogo = 'https://placehold.co/150x150?text=Logo';

  /* ── Keyboard: instant detection via focus/blur ── */
  const openKb = useCallback(() => setKb(true), []);
  const closeKb = useCallback(() => setKb(false), []);

  /* ── Lock body ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevBg = document.body.style.backgroundColor;
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#ffffff';
    return () => {
      document.body.style.overflow = prev;
      document.body.style.backgroundColor = prevBg;
    };
  }, []);

  /* ── Table sync ── */
  useEffect(() => {
    if (initialTableNumber && orderInfo.tableNumber !== initialTableNumber) {
      setOrderInfo(prev => ({ ...prev, tableNumber: initialTableNumber }));
    }
  }, [initialTableNumber, orderInfo.tableNumber]);

  /* ── Auto-focus ── */
  useEffect(() => {
    const t = setTimeout(() => { if (!showOrderTypes) nameRef.current?.focus({ preventScroll: true }); }, 700);
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

  const inputWrapStyle = (focused) => ({
    borderColor: focused ? themeColor : '#e8eaed',
    backgroundColor: focused ? '#fff' : '#f8f9fb',
    boxShadow: focused ? `0 0 0 3px ${themeColor}15` : 'none'
  });

  /* ── Sizes that adapt when keyboard is open ── */
  const heroH = kb ? '12vh' : '42vh';
  const logoSize = kb ? 44 : 76;
  const logoOverlap = kb ? -20 : -36;
  const cardPt = kb ? 'pt-7' : 'pt-12';
  const titleSize = kb ? 'text-[17px]' : 'text-[22px]';
  const spacing = kb ? 'mb-2' : 'mb-5';
  const inputPy = kb ? 'py-2' : 'py-3';
  const btnPy = kb ? 'py-2.5' : 'py-3.5';

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden touch-none bg-white">

      {/* HERO */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative flex-shrink-0 flex flex-col items-center justify-end"
        style={{ height: heroH }}
      >
        {coverUrl ? (
          <>
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverUrl})` }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 50%, ${themeColor}aa 100%)` }} />
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)`,
              backgroundSize: '24px 24px'
            }} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
          </>
        )}

        {/* Logo overlapping the card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.15 }}
          className="relative z-20"
          style={{ marginBottom: logoOverlap }}
        >
          <div className="relative">
            <div
              className="rounded-2xl overflow-hidden shadow-2xl ring-[3px] ring-white/90"
              style={{
                width: logoSize, height: logoSize,
                boxShadow: `0 8px 32px ${themeColor}40, 0 2px 8px rgba(0,0,0,0.15)`
              }}
            >
              <img src={logoUrl || defaultLogo} alt={businessConfig.businessName || 'Logo'} className="w-full h-full object-cover"
                onError={(e) => { e.target.src = defaultLogo; }} />
            </div>
            {!kb && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[2.5px] border-white" style={{ backgroundColor: '#22c55e' }}>
                <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: '#22c55e' }} />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* CARD — bottom sheet */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 26, delay: 0.2 }}
        className={`relative z-10 flex-1 bg-white rounded-t-[28px] flex flex-col ${cardPt}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxShadow: '0 -8px 30px rgba(0,0,0,0.08)' }}
      >
        <div className="flex-1 flex flex-col px-6">
          {/* Business name */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className={`text-center ${kb ? 'mb-1' : 'mb-1'}`}>
            <h1 className={`${titleSize} font-bold text-gray-800 leading-tight`}>
              {businessConfig.businessName || 'Nuestro restaurante'}
            </h1>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }} className={`text-[13px] text-gray-400 text-center ${spacing}`}>
            {isReturning && orderInfo.customerName
              ? <>Hola de nuevo, <span className="font-semibold text-gray-600">{orderInfo.customerName.split(' ')[0]}</span></>
              : 'Ingresa tus datos para ver el menú'
            }
          </motion.p>

          {/* QR progress */}
          {isQRMode && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className={`flex justify-center gap-1.5 ${spacing}`}>
              <div className="h-1 rounded-full" style={{ width: !showOrderTypes ? 24 : 10, backgroundColor: !showOrderTypes ? themeColor : '#d1d5db' }} />
              <div className="h-1 rounded-full" style={{ width: showOrderTypes ? 24 : 10, backgroundColor: showOrderTypes ? themeColor : '#d1d5db' }} />
            </motion.div>
          )}

          {/* Forms */}
          <AnimatePresence mode="wait">
            {!showOrderTypes && (
              <motion.form key="step-info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                onSubmit={handleSubmit} className={kb ? 'space-y-2' : 'space-y-3'}>
                <div>
                  {!kb && <label className="block text-[11px] font-semibold text-gray-400 mb-1 tracking-wider uppercase pl-0.5">Tu nombre</label>}
                  <div className="relative rounded-xl border transition-all duration-200" style={inputWrapStyle(nameFocused)}>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-[17px] h-[17px]" style={{ color: nameFocused ? themeColor : '#b5bcc7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input ref={nameRef} type="text" value={orderInfo.customerName}
                      onChange={(e) => setOrderInfo({ ...orderInfo, customerName: e.target.value })}
                      onFocus={() => { setNameFocused(true); openKb(); }}
                      onBlur={() => { setNameFocused(false); closeKb(); }}
                      className={`w-full pl-10 pr-10 ${inputPy} bg-transparent text-gray-800 text-[15px] placeholder-gray-300 rounded-xl outline-none`}
                      placeholder="Tu nombre" autoComplete="given-name" enterKeyHint="next"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); phoneRef.current?.focus({ preventScroll: true }); } }}
                      required />
                    <AnimatePresence>{nameValid && <CheckBadge color={themeColor} />}</AnimatePresence>
                  </div>
                </div>
                <div>
                  {!kb && <label className="block text-[11px] font-semibold text-gray-400 mb-1 tracking-wider uppercase pl-0.5">Tu teléfono</label>}
                  <div className="relative rounded-xl border transition-all duration-200" style={inputWrapStyle(phoneFocused)}>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-[17px] h-[17px]" style={{ color: phoneFocused ? themeColor : '#b5bcc7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <input ref={phoneRef} type="tel" inputMode="tel" value={orderInfo.phone || ''}
                      onChange={(e) => setOrderInfo({ ...orderInfo, phone: e.target.value })}
                      onFocus={() => { setPhoneFocused(true); openKb(); }}
                      onBlur={() => { setPhoneFocused(false); closeKb(); }}
                      className={`w-full pl-10 pr-10 ${inputPy} bg-transparent text-gray-800 text-[15px] placeholder-gray-300 rounded-xl outline-none`}
                      placeholder="Ej: 3001234567" autoComplete="tel" enterKeyHint="go" required />
                    <AnimatePresence>{phoneValid && <CheckBadge color={themeColor} />}</AnimatePresence>
                  </div>
                </div>
                <div className={kb ? 'pt-1' : 'pt-2'}>
                  <motion.button type="submit" disabled={!isFormValid} whileTap={{ scale: 0.97 }}
                    className={`relative w-full ${btnPy} rounded-2xl text-[15px] font-semibold transition-all duration-200 overflow-hidden disabled:opacity-30`}
                    style={{ backgroundColor: isFormValid ? themeColor : '#e5e7eb', color: isFormValid ? themeTextColor : '#9ca3af', boxShadow: isFormValid ? `0 4px 20px ${themeColor}35` : 'none' }}>
                    {isFormValid && (
                      <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3 }} />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      Ver menú
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </span>
                  </motion.button>
                </div>
              </motion.form>
            )}

            {showOrderTypes && (
              <motion.form key="step-order-type" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                onSubmit={handleSubmit} className="space-y-3.5">
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
                      <motion.button key={type} type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + i * 0.06 }}
                        whileTap={{ scale: 0.97 }} onClick={() => handleOrderTypeChange(type)}
                        className="w-full py-3.5 rounded-xl flex items-center gap-3 px-4 border transition-all duration-200"
                        style={{ borderColor: active ? themeColor : '#e8eaed', backgroundColor: active ? `${themeColor}08` : '#fafafa', boxShadow: active ? `0 0 0 3px ${themeColor}10` : 'none' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: active ? `${themeColor}12` : '#f0f1f3', color: active ? themeColor : '#9ca3af' }}>{icon}</div>
                        <div className="text-left flex-1">
                          <span className={`text-[15px] font-semibold block ${active ? 'text-gray-800' : 'text-gray-500'}`}>{title}</span>
                          <span className="text-xs text-gray-400">{sub}</span>
                        </div>
                        {active && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: themeColor }}>
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
                <div className="pt-1">
                  <motion.button type="submit" disabled={!orderInfo.orderType} whileTap={{ scale: 0.97 }}
                    className="relative w-full py-3.5 rounded-2xl text-[15px] font-semibold transition-all duration-200 overflow-hidden disabled:opacity-30"
                    style={{ backgroundColor: orderInfo.orderType ? themeColor : '#e5e7eb', color: orderInfo.orderType ? themeTextColor : '#9ca3af', boxShadow: orderInfo.orderType ? `0 4px 20px ${themeColor}35` : 'none' }}>
                    {orderInfo.orderType && (
                      <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3 }} />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      Ver Menú
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </span>
                  </motion.button>
                </div>
                <button type="button" onClick={() => setShowOrderTypes(false)} className="w-full text-center text-xs text-gray-400 py-1 active:text-gray-600">← Cambiar datos</button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {!kb && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ delay: 0.8 }} className="text-center text-[10px] text-gray-400 pb-3 pt-2">
            Powered by <span className="font-medium">MenuBy</span>
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

export default OrderTypeSelector;

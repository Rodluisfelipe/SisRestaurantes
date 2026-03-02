import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from '../Context/BusinessContext';
import * as SessionManager from '../utils/sessionManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ─── tiny inline check icon ─── */
const CheckBadge = ({ color }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0, opacity: 0 }}
    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    className="absolute right-3 top-1/2 -translate-y-1/2"
  >
    <svg className="w-4.5 h-4.5" viewBox="0 0 20 20" fill={color}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  </motion.div>
);

function OrderTypeSelector({ onComplete, initialTableNumber }) {
  const isQRMode = Boolean(initialTableNumber);

  /* ─── Saved data recovery ─── */
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

  const isReturning = useRef(
    Boolean(SessionManager.getSavedCustomerName())
  ).current;

  const [showOrderTypes, setShowOrderTypes] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const { businessConfig } = useBusinessConfig();
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const scrollRef = useRef(null);

  const themeColor = businessConfig?.theme?.buttonColor || '#2563eb';
  const themeTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';

  const logoUrl = businessConfig?.logo
    ? (businessConfig.logo.startsWith('http') ? businessConfig.logo : `${API_BASE_URL}${businessConfig.logo}`)
    : null;
  const defaultLogo = 'https://placehold.co/150x150?text=Logo';

  /* ─── Keyboard-aware layout (mobile) ─── */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const open = vv.height < window.innerHeight * 0.75;
      setKeyboardOpen(open);
      // scroll focused input into view
      if (open && scrollRef.current) {
        setTimeout(() => {
          const active = document.activeElement;
          if (active && scrollRef.current?.contains(active)) {
            active.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 80);
      }
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  /* ─── Table number sync ─── */
  useEffect(() => {
    if (initialTableNumber && orderInfo.tableNumber !== initialTableNumber) {
      setOrderInfo(prev => ({ ...prev, tableNumber: initialTableNumber }));
    }
  }, [initialTableNumber, orderInfo.tableNumber]);

  /* ─── Auto-focus after animation ─── */
  useEffect(() => {
    const t = setTimeout(() => {
      if (!showOrderTypes) nameRef.current?.focus();
    }, 600);
    return () => clearTimeout(t);
  }, [showOrderTypes]);

  /* ─── Submit ─── */
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
      const info = {
        customerName: orderInfo.customerName.trim(),
        phone: orderInfo.phone?.trim() || '',
        orderType: '', tableNumber: ''
      };
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

  /* ─── Animation ─── */
  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.12 } }
  };
  const rise = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 26 } }
  };

  /* Shared input wrapper builder */
  const InputWrap = ({ focused, children }) => (
    <div
      className="relative rounded-xl border-2 transition-all duration-200 bg-white/70"
      style={{
        borderColor: focused ? themeColor : '#e5e7eb',
        boxShadow: focused ? `0 0 0 3px ${themeColor}18` : 'none'
      }}
    >
      {children}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden touch-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      ref={scrollRef}
    >
      {/* ── Ambient blurs ── */}
      <div className="absolute top-[-25%] right-[-20%] w-[70vw] h-[70vw] rounded-full opacity-[0.07] blur-3xl pointer-events-none" style={{ backgroundColor: themeColor }} />
      <div className="absolute bottom-[-25%] left-[-20%] w-[55vw] h-[55vw] rounded-full opacity-[0.05] blur-3xl pointer-events-none" style={{ backgroundColor: themeColor }} />
      {/* Tiny accent dot */}
      <div className="absolute top-[12%] left-[8%] w-2 h-2 rounded-full opacity-20 pointer-events-none" style={{ backgroundColor: themeColor }} />
      <div className="absolute top-[18%] right-[12%] w-1.5 h-1.5 rounded-full opacity-15 pointer-events-none" style={{ backgroundColor: themeColor }} />

      {/* ── Main content — vertically centered ── */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[360px] mx-auto px-6 flex flex-col justify-center flex-1"
        style={{ minHeight: keyboardOpen ? 'auto' : '100dvh' }}
      >
        {/* ── Logo with floating animation ── */}
        <motion.div
          variants={rise}
          className="flex justify-center"
          style={{ marginBottom: keyboardOpen ? 12 : 20 }}
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div
              className="w-[72px] h-[72px] rounded-2xl shadow-lg overflow-hidden border-2 ring-4 ring-white"
              style={{ borderColor: `${themeColor}20` }}
            >
              <img
                src={logoUrl || defaultLogo}
                alt={businessConfig.businessName || 'Logo'}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = defaultLogo; }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* ── Business name ── */}
        <motion.h1
          variants={rise}
          className="text-[20px] font-bold text-gray-800 text-center leading-tight"
          style={{ marginBottom: keyboardOpen ? 2 : 4 }}
        >
          {businessConfig.businessName || 'Nuestro restaurante'}
        </motion.h1>

        {/* ── Subtitle — contextual ── */}
        <motion.p
          variants={rise}
          className="text-[13px] text-gray-400 text-center"
          style={{ marginBottom: keyboardOpen ? 16 : 28 }}
        >
          {isReturning && orderInfo.customerName
            ? <>Hola de nuevo, <span className="font-medium text-gray-500">{orderInfo.customerName.split(' ')[0]}</span></>
            : 'Ingresa tus datos para continuar'
          }
        </motion.p>

        {/* ── QR progress dots ── */}
        {isQRMode && (
          <motion.div variants={rise} className="flex justify-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full transition-all duration-300" style={{ backgroundColor: !showOrderTypes ? themeColor : '#d1d5db', transform: !showOrderTypes ? 'scale(1.2)' : 'scale(1)' }} />
            <div className="w-2 h-2 rounded-full transition-all duration-300" style={{ backgroundColor: showOrderTypes ? themeColor : '#d1d5db', transform: showOrderTypes ? 'scale(1.2)' : 'scale(1)' }} />
          </motion.div>
        )}

        {/* ── Form ── */}
        <AnimatePresence mode="wait">
          {/* ──── STEP 1: Name & Phone ──── */}
          {!showOrderTypes && (
            <motion.form
              key="step-info"
              initial={{ opacity: 0, x: 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              onSubmit={handleSubmit}
              className="space-y-3.5"
            >
              {/* Name */}
              <motion.div variants={rise}>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1 tracking-wider uppercase pl-1">
                  Tu nombre
                </label>
                <InputWrap focused={nameFocused}>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200">
                    <svg className="w-[18px] h-[18px]" style={{ color: nameFocused ? themeColor : '#b0b8c4' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="w-full pl-11 pr-10 py-3.5 bg-transparent text-gray-800 text-[15px] placeholder-gray-300 rounded-xl outline-none"
                    placeholder="Ingresa tu nombre"
                    autoComplete="given-name"
                    enterKeyHint="next"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); phoneRef.current?.focus(); } }}
                    required
                  />
                  <AnimatePresence>{nameValid && <CheckBadge color={themeColor} />}</AnimatePresence>
                </InputWrap>
              </motion.div>

              {/* Phone */}
              <motion.div variants={rise}>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1 tracking-wider uppercase pl-1">
                  Tu teléfono
                </label>
                <InputWrap focused={phoneFocused}>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200">
                    <svg className="w-[18px] h-[18px]" style={{ color: phoneFocused ? themeColor : '#b0b8c4' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="w-full pl-11 pr-10 py-3.5 bg-transparent text-gray-800 text-[15px] placeholder-gray-300 rounded-xl outline-none"
                    placeholder="Ej: 3001234567"
                    autoComplete="tel"
                    enterKeyHint="go"
                    required
                  />
                  <AnimatePresence>{phoneValid && <CheckBadge color={themeColor} />}</AnimatePresence>
                </InputWrap>
              </motion.div>

              {/* CTA button */}
              <motion.div variants={rise} className="pt-3">
                <motion.button
                  type="submit"
                  disabled={!isFormValid}
                  whileTap={{ scale: 0.96 }}
                  className="relative w-full py-4 rounded-2xl text-[15px] font-semibold shadow-lg transition-all duration-200 overflow-hidden disabled:opacity-35 disabled:shadow-none"
                  style={{
                    backgroundColor: isFormValid ? themeColor : '#d1d5db',
                    color: isFormValid ? themeTextColor : '#9ca3af'
                  }}
                >
                  {/* Shimmer on active */}
                  {isFormValid && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                    />
                  )}
                  <span className="relative flex items-center justify-center gap-2">
                    Continuar
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </motion.button>
              </motion.div>
            </motion.form>
          )}

          {/* ──── STEP 2: Order type (QR mode) ──── */}
          {showOrderTypes && (
            <motion.form
              key="step-order-type"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-gray-500 text-center leading-relaxed"
              >
                Hola <span className="font-semibold text-gray-700">{orderInfo.customerName}</span>, estás en la mesa{' '}
                <span className="font-bold" style={{ color: themeColor }}>{initialTableNumber}</span>
              </motion.p>

              <div className="space-y-2.5">
                {[
                  {
                    type: 'inSite',
                    title: 'En sitio',
                    sub: 'Comer en el local',
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    )
                  },
                  {
                    type: 'takeaway',
                    title: 'Para llevar',
                    sub: 'Recoger y llevar',
                    icon: (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    )
                  }
                ].map(({ type, title, sub, icon }, i) => {
                  const active = orderInfo.orderType === type;
                  return (
                    <motion.button
                      key={type}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.08 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleOrderTypeChange(type)}
                      className="w-full py-4 rounded-xl flex items-center gap-3.5 px-4 border-2 transition-all duration-200"
                      style={{
                        borderColor: active ? themeColor : '#e5e7eb',
                        backgroundColor: active ? `${themeColor}08` : 'transparent',
                        boxShadow: active ? `0 0 0 3px ${themeColor}12` : 'none'
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                        style={{
                          backgroundColor: active ? `${themeColor}12` : '#f3f4f6',
                          color: active ? themeColor : '#9ca3af'
                        }}
                      >
                        {icon}
                      </div>
                      <div className="text-left flex-1">
                        <span className={`text-[15px] font-semibold block ${active ? 'text-gray-800' : 'text-gray-500'}`}>{title}</span>
                        <span className="text-xs text-gray-400">{sub}</span>
                      </div>
                      {active && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: themeColor }}
                        >
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Ver Menú */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="pt-2">
                <motion.button
                  type="submit"
                  disabled={!orderInfo.orderType}
                  whileTap={{ scale: 0.96 }}
                  className="relative w-full py-4 rounded-2xl text-[15px] font-semibold shadow-lg transition-all duration-200 overflow-hidden disabled:opacity-35 disabled:shadow-none"
                  style={{
                    backgroundColor: orderInfo.orderType ? themeColor : '#d1d5db',
                    color: orderInfo.orderType ? themeTextColor : '#9ca3af'
                  }}
                >
                  {orderInfo.orderType && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                    />
                  )}
                  <span className="relative flex items-center justify-center gap-2">
                    Ver Menú
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </motion.button>
              </motion.div>

              {/* Back link */}
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={() => setShowOrderTypes(false)}
                className="w-full text-center text-xs text-gray-400 py-2 active:text-gray-600"
              >
                ← Cambiar datos
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* ── Powered by ── */}
        {!keyboardOpen && (
          <motion.p
            variants={rise}
            className="text-center text-[10px] text-gray-300 mt-6 pb-4"
          >
            Powered by MenuBy
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

export default OrderTypeSelector;
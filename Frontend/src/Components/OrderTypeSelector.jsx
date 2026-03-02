import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from '../Context/BusinessContext';
import * as SessionManager from '../utils/sessionManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function OrderTypeSelector({ onComplete, initialTableNumber }) {
  const isQRMode = Boolean(initialTableNumber);
  
  const [orderInfo, setOrderInfo] = useState(() => {
    const savedOrderInfo = SessionManager.getFromSession('orderInfo');
    if (savedOrderInfo) {
      if (isQRMode && initialTableNumber) {
        return { ...savedOrderInfo, tableNumber: initialTableNumber };
      }
      return savedOrderInfo;
    } 
    const baseInfo = {
      customerName: '',
      orderType: '',
      tableNumber: initialTableNumber || ''
    };
    if (!isQRMode) {
      const savedName = SessionManager.getSavedCustomerName();
      if (savedName) baseInfo.customerName = savedName;
      const savedPhone = SessionManager.getFromLocalStorage('customerPhone');
      if (savedPhone) baseInfo.phone = savedPhone;
    }
    return baseInfo;
  });

  const [showOrderTypes, setShowOrderTypes] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const { businessConfig } = useBusinessConfig();
  const nameRef = useRef(null);

  const themeColor = businessConfig?.theme?.buttonColor || '#2563eb';
  const themeTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';

  const logoUrl = businessConfig?.logo
    ? (businessConfig.logo.startsWith('http')
        ? businessConfig.logo
        : `${API_BASE_URL}${businessConfig.logo}`)
    : null;
  const defaultLogo = 'https://placehold.co/150x150?text=Logo';

  useEffect(() => {
    if (initialTableNumber && (!orderInfo.tableNumber || orderInfo.tableNumber !== initialTableNumber)) {
      setOrderInfo(prev => ({ ...prev, tableNumber: initialTableNumber }));
    }
  }, [initialTableNumber, orderInfo.tableNumber]);

  // Auto-focus name field after mount animation
  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 600);
    return () => clearTimeout(t);
  }, [showOrderTypes]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!orderInfo.customerName.trim()) return;

    if (isQRMode) {
      if (showOrderTypes) {
        if (!orderInfo.orderType) {
          alert('Por favor selecciona el tipo de pedido');
          return;
        }
        if (orderInfo.orderType === 'inSite' && !isQRMode && (!orderInfo.tableNumber || orderInfo.tableNumber.trim() === '')) {
          alert('Por favor ingresa el número de mesa');
          return;
        }
        const finalOrderInfo = { ...orderInfo, tableNumber: initialTableNumber || '' };
        SessionManager.saveOrderInfo(finalOrderInfo);
        onComplete(finalOrderInfo);
      } else {
        setShowOrderTypes(true);
      }
    } else {
      const normalModeInfo = {
        customerName: orderInfo.customerName.trim(),
        phone: orderInfo.phone?.trim() || '',
        orderType: '',
        tableNumber: ''
      };
      SessionManager.saveCustomerName(normalModeInfo.customerName);
      if (orderInfo.phone) {
        SessionManager.saveToLocalStorage('customerPhone', orderInfo.phone);
      }
      SessionManager.saveOrderInfo(normalModeInfo);
      onComplete(normalModeInfo);
    }
  };

  const handleOrderTypeChange = (type) => {
    setOrderInfo({ ...orderInfo, orderType: type });
  };

  const isFormValid = orderInfo.customerName.trim().length > 0 && (orderInfo.phone?.trim().length > 0);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white overflow-hidden">
      {/* Decorative blurred background circles — matches SplashScreen */}
      <div
        className="absolute top-[-25%] right-[-20%] w-[70vw] h-[70vw] rounded-full opacity-[0.08] blur-3xl pointer-events-none"
        style={{ backgroundColor: themeColor }}
      />
      <div
        className="absolute bottom-[-25%] left-[-20%] w-[55vw] h-[55vw] rounded-full opacity-[0.06] blur-3xl pointer-events-none"
        style={{ backgroundColor: themeColor }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-sm mx-4"
      >
        {/* Logo */}
        <motion.div variants={itemVariants} className="flex justify-center mb-5">
          <div
            className="w-20 h-20 rounded-2xl shadow-lg overflow-hidden border-2"
            style={{ borderColor: `${themeColor}25` }}
          >
            <img
              src={logoUrl || defaultLogo}
              alt={businessConfig.businessName || 'Logo'}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = defaultLogo; }}
            />
          </div>
        </motion.div>

        {/* Business name */}
        <motion.h1 variants={itemVariants} className="text-xl font-bold text-gray-800 text-center mb-1">
          {businessConfig.businessName || 'Nuestro restaurante'}
        </motion.h1>

        <motion.p variants={itemVariants} className="text-[13px] text-gray-400 text-center mb-7">
          Ingresa tus datos para continuar
        </motion.p>

        {/* Form card */}
        <AnimatePresence mode="wait">
          {/* STEP 1: Name & Phone */}
          {!showOrderTypes && (
            <motion.form
              key="step-info"
              initial={{ opacity: 0, x: 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* Name input */}
              <motion.div variants={itemVariants}>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide uppercase">
                  Tu nombre
                </label>
                <div
                  className="relative rounded-xl border-2 transition-colors duration-200 bg-gray-50/60"
                  style={{
                    borderColor: nameFocused ? themeColor : '#e5e7eb'
                  }}
                >
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4" style={{ color: nameFocused ? themeColor : '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    ref={nameRef}
                    type="text"
                    value={orderInfo.customerName}
                    onChange={(e) => setOrderInfo({ ...orderInfo, customerName: e.target.value })}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    className="w-full pl-10 pr-4 py-3 bg-transparent text-gray-800 text-[15px] placeholder-gray-400 rounded-xl outline-none"
                    placeholder="Ingresa tu nombre"
                    required
                  />
                </div>
              </motion.div>

              {/* Phone input */}
              <motion.div variants={itemVariants}>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide uppercase">
                  Tu teléfono
                </label>
                <div
                  className="relative rounded-xl border-2 transition-colors duration-200 bg-gray-50/60"
                  style={{
                    borderColor: phoneFocused ? themeColor : '#e5e7eb'
                  }}
                >
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4" style={{ color: phoneFocused ? themeColor : '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    value={orderInfo.phone || ''}
                    onChange={(e) => setOrderInfo({ ...orderInfo, phone: e.target.value })}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                    className="w-full pl-10 pr-4 py-3 bg-transparent text-gray-800 text-[15px] placeholder-gray-400 rounded-xl outline-none"
                    placeholder="Ej: 3001234567"
                    required
                  />
                </div>
              </motion.div>

              {/* Submit button */}
              <motion.div variants={itemVariants} className="pt-2">
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className="w-full py-3.5 rounded-xl text-[15px] font-semibold shadow-md transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:shadow-none"
                  style={{
                    backgroundColor: isFormValid ? themeColor : '#d1d5db',
                    color: isFormValid ? themeTextColor : '#9ca3af'
                  }}
                >
                  Continuar
                </button>
              </motion.div>
            </motion.form>
          )}

          {/* STEP 2: Order type (QR mode only) */}
          {showOrderTypes && (
            <motion.form
              key="step-order-type"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-gray-500 text-center"
              >
                Hola <span className="font-semibold text-gray-700">{orderInfo.customerName}</span>, estás en la mesa <span className="font-semibold" style={{ color: themeColor }}>{initialTableNumber}</span>
              </motion.p>

              <div className="space-y-2.5">
                {/* In-site button */}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  onClick={() => handleOrderTypeChange('inSite')}
                  className="w-full py-3.5 rounded-xl flex items-center gap-3 px-4 border-2 transition-all duration-200 active:scale-[0.97]"
                  style={{
                    borderColor: orderInfo.orderType === 'inSite' ? themeColor : '#e5e7eb',
                    backgroundColor: orderInfo.orderType === 'inSite' ? `${themeColor}0a` : 'transparent'
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: orderInfo.orderType === 'inSite' ? `${themeColor}15` : '#f3f4f6',
                      color: orderInfo.orderType === 'inSite' ? themeColor : '#9ca3af'
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <span className={`text-[15px] font-semibold ${orderInfo.orderType === 'inSite' ? 'text-gray-800' : 'text-gray-600'}`}>
                      En sitio
                    </span>
                    <span className="block text-xs text-gray-400">Comer en el local</span>
                  </div>
                  {orderInfo.orderType === 'inSite' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: themeColor }}
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>

                {/* Takeaway button */}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  onClick={() => handleOrderTypeChange('takeaway')}
                  className="w-full py-3.5 rounded-xl flex items-center gap-3 px-4 border-2 transition-all duration-200 active:scale-[0.97]"
                  style={{
                    borderColor: orderInfo.orderType === 'takeaway' ? themeColor : '#e5e7eb',
                    backgroundColor: orderInfo.orderType === 'takeaway' ? `${themeColor}0a` : 'transparent'
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: orderInfo.orderType === 'takeaway' ? `${themeColor}15` : '#f3f4f6',
                      color: orderInfo.orderType === 'takeaway' ? themeColor : '#9ca3af'
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <span className={`text-[15px] font-semibold ${orderInfo.orderType === 'takeaway' ? 'text-gray-800' : 'text-gray-600'}`}>
                      Para llevar
                    </span>
                    <span className="block text-xs text-gray-400">Recoger y llevar</span>
                  </div>
                  {orderInfo.orderType === 'takeaway' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: themeColor }}
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              </div>

              {/* Ver Menú button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="pt-2"
              >
                <button
                  type="submit"
                  disabled={!orderInfo.orderType}
                  className="w-full py-3.5 rounded-xl text-[15px] font-semibold shadow-md transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:shadow-none"
                  style={{
                    backgroundColor: orderInfo.orderType ? themeColor : '#d1d5db',
                    color: orderInfo.orderType ? themeTextColor : '#9ca3af'
                  }}
                >
                  Ver Menú
                </button>
              </motion.div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Powered by */}
        <motion.p
          variants={itemVariants}
          className="text-center text-[11px] text-gray-300 mt-8"
        >
          Powered by MenuBy
        </motion.p>
      </motion.div>
    </div>
  );
}

export default OrderTypeSelector;
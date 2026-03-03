import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { getBusinessSlug } from '../utils/getBusinessId';

const CouponInput = ({ onCouponApplied, onCouponRemoved, appliedCoupon, orderData, customerId, businessId }) => {
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [previewData, setPreviewData] = useState(null); // validated coupon preview before applying
  const inputRef = useRef(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (showModal && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [showModal]);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setError('Ingresa un código de cupón');
      return;
    }

    setValidating(true);
    setError('');
    setPreviewData(null);

    try {
      const finalBusinessId = businessId || getBusinessSlug();
      const response = await api.post('/coupons/validate', {
        businessId: finalBusinessId,
        code: couponCode.trim(),
        orderData,
        customerId
      });

      if (response.data.valid) {
        setPreviewData(response.data);
      } else {
        setError(response.data.message || 'Cupón inválido');
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      setError(error.response?.data?.message || 'Error al validar el cupón');
    } finally {
      setValidating(false);
    }
  };

  const handleApplyPreview = () => {
    if (previewData) {
      onCouponApplied(previewData);
      setCouponCode('');
      setError('');
      setPreviewData(null);
      setShowModal(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setError('');
    setPreviewData(null);
    setCouponCode('');
  };

  const handleRemoveCoupon = () => {
    onCouponRemoved();
    setError('');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getDiscountLabel = (coupon) => {
    if (!coupon) return '';
    if (coupon.discountType === 'percentage') return `${coupon.discountValue}% de descuento`;
    if (coupon.discountType === 'fixed') return `${formatCurrency(coupon.discountValue)} de descuento`;
    if (coupon.discountType === 'free_delivery') return 'Envío gratis';
    return '';
  };

  const getDiscountBadgeColor = (type) => {
    if (type === 'percentage') return 'from-violet-500 to-purple-600';
    if (type === 'fixed') return 'from-emerald-500 to-green-600';
    if (type === 'free_delivery') return 'from-blue-500 to-cyan-600';
    return 'from-gray-500 to-gray-600';
  };

  const getDiscountIcon = (type) => {
    if (type === 'percentage') return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M17 17h.01M7 17L17 7M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
      </svg>
    );
    if (type === 'fixed') return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    );
    if (type === 'free_delivery') return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    );
    return null;
  };

  return (
    <div className="mb-3">
      {/* ── Applied coupon chip ── */}
      {appliedCoupon ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50"
        >
          {/* Decorative ribbon */}
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-400 to-emerald-500" />

          <div className="flex items-center justify-between px-3.5 py-2.5 pl-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-green-800 tracking-wide">
                    {appliedCoupon.coupon.code}
                  </span>
                  {appliedCoupon.coupon.name && (
                    <span className="text-[11px] text-green-600 truncate">
                      — {appliedCoupon.coupon.name}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-green-600 font-medium">
                  {appliedCoupon.coupon.freeDelivery
                    ? '🚚 Envío gratis aplicado'
                    : <>Ahorras <span className="font-bold">{formatCurrency(appliedCoupon.discountAmount)}</span></>
                  }
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="flex-shrink-0 ml-2 text-[11px] text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              Quitar
            </button>
          </div>
        </motion.div>
      ) : (
        /* ── "Do you have a coupon?" trigger ── */
        <button
          onClick={() => setShowModal(true)}
          className="group w-full rounded-xl border border-dashed border-gray-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 transition-all duration-200 flex items-center justify-center gap-2 py-2.5 px-3"
        >
          <span className="text-base group-hover:scale-110 transition-transform duration-200">🎟️</span>
          <span className="text-[13px] font-medium text-gray-500 group-hover:text-indigo-600 transition-colors">
            ¿Tienes un cupón de descuento?
          </span>
        </button>
      )}

      {/* ── Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-5 pt-5 pb-6 text-white">
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-6 -translate-x-4" />

                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">🎟️</span>
                      <h3 className="text-lg font-bold">Canjea tu cupón</h3>
                    </div>
                    <p className="text-white/80 text-xs">
                      Ingresa el código para ver tu descuento
                    </p>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Coupon code input — inside the header */}
                <div className="relative mt-4 flex gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setError('');
                        setPreviewData(null);
                      }}
                      placeholder="Ej: VIP, PROMO2026..."
                      className="w-full pl-3 pr-3 py-2.5 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 text-sm font-semibold tracking-wider focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/25 transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && handleValidateCoupon()}
                      disabled={validating}
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                  <button
                    onClick={handleValidateCoupon}
                    disabled={validating || !couponCode.trim()}
                    className="px-4 py-2.5 bg-white text-indigo-600 font-bold text-sm rounded-xl hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-black/10 flex items-center gap-1.5"
                  >
                    {validating ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-indigo-200 border-t-indigo-600" />
                        <span className="text-xs">Validando</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Validar
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-3">
                {/* Error */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
                    >
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <p className="text-red-700 text-[13px] font-medium">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Coupon preview card */}
                <AnimatePresence mode="wait">
                  {previewData && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                      className="space-y-3"
                    >
                      {/* Coupon ticket card */}
                      <div className="relative overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                        {/* Top — gradient banner */}
                        <div className={`bg-gradient-to-r ${getDiscountBadgeColor(previewData.coupon.discountType)} px-4 py-3 flex items-center gap-3`}>
                          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                            {getDiscountIcon(previewData.coupon.discountType)}
                          </div>
                          <div className="text-white min-w-0">
                            <p className="text-[15px] font-bold leading-tight">
                              {getDiscountLabel(previewData.coupon)}
                            </p>
                            {previewData.coupon.name && (
                              <p className="text-white/80 text-[11px] truncate">{previewData.coupon.name}</p>
                            )}
                          </div>
                        </div>

                        {/* Ticket cut-out divider */}
                        <div className="relative h-4 flex items-center">
                          <div className="absolute left-0 w-4 h-4 bg-white rounded-full -translate-x-1/2 border border-gray-200" />
                          <div className="flex-1 border-t border-dashed border-gray-200 mx-4" />
                          <div className="absolute right-0 w-4 h-4 bg-white rounded-full translate-x-1/2 border border-gray-200" />
                        </div>

                        {/* Bottom — details */}
                        <div className="px-4 pb-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-mono font-bold tracking-widest">
                              {previewData.coupon.code}
                            </span>
                            <span className="text-green-600 text-[11px] font-semibold flex items-center gap-0.5">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Válido
                            </span>
                          </div>

                          {previewData.coupon.description && (
                            <p className="text-gray-500 text-[12px]">{previewData.coupon.description}</p>
                          )}

                          {/* Discount summary */}
                          {previewData.coupon.discountType !== 'free_delivery' && orderData?.totalAmount > 0 && (
                            <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
                              <div className="flex justify-between text-[12px]">
                                <span className="text-gray-500">Subtotal</span>
                                <span className="text-gray-700 font-medium">{formatCurrency(orderData.totalAmount)}</span>
                              </div>
                              <div className="flex justify-between text-[12px]">
                                <span className="text-green-600 font-medium">Descuento</span>
                                <span className="text-green-600 font-bold">-{formatCurrency(previewData.discountAmount)}</span>
                              </div>
                              <div className="border-t border-gray-200 pt-1 flex justify-between text-[13px]">
                                <span className="text-gray-700 font-semibold">Total</span>
                                <span className="text-gray-900 font-bold">{formatCurrency(previewData.finalAmount)}</span>
                              </div>
                            </div>
                          )}

                          {previewData.coupon.freeDelivery && (
                            <div className="bg-blue-50 rounded-lg px-3 py-2 flex items-center gap-2">
                              <span className="text-base">🚚</span>
                              <span className="text-blue-700 text-[12px] font-medium">
                                El costo de envío será $0 para este pedido
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Apply button */}
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleApplyPreview}
                        className={`w-full py-3 rounded-xl text-white font-bold text-[14px] bg-gradient-to-r ${getDiscountBadgeColor(previewData.coupon.discountType)} shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Aplicar cupón
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Hint when nothing shown */}
                {!error && !previewData && (
                  <div className="text-center py-2">
                    <p className="text-gray-400 text-[12px]">
                      Ingresa tu código arriba y presiona <strong>Validar</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Safe-area bottom padding for mobile */}
              <div className="h-2 sm:h-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CouponInput;

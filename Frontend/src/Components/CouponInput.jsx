import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { getBusinessSlug } from '../utils/getBusinessId';

/* ── helpers ── */
const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
};
const luminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
const darken = (hex, pct = 0.15) => {
  const { r, g, b } = hexToRgb(hex);
  const d = (v) => Math.max(0, Math.round(v * (1 - pct)));
  return `#${d(r).toString(16).padStart(2,'0')}${d(g).toString(16).padStart(2,'0')}${d(b).toString(16).padStart(2,'0')}`;
};

const CouponInput = ({ onCouponApplied, onCouponRemoved, appliedCoupon, orderData, customerId, businessId, theme }) => {
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const inputRef = useRef(null);

  const btnColor   = theme?.buttonColor     || '#2563eb';
  const btnText    = theme?.buttonTextColor  || '#ffffff';
  const btnDarker  = darken(btnColor, 0.18);
  const isLight    = luminance(btnColor) > 0.65;

  useEffect(() => {
    if (showModal && inputRef.current) setTimeout(() => inputRef.current?.focus(), 200);
  }, [showModal]);

  /* ── API ── */
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) { setError('Ingresa un código de cupón'); return; }
    setValidating(true); setError(''); setPreviewData(null);
    try {
      const finalBusinessId = businessId || getBusinessSlug();
      const res = await api.post('/coupons/validate', { businessId: finalBusinessId, code: couponCode.trim(), orderData, customerId });
      if (res.data.valid) setPreviewData(res.data);
      else setError(res.data.message || 'Cupón inválido');
    } catch (err) {
      console.error('Error validating coupon:', err);
      setError(err.response?.data?.message || 'Error al validar el cupón');
    } finally { setValidating(false); }
  };

  const handleApplyPreview = () => {
    if (!previewData) return;
    onCouponApplied(previewData);
    setCouponCode(''); setError(''); setPreviewData(null); setShowModal(false);
  };
  const handleCloseModal = () => { setShowModal(false); setError(''); setPreviewData(null); setCouponCode(''); };
  const handleRemoveCoupon = () => { onCouponRemoved(); setError(''); };

  const formatCurrency = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

  const getDiscountLabel = (c) => {
    if (!c) return '';
    if (c.discountType === 'percentage')    return `${c.discountValue}% de descuento`;
    if (c.discountType === 'fixed')         return `${formatCurrency(c.discountValue)} de descuento`;
    if (c.discountType === 'free_delivery') return 'Envío gratis';
    return '';
  };

  const getIcon = (type) => {
    if (type === 'percentage') return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M17 17h.01M7 17L17 7M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
      </svg>
    );
    if (type === 'fixed') return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    );
    if (type === 'free_delivery') return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    );
    return null;
  };

  /* ── render ── */
  const modal = showModal ? createPortal(
    <AnimatePresence>
      <motion.div
        key="coupon-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
        style={{ zIndex: 9999 }}
        onClick={handleCloseModal}
      >
        <motion.div
          key="coupon-sheet"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-[420px] overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Drag handle mobile ── */}
          <div className="flex justify-center pt-2 pb-0 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {/* ── Header with theme color ── */}
          <div className="relative overflow-hidden px-5 pt-4 pb-5" style={{ background: `linear-gradient(135deg, ${btnColor} 0%, ${btnDarker} 100%)` }}>
            {/* Deco circles */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

            <div className="relative flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xl">🎟️</span>
                  <h3 className="text-[17px] font-bold" style={{ color: btnText }}>Canjea tu cupón</h3>
                </div>
                <p className="text-[12px] opacity-75" style={{ color: btnText }}>
                  Ingresa el código para ver tu descuento
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'rgba(255,255,255,0.18)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={btnText} strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Input row */}
            <div className="relative flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setError(''); setPreviewData(null); }}
                placeholder="Ej: VIP, PROMO2026…"
                className="flex-1 pl-3 pr-3 py-2.5 rounded-xl text-sm font-semibold tracking-wider focus:outline-none focus:ring-2 transition-all placeholder-white/50"
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: btnText,
                  '--tw-ring-color': 'rgba(255,255,255,0.4)',
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleValidateCoupon()}
                disabled={validating}
                autoComplete="off"
                spellCheck="false"
              />
              <button
                onClick={handleValidateCoupon}
                disabled={validating || !couponCode.trim()}
                className="px-4 py-2.5 font-bold text-sm rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-1.5"
                style={{ background: btnText, color: btnColor }}
              >
                {validating ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2" style={{ borderColor: `${btnColor}33`, borderTopColor: btnColor }} />
                    <span className="text-xs">…</span>
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

          {/* ── Body ── */}
          <div className="px-5 py-4 space-y-3">

            {/* Error */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-red-700 text-[13px] font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Preview card */}
            <AnimatePresence mode="wait">
              {previewData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                  className="space-y-3"
                >
                  {/* Ticket card */}
                  <div className="relative overflow-hidden rounded-xl border border-gray-100 shadow-sm">
                    {/* Banner */}
                    <div className="px-4 py-3 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnDarker})` }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', color: btnText }}>
                        {getIcon(previewData.coupon.discountType)}
                      </div>
                      <div className="min-w-0" style={{ color: btnText }}>
                        <p className="text-[15px] font-bold leading-tight">{getDiscountLabel(previewData.coupon)}</p>
                        {previewData.coupon.name && <p className="text-[11px] opacity-75 truncate">{previewData.coupon.name}</p>}
                      </div>
                    </div>

                    {/* Ticket cut-out */}
                    <div className="relative h-4 flex items-center">
                      <div className="absolute left-0 w-4 h-4 bg-white rounded-full -translate-x-1/2 border border-gray-200" />
                      <div className="flex-1 border-t border-dashed border-gray-200 mx-4" />
                      <div className="absolute right-0 w-4 h-4 bg-white rounded-full translate-x-1/2 border border-gray-200" />
                    </div>

                    {/* Details */}
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
                          <span className="text-blue-700 text-[12px] font-medium">El costo de envío será $0 para este pedido</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Apply CTA */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleApplyPreview}
                    className="w-full py-3 rounded-xl font-bold text-[14px] shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
                    style={{ background: btnColor, color: btnText }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Aplicar cupón
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hint */}
            {!error && !previewData && (
              <p className="text-gray-400 text-[12px] text-center py-1">
                Ingresa tu código arriba y presiona <strong>Validar</strong>
              </p>
            )}
          </div>

          <div className="h-2 sm:h-0" />
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <div className="mb-2">
      {/* ── Applied coupon chip ── */}
      {appliedCoupon ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50"
        >
          <div className="absolute top-0 left-0 w-1 h-full" style={{ background: btnColor }} />

          <div className="flex items-center justify-between px-3 py-2 pl-3.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${btnColor}18` }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={btnColor} strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-gray-800 tracking-wide">{appliedCoupon.coupon.code}</span>
                  {appliedCoupon.coupon.name && (
                    <span className="text-[10px] text-gray-500 truncate">— {appliedCoupon.coupon.name}</span>
                  )}
                </div>
                <p className="text-[10px] font-medium" style={{ color: btnColor }}>
                  {appliedCoupon.coupon.freeDelivery
                    ? '🚚 Envío gratis aplicado'
                    : <>Ahorras <span className="font-bold">{formatCurrency(appliedCoupon.discountAmount)}</span></>
                  }
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="flex-shrink-0 ml-2 text-[10px] text-red-500 hover:text-red-700 font-semibold px-1.5 py-0.5 rounded-lg hover:bg-red-50 transition-colors"
            >Quitar</button>
          </div>
        </motion.div>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          className="group w-full rounded-xl border border-dashed bg-white transition-all duration-200 flex items-center justify-center gap-2 py-2 px-3"
          style={{ borderColor: `${btnColor}40` }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = btnColor; e.currentTarget.style.background = `${btnColor}08`; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${btnColor}40`; e.currentTarget.style.background = '#fff'; }}
        >
          <span className="text-sm group-hover:scale-110 transition-transform duration-200">🎟️</span>
          <span className="text-[12px] font-medium text-gray-500 transition-colors" style={{ '--hover-color': btnColor }}>
            ¿Tienes un cupón de descuento?
          </span>
        </button>
      )}

      {/* Portal-rendered modal */}
      {modal}
    </div>
  );
};

export default CouponInput;

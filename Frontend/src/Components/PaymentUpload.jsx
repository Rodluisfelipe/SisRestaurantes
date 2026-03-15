import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { API_URL } from '../config';
import logger from '../utils/logger';

const PaymentUpload = ({ 
  orderId, 
  customerToken, 
  businessConfig, 
  onClose, 
  onSuccess 
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const textColor = businessConfig?.theme?.buttonTextColor || '#ffffff';
  const paymentInfo = businessConfig?.paymentInfo || {};

  // Check if there's any payment info configured
  const hasPaymentInfo = paymentInfo.nequi || paymentInfo.daviplata || paymentInfo.bankAccountNumber;

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.size > 25 * 1024 * 1024) {
      setError('La imagen no puede pesar más de 25MB');
      return;
    }

    // Accept common image types including HEIC from iPhone
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      setError('Solo se permiten imágenes (JPG, PNG, WebP)');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Selecciona una imagen del comprobante');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('proof', selectedFile);
      formData.append('customerToken', customerToken);

      const response = await api.post(`/orders/${orderId}/payment-proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });

      logger.info('Payment proof uploaded:', response.data);
      setSuccess(true);

      setTimeout(() => {
        onSuccess?.(response.data);
      }, 1500);
    } catch (err) {
      logger.error('Error uploading payment proof:', err);
      setError(err.response?.data?.message || 'Error al subir el comprobante. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Show brief copied feedback
      const btn = document.getElementById(`copy-${text}`);
      if (btn) {
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '📋'; }, 1000);
      }
    }).catch(() => {});
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center"
          >
            <span className="text-4xl">✅</span>
          </motion.div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">¡Comprobante Enviado!</h3>
          <p className="text-gray-600 text-sm">
            Tu pago será verificado en breve
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md overflow-hidden shadow-2xl flex flex-col modal-h-full pb-safe"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Subir Comprobante</h3>
            <p className="text-xs text-gray-500 mt-0.5">Pedido #{sessionStorage.getItem('lastOrderNumber')}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Payment Information */}
          {hasPaymentInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <h4 className="font-semibold text-blue-900 text-sm mb-3 flex items-center gap-2">
                <span>💰</span> Información de Pago
              </h4>
              <div className="space-y-2.5">
                {paymentInfo.nequi && (
                  <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-blue-100">
                    <div>
                      <span className="text-xs text-gray-500 block">Nequi</span>
                      <span className="text-sm font-semibold text-gray-900">{paymentInfo.nequi}</span>
                    </div>
                    <button 
                      id={`copy-${paymentInfo.nequi}`}
                      onClick={() => copyToClipboard(paymentInfo.nequi)}
                      className="text-lg hover:scale-110 transition-transform"
                    >
                      📋
                    </button>
                  </div>
                )}
                {paymentInfo.daviplata && (
                  <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-blue-100">
                    <div>
                      <span className="text-xs text-gray-500 block">Daviplata</span>
                      <span className="text-sm font-semibold text-gray-900">{paymentInfo.daviplata}</span>
                    </div>
                    <button 
                      id={`copy-${paymentInfo.daviplata}`}
                      onClick={() => copyToClipboard(paymentInfo.daviplata)}
                      className="text-lg hover:scale-110 transition-transform"
                    >
                      📋
                    </button>
                  </div>
                )}
                {paymentInfo.bankAccountNumber && (
                  <div className="bg-white rounded-xl px-3 py-2.5 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500 block">
                          {paymentInfo.bankName || 'Banco'} - {paymentInfo.bankAccountType || 'Cuenta'}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{paymentInfo.bankAccountNumber}</span>
                      </div>
                      <button 
                        id={`copy-${paymentInfo.bankAccountNumber}`}
                        onClick={() => copyToClipboard(paymentInfo.bankAccountNumber)}
                        className="text-lg hover:scale-110 transition-transform"
                      >
                        📋
                      </button>
                    </div>
                    {paymentInfo.accountHolder && (
                      <p className="text-xs text-gray-500 mt-1">A nombre de: {paymentInfo.accountHolder}</p>
                    )}
                  </div>
                )}
                {paymentInfo.instructions && (
                  <p className="text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2 mt-2">
                    💡 {paymentInfo.instructions}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* File Upload Area */}
          <div>
            <h4 className="font-semibold text-gray-900 text-sm mb-3">Comprobante de Pago</h4>
            
            {!preview ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Toca para tomar foto o seleccionar</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG o WebP · Máx. 25MB</p>
                </div>
              </button>
            ) : (
              <div className="relative">
                <img 
                  src={preview} 
                  alt="Comprobante" 
                  className="w-full h-48 object-contain bg-gray-100 rounded-2xl"
                />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{selectedFile?.name} ({(selectedFile?.size / 1024).toFixed(0)}KB)</span>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700"
              >
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Upload Button */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-95"
            style={{ 
              backgroundColor: selectedFile ? themeColor : '#d1d5db',
              color: selectedFile ? textColor : '#9ca3af'
            }}
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Subiendo...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>📤</span>
                <span>Enviar Comprobante</span>
              </span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentUpload;

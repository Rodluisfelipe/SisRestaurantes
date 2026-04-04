import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import { FaQrcode, FaUserAlt, FaMotorcycle, FaWhatsapp, FaCopy, FaTimes, FaCheck, FaMapMarkerAlt } from 'react-icons/fa';

const AssignDeliveryModal = ({ isOpen, order, onClose, onAssigned }) => {
  const { businessId, businessConfig } = useBusinessConfig();
  const [step, setStep] = useState('choose'); // choose | qr_result | domi_result
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [domis, setDomis] = useState([]);
  const [selectedDomi, setSelectedDomi] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDomis();
      setStep('choose');
      setResult(null);
      setSelectedDomi(null);
    }
  }, [isOpen]);

  const fetchDomis = async () => {
    try {
      const res = await api.get(`/delivery-admin/restaurants/${businessConfig.slug}/delivery-persons`);
      setDomis(res.data.filter(d => d.active));
    } catch { /* no domis registered yet */ }
  };

  const handleAssignQR = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/delivery-admin/restaurants/${businessConfig.slug}/orders/${order._id}/assign-qr`);
      setResult(res.data);
      setStep('qr_result');
      onAssigned?.();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al asignar');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDomi = async (mode, domi) => {
    setLoading(true);
    try {
      const body = { mode };
      if (mode === 'profile' && domi) {
        body.deliveryPersonId = domi._id;
      }
      const res = await api.post(`/delivery-admin/restaurants/${businessConfig.slug}/orders/${order._id}/assign-delivery-person`, body);
      setResult(res.data);
      setStep('domi_result');
      onAssigned?.();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al asignar');
    } finally {
      setLoading(false);
    }
  };

  const buildWhatsAppUrl = () => {
    if (!result) return '#';
    const phone = (result.phone || '').replace(/\D/g, '');
    const phoneFormatted = phone.startsWith('57') ? phone : `57${phone}`;
    const trackUrl = result.trackUrl || `https://menuby.tech/${businessConfig.slug}/track/${order._id}`;
    const msg = `Tu código de entrega Menuby es: *${result.confirmationCode}*\n\nSigue tu pedido aquí: ${trackUrl}`;
    return `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(msg)}`;
  };

  const copyCode = () => {
    navigator.clipboard.writeText(result?.confirmationCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FaMotorcycle className="text-red-500" />
              Asignar Domiciliario
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <FaTimes className="text-slate-400" />
            </button>
          </div>

          {/* Order info */}
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-sm text-slate-600">
              <span className="font-bold">#{order.orderNumber}</span> — {order.customerName}
            </p>
            {order.address && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <FaMapMarkerAlt className="text-red-400" /> {order.address}
              </p>
            )}
          </div>

          <div className="p-5">
            {/* Step 1: Choose mode */}
            {step === 'choose' && (
              <div className="space-y-3">
                {/* QR Mode */}
                <button
                  onClick={handleAssignQR}
                  disabled={loading}
                  className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-red-400 hover:bg-red-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                      <FaQrcode className="text-red-500 text-xl" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Generar QR</p>
                      <p className="text-xs text-slate-500">Domi ocasional o externo. Escanea el QR para ver la info del pedido.</p>
                    </div>
                  </div>
                </button>

                {/* Fixed Mode */}
                <button
                  onClick={() => handleAssignDomi('fixed')}
                  disabled={loading}
                  className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <FaUserAlt className="text-blue-500 text-xl" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Domi Fijo del Día</p>
                      <p className="text-xs text-slate-500">Asignar al domiciliario con pase diario activo.</p>
                    </div>
                  </div>
                </button>

                {/* Profile Mode */}
                {domis.length > 0 && (
                  <div className="border-2 border-slate-200 rounded-xl p-4">
                    <p className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <FaMotorcycle className="text-emerald-500" />
                      Asignar a Perfil
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {domis.map(d => (
                        <button
                          key={d._id}
                          onClick={() => {
                            setSelectedDomi(d);
                            handleAssignDomi('profile', d);
                          }}
                          disabled={loading}
                          className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                            d.status === 'on_delivery'
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50'
                          }`}
                        >
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{d.name}</p>
                            <p className="text-xs text-slate-500">
                              {d.status === 'on_delivery' ? 'En ruta' : 'Disponible'}
                            </p>
                          </div>
                          <div className={`w-2.5 h-2.5 rounded-full ${d.status === 'on_delivery' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
                  </div>
                )}
              </div>
            )}

            {/* Step 2: QR Result */}
            {step === 'qr_result' && result && (
              <div className="text-center space-y-4">
                <div className="bg-white border-2 border-slate-200 rounded-xl p-6 inline-block">
                  <QRCodeSVG value={result.qrUrl} size={200} level="M" />
                </div>
                <p className="text-xs text-slate-500">Muéstrale o imprímele este QR al domiciliario</p>

                {businessConfig?.requireDeliveryCode !== false && (
                <>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Código de confirmación del cliente</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-black tracking-[0.3em] text-slate-800">{result.confirmationCode}</span>
                    <button onClick={copyCode} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                      {copied ? <FaCheck className="text-emerald-500" /> : <FaCopy className="text-slate-400" />}
                    </button>
                  </div>
                </div>

                <a
                  href={buildWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  <FaWhatsapp className="text-lg" />
                  Enviar código al cliente por WhatsApp
                </a>
                </>
                )}

                <button onClick={onClose} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">
                  Cerrar
                </button>
              </div>
            )}

            {/* Step 3: Domi assigned result */}
            {step === 'domi_result' && result && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                  <FaCheck className="text-emerald-500 text-2xl" />
                </div>
                <p className="font-bold text-slate-800">Domiciliario asignado</p>

                {businessConfig?.requireDeliveryCode !== false && (
                <>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Código de confirmación del cliente</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-black tracking-[0.3em] text-slate-800">{result.confirmationCode}</span>
                    <button onClick={copyCode} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                      {copied ? <FaCheck className="text-emerald-500" /> : <FaCopy className="text-slate-400" />}
                    </button>
                  </div>
                </div>

                <a
                  href={buildWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  <FaWhatsapp className="text-lg" />
                  Enviar código al cliente por WhatsApp
                </a>
                </>
                )}

                <button onClick={onClose} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AssignDeliveryModal;

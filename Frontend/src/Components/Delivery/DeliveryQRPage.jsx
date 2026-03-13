import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';
import { io } from 'socket.io-client';
import { FaMapMarkerAlt, FaPhone, FaCheck, FaBoxOpen, FaLocationArrow, FaMotorcycle, FaWhatsapp } from 'react-icons/fa';
import 'leaflet/dist/leaflet.css';

const API_BASE = API_URL;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL.replace('/api', '');

const DeliveryQRPage = () => {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [confirmError, setConfirmError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [picked, setPicked] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const socketRef = useRef(null);
  const geoWatchRef = useRef(null);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  const brandColor = order?.business?.buttonColor || '#2563eb';
  const brandText = order?.business?.buttonTextColor || '#ffffff';
  const logoUrl = order?.business?.logo;

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`${API_BASE}/delivery/${token}`);
        if (res.status === 410) {
          const data = await res.json();
          setError(data.message || 'Este enlace ha expirado');
          return;
        }
        if (!res.ok) throw new Error('Pedido no encontrado');
        const data = await res.json();
        setOrder(data);
        if (data.status === 'delivered' || data.status === 'completed') setDelivered(true);
        if (data.deliveryPickedAt) setPicked(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [token]);

  // Map
  useEffect(() => {
    if (!order?.deliveryCoordinates?.lat || !mapRef.current) return;
    const initMap = async () => {
      const L = (await import('leaflet')).default || (await import('leaflet'));
      if (mapInstanceRef.current) return;
      const { lat, lon } = order.deliveryCoordinates;
      const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([lat, lon], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      const icon = L.divIcon({
        html: '<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
        className: 'delivery-pin',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([lat, lon], { icon }).addTo(map);
      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    };
    initMap();
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, [order]);

  const handlePicked = async () => {
    try {
      await fetch(`${API_BASE}/delivery/${token}/picked`, { method: 'POST' });
      setPicked(true);
      startTracking();
    } catch { /* error */ }
  };

  const startTracking = () => {
    if (!order?.orderId) return;
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    if (navigator.geolocation) {
      geoWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setTracking(true);
          socket.emit('domi:location', {
            orderId: order.orderId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: Date.now()
          });
        },
        () => setTracking(false),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    }
  };

  useEffect(() => {
    return () => {
      if (geoWatchRef.current) navigator.geolocation.clearWatch(geoWatchRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (order?.deliveryPickedAt && picked && !tracking && !delivered && !socketRef.current) {
      startTracking();
    }
  }, [order, picked]);

  // Digit input handlers
  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    if (value.length > 1) {
      // Handle paste
      const chars = value.replace(/\D/g, '').split('').slice(0, 4);
      chars.forEach((c, i) => { if (i < 4) newDigits[i] = c; });
      setDigits(newDigits);
      const nextIdx = Math.min(chars.length, 3);
      inputRefs[nextIdx]?.current?.focus();
      return;
    }
    newDigits[index] = value;
    setDigits(newDigits);
    if (value && index < 3) inputRefs[index + 1]?.current?.focus();
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1]?.current?.focus();
    }
  };

  const confirmCode = digits.join('');

  const handleConfirm = async () => {
    if (confirmCode.length !== 4) { setConfirmError('Ingresa los 4 dígitos'); return; }
    setConfirming(true);
    setConfirmError('');
    try {
      const res = await fetch(`${API_BASE}/delivery/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: confirmCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      if (geoWatchRef.current) { navigator.geolocation.clearWatch(geoWatchRef.current); geoWatchRef.current = null; }
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      setTracking(false);
      setDelivered(true);
    } catch (err) {
      setConfirmError(err.message);
      setDigits(['', '', '', '']);
      inputRefs[0]?.current?.focus();
    } finally {
      setConfirming(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200" style={{ borderTopColor: brandColor }} />
          <p className="text-sm text-slate-400">Cargando entrega...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <span className="text-3xl">⏰</span>
          </div>
          <p className="text-lg font-bold text-slate-800 mb-1">{error}</p>
          <p className="text-sm text-slate-400">Este enlace ya no es válido</p>
        </motion.div>
      </div>
    );
  }

  // Delivered success
  if (delivered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: `linear-gradient(135deg, ${brandColor}10, white)` }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-sm w-full">
          {logoUrl && <img src={logoUrl} alt="" className="w-16 h-16 mx-auto rounded-2xl object-cover mb-4 shadow-lg" />}
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 shadow-lg"
            style={{ background: brandColor }}
          >
            <FaCheck className="text-3xl" style={{ color: brandText }} />
          </motion.div>
          <h1 className="text-2xl font-black text-slate-800 mb-1">¡Entrega exitosa!</h1>
          <p className="text-slate-500">Pedido #{order?.orderNumber} entregado</p>
          <p className="text-xs text-slate-400 mt-1">{order?.business?.name}</p>
          <div className="mt-8 bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-400">Powered by</p>
            <p className="font-bold text-red-500">MenuBy</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`.delivery-pin{background:none!important;border:none!important}`}</style>

      {/* Header with brand */}
      <div className="text-white px-4 pt-5 pb-4" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover shadow-md border-2 border-white/20" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black bg-white/20">
                {order?.business?.name?.charAt(0) || '🏪'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs opacity-70">Entrega para</p>
              <h1 className="text-lg font-black truncate">{order?.business?.name}</h1>
            </div>
            <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <p className="text-sm font-bold">#{order?.orderNumber}</p>
            </div>
          </div>

          {/* Status chips */}
          <div className="flex gap-2">
            {picked ? (
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                <FaBoxOpen className="text-[10px]" /> Recogido
              </motion.div>
            ) : (
              <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium opacity-70">
                Pendiente de recoger
              </div>
            )}
            {tracking && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="bg-emerald-400/30 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                <FaLocationArrow className="text-[10px] animate-pulse" /> GPS activo
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-2 space-y-3 pb-8">

        {/* Pick up CTA */}
        {!picked && (
          <motion.button
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            whileTap={{ scale: 0.97 }}
            onClick={handlePicked}
            className="w-full text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 text-lg"
            style={{ background: brandColor, color: brandText }}
          >
            <FaBoxOpen /> Ya recogí el pedido
          </motion.button>
        )}

        {/* GPS warning */}
        {picked && !tracking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <FaLocationArrow className="text-amber-500 text-sm" />
            </div>
            <p className="text-xs text-amber-700 font-medium">Permite el acceso a tu ubicación para que el cliente pueda seguir el pedido</p>
          </motion.div>
        )}

        {/* Customer card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Cliente</p>
              <p className="text-slate-800 font-bold">{order?.customer?.name}</p>
            </div>
            {order?.customer?.phone && (
              <div className="flex gap-2">
                <a href={`tel:${order.customer.phone}`}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm shadow-sm border border-slate-100"
                  style={{ color: brandColor }}>
                  <FaPhone />
                </a>
                <a href={`https://wa.me/${order.customer.phone.replace(/\D/g, '')}`}
                  className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm shadow-sm">
                  <FaWhatsapp />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Address + Map */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Dirección de entrega</p>
            <div className="flex items-start gap-2">
              <FaMapMarkerAlt className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-slate-700 text-sm font-medium">{order?.address || 'No especificada'}</p>
            </div>
          </div>
          {order?.deliveryCoordinates?.lat && (
            <div ref={mapRef} style={{ height: '160px', width: '100%' }} />
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Detalle del pedido</p>
          <div className="space-y-2">
            {order?.items?.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white" style={{ background: brandColor }}>
                    {item.quantity}
                  </span>
                  <span className="text-sm text-slate-700 font-medium">{item.name}</span>
                </div>
                <span className="text-sm text-slate-400 font-mono">${(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-slate-200 mt-3 pt-3 space-y-1">
            {(order?.deliveryFee || 0) > 0 && (
              <div className="flex justify-between text-sm text-slate-400">
                <span>Envío</span>
                <span className="font-mono">${order.deliveryFee.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">Total a cobrar</span>
              <span className="text-lg font-black" style={{ color: brandColor }}>
                ${((order?.total || 0) + (order?.deliveryFee || 0)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Confirm delivery section */}
        <AnimatePresence>
          {picked && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5"
            >
              <div className="text-center mb-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 flex items-center justify-center mb-2">
                  <FaMotorcycle className="text-xl" style={{ color: brandColor }} />
                </div>
                <p className="font-bold text-slate-800 text-sm">Confirmar entrega</p>
                <p className="text-xs text-slate-400 mt-0.5">Pídele el código de 4 dígitos al cliente</p>
              </div>

              {/* 4-digit input boxes */}
              <div className="flex justify-center gap-3 mb-4">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={inputRefs[i]}
                    type="text"
                    inputMode="numeric"
                    maxLength={i === 0 ? 4 : 1}
                    value={d}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                    onFocus={e => e.target.select()}
                    className="w-14 h-16 text-center text-2xl font-black rounded-xl border-2 outline-none transition-all text-slate-800 bg-slate-50 focus:bg-white"
                    style={{
                      borderColor: d ? brandColor : '#e2e8f0',
                      boxShadow: d ? `0 0 0 3px ${brandColor}20` : 'none',
                    }}
                  />
                ))}
              </div>

              {confirmError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-red-500 text-xs text-center mb-3 font-medium">{confirmError}</motion.p>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                disabled={confirming || confirmCode.length !== 4}
                className="w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 text-sm shadow-sm"
                style={{ background: confirmCode.length === 4 ? brandColor : '#94a3b8', color: brandText }}
              >
                {confirming ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30" style={{ borderTopColor: brandText }} />
                ) : (
                  <><FaCheck /> Confirmar entrega</>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tracking indicator */}
        {tracking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10b981' }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#10b981' }} />
            </span>
            <span className="text-xs text-slate-400 font-medium">Compartiendo ubicación en tiempo real</span>
          </motion.div>
        )}

        <p className="text-center text-[10px] text-slate-300 pt-2">
          Powered by <span className="font-bold text-red-400">MenuBy</span>
        </p>
      </div>
    </div>
  );
};

export default DeliveryQRPage;

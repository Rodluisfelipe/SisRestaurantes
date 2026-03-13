import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';
import { io } from 'socket.io-client';
import { FaPhone, FaMotorcycle, FaCheck, FaMapMarkerAlt, FaWhatsapp, FaLocationArrow, FaBoxOpen } from 'react-icons/fa';
import 'leaflet/dist/leaflet.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL.replace('/api', '');
const API_BASE = API_URL;

const STEPS = [
  { key: 'received', label: 'Pedido recibido', sub: 'Tu pedido fue aceptado' },
  { key: 'preparing', label: 'En preparación', sub: 'Estamos preparando tu pedido' },
  { key: 'on_way', label: 'En camino', sub: 'El domiciliario va hacia ti' },
  { key: 'delivered', label: 'Entregado', sub: '¡Disfruta tu pedido!' }
];

function getStepIndex(status, pickedAt) {
  if (status === 'delivered' || status === 'completed') return 3;
  if (pickedAt || status === 'inProgress') return 2;
  if (status === 'preparing' || status === 'ready') return 1;
  return 0;
}

const DeliveryTracker = () => {
  const { businessId: slug, orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [domiLocation, setDomiLocation] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const socketRef = useRef(null);
  const leafletRef = useRef(null);

  const brandColor = order?.business?.buttonColor || '#2563eb';
  const brandText = order?.business?.buttonTextColor || '#ffffff';
  const logoUrl = order?.business?.logo;

  // Fetch order data
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`${API_BASE}/restaurants/${slug}/track/${orderId}`);
        if (!res.ok) throw new Error('Pedido no encontrado');
        const data = await res.json();
        setOrder(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [slug, orderId]);

  // Socket connection
  useEffect(() => {
    if (!order || !orderId) return;

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('delivery:track', { orderId });
    });

    socket.on('order:status', (data) => {
      setOrder(prev => prev ? { ...prev, status: data.status, deliveryPickedAt: data.pickedAt || prev.deliveryPickedAt } : prev);
    });

    socket.on('domi:location', (data) => {
      if (data?.lat != null && data?.lng != null) {
        setDomiLocation({ lat: data.lat, lng: data.lng });
      }
    });

    socket.on('delivery:confirmed', (data) => {
      setOrder(prev => prev ? { ...prev, status: 'delivered', deliveredAt: data.deliveredAt } : prev);
    });

    return () => { socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!order, orderId]);

  // Initialize map when we first get a location
  const ensureMap = useCallback(async (lat, lng) => {
    try {
      if (!mapContainerRef.current) return;

      if (!leafletRef.current) {
        const mod = await import('leaflet');
        leafletRef.current = mod.default || mod;
      }
      const L = leafletRef.current;

      if (!mapRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        mapRef.current = map;
        requestAnimationFrame(() => {
          map.invalidateSize();
          setTimeout(() => map.invalidateSize(), 300);
          setTimeout(() => map.invalidateSize(), 1000);
        });
      }

      const icon = L.divIcon({
        html: `<div style="position:relative"><div style="background:${brandColor};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35)"></div><div style="position:absolute;top:-2px;left:-2px;width:24px;height:24px;border-radius:50%;border:2px solid ${brandColor};opacity:0.3;animation:ping 1.5s infinite"></div></div>`,
        className: 'domi-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current);
      }

      mapRef.current.setView([lat, lng], mapRef.current.getZoom(), { animate: true });
    } catch (err) {
      console.error('[Tracker] Map error:', err);
    }
  }, [brandColor]);

  useEffect(() => {
    if (domiLocation) ensureMap(domiLocation.lat, domiLocation.lng);
  }, [domiLocation, ensureMap]);

  useEffect(() => {
    if (domiLocation && mapRef.current) setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [domiLocation]);

  useEffect(() => {
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200" style={{ borderTopColor: brandColor }} />
          <p className="text-sm text-slate-400">Buscando tu pedido...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 flex items-center justify-center mb-4">
            <FaBoxOpen className="text-2xl text-slate-300" />
          </div>
          <p className="text-lg font-bold text-slate-800 mb-1">Pedido no encontrado</p>
          <p className="text-sm text-slate-400">{error || 'Verifica el enlace e intenta de nuevo'}</p>
        </motion.div>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status, order.deliveryPickedAt);
  const isDelivered = order.status === 'delivered' || order.status === 'completed';
  const showMap = !!domiLocation && !isDelivered;

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        .domi-icon{background:none!important;border:none!important}
        @keyframes ping{0%{transform:scale(1);opacity:0.3}75%,100%{transform:scale(2.2);opacity:0}}
      `}</style>

      {/* Branded header */}
      <div className="text-white px-4 pt-5 pb-4" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover shadow-md border-2 border-white/20" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black bg-white/20">
                {order.business?.name?.charAt(0) || '🏪'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs opacity-70">Seguimiento en vivo</p>
              <h1 className="text-lg font-black truncate">{order.business?.name}</h1>
            </div>
            <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <p className="text-sm font-bold">#{order.orderNumber}</p>
            </div>
          </div>

          {isDelivered && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 mt-1">
              <FaCheck className="text-[10px]" /> Pedido entregado
            </motion.div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-2 space-y-3 pb-8">

        {/* Delivered success card */}
        <AnimatePresence>
          {isDelivered && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3 shadow-md"
                style={{ background: brandColor }}>
                <FaCheck className="text-2xl" style={{ color: brandText }} />
              </motion.div>
              <h2 className="text-xl font-black text-slate-800 mb-1">¡Entregado!</h2>
              <p className="text-sm text-slate-400">Tu pedido ha sido entregado exitosamente</p>
              {order.deliveryCode && (
                <p className="mt-3 text-xs text-slate-300">Código: {order.deliveryCode}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress steps */}
        {!isDelivered && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="space-y-0">
              {STEPS.map((step, i) => {
                const isActive = i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <div key={step.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <motion.div
                        animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all"
                        style={{
                          borderColor: isActive ? brandColor : '#e2e8f0',
                          background: isActive ? `${brandColor}15` : '#f8fafc',
                        }}
                      >
                        {i < currentStep ? (
                          <FaCheck className="text-xs" style={{ color: brandColor }} />
                        ) : (
                          <span className={`text-sm ${isActive ? 'opacity-100' : 'opacity-30'}`}>
                            {i === 0 ? '📩' : i === 1 ? '🍳' : i === 2 ? '🛵' : '✅'}
                          </span>
                        )}
                      </motion.div>
                      {i < STEPS.length - 1 && (
                        <div className="w-0.5 h-6 transition-colors" style={{ background: i < currentStep ? brandColor : '#e2e8f0' }} />
                      )}
                    </div>
                    <div className="pt-1.5">
                      <p className={`text-sm font-semibold ${isActive ? 'text-slate-800' : 'text-slate-300'}`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="text-xs text-slate-400 mt-0.5">{step.sub}</motion.p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Map section */}
        {showMap && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-3 flex items-center gap-2.5">
              <div className="relative">
                <FaMotorcycle className="text-lg" style={{ color: brandColor }} />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10b981' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#10b981' }} />
                </span>
              </div>
              <span className="font-semibold text-slate-800 text-sm flex-1">
                {order.deliveryPersonName || 'Tu domiciliario'} en camino
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${brandColor}15`, color: brandColor }}>
                EN VIVO
              </span>
            </div>
            <div ref={mapContainerRef} style={{ height: '220px', width: '100%' }} />
          </div>
        )}

        {/* Map container hidden if no location */}
        {!showMap && (
          <div ref={mapContainerRef} style={{ height: '0px', width: '100%', overflow: 'hidden' }} />
        )}

        {!domiLocation && !isDelivered && order.trackingEnabled && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${brandColor}10` }}>
              <FaLocationArrow className="text-sm" style={{ color: brandColor }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Esperando ubicación</p>
              <p className="text-xs text-slate-400">El domiciliario aún no ha compartido su GPS</p>
            </div>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Tu pedido</p>
          <div className="space-y-2">
            {order.items?.map((item, i) => (
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
            {(order.deliveryFee || 0) > 0 && (
              <div className="flex justify-between text-sm text-slate-400">
                <span>Envío</span>
                <span className="font-mono">${order.deliveryFee.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">Total</span>
              <span className="text-lg font-black" style={{ color: brandColor }}>
                ${((order.total || 0) + (order.deliveryFee || 0)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Confirmation code for client */}
        {order.deliveryCode && !isDelivered && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Código de confirmación</p>
            <p className="text-xs text-slate-400 mb-3">Dale este código al domiciliario al recibir tu pedido</p>
            <div className="flex justify-center gap-2">
              {order.deliveryCode.split('').map((c, i) => (
                <div key={i} className="w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-black border-2"
                  style={{ borderColor: brandColor, color: brandColor, background: `${brandColor}08` }}>
                  {c}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        {order.business?.phone && (
          <div className="flex gap-2">
            <a href={`tel:${order.business.phone}`}
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-100 shadow-sm text-slate-700 font-medium py-3 rounded-xl text-sm">
              <FaPhone className="text-xs" style={{ color: brandColor }} />
              Llamar
            </a>
            <a href={`https://wa.me/${order.business.phone.replace(/\D/g, '')}`}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white font-medium py-3 rounded-xl text-sm shadow-sm">
              <FaWhatsapp /> WhatsApp
            </a>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-300 pt-2">
          Powered by <span className="font-bold text-red-400">MenuBy</span>
        </p>
      </div>
    </div>
  );
};

export default DeliveryTracker;

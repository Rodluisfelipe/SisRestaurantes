import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_URL } from '../../config';
import { io } from 'socket.io-client';
import { FaPhone, FaMotorcycle, FaCheckCircle } from 'react-icons/fa';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL.replace('/api', '');
const API_BASE = API_URL;

const STEPS = [
  { key: 'received', label: 'Pedido recibido', icon: '📩' },
  { key: 'preparing', label: 'En preparación', icon: '🍳' },
  { key: 'on_way', label: 'Domi en camino', icon: '🛵' },
  { key: 'delivered', label: 'Entregado', icon: '✅' }
];

// Map order status to step index
function getStepIndex(status, pickedAt) {
  if (status === 'delivered' || status === 'completed') return 3;
  if (pickedAt || status === 'inProgress') return 2;
  if (status === 'preparing' || status === 'ready') return 1;
  return 0; // pending, confirmed, payment_*
}

const DeliveryTracker = () => {
  const { businessId: slug, orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [domiLocation, setDomiLocation] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const socketRef = useRef(null);

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

  // Socket connection for live updates
  useEffect(() => {
    if (!order || !orderId) return;

    console.log('[Tracker] Connecting socket to:', SOCKET_URL, 'for orderId:', orderId);
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Tracker] Socket connected:', socket.id, '- joining room order:', orderId);
      socket.emit('delivery:track', { orderId });
    });

    socket.on('connect_error', (err) => {
      console.error('[Tracker] Socket connect error:', err.message);
    });

    socket.on('order:status', (data) => {
      setOrder(prev => prev ? { ...prev, status: data.status, deliveryPickedAt: data.pickedAt || prev.deliveryPickedAt } : prev);
    });

    socket.on('domi:location', (data) => {
      console.log('[Tracker] Received domi:location', data);
      setDomiLocation({ lat: data.lat, lng: data.lng });
    });

    socket.on('delivery:confirmed', (data) => {
      setOrder(prev => prev ? { ...prev, status: 'delivered', deliveredAt: data.deliveredAt } : prev);
    });

    return () => {
      console.log('[Tracker] Disconnecting socket');
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!order, orderId]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!domiLocation || !mapRef.current) return;

    try {
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current, {
          zoomControl: true,
          attributionControl: false,
        }).setView([domiLocation.lat, domiLocation.lng], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;

        // Fix tile rendering after container mount
        setTimeout(() => map.invalidateSize(), 200);
        setTimeout(() => map.invalidateSize(), 800);
      }

      const domiIcon = L.divIcon({
        html: '<div style="background:#ef4444;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:12px;">🛵</div>',
        className: 'domi-marker',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([domiLocation.lat, domiLocation.lng]);
      } else {
        markerRef.current = L.marker([domiLocation.lat, domiLocation.lng], { icon: domiIcon }).addTo(mapInstanceRef.current);
      }

      mapInstanceRef.current.setView([domiLocation.lat, domiLocation.lng], mapInstanceRef.current.getZoom());
    } catch (err) {
      console.error('[Tracker] Map error:', err);
    }
  }, [domiLocation]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-6xl mb-4">📦</p>
          <p className="text-lg font-bold text-slate-800">Pedido no encontrado</p>
          <p className="text-sm text-slate-500 mt-2">{error || 'Verifica el enlace e intenta de nuevo.'}</p>
        </div>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status, order.deliveryPickedAt);
  const isDelivered = order.status === 'delivered' || order.status === 'completed';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-800">Pedido #{order.orderNumber}</h1>
              <p className="text-sm text-slate-500">{order.business?.name}</p>
            </div>
            {isDelivered && (
              <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                <FaCheckCircle /> Entregado
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Progress bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const isActive = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={{ scale: isCurrent ? [1, 1.15, 1] : 1 }}
                      transition={{ repeat: isCurrent ? Infinity : 0, duration: 1.5 }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 ${
                        isActive
                          ? 'bg-emerald-100 border-emerald-500'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {step.icon}
                    </motion.div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-0.5 h-8 ${i < currentStep ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                    )}
                  </div>
                  <div className="pt-2">
                    <p className={`text-sm font-medium ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                      {step.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Map */}
        {domiLocation && !isDelivered && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <style>{`
              .domi-marker { background: none !important; border: none !important; }
              .leaflet-container { width: 100% !important; height: 100% !important; }
              .leaflet-tile-pane img { visibility: visible !important; }
            `}</style>
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <FaMotorcycle className="text-red-500 animate-pulse" />
              <span className="font-medium text-slate-800 text-sm">
                {order.deliveryPersonName ? `${order.deliveryPersonName} en camino` : 'Domiciliario en camino'}
              </span>
            </div>
            <div ref={mapRef} style={{ height: '300px', width: '100%', position: 'relative' }} />
          </div>
        )}

        {!domiLocation && !isDelivered && order.trackingEnabled && (
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <FaMotorcycle className="text-slate-300 text-3xl mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Ubicación no disponible</p>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h3 className="font-bold text-slate-800 text-sm mb-3">Tu pedido</h3>
          {order.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1.5 text-slate-600">
              <span>{item.quantity}x {item.name}</span>
            </div>
          ))}
          {order.deliveryFee > 0 && (
            <div className="flex justify-between text-sm py-1.5 text-slate-500 border-t border-slate-100 mt-2 pt-2">
              <span>Envío</span>
              <span>${order.deliveryFee.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-800 border-t border-slate-100 mt-2 pt-2">
            <span>Total</span>
            <span>${((order.total || 0) + (order.deliveryFee || 0)).toLocaleString()}</span>
          </div>
        </div>

        {/* Contact */}
        {order.business?.phone && (
          <a
            href={`tel:${order.business.phone}`}
            className="flex items-center justify-center gap-2 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-xl transition-colors text-sm"
          >
            <FaPhone className="text-xs" />
            Contactar al restaurante
          </a>
        )}

        {/* Powered by */}
        <p className="text-center text-xs text-slate-400 pb-4">
          Seguimiento por <span className="font-bold text-red-500">MenuBy</span>
        </p>
      </div>
    </div>
  );
};

export default DeliveryTracker;

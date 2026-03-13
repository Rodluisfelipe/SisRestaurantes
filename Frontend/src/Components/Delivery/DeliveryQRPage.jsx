import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_URL } from '../../config';
import { FaMapMarkerAlt, FaPhone, FaCheck, FaBoxOpen } from 'react-icons/fa';

const API_BASE = API_URL;

const DeliveryQRPage = () => {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [picked, setPicked] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

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
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [token]);

  // Initialize map if coordinates exist
  useEffect(() => {
    if (!order?.deliveryCoordinates?.lat || !mapRef.current) return;

    // Load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initMap = async () => {
      const L = await import('leaflet');
      if (mapInstanceRef.current) return;

      const { lat, lon } = order.deliveryCoordinates;
      mapInstanceRef.current = L.map(mapRef.current).setView([lat, lon], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(mapInstanceRef.current);

      const icon = L.divIcon({
        html: '<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      L.marker([lat, lon], { icon }).addTo(mapInstanceRef.current);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [order]);

  const handlePicked = async () => {
    try {
      await fetch(`${API_BASE}/delivery/${token}/picked`, { method: 'POST' });
      setPicked(true);
    } catch { /* error */ }
  };

  const handleConfirm = async () => {
    if (confirmCode.length !== 4) {
      setConfirmError('Ingresa los 4 dígitos');
      return;
    }
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
      setDelivered(true);
    } catch (err) {
      setConfirmError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-5xl mb-4">⏰</p>
          <p className="text-lg font-bold text-slate-800">{error}</p>
        </div>
      </div>
    );
  }

  if (delivered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <FaCheck className="text-emerald-500 text-3xl" />
          </div>
          <p className="text-xl font-bold text-slate-800">¡Entrega confirmada!</p>
          <p className="text-sm text-slate-500 mt-2">Pedido #{order?.orderNumber}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-4">
        <div className="max-w-lg mx-auto">
          <p className="text-xs text-slate-400">Entrega para</p>
          <h1 className="text-lg font-bold">Pedido #{order?.orderNumber}</h1>
          <p className="text-sm text-slate-300">{order?.business?.name}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Customer info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h3 className="font-bold text-slate-800 text-sm mb-3">Cliente</h3>
          <p className="text-slate-700 font-medium">{order?.customer?.name}</p>
          {order?.customer?.phone && (
            <a href={`tel:${order.customer.phone}`} className="text-blue-500 text-sm flex items-center gap-1 mt-1">
              <FaPhone className="text-xs" /> {order.customer.phone}
            </a>
          )}
        </div>

        {/* Address + Map */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4">
            <h3 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-1">
              <FaMapMarkerAlt className="text-red-400" /> Dirección
            </h3>
            <p className="text-slate-700">{order?.address || 'No especificada'}</p>
          </div>
          {order?.deliveryCoordinates?.lat && (
            <div ref={mapRef} className="h-48 w-full" />
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h3 className="font-bold text-slate-800 text-sm mb-3">Productos</h3>
          {order?.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1.5">
              <span className="text-slate-700">{item.quantity}x {item.name}</span>
              <span className="text-slate-500">${(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          {(order?.deliveryFee || 0) > 0 && (
            <div className="flex justify-between text-sm py-1.5 border-t border-slate-100 mt-2 pt-2 text-slate-500">
              <span>Envío</span>
              <span>${order.deliveryFee.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-800 border-t border-slate-100 mt-2 pt-2">
            <span>Total a cobrar</span>
            <span>${((order?.total || 0) + (order?.deliveryFee || 0)).toLocaleString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pb-6">
          {!picked && (
            <button
              onClick={handlePicked}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <FaBoxOpen /> Ya recogí el pedido
            </button>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
            <p className="text-sm text-slate-600 text-center font-medium">Pídele el código de entrega al cliente</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={confirmCode}
              onChange={e => setConfirmCode(e.target.value.replace(/\D/g, ''))}
              placeholder="4 dígitos"
              className="w-full text-center text-3xl font-bold tracking-[0.3em] p-4 border-2 border-slate-200 rounded-xl focus:border-emerald-400 outline-none"
            />
            {confirmError && <p className="text-red-500 text-sm text-center">{confirmError}</p>}
            <button
              onClick={handleConfirm}
              disabled={confirming || confirmCode.length !== 4}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <FaCheck /> Confirmar entrega
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryQRPage;

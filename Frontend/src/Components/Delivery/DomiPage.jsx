import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';
import { io } from 'socket.io-client';
import { FaMotorcycle, FaMapMarkerAlt, FaPhone, FaCheck, FaBoxOpen, FaSignOutAlt, FaBell } from 'react-icons/fa';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;
const API_BASE = API_URL;

const DomiPage = () => {
  const { businessId: slug } = useParams();
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState('');
  const [token, setToken] = useState(null);
  const [domiInfo, setDomiInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const geoWatchRef = useRef(null);

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/${slug}/domi/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setToken(data.token);
      setDomiInfo(data);
      setAuthenticated(true);
      setCode('');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/${slug}/domi/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        setAuthenticated(false);
        setToken(null);
        return;
      }
      const data = await res.json();
      setOrders(data);
    } catch {
      // Network error, retry later
    }
  }, [token, slug]);

  // Socket connection
  useEffect(() => {
    if (!authenticated || !token || !domiInfo) return;

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (domiInfo.mode === 'profile' && domiInfo.deliveryPersonId) {
        socket.emit('domi:join', { deliveryPersonId: domiInfo.deliveryPersonId, businessId: domiInfo.slug });
      } else {
        socket.emit('domi:joinFixed', { businessId: domiInfo.slug });
      }
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('delivery:assigned', () => {
      fetchOrders();
      playAlert();
    });

    socket.on('orderUpdated', () => {
      fetchOrders();
    });

    fetchOrders();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authenticated, token, domiInfo, fetchOrders]);

  // Sound & vibration alert
  const playAlert = () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JjYmDenBka3OAiYuIg3pwZWtygIiLh4N6cGRrcoCIi4eDenBka3OAiIuHg3pwZGtzgIiLh4N6cGVrc4CIi4eDenBka3OAiIuHg3pwZGtzgA==');
      }
      audioRef.current.play().catch(() => {});
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch { /* Silent fail */ }
  };

  // Mark as picked up
  const handlePicked = async (orderId) => {
    try {
      await fetch(`${API_BASE}/api/restaurants/${slug}/domi/orders/${orderId}/picked`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      fetchOrders();
      startTracking(orderId);
    } catch { /* error */ }
  };

  // Start GPS tracking
  const startTracking = (orderId) => {
    if (!navigator.geolocation) return;
    if (geoWatchRef.current) navigator.geolocation.clearWatch(geoWatchRef.current);

    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (socketRef.current) {
          socketRef.current.emit('domi:location', {
            deliveryPersonId: domiInfo?.deliveryPersonId || null,
            orderId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: Date.now()
          });
        }
      },
      () => { /* GPS denied or error — continue without tracking */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  };

  // Confirm delivery
  const handleConfirm = async (orderId) => {
    if (confirmCode.length !== 4) {
      setConfirmError('Ingresa los 4 dígitos');
      return;
    }
    setLoading(true);
    setConfirmError('');
    try {
      const res = await fetch(`${API_BASE}/api/restaurants/${slug}/domi/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: confirmCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Stop GPS tracking
      if (geoWatchRef.current) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }

      setConfirmingOrderId(null);
      setConfirmCode('');
      fetchOrders();
    } catch (err) {
      setConfirmError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    if (geoWatchRef.current) navigator.geolocation.clearWatch(geoWatchRef.current);
    setAuthenticated(false);
    setToken(null);
    setDomiInfo(null);
    setOrders([]);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (geoWatchRef.current) navigator.geolocation.clearWatch(geoWatchRef.current);
    };
  }, []);

  // ===== LOGIN SCREEN =====
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 flex items-center justify-center mb-3">
              <FaMotorcycle className="text-red-500 text-2xl" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Portal Domiciliario</h1>
            <p className="text-sm text-slate-500 mt-1">Ingresa tu código para comenzar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Código de acceso"
              className="w-full text-center text-2xl font-bold tracking-[0.3em] p-4 border-2 border-slate-200 rounded-xl focus:border-red-400 focus:ring-0 outline-none"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !code}
              className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ===== MAIN DOMI DASHBOARD =====
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <FaMotorcycle className="text-red-400" />
          <div>
            <p className="font-bold text-sm">{domiInfo?.name || 'Domiciliario'}</p>
            <p className="text-xs text-slate-400">{domiInfo?.businessName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
          <button onClick={handleLogout} className="p-2 hover:bg-slate-700 rounded-lg">
            <FaSignOutAlt className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Orders list */}
      <div className="p-4 space-y-4 pb-20">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <FaBell className="text-slate-300 text-5xl mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Sin pedidos asignados</p>
            <p className="text-slate-400 text-sm mt-1">Cuando te asignen un pedido, aparecerá aquí.</p>
          </div>
        ) : (
          orders.map(order => (
            <motion.div
              key={order._id}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
            >
              {/* Order header */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800">#{order.orderNumber}</span>
                  <span className="text-xs text-slate-500">
                    {order.deliveryAssignedAt && new Date(order.deliveryAssignedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Customer */}
                <p className="text-sm font-medium text-slate-700">{order.customerName}</p>
                {order.phone && (
                  <a href={`tel:${order.phone}`} className="text-sm text-blue-500 flex items-center gap-1 mt-1">
                    <FaPhone className="text-xs" /> {order.phone}
                  </a>
                )}
                {order.address && (
                  <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                    <FaMapMarkerAlt className="text-red-400 text-xs flex-shrink-0" />
                    <span>{order.address}</span>
                  </p>
                )}
              </div>

              {/* Items */}
              <div className="p-4 border-b border-slate-100">
                {order.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span className="text-slate-700">{item.quantity}x {item.name}</span>
                    <span className="text-slate-500">${(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-slate-800 pt-2 mt-2 border-t border-slate-100">
                  <span>Total</span>
                  <span>${((order.finalAmount || order.totalAmount) + (order.deliveryFee || 0)).toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 space-y-2">
                {!order.deliveryPickedAt && (
                  <button
                    onClick={() => handlePicked(order._id)}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <FaBoxOpen /> Ya recogí el pedido
                  </button>
                )}

                {confirmingOrderId === order._id ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600 text-center">Pídele el código al cliente</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={confirmCode}
                      onChange={e => setConfirmCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="4 dígitos"
                      className="w-full text-center text-2xl font-bold tracking-[0.3em] p-3 border-2 border-slate-200 rounded-xl focus:border-emerald-400 outline-none"
                      autoFocus
                    />
                    {confirmError && <p className="text-red-500 text-xs text-center">{confirmError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setConfirmingOrderId(null); setConfirmCode(''); setConfirmError(''); }}
                        className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleConfirm(order._id)}
                        disabled={loading || confirmCode.length !== 4}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingOrderId(order._id)}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <FaCheck /> Confirmar entrega
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default DomiPage;

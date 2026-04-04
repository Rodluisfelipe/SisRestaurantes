import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';
import { io } from 'socket.io-client';
import {
  FaMotorcycle, FaMapMarkerAlt, FaPhone, FaCheck, FaBoxOpen,
  FaSignOutAlt, FaBell, FaWhatsapp, FaRoute, FaCopy, FaClock,
  FaChevronDown, FaChevronUp, FaMoneyBillWave, FaStickyNote,
  FaExclamationTriangle, FaWifi, FaSpinner
} from 'react-icons/fa';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;
const API_BASE = API_URL;

// ── Helpers ──
const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

const elapsedMinutes = (dateStr) => {
  if (!dateStr) return 0;
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
};

const formatCurrency = (amount) => {
  return '$' + (amount || 0).toLocaleString('es-CO');
};

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
  const [expandedItems, setExpandedItems] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [pickedSuccess, setPickedSuccess] = useState(null);
  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const geoWatchRef = useRef(null);

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/restaurants/${slug}/domi/auth`, {
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
      const res = await fetch(`${API_BASE}/restaurants/${slug}/domi/orders`, {
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
      await fetch(`${API_BASE}/restaurants/${slug}/domi/orders/${orderId}/picked`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      setPickedSuccess(orderId);
      setTimeout(() => setPickedSuccess(null), 2000);
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
    const order = orders.find(o => o._id === orderId);
    const requireCode = order?.requireConfirmationCode !== false;
    if (requireCode && confirmCode.length !== 4) {
      setConfirmError('Ingresa los 4 dígitos');
      return;
    }
    setLoading(true);
    setConfirmError('');
    try {
      const res = await fetch(`${API_BASE}/restaurants/${slug}/domi/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requireCode ? { code: confirmCode } : {})
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

  // ── Quick-action helpers ──

  // Open WhatsApp with a pre-filled message to the customer
  const openWhatsApp = (order, messageType = 'onTheWay') => {
    if (!order.phone) return;
    const phone = order.phone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('57') ? phone : `57${phone}`;

    const messages = {
      onTheWay: `Hola ${order.customerName || ''}, soy tu domiciliario de ${domiInfo?.businessName || 'tu restaurante'}. Ya voy en camino con tu pedido #${order.orderNumber}. 🛵`,
      arriving: `Hola ${order.customerName || ''}, ya estoy llegando con tu pedido #${order.orderNumber}. Por favor ten listo el código de confirmación. 📦`,
      outside: `Hola ${order.customerName || ''}, ya estoy afuera con tu pedido #${order.orderNumber}. 🏠`,
      cantFind: `Hola ${order.customerName || ''}, soy tu domiciliario y no encuentro la dirección para tu pedido #${order.orderNumber}. ¿Podrías darme más indicaciones? 📍`
    };

    const text = encodeURIComponent(messages[messageType]);
    window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank');
  };

  // Open Google Maps navigation to address
  const openNavigation = (address) => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`, '_blank');
  };

  // Copy address to clipboard
  const copyAddress = async (orderId, address) => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(orderId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = address;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(orderId);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  // Toggle item details
  const toggleItems = (orderId) => {
    setExpandedItems(prev => ({ ...prev, [orderId]: !prev[orderId] }));
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

  // Order status helpers
  const getStatusBadge = (order) => {
    if (order.deliveryPickedAt) return { label: 'En camino', color: 'bg-blue-500', textColor: 'text-white' };
    return { label: 'Por recoger', color: 'bg-amber-100', textColor: 'text-amber-800' };
  };

  // Payment method label
  const getPaymentLabel = (method) => {
    const map = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', nequi: 'Nequi', daviplata: 'Daviplata' };
    return map[method] || method || 'No especificado';
  };

  // ===== LOGIN SCREEN =====
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm"
        >
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mb-4 shadow-lg shadow-red-200">
              <FaMotorcycle className="text-white text-3xl" />
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
              className="w-full text-center text-2xl font-bold tracking-[0.3em] p-4 border-2 border-slate-200 rounded-xl focus:border-red-400 focus:ring-0 outline-none transition-colors"
              autoFocus
            />
            {error && (
              <motion.p initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
                {error}
              </motion.p>
            )}
            <button
              type="submit"
              disabled={loading || !code}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-red-200 active:scale-[0.98]"
            >
              {loading ? <FaSpinner className="animate-spin mx-auto text-xl" /> : 'Entrar'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ===== MAIN DOMI DASHBOARD =====
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3 sticky top-0 z-20 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
              <FaMotorcycle className="text-red-400 text-sm" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{domiInfo?.name || 'Domiciliario'}</p>
              <p className="text-[11px] text-slate-400">{domiInfo?.businessName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full ${connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
              {connected ? 'En línea' : 'Sin conexión'}
            </div>
            {/* Active count badge */}
            {orders.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {orders.length}
              </span>
            )}
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-1">
              <FaSignOutAlt className="text-slate-400 text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* Reconnection banner */}
      <AnimatePresence>
        {!connected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800 text-xs overflow-hidden"
          >
            <FaExclamationTriangle className="flex-shrink-0" />
            <span>Conexión perdida. Reconectando automáticamente...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orders list */}
      <div className="p-4 space-y-4 pb-24">
        {orders.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <FaBell className="text-slate-300 text-3xl" />
            </div>
            <p className="text-slate-500 font-semibold text-lg">Sin pedidos asignados</p>
            <p className="text-slate-400 text-sm mt-2 max-w-[260px] mx-auto">Cuando te asignen un pedido, aparecerá aquí con alerta y vibración.</p>
            <div className="mt-6 text-xs text-slate-400 flex items-center justify-center gap-1">
              <FaWifi className={connected ? 'text-emerald-400' : 'text-red-400'} />
              {connected ? 'Conectado — esperando pedidos' : 'Reconectando...'}
            </div>
          </motion.div>
        ) : (
          orders.map((order, idx) => {
            const status = getStatusBadge(order);
            const elapsed = elapsedMinutes(order.deliveryAssignedAt);
            const isExpanded = expandedItems[order._id];
            const totalWithDelivery = (order.finalAmount || order.totalAmount || 0) + (order.deliveryFee || 0);

            return (
              <motion.div
                key={order._id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                {/* Status strip */}
                <div className={`h-1 ${order.deliveryPickedAt ? 'bg-blue-500' : 'bg-amber-400'}`} />

                {/* Order header */}
                <div className="p-4 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-slate-800">#{order.orderNumber}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.color} ${status.textColor}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <FaClock className="text-[10px]" />
                      <span className="text-xs font-medium">{elapsed > 0 ? `${elapsed} min` : 'Ahora'}</span>
                    </div>
                  </div>

                  {/* Customer info */}
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-slate-700">{order.customerName}</p>

                    {/* Address with copy + nav */}
                    {order.address && (
                      <div className="flex items-start gap-1.5">
                        <FaMapMarkerAlt className="text-red-400 text-xs mt-1 flex-shrink-0" />
                        <p className="text-sm text-slate-600 flex-1 leading-snug">{order.address}</p>
                      </div>
                    )}
                  </div>

                  {/* Quick action bar — Address tools + Contact */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {/* Navigate with Google Maps */}
                    {order.address && (
                      <button
                        onClick={() => openNavigation(order.address)}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-600 px-3 py-2 rounded-xl active:scale-95 transition-transform"
                      >
                        <FaRoute className="text-[11px]" /> Ir con GPS
                      </button>
                    )}

                    {/* Copy address */}
                    {order.address && (
                      <button
                        onClick={() => copyAddress(order._id, order.address)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all ${
                          copiedId === order._id ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {copiedId === order._id ? <><FaCheck className="text-[11px]" /> Copiada</> : <><FaCopy className="text-[11px]" /> Copiar</>}
                      </button>
                    )}

                    {/* Call */}
                    {order.phone && (
                      <a
                        href={`tel:${order.phone}`}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-2 rounded-xl active:scale-95 transition-transform"
                      >
                        <FaPhone className="text-[11px]" /> Llamar
                      </a>
                    )}
                  </div>

                  {/* WhatsApp quick messages */}
                  {order.phone && (
                    <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1 -mx-1 px-1">
                      <button
                        onClick={() => openWhatsApp(order, 'onTheWay')}
                        className="flex items-center gap-1.5 text-[11px] font-semibold bg-green-50 text-green-700 pl-2.5 pr-3 py-1.5 rounded-full whitespace-nowrap active:scale-95 transition-transform border border-green-100"
                      >
                        <FaWhatsapp /> Voy en camino
                      </button>
                      <button
                        onClick={() => openWhatsApp(order, 'arriving')}
                        className="flex items-center gap-1.5 text-[11px] font-semibold bg-green-50 text-green-700 pl-2.5 pr-3 py-1.5 rounded-full whitespace-nowrap active:scale-95 transition-transform border border-green-100"
                      >
                        <FaWhatsapp /> Ya llego
                      </button>
                      <button
                        onClick={() => openWhatsApp(order, 'outside')}
                        className="flex items-center gap-1.5 text-[11px] font-semibold bg-green-50 text-green-700 pl-2.5 pr-3 py-1.5 rounded-full whitespace-nowrap active:scale-95 transition-transform border border-green-100"
                      >
                        <FaWhatsapp /> Estoy afuera
                      </button>
                      <button
                        onClick={() => openWhatsApp(order, 'cantFind')}
                        className="flex items-center gap-1.5 text-[11px] font-semibold bg-amber-50 text-amber-700 pl-2.5 pr-3 py-1.5 rounded-full whitespace-nowrap active:scale-95 transition-transform border border-amber-100"
                      >
                        <FaExclamationTriangle className="text-[10px]" /> No encuentro
                      </button>
                    </div>
                  )}
                </div>

                {/* Payment + order info */}
                <div className="mx-4 mt-1 mb-3 flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <FaMoneyBillWave className="text-emerald-500" />
                    <span className="font-medium">{getPaymentLabel(order.paymentMethod)}</span>
                  </div>
                  <span className="font-bold text-base text-slate-800">{formatCurrency(totalWithDelivery)}</span>
                </div>

                {/* Delivery fee breakdown if exists */}
                {order.deliveryFee > 0 && (
                  <div className="mx-4 mb-3 flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>Producto: {formatCurrency(order.finalAmount || order.totalAmount)}</span>
                    <span>Envío: {formatCurrency(order.deliveryFee)}</span>
                  </div>
                )}

                {/* Customer notes */}
                {order.notes && (
                  <div className="mx-4 mb-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
                    <FaStickyNote className="text-amber-500 text-xs mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">{order.notes}</p>
                  </div>
                )}

                {/* Expandable items list */}
                <div className="mx-4 mb-3">
                  <button
                    onClick={() => toggleItems(order._id)}
                    className="w-full flex items-center justify-between text-xs text-slate-500 font-medium px-1 py-1.5"
                  >
                    <span>{order.items?.length || 0} producto{(order.items?.length || 0) !== 1 ? 's' : ''}</span>
                    {isExpanded ? <FaChevronUp className="text-[10px]" /> : <FaChevronDown className="text-[10px]" />}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                          {order.items?.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-slate-700">
                                <span className="font-semibold text-slate-800">{item.quantity}x</span> {item.name}
                                {item.selectedToppings?.length > 0 && (
                                  <span className="text-[11px] text-slate-400 block ml-5">
                                    {item.selectedToppings.flatMap(t => t.subGroups ? t.subGroups.flatMap(sg => sg.items?.map(si => si.name) || []) : [t.name]).filter(Boolean).join(', ')}
                                  </span>
                                )}
                              </span>
                              <span className="text-slate-500 font-medium">{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Main Actions ── */}
                <div className="p-4 pt-0 space-y-2">
                  {/* Pick up button */}
                  {!order.deliveryPickedAt && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handlePicked(order._id)}
                      className={`w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm ${
                        pickedSuccess === order._id
                          ? 'bg-emerald-500 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white active:bg-blue-700'
                      }`}
                    >
                      {pickedSuccess === order._id ? (
                        <><FaCheck /> Recogido</>
                      ) : (
                        <><FaBoxOpen /> Ya recogí el pedido</>
                      )}
                    </motion.button>
                  )}

                  {/* Confirm delivery */}
                  <AnimatePresence mode="wait">
                    {confirmingOrderId === order._id ? (
                      <motion.div
                        key="confirm-form"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3 bg-emerald-50 border border-emerald-100 p-4 rounded-xl"
                      >
                        {order.requireConfirmationCode !== false ? (
                          <>
                            <p className="text-sm text-emerald-800 text-center font-medium">Pídele el código de 4 dígitos al cliente</p>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              value={confirmCode}
                              onChange={e => setConfirmCode(e.target.value.replace(/\D/g, ''))}
                              placeholder="● ● ● ●"
                              className="w-full text-center text-3xl font-bold tracking-[0.5em] p-3 border-2 border-emerald-200 rounded-xl focus:border-emerald-400 outline-none bg-white"
                              autoFocus
                            />
                          </>
                        ) : (
                          <p className="text-sm text-emerald-800 text-center font-medium">¿Confirmar que entregaste el pedido?</p>
                        )}
                        {confirmError && (
                          <motion.p initial={{ shake: true }} className="text-red-500 text-xs text-center bg-red-50 p-2 rounded-lg">{confirmError}</motion.p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setConfirmingOrderId(null); setConfirmCode(''); setConfirmError(''); }}
                            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-medium bg-white active:bg-slate-50"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleConfirm(order._id)}
                            disabled={loading || (order.requireConfirmationCode !== false && confirmCode.length !== 4)}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                          >
                            {loading ? <FaSpinner className="animate-spin" /> : <><FaCheck /> Confirmar</>}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="confirm-btn"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setConfirmingOrderId(order._id)}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm active:bg-emerald-700"
                      >
                        <FaCheck /> Confirmar entrega
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Floating refresh button for manual fallback */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={fetchOrders}
          className="w-12 h-12 bg-slate-800 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform"
          title="Actualizar pedidos"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default DomiPage;

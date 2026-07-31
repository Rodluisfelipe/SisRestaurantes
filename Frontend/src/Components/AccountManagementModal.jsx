import React, { useState, useEffect } from 'react';
import { FaTimes, FaUser, FaBox, FaPhone, FaMapMarkerAlt, FaClock, FaCheckCircle, FaTimesCircle, FaEdit, FaSave, FaStore, FaTruck, FaShoppingBag, FaTicketAlt, FaLock } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { logSystem } from '../utils/systemLogger';
import { useBusinessConfig } from '../Context/BusinessContext';

const EMPTY_ARRAY = [];

/* fullScreen: en el menú V2 esta sección deja de ser un modal flotante y se
   comporta como una pantalla de app (entra desde la derecha y ocupa todo). */
const AccountManagementModal = ({ isOpen, onClose, customerData, orders = EMPTY_ARRAY, initialTab = 'profile', fullScreen = false }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [profileData, setProfileData] = useState({
    name: customerData?.name || '',
    phone: customerData?.phone || '',
    address: customerData?.address || ''
  });

  // Actualizar profileData cuando cambien customerData
  useEffect(() => {
    if (customerData) {
      setProfileData({
        name: customerData.name || '',
        phone: customerData.phone || '',
        address: customerData.address || ''
      });
    }
  }, [customerData]);

  // Actualizar pestaña activa cuando cambie initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState(orders);
  const { businessConfig } = useBusinessConfig();
  const bizId = businessConfig?._id || businessConfig?.businessId;

  // Cargar datos del cliente desde la base de datos
  useEffect(() => {
    const loadCustomerData = async () => {
      if (!customerData?.phone || !bizId) return;
      
      setIsLoading(true);
      try {
        // Cargar datos del cliente desde la BD
        const response = await api.get(`/customers/${customerData.phone}?businessId=${bizId}`);
        const dbCustomerData = response.data;
        
        setProfileData({
          name: dbCustomerData.name || customerData.name || '',
          phone: dbCustomerData.phone || customerData.phone || '',
          address: dbCustomerData.address || customerData.address || ''
        });
      } catch (error) {
        // Si no existe en BD, usar datos locales
        setProfileData({
          name: customerData.name || '',
          phone: customerData.phone || '',
          address: customerData.address || ''
        });
        logSystem('Cliente no encontrado en BD, usando datos locales', error);
      }

      // Siempre intentar cargar pedidos (independiente del perfil)
      try {
        const ordersResponse = await api.get(`/orders/my-orders?phone=${encodeURIComponent(customerData.phone)}&businessId=${bizId}`);
        const { active = [], completed = [] } = ordersResponse.data || {};
        // Active/pending orders first (sorted by date), then completed
        const sortedActive = [...active].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const sortedCompleted = [...completed].sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));
        setCustomerOrders([...sortedActive, ...sortedCompleted]);
      } catch (orderErr) {
        logSystem('Error al cargar pedidos del cliente', orderErr);
      }

      setIsLoading(false);
    };

    if (isOpen) {
      loadCustomerData();
    }
  }, [customerData, bizId, isOpen]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Guardar en localStorage
      Object.keys(profileData).forEach(key => {
        if (profileData[key] && key !== 'phone' && typeof profileData[key] === 'string') {
          localStorage.setItem(`customer${key.charAt(0).toUpperCase() + key.slice(1)}`, profileData[key]);
        }
      });

      // Guardar en backend
      if (bizId && profileData.phone) {
        try {
          await api.put(`/customers/${profileData.phone}?businessId=${bizId}`, {
            name: profileData.name,
            address: profileData.address
          });
          logSystem('Perfil guardado en BD correctamente');
        } catch (dbError) {
          // Si no existe, crear cliente
          await api.post(`/customers?businessId=${businessConfig.businessId}`, {
            phone: profileData.phone,
            name: profileData.name,
            address: profileData.address
          });
          logSystem('Cliente creado en BD correctamente');
        }
      }

      setIsEditing(false);
    } catch (error) {
      logSystem('Error al guardar perfil', error);
    } finally {
      setIsSaving(false);
    }
  };

  const isCancelledOrExpired = (status) => status === 'cancelled' || status === 'expired';

  const getOrderStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <FaClock className="text-yellow-500 text-xs" />;
      case 'pending_payment': return <FaClock className="text-amber-500 text-xs" />;
      case 'payment_uploaded': return <FaClock className="text-purple-500 text-xs" />;
      case 'payment_confirmed': return <FaCheckCircle className="text-green-500 text-xs" />;
      case 'preparing': return <FaClock className="text-blue-500 text-xs" />;
      case 'ready': return <FaCheckCircle className="text-green-500 text-xs" />;
      case 'completed': return <FaCheckCircle className="text-green-600 text-xs" />;
      case 'cancelled': case 'expired': return <FaTimesCircle className="text-red-500 text-xs" />;
      case 'delivered': return <FaCheckCircle className="text-green-700 text-xs" />;
      case 'inProgress': return <FaClock className="text-blue-600 text-xs" />;
      case 'confirmed': return <FaCheckCircle className="text-blue-500 text-xs" />;
      default: return <FaClock className="text-gray-500 text-xs" />;
    }
  };

  const getOrderStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'pending_payment': return 'Pago Pendiente';
      case 'payment_uploaded': return 'Verificando Pago';
      case 'payment_confirmed': return 'Pago Confirmado';
      case 'preparing': return 'Preparando';
      case 'ready': return 'Listo';
      case 'completed': return 'Completado';
      case 'cancelled': case 'expired': return 'Cancelado';
      case 'delivered': return 'Entregado';
      case 'inProgress': return 'En Progreso';
      case 'confirmed': return 'Confirmado';
      default: return status || 'Desconocido';
    }
  };

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'pending_payment': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'payment_uploaded': return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'payment_confirmed': return 'text-green-700 bg-green-50 border-green-200';
      case 'preparing': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'ready': return 'text-green-700 bg-green-50 border-green-200';
      case 'completed': return 'text-green-800 bg-green-100 border-green-200';
      case 'cancelled': case 'expired': return 'text-red-700 bg-red-50 border-red-200';
      case 'delivered': return 'text-green-800 bg-green-100 border-green-200';
      case 'inProgress': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'confirmed': return 'text-blue-700 bg-blue-50 border-blue-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getOrderTypeInfo = (type) => {
    switch (type) {
      case 'inSite': return { text: 'En sitio', icon: <FaStore className="text-xs" /> };
      case 'takeaway': return { text: 'Para llevar', icon: <FaShoppingBag className="text-xs" /> };
      case 'delivery': return { text: 'Domicilio', icon: <FaTruck className="text-xs" /> };
      default: return { text: type || 'Desconocido', icon: <FaBox className="text-xs" /> };
    }
  };

  if (!isOpen) return null;

  // Obtener colores del tema del negocio
  const primaryColor = businessConfig?.theme?.buttonColor || '#f97316';
  const primaryTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-50 ${fullScreen ? '' : 'bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center'}`}
        onClick={fullScreen ? undefined : onClose}
      >
        <motion.div
          initial={fullScreen ? { x: '100%' } : { y: 40, opacity: 0 }}
          animate={fullScreen ? { x: 0 } : { y: 0, opacity: 1 }}
          exit={fullScreen ? { x: '100%' } : { y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className={fullScreen
            ? 'w-full h-full flex flex-col overflow-hidden'
            : 'bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-hidden sm:mx-4'}
          style={fullScreen ? { background: 'var(--mb-surface)' } : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — en pantalla completa se comporta como barra de app:
              volver a la izquierda y la identidad del cliente en grande. */}
          {fullScreen ? (
            <div
              className="shrink-0 px-4 pb-4 border-b"
              style={{ background: 'var(--mb-card)', borderColor: 'var(--mb-line)', paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: 'var(--mb-surface-2)', color: 'var(--mb-ink)' }}
                  aria-label="Volver"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <h2 className="text-[17px] font-extrabold tracking-tight" style={{ color: 'var(--mb-ink)' }}>Mi cuenta</h2>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-black"
                  style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
                >
                  {(profileData.name || 'C').trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[17px] font-extrabold truncate" style={{ color: 'var(--mb-ink)' }}>{profileData.name || 'Cliente'}</p>
                  <p className="text-[13px]" style={{ color: 'var(--mb-ink-2)' }}>{profileData.phone}</p>
                </div>
              </div>
            </div>
          ) : (
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Mi Cuenta</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>

            {/* User info pill */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <FaUser className="text-sm" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{profileData.name || 'Cliente'}</p>
                <p className="text-xs text-gray-500">{profileData.phone}</p>
              </div>
            </div>
          </div>
          )}

          {/* Tab bar — underline style */}
          <div className="flex border-b shrink-0" style={fullScreen ? { background: 'var(--mb-card)', borderColor: 'var(--mb-line)' } : { borderColor: '#f3f4f6' }}>
            {[
              { id: 'profile', label: 'Perfil', icon: FaUser },
              { id: 'orders', label: 'Pedidos', icon: FaBox }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors relative ${
                  activeTab === id ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="text-xs" />
                {label}
                {activeTab === id && (
                  <motion.div
                    layoutId="accountTab"
                    className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div
            className={fullScreen ? 'p-5 flex-1 overflow-y-auto overscroll-contain' : 'p-5 overflow-y-auto'}
            style={fullScreen ? undefined : { maxHeight: 'calc(92vh - 180px)' }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div
                  className="w-7 h-7 border-2 border-gray-200 rounded-full animate-spin"
                  style={{ borderTopColor: primaryColor }}
                />
                <span className="mt-3 text-sm text-gray-500">Cargando...</span>
              </div>
            ) : (
              <AnimatePresence mode="wait">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <motion.div 
                  key="profile"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Section header + Edit button */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-800">Información Personal</h3>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                      style={isEditing 
                        ? { color: '#6b7280', backgroundColor: '#f3f4f6' }
                        : { color: primaryColor, backgroundColor: `${primaryColor}10` }
                      }
                    >
                      <FaEdit className="text-[10px]" />
                      {isEditing ? 'Cancelar' : 'Editar'}
                    </button>
                  </div>

                  {/* Fields */}
                  <div className="space-y-4">
                    {/* Nombre */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Nombre</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profileData.name}
                          onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 text-sm text-gray-800 font-medium bg-white"
                          style={{ '--tw-ring-color': `${primaryColor}40` }}
                          autoFocus
                        />
                      ) : (
                        <p className="px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-800 font-medium">{profileData.name || '—'}</p>
                      )}
                    </div>

                    {/* Teléfono */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Teléfono</label>
                      <div className="flex items-center gap-2">
                        <p className="flex-1 px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-500 font-medium">{profileData.phone}</p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 inline-flex items-center gap-1"><FaLock className="text-[9px]" /> No editable</span>
                      </div>
                    </div>

                    {/* Dirección */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                        Dirección de Entrega
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={profileData.address}
                          onChange={(e) => setProfileData({...profileData, address: e.target.value})}
                          placeholder="Dirección completa para entregas"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 text-sm text-gray-800 font-medium bg-white placeholder-gray-400"
                          style={{ '--tw-ring-color': `${primaryColor}40` }}
                        />
                      ) : (
                        <p className={`px-3 py-2.5 bg-gray-50 rounded-lg text-sm font-medium ${profileData.address ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                          {profileData.address || 'Sin dirección registrada'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Save actions */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-2 pt-2 overflow-hidden"
                      >
                        <button
                          onClick={() => setIsEditing(false)}
                          className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          disabled={isSaving}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveProfile}
                          disabled={isSaving}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#22c55e' }}
                        >
                          <FaSave className="text-xs" />
                          {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <motion.div 
                  key="orders"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-base font-bold text-gray-800 mb-4">Mis Pedidos</h3>
                  
                  {customerOrders.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <FaBox className="text-xl text-gray-300" />
                      </div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">No tienes pedidos aún</p>
                      <p className="text-xs text-gray-400 mb-4">¡Haz tu primer pedido!</p>
                      <button 
                        onClick={onClose}
                        className="px-5 py-2 text-sm text-white rounded-lg font-semibold"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Ver Menú
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {customerOrders.map((order, index) => {
                        const orderNum = order.orderNumber || index + 1;
                        const shortId = order._id?.slice(-6) || '';
                        const typeInfo = getOrderTypeInfo(order.orderType);
                        const isCancelled = isCancelledOrExpired(order.status);
                        
                        // Calculate total (include delivery fee)
                        const calculatedTotal = order.items?.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0) || 0;
                        const baseTotal = order.finalAmount || order.total || order.totalAmount || calculatedTotal;
                        const displayTotal = baseTotal + (order.deliveryFee || 0);

                        return (
                          <motion.div 
                            key={order._id || index} 
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`rounded-xl p-4 border ${isCancelled ? 'bg-red-50/50 border-red-100 opacity-70' : 'bg-gray-50 border-gray-100'}`}
                          >
                            {/* Order header row */}
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-800">Pedido #{orderNum}</span>
                                  {shortId && <span className="text-[10px] text-gray-400 font-mono">({shortId})</span>}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {new Date(order.createdAt || order.date || Date.now()).toLocaleDateString('es-ES', {
                                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                </p>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-full border ${getOrderStatusColor(order.status)}`}>
                                {getOrderStatusIcon(order.status)}
                                {getOrderStatusText(order.status)}
                              </span>
                            </div>

                            {/* Type + Total row */}
                            <div className="flex items-center justify-between mb-3">
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                {typeInfo.icon} {typeInfo.text}
                              </span>
                              <span className={`text-sm font-bold ${isCancelled ? 'line-through text-gray-400' : ''}`} style={isCancelled ? {} : { color: primaryColor }}>
                                ${displayTotal.toLocaleString()}
                              </span>
                            </div>

                            {/* Order-type specific info */}
                            {order.orderType === 'inSite' && order.tableNumber && (
                              <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5 mb-3">
                                {businessConfig?.businessType === 'hotel' ? 'Hab.' : 'Mesa'} #{order.tableNumber}
                              </div>
                            )}
                            {order.orderType === 'delivery' && order.address && (
                              <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5 mb-3 flex items-start gap-1">
                                <FaMapMarkerAlt className="text-[10px] mt-0.5 flex-shrink-0" />
                                {order.address}
                              </div>
                            )}
                            {order.orderType === 'takeaway' && (
                              <div className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-1.5 mb-3">
                                Recogida en mostrador
                              </div>
                            )}

                            {/* Cancelled reason banner */}
                            {isCancelled && (
                              <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3 flex items-center gap-2 border border-red-100">
                                <FaTimesCircle className="text-red-400 flex-shrink-0" />
                                <span>{order.autoExpired ? 'Pedido expirado automáticamente por falta de pago' : order.cancellationReason || 'Este pedido fue cancelado'}</span>
                              </div>
                            )}

                            {/* Coupon */}
                            {order.couponCode && (
                              <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5 mb-3 flex items-center gap-1">
                                <FaTicketAlt className="text-[10px]" />
                                <span className="font-semibold">{order.couponCode}</span>
                                <span>(-${order.discountAmount?.toLocaleString() || '0'})</span>
                              </div>
                            )}
                          
                            {/* Items list */}
                            <div className="border-t border-gray-200 pt-2.5 space-y-1.5">
                              {order.items?.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="text-gray-700">
                                    <span className="font-semibold text-gray-800">{item.quantity}×</span> {item.name}
                                  </span>
                                  <span className="text-gray-500 font-medium">${item.price?.toLocaleString() || '0'}</span>
                                </div>
                              )) || <p className="text-xs text-gray-400">Sin productos</p>}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AccountManagementModal;
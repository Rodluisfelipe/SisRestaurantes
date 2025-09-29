import React, { useState, useEffect } from 'react';
import { X, User, Package, Phone, MapPin, Star, Clock, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { logSystem } from '../utils/systemLogger';
import { useBusinessConfig } from '../Context/BusinessContext';

const AccountManagementModal = ({ isOpen, onClose, customerData, orders = [], initialTab = 'profile' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [profileData, setProfileData] = useState({
    name: customerData?.name || '',
    phone: customerData?.phone || '',
    address: customerData?.address || ''
  });

  // Log para depurar los pedidos recibidos
  console.log('AccountManagementModal - orders recibidos:', orders);
  console.log('AccountManagementModal - orders.length:', orders?.length);

  // Timer para actualizar el tiempo restante cada minuto
  useEffect(() => {
    if (!isOpen || !orders.some(order => order.status === 'completed')) return;

    const interval = setInterval(() => {
      // Forzar re-render para actualizar el tiempo restante
      setProfileData(prev => ({ ...prev }));
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(interval);
  }, [isOpen, orders]);

  // Log para depurar y actualizar profileData cuando cambien customerData
  useEffect(() => {
    logSystem('AccountManagementModal - customerData recibido:', customerData);
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

  // Cargar datos del cliente desde la base de datos
  useEffect(() => {
    const loadCustomerData = async () => {
      if (!customerData?.phone || !businessConfig?.businessId) return;
      
      setIsLoading(true);
      try {
        // Cargar datos del cliente desde la BD
        const response = await api.get(`/customers/${customerData.phone}?businessId=${businessConfig.businessId}`);
        const dbCustomerData = response.data;
        
        setProfileData({
          name: dbCustomerData.name || customerData.name || '',
          phone: dbCustomerData.phone || customerData.phone || '',
          address: dbCustomerData.address || customerData.address || ''
        });
        
        // Cargar pedidos del cliente
        const ordersResponse = await api.get(`/customers/${customerData.phone}/orders?businessId=${businessConfig.businessId}&limit=20`);
        const allOrders = ordersResponse.data.orders || [];
        
        // Filtrar pedidos: mostrar todos los pendientes/en progreso + completados de los últimos 30 minutos
        const filteredOrders = allOrders.filter(order => {
          if (order.status === 'pending' || order.status === 'inProgress') {
            return true; // Mostrar todos los pedidos activos
          }
          
          if (order.status === 'completed') {
            const completedTime = new Date(order.updatedAt || order.createdAt);
            const now = new Date();
            const timeDiff = now - completedTime;
            const thirtyMinutes = 30 * 60 * 1000; // 30 minutos en milisegundos
            
            return timeDiff < thirtyMinutes; // Mostrar solo si fue completado hace menos de 30 minutos
          }
          
          return false;
        });
        
        setCustomerOrders(filteredOrders);
        
      } catch (error) {
        // Si no existe en BD, usar datos locales
        setProfileData({
          name: customerData.name || '',
          phone: customerData.phone || '',
          address: customerData.address || ''
        });
        logSystem('Cliente no encontrado en BD, usando datos locales', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadCustomerData();
    }
  }, [customerData, businessConfig?.businessId, isOpen]);

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
      if (businessConfig?.businessId && profileData.phone) {
        try {
          await api.put(`/customers/${profileData.phone}?businessId=${businessConfig.businessId}`, {
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

  const getOrderStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'preparing': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'ready': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getOrderStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'preparing': return 'Preparando';
      case 'ready': return 'Listo';
      case 'completed': return 'Completado';
      case 'cancelled': return 'Cancelado';
      default: return 'Desconocido';
    }
  };

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'preparing': return 'text-blue-700 bg-blue-100 border-blue-200';
      case 'ready': return 'text-green-700 bg-green-100 border-green-200';
      case 'completed': return 'text-green-800 bg-green-200 border-green-300';
      case 'cancelled': return 'text-red-700 bg-red-100 border-red-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const repeatOrder = (order) => {
    logSystem('Repitiendo pedido', order);
    // TODO: Implementar repetir pedido
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
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header moderno con gradiente personalizado */}
          <div 
            className="text-white p-6 relative overflow-hidden"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` 
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
            <div className="relative flex justify-between items-center">
              <div>
                <motion.h2 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="text-2xl font-bold flex items-center gap-3"
                >
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    <User className="w-7 h-7" />
                  </motion.div>
                  Mi Cuenta
                </motion.h2>
                <motion.p 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-white/90 mt-1 font-medium"
                >
                  {profileData.name || 'Cliente'} • {profileData.phone}
                </motion.p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="text-white hover:text-white/80 transition-colors p-2 rounded-full hover:bg-white/20"
              >
                <X className="w-6 h-6" />
              </motion.button>
            </div>
          </div>

        {/* Tabs modernos */}
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="flex">
            {[
              { id: 'profile', label: 'Perfil', icon: User },
              { id: 'orders', label: 'Pedidos', icon: Package }
            ].map(({ id, label, icon: Icon }, index) => (
              <motion.button
                key={id}
                onClick={() => setActiveTab(id)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 font-semibold transition-all duration-300 relative ${
                  activeTab === id
                    ? 'text-white bg-gradient-to-r shadow-lg'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/80'
                }`}
                style={{
                  background: activeTab === id ? `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` : undefined,
                  boxShadow: activeTab === id ? `0 4px 15px ${primaryColor}25` : undefined
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
                {activeTab === id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Content con loading state */}
        <div className="p-6 max-h-96 overflow-y-auto bg-gradient-to-br from-gray-50 to-white">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-3 border-gray-300 rounded-full"
                style={{ borderTopColor: primaryColor }}
              />
              <span className="ml-3 text-gray-600 font-medium">Cargando datos...</span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <motion.div 
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <User className="w-5 h-5" style={{ color: primaryColor }} />
                      Información Personal
                    </h3>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsEditing(!isEditing)}
                      disabled={isSaving}
                      className="px-6 py-2 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
                      style={{ 
                        background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
                        color: primaryTextColor
                      }}
                    >
                      {isEditing ? 'Cancelar' : 'Editar'}
                    </motion.button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Nombre */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" style={{ color: primaryColor }} />
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={profileData.name}
                        onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                        disabled={!isEditing}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 transition-all duration-300 text-gray-700 font-medium disabled:bg-gray-50 disabled:text-gray-500 shadow-sm"
                        style={{
                          '--tw-ring-color': `${primaryColor}20`,
                          borderColor: isEditing ? primaryColor : undefined
                        }}
                      />
                    </motion.div>

                    {/* Teléfono */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <Phone className="w-4 h-4" style={{ color: primaryColor }} />
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={profileData.phone}
                        disabled
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-medium shadow-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">El teléfono no se puede modificar</p>
                    </motion.div>



                    {/* Dirección */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="md:col-span-2"
                    >
                      <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
                        Dirección de Entrega
                      </label>
                      <input
                        type="text"
                        value={profileData.address}
                        onChange={(e) => setProfileData({...profileData, address: e.target.value})}
                        disabled={!isEditing}
                        placeholder="Dirección completa para entregas"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 transition-all duration-300 text-gray-700 font-medium disabled:bg-gray-50 disabled:text-gray-500 shadow-sm"
                        style={{
                          '--tw-ring-color': `${primaryColor}20`,
                          borderColor: isEditing ? primaryColor : undefined
                        }}
                      />
                    </motion.div>
                  </div>

                  {isEditing && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end gap-3 pt-6 border-t border-gray-200"
                    >
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsEditing(false)}
                        className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                        disabled={isSaving}
                      >
                        Cancelar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="px-6 py-3 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
                        style={{ 
                          background: `linear-gradient(135deg, #22c55e 0%, #16a34a 100%)`
                        }}
                      >
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                      </motion.button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <motion.div 
                  key="orders"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Package className="w-5 h-5" style={{ color: primaryColor }} />
                    Mis Pedidos
                  </h3>
                  
                  {orders.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100"
                    >
                      <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-bold text-gray-600 mb-2">No tienes pedidos aún</p>
                      <p className="text-gray-500 mb-6">¡Haz tu primer pedido!</p>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onClose}
                        className="px-8 py-3 text-white rounded-xl font-semibold shadow-lg"
                        style={{ 
                          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100())`
                        }}
                      >
                        Ver Menú
                      </motion.button>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order, index) => (
                        <motion.div 
                          key={order._id || index} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-bold text-gray-800 text-lg">
                                Pedido #{order._id?.slice(-6) || index + 1}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {new Date(order.createdAt || order.date || Date.now()).toLocaleDateString('es-ES', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`px-4 py-2 rounded-xl text-sm font-bold border ${getOrderStatusColor(order.status)} mb-2`}>
                                <div className="flex items-center gap-2">
                                  {getOrderStatusIcon(order.status)}
                                  {getOrderStatusText(order.status)}
                                </div>
                              </div>
                              {order.status === 'completed' && (
                                <div className="text-xs text-gray-500">
                                  {(() => {
                                    const completedTime = new Date(order.updatedAt || order.createdAt);
                                    const now = new Date();
                                    const timeDiff = now - completedTime;
                                    const thirtyMinutes = 30 * 60 * 1000;
                                    const remainingTime = thirtyMinutes - timeDiff;
                                    
                                    if (remainingTime > 0) {
                                      const remainingMinutes = Math.ceil(remainingTime / (60 * 1000));
                                      return `Visible por ${remainingMinutes} min más`;
                                    }
                                    return 'Desaparecerá pronto';
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-700">Total:</span>
                              <span className="font-bold" style={{ color: primaryColor }}>
                                ${order.total?.toLocaleString() || order.finalAmount?.toLocaleString() || '0'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-700">Método:</span>
                              <span>{order.paymentMethod || 'Efectivo'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-700">Tipo:</span>
                              <span>{order.orderType === 'dine-in' ? 'En sitio' : order.orderType === 'takeaway' ? 'Para llevar' : 'Domicilio'}</span>
                            </div>
                          </div>
                          
                          {order.couponCode && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                              <p className="text-sm text-green-700">
                                <strong>Cupón aplicado:</strong> {order.couponCode} 
                                <span className="font-bold"> (-${order.discountAmount?.toLocaleString() || '0'})</span>
                              </p>
                            </div>
                          )}
                          
                          <div className="bg-gray-50 rounded-xl p-4 mb-4">
                            <p className="font-semibold text-gray-700 mb-2">Productos:</p>
                            <div className="space-y-2">
                              {order.items?.map((item, itemIndex) => (
                                <div key={itemIndex} className="flex justify-between items-center">
                                  <span className="text-gray-700">{item.quantity}x {item.name}</span>
                                  <span className="font-semibold">${item.price?.toLocaleString() || '0'}</span>
                                </div>
                              )) || <p className="text-gray-500">No hay productos disponibles</p>}
                            </div>
                          </div>
                          
                          {order.status === 'completed' && (
                            <div className="flex gap-3 pt-4 border-t border-gray-200">
                              <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => repeatOrder(order)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors font-semibold text-sm"
                              >
                                <span>🔄</span>
                                Repetir Pedido
                              </motion.button>
                              <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-xl hover:bg-yellow-100 transition-colors font-semibold text-sm"
                              >
                                <Star className="w-4 h-4" />
                                Calificar
                              </motion.button>
                            </div>
                          )}
                        </motion.div>
                      ))}
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
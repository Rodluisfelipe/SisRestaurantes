import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateDailyReportPDF } from './DailyReportPDF';
import { ORDER_STATUS } from '../utils/constants';
import {
  FaClipboardList, FaSync, FaCircle, FaSearch, FaTh, FaList,
  FaUtensils, FaTv, FaShoppingBag, FaEye, FaPlay, FaCheck,
  FaUser, FaPhone, FaMapMarkerAlt, FaTruck, FaClock, FaTimes,
  FaChair, FaHome, FaTag, FaExclamationTriangle, FaWifi,
  FaMoneyBillWave, FaImage, FaTimesCircle, FaCheckCircle, FaPrint, FaMotorcycle
} from 'react-icons/fa';

import { socket, socketDiagnostic, forceReconnect } from '../services/socket';
import AssignDeliveryModal from './Delivery/AssignDeliveryModal';
import OrderCard from './OrderCard';
import useOrdersDashboard from '../hooks/useOrdersDashboard';

function ModernOrdersDashboard() {
  const {
    orders, loading, error,
    selectedOrder, setSelectedOrder,
    orderDetails, setOrderDetails,
    pendingNotifications,
    generatingReport, setGeneratingReport,
    reportData, setReportData,
    showReportModal, setShowReportModal,
    notificationAudioRef,
    businessConfig, businessId, isService, navigate,
    handlePrintOrder, calculateTimeElapsed, getOrderTypeInfo, getStatusInfo,
    fetchOrders, updateOrderStatus, sendToKitchen,
    confirmPayment, rejectPayment,
    getProofUrl, goToKitchenScreen, showOrderDetails,
  } = useOrdersDashboard();

  const [assignDomiOrder, setAssignDomiOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofImageUrl, setProofImageUrl] = useState('');

  const VISIBLE_STATUSES = ['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed', 'confirmed', 'preparing', 'inProgress', 'ready', 'completed'];

  // Filter orders based on search and status
  const filteredOrders = orders.filter(order => {
    if (!order) return false;
    if (!VISIBLE_STATUSES.includes(order.status)) return false;
    const name = (order.customerName || '').toLowerCase();
    const number = (order.orderNumber || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = name.includes(search) || number.includes(search);
    
    let matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    // Group related statuses under the same filter tab
    if (statusFilter === ORDER_STATUS.PAYMENT_UPLOADED) {
      matchesStatus = order.status === ORDER_STATUS.PAYMENT_UPLOADED || order.status === ORDER_STATUS.PAYMENT_CONFIRMED;
    } else if (statusFilter === ORDER_STATUS.IN_PROGRESS) {
      matchesStatus = order.status === ORDER_STATUS.IN_PROGRESS || order.status === ORDER_STATUS.PREPARING || order.status === ORDER_STATUS.CONFIRMED;
    } else if (statusFilter === ORDER_STATUS.COMPLETED) {
      matchesStatus = order.status === ORDER_STATUS.COMPLETED || order.status === ORDER_STATUS.READY;
    }
    
    return matchesSearch && matchesStatus;
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 20,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.4, 0.0, 0.2, 1]
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"
          />
          <p className="text-slate-500 text-sm font-medium">{isService ? 'Cargando citas...' : 'Cargando pedidos...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-white p-6 rounded-xl border border-red-100 text-center max-w-sm">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <FaTimes className="text-red-400 text-lg" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">{isService ? 'Error al cargar citas' : 'Error al cargar pedidos'}</h3>
          <p className="text-slate-500 text-xs mb-4">{error}</p>
          <button
            onClick={fetchOrders}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  const statusFilters = [
    { value: 'all', label: 'Todos', icon: FaClipboardList },
    { value: ORDER_STATUS.PENDING, label: 'Pendientes', icon: FaClock },
    { value: ORDER_STATUS.PAYMENT_UPLOADED, label: 'Por cobrar', icon: FaImage },
    { value: ORDER_STATUS.IN_PROGRESS, label: 'En curso', icon: FaUtensils },
    { value: ORDER_STATUS.COMPLETED, label: 'Listos', icon: FaCheck },
  ];

  const orderCounts = {
    all: filteredOrders.length,
    [ORDER_STATUS.PENDING]: orders.filter(o => o?.status === ORDER_STATUS.PENDING).length,
    [ORDER_STATUS.PAYMENT_UPLOADED]: orders.filter(o => o?.status === ORDER_STATUS.PAYMENT_UPLOADED || o?.status === ORDER_STATUS.PAYMENT_CONFIRMED).length,
    [ORDER_STATUS.IN_PROGRESS]: orders.filter(o => o?.status === ORDER_STATUS.IN_PROGRESS || o?.status === ORDER_STATUS.PREPARING).length,
    [ORDER_STATUS.COMPLETED]: orders.filter(o => o?.status === ORDER_STATUS.COMPLETED || o?.status === ORDER_STATUS.READY).length,
  };

  return (
    <div className="space-y-4">
      {/* Audio element for notifications */}
      <audio 
        ref={notificationAudioRef} 
        preload="auto"
        onError={(e) => {
          console.error('Audio loading error:', e);
        }}
        onCanPlay={() => {
          console.log('Audio ready to play');
        }}
      >
        <source src="/audio/new-order-notification.mp3" type="audio/mpeg" />
      </audio>

      {/* Top Bar — Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Pending badge */}
          {pendingNotifications.length > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-full"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-red-500"
              />
              <span className="text-xs font-bold">{pendingNotifications.length} pendiente{pendingNotifications.length > 1 ? 's' : ''}</span>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Kitchen — hide for service businesses */}
          {!isService && (
            <button
              onClick={goToKitchenScreen}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              <FaUtensils className="text-[10px]" />
              <span className="hidden sm:inline">Cocina</span>
            </button>
          )}

          {/* Customer Display — hide for service businesses */}
          {!isService && (
            <button
              onClick={() => {
                const currentPath = window.location.pathname;
                const match = currentPath.match(/^\/([^/]+)/);
                const businessSlug = match ? match[1] : '';
                window.open(`/${businessSlug}/orders`, '_blank', 'noopener,noreferrer');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <FaTv className="text-[10px]" />
              <span className="hidden sm:inline">Pantalla</span>
            </button>
          )}

          {/* Refresh */}
          <motion.button
            whileTap={{ rotate: 180 }}
            onClick={fetchOrders}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Actualizar pedidos"
          >
            <FaSync className="text-sm" />
          </motion.button>

          {/* Socket status */}
          <button
            onClick={() => {
              socketDiagnostic();
              if (socket && !socket.connected) {
                forceReconnect();
              }
            }}
            className={`p-2 rounded-lg transition-colors ${
              socket && socket.connected
                ? 'text-emerald-500 hover:bg-emerald-50'
                : 'text-red-400 hover:bg-red-50'
            }`}
            title={socket && socket.connected ? 'Conectado en tiempo real' : 'Desconectado — Click para reconectar'}
          >
            <FaWifi className="text-sm" />
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
          <input
            type="text"
            placeholder={isService ? "Buscar por cliente o # de cita..." : "Buscar por cliente o # de pedido..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={isService ? "Buscar por cliente o número de cita" : "Buscar por cliente o número de pedido"}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>

        {/* Status filter pills + View toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {statusFilters.map(f => {
              const isActive = statusFilter === f.value;
              const FilterIcon = f.icon;
              const count = orderCounts[f.value] || 0;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                  }`}
                >
                  <FilterIcon className="text-[10px]" />
                  <span>{f.label}</span>
                  {count > 0 && (
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <FaTh className="text-xs" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <FaList className="text-xs" />
            </button>
          </div>
        </div>
      </div>

      {/* Orders grid/list */}
      <div>
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <FaShoppingBag className="text-slate-300 text-xl" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">{isService ? 'No hay citas' : 'No hay pedidos'}</h3>
            <p className="text-xs text-slate-400">
              {searchTerm || statusFilter !== 'all' 
                ? (isService ? 'No se encontraron citas con los filtros aplicados' : 'No se encontraron pedidos con los filtros aplicados')
                : (isService ? 'Las nuevas citas aparecerán aquí en tiempo real' : 'Los nuevos pedidos aparecerán aquí en tiempo real')
              }
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3'
                : 'space-y-2'
            }
          >
            <AnimatePresence>
              {filteredOrders.map((order) => {
                const orderTypeInfo = getOrderTypeInfo(order.orderType);
                const statusInfo = getStatusInfo(order.status);
                const timeElapsed = calculateTimeElapsed(order.createdAt);
                const isPending = order.status === ORDER_STATUS.PENDING;
                return (
                  <OrderCard
                    key={order._id}
                    order={order}
                    viewMode={viewMode}
                    cardVariants={cardVariants}
                    isService={isService}
                    businessType={businessConfig?.businessType}
                    orderTypeInfo={orderTypeInfo}
                    statusInfo={statusInfo}
                    timeElapsed={timeElapsed}
                    isPending={isPending}
                    onShowDetails={showOrderDetails}
                    onPrint={handlePrintOrder}
                    onShowProof={(proofPath) => { setProofImageUrl(getProofUrl(proofPath)); setShowProofModal(true); }}
                    onUpdateStatus={updateOrderStatus}
                    onConfirmPayment={confirmPayment}
                    onRejectPayment={rejectPayment}
                    onAssignDelivery={setAssignDomiOrder}
                  />
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && orderDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setSelectedOrder(null);
              setOrderDetails(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => { const ModalTypeIcon = getOrderTypeInfo(orderDetails.orderType).Icon; return (
                      <div className={`w-9 h-9 ${getOrderTypeInfo(orderDetails.orderType).color} rounded-lg flex items-center justify-center`}>
                        <ModalTypeIcon className="text-white text-sm" />
                      </div>
                    ); })()}
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Pedido #{orderDetails.orderNumber}</h2>
                      <p className="text-xs text-slate-500">{getOrderTypeInfo(orderDetails.orderType).label} · {orderDetails._id?.slice(-6)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                        onClick={() => handlePrintOrder(orderDetails)}
                        className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
                        title="Imprimir comanda"
                      >
                        <FaPrint className="text-slate-500 text-xs" />
                      </button>
                    <button
                      onClick={() => {
                        setSelectedOrder(null);
                        setOrderDetails(null);
                      }}
                      className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <FaTimes className="text-slate-400 text-xs" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-5">
                {/* Order Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <FaUser className="text-xs text-slate-400" />
                      <span className="text-[13px] text-slate-500">Cliente:</span>
                      <span className="text-[13px] font-medium text-slate-800">{orderDetails.customerName}</span>
                    </div>
                    
                    {orderDetails.phone && (
                      <div className="flex items-center gap-2">
                        <FaPhone className="text-xs text-slate-400" />
                        <span className="text-[13px] text-slate-500">Teléfono:</span>
                        <span className="text-[13px] font-medium text-slate-800">{orderDetails.phone}</span>
                      </div>
                    )}

                    {orderDetails.tableNumber && (
                      <div className="flex items-center gap-2">
                        <FaChair className="text-xs text-slate-400" />
                        <span className="text-[13px] text-slate-500">{businessConfig?.businessType === 'hotel' ? 'Hab.:' : 'Mesa:'}</span>
                        <span className="text-[13px] font-medium text-slate-800">{orderDetails.tableNumber}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.address && (
                      <div className="flex items-start gap-2">
                        <FaHome className="text-xs text-slate-400 mt-0.5" />
                        <span className="text-[13px] text-slate-500">Dirección:</span>
                        <span className="text-[13px] font-medium text-slate-800 leading-snug">{orderDetails.address}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryZoneName && (
                      <div className="flex items-center gap-2">
                        <FaMapMarkerAlt className="text-xs text-slate-400" />
                        <span className="text-[13px] text-slate-500">Zona:</span>
                        <span className="text-[13px] font-medium text-slate-800">{orderDetails.deliveryZoneName}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryFee && (
                      <div className="flex items-center gap-2">
                        <FaTruck className="text-xs text-slate-400" />
                        <span className="text-[13px] text-slate-500">Costo de envío:</span>
                        <span className="text-[13px] font-medium text-slate-800">${orderDetails.deliveryFee.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {orderDetails.orderType === 'delivery' && orderDetails.deliveryNeedsConfirmation && (
                      <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                        <FaExclamationTriangle className="text-xs text-amber-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-[13px] font-semibold text-amber-800">Envío por confirmar</p>
                          <p className="text-[11px] text-amber-600">Fuera de zonas automáticas</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <FaClock className="text-xs text-slate-400" />
                      <span className="text-[13px] text-slate-500">Tiempo:</span>
                      <span className="text-[13px] font-medium text-slate-800">{calculateTimeElapsed(orderDetails.createdAt)}</span>
                    </div>
                    
                    {(() => { const ModalStatusIcon = getStatusInfo(orderDetails.status).Icon; return (
                      <div className="flex items-center gap-2">
                        <ModalStatusIcon className="text-xs text-slate-400" />
                        <span className="text-[13px] text-slate-500">Estado:</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusInfo(orderDetails.status).textColor} ${getStatusInfo(orderDetails.status).bgColor}`}>
                          {getStatusInfo(orderDetails.status).label}
                        </span>
                      </div>
                    ); })()}
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">Productos</h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {orderDetails.items?.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-start px-3 py-2.5 bg-white"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-slate-800">{item.name}</span>
                            <span className="text-[11px] text-slate-400">x{item.quantity}</span>
                            {item.isLoyaltyReward && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">🎁 Loyalty</span>
                            )}
                          </div>
                          
                          {item.selectedToppings && item.selectedToppings.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.selectedToppings.flatMap((topping, toppingIndex) => {
                                const tags = [];
                                if (topping.optionName) {
                                  tags.push(
                                    <span key={`t-${toppingIndex}`} className="text-[11px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                      + {topping.groupName && <>{topping.groupName}: </>}{topping.optionName}{topping.price > 0 && ` ($${topping.price.toLocaleString()})`}
                                    </span>
                                  );
                                }
                                if (topping.subGroups) {
                                  topping.subGroups.forEach((sg, si) => {
                                    tags.push(
                                      <span key={`s-${toppingIndex}-${si}`} className="text-[11px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                        + {sg.subGroupTitle && <>{sg.subGroupTitle}: </>}{sg.optionName}{sg.price > 0 && ` ($${sg.price.toLocaleString()})`}
                                      </span>
                                    );
                                  });
                                }
                                return tags;
                              })}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-[13px] font-semibold text-slate-800">${(item.price * item.quantity).toLocaleString()}</p>
                          {item.quantity > 1 && <p className="text-[11px] text-slate-400">${item.price.toLocaleString()} c/u</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="bg-slate-50 rounded-lg px-3 py-3 space-y-1.5">
                  {orderDetails.couponCode ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-slate-500">Subtotal</span>
                        <span className="text-[13px] text-slate-700">${(orderDetails.totalAmount || 0).toLocaleString()}</span>
                      </div>
                      {orderDetails.deliveryFee && (
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] text-slate-500">Envío</span>
                          <span className="text-[13px] text-slate-700">${orderDetails.deliveryFee.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-emerald-600">Cupón ({orderDetails.couponCode})</span>
                        <span className="text-[13px] text-emerald-600">-${(orderDetails.discountAmount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                        <span className="text-sm font-bold text-slate-800">Total</span>
                        <span className="text-base font-bold text-emerald-600">${((orderDetails.totalAmount || 0) + (orderDetails.deliveryFee || 0) - (orderDetails.discountAmount || 0)).toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {orderDetails.deliveryFee ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-slate-500">Subtotal</span>
                            <span className="text-[13px] text-slate-700">${(orderDetails.totalAmount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-slate-500">Envío</span>
                            <span className="text-[13px] text-slate-700">${orderDetails.deliveryFee.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                            <span className="text-sm font-bold text-slate-800">Total</span>
                            <span className="text-base font-bold text-slate-800">${((orderDetails.totalAmount || 0) + (orderDetails.deliveryFee || 0)).toLocaleString()}</span>
                          </div>
                        </>
                      ) : orderDetails.deliveryNeedsConfirmation ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-slate-500">Subtotal</span>
                            <span className="text-[13px] text-slate-700">${(orderDetails.totalAmount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-amber-600 font-medium">Envío</span>
                            <span className="text-[13px] text-amber-600 font-medium">Por confirmar</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                            <span className="text-sm font-bold text-slate-800">Total estimado</span>
                            <span className="text-base font-bold text-slate-800">${(orderDetails.totalAmount || 0).toLocaleString()} + envío</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-800">Total</span>
                          <span className="text-base font-bold text-slate-800">${(orderDetails.totalAmount || 0).toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Payment Proof Section */}
                {orderDetails.paymentProof && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Comprobante de pago</h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <img 
                        src={getProofUrl(orderDetails.paymentProof)} 
                        alt="Comprobante de pago"
                        className="w-full max-h-64 object-contain bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setProofImageUrl(getProofUrl(orderDetails.paymentProof));
                          setShowProofModal(true);
                        }}
                      />
                      {orderDetails.paymentMethod && (
                        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
                          <span className="text-[11px] text-slate-500">Método: </span>
                          <span className="text-[11px] font-semibold text-slate-700 capitalize">{orderDetails.paymentMethod === 'roomCharge' ? 'Cargo a habitación' : orderDetails.paymentMethod}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Customer Notes */}
                {orderDetails.customerNotes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-[11px] font-semibold text-amber-700 mb-0.5">Nota del cliente:</p>
                    <p className="text-[13px] text-amber-800">{orderDetails.customerNotes}</p>
                  </div>
                )}

                {/* Order Channel Badge */}
                {orderDetails.orderChannel === 'inapp' && (
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                    <FaMoneyBillWave className="text-indigo-500 text-xs" />
                    <span className="text-[12px] font-medium text-indigo-700">Pedido in-app (pago por transferencia)</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {/* Payment confirm/reject for uploaded proofs */}
                      {orderDetails.status === ORDER_STATUS.PAYMENT_UPLOADED && (
                        <>
                          <button
                            onClick={() => confirmPayment(orderDetails._id)}
                            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                          >
                            <FaCheckCircle className="text-xs" />
                            <span>Confirmar pago</span>
                          </button>
                          <button
                            onClick={() => rejectPayment(orderDetails._id)}
                            className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                          >
                            <FaTimesCircle className="text-xs" />
                            <span>Rechazar</span>
                          </button>
                        </>
                      )}

                      {/* Start preparation after payment confirmed */}
                      {orderDetails.status === ORDER_STATUS.PAYMENT_CONFIRMED && (
                        <button
                          onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.IN_PROGRESS)}
                          className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        >
                          <FaPlay className="text-xs" />
                          <span>Iniciar preparación</span>
                        </button>
                      )}

                      {orderDetails.status === ORDER_STATUS.PENDING && (
                        <button
                          onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.IN_PROGRESS)}
                          className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        >
                          <FaPlay className="text-xs" />
                          <span>Iniciar preparación</span>
                        </button>
                      )}
                      
                      {orderDetails.status === ORDER_STATUS.IN_PROGRESS && (
                        <>
                          {orderDetails.orderType === 'delivery' && !orderDetails.deliveryToken && !orderDetails.deliveryPersonId && !orderDetails.confirmationCode && (
                            <button
                              onClick={() => setAssignDomiOrder(orderDetails)}
                              className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                            >
                              <FaMotorcycle className="text-xs" />
                              <span>Asignar Domi</span>
                            </button>
                          )}
                          <button
                            onClick={() => updateOrderStatus(orderDetails._id, ORDER_STATUS.COMPLETED)}
                            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                          >
                            <FaCheck className="text-xs" />
                            <span>{orderDetails.orderType === 'delivery' ? 'Completar (Forzado)' : 'Marcar como completado'}</span>
                          </button>
                        </>
                      )}
                      
                      {!orderDetails.sentToKitchen && (
                        <button
                          onClick={() => sendToKitchen(orderDetails._id)}
                          className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        >
                          <FaUtensils className="text-xs" />
                          <span>Enviar a cocina</span>
                        </button>
                      )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Proof Full-screen Modal */}
      <AnimatePresence>
        {showProofModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]"
            onClick={() => setShowProofModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-lg w-full max-h-[90vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowProofModal(false)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10"
              >
                <FaTimes className="text-slate-500 text-xs" />
              </button>
              <img
                src={proofImageUrl}
                alt="Comprobante de pago"
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AssignDeliveryModal 
        isOpen={!!assignDomiOrder}
        onClose={() => setAssignDomiOrder(null)}
        order={assignDomiOrder}
        businessId={businessId}
        onAssigned={(data) => {
          // You could optionally do something here, like optimistic update
          // updateOrderStatus(assignDomiOrder._id, ORDER_STATUS.IN_PROGRESS); 
          // Since it will be reflected via Socket anyway, doing nothing is also fine.
        }}
      />
    </div>
  );
}

export default ModernOrdersDashboard;

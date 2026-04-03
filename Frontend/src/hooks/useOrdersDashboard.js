import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { BACKEND_URL } from '../config';
import { socket, joinBusiness, socketDiagnostic } from '../services/socket';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useNavigate } from 'react-router-dom';
import { TIME_INTERVALS, SOCKET_EVENTS, ORDER_STATUS } from '../utils/constants';
import {
  FaClipboardList, FaClock, FaMoneyBillWave, FaImage, FaCheckCircle,
  FaUtensils, FaCheck, FaChair, FaShoppingBag, FaTruck
} from 'react-icons/fa';

export default function useOrdersDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const { businessConfig, businessId } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const [pendingNotifications, setPendingNotifications] = useState([]);
  const notificationAudioRef = useRef(null);
  const notificationIntervalRef = useRef(null);
  const selectedOrderRef = useRef(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const navigate = useNavigate();

  // Print order ticket
  const handlePrintOrder = (order) => {
    if (!order) return;
    const bName = businessConfig?.businessName || 'Mi Negocio';
    const bAddr = businessConfig?.address || '';
    const bPhone = businessConfig?.whatsappNumber || '';
    const bNit = businessConfig?.nit || '';
    const paperSize = businessConfig?.printerSettings?.paperSize || '55';
    const showQR = businessConfig?.printerSettings?.showQR !== false;
    const slug = businessConfig?.slug || '';
    const menuLink = slug ? `https://menuby.tech/${slug}` : '';
    const isFromMenuBy = order.source === 'menuby' || order.source === 'inapp' || !order._posExtra;
    const date = new Date(order.createdAt || Date.now());
    const items = order.items || [];
    const total = order.totalAmount || order.finalAmount || 0;

    const orderTypeLabels = { inSite: businessConfig?.businessType === 'hotel' ? 'En habitación' : 'En mesa', takeaway: 'Para llevar', delivery: 'Delivery' };
    const orderTypeLabel = orderTypeLabels[order.orderType] || order.orderType || '';

    let itemsHtml = '';
    items.forEach(item => {
      const lineTotal = ((item.totalPrice || item.price || 0) * (item.quantity || 1));
      const loyaltyTag = item.isLoyaltyReward ? ' 🎁' : '';
      itemsHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:16px;color:#000"><span style="font-weight:900;font-size:16px;color:#000">${item.quantity}x ${item.name}${loyaltyTag}</span><span style="font-weight:900;font-size:15px">${item.isLoyaltyReward ? 'GRATIS' : '$' + lineTotal.toLocaleString()}</span></div>`;
      if (item.selectedToppings) {
        item.selectedToppings.forEach(t => {
          const tName = t.optionName || t.name || '';
          const tPrice = t.price > 0 ? ` ($${t.price.toLocaleString()})` : '';
          const tGroup = t.groupName ? `${t.groupName}: ` : '';
          if (tName) itemsHtml += `<div style="padding-left:8px;font-size:14px;font-weight:900;color:#000">+ ${tGroup}${tName}${tPrice}</div>`;
          if (t.subGroups) {
            t.subGroups.forEach(sg => {
              const sgPrice = sg.price > 0 ? ` ($${sg.price.toLocaleString()})` : '';
              const sgTitle = sg.subGroupTitle ? `${sg.subGroupTitle}: ` : '';
              itemsHtml += `<div style="padding-left:16px;font-size:13px;font-weight:900;color:#000">+ ${sgTitle}${sg.optionName}${sgPrice}</div>`;
            });
          }
        });
      }
    });

    let customerHtml = '';
    if (order.customerName) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Cliente:</span><span>${order.customerName}</span></div>`;
    if (order.phone) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Tel:</span><span>${order.phone}</span></div>`;
    if (orderTypeLabel) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Tipo:</span><span>${orderTypeLabel}</span></div>`;
    if (order.tableNumber) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:16px;color:#000"><span>${businessConfig?.businessType === 'hotel' ? 'Hab.:' : 'Mesa:'}</span><span>${order.tableNumber}</span></div>`;
    if (order.orderType === 'delivery' && order.address) customerHtml += `<div style="padding:2px 0;font-weight:900;font-size:14px;color:#000">Dir: ${order.address}</div>`;
    if (order.orderType === 'delivery' && order.deliveryZoneName) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:14px;color:#000"><span>Zona:</span><span>${order.deliveryZoneName}</span></div>`;
    const pmLabels = { cash: 'Efectivo', efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', transfer: 'Transferencia', transferencia: 'Transferencia', roomCharge: 'Cargo a hab.', other: 'Otro' };
    if (order.paymentMethod) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Pago:</span><span>${pmLabels[order.paymentMethod] || order.paymentMethod}</span></div>`;

    let deliveryFeeHtml = '';
    if (order.deliveryFee) {
      deliveryFeeHtml = `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Envío:</span><span>$${order.deliveryFee.toLocaleString()}</span></div>`;
    }

    const qrSection = (isFromMenuBy && showQR && menuLink) ? `
      <div style="text-align:center;margin-top:10px">
        <div style="text-align:center;font-weight:900;font-size:13px;color:#000;margin-bottom:6px">¡Pide desde tu celular!</div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(menuLink)}&format=png" alt="QR" width="160" height="160" style="display:block;margin:0 auto" />
        <div style="text-align:center;font-weight:900;font-size:12px;color:#000;margin-top:6px">Escanea y pide con descuento</div>
        <div style="text-align:center;font-size:10px;font-weight:900;color:#000;margin-top:2px">${menuLink}</div>
      </div>
    ` : '';

    const finalTotal = total + (order.deliveryFee || 0) - (order.discountAmount || 0);

    const printWindow = window.open('', '_blank', 'width=260,height=700');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Pedido #${order.orderNumber || ''}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:15px;font-weight:900;width:${paperSize}mm;padding:2mm;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}img{display:block;margin:0 auto}@media print{body{width:${paperSize}mm}@page{margin:0;size:${paperSize}mm auto}}</style>
    </head><body>
      <div style="height:20px"></div>
      <div style="text-align:center;font-weight:900;font-size:20px;color:#000;margin-bottom:2px">${bName}</div>
      ${bAddr ? `<div style="text-align:center;font-weight:900;font-size:12px;color:#000">${bAddr}</div>` : ''}
      ${bPhone ? `<div style="text-align:center;font-weight:900;font-size:12px;color:#000">Tel: ${bPhone}</div>` : ''}
      ${bNit ? `<div style="text-align:center;font-weight:900;font-size:12px;color:#000">NIT: ${bNit}</div>` : ''}
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Orden:</span><span style="font-weight:900;font-size:16px">  #${order.orderNumber}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Fecha:</span><span>${date.toLocaleDateString('es-CO')}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Hora:</span><span>${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>
      ${customerHtml}
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      ${itemsHtml}
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      ${deliveryFeeHtml}
      ${order.discountAmount ? `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Descuento:</span><span>-$${order.discountAmount.toLocaleString()}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:20px;font-weight:900;color:#000"><span>TOTAL</span><span style="font-size:22px;font-weight:900">$${parseFloat(finalTotal).toLocaleString()}</span></div>
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      <div style="text-align:center;font-weight:900;font-size:14px;color:#000;margin-top:6px">¡Gracias por su compra!</div>
      ${qrSection}
      <div style="text-align:center;font-size:11px;font-weight:900;color:#333;margin-top:8px">Gracias por usar MenuBy ❤️</div>
      <div style="text-align:center;font-size:10px;font-weight:bold;color:#555;margin-top:1px">menuby.tech</div>
    </body></html>`);

    printWindow.document.close();
    printWindow.focus();
    const images = printWindow.document.querySelectorAll('img');
    const imgPromises = Array.from(images).map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; }));
    Promise.all(imgPromises).then(() => { setTimeout(() => { printWindow.print(); printWindow.close(); }, 200); });
  };

  const calculateTimeElapsed = (createdAt) => {
    const orderTime = new Date(createdAt);
    const now = new Date();
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs > 0) return `${diffHrs}h ${diffMins % 60}m`;
    return `${diffMins}m`;
  };

  const getOrderTypeInfo = (orderType) => {
    switch (orderType) {
      case 'inSite':
        return { Icon: FaChair, color: 'bg-blue-500', label: businessConfig?.businessType === 'hotel' ? 'En habitación' : 'En mesa' };
      case 'takeaway':
        return { Icon: FaShoppingBag, color: 'bg-orange-500', label: 'Para llevar' };
      case 'delivery':
        return { Icon: FaTruck, color: 'bg-emerald-500', label: 'Delivery' };
      default:
        return { Icon: FaUtensils, color: 'bg-slate-500', label: 'Desconocido' };
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case ORDER_STATUS.PENDING:
        return { color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', label: 'Pendiente', Icon: FaClock };
      case ORDER_STATUS.PENDING_PAYMENT:
        return { color: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50', label: 'Pago pendiente', Icon: FaMoneyBillWave };
      case ORDER_STATUS.PAYMENT_UPLOADED:
        return { color: 'bg-purple-500', textColor: 'text-purple-700', bgColor: 'bg-purple-50', label: 'Comprobante recibido', Icon: FaImage };
      case ORDER_STATUS.PAYMENT_CONFIRMED:
        return { color: 'bg-teal-500', textColor: 'text-teal-700', bgColor: 'bg-teal-50', label: 'Pago confirmado', Icon: FaCheckCircle };
      case ORDER_STATUS.CONFIRMED:
        return { color: 'bg-indigo-500', textColor: 'text-indigo-700', bgColor: 'bg-indigo-50', label: 'Confirmado', Icon: FaCheckCircle };
      case ORDER_STATUS.PREPARING:
        return { color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50', label: 'Preparando', Icon: FaUtensils };
      case ORDER_STATUS.READY:
        return { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', label: 'Listo', Icon: FaCheck };
      case ORDER_STATUS.IN_PROGRESS:
        return { color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', label: 'En progreso', Icon: FaUtensils };
      case ORDER_STATUS.COMPLETED:
        return { color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50', label: 'Completado', Icon: FaCheck };
      default:
        return { color: 'bg-slate-500', textColor: 'text-slate-700', bgColor: 'bg-slate-50', label: 'Desconocido', Icon: FaClipboardList };
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/orders?businessId=${businessId}&status=pending,pending_payment,payment_uploaded,payment_confirmed,confirmed,inProgress,preparing,ready&_t=${Date.now()}`);
      setOrders(response.data);
      const pendingOrders = response.data.filter(order =>
        order.status === ORDER_STATUS.PENDING || order.status === ORDER_STATUS.PAYMENT_UPLOADED
      );
      if (pendingOrders.length > 0) {
        setPendingNotifications(pendingOrders.map(order => order._id));
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  // Initialize audio element
  useEffect(() => {
    if (notificationAudioRef.current) {
      const audio = notificationAudioRef.current;
      audio.load();
      const onLoadStart = () => console.log('Audio loading started');
      const onCanPlayThrough = () => console.log('Audio can play through');
      const onError = (e) => console.error('Audio error during load:', e);
      audio.addEventListener('loadstart', onLoadStart);
      audio.addEventListener('canplaythrough', onCanPlayThrough);
      audio.addEventListener('error', onError);
      return () => {
        audio.removeEventListener('loadstart', onLoadStart);
        audio.removeEventListener('canplaythrough', onCanPlayThrough);
        audio.removeEventListener('error', onError);
      };
    }
  }, []);

  // Play notification sound for pending orders
  useEffect(() => {
    if (notificationIntervalRef.current) {
      clearInterval(notificationIntervalRef.current);
      notificationIntervalRef.current = null;
    }

    if (pendingNotifications.length > 0) {
      const playSound = () => {
        if (notificationAudioRef.current) {
          const audio = notificationAudioRef.current;
          if (audio.readyState >= 2) {
            audio.currentTime = 0;
            audio.play().catch(e => {
              console.error('Error playing notification sound:', e);
              try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
              } catch (fallbackError) {
                console.error('Fallback sound also failed:', fallbackError);
              }
            });
          } else {
            audio.load();
            setTimeout(() => {
              if (audio.readyState < 2) {
                try {
                  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                  const oscillator = audioContext.createOscillator();
                  const gainNode = audioContext.createGain();
                  oscillator.connect(gainNode);
                  gainNode.connect(audioContext.destination);
                  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                  oscillator.start(audioContext.currentTime);
                  oscillator.stop(audioContext.currentTime + 0.5);
                } catch (fallbackError) {
                  console.error('Fallback sound also failed:', fallbackError);
                }
              }
            }, 1000);
          }
        }
      };
      playSound();
      notificationIntervalRef.current = setInterval(playSound, TIME_INTERVALS.NOTIFICATION_SOUND);
    }

    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }
    };
  }, [pendingNotifications]);

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      const removeStatuses = [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERED];
      if (removeStatuses.includes(newStatus)) {
        setOrders(prevOrders => prevOrders.filter(order => order._id !== orderId));
      } else {
        setOrders(prevOrders => prevOrders.map(order => order._id === orderId ? response.data : order));
      }
      if (newStatus !== ORDER_STATUS.PENDING) {
        setPendingNotifications(prev => prev.filter(id => id !== orderId));
      }
      if (selectedOrder === orderId) {
        setOrderDetails(response.data);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Error al actualizar el estado del pedido');
    }
  };

  const sendToKitchen = async (orderId) => {
    try {
      await api.patch(`/orders/${orderId}/send-to-kitchen`);
      setOrders(prevOrders => prevOrders.map(order => order._id === orderId ? { ...order, sentToKitchen: true } : order));
    } catch (error) {
      console.error('Error sending order to kitchen:', error);
      alert('Error al enviar pedido a cocina');
    }
  };

  const confirmPayment = async (orderId) => {
    try {
      const response = await api.patch(`/orders/${orderId}/confirm-payment`);
      const updatedOrder = response.data.order || response.data;
      setOrders(prevOrders => prevOrders.map(order => order._id === orderId ? updatedOrder : order));
      if (selectedOrder === orderId) setOrderDetails(updatedOrder);
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Error al confirmar el pago');
    }
  };

  const rejectPayment = async (orderId) => {
    const reason = prompt('Razón del rechazo (opcional):');
    try {
      const response = await api.patch(`/orders/${orderId}/reject-payment`, { reason: reason || '' });
      const updatedOrder = response.data.order || response.data;
      setOrders(prevOrders => prevOrders.map(order => order._id === orderId ? updatedOrder : order));
      if (selectedOrder === orderId) setOrderDetails(updatedOrder);
    } catch (error) {
      console.error('Error rejecting payment:', error);
      alert('Error al rechazar el pago');
    }
  };

  const getProofUrl = (proofPath) => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('superadmin_token');
    return `${BACKEND_URL}${proofPath}${token ? `?token=${token}` : ''}`;
  };

  const goToKitchenScreen = () => {
    const currentPath = window.location.pathname;
    const match = currentPath.match(/^\/([^/]+)/);
    const businessSlug = match ? match[1] : '';
    window.open(`/${businessSlug}/kitchen`, '_blank', 'noopener,noreferrer');
  };

  const showOrderDetails = (order) => {
    setSelectedOrder(order._id);
    setOrderDetails(order);
  };

  // Sync selectedOrderRef
  useEffect(() => {
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrder]);

  // Socket connection for real-time updates
  useEffect(() => {
    if (!businessId) return;
    console.log('Connecting to socket for business:', businessId);
    socketDiagnostic();
    joinBusiness(businessId);

    if (socket) {
      socket.on(SOCKET_EVENTS.ORDER_CREATED, (newOrder) => {
        console.log('New order received:', newOrder);
        setOrders(prevOrders => [newOrder, ...prevOrders]);
        if (newOrder.status === ORDER_STATUS.PENDING) {
          setPendingNotifications(prev => [...prev, newOrder._id]);
        }
      });

      socket.on(SOCKET_EVENTS.ORDER_UPDATED, (updatedOrder) => {
        console.log('Order updated:', updatedOrder);
        if (!updatedOrder?._id) return;
        setOrders(prevOrders => prevOrders.filter(Boolean).map(order => order?._id === updatedOrder._id ? updatedOrder : order));
        if (updatedOrder.status !== ORDER_STATUS.PENDING) {
          setPendingNotifications(prev => prev.filter(id => id !== updatedOrder._id));
        }
        if (selectedOrderRef.current === updatedOrder._id) {
          setOrderDetails(updatedOrder);
        }
      });

      socket.on('order_deleted', (deletedOrder) => {
        console.log('Order deleted:', deletedOrder);
        if (!deletedOrder?._id) return;
        setOrders(prevOrders => prevOrders.filter(order => order && order._id !== deletedOrder._id));
        setPendingNotifications(prev => prev.filter(id => id !== deletedOrder._id));
        if (selectedOrderRef.current === deletedOrder._id) {
          setSelectedOrder(null);
          setOrderDetails(null);
        }
      });

      socket.on('payment_proof_uploaded', (data) => {
        console.log('Payment proof uploaded:', data);
        if (!data?.orderId) return;
        api.get(`/orders/${data.orderId}`).then(res => {
          const freshOrder = res.data;
          setOrders(prevOrders => prevOrders.filter(Boolean).map(order => order?._id === freshOrder._id ? freshOrder : order));
          if (selectedOrderRef.current === freshOrder._id) setOrderDetails(freshOrder);
          setPendingNotifications(prev => [...prev, freshOrder._id]);
        }).catch(err => console.error('Error fetching updated order after payment proof:', err));
      });
    }

    return () => {
      if (socket) {
        socket.off(SOCKET_EVENTS.ORDER_CREATED);
        socket.off(SOCKET_EVENTS.ORDER_UPDATED);
        socket.off('order_deleted');
        socket.off('payment_proof_uploaded');
      }
    };
  }, [businessId]);

  // Load orders on mount + polling fallback
  useEffect(() => {
    if (businessId) {
      fetchOrders();
      const interval = setInterval(() => {
        if (!document.hidden) fetchOrders();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [businessId]);

  return {
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
  };
}

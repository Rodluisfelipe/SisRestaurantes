import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { BACKEND_URL } from '../config';
import { socket, joinBusiness, socketDiagnostic } from '../services/socket';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useNavigate } from 'react-router-dom';
import { TIME_INTERVALS, SOCKET_EVENTS, ORDER_STATUS } from '../utils/constants';
import { totalDelPedido, totalDeLinea, escaparHtml as e } from '../utils/pedidos';
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
    /* Todo lo que viene del cliente o del negocio pasa por e(): esta ventana es
       del mismo sitio que el panel, y un nombre con HTML se ejecutaría con la
       sesión del dueño. */

    const orderTypeLabels = { inSite: businessConfig?.businessType === 'hotel' ? 'En habitación' : 'En mesa', takeaway: 'Para llevar', delivery: 'Delivery' };
    const orderTypeLabel = orderTypeLabels[order.orderType] || order.orderType || '';

    let itemsHtml = '';
    items.forEach(item => {
      const lineTotal = totalDeLinea(item);
      const loyaltyTag = item.isLoyaltyReward ? ' 🎁' : '';
      itemsHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:16px;color:#000"><span style="font-weight:900;font-size:16px;color:#000">${e(item.quantity)}x ${e(item.name)}${loyaltyTag}</span><span style="font-weight:900;font-size:15px">${item.isLoyaltyReward ? 'GRATIS' : '$' + lineTotal.toLocaleString()}</span></div>`;
      if (item.selectedToppings) {
        item.selectedToppings.forEach(t => {
          const tName = t.optionName || t.name || '';
          const tPrice = t.price > 0 ? ` ($${t.price.toLocaleString()})` : '';
          const tGroup = t.groupName ? `${t.groupName}: ` : '';
          if (tName) itemsHtml += `<div style="padding-left:8px;font-size:14px;font-weight:900;color:#000">+ ${e(tGroup)}${e(tName)}${tPrice}</div>`;
          if (t.subGroups) {
            t.subGroups.forEach(sg => {
              const sgPrice = sg.price > 0 ? ` ($${sg.price.toLocaleString()})` : '';
              const sgTitle = sg.subGroupTitle ? `${sg.subGroupTitle}: ` : '';
              itemsHtml += `<div style="padding-left:16px;font-size:13px;font-weight:900;color:#000">+ ${e(sgTitle)}${e(sg.optionName)}${sgPrice}</div>`;
            });
          }
        });
      }
    });

    let customerHtml = '';
    if (order.customerName) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Cliente:</span><span>${e(order.customerName)}</span></div>`;
    if (order.phone) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Tel:</span><span>${e(order.phone)}</span></div>`;
    if (orderTypeLabel) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Tipo:</span><span>${e(orderTypeLabel)}</span></div>`;
    if (order.tableNumber) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:16px;color:#000"><span>${businessConfig?.businessType === 'hotel' ? 'Hab.:' : 'Mesa:'}</span><span>${e(order.tableNumber)}</span></div>`;
    if (order.orderType === 'delivery' && order.address) customerHtml += `<div style="padding:2px 0;font-weight:900;font-size:14px;color:#000">Dir: ${e(order.address)}</div>`;
    if (order.orderType === 'delivery' && order.deliveryZoneName) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:14px;color:#000"><span>Zona:</span><span>${e(order.deliveryZoneName)}</span></div>`;
    const pmLabels = { cash: 'Efectivo', efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', transfer: 'Transferencia', transferencia: 'Transferencia', roomCharge: 'Cargo a hab.', credito: 'Crédito', other: 'Otro' };
    if (order.paymentMethod) customerHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Pago:</span><span>${e(pmLabels[order.paymentMethod] || order.paymentMethod)}</span></div>`;

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

    const finalTotal = totalDelPedido(order);

    const printWindow = window.open('', '_blank', 'width=260,height=700');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Pedido #${e(order.orderNumber || '')}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:15px;font-weight:900;width:${paperSize}mm;padding:2mm;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}img{display:block;margin:0 auto}@media print{body{width:${paperSize}mm}@page{margin:0;size:${paperSize}mm auto}}</style>
    </head><body>
      <div style="height:20px"></div>
      <div style="text-align:center;font-weight:900;font-size:20px;color:#000;margin-bottom:2px">${e(bName)}</div>
      ${bAddr ? `<div style="text-align:center;font-weight:900;font-size:12px;color:#000">${e(bAddr)}</div>` : ''}
      ${bPhone ? `<div style="text-align:center;font-weight:900;font-size:12px;color:#000">Tel: ${e(bPhone)}</div>` : ''}
      ${bNit ? `<div style="text-align:center;font-weight:900;font-size:12px;color:#000">NIT: ${e(bNit)}</div>` : ''}
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Orden:</span><span style="font-weight:900;font-size:16px">  #${e(order.orderNumber)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Fecha:</span><span>${date.toLocaleDateString('es-CO')}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Hora:</span><span>${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>
      ${customerHtml}
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      ${itemsHtml}
      <div style="border-top:2px dashed #000;margin:8px 0"></div>
      ${deliveryFeeHtml}
      ${order.discountAmount ? `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Descuento:</span><span>-$${order.discountAmount.toLocaleString()}</span></div>` : ''}
      ${order.tipAmount ? `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;font-size:15px;color:#000"><span>Propina:</span><span>$${order.tipAmount.toLocaleString()}</span></div>` : ''}
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

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get(`/orders?businessId=${businessId}&status=pending,pending_payment,payment_uploaded,payment_confirmed,confirmed,inProgress,preparing,ready&_t=${Date.now()}`);
      setOrders(response.data);
      const pendingOrders = response.data.filter(order =>
        order.status === ORDER_STATUS.PENDING || order.status === ORDER_STATUS.PAYMENT_UPLOADED
      );
      /* Siempre, también cuando no queda ninguno: antes solo se escribía si
         había pendientes, y si se atendían desde otro equipo la alarma seguía
         sonando sin nada que atender. */
      setPendingNotifications(pendingOrders.map(order => order._id));
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

  /* Lo que dice el servidor ("ese pedido ya fue entregado"…) le sirve más a
     quien atiende que un "Error al actualizar" genérico. */
  const avisarError = (error, porDefecto) => {
    const msg = error?.response?.data?.message;
    alert(msg || (error?.response ? porDefecto : 'Sin conexión. Revisa el internet y vuelve a intentarlo.'));
  };

  /* Un toque por pedido a la vez: el doble toque mandaba dos cambios y el
     segundo volvía con error aunque el primero hubiera funcionado. */
  const enCurso = useRef(new Set());
  const unaVez = async (orderId, fn) => {
    if (enCurso.current.has(orderId)) return;
    enCurso.current.add(orderId);
    try { await fn(); } finally { enCurso.current.delete(orderId); }
  };

  const TERMINALES = [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERED];

  const updateOrderStatus = (orderId, newStatus) => unaVez(orderId, async () => {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      if (TERMINALES.includes(newStatus)) {
        setOrders(prevOrders => prevOrders.filter(order => order._id !== orderId));
        // Cerrado el pedido, su detalle ya no tiene nada que hacer abierto.
        if (selectedOrderRef.current === orderId) { setSelectedOrder(null); setOrderDetails(null); }
      } else {
        setOrders(prevOrders => prevOrders.map(order => order._id === orderId ? response.data : order));
        if (selectedOrderRef.current === orderId) setOrderDetails(response.data);
      }
      if (newStatus !== ORDER_STATUS.PENDING) {
        setPendingNotifications(prev => prev.filter(id => id !== orderId));
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      avisarError(error, 'No se pudo cambiar el estado del pedido');
      fetchOrders(true); // por si otro equipo ya lo había movido
    }
  });

  const sendToKitchen = (orderId) => unaVez(orderId, async () => {
    try {
      await api.patch(`/orders/${orderId}/send-to-kitchen`);
      setOrders(prevOrders => prevOrders.map(order => order._id === orderId ? { ...order, sentToKitchen: true } : order));
      if (selectedOrderRef.current === orderId) setOrderDetails(prev => prev ? { ...prev, sentToKitchen: true } : prev);
    } catch (error) {
      console.error('Error sending order to kitchen:', error);
      avisarError(error, 'No se pudo enviar el pedido a cocina');
    }
  });

  const confirmPayment = (orderId) => unaVez(orderId, async () => {
    try {
      const response = await api.patch(`/orders/${orderId}/confirm-payment`);
      const updatedOrder = response.data.order || response.data;
      setOrders(prevOrders => prevOrders.map(order => order._id === orderId ? updatedOrder : order));
      setPendingNotifications(prev => prev.filter(id => id !== orderId));
      if (selectedOrderRef.current === orderId) setOrderDetails(updatedOrder);
    } catch (error) {
      console.error('Error confirming payment:', error);
      avisarError(error, 'No se pudo confirmar el pago');
    }
  });

  const rejectPayment = (orderId) => {
    const reason = prompt('¿Por qué se rechaza el pago? (opcional)');
    // "Cancelar" en la ventanita es arrepentirse, no rechazar sin motivo.
    if (reason === null) return;
    return unaVez(orderId, async () => {
      try {
        const response = await api.patch(`/orders/${orderId}/reject-payment`, { reason: reason || '' });
        const updatedOrder = response.data.order || response.data;
        setOrders(prevOrders => prevOrders.map(order => order._id === orderId ? updatedOrder : order));
        setPendingNotifications(prev => prev.filter(id => id !== orderId));
        if (selectedOrderRef.current === orderId) setOrderDetails(updatedOrder);
      } catch (error) {
        console.error('Error rejecting payment:', error);
        avisarError(error, 'No se pudo rechazar el pago');
      }
    });
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
    // Solo los oyentes de este efecto: socket.off('evento') sin la función
    // quitaba también los de otras pantallas (el aviso de pedido nuevo, por ej.).
    const oyentes = [];
    const escuchar = (ev, fn) => { socket.on(ev, fn); oyentes.push([ev, fn]); };
    if (!businessId) return;
    console.log('Connecting to socket for business:', businessId);
    socketDiagnostic();
    joinBusiness(businessId);

    if (socket) {
      escuchar(SOCKET_EVENTS.ORDER_CREATED, (newOrder) => {
        console.log('New order received:', newOrder);
        if (!newOrder?._id) return;
        // Puede llegar dos veces (socket y recarga): nunca duplicado en la lista.
        setOrders(prevOrders => [newOrder, ...prevOrders.filter(o => o?._id !== newOrder._id)]);
        if (newOrder.status === ORDER_STATUS.PENDING) {
          setPendingNotifications(prev => prev.includes(newOrder._id) ? prev : [...prev, newOrder._id]);
        }
      });

      escuchar(SOCKET_EVENTS.ORDER_UPDATED, (updatedOrder) => {
        console.log('Order updated:', updatedOrder);
        if (!updatedOrder?._id) return;
        /* Terminado o cancelado en otro equipo (la caja, la cocina): sale de
           la lista ya, no a los 30 segundos. */
        setOrders(prevOrders => prevOrders.filter(Boolean)
          .filter(order => !(order._id === updatedOrder._id && [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERED].includes(updatedOrder.status)))
          .map(order => order?._id === updatedOrder._id ? updatedOrder : order));
        if (updatedOrder.status !== ORDER_STATUS.PENDING) {
          setPendingNotifications(prev => prev.filter(id => id !== updatedOrder._id));
        }
        if (selectedOrderRef.current === updatedOrder._id) {
          setOrderDetails(updatedOrder);
        }
      });

      escuchar('order_deleted', (deletedOrder) => {
        console.log('Order deleted:', deletedOrder);
        if (!deletedOrder?._id) return;
        setOrders(prevOrders => prevOrders.filter(order => order && order._id !== deletedOrder._id));
        setPendingNotifications(prev => prev.filter(id => id !== deletedOrder._id));
        if (selectedOrderRef.current === deletedOrder._id) {
          setSelectedOrder(null);
          setOrderDetails(null);
        }
      });

      escuchar('payment_proof_uploaded', (data) => {
        console.log('Payment proof uploaded:', data);
        if (!data?.orderId) return;
        api.get(`/orders/${data.orderId}`).then(res => {
          const freshOrder = res.data;
          setOrders(prevOrders => prevOrders.filter(Boolean).map(order => order?._id === freshOrder._id ? freshOrder : order));
          if (selectedOrderRef.current === freshOrder._id) setOrderDetails(freshOrder);
          setPendingNotifications(prev => prev.includes(freshOrder._id) ? prev : [...prev, freshOrder._id]);
        }).catch(err => console.error('Error fetching updated order after payment proof:', err));
      });
    }

    return () => {
      if (socket) {
        oyentes.forEach(([ev, fn]) => socket.off(ev, fn));
      }
    };
  }, [businessId]);

  // Load orders on mount + polling fallback
  useEffect(() => {
    if (businessId) {
      fetchOrders();
      const interval = setInterval(() => {
        if (!document.hidden) fetchOrders(true);
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
    goToKitchenScreen, showOrderDetails,
  };
}

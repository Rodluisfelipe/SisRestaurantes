import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import RastreoEnvio from './RastreoEnvio';
import { formatCurrency } from '../utils/currency';
import { API_URL } from '../config';
import { socket } from '../services/socket';
import logger from '../utils/logger';
import { isPushSupported, subscribeToPush, isIOS, isInstalledPWA } from '../utils/pushNotifications';
import { Capa } from './ui';
import { ArrowLeft, ReceiptText, ChefHat, Bike, ShoppingBag, CheckCircle2, CreditCard, Hourglass, XCircle, MessageCircle, Package } from 'lucide-react';
import { pasosDelPedido } from '../utils/estadoPedido';
import { esTienda } from '../utils/tienda';
import { enlaceWhatsApp } from '../utils/whatsapp';
import { imageAt } from '../utils/imageCdn';

const ICONO_PASO = { pago: CreditCard, verificando: Hourglass, recibido: ReceiptText, preparando: ChefHat, camino: Bike, listo: ShoppingBag, final: CheckCircle2 };
const hora = (ts) => (ts ? new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '');

// ─── SVG Icon system ────────────────────────────────────────────────
const I = {
  creditCard: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>,
  upload: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  check: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  checkCircle: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  clock: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" /></svg>,
  fire: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" /></svg>,
  sparkle: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>,
  xMark: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  xCircle: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  truck: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>,
  clipboard: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 3h1.5a2.251 2.251 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>,
  bell: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
  chat: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>,
  send: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>,
  camera: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>,
  copy: (c = 'w-4 h-4') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>,
  calendar: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  user: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  exclamation: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
  bank: (c = 'w-5 h-5') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>,
  phone: (c = 'w-4 h-4') => <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>,
};

// ─── Status config with SVG icon refs ───────────────────────────────
const STATUS_CONFIG = {
  pending_payment: { label: 'Pendiente de Pago', shortLabel: 'Pagar', iconFn: I.creditCard, color: '#f59e0b', description: 'Realiza el pago y sube tu comprobante' },
  payment_uploaded: { label: 'Comprobante Enviado', shortLabel: 'Enviado', iconFn: I.upload, color: '#8b5cf6', description: 'El restaurante está verificando tu pago' },
  payment_confirmed: { label: 'Pago Confirmado', shortLabel: 'Confirmado', iconFn: I.checkCircle, color: '#10b981', description: 'Tu pago ha sido confirmado' },
  pending: { label: 'Pedido Recibido', shortLabel: 'Recibido', iconFn: I.clipboard, color: '#6366f1', description: 'Tu pedido fue recibido por el restaurante' },
  confirmed: { label: 'Confirmado', shortLabel: 'Confirmado', iconFn: I.checkCircle, color: '#10b981', description: 'El restaurante confirmó tu pedido' },
  preparing: { label: 'En Preparación', shortLabel: 'Preparando', iconFn: I.fire, color: '#f97316', description: 'Tu pedido se está preparando' },
  inProgress: { label: 'En Preparación', shortLabel: 'Preparando', iconFn: I.fire, color: '#f97316', description: 'Tu pedido se está preparando' },
  ready: { label: 'Listo', shortLabel: 'Listo', iconFn: I.sparkle, color: '#22c55e', description: '¡Tu pedido está listo!' },
  completed: { label: 'Completado', shortLabel: 'Completado', iconFn: I.sparkle, color: '#0ea5e9', description: 'Pedido entregado' },
  delivered: { label: 'Entregado', shortLabel: 'Entregado', iconFn: I.truck, color: '#0ea5e9', description: 'Tu pedido ha sido entregado' },
  cancelled: { label: 'Cancelado', shortLabel: 'Cancelado', iconFn: I.xCircle, color: '#ef4444', description: 'Este pedido fue cancelado' },
};


const OrderTracker = ({ 
  orderId, customerToken, businessConfig, onClose, onUploadProof, initialOrder = null 
}) => {
  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(true);
  const [activeTab, setActiveTab] = useState('status');

  // Payment states
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [pushState, setPushState] = useState('checking');
  const proofInputRef = useRef(null);

  // Chat states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatError, setChatError] = useState(null);
  const chatScrollRef = useRef(null);
  const chatUnreadRef = useRef(0);

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const textColor = businessConfig?.theme?.buttonTextColor || '#ffffff';
  const paymentInfo = businessConfig?.paymentInfo || {};
  const businessId = businessConfig?.businessId || businessConfig?._id;

  // ─── Push notifications ───────────────────────────────────────────
  useEffect(() => {
    const checkPush = async () => {
      if (isIOS() && !isInstalledPWA()) { setPushState('ios-not-pwa'); return; }
      if (!isPushSupported()) { setPushState('dismissed'); return; }
      if (Notification.permission === 'denied') { setPushState('dismissed'); return; }
      if (Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          const existingSub = await reg.pushManager.getSubscription();
          if (existingSub) {
            setPushState('subscribed');
            try { await subscribeToPush(businessId, null, customerToken); } catch (_) {}
            return;
          }
        } catch (_) {}
      }
      setPushState('idle');
    };
    checkPush();
  }, [businessId, customerToken]);

  const handleEnableNotifications = async () => {
    try {
      await subscribeToPush(businessId, null, customerToken);
      setPushState('subscribed');
    } catch (err) {
      if (Notification.permission === 'denied') setPushState('dismissed');
    }
  };

  // ─── Payment methods ──────────────────────────────────────────────
  const paymentMethods = (() => {
    const pm = businessConfig?.paymentMethods;
    const isEnabled = (id, fallback) => {
      if (!pm || !pm[id]) return fallback;
      return pm[id].enabled && pm[id].modes?.inapp !== false;
    };
    return [
      isEnabled('nequi', !!paymentInfo.nequi) && paymentInfo.nequi && { id: 'nequi', label: 'Nequi', logo: 'https://cdn.prod.website-files.com/6317a229ebf7723658463b4b/663a6b0d43303ddf38035997_logo-nequi.svg', color: '#200020', bg: '#F3E8FF', number: paymentInfo.nequi },
      isEnabled('daviplata', !!paymentInfo.daviplata) && paymentInfo.daviplata && { id: 'daviplata', label: 'Daviplata', logo: 'https://play-lh.googleusercontent.com/bNPDiFqg28L6ckatfuP-WgrxDRDk0JEOkC6nUIQp7Q61RW78i1bw-ffMmEjyxl-qP6dv3ANDOQqmIbBtgJI3EA', color: '#DC2626', bg: '#FEF2F2', number: paymentInfo.daviplata },
      isEnabled('transferencia', !!paymentInfo.bankAccountNumber) && paymentInfo.bankAccountNumber && { id: 'bank', label: paymentInfo.bankName || 'Banco', iconFn: I.bank, color: '#1D4ED8', bg: '#EFF6FF',
        number: paymentInfo.bankAccountNumber, extra: `${paymentInfo.bankAccountType || 'Cuenta'}${paymentInfo.accountHolder ? ` · ${paymentInfo.accountHolder}` : ''}` },
    ].filter(Boolean);
  })();

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text).catch(() => {}); };

  const handleProofSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { setUploadError('Máximo 25MB'); return; }
    setProofFile(file);
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleProofUpload = async () => {
    if (!proofFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('proof', proofFile);
      formData.append('customerToken', customerToken);
      await api.post(`/orders/${orderId}/payment-proof`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 });
      setProofFile(null);
      setProofPreview(null);
      fetchOrder();
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Error al subir. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  // ─── Chat ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (order?.messages) setChatMessages(order.messages);
  }, [order?.messages]);

  useEffect(() => {
    if (!socket || !orderId) return;
    const handler = (data) => {
      if (data.orderId?.toString() === orderId?.toString()) {
        setChatMessages(prev => {
          if (prev.some(m => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
        if (activeTab !== 'chat' && data.message.sender === 'business') {
          chatUnreadRef.current += 1;
          setChatUnread(chatUnreadRef.current);
        }
      }
    };
    socket.on('order_message', handler);
    return () => socket.off('order_message', handler);
  }, [orderId, activeTab]);

  useEffect(() => {
    if (activeTab === 'chat') { chatUnreadRef.current = 0; setChatUnread(0); }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  const handleChatSend = async () => {
    if (!chatText.trim() || chatSending) return;
    setChatSending(true);
    setChatError(null);
    try {
      const res = await api.post(`/orders/${orderId}/messages/customer`, { text: chatText.trim(), customerToken }, { headers: { 'X-Customer-Token': customerToken } });
      setChatMessages(prev => [...prev, res.data]);
      setChatText('');
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al enviar mensaje';
      setChatError(msg);
      setTimeout(() => setChatError(null), 4000);
    }
    finally { setChatSending(false); }
  };

  // ─── Order fetching & socket ──────────────────────────────────────
  const [isBookingMode, setIsBookingMode] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!orderId || !customerToken) return;
    try {
      if (isBookingMode) {
        const response = await api.get(`/bookings/${orderId}`);
        const booking = response.data;
        booking.status = booking.bookingStatus;
        booking.isBooking = true;
        setOrder(booking);
        setError(null);
        if (['completed', 'cancelled', 'no_show'].includes(booking.bookingStatus)) setPolling(false);
      } else {
        const response = await api.get(`/orders/track/${orderId}`, { headers: { 'X-Customer-Token': customerToken } });
        setOrder(response.data);
        setError(null);
        if (['completed', 'cancelled', 'delivered'].includes(response.data.status)) setPolling(false);
      }
    } catch (err) {
      if (err.response?.status === 404 && !isBookingMode) {
        try {
          const bookingRes = await api.get(`/bookings/${orderId}`);
          const booking = bookingRes.data;
          booking.status = booking.bookingStatus;
          booking.isBooking = true;
          setIsBookingMode(true);
          setOrder(booking);
          setError(null);
          if (['completed', 'cancelled', 'no_show'].includes(booking.bookingStatus)) setPolling(false);
        } catch (_) { setError('No encontrado'); setPolling(false); }
      } else {
        if (err.response?.status === 404) { setError('No encontrado'); setPolling(false); }
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, customerToken, isBookingMode]);

  useEffect(() => {
    fetchOrder();
    if (!polling) return;
    if (socket && orderId && customerToken) {
      if (!socket.connected) socket.connect();
      socket.emit('trackOrder', { orderId, customerToken });
      const handleStatusChange = (data) => {
        if (data.orderId === orderId || data.orderId?.toString() === orderId) {
          setOrder(prev => data.order || { ...prev, status: data.status });
          if (['completed', 'cancelled', 'delivered'].includes(data.status)) setPolling(false);
        }
      };
      const handleBookingStatusChange = (data) => {
        if (data.bookingId === orderId || data.bookingId?.toString() === orderId) {
          const booking = data.booking;
          if (booking) { booking.status = booking.bookingStatus; booking.isBooking = true; }
          setOrder(prev => booking || { ...prev, status: data.bookingStatus, bookingStatus: data.bookingStatus, isBooking: true });
          setIsBookingMode(true);
          if (['completed', 'cancelled', 'no_show'].includes(data.bookingStatus)) setPolling(false);
        }
      };
      socket.on('order_status_changed', handleStatusChange);
      socket.on('booking_status_changed', handleBookingStatusChange);
      const interval = setInterval(fetchOrder, 30000);
      return () => { socket.off('order_status_changed', handleStatusChange); socket.off('booking_status_changed', handleBookingStatusChange); socket.emit('untrackOrder', orderId); clearInterval(interval); };
    }
    const interval = setInterval(fetchOrder, 5000);
    return () => clearInterval(interval);
  }, [fetchOrder, polling, orderId, customerToken]);

  // ─── Derived state ────────────────────────────────────────────────
  const isInApp = order?.orderChannel === 'inapp';
  const isBooking = order?.isBooking === true;

  const bookingStatusOverrides = isBooking ? {
    pending: { label: 'Cita Pendiente', shortLabel: 'Pendiente', iconFn: I.calendar, color: '#f59e0b', description: 'Tu cita está pendiente de confirmación' },
    confirmed: { label: 'Cita Confirmada', shortLabel: 'Confirmada', iconFn: I.checkCircle, color: '#10b981', description: 'Tu cita ha sido confirmada' },
    completed: { label: 'Cita Completada', shortLabel: 'Completada', iconFn: I.sparkle, color: '#0ea5e9', description: 'Tu cita fue completada' },
    cancelled: { label: 'Cita Cancelada', shortLabel: 'Cancelada', iconFn: I.xCircle, color: '#ef4444', description: 'Tu cita fue cancelada' },
  } : {};

  const rawStatus = bookingStatusOverrides[order?.status] || STATUS_CONFIG[order?.status] || STATUS_CONFIG.pending;
  const businessLabel = (() => {
    const bt = businessConfig?.businessType;
    if (bt === 'hotel') return 'el hotel';
    if (['salon', 'spa', 'clinic', 'services'].includes(bt)) return 'el negocio';
    return 'el restaurante';
  })();
  const currentStatus = rawStatus.description?.includes('restaurante')
    ? { ...rawStatus, description: rawStatus.description.replace(/[Ee]l restaurante/, businessLabel) }
    : rawStatus;

  const formatBookingDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const formatBookingTime = (d) => d ? new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
  const formatPrice = (a) => (!a && a !== 0) ? (formatCurrency(0, businessConfig?.currency)) : formatCurrency(a, businessConfig?.currency);
  const formatTime = (ts) => new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const isTerminal = ['completed', 'delivered', 'cancelled'].includes(order?.status);
  const showPaymentTab = isInApp && !isBooking;
  const showChatTab = isInApp && !isBooking;

  // Auto-switch to payment tab when pending_payment
  useEffect(() => {
    if (order?.status === 'pending_payment' && showPaymentTab && activeTab === 'status') {
      setActiveTab('payment');
    }
  }, [order?.status, showPaymentTab]);

  // ─── Pasos según cómo se pidió (ver utils/estadoPedido) ───────────
  const seguimiento = order && !isBooking
    ? pasosDelPedido({
      status: order.status,
      orderType: order.orderType,
      orderChannel: order.orderChannel,
      statusHistory: order.statusHistory,
      tienda: esTienda(businessConfig),
      hotel: businessConfig?.businessType === 'hotel',
      conDomiciliario: !!order.deliveryPersonName,
    })
    : null;
  const pasoActual = seguimiento?.pasos[seguimiento.actual];
  const IconoActual = seguimiento?.cancelado ? XCircle : (ICONO_PASO[pasoActual?.clave] || Package);
  const colorHero = seguimiento?.cancelado ? '#ef4444' : seguimiento?.terminado ? '#10b981' : themeColor;
  const tituloHero = isBooking ? currentStatus.label
    : seguimiento?.cancelado ? 'Pedido cancelado'
      : seguimiento?.terminado ? `¡${pasoActual.nombre}!` : pasoActual?.nombre;
  const descHero = isBooking ? currentStatus.description
    : seguimiento?.cancelado ? (order?.cancellationReason || 'Este pedido no va a salir.')
      : pasoActual?.desc;
  const ultimaHora = order?.statusHistory?.length ? order.statusHistory[order.statusHistory.length - 1].timestamp : order?.updatedAt;
  const waNegocio = enlaceWhatsApp(
    businessConfig?.whatsappNumber,
    `Hola, te escribo por mi pedido #${order?.orderNumber || ''}`,
    businessConfig?.phoneCountryCode,
  );

  // ─── Loading & error states ───────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 z-[150] bg-white flex items-center justify-center">
        <Capa onCerrar={onClose} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-slate-200 rounded-full animate-spin" style={{ borderTopColor: themeColor }} />
          <p className="text-slate-500 text-sm">{isBooking ? 'Cargando tu cita…' : 'Cargando tu pedido…'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[150] bg-white flex items-center justify-center p-6">
        <Capa onCerrar={onClose} />
        <div className="max-w-sm w-full text-center">
          {I.exclamation('w-12 h-12 mx-auto text-slate-300 mb-3')}
          <h3 className="font-black text-slate-900 text-lg">{error === 'No encontrado' ? 'No encontramos este pedido' : error}</h3>
          <button onClick={onClose} className="mt-6 w-full h-12 rounded-full font-bold" style={{ backgroundColor: themeColor, color: textColor }}>Volver al menú</button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  // ─── Tab definitions ──────────────────────────────────────────────
  const tabs = [
    { id: 'status', label: 'Estado', iconFn: I.clipboard },
    ...(showPaymentTab ? [{ id: 'payment', label: 'Pago', iconFn: I.creditCard }] : []),
    ...(showChatTab ? [{ id: 'chat', label: 'Chat', iconFn: I.chat, badge: chatUnread }] : []),
  ];

  /* Pantalla completa, como una app de pedidos: arriba el paso actual en
     grande y su hora, luego la línea de tiempo con la hora de cada paso, y lo
     que pidió con su foto. */
  return (
    <div className="fixed inset-0 z-[150] bg-white flex flex-col animate-aparecer" role="dialog" aria-modal="true" aria-label={`Estado del pedido ${order.orderNumber}`}>
      <Capa onCerrar={onClose} />
        {/* ─── Barra superior ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 flex-shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100" aria-label="Volver al menú">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-black text-slate-900 leading-tight">{isBooking ? 'Cita' : 'Pedido'} #{order.orderNumber}</p>
            <p className="text-xs text-slate-500 truncate">{businessConfig?.businessName}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* ─── El paso actual, en grande ─────────────────────────── */}
          <div className="px-5 pt-6 pb-5 text-center">
            <div className="relative mx-auto w-20 h-20">
              {!seguimiento?.cancelado && !seguimiento?.terminado && (
                <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: colorHero }} />
              )}
              <span className="relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: colorHero }}>
                <IconoActual className="w-9 h-9" strokeWidth={2} />
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-black text-slate-900 leading-tight">{tituloHero}</h1>
            {descHero && <p className="mt-1 text-[15px] text-slate-600">{descHero}</p>}
            {ultimaHora && !isTerminal && (
              <p className="mt-2 text-xs text-slate-400 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> En vivo · actualizado a las {hora(ultimaHora)}
              </p>
            )}
            {isBooking && order.bookingDate && (
              <p className="mt-2 text-sm font-semibold text-slate-700">{formatBookingDate(order.bookingDate)} · {formatBookingTime(order.bookingDate)}{order.staffName ? ` · ${order.staffName}` : ''}</p>
            )}
          </div>

        {/* ─── Tab bar ────────────────────────────────────────────── */}
        {tabs.length > 1 && (
          <div className="flex mx-5 mb-2 p-1 bg-slate-100 rounded-2xl">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[13px] font-bold transition-colors ${
                  activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {tab.iconFn('w-4 h-4')}
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-2xs font-bold text-white flex items-center justify-center">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
        )}

          {/* ═══ STATUS TAB ═══ */}
          {activeTab === 'status' && (
            <div className="px-5 pb-6 pt-2 space-y-5">
              {/* Avisos: pago rechazado, notificaciones */}
              {isInApp && !isBooking && order.status === 'pending_payment' && order.statusHistory?.some(h => h.note?.includes('rechazado')) && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                  {I.exclamation('w-4 h-4 text-red-500 flex-shrink-0')}
                  <p className="text-sm text-red-700 font-semibold">Comprobante rechazado: sube uno nuevo en la pestaña Pago</p>
                </div>
              )}
              {pushState === 'idle' && !isTerminal && (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200">
                  {I.bell('w-5 h-5 text-slate-500 flex-shrink-0')}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">Te avisamos cuando cambie</p>
                    <p className="text-xs text-slate-500">Sin tener esta pantalla abierta</p>
                  </div>
                  <button onClick={handleEnableNotifications} className="flex-shrink-0 h-9 px-3.5 rounded-full text-xs font-bold" style={{ backgroundColor: themeColor, color: textColor }}>Activar</button>
                  <button onClick={() => setPushState('dismissed')} className="flex-shrink-0 p-1 text-slate-400" aria-label="Ahora no">{I.xMark('w-4 h-4')}</button>
                </div>
              )}

              {/* ─── La línea de tiempo ────────────────────────────── */}
              {seguimiento && !seguimiento.cancelado && (
                <ol aria-label="Pasos del pedido">
                  {seguimiento.pasos.map((p, i) => {
                    const ultimo = i === seguimiento.pasos.length - 1;
                    const Icono = ICONO_PASO[p.clave] || Package;
                    return (
                      <li key={p.clave} className="flex gap-3.5">
                        <div className="flex flex-col items-center">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${p.hecho || p.enCurso ? 'text-white' : 'text-slate-300 border-2 border-slate-200 bg-white'}`}
                            style={p.hecho || p.enCurso ? { backgroundColor: p.clave === 'final' && p.enCurso ? '#10b981' : themeColor } : undefined}
                          >
                            {p.hecho ? I.check('w-4 h-4') : <Icono className="w-4 h-4" />}
                          </span>
                          {!ultimo && <span className="w-0.5 flex-1 min-h-[26px] my-1 rounded-full" style={{ backgroundColor: p.hecho ? themeColor : '#e2e8f0' }} />}
                        </div>
                        <div className={`flex-1 min-w-0 ${ultimo ? '' : 'pb-4'}`}>
                          <div className="flex items-baseline justify-between gap-2 pt-1">
                            <p className={`text-[15px] font-bold leading-tight ${p.hecho || p.enCurso ? 'text-slate-900' : 'text-slate-400'}`}>{p.nombre}</p>
                            {p.hora && <span className="text-xs text-slate-400 tabular-nums flex-shrink-0">{hora(p.hora)}</span>}
                          </div>
                          {p.enCurso && !seguimiento.terminado && <p className="text-[13px] text-slate-500 mt-0.5">{p.desc}</p>}
                          {p.enCurso && p.clave === 'camino' && order.deliveryPersonName && (
                            <p className="text-[13px] text-slate-600 mt-0.5">Lo lleva <b>{order.deliveryPersonName}</b></p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {/* Dónde va el paquete (envíos nacionales). */}
              {order.envio?.guia && (
                <RastreoEnvio guia={order.envio.guia} transportadora={order.envio.transportadora} urlRastreo={order.envio.urlRastreo} />
              )}

              {/* ─── Lo que pidió, con su foto ─────────────────────── */}
              <div>
                <h2 className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">{isBooking ? 'Tu cita' : 'Tu pedido'}</h2>
                <ul className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {order.items?.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                        {item.image && <img src={imageAt(item.image, 120)} alt="" loading="lazy" className="w-full h-full object-cover" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-bold text-slate-900 leading-tight line-clamp-2"><span className="text-slate-500">{item.quantity}×</span> {item.name}</span>
                        {item.opciones?.length > 0 && <span className="block text-xs text-slate-500 truncate">{item.opciones.join(', ')}</span>}
                      </span>
                      <span className="text-[14px] font-bold text-slate-900 tabular-nums flex-shrink-0">{formatPrice(item.price * item.quantity)}</span>
                    </li>
                  ))}
                  {order.deliveryFee > 0 && (
                    <li className="flex justify-between px-3 py-2 text-sm text-slate-600"><span>Domicilio</span><span className="tabular-nums">{formatPrice(order.deliveryFee)}</span></li>
                  )}
                  {order.discountAmount > 0 && (
                    <li className="flex justify-between px-3 py-2 text-sm text-emerald-700"><span>Descuento</span><span className="tabular-nums">-{formatPrice(order.discountAmount)}</span></li>
                  )}
                  <li className="flex justify-between items-center px-3 py-3 bg-slate-50">
                    <span className="text-sm font-bold text-slate-600">Total</span>
                    <span className="text-lg font-black text-slate-900 tabular-nums">{formatPrice(order.finalAmount || order.totalAmount)}</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ═══ PAYMENT TAB ═══ */}
          {activeTab === 'payment' && showPaymentTab && (
            <div className="p-5 space-y-4">
              {order.status === 'pending_payment' && (
                <>
                  {/* Amount to pay */}
                  <div className="bg-gray-50 rounded-2xl p-4 text-center">
                    <p className="text-xs text-gray-500 font-medium mb-1">Total a pagar</p>
                    <p className="text-3xl font-extrabold text-gray-900">{formatPrice(order.finalAmount || order.totalAmount)}</p>
                  </div>

                  {/* Payment method selector */}
                  {paymentMethods.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Selecciona medio de pago</p>
                      <div className={`grid gap-2 ${paymentMethods.length === 1 ? 'grid-cols-1' : paymentMethods.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {paymentMethods.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedPayment(selectedPayment === m.id ? null : m.id)}
                            className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
                              selectedPayment === m.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white'
                            }`}
                          >
                            {m.logo ? (
                              <img src={m.logo} alt={m.label} className="h-6 w-auto object-contain" />
                            ) : (
                              m.iconFn && m.iconFn('w-5 h-5 text-gray-600')
                            )}
                            <span className={`text-[11px] font-semibold ${selectedPayment === m.id ? 'text-blue-700' : 'text-gray-500'}`}>{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected method details */}
                  <AnimatePresence mode="wait">
                    {selectedPayment && (() => {
                      const m = paymentMethods.find(p => p.id === selectedPayment);
                      if (!m) return null;
                      return (
                        <motion.div key={m.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: m.bg, borderColor: `${m.color}30` }}>
                            <div className="flex items-center gap-2">
                              {m.logo && <img src={m.logo} alt={m.label} className="h-4 w-auto object-contain" />}
                              <p className="text-[11px] font-medium" style={{ color: m.color }}>{m.label}</p>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-base font-bold text-gray-900 tracking-wide">{m.number}</p>
                              <button onClick={() => copyToClipboard(m.number)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/80 border border-gray-200 active:scale-95 transition-all">
                                {I.copy('w-3.5 h-3.5')} Copiar
                              </button>
                            </div>
                            {m.extra && <p className="text-[11px] text-gray-500">{m.extra}</p>}
                            {paymentInfo.instructions && (
                              <p className="text-[11px] text-gray-500 mt-1">{paymentInfo.instructions}</p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>

                  {/* Upload proof */}
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Comprobante de pago</p>
                    <input ref={proofInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif" onChange={handleProofSelect} className="hidden" />

                    {!proofPreview ? (
                      <button
                        onClick={() => proofInputRef.current?.click()}
                        className="w-full py-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 transition-colors flex flex-col items-center gap-2"
                      >
                        {I.camera('w-6 h-6 text-gray-400')}
                        <span className="text-sm font-semibold text-gray-600">Toca para subir comprobante</span>
                        <span className="text-2xs text-gray-400">JPG, PNG, WEBP — Max 25MB</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden bg-gray-100">
                          <img src={proofPreview} alt="Comprobante" className="w-full h-40 object-contain" />
                          <button
                            onClick={() => { setProofFile(null); setProofPreview(null); if (proofInputRef.current) proofInputRef.current.value = ''; }}
                            className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center"
                          >
                            {I.xMark('w-4 h-4')}
                          </button>
                        </div>
                        <button
                          onClick={handleProofUpload}
                          disabled={uploading}
                          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                          style={{ backgroundColor: '#10b981' }}
                        >
                          {uploading ? (
                            <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
                          ) : (
                            <>{I.upload('w-4 h-4')} Enviar Comprobante</>
                          )}
                        </button>
                      </div>
                    )}

                    {uploadError && (
                      <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        {I.exclamation('w-4 h-4 flex-shrink-0')} {uploadError}
                      </div>
                    )}
                  </div>

                  {paymentMethods.length === 0 && (
                    <p className="text-xs text-gray-400 text-center">No se han configurado medios de pago</p>
                  )}
                </>
              )}

              {/* Payment uploaded — waiting */}
              {order.status === 'payment_uploaded' && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <div className="w-6 h-6 border-2 border-purple-400 border-t-purple-600 rounded-full animate-spin" />
                  </div>
                  <h4 className="font-bold text-purple-900">Verificando pago</h4>
                  <p className="text-purple-700 text-sm mt-1">Comprobante enviado. {businessLabel.charAt(0).toUpperCase() + businessLabel.slice(1)} está revisándolo.</p>
                </div>
              )}

              {/* Payment confirmed */}
              {order.status === 'payment_confirmed' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    {I.checkCircle('w-6 h-6 text-emerald-600')}
                  </div>
                  <h4 className="font-bold text-emerald-900">Pago confirmado</h4>
                  <p className="text-emerald-700 text-sm mt-1">Tu pedido está siendo preparado</p>
                </div>
              )}

              {/* In progress or later */}
              {['inProgress', 'preparing', 'confirmed', 'ready', 'completed', 'delivered'].includes(order.status) && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    {I.checkCircle('w-6 h-6 text-gray-500')}
                  </div>
                  <h4 className="font-semibold text-gray-700">Pago procesado</h4>
                  <p className="text-gray-500 text-sm mt-1">Monto: {formatPrice(order.finalAmount || order.totalAmount)}</p>
                  {order.paymentMethod && (
                    <p className="text-gray-400 text-xs mt-1">Método: {order.paymentMethod}</p>
                  )}
                </div>
              )}

              {/* Cancelled */}
              {order.status === 'cancelled' && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                  {I.xCircle('w-10 h-10 text-red-400 mx-auto mb-2')}
                  <h4 className="font-semibold text-red-700">Pedido cancelado</h4>
                </div>
              )}
            </div>
          )}

          {/* ═══ CHAT TAB ═══ */}
          {activeTab === 'chat' && showChatTab && (
            <div className="flex flex-col h-full min-h-[350px]">
              {/* Messages */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    {I.chat('w-10 h-10 text-gray-300 mb-3')}
                    <p className="text-sm font-medium text-gray-500">Sin mensajes aún</p>
                    <p className="text-xs text-gray-400 mt-1">Escribe si tienes alguna duda sobre tu pedido</p>
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={m._id || i} className={`flex ${m.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      m.sender === 'customer'
                        ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md'
                    }`}>
                      <p className="break-words">{m.text}</p>
                      <p className={`text-2xs mt-1 ${m.sender === 'customer' ? 'text-blue-200' : 'text-gray-400'}`}>{formatTime(m.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              {!isTerminal && (
                <div className="border-t border-gray-100 p-3 bg-white flex-shrink-0">
                  {chatError && (
                    <p className="text-xs text-red-500 mb-2 px-1">{chatError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value.slice(0, 500))}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                      placeholder="Escribe un mensaje..."
                      className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white border border-transparent focus:border-blue-200"
                      maxLength={500}
                    />
                    <button
                      onClick={handleChatSend}
                      disabled={!chatText.trim() || chatSending}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all active:scale-90 disabled:opacity-30"
                      style={{ backgroundColor: themeColor }}
                    >
                      {chatSending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : I.send('w-4 h-4')}
                    </button>
                  </div>
                </div>
              )}
              {isTerminal && (
                <div className="border-t border-gray-100 p-3 bg-gray-50 text-center">
                  <p className="text-xs text-gray-400">El chat se cerró porque el pedido finalizó</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Abajo: hablar con el negocio o volver al menú ───────── */}
        {activeTab !== 'chat' && (
          <div className="flex gap-2 px-4 pt-3 border-t border-slate-100 flex-shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
            {waNegocio && (
              <a
                href={waNegocio}
                target="_blank"
                rel="noopener noreferrer"
                className="h-12 px-4 rounded-full border-2 border-slate-200 flex items-center justify-center gap-2 text-sm font-bold text-slate-800 flex-shrink-0"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" /> Escribir
              </a>
            )}
            <button onClick={onClose} className="flex-1 h-12 rounded-full text-[15px] font-bold active:scale-[0.98] transition-transform" style={{ backgroundColor: themeColor, color: textColor }}>
              Volver al menú
            </button>
          </div>
        )}
    </div>
  );
};

export default OrderTracker;

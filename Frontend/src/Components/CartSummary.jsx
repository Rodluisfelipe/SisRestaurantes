import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from "../Context/BusinessContext";
import * as SessionManager from '../utils/sessionManager';
import CouponInput from './CouponInput';
import { logSystem } from '../utils/systemLogger';
import useCartPricing, { calculateItemTotal } from '../hooks/useCartPricing';
import { formatCurrency } from '../utils/currency';

import BusinessClosedModal from './BusinessClosedModal';
import { Gift, UtensilsCrossed, ShoppingBag, Bike } from 'lucide-react';
import api from '../services/api';
import DeliveryZoneSelector from './DeliveryZoneSelector';
import SuggestedProducts from './SuggestedProducts';
import LoyaltyWidget from './LoyaltyWidget';
import TimeSlotPicker from './TimeSlotPicker';
import LocationPicker from './Catalog/LocationPicker';

/* ── Checkout SVG Icon System (admin-style, no emojis) ── */
const CI = {
  dineIn:    (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>,
  takeaway:  (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  delivery:  (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 18L10 11h5l3.5 4.5"/><path d="M10 11L8 14.5"/><path d="M15 11l2-3.5h3.5"/></svg>,
  card:      (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
  cash:      (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>,
  bank:      (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>,
  phone:     (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>,
  copy:      (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  info:      (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  table:     (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/></svg>,
  mapPin:    (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  check:     (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>,
  cartIcon:  (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  coupon:    (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1"/></svg>,
};

// (Sin componente separado - el textarea estará directamente en el JSX)

function CartSummary({ cart, updateQuantity, removeFromCart, onClose, onOrder: onOrderProp, orderInfo, updateOrderInfo, businessConfig: propBusinessConfig, isSubmittingOrder: parentIsSubmittingOrder, subscriptionStatus, isInAppMode = false, allProducts, addToCart }) {
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [orderType, setOrderType] = useState('');
  const [tableNumber, setTableNumber] = useState(orderInfo?.tableNumber || '');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [loyaltyReward, setLoyaltyReward] = useState(null);
  const loyaltyRewardRef = useRef(null);
  const [deliveryFee, setDeliveryFee] = useState(null);
  const [deliveryZoneInfo, setDeliveryZoneInfo] = useState(null);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const backdropRef = useRef(null);
  const touchStartedOnBackdrop = useRef(false);
  const scrollContainerRef = useRef(null);
  const checkoutRef = useRef(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const scrollY = window.scrollY;
    
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.overflow = 'hidden';
    document.body.style.width = '100%';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      window.scrollTo(0, scrollY);
    };
  }, []);
  const [locationChecked, setLocationChecked] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [customerNotes, setCustomerNotes] = useState('');
  // Gift order state (delivery only)
  const [isGift, setIsGift] = useState(false);
  const [giftRecipientName, setGiftRecipientName] = useState('');
  const [giftRecipientPhone, setGiftRecipientPhone] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftHidePrices, setGiftHidePrices] = useState(true);
  const [formState, setFormState] = useState({
    tableNumber: '',
    address: ''
  });
  const deliveryAddressRef = useRef(null);

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  // { coords: { lat, lng, lon }, address: string, city: string }
  const [deliverySelectedLocation, setDeliverySelectedLocation] = useState(null);
  const [step, setStep] = useState(1);

  const [isProcessing, setIsProcessing] = useState(false);
  const { businessConfig, businessId, businessStatus, getStatusDisplay } = useBusinessConfig();
  const isHotel = businessConfig?.businessType === 'hotel';
  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const themeTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';

  // Booking state
  const [bookingSlot, setBookingSlot] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [customerEmail, setCustomerEmail] = useState('');
  const hasServices = useMemo(() => cart.some(item => item.itemType === 'service'), [cart]);
  const maxServiceDuration = useMemo(() => {
    if (!hasServices) return 0;
    return Math.max(...cart.filter(i => i.itemType === 'service').map(i => i.durationMinutes || 30));
  }, [cart, hasServices]);

  // Fetch available staff when booking is enabled with staff assignment
  useEffect(() => {
    if (hasServices && businessConfig?.enableBookings && businessConfig?.bookingSettings?.enableStaffAssignment && businessConfig?._id) {
      import('../services/api').then(({ default: api }) => {
        api.get(`/bookings/available-staff?businessId=${businessConfig._id}&forCustomer=true`)
          .then(res => setAvailableStaff(res.data || []))
          .catch(() => setAvailableStaff([]));
      });
    }
  }, [hasServices, businessConfig?.enableBookings, businessConfig?.bookingSettings?.enableStaffAssignment, businessConfig?._id]);

  // Auto-scroll to checkout section when order type changes
  const scrollToCheckout = useCallback(() => {
    setTimeout(() => {
      checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 150);
  }, []);
  
  // Check delivery coverage using map-confirmed coordinates
  const checkCoverageWithCoords = useCallback(async (lat, lon) => {
    setCheckingLocation(true);
    try {
      const orderTotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
      const response = await api.post('/delivery-zones/check-coverage', { businessId, lat, lon, orderTotal });
      const isValid = response.data.valid && response.data.coverage?.covered;
      if (isValid) {
        const { delivery, zone } = response.data.coverage;
        setDeliveryFee(delivery.price);
        setDeliveryZoneInfo({ zoneName: zone.name, estimatedTime: delivery.estimatedTime, distance: delivery.distance, coordinates: { lat, lon } });
      } else if (response.data.noZonesConfigured) {
        setDeliveryFee(0);
        setDeliveryZoneInfo({ zoneName: 'Por definir con el negocio', noZonesConfigured: true });
      } else {
        setDeliveryFee(null);
        setDeliveryZoneInfo(null);
      }
    } catch {
      setDeliveryFee(null);
      setDeliveryZoneInfo(null);
    } finally {
      setLocationChecked(true);
      setCheckingLocation(false);
    }
  }, [businessId, cart]);

  // Called when LocationPicker's GPS button is tapped
  const handleGPSRequest = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        let addr = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        let city = '';
        try {
          const res = await api.get(`/delivery-zones/reverse-geocode?lat=${lat}&lon=${lon}`);
          if (res.data?.result?.displayName) addr = res.data.result.displayName;
          city = res.data?.result?.address?.city || res.data?.result?.address?.town || '';
        } catch {}
        setDeliverySelectedLocation({ coords: { lat, lng: lon, lon }, address: addr, city });
        if (deliveryAddressRef.current) deliveryAddressRef.current.value = addr;
        checkCoverageWithCoords(lat, lon);
      },
      () => {} // GPS denied — user stays in picker
    );
  }, [checkCoverageWithCoords]);

  // Called when LocationPicker → MapPicker confirms a location
  const handleLocationSelected = useCallback((coords, addr, city) => {
    setDeliverySelectedLocation({ coords, address: addr, city });
    if (deliveryAddressRef.current) deliveryAddressRef.current.value = addr;
    setLocationChecked(false);
    setDeliveryFee(null);
    setDeliveryZoneInfo(null);
    checkCoverageWithCoords(coords.lat, coords.lon ?? coords.lng);
  }, [checkCoverageWithCoords]);

  const goToStep2 = () => {
    setStep(2);
    setTimeout(() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' }), 0);
  };
  const goToStep1 = () => {
    setStep(1);
    setTimeout(() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' }), 0);
  };

  // Determinar si el pedido viene de un QR de mesa basado en la URL
  const isFromTableQR = window.location.pathname.includes('/mesa/');
  
  // Comprobar si el usuario eligió inicialmente "En sitio" o "Para llevar" desde el QR de mesa
  // O si ya completó el modal y tiene toda la información necesaria
  const initialOrderTypeSelected = (isFromTableQR && 
    (orderInfo.orderType === 'inSite' || orderInfo.orderType === 'takeaway')) ||
    (orderInfo.orderType === 'inSite' && orderInfo.tableNumber && orderInfo.tableNumber.trim() !== '') ||
    (orderInfo.orderType === 'takeaway');

  // Calcular totales usando hook
  const { totalItems, totalAmount, finalAmount, loyaltyDiscountAmount } = useCartPricing(cart, appliedCoupon, loyaltyReward);

  // Funciones para manejar cupones
  const handleCouponApplied = (couponData) => {
    setAppliedCoupon(couponData);
  };

  const handleCouponRemoved = () => {
    setAppliedCoupon(null);
  };

  // Manejar selección de recompensa de fidelidad (aún no canjeada)
  const handleRewardSelected = (selection) => {
    setLoyaltyReward(selection);
    loyaltyRewardRef.current = selection;
  };

  // Wrap onOrder to include loyalty reward info and booking data
  const onOrder = useCallback((info, coupon) => {
    let enriched = { ...info };

    // Add booking data if cart has services and a slot is selected
    if (bookingSlot && cart.some(i => i.itemType === 'service')) {
      enriched.isBooking = true;
      enriched.bookingDate = bookingSlot.dateTime;
      if (selectedStaff) {
        enriched.staffId = selectedStaff._id;
        enriched.staffName = selectedStaff.name;
      }
      if (customerEmail.trim()) {
        enriched.customerEmail = customerEmail.trim();
      }
    }

    const selection = loyaltyRewardRef.current;
    if (selection) {
      enriched = {
        ...enriched,
        loyaltyReward: selection.reward,
        loyaltyRewardId: selection.rewardId,
        loyaltyPointsCost: selection.pointsCost
      };
    }
    onOrderProp(enriched, coupon);
  }, [onOrderProp, bookingSlot, cart, selectedStaff, customerEmail]);

  // Sincronizar tableNumber con orderInfo
  useEffect(() => {
    if (orderInfo?.tableNumber) {
      setTableNumber(orderInfo.tableNumber);
    }
  }, [orderInfo?.tableNumber]);

  // Sincronizar dirección de entrega cuando orderInfo.address cambie
  useEffect(() => {
    if (deliveryAddressRef.current && orderInfo?.address) {
      deliveryAddressRef.current.value = orderInfo.address;
    }
  }, [orderInfo?.address]);

  // Cargar dirección cuando se selecciona delivery
  useEffect(() => {
    if (orderType === 'delivery' && deliveryAddressRef.current && orderInfo?.address) {
      deliveryAddressRef.current.value = orderInfo.address;
    }
  }, [orderType, orderInfo?.address]);


  // Estado local para control de envío (sync con prop del padre)
  const [localIsSubmitting, setLocalIsSubmitting] = useState(false);
  
  // Función para determinar si está en proceso de envío (cualquier fuente)
  const isSubmitting = localIsSubmitting || parentIsSubmittingOrder;

  // Función para detectar ubicación y calcular costo de envío
  const detectLocationAndCalculateFee = async () => {
    // CRÍTICO: Capturar el valor de la dirección ANTES de cualquier setState
    const savedAddress = deliveryAddressRef.current?.value || '';
    
    // Función auxiliar para restaurar dirección de forma más robusta
    const restoreAddress = () => {
      // Usar requestAnimationFrame + setTimeout para mayor confiabilidad
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (deliveryAddressRef.current && savedAddress) {
            deliveryAddressRef.current.value = savedAddress;
          }
        }, 0);
      });
    };
    
    setCheckingLocation(true);
    restoreAddress();
    
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setCheckingLocation(false);
        setLocationChecked(true);
        setDeliveryFee(null);
        setDeliveryZoneInfo(null);
        restoreAddress();
        resolve({ fee: null, zoneInfo: null });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;

            // Calcular total del carrito
            const orderTotal = cart.reduce((sum, item) => {
              const price = item.price || 0;
              const quantity = item.quantity || 0;
              return sum + (price * quantity);
            }, 0);

            // Consultar cobertura
            const response = await api.post('/delivery-zones/check-coverage', {
              businessId,
              lat: latitude,
              lon: longitude,
              orderTotal
            });

            // La respuesta tiene: { success, valid, coverage: { covered, delivery, zone } }
            const isValid = response.data.valid && response.data.coverage?.covered;
            
            if (isValid) {
              // Cliente DENTRO de una zona: mostrar costo calculado
              const { delivery, zone } = response.data.coverage;
              const fee = delivery.price;
              const zoneInfo = {
                zoneName: zone.name,
                estimatedTime: delivery.estimatedTime,
                distance: delivery.distance,
                coordinates: { lat: latitude, lon: longitude }
              };
              setDeliveryFee(fee);
              setDeliveryZoneInfo(zoneInfo);
              setLocationChecked(true);
              setCheckingLocation(false);
              restoreAddress();
              resolve({ fee, zoneInfo });
            } else if (response.data.noZonesConfigured) {
              // Negocio sin zonas configuradas — se permite el pedido con tarifa por definir
              const zoneInfo = { zoneName: 'Por definir con el negocio', noZonesConfigured: true };
              setDeliveryFee(0);
              setDeliveryZoneInfo(zoneInfo);
              setLocationChecked(true);
              setCheckingLocation(false);
              restoreAddress();
              resolve({ fee: 0, zoneInfo });
            } else {
              // Cliente FUERA de zonas configuradas
              setDeliveryFee(null);
              setDeliveryZoneInfo(null);
              setLocationChecked(true);
              setCheckingLocation(false);
              restoreAddress();
              resolve({ fee: null, zoneInfo: null });
            }
          } catch (error) {
            setDeliveryFee(null);
            setDeliveryZoneInfo(null);
            setLocationChecked(true);
            setCheckingLocation(false);
            restoreAddress();
            resolve({ fee: null, zoneInfo: null });
          }
        },
        (error) => {
          setDeliveryFee(null);
          setDeliveryZoneInfo(null);
          setLocationChecked(true);
          setCheckingLocation(false);
          restoreAddress();
          resolve({ fee: null, zoneInfo: null });
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 0 
        }
      );
    });
  };

  // Memoizar handleInputChange para evitar recreaciones
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    
    // Solo manejamos tableNumber, address usa ref
    if (name === 'tableNumber') {
      // Filtrar solo números
      const numericValue = value.replace(/[^0-9]/g, '');
      setFormState(prev => ({
        ...prev,
        [name]: numericValue
      }));
    }
  }, []);

  const handleSubmitOrder = () => {
    // Verificar si la suscripción está suspendida
    if (subscriptionStatus === 'suspended') {
      return;
    }
    
    // Verificar si el negocio está abierto
    if (!businessStatus?.isOpen) {
      setShowClosedModal(true);
      return;
    }
    
    // Si ya hay un pedido en proceso, no permitir otro
    if (isSubmitting) {
      return;
    }
    
    try {
      logSystem(`Procesando pedido tipo: ${orderInfo.orderType}`);
      
      if (orderInfo.orderType === 'delivery') {
        // Validate gift recipient if marked as gift
        if (isGift && !giftRecipientName.trim()) {
          return;
        }

        setLocalIsSubmitting(true);
        
        const updatedOrderInfo = {
          ...orderInfo,
          orderType: 'delivery',
          paymentMethod: selectedPaymentMethod,
          customerNotes: customerNotes.trim(),
          tableNumber: '',
          ...(isGift && {
            isGift: true,
            gift: {
              recipientName: giftRecipientName.trim(),
              recipientPhone: giftRecipientPhone.trim(),
              message: giftMessage.trim(),
              hidePrices: giftHidePrices
            }
          })
        };
        
        updateOrderInfo(updatedOrderInfo);
        SessionManager.saveOrderInfo(updatedOrderInfo);
        
        setTimeout(() => {
          onOrder(updatedOrderInfo, appliedCoupon);
          setLocalIsSubmitting(false);
        }, 300);
      } else if (orderInfo.orderType === 'inSite') {
        // Verificar todas las posibles fuentes del número de mesa
        const tableFromQR = isFromTableQR && tableNumber ? tableNumber.trim() : '';
        const tableFromOrderInfo = orderInfo?.tableNumber ? orderInfo.tableNumber.trim() : '';
        const tableFromState = tableNumber ? tableNumber.trim() : '';
        const existingTable = tableFromQR || tableFromOrderInfo || tableFromState;
        
        if (!existingTable) {
          return;
        }
        
        setLocalIsSubmitting(true);
        
        const updatedOrderInfo = {
          ...orderInfo,
          orderType: 'inSite',
          tableNumber: existingTable,
          paymentMethod: selectedPaymentMethod,
          customerNotes: customerNotes.trim()
        };
        
        updateOrderInfo(updatedOrderInfo);
        SessionManager.saveOrderInfo(updatedOrderInfo);
        setTableNumber(existingTable);
        
        setTimeout(() => {
          onOrder(updatedOrderInfo, appliedCoupon);
          setTimeout(() => {
            setLocalIsSubmitting(false);
          }, 500);
        }, 100);
      } else if (orderInfo.orderType === 'takeaway') {
        setLocalIsSubmitting(true);
        
        const updatedOrderInfo = {
          ...orderInfo,
          orderType: 'takeaway',
          paymentMethod: selectedPaymentMethod,
          customerNotes: customerNotes.trim(),
          tableNumber: ''
        };
        
        updateOrderInfo(updatedOrderInfo);
        SessionManager.saveOrderInfo(updatedOrderInfo);
        
        setTimeout(() => {
          onOrder(updatedOrderInfo, appliedCoupon);
          setLocalIsSubmitting(false);
        }, 300);
      } else {
        logSystem(`Tipo de pedido no válido: ${orderInfo.orderType}`);
      }
    } catch (error) {
      logSystem(`Error al procesar el pedido: ${error.message}`);
      setLocalIsSubmitting(false);
    }
  };

  return (
    <motion.div
      ref={backdropRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-40"
      onMouseDown={(e) => { if (e.target === backdropRef.current) touchStartedOnBackdrop.current = true; }}
      onMouseUp={(e) => { if (e.target === backdropRef.current && touchStartedOnBackdrop.current) onClose(); touchStartedOnBackdrop.current = false; }}
      onTouchStart={(e) => { if (e.target === backdropRef.current) touchStartedOnBackdrop.current = true; else touchStartedOnBackdrop.current = false; }}
      onTouchEnd={(e) => { if (e.target === backdropRef.current && touchStartedOnBackdrop.current) onClose(); touchStartedOnBackdrop.current = false; }}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        className="bg-white sm:rounded-2xl rounded-t-[20px] max-w-lg w-full modal-h-full sm:modal-h-desktop shadow-2xl border border-slate-200/50 flex flex-col"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile sheet) */}
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden flex-shrink-0">
          <div className="w-10 h-[5px] rounded-full bg-slate-200" />
        </div>
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 sm:px-6 sm:py-3 flex justify-between items-center z-10 rounded-t-[20px] flex-shrink-0">
          {step === 1 ? (
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-800">Tu pedido</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>{totalItems}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <button onClick={goToStep1} className="flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors" style={{ color: themeColor }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                Atrás
              </button>
              <h2 className="text-[15px] font-bold text-slate-800">Confirmar pedido</h2>
            </div>
          )}
          {step === 1 ? (
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center" aria-label="Cerrar carrito">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          ) : (
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">2 / 2</span>
          )}
        </div>

        {/* Cart Items - Scrollable Content */}
        <div ref={scrollContainerRef} className="overflow-y-auto overscroll-contain px-4 sm:px-6 py-2 min-h-0 shrink" style={{ WebkitOverflowScrolling: 'touch' }}>
          {step === 1 && cart.map((item, itemIndex) => (
            <div key={item.uniqueId || item._id} className={`py-3 ${itemIndex < cart.length - 1 ? 'border-b border-slate-100' : ''}`}>
              <div className="flex items-start gap-3">
                {/* Product image */}
                <div className="w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/60">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      width="56"
                      height="56"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-full h-full flex items-center justify-center text-slate-300" style={{display: item.image ? 'none' : 'flex'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                </div>
                
                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-800 text-sm leading-tight truncate">{item.name}</h3>
                    {item.isLoyaltyReward && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-0.5"><Gift className="w-2.5 h-2.5" /> Gratis</span>
                    )}
                    <button
                      onClick={() => removeFromCart(item.uniqueId || item._id)}
                      className="p-1 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                      aria-label="Eliminar producto"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Toppings as compact tags */}
                  {item.selectedToppings && item.selectedToppings.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(() => {
                        const tags = [];
                        item.selectedToppings.forEach((topping, idx) => {
                          if (topping.optionName) {
                            tags.push(
                              <span key={`${item.uniqueId || item._id}-t-${idx}`} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md leading-tight">
                                {topping.optionName}{topping.price > 0 ? ` +${formatCurrency(Number(topping.price), businessConfig?.currency)}` : ''}
                              </span>
                            );
                          }
                          if (topping.subGroups) {
                            topping.subGroups.forEach((sub, subIdx) => {
                              tags.push(
                                <span key={`${item.uniqueId || item._id}-s-${idx}-${subIdx}`} className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded-md leading-tight">
                                  {sub.optionName}{sub.price > 0 ? ` +${formatCurrency(Number(sub.price), businessConfig?.currency)}` : ''}
                                </span>
                              );
                            });
                          }
                        });
                        return tags;
                      })()}
                    </div>
                  )}

                  {/* Price + quantity row */}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(calculateItemTotal(item), businessConfig?.currency)}</p>
                    <div className="flex items-center gap-0 rounded-full" style={{ backgroundColor: `${themeColor}10` }}>
                      <button
                        onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                        style={{ color: themeColor }}
                        aria-label="Disminuir cantidad"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                      </button>
                      <span className="w-6 text-center text-[13px] font-bold" style={{ color: themeColor }}>{item.quantity || 0}</span>
                      <button
                        onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                        style={{ color: themeColor }}
                        aria-label="Aumentar cantidad"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Empty cart state */}
          {cart.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-50 flex items-center justify-center">
                  {CI.cartIcon('w-7 h-7 text-slate-400')}
                </div>
                <p className="text-slate-500 text-sm mb-1">Tu carrito está vacío</p>
                <p className="text-slate-500 text-xs mb-4">Agrega productos para armar tu pedido</p>
                <button
                  onClick={onClose}
                  className="text-sm px-5 py-2.5 rounded-xl transition-colors font-medium"
                  style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                >
                  Explorar menú
                </button>
              </div>
            </div>
          )}

          {/* ── Paso 1: Upsell + Cupón + Fidelidad ── */}
          {step === 1 && cart.length > 0 && allProducts && (
            <SuggestedProducts
              allProducts={allProducts}
              cart={cart}
              onAddToCart={addToCart}
              themeColor={businessConfig?.theme?.buttonColor}
              businessId={businessId}
            />
          )}

          {step === 1 && cart.length > 0 && (
            <div ref={checkoutRef} className="mt-2 pt-2 border-t border-slate-100 space-y-2">
              {/* Coupon Input */}
              <CouponInput
                onCouponApplied={handleCouponApplied}
                onCouponRemoved={handleCouponRemoved}
                appliedCoupon={appliedCoupon}
                orderData={{
                  totalAmount,
                  orderType: orderInfo?.orderType || 'inSite',
                  items: cart
                }}
                customerId={orderInfo?.customerId}
                businessId={businessConfig?.businessId || businessConfig?._id}
                theme={businessConfig?.theme}
              />

              {/* Loyalty Widget */}
              {orderInfo?.phone && (
                <LoyaltyWidget
                  phone={orderInfo.phone}
                  businessId={businessConfig?.businessId || businessConfig?._id}
                  theme={businessConfig?.theme}
                  onRewardSelected={handleRewardSelected}
                  orderMode={orderInfo?.orderType}
                />
              )}
            </div>
          )}

          {/* ── Paso 2: Tipo, Pago, Dirección, Notas ── */}
          {step === 2 && cart.length > 0 && (
            <div ref={checkoutRef} className="space-y-3 pb-2">

              {/* ── Tipo de pedido inline ── */}
              {!initialOrderTypeSelected && !hasServices && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Tipo de pedido</p>
                  <div className={`relative p-1 rounded-2xl bg-slate-100`} style={{ display: 'grid', gridTemplateColumns: `repeat(${[
                    businessConfig?.orderTypes?.inSite !== false ? 1 : 0,
                    businessConfig?.orderTypes?.takeaway !== false ? 1 : 0,
                    !isFromTableQR && businessConfig?.orderTypes?.delivery !== false ? 1 : 0
                  ].reduce((a, b) => a + b, 0) || 1}, 1fr)` }}>
                    {[
                      ...(businessConfig?.orderTypes?.inSite !== false ? [{ id: 'inSite', label: 'En Sitio', Icon: UtensilsCrossed }] : []),
                      ...(businessConfig?.orderTypes?.takeaway !== false ? [{ id: 'takeaway', label: 'Llevar', Icon: ShoppingBag }] : []),
                      ...(!isFromTableQR && businessConfig?.orderTypes?.delivery !== false ? [{ id: 'delivery', label: 'Domicilio', Icon: Bike }] : [])
                    ].map(opt => {
                      const isActive = orderType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => { setOrderType(opt.id); setLocationChecked(false); setDeliveryFee(null); setDeliveryZoneInfo(null); setDeliverySelectedLocation(null); scrollToCheckout(); }}
                          className={`relative flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all duration-200 ${
                            isActive ? 'bg-white shadow-sm' : ''
                          }`}
                          style={{ color: isActive ? themeColor : '#64748b' }}
                        >
                          <opt.Icon className="w-3.5 h-3.5" />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Selector de horario para servicios con agenda ── */}
              {hasServices && businessConfig?.enableBookings && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Selecciona fecha y hora
                  </p>
                  <TimeSlotPicker
                    businessId={businessConfig?.businessId || businessConfig?._id}
                    businessConfig={businessConfig}
                    duration={maxServiceDuration}
                    buttonColor={themeColor}
                    buttonTextColor={themeTextColor}
                    onSelect={setBookingSlot}
                    selected={bookingSlot}
                    staffId={selectedStaff?._id}
                  />

                  {/* Staff/Professional picker */}
                  {businessConfig?.bookingSettings?.enableStaffAssignment && availableStaff.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                        Profesional (opcional)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedStaff(null)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                            !selectedStaff ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          Cualquiera
                        </button>
                        {availableStaff.map(s => (
                          <button
                            key={s._id}
                            onClick={() => setSelectedStaff(s)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                              selectedStaff?._id === s._id ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {s.profileImage ? (
                              <img src={s.profileImage} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 flex-shrink-0">
                                {(s.name || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="text-left">
                              <span className="block leading-tight">{s.name}</span>
                              {s.specialty && <span className="block text-[9px] opacity-60 leading-tight">{s.specialty}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email for booking confirmation */}
                  {bookingSlot && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                        Correo electrónico (opcional)
                      </p>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300"
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">Para recibir confirmación y recordatorios</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Dirección de entrega ── */}
              {orderType === 'delivery' && !initialOrderTypeSelected && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{CI.mapPin('w-3.5 h-3.5')}</span>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Dirección de entrega</p>
                  </div>
                  <input ref={deliveryAddressRef} type="hidden" value={deliverySelectedLocation?.address || ''} readOnly />
                  {!deliverySelectedLocation ? (
                    <button
                      type="button"
                      onClick={() => setShowLocationPicker(true)}
                      className="w-full flex items-center gap-3 p-3.5 border-2 border-dashed border-slate-200 rounded-2xl hover:border-red-300 hover:bg-red-50 transition-all group active:scale-[0.99]"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-red-100 flex items-center justify-center flex-shrink-0 transition-colors">
                        {CI.mapPin('w-5 h-5 text-slate-400 group-hover:text-red-500')}
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-[13px] font-bold text-slate-700 group-hover:text-red-600 transition-colors">Seleccionar dirección</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Escribe y ubica tu dirección en el mapa</p>
                      </div>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-red-400 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                      <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-green-800 leading-snug">{deliverySelectedLocation.address}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setDeliverySelectedLocation(null); setLocationChecked(false); setDeliveryFee(null); setDeliveryZoneInfo(null); setShowLocationPicker(true); }}
                        className="text-[11px] font-bold text-green-700 hover:text-green-900 underline underline-offset-2 flex-shrink-0"
                      >Cambiar</button>
                    </div>
                  )}
                  {deliverySelectedLocation && (
                    checkingLocation ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        <span className="text-[12px] text-slate-500">Verificando zona de entrega...</span>
                      </div>
                    ) : locationChecked ? (
                      deliveryZoneInfo?.noZonesConfigured ? (
                        <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-xl">
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-600">{CI.check('w-3.5 h-3.5')}</span>
                            <span className="text-[11px] text-amber-800 font-medium">Envío por definir con el negocio</span>
                          </div>
                          <span className="text-xs font-bold text-amber-700">A convenir</span>
                        </div>
                      ) : deliveryFee !== null && deliveryZoneInfo ? (
                        <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-xl">
                          <div className="flex items-center gap-1.5">
                            <span className="text-green-600">{CI.check('w-3.5 h-3.5')}</span>
                            <span className="text-[11px] text-green-800 font-medium">{deliveryZoneInfo.zoneName}</span>
                          </div>
                          <span className="text-xs font-bold text-green-800">{formatCurrency(deliveryFee, businessConfig?.currency)}</span>
                        </div>
                      ) : (
                        <DeliveryZoneSelector
                          businessId={businessId}
                          address={deliverySelectedLocation.address}
                          cart={cart}
                          theme={businessConfig?.theme}
                          compact
                          onZoneSelect={({ fee, zoneInfo }) => { setDeliveryFee(fee); setDeliveryZoneInfo(zoneInfo); }}
                          onRetryGPS={() => { setDeliverySelectedLocation(null); setLocationChecked(false); setDeliveryFee(null); setDeliveryZoneInfo(null); setShowLocationPicker(true); }}
                        />
                      )
                    ) : null
                  )}
                </div>
              )}

              {/* ── Método de pago ── */}
              {(initialOrderTypeSelected || orderType || (hasServices && bookingSlot)) && (() => {
                const pm = businessConfig?.paymentMethods;
                const currentMode = isInAppMode ? 'inapp' : 'whatsapp';
                const isMethodOn = (id, fallback) => {
                  if (!pm || !pm[id]) return false; // no config = not enabled
                  return pm[id].enabled && pm[id].modes?.[currentMode] !== false;
                };
                const methods = [
                  ...(isMethodOn('efectivo', true) ? [{ id: 'efectivo', label: 'Efectivo', iconKey: 'cash' }] : []),
                  ...(isMethodOn('nequi', !!businessConfig?.paymentInfo?.nequi) ? [{ id: 'nequi', label: 'Nequi', logo: 'https://cdn.prod.website-files.com/6317a229ebf7723658463b4b/663a6b0d43303ddf38035997_logo-nequi.svg' }] : []),
                  ...(isMethodOn('daviplata', !!businessConfig?.paymentInfo?.daviplata) ? [{ id: 'daviplata', label: 'Daviplata', logo: 'https://play-lh.googleusercontent.com/bNPDiFqg28L6ckatfuP-WgrxDRDk0JEOkC6nUIQp7Q61RW78i1bw-ffMmEjyxl-qP6dv3ANDOQqmIbBtgJI3EA' }] : []),
                  ...(isMethodOn('transferencia', !!businessConfig?.paymentInfo?.bankAccountNumber) ? [{ id: 'transferencia', label: 'Transferencia', iconKey: 'bank' }] : []),
                ];
                if (methods.length === 0) return null;
                return (
                  <div>
                    <div className={`flex items-center gap-2 mb-2 ${!selectedPaymentMethod ? 'text-red-500' : 'text-slate-500'}`}>
                      <span className="text-slate-400">{CI.card('w-3.5 h-3.5')}</span>
                      <p className="text-[11px] font-bold uppercase tracking-wide">
                        Método de pago{!selectedPaymentMethod && <span className="text-red-400 ml-1">*</span>}
                      </p>
                    </div>
                    <div className="grid gap-2 grid-cols-2">
                      {methods.map(m => {
                        const isSelected = selectedPaymentMethod === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedPaymentMethod(isSelected ? null : m.id)}
                            className={`flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border-2 transition-all text-center active:scale-[0.97] ${
                              isSelected ? '' : !selectedPaymentMethod ? 'border-red-100 bg-white' : 'border-slate-100 bg-white'
                            }`}
                            style={isSelected ? { borderColor: themeColor, backgroundColor: `${themeColor}08` } : undefined}
                          >
                            {m.logo ? (
                              <img src={m.logo} alt="" className="w-8 h-8 object-contain rounded-lg" />
                            ) : (
                              <span style={{ color: isSelected ? themeColor : '#94a3b8' }}>{CI[m.iconKey]('w-7 h-7')}</span>
                            )}
                            <span className="text-[12px] font-bold" style={{ color: isSelected ? themeColor : '#475569' }}>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Payment info details based on selected method */}
                    {selectedPaymentMethod && selectedPaymentMethod !== 'efectivo' && (
                      <div className="mt-3">
                        {selectedPaymentMethod === 'nequi' && businessConfig?.paymentInfo?.nequi && (
                          <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2.5 border border-green-200">
                            <div className="flex items-center gap-2">
                              <span className="text-green-600">{CI.phone('w-4 h-4')}</span>
                              <div>
                                <p className="text-xs text-gray-500">Nequi</p>
                                <p className="text-sm font-semibold text-gray-900">{businessConfig.paymentInfo.nequi}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(businessConfig.paymentInfo.nequi)}
                              className="text-green-600 hover:text-green-800 text-xs font-medium px-2 py-1 rounded hover:bg-green-100 inline-flex items-center gap-1"
                            >
                              {CI.copy('w-3 h-3')} Copiar
                            </button>
                          </div>
                        )}

                        {selectedPaymentMethod === 'daviplata' && businessConfig?.paymentInfo?.daviplata && (
                          <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2.5 border border-green-200">
                            <div className="flex items-center gap-2">
                              <span className="text-green-600">{CI.phone('w-4 h-4')}</span>
                              <div>
                                <p className="text-xs text-gray-500">Daviplata</p>
                                <p className="text-sm font-semibold text-gray-900">{businessConfig.paymentInfo.daviplata}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(businessConfig.paymentInfo.daviplata)}
                              className="text-green-600 hover:text-green-800 text-xs font-medium px-2 py-1 rounded hover:bg-green-100 inline-flex items-center gap-1"
                            >
                              {CI.copy('w-3 h-3')} Copiar
                            </button>
                          </div>
                        )}

                        {selectedPaymentMethod === 'transferencia' && businessConfig?.paymentInfo?.bankAccountNumber && (
                          <div className="bg-green-50 rounded-lg px-3 py-2.5 border border-green-200 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-green-600">{CI.bank('w-4 h-4')}</span>
                              <p className="text-xs text-gray-500">Transferencia bancaria</p>
                            </div>
                            <div className="pl-7 space-y-0.5">
                              {businessConfig.paymentInfo.bankName && (
                                <p className="text-xs text-gray-600">{businessConfig.paymentInfo.bankName} - {businessConfig.paymentInfo.bankAccountType || 'Ahorros'}</p>
                              )}
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-900">{businessConfig.paymentInfo.bankAccountNumber}</p>
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard.writeText(businessConfig.paymentInfo.bankAccountNumber)}
                                  className="text-green-600 hover:text-green-800 text-xs font-medium px-2 py-1 rounded hover:bg-green-100 inline-flex items-center gap-1"
                                >
                                  {CI.copy('w-3 h-3')} Copiar
                                </button>
                              </div>
                              {businessConfig.paymentInfo.accountHolder && (
                                <p className="text-xs text-gray-500">Titular: {businessConfig.paymentInfo.accountHolder}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {businessConfig?.paymentInfo?.instructions && (
                          <p className="text-xs text-gray-500 italic mt-2 flex items-start gap-1.5">
                            <span className="text-slate-400 flex-shrink-0 mt-0.5">{CI.info('w-3 h-3')}</span>
                            {businessConfig.paymentInfo.instructions}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Notas adicionales ── */}
              {(initialOrderTypeSelected || orderType) && (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden transition-all">
                  <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-slate-700">Comentarios del pedido</p>
                      <p className="text-[11px] text-slate-400">Sin cebolla, alergias, instrucciones especiales…</p>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Opcional</span>
                  </div>
                  <div className="px-3.5 pb-3.5">
                    <textarea
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value.slice(0, 200))}
                      placeholder="Ej: sin cebolla, alérgico al maní, tocar timbre..."
                      maxLength={200}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent resize-none transition-all"
                    />
                    {customerNotes.length > 0 && (
                      <p className="text-[10px] text-slate-400 text-right mt-1">{customerNotes.length}/200</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Campo condicional: Número de mesa ── */}
              {(orderType === 'inSite' && !initialOrderTypeSelected && !(isFromTableQR && tableNumber)) && (
                <input
                  id="inline-table-number"
                  type="number"
                  value={formState.tableNumber}
                  onChange={handleInputChange}
                  name="tableNumber"
                  className="w-full p-2 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  placeholder={isHotel ? 'Número de habitación' : 'Número de mesa'}
                  min="1"
                  max="999"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                />
              )}

              {/* ── Info mesa QR ── */}
              {isFromTableQR && tableNumber && (
                <div className="flex items-center gap-1.5 p-2 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-blue-500">{CI.table('w-3.5 h-3.5')}</span>
                  <p className="text-blue-800 font-semibold text-[11px]">{isHotel ? 'Hab.' : 'Mesa'} {tableNumber} · En sitio</p>
                </div>
              )}

              {/* ── Regalo: enviar a otra persona (solo domicilio) ── */}
              {(orderType === 'delivery' || orderInfo?.orderType === 'delivery') && (
                <div className="rounded-2xl border-2 overflow-hidden transition-all" style={{ borderColor: isGift ? themeColor : '#e2e8f0', backgroundColor: isGift ? `${themeColor}06` : '#fff' }}>
                  <button
                    type="button"
                    onClick={() => setIsGift(v => !v)}
                    className="w-full flex items-center gap-3 p-3.5 text-left transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors" style={{ backgroundColor: isGift ? `${themeColor}15` : '#f8fafc' }}>
                      <Gift className="w-5 h-5" style={{ color: isGift ? themeColor : '#94a3b8' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold transition-colors" style={{ color: isGift ? themeColor : '#374151' }}>Enviar como regalo</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{isGift ? 'Completa los datos del destinatario' : 'Toca para enviar a otra persona'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="relative inline-block w-10 h-6 rounded-full transition-colors flex-shrink-0" style={{ backgroundColor: isGift ? themeColor : '#e2e8f0' }}>
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${isGift ? 'left-[22px]' : 'left-1'}`} />
                      </span>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isGift && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2.5 px-3.5 pb-3.5">
                          <div className="h-px bg-slate-100" />
                          <p className="text-[11px] text-slate-500 leading-relaxed">El pedido se entrega en la dirección indicada arriba. Tus datos quedan como comprador.</p>
                          <input
                            type="text"
                            value={giftRecipientName}
                            onChange={(e) => setGiftRecipientName(e.target.value.slice(0, 100))}
                            placeholder="Nombre del destinatario *"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent bg-white"
                          />
                          <input
                            type="tel"
                            value={giftRecipientPhone}
                            onChange={(e) => setGiftRecipientPhone(e.target.value.slice(0, 30))}
                            placeholder="Teléfono del destinatario (opcional)"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent bg-white"
                          />
                          <textarea
                            value={giftMessage}
                            onChange={(e) => setGiftMessage(e.target.value.slice(0, 300))}
                            placeholder="Mensaje de regalo (ej: ¡Feliz cumpleaños! 🎉)"
                            rows={2}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent bg-white resize-none"
                          />
                          <label className="flex items-center gap-2.5 text-[12px] text-slate-600 cursor-pointer select-none">
                            <input type="checkbox" checked={giftHidePrices} onChange={(e) => setGiftHidePrices(e.target.checked)} className="rounded w-4 h-4 accent-slate-600" />
                            Ocultar precios al destinatario
                          </label>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Paso 1: Footer simple con Subtotal + Continuar ── */}
        {step === 1 && cart.length > 0 && (
          <div className="border-t border-slate-200 bg-white px-4 pt-3 sm:px-6 flex-shrink-0 sm:rounded-b-2xl" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))' }}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-500">Subtotal</span>
              <span className="text-2xl font-extrabold text-slate-900">{formatCurrency(totalAmount, businessConfig?.currency)}</span>
            </div>
            <button
              onClick={goToStep2}
              style={{ backgroundColor: themeColor, color: themeTextColor, boxShadow: `0 8px 24px ${themeColor}40` }}
              className="w-full py-4 rounded-full font-bold flex items-center justify-center gap-3 text-[15px] active:scale-[0.97] transition-all duration-200"
            >
              <span>Continuar</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              <span className="w-px h-5 bg-current opacity-20" />
              <span className="font-extrabold tabular-nums">{formatCurrency(totalAmount, businessConfig?.currency)}</span>
            </button>
          </div>
        )}

        {/* ── Paso 2: Footer completo con desglose + Confirmar ── */}
        {step === 2 && cart.length > 0 && (
          <div
            className="border-t border-slate-200 bg-white px-4 pt-3 sm:px-6 flex-shrink-0 sm:rounded-b-2xl"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))' }}
          >
            {/* Price breakdown when there are extras */}
            {(deliveryFee > 0 || deliveryZoneInfo?.noZonesConfigured || appliedCoupon) && (
              <div className="space-y-1 mb-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(totalAmount, businessConfig?.currency)}</span>
                </div>
                {deliveryZoneInfo?.noZonesConfigured ? (
                  <div className="flex justify-between text-xs text-amber-600">
                    <span>Envío</span>
                    <span className="font-medium">A convenir</span>
                  </div>
                ) : deliveryFee > 0 && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Envío</span>
                    <span>{loyaltyReward?.reward?.type === 'free_delivery' ? <span className="line-through">{formatCurrency(deliveryFee, businessConfig?.currency)}</span> : formatCurrency(deliveryFee, businessConfig?.currency)}</span>
                  </div>
                )}
                {loyaltyReward?.reward?.type === 'free_delivery' && deliveryFee > 0 && (
                  <div className="flex justify-between text-xs text-amber-500">
                    <span className="inline-flex items-center gap-1"><Gift className="w-3 h-3" /> Envío gratis</span>
                    <span>-{formatCurrency(deliveryFee, businessConfig?.currency)}</span>
                  </div>
                )}
                {appliedCoupon && (
                  <div className="flex justify-between text-xs text-green-500">
                    <span>Descuento cupón</span>
                    <span>-{formatCurrency(appliedCoupon.discountAmount, businessConfig?.currency)}</span>
                  </div>
                )}
                {loyaltyDiscountAmount > 0 && (
                  <div className="flex justify-between text-xs text-amber-500">
                    <span className="inline-flex items-center gap-1"><Gift className="w-3 h-3" /> {loyaltyReward.reward.name}</span>
                    <span>-{formatCurrency(loyaltyDiscountAmount, businessConfig?.currency)}</span>
                  </div>
                )}
                <div className="border-t border-dashed border-slate-200" />
              </div>
            )}

            {/* Total row — prominent */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-500">{deliveryZoneInfo?.noZonesConfigured ? 'Subtotal' : 'Total'}</span>
              <div className="flex items-baseline gap-2">
                {(appliedCoupon || loyaltyDiscountAmount > 0 || loyaltyReward?.reward?.type === 'free_delivery') && (
                  <span className="text-xs line-through text-slate-300">{formatCurrency((deliveryFee || 0) + totalAmount, businessConfig?.currency)}</span>
                )}
                <span className="text-2xl font-extrabold text-slate-900">
                  {formatCurrency(finalAmount + ((loyaltyReward?.reward?.type === 'free_delivery' ? 0 : deliveryFee) || 0), businessConfig?.currency)}
                </span>
              </div>
            </div>

            {/* Confirm button */}
            {(() => {
              const hasSelectedType = initialOrderTypeSelected || orderType || (hasServices && bookingSlot);
              const isDeliveryWithoutCheck = orderType === 'delivery' && !initialOrderTypeSelected && !locationChecked;
              const showButton = hasSelectedType && !isDeliveryWithoutCheck;
              // Revisa si hay métodos de pago disponibles para decidir si es obligatorio
              const pmCfg = businessConfig?.paymentMethods;
              const curMode = isInAppMode ? 'inapp' : 'whatsapp';
              const anyPaymentAvailable = ['efectivo','nequi','daviplata','transferencia'].some(id => {
                if (!pmCfg || !pmCfg[id]) return false;
                return pmCfg[id].enabled && pmCfg[id].modes?.[curMode] !== false;
              });
              const needsPayment = anyPaymentAvailable && !selectedPaymentMethod;
              // Delivery requires zone selection when GPS fails
              const isDeliveryWithoutZone = orderType === 'delivery' && !initialOrderTypeSelected && locationChecked && !deliveryZoneInfo;
              // Booking requires slot when cart has services
              const needsBookingSlot = hasServices && businessConfig?.enableBookings && !bookingSlot;
              // Pedido mínimo (sobre el subtotal de productos, sin domicilio)
              const minOrder = Number(businessConfig?.minOrderAmount) || 0;
              const belowMin = minOrder > 0 && totalAmount < minOrder;
              const minShortfall = Math.max(minOrder - totalAmount, 0);
              const isDisabled = isSubmitting || !businessStatus?.isOpen || subscriptionStatus === 'suspended' || needsPayment || isDeliveryWithoutZone || needsBookingSlot || belowMin;

              if (!showButton) return null;

              // Helper to enrich orderInfo with booking data
              const withBookingData = (info) => {
                if (hasServices && bookingSlot) {
                  const data = { ...info, isBooking: true, bookingDate: bookingSlot.dateTime };
                  if (selectedStaff) {
                    data.staffId = selectedStaff._id;
                    data.staffName = selectedStaff.name;
                  }
                  return data;
                }
                return info;
              };

              const handleConfirmClick = () => {
                if (isDisabled) return;
                
                if (anyPaymentAvailable && !selectedPaymentMethod) {
                  alert('Por favor selecciona un método de pago');
                  return;
                }
                
                if (isDeliveryWithoutZone) {
                  alert('Por favor selecciona tu zona de entrega para continuar');
                  return;
                }

                if (needsBookingSlot) {
                  alert('Por favor selecciona fecha y hora para tu cita');
                  return;
                }

                const submitWith = (extraFields) => {
                  setLocalIsSubmitting(true);
                  const updatedOrderInfo = withBookingData({ ...orderInfo, paymentMethod: selectedPaymentMethod, customerNotes: customerNotes.trim(), ...extraFields });
                  updateOrderInfo(updatedOrderInfo);
                  SessionManager.saveOrderInfo(updatedOrderInfo);
                  setTimeout(() => { onOrder(updatedOrderInfo, appliedCoupon); setTimeout(() => setLocalIsSubmitting(false), 500); }, 150);
                };

                // For services without explicit order type, default to inSite
                if (hasServices && !initialOrderTypeSelected && !orderType) {
                  submitWith({ orderType: 'inSite', tableNumber: '' });
                  return;
                }
                
                if (initialOrderTypeSelected) {
                  handleSubmitOrder();
                } else if (orderType === 'inSite') {
                  const trimmedTable = formState.tableNumber.trim();
                  if (!trimmedTable && !(isFromTableQR && tableNumber)) {
                    alert('Por favor ingresa el número de mesa');
                    return;
                  }
                  submitWith({ orderType: 'inSite', tableNumber: trimmedTable || tableNumber });
                } else if (orderType === 'takeaway') {
                  submitWith({ orderType: 'takeaway', tableNumber: '' });
                } else if (orderType === 'delivery') {
                  const trimmedAddress = deliverySelectedLocation?.address || (deliveryAddressRef.current?.value || '').trim();
                  if (!trimmedAddress) { alert('Por favor selecciona tu dirección de entrega'); return; }
                  if (isGift && !giftRecipientName.trim()) { alert('Ingresa el nombre del destinatario del regalo'); return; }
                  const coords = deliverySelectedLocation?.coords;
                  submitWith({
                    orderType: 'delivery', address: trimmedAddress, tableNumber: '',
                    deliveryFee: deliveryFee ?? null, deliveryZoneName: deliveryZoneInfo?.zoneName || null,
                    deliveryZoneInfo: deliveryZoneInfo || null, deliveryCalculated: true, deliveryNeedsConfirmation: !deliveryFee,
                    ...(coords && { deliveryCoordinates: { lat: coords.lat, lon: coords.lon ?? coords.lng } }),
                    ...(isGift && {
                      isGift: true,
                      gift: {
                        recipientName: giftRecipientName.trim(),
                        recipientPhone: giftRecipientPhone.trim(),
                        message: giftMessage.trim(),
                        hidePrices: giftHidePrices
                      }
                    })
                  });
                }
              };

              let buttonLabel = 'Confirmar Pedido';
              if (belowMin) buttonLabel = `Te faltan ${formatCurrency(minShortfall, businessConfig?.currency)}`;
              else if (hasServices && bookingSlot) buttonLabel = 'Confirmar Cita';
              else if (initialOrderTypeSelected && orderInfo.orderType === 'inSite') buttonLabel = `Confirmar · Mesa ${tableNumber}`;
              else if (initialOrderTypeSelected && orderInfo.orderType === 'takeaway') buttonLabel = 'Confirmar · Para Llevar';
              else if (orderType === 'inSite') buttonLabel = `Confirmar · Mesa${formState.tableNumber ? ` ${formState.tableNumber}` : ''}`;
              else if (orderType === 'takeaway') buttonLabel = 'Confirmar · Para Llevar';
              else if (orderType === 'delivery') buttonLabel = isDeliveryWithoutZone ? 'Selecciona una zona' : 'Confirmar · Domicilio';

              const displayTotal = (finalAmount + ((loyaltyReward?.reward?.type === 'free_delivery' ? 0 : deliveryFee) || 0));

              return (
                <>
                {belowMin && (
                  <div className="mb-3 flex items-center gap-2 rounded-2xl px-4 py-3 bg-amber-50 border border-amber-200">
                    <svg className="w-5 h-5 text-amber-500 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
                    <p className="text-[13px] font-semibold text-amber-800">
                      El pedido mínimo es {formatCurrency(minOrder, businessConfig?.currency)}. Agrega {formatCurrency(minShortfall, businessConfig?.currency)} más para continuar.
                    </p>
                  </div>
                )}
                <button
                  onClick={handleConfirmClick}
                  style={{ 
                    backgroundColor: isDisabled ? '#cbd5e1' : themeColor,
                    color: themeTextColor,
                    boxShadow: isDisabled ? undefined : `0 8px 24px ${themeColor}40`
                  }}
                  className={`w-full py-4 rounded-full font-bold flex items-center justify-center gap-3 text-[15px] transition-all duration-200 ${
                    isDisabled ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.97]'
                  }`}
                  disabled={isDisabled}
                >
                  {isSubmitting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <span>{buttonLabel}</span>
                      <span className="w-px h-5 bg-current opacity-20" />
                      <span className="font-extrabold tabular-nums">{formatCurrency(displayTotal, businessConfig?.currency)}</span>
                    </>
                  )}
                </button>
                </>
              );
            })()}
          </div>
        )}
        </motion.div>
        
      {/* Modal de negocio cerrado */}
      <BusinessClosedModal
        isOpen={showClosedModal}
        onClose={() => setShowClosedModal(false)}
        businessStatus={businessStatus}
      />

      {/* Location picker — opens above the cart modal */}
      <LocationPicker
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={handleLocationSelected}
        currentAddress={deliverySelectedLocation?.address}
        currentCoords={deliverySelectedLocation?.coords}
      />
    </motion.div>
  );
}

export default CartSummary; 
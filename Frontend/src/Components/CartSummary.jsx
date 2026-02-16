import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useBusinessConfig } from "../Context/BusinessContext";
import * as SessionManager from '../utils/sessionManager';
import CouponInput from './CouponInput';
import { logSystem } from '../utils/systemLogger';
import { useBusinessStatus } from '../hooks/useBusinessStatus';
import BusinessClosedModal from './BusinessClosedModal';
import api from '../services/api';

// (Sin componente separado - el textarea estará directamente en el JSX)

function CartSummary({ cart, updateQuantity, removeFromCart, onClose, onOrder, orderInfo, updateOrderInfo, businessConfig: propBusinessConfig, isSubmittingOrder: parentIsSubmittingOrder, subscriptionStatus, isInAppMode = false }) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [orderType, setOrderType] = useState('');
  const [tableNumber, setTableNumber] = useState(orderInfo?.tableNumber || '');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
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
  const [formState, setFormState] = useState({
    tableNumber: '',
    address: ''
  });
  const deliveryAddressRef = useRef(null);

  // Auto-scroll to checkout section when order type changes
  const scrollToCheckout = useCallback(() => {
    setTimeout(() => {
      checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 150);
  }, []);
  const [isProcessing, setIsProcessing] = useState(false);
  const { businessConfig, businessId } = useBusinessConfig();
  const { businessStatus, getStatusDisplay } = useBusinessStatus(businessId);
  
  // Determinar si el pedido viene de un QR de mesa basado en la URL
  const isFromTableQR = window.location.pathname.includes('/mesa/');
  
  // Comprobar si el usuario eligió inicialmente "En sitio" o "Para llevar" desde el QR de mesa
  // O si ya completó el modal y tiene toda la información necesaria
  const initialOrderTypeSelected = (isFromTableQR && 
    (orderInfo.orderType === 'inSite' || orderInfo.orderType === 'takeaway')) ||
    (orderInfo.orderType === 'inSite' && orderInfo.tableNumber && orderInfo.tableNumber.trim() !== '') ||
    (orderInfo.orderType === 'takeaway');

  // Calcular totales correctamente
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalAmount = cart.reduce((sum, item) => {
    // Obtener el precio base del producto
    const itemPrice = parseFloat(item.finalPrice || item.price || 0);
    const quantity = parseInt(item.quantity || 0);
    
    // Calcular el precio total con toppings
    let toppingPriceSum = 0;
    
    // Sumar el precio de los toppings si existen
    if (item.selectedToppings && item.selectedToppings.length > 0) {
      toppingPriceSum = item.selectedToppings.reduce((toppingSum, topping) => {
        // Sumar el precio base del grupo de toppings si existe
        let toppingGroupPrice = parseFloat(topping.basePrice || 0);
        
        // Sumar el precio de la opción seleccionada si existe
        toppingGroupPrice += parseFloat(topping.price || 0);
        
        // Sumar precios de los subgrupos si existen
        if (topping.subGroups && topping.subGroups.length > 0) {
          const subGroupsPrice = topping.subGroups.reduce(
            (subSum, subItem) => subSum + parseFloat(subItem.price || 0),
            0
          );
          toppingGroupPrice += subGroupsPrice;
        }
        
        return toppingSum + toppingGroupPrice;
      }, 0);
    }
    
    // Precio total por item: precio base + toppings, multiplicado por la cantidad
    const totalItemPrice = (itemPrice + toppingPriceSum) * quantity;
    return sum + totalItemPrice;
  }, 0);

  // Calcular total final con descuento de cupón
  const finalAmount = appliedCoupon ? appliedCoupon.finalAmount : totalAmount;

  // Funciones para manejar cupones
  const handleCouponApplied = (couponData) => {
    setAppliedCoupon(couponData);
  };

  const handleCouponRemoved = () => {
    setAppliedCoupon(null);
  };

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
      console.log('📝 Dirección sincronizada desde orderInfo:', orderInfo.address);
    }
  }, [orderInfo?.address]);

  // Cargar dirección cuando se selecciona delivery
  useEffect(() => {
    if (orderType === 'delivery' && deliveryAddressRef.current && orderInfo?.address) {
      deliveryAddressRef.current.value = orderInfo.address;
      console.log('📝 Dirección cargada al seleccionar delivery:', orderInfo.address);
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
    console.log('🔒 Guardando dirección antes de verificar:', savedAddress);
    
    // Función auxiliar para restaurar dirección de forma más robusta
    const restoreAddress = () => {
      // Usar requestAnimationFrame + setTimeout para mayor confiabilidad
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (deliveryAddressRef.current && savedAddress) {
            deliveryAddressRef.current.value = savedAddress;
            console.log('✅ Dirección restaurada:', savedAddress);
          }
        }, 0);
      });
    };
    
    setCheckingLocation(true);
    restoreAddress();
    
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.log('ℹ️ Navegador no soporta geolocalización.');
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
            console.log('📍 Ubicación detectada:', { lat: latitude, lon: longitude });

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

            console.log('✅ Respuesta de cobertura:', response.data);

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
              console.log('✅ Costo de envío calculado:', fee, '- Zona:', zone.name);
              resolve({ fee, zoneInfo });
            } else {
              // Cliente FUERA de zonas
              setDeliveryFee(null);
              setDeliveryZoneInfo(null);
              setLocationChecked(true);
              setCheckingLocation(false);
              restoreAddress();
              console.log('ℹ️ Cliente fuera de zonas delimitadas.');
              resolve({ fee: null, zoneInfo: null });
            }
          } catch (error) {
            console.error('❌ Error al verificar cobertura:', error);
            setDeliveryFee(null);
            setDeliveryZoneInfo(null);
            setLocationChecked(true);
            setCheckingLocation(false);
            restoreAddress();
            resolve({ fee: null, zoneInfo: null });
          }
        },
        (error) => {
          console.error('❌ Error de geolocalización:', error);
          console.log('ℹ️ No se pudo obtener ubicación. Costo será confirmado manualmente.');
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

  const handleDeliverySubmit = (e) => {
    // Prevent default form submission if called from a form
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    // Prevent multiple submissions
    if (isSubmitting) return;
    setLocalIsSubmitting(true);
    
    // Trim input values to check if they're empty after whitespace removal
    const trimmedPhone = deliveryInfo.phone.trim();
    const trimmedAddress = deliveryInfo.address.trim();
    
    if (!trimmedPhone || !trimmedAddress) {
      alert('Por favor completa todos los campos');
      setLocalIsSubmitting(false);
      return;
    }
    
    const updatedOrderInfo = {
      ...orderInfo,
      orderType: 'delivery',
      phone: trimmedPhone,
      address: trimmedAddress,
      customerName: orderInfo.customerName,
      // Eliminar explícitamente el número de mesa para pedidos a domicilio
      tableNumber: ''
    };
    
    // Update order info using the new function
    updateOrderInfo(updatedOrderInfo);
    SessionManager.saveOrderInfo(updatedOrderInfo);
    
    // Verificar si la suscripción está suspendida
    if (subscriptionStatus === 'suspended') {
      setLocalIsSubmitting(false);
      return;
    }
    
    closeOrderModal();
    
    // Small delay to ensure state is fully updated before order submission
    setTimeout(() => {
      onOrder(updatedOrderInfo, appliedCoupon);
      setLocalIsSubmitting(false);
    }, 300);
  };

  // Update input handlers to use functional state updates to prevent stale state issues
  const handleTableSubmit = () => {
    // Verificar si la suscripción está suspendida
    if (subscriptionStatus === 'suspended') {
      setLocalIsSubmitting(false);
      return;
    }
    
    // Debug para ver el estado actual
    debugInputState();
    
    // Validar que el número de mesa no esté vacío
    const trimmedTableNumber = (tableNumber || '').trim();
    if (!trimmedTableNumber) {
      alert('Por favor ingresa el número de mesa');
      setLocalIsSubmitting(false);
      return;
    }
    
    // Crear la información actualizada del pedido usando el valor más reciente
    const updatedOrderInfo = {
      ...orderInfo,
      orderType: 'inSite',
      tableNumber: trimmedTableNumber
    };
    
    console.log('Enviando información de pedido en sitio:', updatedOrderInfo);
    
    // Actualizar la información del pedido
    updateOrderInfo(updatedOrderInfo);
    
    // IMPORTANTE: Para modo normal, usar SessionManager para asegurar que se maneje correctamente
    // (en modo normal, SessionManager eliminará el tableNumber del almacenamiento)
    SessionManager.saveOrderInfo(updatedOrderInfo);
    
    // Primero cerrar el modal
    closeOrderModal();
    
    // Enviar el pedido directamente
    console.log('Enviando pedido inmediatamente con mesa:', updatedOrderInfo.tableNumber);
    onOrder(updatedOrderInfo, appliedCoupon);
    setLocalIsSubmitting(false);
  };
  
  // Función para enviar directamente cuando ya se seleccionó un tipo de pedido desde QR de mesa
  const handleDirectSubmit = () => {
    // Verificar si la suscripción está suspendida
    if (subscriptionStatus === 'suspended') {
      setLocalIsSubmitting(false);
      return;
    }
    
    // Si viene de QR mesa y ya eligió En Sitio o Para llevar, usamos esa información
    try {
      console.log('Enviando pedido directo desde QR con tipo:', orderInfo.orderType);
      
      // Crear copia para no modificar el estado original directamente
      const updatedOrderInfo = { ...orderInfo };
      
      // Si es takeaway, asegurarse de que no tenga número de mesa
      if (updatedOrderInfo.orderType === 'takeaway') {
        updatedOrderInfo.tableNumber = '';
        console.log('Enviando como para llevar, eliminando número de mesa');
      }
      // Si es inSite, verificar que tenga número de mesa
      else if (updatedOrderInfo.orderType === 'inSite') {
        // Si no tiene mesa y es QR, usar la mesa de la URL
        if (!updatedOrderInfo.tableNumber && isFromTableQR) {
          const tableMatch = window.location.pathname.match(/\/mesa\/(\w+)/);
          if (tableMatch && tableMatch[1]) {
            updatedOrderInfo.tableNumber = tableMatch[1];
            console.log('Usando número de mesa de URL:', updatedOrderInfo.tableNumber);
          }
        }
      }
      
      // Actualizar la información del pedido
    updateOrderInfo(updatedOrderInfo);
      
      // Guardar usando SessionManager para manejar correctamente según el modo
      SessionManager.saveOrderInfo(updatedOrderInfo);
      
      // Pequeño retraso para asegurar que el estado se actualice
      setTimeout(() => {
        console.log('Enviando pedido con información:', updatedOrderInfo);
    onOrder(updatedOrderInfo, appliedCoupon);
        
        // Asegurar que el estado de envío se resetee después de completar
        setTimeout(() => {
          console.log('Reseteando estado de envío después de DirectSubmit');
          setLocalIsSubmitting(false);
        }, 500);
      }, 300);
    } catch (error) {
      console.error('Error al enviar pedido directo:', error);
      alert('Error al procesar el pedido. Inténtalo de nuevo.');
      setLocalIsSubmitting(false);
    }
  };

  const openOrderModal = (type) => {
    console.log(`*** ABRIENDO MODAL DE TIPO ${type.toUpperCase()} ***`);
    console.log('showOrderModal antes:', showOrderModal);
    setOrderType(type);
    
    // Verificar si hay un número de mesa existente para inicializar
    let updatedTableNumber = '';
    if (type === 'inSite') {
      // Buscar en todas las fuentes posibles
      if (isFromTableQR && tableNumber) {
        updatedTableNumber = tableNumber;
        console.log('Usando mesa de QR para inicializar modal:', updatedTableNumber);
      } else if (orderInfo?.tableNumber && orderInfo.tableNumber.trim() !== '') {
        updatedTableNumber = orderInfo.tableNumber;
        console.log('Usando mesa de orderInfo para inicializar modal:', updatedTableNumber);
      } else if (tableNumber && tableNumber.trim() !== '') {
        updatedTableNumber = tableNumber;
        console.log('Usando mesa de estado local para inicializar modal:', updatedTableNumber);
      }
    }
    
    // Actualizar el tipo de pedido en orderInfo inmediatamente
    const updatedOrderInfo = {
      ...orderInfo,
      orderType: type,
      // Si el tipo es takeaway o delivery, eliminar el número de mesa
      // Si es inSite y tenemos un número, usarlo
      ...(type === 'inSite' && updatedTableNumber ? { tableNumber: updatedTableNumber } : {}),
      ...(type !== 'inSite' && { tableNumber: '' })
    };
    
    // Actualizar la información del pedido
    console.log('Actualizando orderInfo con tipo:', type, 'y mesa:', updatedOrderInfo.tableNumber || 'ninguna');
    updateOrderInfo(updatedOrderInfo);
    
    // Activar el modal
    setShowOrderModal(true);
    console.log('showOrderModal después:', true);
    document.body.classList.add('modal-open'); // Prevenir scroll en el body
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    document.body.classList.remove('modal-open');
    // Resetear estados de verificación
    setLocationChecked(false);
    setCheckingLocation(false);
    setDeliveryFee(null);
    setDeliveryZoneInfo(null);
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

  // Renderizar el modal de forma condicional
  const OrderFormModal = () => {
    if (!showOrderModal) return null;

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      console.log('Modal handleSubmit ejecutado - orderType:', orderType);
      console.log('Modal handleSubmit ejecutado - formState:', formState);
      
      if (isProcessing || isSubmitting) {
        logSystem("Proceso de pedido ya en curso, ignorando solicitud", 'warning');
        return;
      }

      if (orderType === 'inSite') {
        const trimmedTableNumber = formState.tableNumber.trim();
        
        console.log('Validando número de mesa:', trimmedTableNumber);
        
        if (!trimmedTableNumber) {
          alert('Por favor ingresa el número de mesa');
          console.log('Número de mesa vacío, mostrando alert');
          return;
        }

        setIsProcessing(true);
        setLocalIsSubmitting(true);

        try {
          const updatedOrderInfo = {
            ...orderInfo,
            orderType: 'inSite',
            tableNumber: trimmedTableNumber,
            // Mantener el teléfono que ya tenemos desde el inicio
            phone: orderInfo.phone
          };

          logSystem(`Pedido en sitio procesado - Mesa: ${trimmedTableNumber}, Cliente: ${orderInfo.customerName}`);
          
          updateOrderInfo(updatedOrderInfo);
          SessionManager.saveOrderInfo(updatedOrderInfo);
          closeOrderModal();
          onOrder(updatedOrderInfo, appliedCoupon);
        } catch (error) {
          logSystem(`Error al procesar pedido: ${error.message}`, 'error');
          alert('Hubo un error al procesar el pedido. Por favor intenta nuevamente.');
        } finally {
          setIsProcessing(false);
          setLocalIsSubmitting(false);
        }
      } else if (orderType === 'delivery') {
        const trimmedAddress = (deliveryAddressRef.current?.value || '').trim();

        if (!trimmedAddress) {
          alert('Por favor ingresa la dirección de entrega');
          return;
        }

        setIsProcessing(true);
        setLocalIsSubmitting(true);

        try {
          // Usar los valores ya verificados
          const finalFee = deliveryFee;
          const finalZoneInfo = deliveryZoneInfo;

          const updatedOrderInfo = {
            ...orderInfo,
            orderType: 'delivery',
            // Mantener el teléfono que ya tenemos desde el inicio
            phone: orderInfo.phone,
            address: trimmedAddress,
            // Información de entrega y zona
            deliveryFee: finalFee || null,
            deliveryZoneName: finalZoneInfo?.zoneName || null,
            deliveryZoneInfo: finalZoneInfo || null,
            deliveryCalculated: true,
            deliveryNeedsConfirmation: !finalFee // true si no hay costo automático
          };

          console.log('📦 Datos de entrega incluidos en pedido:', {
            deliveryFee: finalFee,
            zoneName: finalZoneInfo?.zoneName,
            calculated: true,
            needsConfirmation: !finalFee
          });

          updateOrderInfo(updatedOrderInfo);
          SessionManager.saveOrderInfo(updatedOrderInfo);
          closeOrderModal();
          onOrder(updatedOrderInfo, appliedCoupon);
        } catch (error) {
          logSystem(`Error al procesar pedido: ${error.message}`, 'error');
          alert('Hubo un error al procesar el pedido. Por favor intenta nuevamente.');
        } finally {
          setIsProcessing(false);
          setLocalIsSubmitting(false);
        }
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-bold text-gray-800">
              {orderType === 'inSite' ? 'Pedido en sitio' : 'Pedido a domicilio'}
            </h3>
            <button
              onClick={closeOrderModal}
              className="text-gray-500 hover:text-gray-700"
              disabled={isProcessing}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {orderType === 'inSite' && (
              <div>
                <label htmlFor="table-number" className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Mesa
                </label>
                <input
                  id="table-number"
                  type="number"
                  name="tableNumber"
                  value={formState.tableNumber}
                  onChange={handleInputChange}
                  className="w-full p-3 border rounded-md text-gray-800 placeholder-gray-500"
                  placeholder="Ej: 5"
                  min="1"
                  max="999"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  autoFocus
                  autoComplete="off"
                />
              </div>
            )}
            
            {orderType === 'delivery' && (
              <>
                <div>
                  <label htmlFor="delivery-address" className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección de Entrega
                  </label>
                  <textarea
                    ref={deliveryAddressRef}
                    id="delivery-address"
                    name="address"
                    defaultValue={orderInfo?.address || ''}
                    className="w-full p-3 border rounded-md text-gray-800 placeholder-gray-500"
                    placeholder="Ej: Calle 123 #45-67, Barrio Centro, Apartamento 201"
                    rows="3"
                    required
                    autoComplete="street-address"
                  />
                </div>

                {/* Botón para verificar costo de domicilio */}
                {!locationChecked && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={detectLocationAndCalculateFee}
                      disabled={checkingLocation}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium disabled:bg-gray-400"
                    >
                      {checkingLocation ? (
                        <>
                          <span className="animate-spin">🔄</span>
                          Verificando ubicación...
                        </>
                      ) : (
                        <>
                          📍 Verificar costo de domicilio
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-600 mt-2 text-center">
                      Necesitaremos tu ubicación GPS para calcular el costo de envío
                    </p>
                  </div>
                )}

                {/* Mostrar resultado de la verificación */}
                {locationChecked && (
                  <>
                    {deliveryFee && deliveryZoneInfo ? (
                      <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">✅</span>
                            <div>
                              <p className="font-semibold text-green-800">Costo de envío</p>
                              <p className="text-xs text-green-700">Zona: {deliveryZoneInfo.zoneName}</p>
                            </div>
                          </div>
                          <span className="text-xl font-bold text-green-800">${deliveryFee.toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-sm text-amber-900 font-semibold">
                              Costo de envío por confirmar
                            </p>
                            <p className="text-xs text-amber-700 mt-1">
                              Tu ubicación está fuera de nuestras zonas automáticas. Te confirmaremos el costo al recibir tu pedido.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Avisos informativos */}
                <div className="space-y-3 mt-4">

                  {isInAppMode ? (
                    /* Info de pago para modo in-app */
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💳</span>
                        <p className="text-sm text-blue-900 font-semibold">Medios de pago disponibles</p>
                      </div>
                      <p className="text-xs text-blue-700">Realiza tu pago y luego sube el comprobante desde el seguimiento del pedido.</p>
                      
                      {businessConfig?.paymentInfo?.nequi && (
                        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-100">
                          <div className="flex items-center gap-2">
                            <span className="text-base">📱</span>
                            <div>
                              <p className="text-xs text-gray-500">Nequi</p>
                              <p className="text-sm font-semibold text-gray-900">{businessConfig.paymentInfo.nequi}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(businessConfig.paymentInfo.nequi);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50"
                          >
                            Copiar
                          </button>
                        </div>
                      )}
                      
                      {businessConfig?.paymentInfo?.daviplata && (
                        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-100">
                          <div className="flex items-center gap-2">
                            <span className="text-base">📲</span>
                            <div>
                              <p className="text-xs text-gray-500">Daviplata</p>
                              <p className="text-sm font-semibold text-gray-900">{businessConfig.paymentInfo.daviplata}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(businessConfig.paymentInfo.daviplata);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50"
                          >
                            Copiar
                          </button>
                        </div>
                      )}
                      
                      {businessConfig?.paymentInfo?.bankAccountNumber && (
                        <div className="bg-white rounded-lg px-3 py-2 border border-blue-100 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🏦</span>
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
                                onClick={() => {
                                  navigator.clipboard.writeText(businessConfig.paymentInfo.bankAccountNumber);
                                }}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50"
                              >
                                Copiar
                              </button>
                            </div>
                            {businessConfig.paymentInfo.accountHolder && (
                              <p className="text-xs text-gray-500">Titular: {businessConfig.paymentInfo.accountHolder}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {businessConfig?.paymentInfo?.instructions && (
                        <p className="text-xs text-blue-700 italic">💡 {businessConfig.paymentInfo.instructions}</p>
                      )}
                    </div>
                  ) : (
                    /* Aviso de WhatsApp */
                    <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-300 rounded-lg">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      <div>
                        <p className="text-sm text-green-900 font-semibold">
                          📱 Importante: Envía tu pedido por WhatsApp
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          Al confirmar, se abrirá WhatsApp con tu pedido listo para enviar
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Botón de confirmar solo se muestra si no es delivery O si ya se verificó la ubicación */}
            {(orderType !== 'delivery' || locationChecked) && (
              <button
                type="submit"
                style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                className="w-full py-3 px-4 rounded-md transition-colors duration-300 font-medium shadow-sm hover:shadow"
                disabled={isProcessing || isSubmitting}
              >
                {isProcessing || isSubmitting ? (
                  <>
                    <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    Procesando...
                  </>
                ) : (
                  orderType === 'inSite' ? 'Confirmar Mesa' : 'Confirmar Pedido'
                )}
              </button>
            )}
          </form>
        </div>
      </div>
    );
  };

  // Función para calcular el precio total de un item (incluyendo toppings)
  const calculateItemTotal = (item) => {
    // Precio base del producto
    const basePrice = parseFloat(item.finalPrice || item.price || 0);
    const quantity = parseInt(item.quantity || 0);
    
    // Calcular el precio de los toppings
    let toppingPriceSum = 0;
    
    if (item.selectedToppings && item.selectedToppings.length > 0) {
      toppingPriceSum = item.selectedToppings.reduce((toppingSum, topping) => {
        // Precio base del grupo de toppings
        let toppingGroupPrice = parseFloat(topping.basePrice || 0);
        
        // Precio de la opción seleccionada
        toppingGroupPrice += parseFloat(topping.price || 0);
        
        // Precios de subgrupos
        if (topping.subGroups && topping.subGroups.length > 0) {
          const subGroupsPrice = topping.subGroups.reduce(
            (subSum, subItem) => subSum + parseFloat(subItem.price || 0),
            0
          );
          toppingGroupPrice += subGroupsPrice;
        }
        
        return toppingSum + toppingGroupPrice;
      }, 0);
    }
    
    // Precio total: (base + toppings) * cantidad
    return (basePrice + toppingPriceSum) * quantity;
  };

  const handleTableNumberChange = (e) => {
    const value = e.target.value;
    // Filtrar solo números
    const numericValue = value.replace(/[^0-9]/g, '');
    setTableNumber(numericValue);
    // También actualizamos orderInfo para mantener sincronizados los estados
    updateOrderInfo({
      ...orderInfo,
      tableNumber: numericValue
    });
  };

  // Función para verificar el estado actual antes de enviar
  const debugInputState = () => {
    console.log("Estado actual del tableNumber:", tableNumber);
    console.log("Estado actual de orderInfo.tableNumber:", orderInfo?.tableNumber);
    console.log("Estado actual de orderInfo.orderType:", orderInfo?.orderType);
    console.log("Estado de orderInfo completo:", orderInfo);
  };

  // Función para manejar pedidos en sitio
  const handleInSiteOrder = () => {
    console.log("Iniciando handleInSiteOrder");
    debugInputState();
    
    // Si ya hay un pedido en proceso, no permitir otro
    if (isSubmitting) {
      console.log("Ya hay un pedido en proceso, ignorando solicitud");
      return;
    }
    
    try {
      // Verificar todas las posibles fuentes del número de mesa
      const tableFromQR = isFromTableQR && tableNumber ? tableNumber.trim() : '';
      const tableFromOrderInfo = orderInfo?.tableNumber ? orderInfo.tableNumber.trim() : '';
      const tableFromState = tableNumber ? tableNumber.trim() : '';
      
      // Usar cualquier número de mesa disponible, en orden de prioridad
      const existingTable = tableFromQR || tableFromOrderInfo || tableFromState;
      
      if (existingTable) {
        // Ya tiene número de mesa, procesar pedido directamente
        console.log(`*** MESA ENCONTRADA: ${existingTable}, ENVIANDO PEDIDO DIRECTAMENTE ***`);
        
        // Marcar como enviando
        setLocalIsSubmitting(true);
        
        // Actualizar información con mesa existente
        const updatedOrderInfo = {
          ...orderInfo,
          orderType: 'inSite',
          tableNumber: existingTable
        };
        
        // Actualizar estado y localStorage
        console.log('Actualizando orderInfo con mesa:', existingTable);
        updateOrderInfo(updatedOrderInfo);
        SessionManager.saveOrderInfo(updatedOrderInfo);
        
        // Cerrar modal si está abierto
        closeOrderModal();
        
        // Dar un pequeño tiempo para asegurar que el estado se actualice
        setTimeout(() => {
          // Enviar pedido directamente
          console.log("*** EJECUTANDO ENVÍO DIRECTO CON MESA:", existingTable, " ***");
          onOrder(orderInfo, appliedCoupon);
          
          // Resetear estado después de un tiempo prudente
          setTimeout(() => {
            setLocalIsSubmitting(false);
          }, 500);
        }, 100);
      } else {
        // No tiene mesa, abrir modal para ingresar número
        console.log("*** NO HAY MESA EN NINGUNA FUENTE - ABRIENDO MODAL PARA INGRESAR NÚMERO ***");
        openOrderModal('inSite');
      }
    } catch (error) {
      console.error("Error al procesar pedido en sitio:", error);
      alert("Error al procesar el pedido. Inténtalo de nuevo.");
      setLocalIsSubmitting(false);
    }
  };

  const handleSubmitOrder = () => {
    // Verificar si la suscripción está suspendida
    if (subscriptionStatus === 'suspended') {
      setLocalIsSubmitting(false);
      return;
    }
    
    // Verificar si el negocio está abierto
    if (!businessStatus?.isOpen) {
      setShowClosedModal(true);
      return;
    }
    
    // Debug para verificar estado actual
    debugInputState();
    
    // Si ya hay un pedido en proceso, no permitir otro
    if (isSubmitting) {
      console.log("Ya hay un pedido en proceso, ignorando solicitud en handleSubmitOrder");
      return;
    }
    
    try {
      logSystem(`Procesando pedido tipo: ${orderInfo.orderType}`);
      
      // En función del tipo de pedido, llamamos a la función correspondiente
      if (orderInfo.orderType === 'delivery') {
        setLocalIsSubmitting(true);
        handleDeliverySubmit();
      } else if (orderInfo.orderType === 'inSite') {
        // Verificar todas las posibles fuentes del número de mesa
        const tableFromQR = isFromTableQR && tableNumber ? tableNumber.trim() : '';
        const tableFromOrderInfo = orderInfo?.tableNumber ? orderInfo.tableNumber.trim() : '';
        const tableFromState = tableNumber ? tableNumber.trim() : '';
        
        // Usar cualquier número de mesa disponible, en orden de prioridad
        const existingTable = tableFromQR || tableFromOrderInfo || tableFromState;
        
        if (existingTable) {
          // Ya tiene un número de mesa, enviar directamente
          console.log("*** MESA ENCONTRADA EN SUBMIT:", existingTable, "- ENVIANDO PEDIDO ***");
          
          setLocalIsSubmitting(true);
          
          // Crear información completa del pedido con mesa existente
          const updatedOrderInfo = {
            ...orderInfo,
            orderType: 'inSite',
            tableNumber: existingTable
          };
          
          // Guardar en todas partes para asegurar consistencia
          console.log('Actualizando información final con mesa:', existingTable);
          updateOrderInfo(updatedOrderInfo);
          SessionManager.saveOrderInfo(updatedOrderInfo);
          setTableNumber(existingTable);
          
          // Cerrar modal si está abierto
          closeOrderModal();
          
          // Dar un pequeño tiempo para asegurar la sincronización
          setTimeout(() => {
            // Enviar pedido directamente
            console.log("*** EJECUTANDO ENVÍO FINAL CON MESA:", existingTable, "***");
            onOrder(orderInfo, appliedCoupon);
            
            // Resetear estado de envío
            setTimeout(() => {
              setLocalIsSubmitting(false);
            }, 500);
          }, 100);
        } else {
          // No hay mesa, mostrar modal para ingresarla
          console.log("*** NO HAY MESA EN SUBMIT - ABRIENDO MODAL ***");
          openOrderModal('inSite');
          setLocalIsSubmitting(false);
        }
      } else if (orderInfo.orderType === 'takeaway') {
        // Para llevar - no necesita validación adicional
        setLocalIsSubmitting(true);
        
        const updatedOrderInfo = {
          ...orderInfo,
          orderType: 'takeaway',
          // Asegurarnos de eliminar explícitamente el número de mesa para pedidos para llevar
          tableNumber: ''
        };
        
        updateOrderInfo(updatedOrderInfo);
        // Usar SessionManager directamente para asegurar que se guarde correctamente
        SessionManager.saveOrderInfo(updatedOrderInfo);
        
        closeOrderModal();
        
        // Pequeño retraso para asegurar actualización de estado
        setTimeout(() => {
          onOrder(orderInfo, appliedCoupon);
          setLocalIsSubmitting(false);
        }, 300);
      } else {
        // Error - tipo de pedido no reconocido
        console.error("Tipo de pedido no válido:", orderInfo.orderType);
        alert("Error: Tipo de pedido no válido");
        setLocalIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error al procesar el pedido:", error);
      alert("Error al procesar el pedido. Inténtalo de nuevo.");
      setLocalIsSubmitting(false);
    }
  };

  // Función para manejar directamente pedidos para llevar sin modal
  const handleTakeawayOrder = () => {
    // Verificar si la suscripción está suspendida
    if (subscriptionStatus === 'suspended') {
      setLocalIsSubmitting(false);
      return;
    }
    
    // Debug para verificar estado actual
    debugInputState();
    
    // Si ya hay un pedido en proceso, no permitir otro
    if (isSubmitting) return;
    setLocalIsSubmitting(true);
    
    try {
      // Crear la información actualizada del pedido
      const updatedOrderInfo = {
        ...orderInfo,
        orderType: 'takeaway',
        // Eliminar explícitamente el número de mesa
        tableNumber: ''
      };
      
      console.log('Enviando pedido para llevar:', updatedOrderInfo);
      
      // Actualizar la información del pedido
      updateOrderInfo(updatedOrderInfo);
      
      // Guardar usando SessionManager para manejar correctamente según el modo
      SessionManager.saveOrderInfo(updatedOrderInfo);
      
      // Enviar el pedido después de un pequeño retraso
      setTimeout(() => {
        onOrder(orderInfo, appliedCoupon);
        setLocalIsSubmitting(false);
      }, 300);
    } catch (error) {
      console.error('Error al enviar pedido para llevar:', error);
      alert('Error al procesar el pedido. Inténtalo de nuevo.');
      setLocalIsSubmitting(false);
    }
  };

  return (
    <div 
      ref={backdropRef}
      className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-40"
      onMouseDown={(e) => { if (e.target === backdropRef.current) touchStartedOnBackdrop.current = true; }}
      onMouseUp={(e) => { if (e.target === backdropRef.current && touchStartedOnBackdrop.current) onClose(); touchStartedOnBackdrop.current = false; }}
      onTouchStart={(e) => { if (e.target === backdropRef.current) touchStartedOnBackdrop.current = true; else touchStartedOnBackdrop.current = false; }}
      onTouchEnd={(e) => { if (e.target === backdropRef.current && touchStartedOnBackdrop.current) onClose(); touchStartedOnBackdrop.current = false; }}
    >
      <div 
        className="bg-white sm:rounded-2xl rounded-t-2xl max-w-lg w-full modal-h-full sm:modal-h-desktop shadow-2xl border border-slate-200/50 flex flex-col pb-safe"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile sheet) */}
        <div className="flex justify-center pt-2 pb-0 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-2.5 sm:px-6 sm:py-3 flex justify-between items-center z-10 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Tu pedido</h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{totalItems}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-all flex items-center justify-center"
            aria-label="Cerrar carrito"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cart Items - Scrollable Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-2 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          {cart.map((item, itemIndex) => (
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
                                {topping.optionName}{topping.price > 0 ? ` +$${Number(topping.price).toLocaleString('es-CO')}` : ''}
                              </span>
                            );
                          }
                          if (topping.subGroups) {
                            topping.subGroups.forEach((sub, subIdx) => {
                              tags.push(
                                <span key={`${item.uniqueId || item._id}-s-${idx}-${subIdx}`} className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-500 rounded-md leading-tight">
                                  {sub.optionName}{sub.price > 0 ? ` +$${Number(sub.price).toLocaleString('es-CO')}` : ''}
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
                    <p className="text-sm font-bold text-slate-800">${calculateItemTotal(item).toLocaleString('es-CO')}</p>
                    <div className="flex items-center gap-0 bg-slate-50 rounded-lg border border-slate-200">
                      <button
                        onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) - 1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                        aria-label="Disminuir cantidad"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                      </button>
                      <span className="w-6 text-center text-sm font-semibold text-slate-800">{item.quantity || 0}</span>
                      <button
                        onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-r-lg transition-colors"
                        aria-label="Aumentar cantidad"
                        style={{
                          backgroundColor: businessConfig?.theme?.buttonColor || '#f97316',
                          color: businessConfig?.theme?.buttonTextColor || '#ffffff'
                        }}
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
                  <span className="text-3xl">🛒</span>
                </div>
                <p className="text-slate-500 text-sm mb-1">Tu carrito está vacío</p>
                <p className="text-slate-400 text-xs mb-4">Agrega productos para armar tu pedido</p>
                <button
                  onClick={onClose}
                  className="text-sm px-5 py-2.5 rounded-xl transition-all font-medium"
                  style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                >
                  Explorar menú
                </button>
              </div>
            </div>
          )}

          {/* ── Checkout section (inside scroll) ── */}
          {cart.length > 0 && (
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
              />

              {/* ── Tipo de pedido inline ── */}
              {!initialOrderTypeSelected && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Tipo de pedido</p>
                  <div className={isFromTableQR ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-3 gap-1.5'}>
                    <button
                      type="button"
                      onClick={() => { setOrderType('inSite'); setLocationChecked(false); setDeliveryFee(null); setDeliveryZoneInfo(null); scrollToCheckout(); }}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 transition-all ${
                        orderType === 'inSite' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="text-sm">🍽️</span>
                      <span className={`text-[11px] font-semibold ${orderType === 'inSite' ? 'text-blue-700' : 'text-slate-500'}`}>En Sitio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOrderType('takeaway'); setLocationChecked(false); setDeliveryFee(null); setDeliveryZoneInfo(null); scrollToCheckout(); }}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 transition-all ${
                        orderType === 'takeaway' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="text-sm">📦</span>
                      <span className={`text-[11px] font-semibold ${orderType === 'takeaway' ? 'text-blue-700' : 'text-slate-500'}`}>Llevar</span>
                    </button>
                    {!isFromTableQR && (
                      <button
                        type="button"
                        onClick={() => { setOrderType('delivery'); setLocationChecked(false); setDeliveryFee(null); setDeliveryZoneInfo(null); scrollToCheckout(); }}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 transition-all ${
                          orderType === 'delivery' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span className="text-sm">🛵</span>
                        <span className={`text-[11px] font-semibold ${orderType === 'delivery' ? 'text-blue-700' : 'text-slate-500'}`}>Domicilio</span>
                      </button>
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
                  placeholder="Número de mesa"
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
                  <span className="text-xs">🪑</span>
                  <p className="text-blue-800 font-semibold text-[11px]">Mesa {tableNumber} · En sitio</p>
                </div>
              )}

              {/* ── Campo condicional: Dirección de entrega ── */}
              {orderType === 'delivery' && !initialOrderTypeSelected && (
                <div className="space-y-1.5">
                  <textarea
                    ref={deliveryAddressRef}
                    id="inline-delivery-address"
                    name="address"
                    defaultValue={orderInfo?.address || ''}
                    className="w-full p-2 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    placeholder="Dirección de entrega"
                    rows="1"
                    autoComplete="street-address"
                  />

                  {!locationChecked && (
                    <button
                      type="button"
                      onClick={detectLocationAndCalculateFee}
                      disabled={checkingLocation}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium disabled:bg-gray-400 text-xs"
                    >
                      {checkingLocation ? (
                        <><span className="animate-spin">🔄</span> Verificando...</>
                      ) : (
                        <>📍 Verificar costo de domicilio</>
                      )}
                    </button>
                  )}

                  {locationChecked && (
                    <>
                      {deliveryFee && deliveryZoneInfo ? (
                        <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-xl">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">✅</span>
                            <span className="text-[11px] text-green-800 font-medium">{deliveryZoneInfo.zoneName}</span>
                          </div>
                          <span className="text-xs font-bold text-green-800">${deliveryFee.toLocaleString()}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl">
                          <span className="text-sm text-amber-600">⚠️</span>
                          <p className="text-[11px] text-amber-800 font-medium">Costo por confirmar</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Sticky bottom: Total + Confirm button ── */}
        {cart.length > 0 && (
          <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-3 sm:px-6 flex-shrink-0 pb-safe sm:rounded-b-2xl">
            {/* Price breakdown when there are extras */}
            {(deliveryFee > 0 || appliedCoupon) && (
              <div className="space-y-1 mb-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal</span>
                  <span>${totalAmount.toLocaleString('es-CO')}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Envío</span>
                    <span>${deliveryFee.toLocaleString('es-CO')}</span>
                  </div>
                )}
                {appliedCoupon && (
                  <div className="flex justify-between text-xs text-green-500">
                    <span>Descuento</span>
                    <span>-${appliedCoupon.discountAmount.toLocaleString('es-CO')}</span>
                  </div>
                )}
                <div className="border-t border-dashed border-slate-200" />
              </div>
            )}

            {/* Total row — prominent */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-500">Total</span>
              <div className="flex items-baseline gap-2">
                {appliedCoupon && (
                  <span className="text-xs line-through text-slate-300">${((deliveryFee || 0) + totalAmount).toLocaleString('es-CO')}</span>
                )}
                <span className="text-2xl font-extrabold text-slate-900">
                  ${(appliedCoupon ? ((deliveryFee || 0) + finalAmount) : ((deliveryFee || 0) + totalAmount)).toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            {/* Confirm button */}
            {(() => {
              const hasSelectedType = initialOrderTypeSelected || orderType;
              const isDeliveryWithoutCheck = orderType === 'delivery' && !initialOrderTypeSelected && !locationChecked;
              const showButton = hasSelectedType && !isDeliveryWithoutCheck;
              const isDisabled = isSubmitting || !businessStatus?.isOpen || subscriptionStatus === 'suspended';

              if (!showButton) return null;

              const handleConfirmClick = () => {
                if (isDisabled) return;
                
                if (initialOrderTypeSelected) {
                  handleSubmitOrder();
                } else if (orderType === 'inSite') {
                  const trimmedTable = formState.tableNumber.trim();
                  if (!trimmedTable && !(isFromTableQR && tableNumber)) {
                    alert('Por favor ingresa el número de mesa');
                    return;
                  }
                  setLocalIsSubmitting(true);
                  const updatedOrderInfo = { ...orderInfo, orderType: 'inSite', tableNumber: trimmedTable || tableNumber };
                  updateOrderInfo(updatedOrderInfo);
                  SessionManager.saveOrderInfo(updatedOrderInfo);
                  setTimeout(() => { onOrder(updatedOrderInfo, appliedCoupon); setTimeout(() => setLocalIsSubmitting(false), 500); }, 150);
                } else if (orderType === 'takeaway') {
                  setLocalIsSubmitting(true);
                  const updatedOrderInfo = { ...orderInfo, orderType: 'takeaway', tableNumber: '' };
                  updateOrderInfo(updatedOrderInfo);
                  SessionManager.saveOrderInfo(updatedOrderInfo);
                  setTimeout(() => { onOrder(updatedOrderInfo, appliedCoupon); setTimeout(() => setLocalIsSubmitting(false), 500); }, 150);
                } else if (orderType === 'delivery') {
                  const trimmedAddress = (deliveryAddressRef.current?.value || '').trim();
                  if (!trimmedAddress) { alert('Por favor ingresa la dirección de entrega'); return; }
                  setLocalIsSubmitting(true);
                  const updatedOrderInfo = {
                    ...orderInfo, orderType: 'delivery', address: trimmedAddress, tableNumber: '',
                    deliveryFee: deliveryFee || null, deliveryZoneName: deliveryZoneInfo?.zoneName || null,
                    deliveryZoneInfo: deliveryZoneInfo || null, deliveryCalculated: true, deliveryNeedsConfirmation: !deliveryFee
                  };
                  updateOrderInfo(updatedOrderInfo);
                  SessionManager.saveOrderInfo(updatedOrderInfo);
                  setTimeout(() => { onOrder(updatedOrderInfo, appliedCoupon); setTimeout(() => setLocalIsSubmitting(false), 500); }, 150);
                }
              };

              let buttonLabel = 'Confirmar Pedido';
              if (initialOrderTypeSelected && orderInfo.orderType === 'inSite') buttonLabel = `Confirmar · Mesa ${tableNumber}`;
              else if (initialOrderTypeSelected && orderInfo.orderType === 'takeaway') buttonLabel = 'Confirmar · Para Llevar';
              else if (orderType === 'inSite') buttonLabel = `Confirmar · Mesa${formState.tableNumber ? ` ${formState.tableNumber}` : ''}`;
              else if (orderType === 'takeaway') buttonLabel = 'Confirmar · Para Llevar';
              else if (orderType === 'delivery') buttonLabel = 'Confirmar · Domicilio';

              return (
                <button
                  onClick={handleConfirmClick}
                  style={{ 
                    backgroundColor: isDisabled ? '#9ca3af' : (businessConfig.theme.buttonColor || '#f97316'),
                    color: businessConfig.theme.buttonTextColor || '#ffffff'
                  }}
                  className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 text-[15px] shadow-lg transition-all ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] hover:shadow-xl'
                  }`}
                  disabled={isDisabled}
                >
                  {isSubmitting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <span>{buttonLabel}</span>
                  )}
                </button>
              );
            })()}
          </div>
        )}
        </div>
        
      {/* Modal de negocio cerrado */}
      <BusinessClosedModal
        isOpen={showClosedModal}
        onClose={() => setShowClosedModal(false)}
        businessStatus={businessStatus}
      />
    </div>
  );
}

export default CartSummary; 
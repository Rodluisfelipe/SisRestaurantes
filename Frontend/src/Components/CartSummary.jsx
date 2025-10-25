import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from "../Context/BusinessContext";
import * as SessionManager from '../utils/sessionManager';
import CouponInput from './CouponInput';
import { logSystem } from '../utils/systemLogger';
import { useBusinessStatus } from '../hooks/useBusinessStatus';
import BusinessClosedModal from './BusinessClosedModal';
import api from '../services/api';

function CartSummary({ cart, updateQuantity, removeFromCart, onClose, onOrder, orderInfo, updateOrderInfo, businessConfig: propBusinessConfig, isSubmittingOrder: parentIsSubmittingOrder }) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [orderType, setOrderType] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState({
    phone: orderInfo?.phone || '',
    address: orderInfo?.address || ''
  });
  const [tableNumber, setTableNumber] = useState(orderInfo?.tableNumber || '');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(null);
  const [deliveryZoneInfo, setDeliveryZoneInfo] = useState(null);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [locationChecked, setLocationChecked] = useState(false);
  const [formState, setFormState] = useState({
    tableNumber: '',
    address: orderInfo?.address || ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { businessConfig, businessId } = useBusinessConfig();
  const { businessStatus, getStatusDisplay } = useBusinessStatus(businessId);
  
  // Sincronizar formState con orderInfo cuando cambie
  useEffect(() => {
    setFormState({
      tableNumber: orderInfo?.tableNumber || '',
      address: orderInfo?.address || ''
    });
  }, [orderInfo?.tableNumber, orderInfo?.address]);
  
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

  // Use useEffect to synchronize deliveryInfo with orderInfo
  useEffect(() => {
    // Only update if orderInfo changes from external sources
    if (orderInfo?.phone || orderInfo?.address) {
      setDeliveryInfo({
        phone: orderInfo.phone || '',
        address: orderInfo.address || ''
      });
    }
  }, [orderInfo?.phone, orderInfo?.address]);

  // Sincronizar tableNumber con orderInfo
  useEffect(() => {
    if (orderInfo?.tableNumber) {
      setTableNumber(orderInfo.tableNumber);
    }
  }, [orderInfo?.tableNumber]);

  // Estado local para control de envío (sync con prop del padre)
  const [localIsSubmitting, setLocalIsSubmitting] = useState(false);
  
  // Función para determinar si está en proceso de envío (cualquier fuente)
  const isSubmitting = localIsSubmitting || parentIsSubmittingOrder;

  // Función para detectar ubicación y calcular costo de envío automáticamente
  const detectLocationAndCalculateFee = async () => {
    if (!navigator.geolocation) {
      console.log('ℹ️ Navegador no soporta geolocalización. Mostrando aviso de costo por confirmar.');
      setDeliveryFee(null);
      setDeliveryZoneInfo(null);
      setLocationError(null);
      setLocationChecked(true);
      return;
    }

    setCheckingLocation(true);
    setLocationError(null);

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
            setDeliveryFee(delivery.price);
            setDeliveryZoneInfo({
              zoneName: zone.name,
              estimatedTime: delivery.estimatedTime,
              distance: delivery.distance,
              coordinates: { lat: latitude, lon: longitude }
            });
            setLocationError(null);
            setLocationChecked(true);
          } else {
            // Cliente FUERA de zonas: resetear y mostrar aviso original "costo por confirmar"
            setDeliveryFee(null);
            setDeliveryZoneInfo(null);
            setLocationError(null); // NO mostrar error, solo el aviso por defecto
            setLocationChecked(true); // Marcar que se intentó verificar
            console.log('ℹ️ Cliente fuera de zonas delimitadas. Mostrando aviso de costo por confirmar.');
          }
        } catch (error) {
          console.error('❌ Error al verificar cobertura:', error);
          setLocationError('Error al verificar la zona de entrega');
          setDeliveryFee(null);
          setDeliveryZoneInfo(null);
          setLocationChecked(false);
        } finally {
          setCheckingLocation(false);
        }
      },
      (error) => {
        console.error('❌ Error de geolocalización:', error);
        setCheckingLocation(false);
        
        // Si el usuario deniega el permiso, NO mostrar error, solo continuar con "costo por confirmar"
        if (error.code === error.PERMISSION_DENIED) {
          console.log('ℹ️ Usuario no compartió ubicación. Mostrando aviso de costo por confirmar.');
          setDeliveryFee(null);
          setDeliveryZoneInfo(null);
          setLocationError(null);
          setLocationChecked(true); // Marcar como verificado para mostrar mensaje apropiado
          return;
        }
        
        // Para otros errores (timeout, no disponible), no mostrar error tampoco
        console.log('ℹ️ No se pudo verificar ubicación. Mostrando aviso de costo por confirmar.');
        setDeliveryFee(null);
        setDeliveryZoneInfo(null);
        setLocationError(null);
        setLocationChecked(true);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
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
    
    closeOrderModal();
    
    // Small delay to ensure state is fully updated before order submission
    setTimeout(() => {
      onOrder(updatedOrderInfo, appliedCoupon);
      setLocalIsSubmitting(false);
    }, 300);
  };

  // Update input handlers to use functional state updates to prevent stale state issues
  const handlePhoneChange = (e) => {
    const phone = e.target.value;
    setDeliveryInfo(prev => ({...prev, phone}));
    // Actualizar orderInfo solo cuando se complete el input
    const updatedOrderInfo = {
      ...orderInfo,
      phone
    };
    updateOrderInfo(updatedOrderInfo);
  };
  
  const handleAddressChange = (e) => {
    const address = e.target.value;
    setDeliveryInfo(prev => ({...prev, address}));
    // Actualizar orderInfo solo cuando se complete el input
    const updatedOrderInfo = {
      ...orderInfo,
      address
    };
    updateOrderInfo(updatedOrderInfo);
  };

  const handleTableSubmit = () => {
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
    
    // Reset delivery info with the latest data from orderInfo
    if (type === 'delivery') {
      setDeliveryInfo({
        phone: orderInfo?.phone || '',
        address: orderInfo?.address || ''
      });
    }
    
    // Activar el modal
    setShowOrderModal(true);
    console.log('showOrderModal después:', true);
    document.body.classList.add('modal-open'); // Prevenir scroll en el body
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    document.body.classList.remove('modal-open');
  };

  // Renderizar el modal de forma condicional
  const OrderFormModal = () => {
    if (!showOrderModal) return null;

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      
      // Si es el campo de número de mesa, solo permitir números
      if (name === 'tableNumber') {
        // Filtrar solo números
        const numericValue = value.replace(/[^0-9]/g, '');
        setFormState(prev => ({
          ...prev,
          [name]: numericValue
        }));
      } else {
        setFormState(prev => ({
          ...prev,
          [name]: value
        }));
      }
    };

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
        const trimmedAddress = formState.address.trim();

        if (!trimmedAddress) {
          alert('Por favor ingresa la dirección de entrega');
          return;
        }

        setIsProcessing(true);
        setLocalIsSubmitting(true);

        try {
          const updatedOrderInfo = {
            ...orderInfo,
            orderType: 'delivery',
            // Mantener el teléfono que ya tenemos desde el inicio
            phone: orderInfo.phone,
            address: trimmedAddress,
            // Información de entrega y zona
            deliveryFee: deliveryFee || null,
            deliveryZoneName: deliveryZoneInfo?.zoneName || null,
            deliveryZoneInfo: deliveryZoneInfo || null,
            deliveryCalculated: locationChecked,
            deliveryNeedsConfirmation: !deliveryFee // true si no hay costo automático
          };

          console.log('📦 Datos de entrega incluidos en pedido:', {
            deliveryFee,
            zoneName: deliveryZoneInfo?.zoneName,
            calculated: locationChecked,
            needsConfirmation: !deliveryFee
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
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {orderType === 'inSite' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Mesa
                </label>
                <input
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
                />
              </div>
            )}
            
            {orderType === 'delivery' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección de Entrega
                  </label>
                  <textarea
                    name="address"
                    value={formState.address}
                    onChange={handleInputChange}
                    className="w-full p-3 border rounded-md text-gray-800 placeholder-gray-500"
                    placeholder="Ej: Calle 123 #45-67, Barrio Centro, Apartamento 201"
                    rows="3"
                    required
                  />
                </div>

                {/* Botón para calcular costo de envío */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={detectLocationAndCalculateFee}
                    disabled={
                      checkingLocation || 
                      !formState.address || 
                      formState.address.trim().length < 10 || 
                      locationChecked // Deshabilitar después de verificar
                    }
                    className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 font-medium text-blue-700 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500"
                  >
                    {checkingLocation ? (
                      <>
                        <span className="animate-spin">🔄</span>
                        Verificando ubicación...
                      </>
                    ) : locationChecked && !deliveryFee ? (
                      <>
                        ✓ Verificación completada
                      </>
                    ) : deliveryFee ? (
                      <>
                        ✓ Costo calculado
                      </>
                    ) : (
                      <>
                        📍 Verificar costo de envío
                      </>
                    )}
                  </button>
                  {!formState.address || formState.address.trim().length < 10 ? (
                    <p className="text-xs text-amber-600 mt-2 text-center font-medium">
                      ⬆️ Primero ingresa tu dirección completa
                    </p>
                  ) : locationChecked ? (
                    <p className="text-xs text-green-600 mt-2 text-center">
                      ✓ Ubicación verificada
                    </p>
                  ) : (
                    <p className="text-xs text-blue-600 mt-2 text-center">
                      Necesitaremos tu ubicación GPS solo para verificar si hay precio automático en tu zona
                    </p>
                  )}
                </div>

                {/* Mostrar costo de envío calculado */}
                {deliveryZoneInfo && deliveryFee !== null && (
                  <div className="mt-3 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">✅</span>
                        <span className="font-semibold text-green-800">Costo de envío</span>
                      </div>
                      <span className="text-xl font-bold text-green-800">${deliveryFee.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Mostrar error de geolocalización o sistema */}
                {locationError && (
                  <div className="mt-3 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div className="flex-1">
                        <h4 className="font-bold text-red-800 mb-1">Error de ubicación</h4>
                        <p className="text-sm text-red-700">{locationError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Avisos informativos */}
                <div className="space-y-3 mt-4">
                  {/* Aviso de costo de envío (solo si no se ha calculado o está fuera de zonas) */}
                  {!deliveryFee && !locationError && (
                    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                      <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm text-amber-900 font-semibold">
                          💰 El costo de envío será confirmado
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          {checkingLocation 
                            ? 'Verificando ubicación...' 
                            : locationChecked 
                              ? 'Tu ubicación está fuera de nuestras zonas de entrega automáticas. Te confirmaremos el costo de envío al recibir tu pedido.' 
                              : 'Puedes verificar si hay costo automático en tu zona (requiere compartir ubicación GPS), o te confirmaremos el valor al recibir tu pedido'
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Aviso de WhatsApp */}
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
                </div>
              </>
            )}

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
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-40">
      <div className="bg-white rounded-2xl max-w-lg w-full h-[85vh] shadow-2xl border border-slate-200/50 backdrop-blur-lg flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-white to-slate-50 border-b border-slate-200 p-6 flex justify-between items-center z-10 backdrop-blur-lg rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{
                backgroundColor: businessConfig?.theme?.buttonColor || '#f97316'
              }}
            >
              <span className="text-white text-lg font-bold">🛒</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Resumen del Pedido</h2>
              <p className="text-sm text-slate-500">{totalItems} {totalItems === 1 ? 'producto' : 'productos'}</p>
              
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cart Items - Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pt-2 pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 min-h-0">
          {cart.map((item) => (
            <div key={item.uniqueId || item._id} className="bg-gradient-to-r from-slate-50 to-white rounded-xl p-4 mb-4 last:mb-0 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-200">
              <div className="flex justify-between items-start">
                {/* Product image */}
                <div className="w-16 h-16 mr-3 flex-shrink-0">
                  <div className="relative w-full h-full rounded-lg overflow-hidden bg-white border border-slate-200">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    {/* Fallback cuando no hay imagen o falla la carga */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400 text-xs font-medium" style={{display: item.image ? 'none' : 'flex'}}>
                      Sin imagen
                    </div>
                  </div>
                </div>
                
                {/* Item details */}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 text-base">{item.name}</h3>
                  
                  {/* Price information */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span 
                      className="text-sm font-semibold px-3 py-1 rounded-full shadow-sm"
                      style={{
                        backgroundColor: `${businessConfig?.theme?.buttonColor || '#f97316'}20`,
                        color: businessConfig?.theme?.buttonColor || '#f97316'
                      }}
                    >
                      ${(item.finalPrice || item.price || 0).toLocaleString('es-CO')} c/u
                    </span>
                    <p className="text-sm font-medium" style={{ color: businessConfig?.theme?.buttonColor || '#f97316' }}>
                      Subtotal: {calculateItemTotal(item).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>

                {/* Quantity controls */}
                <div className="flex flex-col items-end gap-2 ml-4">
                  <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                    <button
                      onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) - 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 hover:shadow-sm"
                      style={{
                        backgroundColor: `${businessConfig?.theme?.buttonColor || '#f97316'}15`,
                        color: businessConfig?.theme?.buttonColor || '#f97316'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="w-8 text-center font-semibold text-gray-800">{item.quantity || 0}</span>
                    <button
                      onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 hover:shadow-sm"
                      style={{
                        backgroundColor: businessConfig?.theme?.buttonColor || '#f97316',
                        color: businessConfig?.theme?.buttonTextColor || '#ffffff'
                      }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.uniqueId || item._id)}
                    className="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 transition-all duration-200 rounded-lg shadow-sm hover:shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                </div>
                
                {/* Personalizaciones - Ancho completo */}
                {item.selectedToppings && item.selectedToppings.length > 0 && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200/50 shadow-sm">
                    <p className="text-base font-semibold text-slate-700 mb-4 flex items-center">
                      <svg 
                        className="w-5 h-5 mr-2" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        style={{ color: businessConfig?.theme?.buttonColor || '#f97316' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Personalizaciones
                    </p>
                    <div className="space-y-4">
                      {(() => {
                        // Agrupar toppings por nombre de grupo para evitar repetición
                        const groupedToppings = {};
                        
                        item.selectedToppings.forEach((topping, idx) => {
                          const groupName = topping.groupName;
                          if (!groupedToppings[groupName]) {
                            groupedToppings[groupName] = {
                              groupName: groupName,
                              basePrice: Number(topping.basePrice || 0),
                              options: [],
                              subGroups: []
                            };
                          }
                          
                          // Agregar opción si existe
                          if (topping.optionName) {
                            groupedToppings[groupName].options.push({
                              name: topping.optionName,
                              price: Number(topping.price || 0)
                            });
                          }
                          
                          // Agregar subgrupos si existen
                          if (topping.subGroups && topping.subGroups.length > 0) {
                            groupedToppings[groupName].subGroups.push(...topping.subGroups);
                          }
                        });
                        
                        return Object.values(groupedToppings).map((group, groupIdx) => (
                          <div key={`${item.uniqueId || item._id}-group-${groupIdx}`} className="bg-white rounded-lg p-4 border border-slate-100 shadow-sm">
                            {/* Título del grupo */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                              <span 
                                className="font-bold text-base sm:text-lg"
                                style={{ color: businessConfig?.theme?.buttonColor || '#f97316' }}
                              >
                                {group.groupName}
                              </span>
                              {group.basePrice > 0 && (
                                <span className="text-green-600 text-sm font-semibold bg-green-50 px-3 py-1 rounded-full">
                                  +${group.basePrice.toLocaleString('es-CO')}
                                </span>
                              )}
                            </div>
                            
                            {/* Opciones seleccionadas del grupo */}
                            {group.options.length > 0 && (
                              <div className="ml-2 sm:ml-4 space-y-2">
                                {group.options.map((option, optionIdx) => (
                                  <div key={`${item.uniqueId || item._id}-option-${optionIdx}`} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                    <span className="text-gray-800 text-base sm:text-lg font-medium">• {option.name}</span>
                                    {option.price > 0 && (
                                      <span className="text-green-600 text-sm font-semibold bg-green-50 px-3 py-1 rounded-full">
                                        +${option.price.toLocaleString('es-CO')}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Subgrupos */}
                            {group.subGroups.length > 0 && (
                              <div className="mt-4 ml-2 sm:ml-4 pl-4 sm:pl-6 border-l-2 border-orange-200 space-y-3">
                                <p className="text-sm font-bold text-orange-600 uppercase tracking-wide">Adiciones:</p>
                                {group.subGroups.map((subItem, subIdx) => (
                                  <div key={`${item.uniqueId || item._id}-subtopping-${subIdx}`} className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                      <span className="font-semibold text-orange-700 text-sm sm:text-base">{subItem.subGroupTitle}:</span>
                                      <span className="text-gray-800 text-sm sm:text-base font-medium">{subItem.optionName}</span>
                                      {subItem.price > 0 && (
                                        <span className="text-green-600 text-sm font-semibold bg-green-50 px-3 py-1 rounded-full">
                                          +${subItem.price.toLocaleString('es-CO')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ))}

          {/* Empty cart state */}
          {cart.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-8">
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-500 mb-4">Tu carrito está vacío</p>
                <button
                  onClick={onClose}
                  className="text-sm px-6 py-3 rounded-xl transition-colors duration-300 shadow-sm hover:shadow-md"
                  style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                >
                  Continuar comprando
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer con total y botones - SIEMPRE VISIBLE */}
        {cart.length > 0 && (
          <div className="border-t border-slate-200/80 bg-white p-6 space-y-4 shadow-xl rounded-b-2xl flex-shrink-0">
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

            {/* Total amount */}
            <div className="space-y-3">
              {/* Mostrar costo de envío si está disponible */}
              {deliveryFee !== null && deliveryFee > 0 && (
                <div className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-700">Subtotal productos</p>
                    <p className="text-lg font-semibold text-slate-800">${totalAmount.toLocaleString('es-CO')}</p>
                  </div>
                </div>
              )}
              
              {deliveryFee !== null && deliveryFee > 0 && (
                <div className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-slate-700">🚚 Costo de envío</p>
                  <p className="text-lg font-semibold text-green-700">${deliveryFee.toLocaleString('es-CO')}</p>
                </div>
              )}
              
              {/* Total final */}
              <div className="flex justify-between items-center p-4 rounded-xl shadow-sm border border-slate-200/50"
                   style={{
                     background: `linear-gradient(135deg, ${businessConfig?.theme?.buttonColor || '#f97316'}10, ${businessConfig?.theme?.buttonColor || '#f97316'}05)`
                   }}>
                <div>
                  <p className="text-sm text-slate-600">Total ({totalItems} {totalItems === 1 ? 'producto' : 'productos'})</p>
                  {appliedCoupon ? (
                    <div>
                      <p className="text-lg text-slate-600 line-through">${((deliveryFee || 0) + totalAmount).toLocaleString('es-CO')}</p>
                      <p className="text-2xl font-bold text-green-600">${((deliveryFee || 0) + finalAmount).toLocaleString('es-CO')}</p>
                      <p className="text-sm text-green-600">Ahorras: ${appliedCoupon.discountAmount.toLocaleString('es-CO')}</p>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-slate-800">${((deliveryFee || 0) + totalAmount).toLocaleString('es-CO')}</p>
                  )}
                </div>
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                  style={{
                    backgroundColor: businessConfig?.theme?.buttonColor || '#f97316'
                  }}
                >
                  <span className="text-white text-xl">💰</span>
                </div>
              </div>
            </div>

            {/* Mostrar información de la mesa si hay tableNumber */}
            {isFromTableQR && (
              <div className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <div>
                  <p className="text-blue-800 font-semibold">Mesa {tableNumber}</p>
                  <p className="text-blue-600 text-sm">Pedido en sitio</p>
                </div>
              </div>
            )}

              {/* Order type buttons */}
              <div className={initialOrderTypeSelected ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 gap-4'}>
                {initialOrderTypeSelected && orderInfo.orderType === 'inSite' ? (
                  <button
                    onClick={handleSubmitOrder}
                    style={{ 
                      backgroundColor: businessStatus?.isOpen 
                        ? businessConfig.theme.buttonColor 
                        : '#9ca3af',
                      color: businessConfig.theme.buttonTextColor 
                    }}
                    className={`w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm ${
                      businessStatus?.isOpen ? 'hover:shadow' : 'opacity-50 cursor-not-allowed'
                    }`}
                    disabled={isSubmitting || !businessStatus?.isOpen}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                        <span>Confirmar Pedido en Mesa {tableNumber}</span>
                      </>
                    )}
                  </button>
                ) : initialOrderTypeSelected && orderInfo.orderType === 'takeaway' ? (
                  <button
                    onClick={handleSubmitOrder}
                    style={{ 
                      backgroundColor: businessStatus?.isOpen 
                        ? businessConfig.theme.buttonColor 
                        : '#9ca3af',
                      color: businessConfig.theme.buttonTextColor 
                    }}
                    className={`w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm ${
                      businessStatus?.isOpen ? 'hover:shadow' : 'opacity-50 cursor-not-allowed'
                    }`}
                    disabled={isSubmitting || !businessStatus?.isOpen}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                        <span>Confirmar Pedido Para Llevar</span>
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openOrderModal('inSite')}
                      style={{ 
                        backgroundColor: businessStatus?.isOpen 
                          ? businessConfig.theme.buttonColor 
                          : '#9ca3af',
                        color: businessConfig.theme.buttonTextColor 
                      }}
                      className={`w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm ${
                        businessStatus?.isOpen ? 'hover:shadow' : 'opacity-50 cursor-not-allowed'
                      }`}
                      disabled={isSubmitting || !businessStatus?.isOpen}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span className="ml-2">Procesando...</span>
                        </>
                      ) : (
                        <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                          <span>Comer en Sitio</span>
                        </>
                      )}
                    </button>
                    {!isFromTableQR ? (
                      <button
                        onClick={() => openOrderModal('delivery')}
                        style={{ 
                          backgroundColor: businessStatus?.isOpen 
                            ? businessConfig.theme.buttonColor 
                            : '#9ca3af',
                          color: businessConfig.theme.buttonTextColor 
                        }}
                        className={`w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm ${
                          businessStatus?.isOpen ? 'hover:shadow' : 'opacity-50 cursor-not-allowed'
                        }`}
                        disabled={isSubmitting || !businessStatus?.isOpen}
                      >
                        {isSubmitting ? (
                          <>
                            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                            <span>Procesando...</span>
                          </>
                        ) : (
                          <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                          <span>A Domicilio</span>
                        </>
                      )}
                      </button>
                    ) : (
                      <button
                        onClick={handleTakeawayOrder}
                        style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                        className="w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                            <span>Procesando...</span>
                          </>
                        ) : (
                          <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                          <span>Para Llevar</span>
                        </>
                      )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
      {/* Order form modal - improve styling */}
      {showOrderModal && (
        <OrderFormModal />
      )}
      
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
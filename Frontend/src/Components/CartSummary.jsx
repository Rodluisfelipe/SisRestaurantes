import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from "../Context/BusinessContext";
import * as SessionManager from '../utils/sessionManager';
import CouponInput from './CouponInput';
import { logSystem } from '../utils/systemLogger';

function CartSummary({ cart, updateQuantity, removeFromCart, onClose, onOrder, orderInfo, updateOrderInfo, businessConfig: propBusinessConfig, isSubmittingOrder: parentIsSubmittingOrder }) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderType, setOrderType] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState({
    phone: orderInfo?.phone || '',
    address: orderInfo?.address || ''
  });
  const [tableNumber, setTableNumber] = useState(orderInfo?.tableNumber || '');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const { businessConfig } = useBusinessConfig();

  // Variantes de animación para el carrito
  const cartVariants = {
    hidden: { 
      opacity: 0, 
      x: 300,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      x: 0,
      scale: 1,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300
      }
    },
    exit: { 
      opacity: 0, 
      x: 300,
      scale: 0.95,
      transition: {
        duration: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      x: 50,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      x: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0, 
      x: -50,
      scale: 0.9,
      transition: {
        duration: 0.2
      }
    }
  };

  const buttonVariants = {
    hover: { 
      scale: 1.05,
      transition: {
        duration: 0.2
      }
    },
    tap: { 
      scale: 0.95,
      transition: {
        duration: 0.1
      }
    }
  };

  const quantityVariants = {
    hover: { 
      scale: 1.1,
      transition: {
        duration: 0.2
      }
    },
    tap: { 
      scale: 0.9,
      transition: {
        duration: 0.1
      }
    }
  };
  
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

    const [formState, setFormState] = useState({
      tableNumber: '',
      address: orderInfo?.address || ''
    });
    const [isProcessing, setIsProcessing] = useState(false);

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
            address: trimmedAddress
          };

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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección de Entrega
                </label>
                <textarea
                  name="address"
                  value={formState.address}
                  onChange={handleInputChange}
                  className="w-full p-3 border rounded-md text-gray-800 placeholder-gray-500"
                  placeholder="Ej: Calle 123 #45-67, Barrio Centro"
                  rows="3"
                  required
                  autoFocus
                />
              </div>
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
    <>
      <motion.div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className="bg-white rounded-2xl max-w-lg w-full h-[85vh] shadow-2xl border border-slate-200/50 backdrop-blur-lg flex flex-col"
          variants={cartVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-white to-slate-50 border-b border-slate-200 p-6 flex justify-between items-center z-10 backdrop-blur-lg">
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
          <AnimatePresence>
            {cart.map((item, index) => (
              <motion.div 
                key={item.uniqueId || item._id} 
                className="bg-gradient-to-r from-slate-50 to-white rounded-xl p-4 mb-4 last:mb-0 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-200"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
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
              </motion.div>
            ))}
          </AnimatePresence>

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
            <div className="flex justify-between items-center p-4 rounded-xl shadow-sm border border-slate-200/50"
                 style={{
                   background: `linear-gradient(135deg, ${businessConfig?.theme?.buttonColor || '#f97316'}10, ${businessConfig?.theme?.buttonColor || '#f97316'}05)`
                 }}>
              <div>
                <p className="text-sm text-slate-600">Total ({totalItems} {totalItems === 1 ? 'producto' : 'productos'})</p>
                {appliedCoupon ? (
                  <div>
                    <p className="text-lg text-slate-600 line-through">${totalAmount.toLocaleString('es-CO')}</p>
                    <p className="text-2xl font-bold text-green-600">${finalAmount.toLocaleString('es-CO')}</p>
                    <p className="text-sm text-green-600">Ahorras: ${appliedCoupon.discountAmount.toLocaleString('es-CO')}</p>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-slate-800">${totalAmount.toLocaleString('es-CO')}</p>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                        <span>Confirmar Pedido en Mesa {tableNumber}</span>
                      </>
                    )}
                  </button>
                ) : initialOrderTypeSelected && orderInfo.orderType === 'takeaway' ? (
                  <button
                    onClick={handleSubmitOrder}
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
                        <span>Confirmar Pedido Para Llevar</span>
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openOrderModal('inSite')}
                      style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                      className="w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow"
                      disabled={isSubmitting}
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
        </motion.div>
      </motion.div>
      
      {/* Order form modal - improve styling */}
      {showOrderModal && (
        <OrderFormModal />
      )}
    </>
  );
}

export default CartSummary; 
import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from "../Context/BusinessContext";
import * as SessionManager from '../utils/sessionManager';

function CartSummary({ cart, updateQuantity, removeFromCart, onClose, onOrder, orderInfo, updateOrderInfo, businessConfig: propBusinessConfig, isSubmittingOrder: parentIsSubmittingOrder }) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderType, setOrderType] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState({
    phone: orderInfo?.phone || '',
    address: orderInfo?.address || ''
  });
  const [tableNumber, setTableNumber] = useState(orderInfo?.tableNumber || '');
  const { businessConfig } = useBusinessConfig();
  
  // Determinar si el pedido viene de un QR de mesa basado en la URL
  const isFromTableQR = window.location.pathname.includes('/mesa/');
  
  // Comprobar si el usuario eligió inicialmente "En sitio" o "Para llevar" desde el QR de mesa
  const initialOrderTypeSelected = isFromTableQR && 
    (orderInfo.orderType === 'inSite' || orderInfo.orderType === 'takeaway');

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
      onOrder(updatedOrderInfo);
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
    onOrder();
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
    onOrder();
        
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
      phone: '',
      address: ''
    });
    const [isProcessing, setIsProcessing] = useState(false);

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormState(prev => ({
        ...prev,
        [name]: value
      }));
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (isProcessing || isSubmitting) {
        console.log("Ya hay un proceso en curso, ignorando solicitud");
        return;
      }

      if (orderType === 'inSite') {
        const trimmedTableNumber = formState.tableNumber.trim();
        if (!trimmedTableNumber) {
          alert('Por favor ingresa el número de mesa');
          return;
        }

        setIsProcessing(true);
        setLocalIsSubmitting(true);

        try {
          console.log('🔵 Número de mesa confirmado:', trimmedTableNumber);
          
          const updatedOrderInfo = {
            ...orderInfo,
            orderType: 'inSite',
            tableNumber: trimmedTableNumber
          };

          console.log('🔵 Enviando pedido con información completa:', JSON.stringify(updatedOrderInfo));
          
          updateOrderInfo(updatedOrderInfo);
          SessionManager.saveOrderInfo(updatedOrderInfo);
          closeOrderModal();
          onOrder(updatedOrderInfo);
        } catch (error) {
          console.error('Error al procesar el pedido:', error);
          alert('Hubo un error al procesar el pedido. Por favor intenta nuevamente.');
        } finally {
          setIsProcessing(false);
          setLocalIsSubmitting(false);
        }
      } else if (orderType === 'delivery') {
        const trimmedPhone = formState.phone.trim();
        const trimmedAddress = formState.address.trim();

        if (!trimmedPhone || !trimmedAddress) {
          alert('Por favor completa todos los campos');
          return;
        }

        setIsProcessing(true);
        setLocalIsSubmitting(true);

        try {
          const updatedOrderInfo = {
            ...orderInfo,
            orderType: 'delivery',
            phone: trimmedPhone,
            address: trimmedAddress
          };

          updateOrderInfo(updatedOrderInfo);
          SessionManager.saveOrderInfo(updatedOrderInfo);
          closeOrderModal();
          onOrder(updatedOrderInfo);
        } catch (error) {
          console.error('Error al procesar el pedido:', error);
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
            {orderType === 'inSite' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Mesa
                </label>
                <input
                  type="text"
                  name="tableNumber"
                  value={formState.tableNumber}
                  onChange={handleInputChange}
                  className="w-full p-3 border rounded-md"
                  placeholder="Ej: 5"
                  required
                  autoFocus
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formState.phone}
                    onChange={handleInputChange}
                    className="w-full p-3 border rounded-md"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <textarea
                    name="address"
                    value={formState.address}
                    onChange={handleInputChange}
                    className="w-full p-3 border rounded-md"
                    rows="3"
                    required
                  />
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
    const newValue = e.target.value;
    setTableNumber(newValue);
    // También actualizamos orderInfo para mantener sincronizados los estados
    updateOrderInfo({
      ...orderInfo,
      tableNumber: newValue
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
          onOrder();
          
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
      console.log("Ejecutando handleSubmitOrder con orderType:", orderInfo.orderType);
      
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
            onOrder();
            
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
          onOrder();
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
        onOrder();
        setLocalIsSubmitting(false);
      }, 300);
    } catch (error) {
      console.error('Error al enviar pedido para llevar:', error);
      alert('Error al procesar el pedido. Inténtalo de nuevo.');
      setLocalIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-800">Resumen del Pedido</h2>
          <div className="w-6"></div>
        </div>

        {/* Cart Items */}
        <div className="p-4">
          {cart.map((item) => (
            <div key={item.uniqueId || item._id} className="flex flex-col py-4 border-b last:border-b-0">
              <div className="flex justify-between items-start">
                {/* Item details */}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 text-base">{item.name}</h3>
                  
                  {/* Toppings */}
                  {item.selectedToppings && item.selectedToppings.length > 0 && (
                    <div className="pl-4 text-xs text-gray-600 mt-1 space-y-1 border-l-2 border-gray-200">
                      {item.selectedToppings.map((topping, idx) => {
                        // Asegurar que basePrice sea un número o 0 - Movido fuera del JSX
                        const basePrice = Number(topping.basePrice || 0);
                        
                        return (
                          <div key={`${item.uniqueId || item._id}-topping-${idx}`} className="py-0.5">
                            {/* Opción principal del grupo */}
                            <div>
                              {topping.optionName ? (
                                <span className="flex flex-wrap items-center">
                                  <span className="font-medium mr-1">{topping.groupName}</span>
                                  {basePrice > 0 && <span className="text-gray-500 mr-1">(+{basePrice.toLocaleString('es-CO')})</span>}: 
                                  <span className="ml-1">{topping.optionName}</span>
                                  {topping.price > 0 && <span className="text-gray-500 ml-1">(+{topping.price.toLocaleString('es-CO')})</span>}
                                </span>
                              ) : (
                                <span className="flex flex-wrap items-center">
                                  <span className="font-medium">{topping.groupName}</span>
                                  {basePrice > 0 && <span className="text-gray-500 ml-1">(+{basePrice.toLocaleString('es-CO')})</span>}
                                </span>
                              )}
                            </div>
                            
                            {/* Subgrupos */}
                            {topping.subGroups && topping.subGroups.length > 0 && (
                              <div className="pl-3 mt-1 space-y-0.5 border-l border-gray-200">
                                {topping.subGroups.map((subItem, subIdx) => (
                                  <div key={`${item.uniqueId || item._id}-subtopping-${subIdx}`}>
                                    <span className="flex flex-wrap items-center">
                                      <span className="font-medium text-gray-700 mr-1">{subItem.subGroupTitle}:</span>
                                      <span>{subItem.optionName}</span>
                                      {subItem.price > 0 && <span className="text-gray-500 ml-1">(+{subItem.price.toLocaleString('es-CO')})</span>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Price information */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-black px-2 py-0.5 bg-gray-100 rounded-full">
                      {(item.finalPrice || item.price || 0).toLocaleString('es-CO')} c/u
                    </p>
                    <p className="text-sm font-medium" style={{ color: businessConfig.theme.buttonColor }}>
                      Subtotal: {calculateItemTotal(item).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) - 1)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    style={{ color: businessConfig.theme.buttonColor }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="w-8 text-center font-medium">{item.quantity || 0}</span>
                  <button
                    onClick={() => updateQuantity(item.uniqueId || item._id, (item.quantity || 0) + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    style={{ color: businessConfig.theme.buttonColor }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeFromCart(item.uniqueId || item._id)}
                    className="ml-1 text-red-500 hover:text-red-600 transition-colors p-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Empty cart state */}
          {cart.length === 0 && (
            <div className="py-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-500 mb-2">Tu carrito está vacío</p>
              <button
                onClick={onClose}
                className="text-sm px-4 py-2 rounded-lg transition-colors duration-300"
                style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
              >
                Continuar comprando
              </button>
            </div>
          )}

          {/* Total and action buttons */}
          {cart.length > 0 && (
            <div className="mt-6 space-y-6">
              {/* Total amount */}
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-800">Total ({totalItems} productos):</span>
                <span className="font-bold text-xl" style={{ color: businessConfig.theme.buttonColor }}>
                  {totalAmount.toLocaleString('es-CO')}
                </span>
              </div>

              {/* Mostrar información de la mesa si hay tableNumber */}
              {isFromTableQR && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-blue-700 font-medium">Mesa: {tableNumber}</p>
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
                      onClick={handleInSiteOrder}
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
        </div>
      </div>
      
      {/* Order form modal - improve styling */}
      {showOrderModal && (
        <OrderFormModal />
      )}
    </div>
  );
}

export default CartSummary; 
import React, { useState } from 'react';
import ProductGrid from '../Components/POS/ProductGrid';
import CartPanel from '../Components/POS/CartPanel';
import OrdersSidebar from '../Components/POS/OrdersSidebar';
import POSHeader from '../Components/POS/POSHeader';
import POSFooter from '../Components/POS/POSFooter';

const POS = () => {
  const [cart, setCart] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showImages, setShowImages] = useState(false); // Por defecto, no mostrar imágenes (modo compacto)
  const [orderSentToKitchen, setOrderSentToKitchen] = useState(false); // Estado para saber si el pedido actual ya fue enviado a cocina
  const [editingFrozenOrderId, setEditingFrozenOrderId] = useState(null); // ID del pedido congelado en edición

  // Función para alternar entre modo compacto y visual
  const toggleDisplayMode = () => {
    setShowImages(!showImages);
  };

  // Función para agregar productos al carrito
  const addToCart = (product, quantity, selectedToppings) => {
    setCart(prevCart => {
      // Si es un producto con toppings, lo consideramos como un producto único
      const uniqueProduct = product.selectedToppings ? true : false;
      
      // Generar ID único para el producto
      let cartItemId;
      if (uniqueProduct) {
        // Para productos con toppings, cada uno es único
        cartItemId = `${product._id}-${Date.now()}`;
      } else {
        // Para productos sin toppings, usar solo el ID del producto
        cartItemId = product._id;
      }

      // Buscar si el producto ya está en el carrito
      const existingItemIndex = prevCart.findIndex(item => item.id === cartItemId);

      if (existingItemIndex !== -1 && !uniqueProduct) {
        // Si el producto ya está en el carrito y no es único, solo actualizamos la cantidad
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += quantity;
        return updatedCart;
      } else {
        // Si no está en el carrito o es un producto único, agregamos un nuevo item
        return [
          ...prevCart,
          {
            id: cartItemId,
            product,
            quantity,
            comment: '' // Inicializar el comentario vacío para todos los productos
          }
        ];
      }
    });
    
    // Al agregar productos al carrito, se resetea el estado de envío a cocina
    // excepto si estamos editando un pedido congelado
    if (!editingFrozenOrderId) {
      setOrderSentToKitchen(false);
    }
  };

  // Función para eliminar un producto del carrito
  const removeFromCart = (itemId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  // Función para actualizar la cantidad de un producto en el carrito
  const updateCartQuantity = (itemId, delta) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === itemId) {
          const newQuantity = item.quantity + delta;
          // Si la cantidad llega a 0 o menos, se eliminará con removeCartItem
          return { 
            ...item, 
            quantity: newQuantity > 0 ? newQuantity : 1 
          };
        }
        return item;
      });
    });
  };

  // Función para actualizar un item del carrito (para comentarios o toppings)
  const updateCartItem = (itemId, updatedProperties) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === itemId) {
          // Si estamos actualizando el producto, asegurarnos de manejar correctamente la propiedad selectedToppings
          let updatedItem = {
            ...item,
            ...updatedProperties,
          };

          // Asegurarnos de que el ID se preserve
          updatedItem.id = itemId;
          
          // Si estamos actualizando el producto pero no el comentario, preservar el comentario existente
          if (updatedProperties.product && !updatedProperties.hasOwnProperty('comment')) {
            updatedItem.comment = item.comment || '';
          }

          // Actualizar el precio final si cambiaron los toppings
          if (updatedProperties.product && updatedProperties.product.selectedToppings) {
            console.log('Producto actualizado con toppings:', updatedItem);
          }
          
          return updatedItem;
        }
        return item;
      });
    });
  };

  // Función para enviar el pedido a cocina (sin limpiar el carrito)
  const sendToKitchen = () => {
    if (cart.length === 0) return;
    
    // Calcular el total correcto utilizando finalPrice (que incluye toppings)
    const orderTotal = cart.reduce((sum, item) => {
      const itemPrice = item.product.finalPrice || item.product.price;
      return sum + (parseFloat(itemPrice) * item.quantity);
    }, 0);
    
    // Preparar los datos del pedido para enviar a cocina incluyendo comentarios
    const orderItems = cart.map(item => ({
      ...item,
      comment: item.comment || '' // Incluir comentarios si existen
    }));
    
    console.log('Pedido enviado a cocina (permanece en el carrito):', {
      items: orderItems,
      total: orderTotal,
      timestamp: new Date()
    });
    
    // Aquí iría la lógica para enviar el pedido solo a la pantalla de cocina
    // api.post('/kitchen-orders', { items: orderItems, total: orderTotal })...
    
    // Notificar al usuario que el pedido fue enviado a cocina
    // En una aplicación real, probablemente usarías un sistema de notificaciones más robusto
    try {
      // Marcar que el pedido fue enviado a cocina
      setOrderSentToKitchen(true);
      
      // Opcional: Mostrar un mensaje en el navegador (sólo para desarrollo)
      if (process.env.NODE_ENV === 'development') {
        const message = 'Pedido enviado a cocina. Ahora puedes procesar o congelar la orden.';
        console.log('%c' + message, 'background: #4CAF50; color: white; padding: 4px 8px; border-radius: 4px;');
      }
    } catch (error) {
      console.error('Error al enviar pedido a cocina:', error);
      // En caso de error, asegurarse de que orderSentToKitchen esté en false
      setOrderSentToKitchen(false);
    }
  };

  // Función para editar un pedido congelado
  const editFrozenOrder = (order) => {
    if (!order || !order.id) return;
    
    console.log('Editando pedido congelado:', order);
    
    // Guardar el ID del pedido que estamos editando
    setEditingFrozenOrderId(order.id);
    
    // Cargar los items al carrito
    setCart(order.items);
    
    // Marcar que el pedido ya fue enviado a cocina (todos los pedidos congelados fueron enviados)
    setOrderSentToKitchen(true);
  };

  // Función para congelar un pedido (agregar a pedidos activos como "congelado")
  const freezeOrder = (orderData) => {
    // Si el pedido no ha sido enviado a cocina, enviarlo primero
    if (!orderSentToKitchen) {
      sendToKitchen();
      
      // Si estamos en modo de desarrollo, permitimos continuar
      // En producción, probablemente querrías retornar aquí y hacer
      // que el usuario haga clic nuevamente en "Congelar" después 
      // de que el pedido se haya enviado a cocina correctamente
      if (process.env.NODE_ENV !== 'development') {
        return; // En producción, detener la ejecución aquí
      }
      // En desarrollo, continuamos con la congelación del pedido
    }
    
    // Calcular el total correcto utilizando finalPrice (que incluye toppings)
    const orderTotal = cart.reduce((sum, item) => {
      const itemPrice = item.product.finalPrice || item.product.price;
      return sum + (parseFloat(itemPrice) * item.quantity);
    }, 0);
    
    // Preparar los datos de los items, incluyendo comentarios
    const orderItems = cart.map(item => ({
      ...item,
      comment: item.comment || '' // Asegurarse de que los comentarios se incluyan
    }));
    
    // Si estamos editando un pedido congelado, actualizarlo
    if (editingFrozenOrderId) {
      setActiveOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.id === editingFrozenOrderId) {
            return {
              ...order,
              items: orderItems,
              total: orderTotal,
              table: orderData.table || order.table,
              customer: orderData.customer || order.customer,
              timestamp: new Date() // Actualizar timestamp
            };
          }
          return order;
        });
      });
      
      // Limpiar el carrito y resetear estado de edición
      setCart([]);
      setEditingFrozenOrderId(null);
      setOrderSentToKitchen(false);
      
      console.log('Pedido congelado actualizado');
      return;
    }
    
    // Crear el nuevo pedido
    const newOrder = {
      id: Date.now().toString(),
      items: orderItems,
      status: 'pending', // El estado siempre es pendiente cuando se congela
      table: orderData.table || '',
      type: 'freeze',
      customer: orderData.customer || '',
      paymentMethod: 'pending',
      isPaid: false,
      timestamp: new Date(),
      total: orderTotal,
      kitchenStatus: 'sent' // El pedido siempre se envía a cocina antes de congelarse
    };
    
    // Agregar a pedidos activos
    setActiveOrders([...activeOrders, newOrder]);
    
    // Limpiar el carrito después de congelar
    setCart([]);
    setOrderSentToKitchen(false);
    
    console.log('Pedido congelado:', newOrder);
  };

  // Función para recuperar un pedido congelado al carrito para su procesamiento
  const recoverFrozenOrder = (orderId) => {
    const orderToRecover = activeOrders.find(order => order.id === orderId);
    if (!orderToRecover) return;
    
    // Guardar temporalmente el ID del pedido congelado para finalización automática
    sessionStorage.setItem('frozenOrderId', orderId);
    
    // Recuperar los items al carrito
    setCart(orderToRecover.items);
    
    // Marcar que el pedido ya fue enviado a cocina (todos los pedidos congelados fueron enviados)
    setOrderSentToKitchen(true);
    
    // Eliminar de los pedidos activos
    setActiveOrders(activeOrders.filter(order => order.id !== orderId));
    
    console.log('Pedido congelado recuperado al carrito:', orderToRecover);
  };

  // Función para procesar el pedido (pago)
  const processOrder = (orderData) => {
    // Si el pedido no ha sido enviado a cocina, enviarlo primero
    if (!orderSentToKitchen) {
      sendToKitchen();
      
      // Si estamos en modo de desarrollo, permitimos continuar
      // En producción, probablemente querrías retornar aquí y hacer
      // que el usuario haga clic nuevamente en "Procesar" después 
      // de que el pedido se haya enviado a cocina correctamente
      if (process.env.NODE_ENV !== 'development') {
        return; // En producción, detener la ejecución aquí
      }
      // En desarrollo, continuamos con el procesamiento del pedido
    }
    
    // Calcular el total correcto utilizando finalPrice (que incluye toppings)
    const orderTotal = cart.reduce((sum, item) => {
      const itemPrice = item.product.finalPrice || item.product.price;
      return sum + (parseFloat(itemPrice) * item.quantity);
    }, 0);
    
    // Preparar los datos de los items, incluyendo comentarios
    const orderItems = cart.map(item => ({
      ...item,
      comment: item.comment || '' // Asegurarse de que los comentarios se incluyan
    }));
    
    // Verificar si este pedido era un pedido congelado recuperado
    const frozenOrderId = sessionStorage.getItem('frozenOrderId');
    
    // Si es un pedido congelado, procesarlo y finalizarlo directamente
    if (frozenOrderId) {
      console.log('Procesando y finalizando pedido anteriormente congelado');
      
      // Crear el nuevo pedido finalizado (no va a pedidos activos sino directamente a historial)
      const finalizedOrder = {
        id: Date.now().toString(),
        items: orderItems,
        status: 'completed',
        table: orderData.table,
        type: orderData.type,
        customer: orderData.customer,
        paymentMethod: orderData.paymentMethod,
        isPaid: true,
        timestamp: new Date(),
        total: orderTotal,
        completedTimestamp: new Date(),
        kitchenStatus: 'sent' // Ya fue enviado a cocina
      };
      
      // Aquí iría la lógica para enviar el pedido finalizado al backend/historial
      // api.post('/completed-orders', finalizedOrder)...
      
      console.log('Pedido finalizado directamente:', finalizedOrder);
      
      // Limpiar el carrito y el ID del pedido congelado
      setCart([]);
      setOrderSentToKitchen(false);
      sessionStorage.removeItem('frozenOrderId');
      
      return;
    }
    
    // Si no es un pedido congelado, procesarlo normalmente
    // Crear el nuevo pedido
    const newOrder = {
      id: Date.now().toString(),
      items: orderItems,
      status: 'pending', // Siempre comienza como pendiente
      table: orderData.table,
      type: orderData.type,
      customer: orderData.customer,
      paymentMethod: orderData.paymentMethod,
      isPaid: true,
      timestamp: new Date(),
      total: orderTotal,
      kitchenStatus: 'sent' // Ya fue enviado a cocina
    };
    
    // Agregar a pedidos activos
    setActiveOrders([...activeOrders, newOrder]);
    
    // Limpiar el carrito después de procesar
    setCart([]);
    setOrderSentToKitchen(false);
    
    console.log('Pedido procesado (pagado):', newOrder);
    
    // Aquí iría la lógica para enviar el pedido al backend
    // api.post('/orders', newOrder)...
  };

  // Función para finalizar un pedido (enviarlo al historial)
  const finalizeOrder = (orderId) => {
    const orderToFinalize = activeOrders.find(order => order.id === orderId);
    if (!orderToFinalize) return;
    
    console.log('Pedido finalizado, va al historial:', orderToFinalize);
    
    // Eliminar el pedido de los activos
    setActiveOrders(activeOrders.filter(order => order.id !== orderId));
    
    // Aquí iría la lógica para registrar el pedido en el historial/panel de administración
    // api.post('/completed-orders', orderToFinalize)...
  };

  // Función para actualizar el estado de un pedido
  const updateOrderStatus = (orderId, newStatus, action) => {
    // Si la acción es "finalizar", enviar al historial
    if (action === 'finalize') {
      finalizeOrder(orderId);
      return;
    }
    
    // Si la acción es "recover", recuperar al carrito
    if (action === 'recover') {
      recoverFrozenOrder(orderId);
      return;
    }
    
    // Para otros estados, actualizar normalmente
    setActiveOrders(activeOrders.map(order => 
      order.id === orderId 
        ? { ...order, status: newStatus } 
        : order
    ));
  };

  return (
    <div className="h-screen flex flex-col">
      <POSHeader 
        onSearch={setSearchTerm} 
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        showImages={showImages}
        toggleDisplayMode={toggleDisplayMode}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sección 1: Grid de Productos */}
        <div className="w-1/2 p-4 overflow-auto">
          <ProductGrid 
            searchTerm={searchTerm}
            selectedCategory={selectedCategory}
            onAddToCart={addToCart}
            showImages={showImages}
          />
        </div>
        
        {/* Sección 2: Panel de Carrito y Checkout */}
        <div className="w-1/4 border-l border-gray-200 flex flex-col">
          <CartPanel 
            cart={cart}
            onUpdateQuantity={updateCartQuantity}
            onRemoveItem={removeFromCart}
            onProcessOrder={processOrder}
            onFreezeOrder={freezeOrder}
            onSendToKitchen={sendToKitchen}
            orderSentToKitchen={orderSentToKitchen}
            onUpdateItem={updateCartItem}
            isEditingFrozenOrder={!!editingFrozenOrderId}
          />
        </div>
        
        {/* Sección 3: Sidebar de Pedidos */}
        <div className="w-1/4 border-l border-gray-200 bg-gray-50 overflow-auto">
          <OrdersSidebar 
            activeOrders={activeOrders}
            onUpdateStatus={updateOrderStatus}
            onEditOrder={editFrozenOrder}
          />
        </div>
      </div>
      
      <POSFooter />
    </div>
  );
};

export default POS; 
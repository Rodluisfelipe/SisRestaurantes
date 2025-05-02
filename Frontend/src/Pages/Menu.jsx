import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ProductCard from "../Components/ProductCard";
import BusinessHeader from "../Components/BusinessHeader";
import CartSummary from "../Components/CartSummary";
import OrderTypeSelector from "../Components/OrderTypeSelector";

export default function Menu() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [loading, setLoading] = useState(true);
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [showOrderTypeSelector, setShowOrderTypeSelector] = useState(() => {
    const savedOrderInfo = localStorage.getItem('orderInfo');
    return !savedOrderInfo;
  });
  const [orderInfo, setOrderInfo] = useState(() => {
    const savedOrderInfo = localStorage.getItem('orderInfo');
    return savedOrderInfo ? JSON.parse(savedOrderInfo) : null;
  });
  const [isSelectingToppings, setIsSelectingToppings] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          axios.get("http://localhost:5000/api/products"),
          axios.get("http://localhost:5000/api/categories")
        ]);
        setProducts(productsRes.data);
        setCategories(categoriesRes.data);
        setLoading(false);
      } catch (err) {
        console.error("Error al obtener datos:", err);
        setLoading(false);
      }
    };

    fetchData();

    // Replace WebSocket with SSE
    const eventSource = new EventSource('http://localhost:5000/api/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'products_update':
            setProducts(data.data);
            break;
          case 'categories_update':
            setCategories(data.data);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('Error procesando evento:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Error en la conexión SSE:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (orderInfo) {
      localStorage.setItem('orderInfo', JSON.stringify(orderInfo));
    }
  }, [orderInfo]);

  const addToCart = (product) => {
    setCart(prevCart => {
      // Crear una clave única para el producto que incluya los toppings seleccionados
      const productKey = product._id + JSON.stringify(product.selectedToppings || {});
      
      // Buscar si existe un producto idéntico (mismo ID y mismos toppings)
      const existingItemIndex = prevCart.findIndex(item => 
        item._id === product._id && 
        JSON.stringify(item.selectedToppings || {}) === JSON.stringify(product.selectedToppings || {})
      );

      if (existingItemIndex >= 0) {
        // Si existe, incrementar la cantidad
        const newCart = [...prevCart];
        newCart[existingItemIndex] = {
          ...newCart[existingItemIndex],
          quantity: newCart[existingItemIndex].quantity + 1
        };
        return newCart;
      }

      // Si no existe, agregar como nuevo item
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) return;
    setCart(prevCart =>
      prevCart.map(item =>
        item._id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item._id !== productId));
  };

  // Calcular totales
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => {
    const itemPrice = item.finalPrice || item.price;
    return sum + (itemPrice * item.quantity);
  }, 0);

  const handleOrderTypeComplete = (info) => {
    setOrderInfo(info);
    setShowOrderTypeSelector(false);
  };

  const updateOrderInfo = (newInfo) => {
    setOrderInfo(newInfo);
    localStorage.setItem('orderInfo', JSON.stringify(newInfo));
  };

  const createWhatsAppMessage = () => {
    if (!orderInfo || !orderInfo.customerName) {
      console.error('No hay información del cliente');
      return '';
    }

    let message = `*Nuevo Pedido*\n`;
    
    // Agregar información del cliente
    message += `\n*Cliente:* ${orderInfo.customerName}`;
    
    if (orderInfo.orderType === 'inSite') {
      message += `\n*Tipo de Pedido:* En Sitio`;
      message += `\n*Mesa:* ${orderInfo.tableNumber}`;
    } else if (orderInfo.orderType === 'delivery') {
      message += `\n*Tipo de Pedido:* A Domicilio`;
      message += `\n*Teléfono:* ${orderInfo.phone}`;
      message += `\n*Dirección:* ${orderInfo.address}`;
    }

    // Agregar detalle de productos
    message += `\n\n*Detalle del Pedido:*\n`;
    cart.forEach(item => {
      message += `\n${item.quantity}x ${item.name} ($${(item.finalPrice || item.price).toFixed(2)} c/u)`;
      if (item.selectedToppings) {
        Object.values(item.selectedToppings).forEach(group => {
          message += `\n  ${group.groupName}: ${group.options.map(opt => 
            `${opt.name}${opt.price > 0 ? ` (+$${opt.price.toFixed(2)})` : ''}`
          ).join(', ')}`;
        });
      }
      message += `\nSubtotal: $${((item.finalPrice || item.price) * item.quantity).toFixed(2)}`;
    });

    message += `\n\n*Total: $${totalAmount.toFixed(2)}*`;
    
    return encodeURIComponent(message);
  };

  const handleOrder = () => {
    // Validar que tengamos toda la información necesaria
    if (!orderInfo || !orderInfo.customerName) {
      alert('Error: No hay información del cliente');
      return;
    }

    if (!orderInfo.orderType) {
      alert('Por favor selecciona el tipo de pedido (Delivery o En Sitio)');
      return;
    }

    if (orderInfo.orderType === 'delivery' && (!orderInfo.phone || !orderInfo.address)) {
      alert('Por favor completa la información de entrega');
      return;
    }

    if (orderInfo.orderType === 'inSite' && !orderInfo.tableNumber) {
      alert('Por favor ingresa el número de mesa');
      return;
    }

    window.open(`https://wa.me/?text=${createWhatsAppMessage()}`);
    // Limpiar solo el carrito después de enviar
    setCart([]);
    setShowCartSummary(false);
    localStorage.removeItem('cart');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (showOrderTypeSelector) {
    return <OrderTypeSelector onComplete={handleOrderTypeComplete} />;
  }

  if (showCartSummary) {
    return (
      <CartSummary
        cart={cart}
        updateQuantity={updateQuantity}
        removeFromCart={removeFromCart}
        onClose={() => setShowCartSummary(false)}
        orderInfo={orderInfo}
        updateOrderInfo={updateOrderInfo}
        createWhatsAppMessage={createWhatsAppMessage}
        onOrder={handleOrder}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <BusinessHeader />
      
      <div className="container mx-auto px-4 py-1">
        {categories.map(category => {
          const categoryProducts = products.filter(product => product.category === category._id);
          if (categoryProducts.length === 0) return null;

          return (
            <div key={category._id} className="mb-8">
              <div className="relative flex items-center mb-4">
                <div className="flex-grow border-t border-gray-300"></div>
                <h2 className="flex-shrink-0 px-4 text-xl font-bold text-gray-800">
                  {category.name}
                </h2>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categoryProducts.map(product => (
                  <ProductCard 
                    key={product._id} 
                    product={product} 
                    addToCart={addToCart}
                    onToppingsOpen={() => setIsSelectingToppings(true)}
                    onToppingsClose={() => setIsSelectingToppings(false)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra fija inferior del carrito - ahora con visibilidad condicional */}
      {cart.length > 0 && !isSelectingToppings && !showCartSummary && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="container mx-auto flex items-center justify-between">
            <div>
              <span className="text-gray-600">{totalItems} productos</span>
              <p className="font-bold text-lg">${totalAmount.toFixed(2)}</p>
            </div>
            <button
              onClick={() => setShowCartSummary(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-300"
            >
              Ver Carrito
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 
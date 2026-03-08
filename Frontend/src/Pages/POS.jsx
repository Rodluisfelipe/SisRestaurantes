import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useAuth } from '../Context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { socket, joinBusiness } from '../services/socket';
import { SOCKET_EVENTS, ORDER_STATUS } from '../utils/constants';
import POSHeader from '../Components/POS/POSHeader';
import POSProductGrid from '../Components/POS/POSProductGrid';
import POSCart from '../Components/POS/POSCart';
import POSCheckoutModal from '../Components/POS/POSCheckoutModal';
import POSCashRegister from '../Components/POS/POSCashRegister';
import POSTicket from '../Components/POS/POSTicket';
import POSTableMap from '../Components/POS/POSTableMap';
import ProductToppingsSelector from '../Components/ProductToppingsSelector';

export default function POS() {
  const { businessConfig } = useBusinessConfig();
  const { user } = useAuth();
  const { businessId } = useParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [cashRegister, setCashRegister] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCashOpen, setShowCashOpen] = useState(false);
  const [showCashClose, setShowCashClose] = useState(false);
  const [showMovements, setShowMovements] = useState(false);
  const [showToppings, setShowToppings] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showTables, setShowTables] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);

  // Order notifications (web orders arriving)
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [newOrderNotification, setNewOrderNotification] = useState(null);
  const [showOrderBanner, setShowOrderBanner] = useState(false);
  const audioRef = useRef(null);

  // Hold/park orders (persisted in localStorage)
  const [heldOrders, setHeldOrders] = useState(() => {
    try {
      const saved = localStorage.getItem(`pos_held_${businessConfig?._id || businessId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const resolvedBusinessId = businessConfig?._id || businessId;

  // Sync held orders to localStorage
  useEffect(() => {
    try {
      if (resolvedBusinessId) {
        localStorage.setItem(`pos_held_${resolvedBusinessId}`, JSON.stringify(heldOrders));
      }
    } catch {}
  }, [heldOrders, resolvedBusinessId]);

  // Fetch active orders (for table occupancy)
  useEffect(() => {
    if (!resolvedBusinessId) return;
    const fetchActive = () => {
      api.get(`/orders?businessId=${resolvedBusinessId}&status=confirmed,preparing,ready`)
        .then(res => setActiveOrders(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    };
    fetchActive();
    const interval = setInterval(fetchActive, 15000);
    return () => clearInterval(interval);
  }, [resolvedBusinessId]);

  // Fetch products, categories, and cash register
  useEffect(() => {
    if (!resolvedBusinessId) return;
    const fetchData = async () => {
      try {
        const [productsRes, categoriesRes, cashRes] = await Promise.all([
          api.get(`/products?businessId=${resolvedBusinessId}`),
          api.get(`/categories?businessId=${resolvedBusinessId}`),
          api.get(`/cash-register/current?businessId=${resolvedBusinessId}`)
        ]);
        setProducts(productsRes.data.filter(p => p.active !== false));
        setCategories(categoriesRes.data.filter(c => c.active !== false).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)));
        setCashRegister(cashRes.data);
        if (!cashRes.data) setShowCashOpen(true);
      } catch (err) {
        console.error('POS fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [resolvedBusinessId]);

  // Socket.io: listen for web orders
  useEffect(() => {
    if (!resolvedBusinessId) return;

    // Init audio
    try {
      audioRef.current = new Audio('/audio/new-order-notification.mp3');
      audioRef.current.volume = 1;
    } catch {}

    // Connect & join business channel
    if (!socket.connected) socket.connect();
    joinBusiness(resolvedBusinessId);

    // Load initial pending count
    api.get(`/orders?businessId=${resolvedBusinessId}&status=pending`)
      .then(res => setPendingOrdersCount(Array.isArray(res.data) ? res.data.length : 0))
      .catch(() => {});

    const handleNewOrder = (newOrder) => {
      if (newOrder.status === ORDER_STATUS.PENDING) {
        setNewOrderNotification(newOrder);
        setShowOrderBanner(true);
        setPendingOrdersCount(prev => prev + 1);
        // Play sound
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {
            try { new Audio('/audio/new-order-notification.mp3').play(); } catch {}
          });
        }
        setTimeout(() => setShowOrderBanner(false), 10000);
      }
    };

    const handleOrderUpdated = (updatedOrder) => {
      if (updatedOrder.status !== ORDER_STATUS.PENDING) {
        setPendingOrdersCount(prev => Math.max(0, prev - 1));
      }
    };

    socket.on(SOCKET_EVENTS.ORDER_CREATED, handleNewOrder);
    socket.on(SOCKET_EVENTS.ORDER_UPDATED, handleOrderUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.ORDER_CREATED, handleNewOrder);
      socket.off(SOCKET_EVENTS.ORDER_UPDATED, handleOrderUpdated);
    };
  }, [resolvedBusinessId]);

  // Cart operations
  const addToCart = useCallback((product) => {
    setCart(prev => {
      const toppingsKey = JSON.stringify(product.selectedToppings || {});
      const uniqueId = `${product._id}-${toppingsKey.replace(/[{}",:]/g, '')}`;
      const idx = prev.findIndex(item => item.uniqueId === uniqueId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + (product.quantity || 1) };
        return next;
      }
      const itemPrice = product.totalPrice || product.price || 0;
      return [...prev, { ...product, totalPrice: itemPrice, uniqueId, quantity: product.quantity || 1 }];
    });
  }, []);

  const updateQuantity = useCallback((uniqueId, qty) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.uniqueId !== uniqueId));
    } else {
      setCart(prev => prev.map(i => i.uniqueId === uniqueId ? { ...i, quantity: qty } : i));
    }
  }, []);

  const removeFromCart = useCallback((uniqueId) => {
    setCart(prev => prev.filter(i => i.uniqueId !== uniqueId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  // Hold/park current order
  const holdOrder = useCallback(() => {
    if (cart.length === 0) return;
    setHeldOrders(prev => [...prev, { id: Date.now(), items: cart, heldAt: new Date(), tableNumber: selectedTable?.tableNumber || '' }]);
    setCart([]);
    setSelectedTable(null);
  }, [cart, selectedTable]);

  // Recall a held order
  const recallHeldOrder = useCallback((heldId) => {
    const held = heldOrders.find(h => h.id === heldId);
    if (!held) return;
    // If current cart has items, hold it first
    if (cart.length > 0) {
      setHeldOrders(prev => [...prev.filter(h => h.id !== heldId), { id: Date.now(), items: cart, heldAt: new Date(), tableNumber: selectedTable?.tableNumber || '' }]);
    } else {
      setHeldOrders(prev => prev.filter(h => h.id !== heldId));
    }
    setCart(held.items);
    // Restore table if the held order had one
    if (held.tableNumber) {
      api.get(`/tables?businessId=${resolvedBusinessId}`).then(res => {
        const t = (res.data || []).find(tb => String(tb.tableNumber) === String(held.tableNumber));
        if (t) setSelectedTable(t);
        else setSelectedTable(null);
      }).catch(() => setSelectedTable(null));
    } else {
      setSelectedTable(null);
    }
  }, [cart, heldOrders, selectedTable, resolvedBusinessId]);

  // Delete a held order
  const deleteHeldOrder = useCallback((heldId) => {
    setHeldOrders(prev => prev.filter(h => h.id !== heldId));
  }, []);

  // Start new order (hold current if has items)
  const startNewOrder = useCallback(() => {
    if (cart.length > 0) {
      setHeldOrders(prev => [...prev, { id: Date.now(), items: cart, heldAt: new Date(), tableNumber: selectedTable?.tableNumber || '' }]);
    }
    setCart([]);
    setSelectedTable(null);
  }, [cart, selectedTable]);

  // Handle product click
  const handleProductClick = useCallback((product) => {
    if (product.toppingGroups && product.toppingGroups.length > 0) {
      setShowToppings(product);
    } else {
      addToCart(product);
    }
  }, [addToCart]);

  // Handle topping selection complete
  const handleToppingsComplete = useCallback((productWithToppings) => {
    addToCart(productWithToppings);
    setShowToppings(null);
  }, [addToCart]);

  // After order created
  const handleOrderComplete = useCallback((order) => {
    setLastOrder(order);
    setShowCheckout(false);
    clearCart();
    setSelectedTable(null);
    // Refresh cash register
    api.get(`/cash-register/current?businessId=${resolvedBusinessId}`)
      .then(res => setCashRegister(res.data))
      .catch(() => {});
  }, [clearCart, resolvedBusinessId]);

  // Cash register opened
  const handleCashOpened = useCallback((register) => {
    setCashRegister(register);
    setShowCashOpen(false);
  }, []);

  // Cash register closed
  const handleCashClosed = useCallback(() => {
    setCashRegister(null);
    setShowCashClose(false);
    setShowCashOpen(true);
  }, []);

  // Movement added
  const handleMovementAdded = useCallback((register) => {
    setCashRegister(register);
  }, []);

  const themeColor = businessConfig?.theme?.buttonColor || '#3B82F6';

  // Gate: POS beta must be enabled
  if (!loading && !businessConfig?.features?.posBetaEnabled) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-100 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Punto de Venta</h2>
        <p className="text-sm text-slate-500 mb-6 max-w-sm">El módulo POS está en fase beta. Contacta al administrador para activarlo en tu negocio.</p>
        <button onClick={() => navigate(`/${businessId}/admin`)} className="px-6 py-2.5 rounded-xl text-white font-bold text-sm" style={{ backgroundColor: themeColor }}>Volver al panel</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: themeColor }} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden select-none">
      <POSHeader
        businessConfig={businessConfig}
        cashRegister={cashRegister}
        user={user}
        pendingOrdersCount={pendingOrdersCount}
        showOrderBanner={showOrderBanner}
        newOrderNotification={newOrderNotification}
        onDismissBanner={() => setShowOrderBanner(false)}
        onGoToOrders={() => navigate(`/${businessId}/admin`)}
        onOpenMovements={() => setShowMovements(true)}
        onCloseCash={() => setShowCashClose(true)}
        onNewOrder={startNewOrder}
        onExit={() => navigate(`/${businessId}/admin`)}
      />

      <div className="flex-1 flex min-h-0">
        {/* Left panel: product grid or table map */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Tab bar */}
          <div className="flex gap-1 px-3 pt-2 pb-1 bg-white border-b border-slate-200 flex-shrink-0">
            <button
              onClick={() => setShowTables(false)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                !showTables ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              style={!showTables ? { backgroundColor: themeColor } : {}}
            >
              Productos
            </button>
            <button
              onClick={() => setShowTables(true)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                showTables ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              style={showTables ? { backgroundColor: themeColor } : {}}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Mesas
              {selectedTable && (
                <span className="bg-white/30 px-1.5 py-0.5 rounded text-[10px]">M{selectedTable.tableNumber}</span>
              )}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {showTables ? (
              <POSTableMap
                businessId={resolvedBusinessId}
                selectedTable={selectedTable}
                onSelectTable={setSelectedTable}
                activeOrders={activeOrders}
                heldOrders={heldOrders}
              />
            ) : (
              <POSProductGrid
                products={products}
                categories={categories}
                onProductClick={handleProductClick}
                themeColor={themeColor}
              />
            )}
          </div>
        </div>

        {/* Cart — right ~35% */}
        <div className="w-[340px] lg:w-[380px] flex-shrink-0 border-l border-slate-200 bg-white flex flex-col">
          <POSCart
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            onCheckout={() => setShowCheckout(true)}
            onHoldOrder={holdOrder}
            heldOrders={heldOrders}
            onRecallHeldOrder={recallHeldOrder}
            onDeleteHeldOrder={deleteHeldOrder}
            selectedTable={selectedTable}
            onClearTable={() => setSelectedTable(null)}
            themeColor={themeColor}
          />
        </div>
      </div>

      {/* Modals */}
      {showCheckout && (
        <POSCheckoutModal
          cart={cart}
          businessConfig={businessConfig}
          onClose={() => setShowCheckout(false)}
          onOrderComplete={handleOrderComplete}
          cashRegister={cashRegister}
          preselectedTable={selectedTable}
        />
      )}

      {showCashOpen && (
        <POSCashRegister
          mode="open"
          businessId={resolvedBusinessId}
          onComplete={handleCashOpened}
          onClose={() => { if (cashRegister) setShowCashOpen(false); else navigate(`/${businessId}/admin`); }}
        />
      )}

      {showCashClose && cashRegister && (
        <POSCashRegister
          mode="close"
          businessId={resolvedBusinessId}
          cashRegister={cashRegister}
          onComplete={handleCashClosed}
          onClose={() => setShowCashClose(false)}
        />
      )}

      {showMovements && cashRegister && (
        <POSCashRegister
          mode="movements"
          businessId={resolvedBusinessId}
          cashRegister={cashRegister}
          onMovementAdded={handleMovementAdded}
          onClose={() => setShowMovements(false)}
        />
      )}

      {showToppings && (
        <ProductToppingsSelector
          product={showToppings}
          onAddToCart={handleToppingsComplete}
          onClose={() => setShowToppings(null)}
          compact
        />
      )}

      {lastOrder && (
        <POSTicket
          order={lastOrder}
          businessConfig={businessConfig}
          onClose={() => setLastOrder(null)}
        />
      )}
    </div>
  );
}

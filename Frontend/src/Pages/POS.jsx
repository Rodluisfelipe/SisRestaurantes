import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useAuth } from '../Context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../services/api';
import { socket, joinBusiness } from '../services/socket';
import { SOCKET_EVENTS, ORDER_STATUS } from '../utils/constants';
import usePOSOffline from '../hooks/usePOSOffline';
import { cacheProducts, getCachedProducts, cacheCategories, getCachedCategories } from '../services/posOfflineStore';
import POSHeader from '../Components/POS/POSHeader';
import POSProductGrid from '../Components/POS/POSProductGrid';
import POSCart from '../Components/POS/POSCart';
import POSCheckoutModal from '../Components/POS/POSCheckoutModal';
import POSCashRegister from '../Components/POS/POSCashRegister';
import POSTicket from '../Components/POS/POSTicket';
import POSTableMap from '../Components/POS/POSTableMap';
import POSActiveOrders from '../Components/POS/POSActiveOrders';
import ProductToppingsSelector from '../Components/ProductToppingsSelector';
import { CalculatorLauncher } from '../Components/Admin/Calculator';

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
  const [activeTab, setActiveTab] = useState('products'); // products, tables, orders
  const [activeOrders, setActiveOrders] = useState([]);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [payingTab, setPayingTab] = useState(null); // orden de cuenta abierta que se está cobrando
  const [tabBusy, setTabBusy] = useState(false);

  /* Agente de impresión: si hay uno conectado el ticket sale solo y el modal
     sobra. Si no lo hay, el modal sigue siendo la única forma de imprimir. */
  const [printAgent, setPrintAgent] = useState({ connected: false, mode: 'both' });
  const [printToast, setPrintToast] = useState(null);

  // Order notifications (web orders arriving)
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [newOrderNotification, setNewOrderNotification] = useState(null);
  const [showOrderBanner, setShowOrderBanner] = useState(false);
  const audioRef = useRef(null);

  // Offline mode
  const offline = usePOSOffline();

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
  const refreshActiveOrders = useCallback(() => {
    if (!resolvedBusinessId) return;
    api.get(`/orders?businessId=${resolvedBusinessId}&status=confirmed,preparing,ready&_t=${Date.now()}`)
      .then(res => setActiveOrders(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [resolvedBusinessId]);

  useEffect(() => {
    if (!resolvedBusinessId) return;
    refreshActiveOrders();
    const interval = setInterval(refreshActiveOrders, 15000);
    return () => clearInterval(interval);
  }, [resolvedBusinessId, refreshActiveOrders]);

  /* Estado del agente de impresión. Se revisa cada minuto porque el agente
     puede caerse (o encenderse) en mitad del turno, y de eso depende si el
     cajero ve el modal o no. Ante un error se asume que no hay agente: es
     preferible mostrar el modal de más que dejar al cajero sin ticket. */
  useEffect(() => {
    if (!resolvedBusinessId) return;
    let alive = true;
    const check = () => api.get('/print-agent/status')
      .then(res => { if (alive) setPrintAgent(res.data || { connected: false }); })
      .catch(() => { if (alive) setPrintAgent({ connected: false, mode: 'both' }); });
    check();
    const interval = setInterval(check, 60000);
    return () => { alive = false; clearInterval(interval); };
  }, [resolvedBusinessId]);

  // El aviso de "ticket enviado" se va solo: no es algo que haya que cerrar
  useEffect(() => {
    if (!printToast) return;
    const t = setTimeout(() => setPrintToast(null), 3500);
    return () => clearTimeout(t);
  }, [printToast]);

  // Fetch products, categories, and cash register (with offline fallback)
  useEffect(() => {
    if (!resolvedBusinessId) return;
    const fetchData = async () => {
      try {
        const [productsRes, categoriesRes, cashRes] = await Promise.all([
          api.get(`/products?businessId=${resolvedBusinessId}`),
          api.get(`/categories?businessId=${resolvedBusinessId}`),
          api.get(`/cash-register/current?businessId=${resolvedBusinessId}`)
        ]);
        const filteredProducts = productsRes.data.filter(p => p.active !== false);
        const filteredCategories = categoriesRes.data.filter(c => c.active !== false).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        setProducts(filteredProducts);
        setCategories(filteredCategories);
        setCashRegister(cashRes.data);
        if (!cashRes.data) setShowCashOpen(true);
        // Cache for offline use
        cacheProducts(filteredProducts).catch(() => {});
        cacheCategories(filteredCategories).catch(() => {});
      } catch (err) {
        console.error('POS fetch error:', err);
        // Offline fallback: load from IndexedDB
        try {
          const cachedProducts = await getCachedProducts();
          const cachedCategories = await getCachedCategories();
          if (cachedProducts.length > 0) {
            setProducts(cachedProducts);
            setCategories(cachedCategories.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)));
          }
        } catch {}
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
    setShowCheckout(false);
    clearCart();
    setSelectedTable(null);

    /* Con el agente conectado el ticket ya está saliendo: al crear la orden el
       servidor emite order_created y el agente imprime según su modo. Pedirle
       al cajero que confirme una impresión que ya ocurrió solo lo demora.
       Sin agente —o con la orden en cola offline, que aún no llegó al
       servidor— el modal es la única salida y se muestra igual que antes. */
    if (printAgent.connected && !order._offline) {
      setPrintToast({ text: `Ticket #${order.orderNumber || ''} enviado a la impresora`, order });
    } else {
      setLastOrder(order);
    }

    // Only refresh cash register if order was created online
    if (!order._offline) {
      api.get(`/cash-register/current?businessId=${resolvedBusinessId}`)
        .then(res => setCashRegister(res.data))
        .catch(() => {});
    }
  }, [clearCart, resolvedBusinessId, printAgent.connected]);

  // Enviar el carrito a la cuenta abierta de la mesa (crear o acumular). No cobra.
  const handleSendToTab = useCallback(async () => {
    if (cart.length === 0 || !selectedTable || tabBusy) return;
    setTabBusy(true);
    try {
      const existing = activeOrders.find(o => o.posOpenTab && String(o.tableNumber) === String(selectedTable.tableNumber));
      if (existing) {
        // Acumular: add-items recalcula con base + toppings, así que enviamos precio base
        const items = cart.map(item => ({
          productId: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          selectedToppings: item.selectedToppings || [],
        }));
        await api.patch(`/orders/${existing._id}/add-items`, { businessId: resolvedBusinessId, items });
      } else {
        // Crear cuenta: create usa totalAmount directo, enviamos precio con toppings incluidos
        const items = cart.map(item => ({
          productId: item._id,
          name: item.name,
          price: item.totalPrice || item.price,
          quantity: item.quantity,
          selectedToppings: item.selectedToppings || [],
        }));
        const subtotal = cart.reduce((s, i) => s + (i.totalPrice || i.price || 0) * i.quantity, 0);
        await api.post('/orders', {
          businessId: resolvedBusinessId,
          customerName: `${businessConfig?.businessType === 'hotel' ? 'Hab.' : 'Mesa'} ${selectedTable.tableNumber}`,
          orderType: 'inSite',
          tableNumber: String(selectedTable.tableNumber),
          items,
          totalAmount: String(subtotal),
          orderChannel: 'pos',
          posOpenTab: true,
        });
      }
      setCart([]);
      setShowMobileCart(false);
      refreshActiveOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al enviar a la cuenta');
    } finally {
      setTabBusy(false);
    }
  }, [cart, selectedTable, activeOrders, tabBusy, resolvedBusinessId, businessConfig, refreshActiveOrders]);

  // Abrir el checkout en modo cobro de cuenta
  const handlePayTab = useCallback((tab) => {
    setShowMobileCart(false);
    setPayingTab(tab);
  }, []);

  // Tras cobrar la cuenta
  const handleTabPaid = useCallback((order) => {
    setPayingTab(null);
    setSelectedTable(null);
    setCart([]);

    /* La cuenta abierta ya emitió order_created cuando se abrió (ahí salió la
       comanda), así que al cobrar no se dispara nada: hay que pedir el recibo
       a mano. Si falla el envío se cae al modal para no dejar al cliente
       esperando un ticket que nunca salió. */
    if (printAgent.connected && order?._id) {
      api.post(`/print-agent/print-receipt/${order._id}`)
        .then(() => setPrintToast({ text: `Ticket #${order.orderNumber || ''} enviado a la impresora`, order }))
        .catch(() => setLastOrder(order));
    } else {
      setLastOrder(order);
    }

    refreshActiveOrders();
    api.get(`/cash-register/current?businessId=${resolvedBusinessId}`)
      .then(res => setCashRegister(res.data))
      .catch(() => {});
  }, [refreshActiveOrders, resolvedBusinessId, printAgent.connected]);

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

  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + (item.totalPrice || item.price || 0) * item.quantity, 0);

  // Cuenta abierta de la mesa seleccionada (si existe)
  const openTab = selectedTable
    ? activeOrders.find(o => o.posOpenTab && String(o.tableNumber) === String(selectedTable.tableNumber))
    : null;

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
        onGoToOrders={() => { setActiveTab('orders'); setShowTables(false); }}
        onOpenMovements={() => setShowMovements(true)}
        onCloseCash={() => setShowCashClose(true)}
        onNewOrder={startNewOrder}
        onExit={() => navigate(`/${businessId}/admin`)}
        /* El panel lee `?tab=` al arrancar, así que se puede llegar
           directamente a los chats sin pasar por el inicio. */
        onIrAPanel={(panel) => navigate(
          panel.id === 'dashboard' ? `/${businessId}/admin` : `/${businessId}/admin?tab=${panel.id}`
        )}
        offline={offline}
      />

      <div className="flex-1 flex min-h-0">
        {/* Left panel: product grid or table map */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Tab bar — segmented control */}
          <div className="px-3 lg:px-4 pt-2 lg:pt-3 pb-2 bg-white border-b border-slate-100 flex-shrink-0">
            <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => { setActiveTab('products'); setShowTables(false); }}
                className={`px-3 lg:px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 lg:gap-2 ${
                  activeTab === 'products' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <span className="hidden sm:inline">Productos</span>
              </button>
              <button
                onClick={() => { setActiveTab('orders'); setShowTables(false); }}
                className={`px-3 lg:px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 lg:gap-2 ${
                  activeTab === 'orders' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                <span className="hidden sm:inline">Órdenes</span>
                {activeOrders.length > 0 && (
                  <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-black min-w-[18px] text-center animate-pulse">{activeOrders.length}</span>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('tables'); setShowTables(true); }}
                className={`px-3 lg:px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 lg:gap-2 ${
                  activeTab === 'tables' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                <span className="hidden sm:inline">Mesas</span>
                {selectedTable && (
                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">M{selectedTable.tableNumber}</span>
                )}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {activeTab === 'tables' ? (
              <POSTableMap
                businessId={resolvedBusinessId}
                selectedTable={selectedTable}
                onSelectTable={setSelectedTable}
                activeOrders={activeOrders}
                heldOrders={heldOrders}
              />
            ) : activeTab === 'orders' ? (
              <POSActiveOrders
                businessId={resolvedBusinessId}
                themeColor={themeColor}
                businessConfig={businessConfig}
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

        {/* Cart — desktop: fixed sidebar */}
        <div className="hidden lg:flex w-[380px] flex-shrink-0 border-l border-slate-200 bg-white flex-col">
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
            openTab={openTab}
            onSendToTab={handleSendToTab}
            onPayTab={handlePayTab}
            tabBusy={tabBusy}
            themeColor={themeColor}
          />
        </div>
      </div>

      {/* Mobile: floating cart button */}
      {cartItemCount > 0 && !showMobileCart && (
        <div className="lg:hidden fixed bottom-5 left-4 right-4 z-40">
          <button
            onClick={() => setShowMobileCart(true)}
            className="w-full py-4 rounded-2xl text-white font-bold text-[15px] shadow-xl flex items-center justify-between px-5 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: themeColor }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
              </div>
              <span>{cartItemCount} artículo{cartItemCount !== 1 ? 's' : ''}</span>
            </div>
            <span className="text-lg font-black">${cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* Mobile: cart overlay (slide-up bottom sheet) */}
      <AnimatePresence>
        {showMobileCart && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMobileCart(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl flex flex-col"
              style={{ maxHeight: '85vh' }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-200" />
              </div>
              <POSCart
                cart={cart}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
                clearCart={clearCart}
                onCheckout={() => { setShowMobileCart(false); setShowCheckout(true); }}
                onHoldOrder={() => { holdOrder(); setShowMobileCart(false); }}
                heldOrders={heldOrders}
                onRecallHeldOrder={(id) => { recallHeldOrder(id); setShowMobileCart(false); }}
                onDeleteHeldOrder={deleteHeldOrder}
                selectedTable={selectedTable}
                onClearTable={() => setSelectedTable(null)}
                openTab={openTab}
                onSendToTab={handleSendToTab}
                onPayTab={handlePayTab}
                tabBusy={tabBusy}
                themeColor={themeColor}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {showCheckout && (
        <POSCheckoutModal
          cart={cart}
          businessConfig={businessConfig}
          onClose={() => setShowCheckout(false)}
          onOrderComplete={handleOrderComplete}
          cashRegister={cashRegister}
          preselectedTable={selectedTable}
          isOnline={offline.isOnline}
        />
      )}

      {payingTab && (
        <POSCheckoutModal
          cart={(payingTab.items || []).map((it, i) => ({ ...it, uniqueId: `tab-${i}`, totalPrice: it.price, quantity: it.quantity }))}
          businessConfig={businessConfig}
          tabOrder={payingTab}
          onClose={() => setPayingTab(null)}
          onOrderComplete={handleTabPaid}
          cashRegister={cashRegister}
          isOnline={offline.isOnline}
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
          businessConfig={businessConfig}
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

      {/* La misma calculadora del panel: el cajero es quien más cuentas
          hace y no deberia salir del POS para hacerlas. */}
      <CalculatorLauncher />

      {/* Confirmación de que el ticket salió por el agente. No bloquea: el
          cajero sigue vendiendo mientras la impresora trabaja. */}
      <AnimatePresence>
        {printToast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-2xl text-sm font-semibold"
          >
            <svg className="w-5 h-5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>{printToast.text}</span>
            {/* Salida manual: si la impresora se atascó o faltó papel, el
                cajero abre el ticket y lo reimprime sin buscar el pedido */}
            {printToast.order && (
              <button
                onClick={() => { setLastOrder(printToast.order); setPrintToast(null); }}
                className="ml-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 transition-colors text-xs font-bold"
              >
                Ver ticket
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

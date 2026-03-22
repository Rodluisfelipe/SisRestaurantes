import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useAuth } from '../Context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import ProductToppingsSelector from '../Components/ProductToppingsSelector';

// ─── Icons (inline SVG for zero deps) ───────────────────────────────
const IconTable = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const IconMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);
const IconCart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
  </svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4">
    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-5 h-5">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const IconMinus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4"><path d="M5 12h14" /></svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);
const IconBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
);

// ─── Table status colors ────────────────────────────────────────────
const TABLE_STATUS = {
  available: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  occupied:  { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', dot: 'bg-orange-500' },
  selected:  { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-700', dot: 'bg-indigo-500', ring: 'ring-2 ring-indigo-300' },
};

export default function Waiter() {
  const { businessConfig } = useBusinessConfig();
  const { user } = useAuth();
  const { businessId } = useParams();
  const navigate = useNavigate();

  const resolvedBusinessId = businessConfig?._id || businessId;
  const themeColor = businessConfig?.theme?.buttonColor || '#6366f1';
  const isHotel = businessConfig?.businessType === 'hotel';
  const tableLabel = isHotel ? 'Hab.' : 'Mesa';

  // ─── State ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('tables');
  const [loading, setLoading] = useState(true);

  // Tables
  const [floors, setFloors] = useState([]);
  const [tables, setTables] = useState([]);
  const [activeFloor, setActiveFloor] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);

  // Menu
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showToppings, setShowToppings] = useState(null);

  // Cart
  const [cart, setCart] = useState([]);

  // Order
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // ─── Data fetching ──────────────────────────────────────────────
  useEffect(() => {
    if (!resolvedBusinessId) return;
    setLoading(true);
    Promise.all([
      api.get(`/floors?businessId=${resolvedBusinessId}`),
      api.get(`/tables?businessId=${resolvedBusinessId}`),
      api.get(`/products?businessId=${resolvedBusinessId}`),
      api.get(`/categories?businessId=${resolvedBusinessId}`),
      api.get(`/orders?businessId=${resolvedBusinessId}&status=confirmed,preparing,ready`),
    ]).then(([fRes, tRes, pRes, cRes, oRes]) => {
      const floorData = fRes.data || [];
      setFloors(floorData);
      setTables(tRes.data || []);
      if (floorData.length > 0) setActiveFloor(floorData[0]._id);
      setProducts(pRes.data || []);
      setCategories(cRes.data || []);
      setActiveOrders(Array.isArray(oRes.data) ? oRes.data : []);
    }).catch(err => console.error('Error loading waiter data', err))
      .finally(() => setLoading(false));
  }, [resolvedBusinessId]);

  // Refresh active orders periodically
  useEffect(() => {
    if (!resolvedBusinessId) return;
    const interval = setInterval(() => {
      api.get(`/orders?businessId=${resolvedBusinessId}&status=confirmed,preparing,ready`)
        .then(res => setActiveOrders(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [resolvedBusinessId]);

  // ─── Occupied tables ───────────────────────────────────────────
  const occupiedTables = useMemo(() => {
    const set = new Set();
    activeOrders.forEach(o => { if (o.tableNumber) set.add(String(o.tableNumber)); });
    return set;
  }, [activeOrders]);

  const getTableStatus = (table) => {
    if (selectedTable?._id === table._id) return 'selected';
    if (occupiedTables.has(String(table.tableNumber))) return 'occupied';
    return 'available';
  };

  // ─── Floor tables ─────────────────────────────────────────────
  const floorTables = useMemo(() => {
    if (!activeFloor) return tables;
    const ft = tables.filter(t => t.floorId === activeFloor);
    return ft.length > 0 ? ft : tables;
  }, [tables, activeFloor]);

  // ─── Filtered products ────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    let items = products;
    if (activeCategory !== 'all') {
      items = items.filter(p => {
        const catId = typeof p.category === 'object' ? p.category?._id : p.category;
        return catId === activeCategory;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(p => p.name.toLowerCase().includes(q));
    }
    return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [products, activeCategory, search]);

  // ─── Cart operations ──────────────────────────────────────────
  const cartCount = useMemo(() => cart.reduce((sum, i) => sum + i.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + (i.totalPrice || i.price || 0) * i.quantity, 0), [cart]);

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
    if (qty <= 0) setCart(prev => prev.filter(i => i.uniqueId !== uniqueId));
    else setCart(prev => prev.map(i => i.uniqueId === uniqueId ? { ...i, quantity: qty } : i));
  }, []);

  const removeFromCart = useCallback((uniqueId) => {
    setCart(prev => prev.filter(i => i.uniqueId !== uniqueId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  // ─── Product click ────────────────────────────────────────────
  const handleProductClick = useCallback((product) => {
    if (product.toppingGroups && product.toppingGroups.length > 0) {
      setShowToppings(product);
    } else {
      addToCart(product);
      // Quick feedback
      setToast({ type: 'add', text: product.name });
      setTimeout(() => setToast(null), 1500);
    }
  }, [addToCart]);

  const handleToppingsComplete = useCallback((productWithToppings) => {
    addToCart(productWithToppings);
    setShowToppings(null);
    setToast({ type: 'add', text: productWithToppings.name });
    setTimeout(() => setToast(null), 1500);
  }, [addToCart]);

  // ─── Submit order ─────────────────────────────────────────────
  const handleSubmitOrder = async () => {
    if (submitting || cart.length === 0) return;
    setSubmitting(true);
    try {
      const items = cart.map(item => ({
        productId: item._id,
        name: item.name,
        price: item.totalPrice || item.price,
        quantity: item.quantity,
        selectedToppings: item.selectedToppings || [],
      }));

      const orderData = {
        businessId: resolvedBusinessId,
        customerName: selectedTable ? `${tableLabel} ${selectedTable.tableNumber}` : 'Mesero',
        orderType: 'inSite',
        tableNumber: selectedTable?.tableNumber || '',
        orderChannel: 'pos',
        items,
        totalAmount: String(cartTotal),
        paymentMethod: 'cash',
        staffId: user?._id,
        staffName: user?.name,
      };

      await api.post('/orders', orderData);

      // Refresh active orders
      api.get(`/orders?businessId=${resolvedBusinessId}&status=confirmed,preparing,ready`)
        .then(res => setActiveOrders(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});

      clearCart();
      setToast({ type: 'success', text: `Pedido enviado — ${tableLabel} ${selectedTable?.tableNumber || ''}` });
      setTimeout(() => setToast(null), 3000);
      setActiveTab('tables');
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al enviar pedido';
      setToast({ type: 'error', text: msg });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Cargando comanda...</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="h-dvh flex flex-col bg-slate-50 select-none overflow-hidden">

      {/* ═══ HEADER ═══ */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between safe-area-top">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-500 active:scale-95 transition-all">
            <IconBack />
          </button>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">Comanda</h1>
            <p className="text-[10px] text-slate-400 leading-tight">{user?.name || 'Mesero'}</p>
          </div>
        </div>

        {/* Selected table badge */}
        {selectedTable && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: themeColor }}>
            {tableLabel} {selectedTable.tableNumber}
            <button onClick={() => setSelectedTable(null)} className="opacity-70 hover:opacity-100">
              <IconX />
            </button>
          </div>
        )}

        {!selectedTable && (
          <span className="text-[11px] text-slate-400 italic">Sin mesa</span>
        )}
      </header>

      {/* ═══ CONTENT AREA ═══ */}
      <main className="flex-1 overflow-hidden">

        {/* ── TABLES TAB ── */}
        {activeTab === 'tables' && (
          <div className="h-full flex flex-col">
            {/* Floor selector */}
            {floors.length > 0 && (
              <div className="flex gap-1.5 px-4 pt-3 pb-2 overflow-x-auto flex-shrink-0 no-scrollbar">
                {floors.map(floor => (
                  <button
                    key={floor._id}
                    onClick={() => setActiveFloor(floor._id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                      activeFloor === floor._id
                        ? 'bg-slate-800 text-white shadow-md'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {floor.name}
                  </button>
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="flex gap-4 px-4 pb-2 flex-shrink-0">
              {[
                { label: 'Libre', color: 'bg-emerald-500' },
                { label: 'Ocupada', color: 'bg-orange-500' },
                { label: 'Seleccionada', color: 'bg-indigo-500' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className={`w-2 h-2 rounded-full ${l.color}`} /> {l.label}
                </span>
              ))}
            </div>

            {/* Table grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {floorTables.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <IconTable />
                  <p className="text-sm font-medium mt-2">Sin mesas configuradas</p>
                  <p className="text-xs text-slate-300">Configura mesas desde el panel admin</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {floorTables.map(table => {
                    const status = getTableStatus(table);
                    const s = TABLE_STATUS[status];
                    return (
                      <button
                        key={table._id}
                        onClick={() => {
                          setSelectedTable(status === 'selected' ? null : table);
                          if (status !== 'selected') setActiveTab('menu');
                        }}
                        className={`relative rounded-xl border-2 p-4 transition-all active:scale-95 ${s.bg} ${s.border} ${s.ring || ''}`}
                      >
                        <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${s.dot}`} />
                        <p className={`text-2xl font-black ${s.text}`}>{table.tableNumber}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">{tableLabel}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MENU TAB ── */}
        {activeTab === 'menu' && (
          <div className="h-full flex flex-col">
            {/* Search */}
            <div className="px-4 pt-3 pb-1 flex-shrink-0">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><IconSearch /></span>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                    <IconX />
                  </button>
                )}
              </div>
            </div>

            {/* Categories */}
            <div className="flex gap-1.5 px-4 py-2 overflow-x-auto flex-shrink-0 no-scrollbar">
              <button
                onClick={() => setActiveCategory('all')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
                  activeCategory === 'all' ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}
                style={activeCategory === 'all' ? { backgroundColor: themeColor } : undefined}
              >
                Todos ({products.length})
              </button>
              {categories.map(cat => {
                const count = products.filter(p => {
                  const catId = typeof p.category === 'object' ? p.category?._id : p.category;
                  return catId === cat._id;
                }).length;
                return (
                  <button
                    key={cat._id}
                    onClick={() => setActiveCategory(cat._id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
                      activeCategory === cat._id ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                    }`}
                    style={activeCategory === cat._id ? { backgroundColor: themeColor } : undefined}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <IconSearch />
                  <p className="text-sm font-medium mt-3">Sin resultados</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredProducts.map(product => {
                    const hasExtras = product.toppingGroups && product.toppingGroups.length > 0;
                    return (
                      <button
                        key={product._id}
                        onClick={() => handleProductClick(product)}
                        className="bg-white rounded-xl border border-slate-100 p-3 text-left active:scale-[0.97] transition-all shadow-sm"
                      >
                        {product.image && (
                          <div className="w-full aspect-[4/3] rounded-lg bg-slate-100 mb-2 overflow-hidden">
                            <img src={product.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                        <p className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-2">{product.name}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-sm font-black" style={{ color: themeColor }}>${product.price?.toLocaleString()}</span>
                          {hasExtras && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">+Extras</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CART TAB ── */}
        {activeTab === 'cart' && (
          <div className="h-full flex flex-col">
            {/* Cart header */}
            <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Pedido {selectedTable ? `— ${tableLabel} ${selectedTable.tableNumber}` : ''}
              </h2>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-xs text-red-500 font-medium px-2 py-1 rounded-md hover:bg-red-50 active:scale-95 transition-all">
                  Vaciar
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 px-6">
                <IconCart />
                <p className="text-sm font-medium mt-3">Carrito vacío</p>
                <p className="text-xs text-slate-300 mt-1 text-center">
                  Selecciona una mesa y agrega productos del menú
                </p>
                <button
                  onClick={() => setActiveTab('menu')}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-bold text-white active:scale-95 transition-all"
                  style={{ backgroundColor: themeColor }}
                >
                  Ir al menú
                </button>
              </div>
            ) : (
              <>
                {/* Cart items */}
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  <div className="space-y-2">
                    {cart.map(item => {
                      const price = (item.totalPrice || item.price || 0) * item.quantity;
                      const toppingSummary = item.selectedToppings
                        ? Object.values(item.selectedToppings).flat()
                            .map(t => t?.optionName || t?.name || '')
                            .filter(Boolean)
                            .join(', ')
                        : '';
                      return (
                        <div key={item.uniqueId} className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 leading-snug">{item.name}</p>
                              {toppingSummary && (
                                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{toppingSummary}</p>
                              )}
                            </div>
                            <p className="text-sm font-black shrink-0" style={{ color: themeColor }}>${price.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.uniqueId, item.quantity - 1)}
                                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 active:bg-slate-200 transition-all"
                              >
                                <IconMinus />
                              </button>
                              <span className="text-sm font-bold text-slate-800 w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.uniqueId, item.quantity + 1)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white active:scale-95 transition-all"
                                style={{ backgroundColor: themeColor }}
                              >
                                <IconPlus />
                              </button>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.uniqueId)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 active:scale-95 transition-all"
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cart footer */}
                <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-3 safe-area-bottom">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-500">{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                    <span className="text-xl font-black" style={{ color: themeColor }}>${cartTotal.toLocaleString()}</span>
                  </div>

                  {!selectedTable && (
                    <p className="text-[11px] text-amber-600 font-medium bg-amber-50 rounded-lg px-3 py-2 mb-2 text-center">
                      Selecciona una mesa antes de enviar el pedido
                    </p>
                  )}

                  <button
                    onClick={handleSubmitOrder}
                    disabled={submitting || cart.length === 0 || !selectedTable}
                    className="w-full py-3.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100"
                    style={{ backgroundColor: themeColor }}
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <IconCheck />
                        Enviar Pedido
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* ═══ BOTTOM NAVIGATION ═══ */}
      <nav className="flex-shrink-0 bg-white border-t border-slate-200 flex safe-area-bottom">
        {[
          { id: 'tables', label: 'Mesas', icon: IconTable },
          { id: 'menu', label: 'Menú', icon: IconMenu },
          { id: 'cart', label: 'Carrito', icon: IconCart, badge: cartCount },
        ].map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative ${
                active ? 'text-indigo-600' : 'text-slate-400'
              }`}
              style={active ? { color: themeColor } : undefined}
            >
              <div className="relative">
                <tab.icon />
                {tab.badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1"
                    style={{ backgroundColor: themeColor }}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">{tab.label}</span>
              {active && (
                <motion.div
                  layoutId="waiter-tab-indicator"
                  className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full"
                  style={{ backgroundColor: themeColor }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* ═══ TOPPINGS MODAL ═══ */}
      {showToppings && (
        <ProductToppingsSelector
          product={showToppings}
          onAddToCart={handleToppingsComplete}
          onClose={() => setShowToppings(null)}
          compact
        />
      )}

      {/* ═══ TOAST ═══ */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            className={`fixed bottom-20 left-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg text-sm font-bold text-center ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' :
              toast.type === 'error' ? 'bg-red-600 text-white' :
              'bg-slate-800 text-white'
            }`}
          >
            {toast.type === 'success' && '✓ '}{toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

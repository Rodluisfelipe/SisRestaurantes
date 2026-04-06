import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaSearch, FaPlus, FaMinus, FaUser, FaPhone, FaShoppingCart, FaChair, FaHome, FaTruck, FaMoneyBillWave, FaTrash, FaCheck } from 'react-icons/fa';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

const ORDER_TYPES = [
  { value: 'inSite', label: 'En sitio', Icon: FaChair, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'takeaway', label: 'Para llevar', Icon: FaShoppingCart, color: 'bg-orange-50 text-orange-600 border-orange-200' },
  { value: 'delivery', label: 'Domicilio', Icon: FaTruck, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'other', label: 'Otro' },
];

export default function QuickOrderModal({ isOpen, onClose, onOrderCreated }) {
  const { businessId, businessConfig } = useBusinessConfig();

  // Steps: 'customer' -> 'products' -> 'review'
  const [step, setStep] = useState('customer');

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  // Order details
  const [orderType, setOrderType] = useState('inSite');
  const [tableNumber, setTableNumber] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerNotes, setCustomerNotes] = useState('');

  // Products
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);

  // UI
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const searchTimerRef = useRef(null);

  // Reset everything on open
  useEffect(() => {
    if (isOpen) {
      setStep('customer');
      setCustomerSearch('');
      setCustomerResults([]);
      setSelectedCustomer(null);
      setCustomerName('');
      setCustomerPhone('');
      setOrderType('inSite');
      setTableNumber('');
      setAddress('');
      setPaymentMethod('cash');
      setCustomerNotes('');
      setCart([]);
      setProductSearch('');
      setSelectedCategory('all');
      setError('');
    }
  }, [isOpen]);

  // Load products once
  useEffect(() => {
    if (!isOpen || !businessId) return;
    setLoadingProducts(true);
    Promise.all([
      api.get(`/products?businessId=${businessId}`),
      api.get(`/categories?businessId=${businessId}`)
    ]).then(([pRes, cRes]) => {
      setProducts(pRes.data.filter(p => p.active !== false));
      setCategories(cRes.data || []);
    }).catch(() => {}).finally(() => setLoadingProducts(false));
  }, [isOpen, businessId]);

  // Debounced customer search
  const searchCustomers = useCallback((query) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query || query.length < 2) { setCustomerResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const res = await api.get(`/customers?businessId=${businessId}&search=${encodeURIComponent(query)}&limit=5`);
        setCustomerResults(res.data.customers || res.data || []);
      } catch { setCustomerResults([]); }
      finally { setSearchingCustomer(false); }
    }, 300);
  }, [businessId]);

  useEffect(() => {
    searchCustomers(customerSearch);
  }, [customerSearch, searchCustomers]);

  const selectCustomer = (c) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerResults([]);
    setCustomerSearch('');
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
  };

  // Product filtering
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase());
      const matchCat = selectedCategory === 'all' || (p.category && (p.category._id === selectedCategory || p.category === selectedCategory));
      return matchSearch && matchCat;
    });
  }, [products, productSearch, selectedCategory]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(c => c.productId === product._id);
      if (existing) {
        return prev.map(c => c.productId === product._id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { productId: product._id, name: product.name, price: product.price, quantity: 1, selectedToppings: [] }];
    });
  };

  const updateCartQty = (index, delta) => {
    setCart(prev => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].quantity + delta };
      if (next[index].quantity <= 0) next.splice(index, 1);
      return next;
    });
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const canProceedToProducts = customerName.trim().length > 0;
  const canSubmit = cart.length > 0 && customerName.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const orderData = {
        businessId,
        customerName: customerName.trim(),
        phone: customerPhone.trim() || undefined,
        orderType,
        tableNumber: orderType === 'inSite' ? tableNumber : undefined,
        address: orderType === 'delivery' ? address : undefined,
        paymentMethod,
        customerNotes: customerNotes.trim() || undefined,
        orderChannel: 'admin',
        items: cart.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          selectedToppings: item.selectedToppings || [],
        })),
        totalAmount: cartTotal,
      };
      const res = await api.post('/orders', orderData);

      // Immediately set to inProgress
      try {
        await api.patch(`/orders/${res.data._id}/status`, { status: 'inProgress', businessId });
      } catch {
        // If transition fails (e.g. already inProgress), that's fine
      }

      onOrderCreated?.(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Error creando pedido');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-[70]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-t-2xl lg:rounded-xl w-full lg:max-w-lg max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <FaShoppingCart className="text-amber-600 text-xs" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Pedido rápido</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {['customer', 'products', 'review'].map((s, i) => (
                    <div key={s} className="flex items-center gap-1">
                      <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        step === s ? 'bg-slate-800 text-white' : i < ['customer', 'products', 'review'].indexOf(step) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                      }`}>{i + 1}</div>
                      {i < 2 && <div className="w-4 h-[1px] bg-slate-200" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center">
              <FaTimes className="text-xs text-slate-500" />
            </button>
          </div>

          {/* Step 1: Customer + Order Info */}
          {step === 'customer' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Customer search */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Cliente</label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <FaUser className="text-emerald-500 text-xs" />
                      <div>
                        <p className="text-[13px] font-semibold text-slate-800">{selectedCustomer.name}</p>
                        <p className="text-[11px] text-slate-500">{selectedCustomer.phone} · {selectedCustomer.totalOrders || 0} pedidos</p>
                      </div>
                    </div>
                    <button onClick={clearCustomer} className="text-slate-400 hover:text-red-500">
                      <FaTimes className="text-xs" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Buscar por nombre o teléfono..."
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-100 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                        autoFocus
                      />
                      {searchingCustomer && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    {/* Customer results dropdown */}
                    {customerResults.length > 0 && (
                      <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                        {customerResults.map(c => (
                          <button
                            key={c._id}
                            onClick={() => selectCustomer(c)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
                          >
                            <FaUser className="text-slate-400 text-xs shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-slate-800 truncate">{c.name}</p>
                              <p className="text-[11px] text-slate-500">{c.phone}</p>
                            </div>
                            <span className="text-[10px] text-slate-400">{c.totalOrders || 0} pedidos</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Manual entry */}
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-500">O ingresa manualmente:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 mb-0.5 block">Nombre *</label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Nombre"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 mb-0.5 block">Teléfono</label>
                          <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="300..."
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Order type */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Tipo de pedido</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ORDER_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setOrderType(t.value)}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-center transition-all border ${
                        orderType === t.value ? t.color + ' shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <t.Icon className="text-xs" />
                      <span className="text-[11px] font-semibold">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Table / Address */}
              {orderType === 'inSite' && (
                <div>
                  <label className="text-[10px] text-slate-400 mb-0.5 block">{businessConfig?.businessType === 'hotel' ? 'Habitación' : 'Mesa'}</label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder={businessConfig?.businessType === 'hotel' ? 'Ej: 201' : 'Ej: 5'}
                    className="w-full px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              )}
              {orderType === 'delivery' && (
                <div>
                  <label className="text-[10px] text-slate-400 mb-0.5 block">Dirección</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Dirección de entrega"
                    className="w-full px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              )}

              {/* Payment method */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Método de pago</label>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_METHODS.map(pm => (
                    <button
                      key={pm.value}
                      onClick={() => setPaymentMethod(pm.value)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                        paymentMethod === pm.value
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] text-slate-400 mb-0.5 block">Notas (opcional)</label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Observaciones del pedido..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                />
              </div>

              {/* Next */}
              <button
                onClick={() => setStep('products')}
                disabled={!canProceedToProducts}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40"
              >
                Siguiente — Elegir productos
              </button>
            </div>
          )}

          {/* Step 2: Products */}
          {step === 'products' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search + categories */}
              <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                    autoFocus
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button onClick={() => setSelectedCategory('all')} className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${selectedCategory === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Todos</button>
                  {categories.map(cat => (
                    <button key={cat._id} onClick={() => setSelectedCategory(cat._id)} className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${selectedCategory === cat._id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{cat.name}</button>
                  ))}
                </div>
              </div>

              {/* Product list */}
              <div className="flex-1 overflow-y-auto px-4 pb-2">
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">No se encontraron productos</p>
                ) : (
                  <div className="space-y-0.5">
                    {filteredProducts.map(product => {
                      const inCart = cart.find(c => c.productId === product._id);
                      return (
                        <div key={product._id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-slate-800 truncate">{product.name}</p>
                            <p className="text-[11px] text-slate-500">${product.price?.toLocaleString()}</p>
                          </div>
                          {inCart ? (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => updateCartQty(cart.indexOf(inCart), -1)} className="w-7 h-7 bg-slate-200 hover:bg-slate-300 rounded-md flex items-center justify-center">
                                <FaMinus className="text-[8px] text-slate-600" />
                              </button>
                              <span className="text-xs font-bold text-slate-800 w-5 text-center">{inCart.quantity}</span>
                              <button onClick={() => updateCartQty(cart.indexOf(inCart), 1)} className="w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded-md flex items-center justify-center">
                                <FaPlus className="text-[8px] text-white" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(product)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold rounded-lg transition-colors">
                              Agregar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom bar with cart count + nav */}
              <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setStep('customer')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  ← Atrás
                </button>
                <button
                  onClick={() => setStep('review')}
                  disabled={cart.length === 0}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <FaShoppingCart className="text-xs" />
                  Revisar ({cart.length}) · ${cartTotal.toLocaleString()}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {step === 'review' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Customer summary */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <FaUser className="text-xs text-slate-400" />
                  <span className="text-[13px] font-medium text-slate-800">{customerName}</span>
                  {customerPhone && <span className="text-[11px] text-slate-500">· {customerPhone}</span>}
                </div>
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <span className="capitalize">{ORDER_TYPES.find(t => t.value === orderType)?.label}</span>
                  {tableNumber && <span>· Mesa {tableNumber}</span>}
                  {address && <span>· {address}</span>}
                  <span>· {PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label}</span>
                </div>
                {customerNotes && <p className="text-[11px] text-amber-600">Nota: {customerNotes}</p>}
              </div>

              {/* Cart items */}
              <div>
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Productos ({cart.length})</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {cart.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-white">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-slate-800">{item.name}</span>
                          <span className="text-[11px] text-slate-400">x{item.quantity}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-slate-800">${(item.price * item.quantity).toLocaleString()}</span>
                        <button onClick={() => removeFromCart(i)} className="text-red-400 hover:text-red-600">
                          <FaTrash className="text-[10px]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-slate-800 text-white rounded-lg px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-bold">Total</span>
                <span className="text-lg font-bold">${cartTotal.toLocaleString()}</span>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                El pedido se creará en estado <strong>En preparación</strong>. No se envía mensaje al cliente.
              </p>

              {error && <p className="text-[12px] text-red-500 text-center">{error}</p>}

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('products')}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  ← Productos
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !canSubmit}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <FaCheck className="text-xs" />
                      Crear pedido
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

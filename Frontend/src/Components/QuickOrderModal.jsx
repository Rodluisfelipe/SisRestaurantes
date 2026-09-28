import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaSearch, FaPlus, FaMinus, FaUser, FaPhone, FaShoppingCart, FaChair, FaHome, FaTruck, FaMoneyBillWave, FaTrash, FaCheck } from 'react-icons/fa';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import ProductToppingsSelector from './ProductToppingsSelector';
import { Capa } from './ui';

import { pesos } from '../utils/pedidos';
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

/**
 * @param prefill  Datos del cliente con los que abrir el formulario ya lleno:
 *                 { name, phone, address, orderType }. Lo usa la bandeja de
 *                 WhatsApp para tomar el pedido de quien está escribiendo sin
 *                 tener que volver a teclear sus datos.
 * @param channel  De dónde viene el pedido. Por defecto 'admin'; la bandeja
 *                 manda 'whatsapp' para que las estadísticas no digan que el
 *                 pedido lo originó el panel.
 */
function QuickOrderModal({ isOpen, onClose, onOrderCreated, prefill, channel = 'admin' }) {
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

  // Toppings
  const [showToppings, setShowToppings] = useState(null);

  // Delivery zones
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [loadingZones, setLoadingZones] = useState(false);

  // UI
  const [submitting, setSubmitting] = useState(false);
  // Pedido recién creado: se muestra la confirmación antes de cerrar.
  const [creado, setCreado] = useState(null);
  const [error, setError] = useState('');
  const searchTimerRef = useRef(null);

  /* Crédito del cliente: si el teléfono es de alguien con crédito habilitado,
     en la revisión aparece la opción de cargarle el pedido (o no). */
  const [credito, setCredito] = useState(null); // { cupo, saldo } | null
  const [usarCredito, setUsarCredito] = useState(false);
  useEffect(() => {
    setCredito(null);
    setUsarCredito(false);
    const tel = customerPhone.trim();
    if (!isOpen || tel.length < 7) return undefined;
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/credito', { params: { businessId, q: tel } });
        const c = (data.clientes || []).find((x) => x.phone === tel);
        if (vivo && c?.credito?.habilitado) setCredito({ cupo: c.credito.cupo || 0, saldo: c.credito.saldo || 0 });
      } catch { /* sin permiso o sin red: el pedido sigue normal */ }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [customerPhone, isOpen, businessId]);

  // Reset everything on open
  useEffect(() => {
    if (isOpen) {
      /* Con datos prellenados se arranca directo en los productos: quien viene
         de un chat ya sabe quién es el cliente y volver a pedir el nombre solo
         estorba. */
      setStep(prefill?.name ? 'products' : 'customer');
      setCustomerSearch('');
      setCustomerResults([]);
      setSelectedCustomer(null);
      setCustomerName(prefill?.name || '');
      setCustomerPhone(prefill?.phone || '');
      setOrderType(prefill?.orderType || 'inSite');
      setTableNumber('');
      setAddress(prefill?.address || '');
      setPaymentMethod('cash');
      setCustomerNotes('');
      setCart([]);
      setShowToppings(null);
      setSelectedZone(null);
      setDeliveryFee(0);
      setProductSearch('');
      setSelectedCategory('all');
      setError('');
      setCreado(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefill?.name, prefill?.phone, prefill?.address, prefill?.orderType]);

  // Load products once
  useEffect(() => {
    if (!isOpen || !businessId) return;
    setLoadingProducts(true);
    Promise.all([
      api.get(`/products?businessId=${businessId}&panel=1`),
      api.get(`/categories?businessId=${businessId}`)
    ]).then(([pRes, cRes]) => {
      setProducts(pRes.data.filter(p => p.active !== false));
      setCategories(cRes.data || []);
    }).catch(() => {}).finally(() => setLoadingProducts(false));
  }, [isOpen, businessId]);

  // Load delivery zones
  useEffect(() => {
    if (!isOpen || !businessId) return;
    setLoadingZones(true);
    api.get('/delivery-zones/public', { params: { businessId } })
      .then(res => setDeliveryZones(res.data?.zones || []))
      .catch(() => setDeliveryZones([]))
      .finally(() => setLoadingZones(false));
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
      const toppingsKey = JSON.stringify(product.selectedToppings || []);
      const uniqueId = `${product._id}-${toppingsKey}`;
      const existing = prev.find(c => c.uniqueId === uniqueId);
      if (existing) {
        return prev.map(c => c.uniqueId === uniqueId ? { ...c, quantity: c.quantity + (product.quantity || 1) } : c);
      }
      const itemPrice = product.totalPrice || product.price || 0;
      return [...prev, {
        productId: product._id,
        uniqueId,
        name: product.name,
        price: product.price,
        totalPrice: itemPrice,
        quantity: product.quantity || 1,
        selectedToppings: product.selectedToppings || [],
      }];
    });
  };

  const handleProductClick = (product) => {
    if (product.toppingGroups && product.toppingGroups.length > 0) {
      setShowToppings(product);
    } else {
      addToCart(product);
    }
  };

  const handleToppingsComplete = (productWithToppings) => {
    addToCart(productWithToppings);
    setShowToppings(null);
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

  const cartTotal = cart.reduce((sum, item) => sum + (item.totalPrice || item.price) * item.quantity, 0);

  const handleSelectZone = (zone) => {
    setSelectedZone(zone);
    setDeliveryFee(zone.pricing?.displayPrice || 0);
  };

  const grandTotal = cartTotal + (orderType === 'delivery' ? deliveryFee : 0);

  /* El nombre es opcional: en una venta de mostrador o una mesa pedirlo solo
     frena. Si queda vacío se usa algo que sirva para reconocer el pedido. */
  const nombreDelPedido = customerName.trim()
    || (orderType === 'inSite' ? (tableNumber.trim() ? `${businessConfig?.businessType === 'hotel' ? 'Habitación' : 'Mesa'} ${tableNumber.trim()}` : 'En el local')
      : orderType === 'takeaway' ? 'Para llevar' : 'Cliente');
  const canProceedToProducts = true;
  const canSubmit = cart.length > 0;
  const disponibleCredito = credito ? Math.max(0, credito.cupo - credito.saldo) : 0;
  const alcanzaCredito = !!credito && grandTotal <= disponibleCredito;
  const cargarACredito = usarCredito && alcanzaCredito;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const orderData = {
        businessId,
        customerName: nombreDelPedido,
        phone: customerPhone.trim() || undefined,
        orderType,
        tableNumber: orderType === 'inSite' ? tableNumber : undefined,
        address: orderType === 'delivery' ? address : undefined,
        paymentMethod: cargarACredito ? 'credito' : paymentMethod,
        ...(cargarACredito ? { usarCredito: true } : {}),
        customerNotes: customerNotes.trim() || undefined,
        orderChannel: channel,
        items: cart.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          totalPrice: item.totalPrice || item.price,
          quantity: item.quantity,
          selectedToppings: item.selectedToppings || [],
        })),
        totalAmount: cartTotal,
        ...(orderType === 'delivery' && selectedZone ? {
          deliveryFee,
          deliveryZoneName: selectedZone.name,
          deliveryCalculated: true,
        } : {}),
      };
      const res = await api.post('/orders', orderData);

      // Immediately set to inProgress
      try {
        await api.patch(`/orders/${res.data._id}/status`, { status: 'inProgress', businessId });
      } catch {
        // If transition fails (e.g. already inProgress), that's fine
      }

      onOrderCreated?.(res.data);
      setCreado(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error creando pedido');
    } finally {
      setSubmitting(false);
    }
  };

  const otroPedido = () => {
    setCreado(null);
    setStep('customer');
    setCustomerSearch(''); setCustomerResults([]); setSelectedCustomer(null);
    setCustomerName(''); setCustomerPhone('');
    setTableNumber(''); setAddress(''); setCustomerNotes('');
    setPaymentMethod('cash'); setCart([]); setSelectedZone(null); setDeliveryFee(0);
    setProductSearch(''); setSelectedCategory('all'); setError('');
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
        <Capa onCerrar={onClose} />
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
                  {[['customer', 'Cliente'], ['products', 'Productos'], ['review', 'Confirmar']].map(([s, nombre], i) => (
                    <div key={s} className="flex items-center gap-1">
                      <div className={`h-5 px-2 rounded-full text-2xs font-bold flex items-center justify-center gap-1 ${
                        step === s && !creado ? 'bg-slate-800 text-white' : creado || i < ['customer', 'products', 'review'].indexOf(step) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>{i + 1} {nombre}</div>
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

          {/* Hecho: que quien atiende SEPA que el pedido quedó, sobre todo si lo
              creó desde Inicio y no está viendo la lista de pedidos. */}
          {creado && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <FaCheck className="text-2xl text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Pedido #{creado.orderNumber} creado</h3>
              <p className="text-sm text-slate-500 mt-1 break-words">
                {creado.customerName} · {pesos(creado.finalAmount || grandTotal)}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">Ya está en preparación.</p>
              <div className="w-full grid grid-cols-2 gap-2 mt-6">
                <button onClick={onClose} className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold">
                  Cerrar
                </button>
                <button onClick={otroPedido} className="h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                  Otro pedido
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Customer + Order Info */}
          {!creado && step === 'customer' && (
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
                            <span className="text-2xs text-slate-400">{c.totalOrders || 0} pedidos</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Manual entry */}
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-500">O ingresa manualmente:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-2xs text-slate-400 mb-0.5 block">Nombre (opcional)</label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Nombre"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                          />
                        </div>
                        <div>
                          <label className="text-2xs text-slate-400 mb-0.5 block">Teléfono</label>
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
                      onClick={() => { setOrderType(t.value); if (t.value !== 'delivery') { setSelectedZone(null); setDeliveryFee(0); } }}
                      className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl text-center transition-all border ${
                        orderType === t.value ? t.color + ' shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <t.Icon className="text-sm" />
                      <span className="text-[13px] font-semibold">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Table / Address */}
              {orderType === 'inSite' && (
                <div>
                  <label className="text-2xs text-slate-400 mb-0.5 block">{businessConfig?.businessType === 'hotel' ? 'Habitación' : 'Mesa'}</label>
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
                <div className="space-y-3">
                  <div>
                    <label className="text-2xs text-slate-400 mb-0.5 block">Dirección</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Dirección de entrega"
                      className="w-full px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  {/* Delivery zones */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Zona de entrega</label>
                    {loadingZones ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                        <span className="ml-2 text-[11px] text-slate-400">Cargando zonas...</span>
                      </div>
                    ) : deliveryZones.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-2">No hay zonas configuradas</p>
                    ) : (
                      <div className="space-y-1.5">
                        {deliveryZones.map(zone => (
                          <button
                            key={zone.id}
                            onClick={() => handleSelectZone(zone)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
                              selectedZone?.id === zone.id
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[13px] font-medium text-slate-800">{zone.name}</p>
                                {zone.estimatedTime && (
                                  <p className="text-2xs text-slate-400">
                                    {typeof zone.estimatedTime === 'object'
                                      ? `${zone.estimatedTime.min}-${zone.estimatedTime.max} min`
                                      : zone.estimatedTime}
                                  </p>
                                )}
                              </div>
                              <span className={`text-[13px] font-bold ${selectedZone?.id === zone.id ? 'text-emerald-600' : 'text-slate-700'}`}>
                                {pesos(zone.pricing?.displayPrice)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                      className={`px-4 h-10 rounded-full text-[13px] font-semibold transition-all border ${
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
                <label className="text-2xs text-slate-400 mb-0.5 block">Notas (opcional)</label>
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
          {!creado && step === 'products' && (
            <div className="flex-1 flex flex-col overflow-hidden relative">
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
                      const inCart = cart.find(c => c.productId === product._id && (!c.selectedToppings || c.selectedToppings.length === 0));
                      const totalInCart = cart.filter(c => c.productId === product._id).reduce((sum, c) => sum + c.quantity, 0);
                      const hasToppings = product.toppingGroups && product.toppingGroups.length > 0;
                      return (
                        <div key={product._id} className={`flex items-center gap-2 rounded-xl transition-colors ${totalInCart > 0 ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                          {/* Toda la fila agrega: el botón chico de la derecha era lo
                              único que respondía, y el dedo va al nombre. */}
                          <button
                            type="button"
                            onClick={() => (inCart && !hasToppings ? updateCartQty(cart.indexOf(inCart), 1) : handleProductClick(product))}
                            className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-left"
                          >
                            {totalInCart > 0 && (
                              <span className="shrink-0 min-w-[24px] h-6 px-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">{totalInCart}</span>
                            )}
                            <span className="flex-1 min-w-0">
                              <span className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[14px] font-medium text-slate-800 break-words">{product.name}</span>
                                {hasToppings && <span className="text-2xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold shrink-0">Con opciones</span>}
                              </span>
                              <span className="block text-[12px] text-slate-500">{pesos(product.price)}</span>
                            </span>
                          </button>
                          {inCart && !hasToppings ? (
                            <div className="flex items-center gap-1.5 pr-2">
                              <button onClick={() => updateCartQty(cart.indexOf(inCart), -1)} aria-label="Quitar uno" className="w-9 h-9 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg flex items-center justify-center">
                                <FaMinus className="text-2xs text-slate-600" />
                              </button>
                              <span className="text-sm font-bold text-slate-800 w-6 text-center">{inCart.quantity}</span>
                              <button onClick={() => updateCartQty(cart.indexOf(inCart), 1)} aria-label="Agregar uno" className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center">
                                <FaPlus className="text-2xs text-white" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => handleProductClick(product)} className="mr-2 px-3.5 h-9 bg-slate-800 hover:bg-slate-700 text-white text-[12px] font-semibold rounded-lg transition-colors shrink-0">
                              {hasToppings ? 'Elegir' : 'Agregar'}
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
                  Revisar ({cart.reduce((n, c) => n + c.quantity, 0)}) · {pesos(grandTotal)}
                </button>
              </div>

              {/* Topping selector overlay */}
              {showToppings && (
                <div className="absolute inset-0 z-10 bg-white rounded-t-2xl lg:rounded-xl overflow-y-auto">
                  <ProductToppingsSelector
                    product={showToppings}
                    onAddToCart={handleToppingsComplete}
                    onClose={() => setShowToppings(null)}
                    compact
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {!creado && step === 'review' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Customer summary */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <FaUser className="text-xs text-slate-400" />
                  <span className="text-[13px] font-medium text-slate-800 break-words">{nombreDelPedido}</span>
                  {customerPhone && <span className="text-[11px] text-slate-500">· {customerPhone}</span>}
                </div>
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <span className="capitalize">{ORDER_TYPES.find(t => t.value === orderType)?.label}</span>
                  {tableNumber && <span>· Mesa {tableNumber}</span>}
                  {address && <span>· {address}</span>}
                  {selectedZone && <span>· Zona: {selectedZone.name}</span>}
                  <span>· {cargarACredito ? 'A crédito' : PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label}</span>
                </div>
                {customerNotes && <p className="text-[11px] text-amber-600">Nota: {customerNotes}</p>}
              </div>

              {/* Cart items */}
              <div>
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Productos ({cart.length})</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {cart.map((item, i) => (
                    <div key={i} className="px-3 py-2.5 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-slate-800">{item.name}</span>
                            <span className="text-[11px] text-slate-400">x{item.quantity}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-slate-800">{pesos((item.totalPrice || item.price) * item.quantity)}</span>
                          <button onClick={() => removeFromCart(i)} className="text-red-400 hover:text-red-600">
                            <FaTrash className="text-2xs" />
                          </button>
                        </div>
                      </div>
                      {item.selectedToppings && item.selectedToppings.length > 0 && (
                        <div className="mt-1 pl-2 border-l-2 border-amber-200">
                          {item.selectedToppings.map((t, ti) => (
                            <p key={ti} className="text-2xs text-amber-600">
                              + {t.groupName}: {t.optionName}
                              {t.subGroups?.map((sg, si) => (
                                <span key={si}> / {sg.optionName}</span>
                              ))}
                              {(t.price > 0 || t.basePrice > 0) && ` (${pesos((t.price || 0) + (t.basePrice || 0))})`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              {orderType === 'delivery' && deliveryFee > 0 && (
                <div className="flex justify-between items-center px-4 py-2 bg-slate-50 rounded-lg text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-700">{pesos(cartTotal)}</span>
                </div>
              )}
              {orderType === 'delivery' && deliveryFee > 0 && (
                <div className="flex justify-between items-center px-4 py-2 bg-slate-50 rounded-lg text-sm">
                  <span className="text-slate-500">Domicilio ({selectedZone?.name})</span>
                  <span className="font-medium text-slate-700">{pesos(deliveryFee)}</span>
                </div>
              )}
              <div className="bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-bold">Total</span>
                <span className="text-lg font-bold">{pesos(grandTotal)}</span>
              </div>

              {/* Crédito: solo si el cliente lo tiene habilitado */}
              {credito && (
                <div className={`rounded-xl border p-3 ${cargarACredito ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <label className={`flex items-start gap-3 ${alcanzaCredito ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5 w-5 h-5 accent-blue-600 shrink-0"
                      checked={cargarACredito}
                      disabled={!alcanzaCredito}
                      onChange={(e) => setUsarCredito(e.target.checked)}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-bold text-slate-900">Cargar a su crédito</span>
                      <span className="block text-[12px] text-slate-500">
                        Disponible {pesos(disponibleCredito)} de {pesos(credito.cupo)}
                        {credito.saldo > 0 && ` · debe ${pesos(credito.saldo)}`}
                      </span>
                      {!alcanzaCredito && (
                        <span className="block mt-1 text-[12px] font-semibold text-amber-700">
                          Supera el cupo: le faltan {pesos(grandTotal - disponibleCredito)}
                        </span>
                      )}
                      {cargarACredito && (
                        <span className="block mt-1 text-[12px] font-semibold text-blue-700">
                          Después de este pedido debe {pesos(credito.saldo + grandTotal)}
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              )}

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

export default React.memo(QuickOrderModal);

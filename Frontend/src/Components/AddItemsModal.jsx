import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaSearch, FaPlus, FaMinus, FaShoppingCart } from 'react-icons/fa';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { Capa } from './ui';
import ProductToppingsSelector from './ProductToppingsSelector';
import { pesos } from '../utils/pedidos';
function AddItemsModal({ isOpen, onClose, order, onItemsAdded }) {
  const { businessId } = useBusinessConfig();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [error, setError] = useState('');
  /* Producto con opciones (término, salsas, adiciones): antes se agregaba sin
     elegirlas y a cocina le llegaba "Hamburguesa" sin saber cómo. Ahora se
     abre el mismo selector del pedido rápido, que exige las obligatorias. */
  const [conOpciones, setConOpciones] = useState(null);

  // Load products and categories when modal opens
  useEffect(() => {
    if (!isOpen || !businessId) return;
    setLoading(true);
    Promise.all([
      api.get(`/products?businessId=${businessId}&panel=1`),
      api.get(`/categories?businessId=${businessId}`)
    ]).then(([productsRes, categoriesRes]) => {
      setProducts(productsRes.data.filter(p => p.active !== false));
      setCategories(categoriesRes.data || []);
    }).catch(() => {
      setError('Error cargando productos');
    }).finally(() => setLoading(false));
  }, [isOpen, businessId]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCart([]);
      setSearch('');
      setSelectedCategory('all');
      setError('');
      setConOpciones(null);
    }
  }, [isOpen]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || 
        (p.category && (p.category._id === selectedCategory || p.category === selectedCategory));
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const tieneOpciones = (p) => Array.isArray(p?.toppingGroups) && p.toppingGroups.length > 0;

  // Lo que devuelve el selector: price es el base (el servidor suma las
  // opciones), totalPrice el unitario con opciones, para mostrar.
  const agregarConOpciones = (p) => {
    setCart(prev => [...prev, {
      productId: p._id,
      name: p.name,
      price: p.price,
      totalPrice: p.totalPrice || p.price,
      quantity: p.quantity || 1,
      selectedToppings: p.selectedToppings || [],
    }]);
    setConOpciones(null);
  };

  const elegir = (product) => (tieneOpciones(product) ? setConOpciones(product) : addToCart(product));

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(c => c.productId === product._id && !c.selectedToppings?.length);
      if (existing) {
        return prev.map(c => c.productId === product._id && !c.selectedToppings?.length
          ? { ...c, quantity: c.quantity + 1 }
          : c
        );
      }
      return [...prev, {
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: 1,
        selectedToppings: [],
      }];
    });
  };

  const updateCartQty = (index, delta) => {
    setCart(prev => {
      const newCart = [...prev];
      newCart[index] = { ...newCart[index], quantity: newCart[index].quantity + delta };
      if (newCart[index].quantity <= 0) newCart.splice(index, 1);
      return newCart;
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.totalPrice || item.price) * item.quantity, 0);

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.patch(`/orders/${order._id}/add-items`, {
        items: cart.map((it) => ({ productId: it.productId, name: it.name, price: it.price, quantity: it.quantity, selectedToppings: it.selectedToppings })),
        businessId,
      });
      onItemsAdded(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Error agregando productos');
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
        <Capa onCerrar={onClose} />
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white rounded-t-2xl lg:rounded-xl w-full lg:max-w-lg max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Agregar productos</h3>
              <p className="text-[11px] text-slate-500">Pedido #{order?.orderNumber}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center">
              <FaTimes className="text-xs text-slate-500" />
            </button>
          </div>

          {/* Search + Categories */}
          <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${selectedCategory === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat._id}
                  onClick={() => setSelectedCategory(cat._id)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${selectedCategory === cat._id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Products list */}
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No se encontraron productos</p>
            ) : (
              <div className="space-y-1">
                {filteredProducts.map(product => {
                  const opciones = tieneOpciones(product);
                  // Con opciones cada combinación es una línea aparte: se cuentan todas.
                  const inCart = opciones ? null : cart.find(c => c.productId === product._id);
                  const cuantos = cart.filter(c => c.productId === product._id).reduce((n, c) => n + c.quantity, 0);
                  return (
                    <div
                      key={product._id}
                      className={`flex items-center gap-2 rounded-xl transition-colors ${inCart ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                    >
                      {/* Toda la fila agrega, no solo el botón chico. */}
                      <button
                        type="button"
                        onClick={() => (inCart ? updateCartQty(cart.indexOf(inCart), 1) : elegir(product))}
                        className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-left"
                      >
                        {cuantos > 0 && (
                          <span className="shrink-0 min-w-[24px] h-6 px-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">{cuantos}</span>
                        )}
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[14px] font-medium text-slate-800 break-words">{product.name}</span>
                            {opciones && <span className="text-2xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold shrink-0">Con opciones</span>}
                          </span>
                          <span className="block text-[12px] text-slate-500">{pesos(product.price)}</span>
                        </span>
                      </button>
                      <div className="flex items-center gap-1.5 pr-2">
                        {inCart ? (
                          <>
                            <button
                              onClick={() => updateCartQty(cart.indexOf(inCart), -1)}
                              className="w-9 h-9 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg flex items-center justify-center" aria-label="Quitar uno"
                            >
                              <FaMinus className="text-2xs text-slate-600" />
                            </button>
                            <span className="text-xs font-bold text-slate-800 w-5 text-center">{inCart.quantity}</span>
                            <button
                              onClick={() => updateCartQty(cart.indexOf(inCart), 1)}
                              className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center" aria-label="Agregar uno"
                            >
                              <FaPlus className="text-2xs text-white" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => elegir(product)}
                            className="px-3.5 h-9 bg-slate-800 hover:bg-slate-700 text-white text-[12px] font-semibold rounded-lg transition-colors"
                          >
                            {opciones ? 'Elegir' : 'Agregar'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {conOpciones && (
            <div className="absolute inset-0 z-10 bg-white rounded-t-2xl lg:rounded-xl overflow-y-auto">
              <ProductToppingsSelector
                product={conOpciones}
                onAddToCart={agregarConOpciones}
                onClose={() => setConOpciones(null)}
                compact
              />
            </div>
          )}

          {/* Cart summary + submit */}
          {cart.length > 0 && (
            <div className="border-t border-slate-200 px-4 py-3 space-y-2 shrink-0">
              <div className="max-h-24 overflow-y-auto space-y-1">
                {cart.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-[12px]">
                    <span className="text-slate-600 min-w-0 break-words">
                      {item.quantity}x {item.name}
                      {item.selectedToppings?.length > 0 && (
                        <span className="block text-2xs text-amber-700">
                          {item.selectedToppings.map((t) => [t.optionName, ...(t.subGroups || []).map((sg) => sg.optionName)].filter(Boolean).join(' / ')).join(', ')}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-800 font-semibold">{pesos((item.totalPrice || item.price) * item.quantity)}</span>
                      <button onClick={() => updateCartQty(i, -item.quantity)} aria-label="Quitar" className="text-red-400 hover:text-red-600 px-1">
                        <FaTimes className="text-2xs" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              {error && <p className="text-[11px] text-red-500">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                <FaShoppingCart className="text-xs" />
                {submitting ? 'Agregando...' : `Agregar al pedido · ${pesos(cartTotal)}`}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default React.memo(AddItemsModal);

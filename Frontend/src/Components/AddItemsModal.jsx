import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaSearch, FaPlus, FaMinus, FaShoppingCart } from 'react-icons/fa';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

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

  // Load products and categories when modal opens
  useEffect(() => {
    if (!isOpen || !businessId) return;
    setLoading(true);
    Promise.all([
      api.get(`/products?businessId=${businessId}`),
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

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.patch(`/orders/${order._id}/add-items`, {
        items: cart,
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
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-t-2xl lg:rounded-xl w-full lg:max-w-lg max-h-[85vh] flex flex-col"
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
                  const inCart = cart.find(c => c.productId === product._id);
                  return (
                    <div
                      key={product._id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-800 truncate">{product.name}</p>
                        <p className="text-[11px] text-slate-500">${product.price?.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {inCart ? (
                          <>
                            <button
                              onClick={() => updateCartQty(cart.indexOf(inCart), -1)}
                              className="w-7 h-7 bg-slate-200 hover:bg-slate-300 rounded-md flex items-center justify-center"
                            >
                              <FaMinus className="text-[8px] text-slate-600" />
                            </button>
                            <span className="text-xs font-bold text-slate-800 w-5 text-center">{inCart.quantity}</span>
                            <button
                              onClick={() => updateCartQty(cart.indexOf(inCart), 1)}
                              className="w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded-md flex items-center justify-center"
                            >
                              <FaPlus className="text-[8px] text-white" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => addToCart(product)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold rounded-lg transition-colors"
                          >
                            Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart summary + submit */}
          {cart.length > 0 && (
            <div className="border-t border-slate-200 px-4 py-3 space-y-2 shrink-0">
              <div className="max-h-24 overflow-y-auto space-y-1">
                {cart.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <span className="text-slate-600">{item.quantity}x {item.name}</span>
                    <span className="text-slate-800 font-semibold">${(item.price * item.quantity).toLocaleString()}</span>
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
                {submitting ? 'Agregando...' : `Agregar al pedido · $${cartTotal.toLocaleString()}`}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default React.memo(AddItemsModal);

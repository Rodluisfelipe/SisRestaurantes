import React, { useState, useEffect, useCallback } from 'react';
import { useBusinessConfig } from '../Context/BusinessContext';
import { useAuth } from '../Context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import POSHeader from '../Components/POS/POSHeader';
import POSProductGrid from '../Components/POS/POSProductGrid';
import POSCart from '../Components/POS/POSCart';
import POSCheckoutModal from '../Components/POS/POSCheckoutModal';
import POSCashRegister from '../Components/POS/POSCashRegister';
import POSTicket from '../Components/POS/POSTicket';
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
  const [showToppings, setShowToppings] = useState(null); // product with toppings
  const [lastOrder, setLastOrder] = useState(null); // for ticket printing

  const resolvedBusinessId = businessConfig?._id || businessId;

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
      return [...prev, { ...product, uniqueId, quantity: product.quantity || 1 }];
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
        onOpenMovements={() => setShowMovements(true)}
        onCloseCash={() => setShowCashClose(true)}
        onExit={() => navigate(`/${businessId}/admin`)}
      />

      <div className="flex-1 flex min-h-0">
        {/* Product grid — left ~65% */}
        <div className="flex-1 min-w-0">
          <POSProductGrid
            products={products}
            categories={categories}
            onProductClick={handleProductClick}
            themeColor={themeColor}
          />
        </div>

        {/* Cart — right ~35% */}
        <div className="w-[340px] lg:w-[380px] flex-shrink-0 border-l border-slate-200 bg-white flex flex-col">
          <POSCart
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            onCheckout={() => setShowCheckout(true)}
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

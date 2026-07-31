import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductCard from './Productcard';
import ProductToppingsSelector from './ProductToppingsSelector';
import { useBusinessConfig } from '../Context/BusinessContext';
import FeaturedProducts from './FeaturedProducts';
import PopularProducts from './PopularProducts';
import PendingReviewCard from './PendingReviewCard';
import { NoSearchResultsIllustration, EmptyMenuIllustration } from './EmptyStates';
import {
  Hamburger, Pizza, CupSoda, Coffee, CakeSlice, Ham, Salad, Soup, Drumstick,
  CookingPot, Fish, Croissant, Sandwich, EggFried, UtensilsCrossed, Gift,
  Wheat, Popcorn, Utensils, Sparkles,
} from 'lucide-react';

/* ── SVG Icons (stroke-based, admin panel style) ── */
const MI = {
  search: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  x: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  grid: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  chevron: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7"/></svg>,
  package: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>,
  clipboard: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
  check: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  sparkle: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>,
};

/* ── Category SVG Icons (stroke-based, matching the design system) ── */
/* ── Map category key → Lucide icon component ── */
const CATEGORY_ICONS = {
  burger: Hamburger, pizza: Pizza, drink: CupSoda, coffee: Coffee, dessert: CakeSlice,
  appetizer: Ham, salad: Salad, soup: Soup, chicken: Drumstick, pasta: CookingPot,
  seafood: Fish, taco: Croissant, sandwich: Sandwich, breakfast: EggFried, meal: UtensilsCrossed,
  combo: Gift, rice: Wheat, snack: Popcorn, utensils: Utensils,
};

const getCategoryKey = (categoryName) => {
  const name = (categoryName || '').toLowerCase().trim();
  const map = {
    'hamburguesas': 'burger', 'hamburguesa': 'burger', 'burgers': 'burger', 'burger': 'burger',
    'pizza': 'pizza', 'pizzas': 'pizza',
    'bebidas': 'drink', 'bebida': 'drink', 'drinks': 'drink', 'bebidas frías': 'drink', 'bebidas frias': 'drink',
    'bebidas calientes': 'coffee', 'café': 'coffee', 'cafés': 'coffee', 'cafe': 'coffee', 'coffee': 'coffee',
    'jugos': 'drink', 'jugo': 'drink', 'batidos': 'drink', 'batido': 'drink', 'malteadas': 'drink',
    'postres': 'dessert', 'postre': 'dessert', 'desserts': 'dessert', 'dulces': 'dessert',
    'entradas': 'appetizer', 'entrada': 'appetizer', 'appetizers': 'appetizer', 'aperitivos': 'appetizer',
    'ensaladas': 'salad', 'ensalada': 'salad', 'salads': 'salad',
    'sopas': 'soup', 'sopa': 'soup', 'caldos': 'soup', 'cremas': 'soup',
    'pollo': 'chicken', 'pollos': 'chicken', 'alitas': 'chicken', 'chicken': 'chicken',
    'pasta': 'pasta', 'pastas': 'pasta',
    'mariscos': 'seafood', 'pescado': 'seafood', 'pescados': 'seafood', 'seafood': 'seafood',
    'tacos': 'taco', 'taco': 'taco',
    'wraps': 'sandwich', 'wrap': 'sandwich', 'burritos': 'sandwich', 'burrito': 'sandwich',
    'sandwiches': 'sandwich', 'sandwich': 'sandwich', 'sándwiches': 'sandwich',
    'desayunos': 'breakfast', 'desayuno': 'breakfast', 'breakfast': 'breakfast',
    'almuerzos': 'meal', 'almuerzo': 'meal', 'cenas': 'meal', 'cena': 'meal', 'platos fuertes': 'meal', 'plato fuerte': 'meal',
    'combos': 'combo', 'combo': 'combo', 'promociones': 'combo', 'ofertas': 'combo',
    'arroz': 'rice', 'arroces': 'rice',
    'snacks': 'snack', 'snack': 'snack', 'acompañamientos': 'snack', 'acompañamiento': 'snack', 'extras': 'snack', 'complementos': 'snack',
  };

  if (map[name]) return map[name];

  if (name.includes('burger') || name.includes('hamburguesa')) return 'burger';
  if (name.includes('pizza')) return 'pizza';
  if (name.includes('bebida') || name.includes('drink') || name.includes('jugo') || name.includes('batido')) return 'drink';
  if (name.includes('café') || name.includes('cafe') || name.includes('coffee')) return 'coffee';
  if (name.includes('postre') || name.includes('dessert') || name.includes('dulce')) return 'dessert';
  if (name.includes('entrada') || name.includes('appetizer')) return 'appetizer';
  if (name.includes('ensalada') || name.includes('salad')) return 'salad';
  if (name.includes('sopa') || name.includes('caldo') || name.includes('crema')) return 'soup';
  if (name.includes('pollo') || name.includes('chicken') || name.includes('alita')) return 'chicken';
  if (name.includes('pasta')) return 'pasta';
  if (name.includes('marisco') || name.includes('pescado') || name.includes('seafood')) return 'seafood';
  if (name.includes('taco')) return 'taco';
  if (name.includes('sandwich') || name.includes('wrap') || name.includes('burrito')) return 'sandwich';
  if (name.includes('desayuno') || name.includes('breakfast')) return 'breakfast';
  if (name.includes('almuerzo') || name.includes('cena') || name.includes('plato')) return 'meal';
  if (name.includes('combo') || name.includes('promo')) return 'combo';
  if (name.includes('arroz') || name.includes('rice')) return 'rice';
  if (name.includes('snack') || name.includes('extra') || name.includes('complement')) return 'snack';

  return 'utensils';
};

// Service-aware: returns Sparkles instead of Utensils for service businesses without a category match
const getCategoryIconForBusiness = (categoryName, businessType) => {
  const isServiceBiz = ['salon', 'spa', 'clinic', 'services'].includes(businessType);
  const key = getCategoryKey(categoryName);
  if (isServiceBiz && key === 'utensils') return Sparkles;
  return CATEGORY_ICONS[key];
};

/**
 * FilterableMenu Component
 * 
 * A modern component for displaying products with category filtering, search capabilities,
 * and view toggle options with premium animations.
 */
const FilterableMenu = ({
  products,
  categories,
  addToCart,
  onToppingsOpen,
  onToppingsClose,
  subscriptionStatus = null,
  businessId,
  businessConfig: businessConfigProp,
  hasActiveOrder = false,
  activeOrderStatus = null,
  onViewActiveOrder,
  onDismissCompletedOrder,
  customerPhone = null,
  onCategoryVisible,
  onPendingReview,
  isViewOnly = false,
}) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showToppings, setShowToppings] = useState(false);
  const { businessConfig: businessConfigContext } = useBusinessConfig();
  const businessConfig = businessConfigProp || businessConfigContext;
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const isHotel = businessConfig?.businessType === 'hotel';

  // ── Scroll-spy + sticky state ──
  const [spyCategory, setSpyCategory] = useState('all');  // category visible by scroll
  const [isSticky, setIsSticky] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [userTapped, setUserTapped] = useState(false);     // true while programmatic scroll
  const pillBarRef = useRef(null);
  const pillBarSentinelRef = useRef(null);
  const sectionRefs = useRef({});                           // { categoryId: HTMLDivElement }
  const pillRefs = useRef({});                              // { categoryId: HTMLButtonElement }
  const userTapTimer = useRef(null);

  // Animation variants for stagger effect
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  // Sort categories based on displayOrder from backend
  const getSortedCategories = (categories) => {
    // Validar que categories sea un array
    if (!Array.isArray(categories)) {
      console.warn('getSortedCategories: categories no es un array:', categories);
      return [];
    }
    
    // Ordenar por displayOrder (del backend) y luego por fecha de creación
    return [...categories].sort((a, b) => {
      const orderA = a.displayOrder !== undefined ? a.displayOrder : 999;
      const orderB = b.displayOrder !== undefined ? b.displayOrder : 999;
      
      if (orderA === orderB) {
        // Si tienen el mismo orden, ordenar por fecha de creación
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      
      return orderA - orderB;
    });
  };

  // ── Sticky detection via sentinel ──
  useEffect(() => {
    const sentinel = pillBarSentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  // ── Scroll-spy: scroll-event based (more reliable than IntersectionObserver) ──
  useEffect(() => {
    if (userTapped) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const sections = Object.entries(sectionRefs.current).filter(([, el]) => el);
        if (sections.length === 0) return;

        // Offset = height of sticky pill bar + a small margin
        const offset = (pillBarRef.current?.offsetHeight || 60) + 24;
        let found = null;

        // Walk sections top→bottom, pick the last one whose top is above the offset line
        for (const [id, el] of sections) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= offset && rect.bottom > offset) {
            found = id;
          }
        }
        // If nothing overlaps the line, pick the closest section above it
        if (!found) {
          let closest = null;
          let closestDist = Infinity;
          for (const [id, el] of sections) {
            const top = el.getBoundingClientRect().top;
            if (top <= offset) {
              const dist = offset - top;
              if (dist < closestDist) { closestDist = dist; closest = id; }
            }
          }
          found = closest;
        }

        // If still at the very top (before first section), show "all"
        const nextCat = found || 'all';
        setSpyCategory(prev => {
          if (prev !== nextCat) {
            // Auto-scroll pill bar to keep active pill visible
            const pillEl = pillRefs.current[nextCat];
            const container = pillBarRef.current?.querySelector('.overflow-x-auto');
            if (pillEl && container) {
              const cRect = container.getBoundingClientRect();
              const pRect = pillEl.getBoundingClientRect();
              const scrollLeft = pillEl.offsetLeft - container.offsetLeft - (cRect.width / 2) + (pRect.width / 2);
              container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
            }
          }
          return nextCat;
        });
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // run once to set initial state
    return () => window.removeEventListener('scroll', handleScroll);
  }, [userTapped, filteredProducts]);

  // ── Notify parent of visible category (for viewer tracking) ──
  useEffect(() => {
    if (onCategoryVisible && spyCategory && spyCategory !== 'all') {
      const cat = categories.find(c => c._id === spyCategory);
      if (cat) onCategoryVisible(cat.name);
    }
  }, [spyCategory, categories, onCategoryVisible]);

  // ── Scroll progress (how far through the menu) ──
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setScrollProgress(Math.min(scrollTop / docHeight, 1));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Auto-scroll the active pill into view (horizontal only, on tap only) ──
  const scrollPillIntoView = useCallback((categoryId) => {
    const pillEl = pillRefs.current[categoryId] || pillRefs.current['all'];
    const container = pillBarRef.current?.querySelector('.overflow-x-auto');
    if (pillEl && container) {
      const containerRect = container.getBoundingClientRect();
      const pillRect = pillEl.getBoundingClientRect();
      const scrollLeft = pillEl.offsetLeft - container.offsetLeft - (containerRect.width / 2) + (pillRect.width / 2);
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, []);

  // ── Click a pill: scroll to section + highlight (stay in "all" mode) ──
  const handlePillClick = useCallback((categoryId) => {
    if (categoryId === 'all') {
      setActiveCategory('all');
      setSpyCategory('all');
      scrollPillIntoView('all');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Immediately highlight this pill and scroll it into view
    setSpyCategory(categoryId);
    scrollPillIntoView(categoryId);
    // Keep showing all sections so scroll targets exist
    setActiveCategory('all');

    const section = sectionRefs.current[categoryId];
    if (section) {
      // Temporarily disable spy so it doesn't fight with programmatic scroll
      setUserTapped(true);
      clearTimeout(userTapTimer.current);

      const offset = pillBarRef.current ? pillBarRef.current.offsetHeight + 12 : 60;
      const top = section.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });

      // Re-enable spy after scroll finishes (generous timeout for slow devices)
      userTapTimer.current = setTimeout(() => {
        setUserTapped(false);
      }, 1200);
    }
  }, []);

  // Filter products based on search and category
  useEffect(() => {
    let filtered = products;

    // Filter only active products (hide inactive products from customers)
    filtered = filtered.filter(product => product.active !== false);

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(product => product.category === activeCategory);
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, activeCategory]);

  // Handle search input
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
  };

  // Handle showing toppings selector
  const handleShowToppings = (product) => {
    // Verificar si la suscripción está suspendida
    if (subscriptionStatus === 'suspended') {
      // Mensaje sutil - no mostrar alert, el botón ya está deshabilitado visualmente
      return;
    }
    
    setSelectedProduct(product);
    setShowToppings(true);
    onToppingsOpen && onToppingsOpen();
    document.body.classList.add('modal-open');
  };

  // Handle closing toppings selector
  const handleCloseToppings = () => {
    setShowToppings(false);
    setSelectedProduct(null);
    onToppingsClose && onToppingsClose();
    document.body.classList.remove('modal-open');
  };

  // Handle adding product with toppings to cart
  const handleAddToCartWithToppings = (productWithToppings) => {
    addToCart(productWithToppings);
    handleCloseToppings();
  };

  // Get sorted categories
  const sortedCategories = getSortedCategories(categories);

  // Get categories with product counts
  const categoriesWithProducts = sortedCategories.map(category => ({
    ...category,
    count: Array.isArray(products) ? products.filter(product => product.category === category._id).length : 0
  })).filter(category => category.count > 0);

  // Total product count
  const totalProductCount = Array.isArray(products) ? products.length : 0;

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const themeTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';

  // ── Menú colapsado: índice de categorías + drill-in por categoría ──
  const collapsedMenu = businessConfig?.theme?.collapsedMenu === true;
  // Índice visible: modo colapsado, sin búsqueda y sin categoría abierta
  const showCategoryIndex = collapsedMenu && !searchTerm && activeCategory === 'all';
  // Dentro de una categoría (drill-in) en modo colapsado
  const insideCollapsedCategory = collapsedMenu && activeCategory !== 'all';

  // Abrir una categoría desde el índice (conserva el header, sube al inicio)
  const openCategory = useCallback((categoryId) => {
    setActiveCategory(categoryId);
    setSpyCategory(categoryId);
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Volver al índice de categorías
  const backToIndex = useCallback(() => {
    setActiveCategory('all');
    setSpyCategory('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // The visually active pill is always based on spyCategory
  // (either set by IntersectionObserver or explicitly by handlePillClick)
  const visualActive = spyCategory;
  
  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-2">
      {/* Active Order Banner — Rappi style, above search */}
      <AnimatePresence>
        {hasActiveOrder && (() => {
          const isCompleted = activeOrderStatus === 'completed' || activeOrderStatus === 'ready' || activeOrderStatus === 'delivered';
          const bizLabel = isHotel ? 'El hotel' : 'El negocio';
          const statusMap = {
            pending_payment: { label: 'Pendiente de pago', icon: MI.clipboard('w-5 h-5 text-white'), sub: 'Realiza el pago para continuar' },
            payment_uploaded: { label: 'Verificando pago', icon: MI.clipboard('w-5 h-5 text-white'), sub: `${bizLabel} revisa tu comprobante` },
            payment_confirmed: { label: 'Pago confirmado', icon: MI.check('w-5 h-5 text-white'), sub: 'Tu pedido será preparado pronto' },
            pending: { label: 'Pedido recibido', icon: MI.clipboard('w-5 h-5 text-white'), sub: `${bizLabel} recibió tu pedido` },
            inProgress: { label: 'En preparación', icon: MI.package('w-5 h-5 text-white'), sub: 'Están preparando tu pedido' },
            preparing: { label: 'En preparación', icon: MI.package('w-5 h-5 text-white'), sub: 'Están preparando tu pedido' },
            ready: { label: 'Pedido listo', icon: MI.sparkle('w-5 h-5 text-white'), sub: 'Tu pedido está listo para recoger' },
            completed: { label: 'Pedido completado', icon: MI.check('w-5 h-5 text-white'), sub: 'Tu pedido ha sido entregado' },
            delivered: { label: 'Pedido entregado', icon: MI.check('w-5 h-5 text-white'), sub: 'Tu pedido ha sido entregado' },
          };
          const info = statusMap[activeOrderStatus] || { label: 'Pedido en curso', icon: MI.clipboard('w-5 h-5 text-white'), sub: 'Toca para ver el estado' };

          return (
            <motion.div
              key="active-order-banner"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full mb-3 rounded-2xl overflow-hidden shadow-sm origin-top"
              style={{ backgroundColor: isCompleted ? '#10b981' : themeColor }}
            >
              <button
                onClick={isCompleted ? undefined : onViewActiveOrder}
                className="w-full active:scale-[0.98] transition-transform"
                aria-label={isCompleted ? 'Pedido completado' : `Ver pedido activo: ${info.label}`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                      {info.icon}
                    </div>
                    {!isCompleted && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75 will-change-transform" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold leading-tight text-white">
                      {info.label}
                    </p>
                    <p className="text-xs mt-0.5 text-white/90">
                      {info.sub}
                    </p>
                  </div>
                  {!isCompleted && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
              {isCompleted ? (
                <button
                  onClick={onDismissCompletedOrder}
                  className="w-full py-2 bg-white/20 text-white text-xs font-semibold tracking-wide active:bg-white/30 transition-colors"
                >
                  OK, ENTENDIDO
                </button>
              ) : (
                <div className="h-0.5 bg-white/20">
                  <motion.div
                    className="h-full bg-white/50 rounded-full w-full origin-left"
                    animate={{ scaleX: [0, 1] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Pending Review Card — shown when no active order and customer has un-reviewed orders */}
      {!hasActiveOrder && customerPhone && (
        <PendingReviewCard
          businessId={businessId}
          customerPhone={customerPhone}
          themeColor={themeColor}
          themeTextColor={themeTextColor}
          onReview={onPendingReview}
        />
      )}

      {/* Spotlight Search — iOS style */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-5 relative z-20"
      >
        {/* Backdrop blur when focused (no text) */}
        <AnimatePresence>
          {searchFocused && !searchTerm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20"
              onClick={() => { setSearchFocused(false); document.activeElement?.blur(); }}
            />
          )}
        </AnimatePresence>

        <div className={`relative z-20 transition-transform duration-300 ${searchFocused && !searchTerm ? 'scale-[1.02]' : ''}`} role="search" aria-label="Buscar en el menú">
          <span
            className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors z-10"
            style={{ color: searchTerm ? themeColor : '#94a3b8' }}
          >
            {MI.search('w-[18px] h-[18px] sm:w-5 sm:h-5')}
          </span>
          <input
            /* id estable: el BottomNav del menú V2 lo enfoca desde el ícono de buscar */
            id="menu-search-input"
            type="text"
            placeholder={isService ? '¿Qué servicio buscas?' : '¿Qué se te antoja hoy?'}
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 250)}
            aria-label={isService ? 'Buscar servicio' : 'Buscar producto'}
            className={`w-full pl-10 sm:pl-12 pr-10 py-3 sm:py-3.5 border rounded-2xl focus:outline-none focus:ring-2 transition-all duration-200 text-sm sm:text-base text-slate-700 placeholder-slate-400 ${
              searchFocused ? 'bg-white border-transparent shadow-2xl' : 'bg-slate-50 border-slate-200'
            }`}
            style={{
              '--tw-ring-color': `${themeColor}40`,
              borderColor: searchTerm ? themeColor : undefined
            }}
          />
          <AnimatePresence>
            {searchTerm && (
              <motion.button 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors z-10"
                aria-label="Limpiar búsqueda"
              >
                {MI.x('w-3 h-3')}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Quick suggestion chips */}
        <AnimatePresence>
          {searchFocused && !searchTerm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: 0.1 }}
              className="relative z-20 flex flex-wrap gap-2 mt-3"
            >
              {categoriesWithProducts.slice(0, 5).map(cat => {
                const CategoryIcon = CATEGORY_ICONS[getCategoryKey(cat.name)];
                return (
                <motion.button
                  key={cat._id}
                  whileTap={{ scale: 0.93 }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setSearchTerm(cat.name); setSearchFocused(false); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-md text-slate-700 shadow-md border border-white/50 active:bg-white transition-all"
                >
                  <CategoryIcon className="w-3 h-3 opacity-60" />
                  {cat.name}
                </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Sentinel — when this scrolls out of view, the pill bar becomes sticky */}
      <div ref={pillBarSentinelRef} className="h-0" />

      {/* ── Sticky Category Filter Pills + Progress Bar ── */}
      {/* En modo colapsado ocultamos las pills: la navegación es el índice de categorías */}
      {!collapsedMenu && (
      <div
        ref={pillBarRef}
        className={`z-40 py-2.5 mb-4 sm:mb-5 ${
          isSticky
            ? 'sticky bg-white/95 backdrop-blur-md shadow-sm -mx-3 px-3 sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6'
            : ''
        }`}
        /* Se pega justo debajo del header compacto del negocio. BusinessHeader
           publica su altura en --mb-header-h (0px cuando no está colapsado). */
        style={isSticky ? { top: 'var(--mb-header-h, 0px)' } : undefined}
      >
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-1 px-0.5 min-w-max">
            {/* "All" pill — iOS style */}
            <button
              ref={el => (pillRefs.current['all'] = el)}
              onClick={() => handlePillClick('all')}
              className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap font-semibold text-[13px] transition-all duration-200 active:scale-[0.93]"
              style={{ color: visualActive === 'all' ? '#fff' : '#334155' }}
            >
              <div
                className="absolute inset-0 rounded-full transition-all duration-200"
                style={visualActive === 'all'
                  ? { backgroundColor: themeColor, boxShadow: `0 4px 12px ${themeColor}40` }
                  : { backgroundColor: '#f1f5f9' }
                }
              />
              <span className="relative z-10">Todos</span>
              <span className={`relative z-10 min-w-[20px] h-5 inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
                visualActive === 'all' 
                  ? 'bg-white/20 text-white' 
                  : 'bg-slate-200 text-slate-500'
              }`}>
                {totalProductCount}
              </span>
            </button>

            {/* Category pills */}
            {categoriesWithProducts.map((category) => {
              const isActive = visualActive === category._id;
              return (
                <button
                  key={category._id}
                  ref={el => (pillRefs.current[category._id] = el)}
                  onClick={() => handlePillClick(category._id)}
                  className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap font-semibold text-[13px] transition-all duration-200 active:scale-[0.93]"
                  style={{ color: isActive ? '#fff' : '#334155' }}
                >
                  <div
                    className="absolute inset-0 rounded-full transition-all duration-200"
                    style={isActive
                      ? { backgroundColor: themeColor, boxShadow: `0 4px 12px ${themeColor}40` }
                      : { backgroundColor: '#f1f5f9' }
                    }
                  />
                  <span className="relative z-10">{category.name}</span>
                  <span className={`relative z-10 min-w-[20px] h-5 inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {category.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Scroll progress line ── */}
        <div className="h-[2px] bg-slate-100 mt-2 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full w-full origin-left"
            style={{ backgroundColor: themeColor }}
            animate={{ scaleX: scrollProgress }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>
      </div>
      )}

      {/* Los más pedidos (premium) — se ocultan dentro de una categoría (drill-in) */}
      {businessId && !searchTerm && !insideCollapsedCategory && (
        <PopularProducts
          businessId={businessId}
          products={products}
          onAddToCart={isViewOnly ? null : addToCart}
          theme={businessConfig?.theme}
          onToppingsOpen={onToppingsOpen}
          onToppingsClose={onToppingsClose}
          isViewOnly={isViewOnly}
        />
      )}

      {/* Productos Destacados — ocultos dentro de una categoría (drill-in) */}
      {businessId && !insideCollapsedCategory && (
        <FeaturedProducts
          businessId={businessId}
          products={products}
          onAddToCart={isViewOnly ? null : addToCart}
          theme={businessConfig?.theme}
          onToppingsOpen={onToppingsOpen}
          onToppingsClose={onToppingsClose}
          isViewOnly={isViewOnly}
        />
      )}

      {/* Products Display */}
      <AnimatePresence mode="wait">
        {/* ── No results state ── */}
        {filteredProducts.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center py-10 px-4 text-center"
          >
            {searchTerm ? (
              <>
                <NoSearchResultsIllustration themeColor={themeColor} size={150} />
                <h3 className="mt-4 text-lg font-bold text-gray-700">
                  No encontramos resultados
                </h3>
                <p className="mt-1.5 text-sm text-gray-500 max-w-xs">
                  No hay {isService ? 'servicios' : 'productos'} que coincidan con <span className="font-semibold text-gray-600">"{searchTerm}"</span>
                </p>
                <button
                  onClick={clearSearch}
                  className="mt-4 px-5 py-2 text-sm font-semibold rounded-full transition-colors"
                  style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
                >
                  Limpiar búsqueda
                </button>

                {/* Suggest popular categories */}
                {categoriesWithProducts.length > 0 && (
                  <div className="mt-6 w-full">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Explora categorías</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {categoriesWithProducts.slice(0, 4).map(cat => {
                        const CategoryIcon = CATEGORY_ICONS[getCategoryKey(cat.name)];
                        return (
                        <motion.button
                          key={cat._id}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => { clearSearch(); handlePillClick(cat._id); }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-700 shadow-sm hover:shadow-md transition-all"
                        >
                          <CategoryIcon className="w-3.5 h-3.5 opacity-50" />
                          {cat.name}
                        </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <EmptyMenuIllustration themeColor={themeColor} size={150} />
                <h3 className="mt-4 text-lg font-bold text-gray-700">
                  {isService ? 'Sin servicios' : 'Menú vacío'}
                </h3>
                <p className="mt-1.5 text-sm text-gray-500 max-w-xs">
                  Aún no hay {isService ? 'servicios disponibles' : 'productos disponibles en esta categoría'}.
                </p>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
          {activeCategory === 'all' ? (
            showCategoryIndex ? (
              // ── Índice de categorías (modo colapsado): el cliente entra a cada una ──
              <div className="space-y-2.5">
                {categoriesWithProducts.map((category, i) => {
                  const CategoryIcon = getCategoryIconForBusiness(category.name, businessConfig?.businessType);
                  return (
                    <motion.button
                      key={category._id}
                      onClick={() => openCategory(category._id)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.035, 0.4) }}
                      whileTap={{ scale: 0.985 }}
                      className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] active:bg-slate-50 transition-colors text-left"
                    >
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${themeColor}18, ${themeColor}08)`,
                          border: `1px solid ${themeColor}15`
                        }}
                      >
                        <CategoryIcon className="w-5 h-5" style={{ color: themeColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-[15px] font-bold text-slate-800 tracking-tight truncate">{category.name}</h2>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {category.count} {category.count === 1 ? (isService ? 'servicio' : 'producto') : (isService ? 'servicios' : 'productos')}
                        </span>
                      </div>
                      <span className="flex-shrink-0 text-slate-300">
                        {MI.chevron('w-5 h-5')}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              // Group products by category
              categoriesWithProducts.map((category, categoryIndex) => {
              const categoryProducts = filteredProducts.filter(product => product.category === category._id);
              if (categoryProducts.length === 0) return null;
              const CategoryIcon = getCategoryIconForBusiness(category.name, businessConfig?.businessType);

              return (
                  <motion.div
                    key={category._id}
                    ref={el => (sectionRefs.current[category._id] = el)}
                    data-category-id={category._id}
                    className="mb-6 sm:mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: categoryIndex * 0.06 }}
                  >
                    {/* Category Header */}
                    <div className="flex items-center gap-3 mb-3 sm:mb-4">
                      <div 
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ 
                          background: `linear-gradient(135deg, ${themeColor}18, ${themeColor}08)`,
                          boxShadow: `0 2px 8px ${themeColor}15`,
                          border: `1px solid ${themeColor}15`
                        }}
                      >
                        <CategoryIcon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: themeColor }} />
                      </div>
                      <div className="flex flex-col">
                        <h2 className="text-[15px] sm:text-base font-bold text-slate-800 tracking-tight leading-tight">{category.name}</h2>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">{categoryProducts.length} {categoryProducts.length === 1 ? (isService ? 'servicio' : 'producto') : (isService ? 'servicios' : 'productos')}</span>
                      </div>
                      <div 
                        className="flex-1 h-px ml-1"
                        style={{
                          background: `linear-gradient(to right, ${themeColor}20, transparent)`
                        }}
                      />
                    </div>
                    <motion.div 
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {categoryProducts.map((product, productIndex) => {
                        const isFirstHero = productIndex === 0 && product.image && categoryProducts.length !== 2;
                        return isFirstHero ? (
                          <div key={product._id} className="col-span-2">
                            <ProductCard
                              product={product}
                              addToCart={addToCart}
                              onToppingsOpen={onToppingsOpen}
                              onToppingsClose={onToppingsClose}
                              subscriptionStatus={subscriptionStatus}
                              isHero
                              isViewOnly={isViewOnly}
                            />
                          </div>
                        ) : (
                          <ProductCard
                            key={product._id}
                            product={product}
                            addToCart={addToCart}
                            onToppingsOpen={onToppingsOpen}
                            onToppingsClose={onToppingsClose}
                            subscriptionStatus={subscriptionStatus}
                            isViewOnly={isViewOnly}
                          />
                        );
                      })}
                    </motion.div>
                  </motion.div>
              );
            })
            )
          ) : (
              // Specific category selected
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Botón volver al índice (solo en modo colapsado) */}
                {collapsedMenu && (
                  <button
                    onClick={backToIndex}
                    className="inline-flex items-center gap-1.5 mb-3 px-3.5 py-2 rounded-full text-[13px] font-semibold text-slate-600 bg-slate-100 active:bg-slate-200 transition-colors"
                    aria-label="Volver a las categorías"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    Categorías
                  </button>
                )}
                {/* Category Header */}
                {categoriesWithProducts.filter(category => category._id === activeCategory).map(category => {
                  const singleCatProducts = filteredProducts.filter(p => p.category === category._id);
                  const CategoryIcon = getCategoryIconForBusiness(category.name, businessConfig?.businessType);
                  return (
                  <div
                    key={category._id}
                    className="flex items-center gap-3 mb-3 sm:mb-4"
                  >
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${themeColor}18, ${themeColor}08)`,
                        boxShadow: `0 2px 8px ${themeColor}15`,
                        border: `1px solid ${themeColor}15`
                      }}
                    >
                      <CategoryIcon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: themeColor }} />
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-tight">{category.name}</h2>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">{singleCatProducts.length} {singleCatProducts.length === 1 ? (isService ? 'servicio' : 'producto') : (isService ? 'servicios' : 'productos')}</span>
                    </div>
                    <div 
                      className="flex-1 h-px ml-1"
                      style={{
                        background: `linear-gradient(to right, ${themeColor}20, transparent)`
                      }}
                    />
                  </div>
                  );
                })}
                
                <motion.div 
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredProducts.map((product, productIndex) => {
                    const isFirstHero = productIndex === 0 && product.image && filteredProducts.length !== 2;
                    return isFirstHero ? (
                      <div key={product._id} className="col-span-2">
                        <ProductCard
                          product={product}
                          addToCart={addToCart}
                          onToppingsOpen={onToppingsOpen}
                          onToppingsClose={onToppingsClose}
                          subscriptionStatus={subscriptionStatus}
                          isHero
                          isViewOnly={isViewOnly}
                        />
                      </div>
                    ) : (
                      <ProductCard
                        key={product._id}
                        product={product}
                        addToCart={addToCart}
                        onToppingsOpen={onToppingsOpen}
                        onToppingsClose={onToppingsClose}
                        subscriptionStatus={subscriptionStatus}
                        isViewOnly={isViewOnly}
                      />
                    );
                  })}
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toppings Selector Modal */}
      {showToppings && selectedProduct && (
          <ProductToppingsSelector
          product={selectedProduct}
            onAddToCart={handleAddToCartWithToppings}
            onClose={handleCloseToppings}
          />
      )}
    </div>
  );
};

export default FilterableMenu; 

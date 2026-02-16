import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaTimes } from 'react-icons/fa';
import ProductCard from './Productcard';
import ProductToppingsSelector from './ProductToppingsSelector';
import { useBusinessConfig } from '../Context/BusinessContext';
import FeaturedProducts from './FeaturedProducts';
import { NoSearchResultsIllustration, EmptyMenuIllustration } from './EmptyStates';

// Función para obtener emoji basado en el nombre de la categoría
const getCategoryEmoji = (categoryName) => {
  if (!categoryName) return '🍽️';
  
  const name = categoryName.toLowerCase();
  
  // Mapeo de categorías comunes a emojis
  const emojiMap = {
    'bebidas': '🥤',
    'bebida': '🥤',
    'drinks': '🥤',
    'bebidas frías': '🧊',
    'bebidas calientes': '☕',
    'café': '☕',
    'coffee': '☕',
    'postres': '🍰',
    'postre': '🍰',
    'dessert': '🍰',
    'dulces': '🍭',
    'entradas': '🥗',
    'entrada': '🥗',
    'appetizer': '🥗',
    'ensaladas': '🥗',
    'ensalada': '🥗',
    'salad': '🥗',
    'sopas': '🍲',
    'sopa': '🍲',
    'soup': '🍲',
    'platos principales': '🍽️',
    'plato principal': '🍽️',
    'main course': '🍽️',
    'carnes': '🥩',
    'carne': '🥩',
    'meat': '🥩',
    'pescado': '🐟',
    'pescados': '🐟',
    'fish': '🐟',
    'mariscos': '🦐',
    'marisco': '🦐',
    'seafood': '🦐',
    'pollo': '🍗',
    'chicken': '🍗',
    'pasta': '🍝',
    'pastas': '🍝',
    'pizza': '🍕',
    'pizzas': '🍕',
    'hamburguesas': '🍔',
    'hamburguesa': '🍔',
    'burger': '🍔',
    'sandwiches': '🥪',
    'sandwich': '🥪',
    'tacos': '🌮',
    'taco': '🌮',
    'burritos': '🌯',
    'burrito': '🌯',
    'wraps': '🌯',
    'wrap': '🌯',
    'vegetariano': '🥬',
    'vegetariana': '🥬',
    'vegan': '🥬',
    'vegano': '🥬',
    'vegana': '🥬',
    'desayunos': '🥞',
    'desayuno': '🥞',
    'breakfast': '🥞',
    'almuerzos': '🍽️',
    'almuerzo': '🍽️',
    'lunch': '🍽️',
    'cenas': '🌙',
    'cena': '🌙',
    'dinner': '🌙',
    'especiales': '⭐',
    'especial': '⭐',
    'special': '⭐',
    'promociones': '🎉',
    'promoción': '🎉',
    'promotion': '🎉',
    'combo': '🍱',
    'combos': '🍱',
    'menú del día': '📅',
    'menu del dia': '📅',
    'daily menu': '📅',
    'kids': '👶',
    'niños': '👶',
    'infantil': '👶',
    'extras': '➕',
    'adicionales': '➕',
    'add-ons': '➕'
  };
  
  // Buscar coincidencia exacta primero
  if (emojiMap[name]) {
    return emojiMap[name];
  }
  
  // Buscar coincidencia parcial
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (name.includes(key) || key.includes(name)) {
      return emoji;
    }
  }
  
  // Emoji por defecto basado en palabras clave
  if (name.includes('bebida') || name.includes('drink')) return '🥤';
  if (name.includes('postre') || name.includes('dessert')) return '🍰';
  if (name.includes('entrada') || name.includes('appetizer')) return '🥗';
  if (name.includes('sopa') || name.includes('soup')) return '🍲';
  if (name.includes('carne') || name.includes('meat')) return '🥩';
  if (name.includes('pescado') || name.includes('fish')) return '🐟';
  if (name.includes('marisco') || name.includes('seafood')) return '🦐';
  if (name.includes('pollo') || name.includes('chicken')) return '🍗';
  if (name.includes('pasta')) return '🍝';
  if (name.includes('pizza')) return '🍕';
  if (name.includes('hamburguesa') || name.includes('burger')) return '🍔';
  if (name.includes('sandwich')) return '🥪';
  if (name.includes('taco')) return '🌮';
  if (name.includes('burrito') || name.includes('wrap')) return '🌯';
  if (name.includes('vegetar') || name.includes('vegan')) return '🥬';
  if (name.includes('desayuno') || name.includes('breakfast')) return '🥞';
  if (name.includes('almuerzo') || name.includes('lunch')) return '🍽️';
  if (name.includes('cena') || name.includes('dinner')) return '🌙';
  if (name.includes('especial') || name.includes('special')) return '⭐';
  if (name.includes('promo') || name.includes('promotion')) return '🎉';
  if (name.includes('combo')) return '🍱';
  if (name.includes('menú') || name.includes('menu')) return '📅';
  if (name.includes('niño') || name.includes('kids')) return '👶';
  if (name.includes('extra') || name.includes('adicional')) return '➕';
  
  // Emoji por defecto
  return '🍽️';
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
  onDismissCompletedOrder
}) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showToppings, setShowToppings] = useState(false);
  const { businessConfig: businessConfigContext } = useBusinessConfig();
  const businessConfig = businessConfigProp || businessConfigContext;

  // ── Scroll-spy + sticky state ──
  const [spyCategory, setSpyCategory] = useState('all');  // category visible by scroll
  const [isSticky, setIsSticky] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
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

  // Get icon for category based on name (professional style without emojis)
  const getCategoryIcon = (categoryName) => {
    // Return empty string to remove all emojis for professional look
    return '';
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

  // ── Scroll-spy: IntersectionObserver watches each category section ──
  useEffect(() => {
    if (userTapped) return; // pause spy while programmatic scroll is in-flight
    const sections = Object.entries(sectionRefs.current).filter(([, el]) => el);
    if (sections.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topEntry = null;
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        });
        if (topEntry) {
          setSpyCategory(topEntry.target.getAttribute('data-category-id'));
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    sections.forEach(([, el]) => obs.observe(el));
    return () => obs.disconnect();
  }, [userTapped, filteredProducts]);

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

  // The visually active pill is always based on spyCategory
  // (either set by IntersectionObserver or explicitly by handlePillClick)
  const visualActive = spyCategory;
  
  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-2">
      {/* Active Order Banner — Rappi style, above search */}
      <AnimatePresence>
        {hasActiveOrder && (() => {
          const isCompleted = activeOrderStatus === 'completed' || activeOrderStatus === 'ready';
          const statusMap = {
            pending_payment: { label: 'Pendiente de pago', icon: '💳', sub: 'Realiza el pago para continuar' },
            payment_uploaded: { label: 'Verificando pago', icon: '📤', sub: 'El restaurante revisa tu comprobante' },
            payment_confirmed: { label: 'Pago confirmado', icon: '✅', sub: 'Tu pedido será preparado pronto' },
            pending: { label: 'Pedido recibido', icon: '📋', sub: 'El restaurante recibió tu pedido' },
            inProgress: { label: 'En preparación', icon: '👨\u200d\ud83c\udf73', sub: 'Están preparando tu pedido' },
            ready: { label: '¡Pedido listo!', icon: '🎉', sub: 'Tu pedido está listo para recoger' },
            completed: { label: '¡Pedido completado!', icon: '✨', sub: 'Tu pedido ha sido entregado' },
          };
          const info = statusMap[activeOrderStatus] || { label: 'Pedido en curso', icon: '📋', sub: 'Toca para ver el estado' };

          return (
            <motion.div
              key="active-order-banner"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full mb-3 rounded-2xl overflow-hidden shadow-sm"
              style={{ backgroundColor: isCompleted ? '#10b981' : themeColor }}
            >
              <button
                onClick={isCompleted ? undefined : onViewActiveOrder}
                className="w-full active:scale-[0.98] transition-transform"
                aria-label={isCompleted ? 'Pedido completado' : `Ver pedido activo: ${info.label}`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
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
                    className="h-full bg-white/50 rounded-full"
                    animate={{ width: ['0%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Search Bar */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-5"
      >
        <div className="relative">
          <FaSearch 
            className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-sm sm:text-base pointer-events-none"
            style={{ color: searchTerm ? themeColor : '#94a3b8' }}
          />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 sm:pl-12 pr-10 py-3 sm:py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all duration-200 text-sm sm:text-base text-gray-700 placeholder-gray-400"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <FaTimes className="text-xs" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Sentinel — when this scrolls out of view, the pill bar becomes sticky */}
      <div ref={pillBarSentinelRef} className="h-0" />

      {/* ── Sticky Category Filter Pills + Progress Bar ── */}
      <div
        ref={pillBarRef}
        className={`transition-shadow duration-200 z-40 ${
          isSticky
            ? 'sticky top-0 bg-white/95 backdrop-blur-md shadow-sm -mx-3 px-3 sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6 py-2'
            : 'mb-4 sm:mb-5'
        }`}
      >
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-1 px-0.5 min-w-max">
            {/* "All" pill */}
            <motion.button
              ref={el => (pillRefs.current['all'] = el)}
              onClick={() => handlePillClick('all')}
              whileTap={{ scale: 0.93 }}
              className={`px-4 py-2 rounded-full whitespace-nowrap font-semibold text-sm transition-all duration-200 ${
                visualActive === 'all'
                  ? 'shadow-lg'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 shadow-sm'
              }`}
              style={visualActive === 'all' ? {
                backgroundColor: themeColor,
                color: themeTextColor,
                boxShadow: `0 4px 14px ${themeColor}35`
              } : undefined}
            >
              🍽️ Todos ({totalProductCount})
            </motion.button>

            {/* Category pills */}
            {categoriesWithProducts.map((category) => {
              const isActive = visualActive === category._id;
              return (
                <motion.button
                  key={category._id}
                  ref={el => (pillRefs.current[category._id] = el)}
                  onClick={() => handlePillClick(category._id)}
                  whileTap={{ scale: 0.93 }}
                  className={`px-4 py-2 rounded-full whitespace-nowrap font-semibold text-sm transition-all duration-200 ${
                    isActive
                      ? 'shadow-lg'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 shadow-sm'
                  }`}
                  style={isActive ? {
                    backgroundColor: themeColor,
                    color: themeTextColor,
                    boxShadow: `0 4px 14px ${themeColor}35`
                  } : undefined}
                >
                  {getCategoryEmoji(category.name)} {category.name} ({category.count})
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Scroll progress line ── */}
        <div className="h-[2px] bg-gray-100 mt-1.5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: themeColor }}
            animate={{ width: `${scrollProgress * 100}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>
      </div>

      {/* Productos Destacados */}
      {businessId && (
        <FeaturedProducts
          businessId={businessId}
          onAddToCart={addToCart}
          theme={businessConfig?.theme}
          onToppingsOpen={onToppingsOpen}
          onToppingsClose={onToppingsClose}
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
                  No hay productos que coincidan con <span className="font-semibold text-gray-600">"{searchTerm}"</span>
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
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Explora categorías</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {categoriesWithProducts.slice(0, 4).map(cat => (
                        <motion.button
                          key={cat._id}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => { clearSearch(); handlePillClick(cat._id); }}
                          className="px-3.5 py-2 rounded-full text-sm font-medium border border-gray-200 bg-white text-gray-700 shadow-sm hover:shadow-md transition-all"
                        >
                          {getCategoryEmoji(cat.name)} {cat.name}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <EmptyMenuIllustration themeColor={themeColor} size={150} />
                <h3 className="mt-4 text-lg font-bold text-gray-700">
                  Menú vacío
                </h3>
                <p className="mt-1.5 text-sm text-gray-500 max-w-xs">
                  Aún no hay productos disponibles en esta categoría.
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
              // Group products by category
              categoriesWithProducts.map((category, categoryIndex) => {
              const categoryProducts = filteredProducts.filter(product => product.category === category._id);
              if (categoryProducts.length === 0) return null;
              
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
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-base sm:text-lg shadow-sm"
                        style={{
                          backgroundColor: `${themeColor}15`
                        }}
                      >
                        {getCategoryEmoji(category.name)}
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-gray-800">{category.name}</h2>
                      <div 
                        className="flex-1 h-px"
                        style={{
                          background: `linear-gradient(to right, ${themeColor}30, transparent)`
                        }}
                      />
                    </div>
                    <motion.div 
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {categoryProducts.map((product) => (
                        <ProductCard
                          key={product._id}
                          product={product}
                          addToCart={addToCart}
                          onToppingsOpen={onToppingsOpen}
                          onToppingsClose={onToppingsClose}
                          subscriptionStatus={subscriptionStatus}
                        />
                      ))}
                    </motion.div>
                  </motion.div>
              );
            })
          ) : (
              // Specific category selected
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Category Header */}
                {categoriesWithProducts.filter(category => category._id === activeCategory).map(category => (
                  <div 
                    key={category._id}
                    className="flex items-center gap-3 mb-3 sm:mb-4"
                  >
                    <div 
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl shadow-sm"
                      style={{
                        backgroundColor: `${themeColor}15`
                      }}
                    >
                      {getCategoryEmoji(category.name)}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">{category.name}</h2>
                    <div 
                      className="flex-1 h-px"
                      style={{
                        background: `linear-gradient(to right, ${themeColor}30, transparent)`
                      }}
                    />
                  </div>
                ))}
                
                <motion.div 
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      addToCart={addToCart}
                      onToppingsOpen={onToppingsOpen}
                      onToppingsClose={onToppingsClose}
                      subscriptionStatus={subscriptionStatus}
                    />
                  ))}
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

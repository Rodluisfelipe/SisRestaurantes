import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductCard from './Productcard';
import ProductToppingsSelector from './ProductToppingsSelector';
import { useBusinessConfig } from '../Context/BusinessContext';

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
  onToppingsClose 
}) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showToppings, setShowToppings] = useState(false);
  const { businessConfig } = useBusinessConfig();

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

  // Filter products based on search and category
  useEffect(() => {
    let filtered = products;

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

  // Toggle view mode
  const toggleViewMode = (mode) => {
    setViewMode(mode);
  };

  // Handle showing toppings selector
  const handleShowToppings = (product) => {
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
  
  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-1">
      {/* Modern Search and View Options Bar */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6 lg:mb-8"
      >
        {/* Enhanced Search Bar */}
        <div className="relative flex w-full">
          <motion.div 
            className="relative flex-1"
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
          <input
            type="text"
              placeholder="Buscar productos..."
            value={searchTerm}
            onChange={handleSearchChange}
              className="w-full px-3 sm:px-6 py-3 sm:py-4 pl-10 sm:pl-14 pr-20 sm:pr-32 bg-white border-2 border-slate-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 transition-all duration-300 text-sm sm:text-base text-slate-700 placeholder-slate-400 shadow-lg backdrop-blur-sm"
              style={{
                '--tw-ring-color': `${businessConfig?.theme?.buttonColor || '#f97316'}20`,
                borderColor: searchTerm ? (businessConfig?.theme?.buttonColor || '#f97316') : undefined
              }}
            />
            {/* Enhanced Search icon */}
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 sm:pl-5 pointer-events-none">
              <motion.div
                animate={{ rotate: searchTerm ? 360 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg 
                  className="w-5 h-5 sm:w-6 sm:h-6" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  style={{ color: businessConfig?.theme?.buttonColor || '#f97316' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </motion.div>
          </div>
          
            {/* Clear button */}
            <AnimatePresence>
            {searchTerm && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                onClick={clearSearch}
                  className="absolute inset-y-0 right-16 sm:right-24 flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 my-auto text-slate-400 rounded-full transition-all duration-200"
                  style={{
                    '--hover-color': businessConfig?.theme?.buttonColor || '#f97316',
                    '--hover-bg': `${businessConfig?.theme?.buttonColor || '#f97316'}10`
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = businessConfig?.theme?.buttonColor || '#f97316';
                    e.target.style.backgroundColor = `${businessConfig?.theme?.buttonColor || '#f97316'}10`;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#94a3b8';
                    e.target.style.backgroundColor = 'transparent';
                  }}
                  aria-label="Limpiar búsqueda"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>
            
            {/* Modern View Mode Toggle */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3">
              <div className="flex bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg sm:rounded-xl p-0.5 sm:p-1 shadow-inner">
                <motion.button
              onClick={() => toggleViewMode('grid')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-1.5 sm:p-2 rounded-md sm:rounded-lg transition-all duration-200 ${
                viewMode === 'grid' 
                      ? 'text-white shadow-lg' 
                      : 'text-slate-600 hover:bg-white/50'
                  }`}
                  style={{
                    backgroundColor: viewMode === 'grid' ? (businessConfig?.theme?.buttonColor || '#f97316') : 'transparent',
                    color: viewMode === 'grid' ? (businessConfig?.theme?.buttonTextColor || '#ffffff') : undefined
                  }}
                  onMouseEnter={(e) => {
                    if (viewMode !== 'grid') {
                      e.target.style.color = businessConfig?.theme?.buttonColor || '#f97316';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== 'grid') {
                      e.target.style.color = '#475569';
                    }
                  }}
                  aria-label="Vista en cuadrícula"
                >
                  <span className="text-sm sm:text-lg">⚏</span>
                </motion.button>
                <motion.button
              onClick={() => toggleViewMode('list')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-1.5 sm:p-2 rounded-md sm:rounded-lg transition-all duration-200 ${
                viewMode === 'list' 
                      ? 'text-white shadow-lg' 
                      : 'text-slate-600 hover:bg-white/50'
                  }`}
                  style={{
                    backgroundColor: viewMode === 'list' ? (businessConfig?.theme?.buttonColor || '#f97316') : 'transparent',
                    color: viewMode === 'list' ? (businessConfig?.theme?.buttonTextColor || '#ffffff') : undefined
                  }}
                  onMouseEnter={(e) => {
                if (viewMode !== 'list') {
                      e.target.style.color = businessConfig?.theme?.buttonColor || '#f97316';
                }
              }}
                  onMouseLeave={(e) => {
                if (viewMode !== 'list') {
                      e.target.style.color = '#475569';
                    }
                  }}
                  aria-label="Vista en lista"
                >
                  <span className="text-sm sm:text-lg">⚏</span>
                </motion.button>
              </div>
          </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Modern Category Filter Pills */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-4 sm:mb-6 lg:mb-8 overflow-x-auto scrollbar-thin scrollbar-thumb-orange-300 scrollbar-track-orange-100"
      >
        <div className="flex space-x-2 sm:space-x-3 pb-2 px-1 min-w-max">
          {/* "All" category pill */}
          <motion.button
            onClick={() => setActiveCategory('all')}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-full whitespace-nowrap font-medium sm:font-semibold text-sm sm:text-base transition-all duration-300 shadow-lg backdrop-blur-sm ${
              activeCategory === 'all'
                ? 'text-white'
                : 'bg-white/80 text-slate-700 hover:bg-white hover:shadow-xl border-2 border-slate-200'
            }`}
            style={{
              backgroundColor: activeCategory === 'all' ? (businessConfig?.theme?.buttonColor || '#f97316') : undefined,
              color: activeCategory === 'all' ? (businessConfig?.theme?.buttonTextColor || '#ffffff') : undefined,
              boxShadow: activeCategory === 'all' ? `0 10px 25px ${businessConfig?.theme?.buttonColor || '#f97316'}25` : undefined
            }}
            onMouseEnter={(e) => {
              if (activeCategory !== 'all') {
                e.target.style.borderColor = businessConfig?.theme?.buttonColor || '#f97316';
              }
            }}
            onMouseLeave={(e) => {
              if (activeCategory !== 'all') {
                e.target.style.borderColor = '#e2e8f0';
              }
            }}
          >
            Todos ({totalProductCount})
          </motion.button>

          {/* Category pills */}
          {categoriesWithProducts.map((category, index) => (
            <motion.button
              key={category._id}
              onClick={() => setActiveCategory(category._id)}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + (index * 0.05) }}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-full whitespace-nowrap font-medium sm:font-semibold text-sm sm:text-base transition-all duration-300 shadow-lg backdrop-blur-sm ${
                activeCategory === category._id
                  ? 'text-white'
                  : 'bg-white/80 text-slate-700 hover:bg-white hover:shadow-xl border-2 border-slate-200'
              }`}
              style={{
                backgroundColor: activeCategory === category._id ? (businessConfig?.theme?.buttonColor || '#f97316') : undefined,
                color: activeCategory === category._id ? (businessConfig?.theme?.buttonTextColor || '#ffffff') : undefined,
                boxShadow: activeCategory === category._id ? `0 10px 25px ${businessConfig?.theme?.buttonColor || '#f97316'}25` : undefined
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== category._id) {
                  e.target.style.borderColor = businessConfig?.theme?.buttonColor || '#f97316';
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== category._id) {
                  e.target.style.borderColor = '#e2e8f0';
                }
              }}
            >
              {category.name} ({category.count})
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Modern Products Display */}
      <AnimatePresence mode="wait">
      {viewMode === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
          {activeCategory === 'all' ? (
              // When "All" is selected, group products by category with animations
              categoriesWithProducts.map((category, categoryIndex) => {
              const categoryProducts = filteredProducts.filter(product => product.category === category._id);
              
              // Only render category if it has products after filtering
              if (categoryProducts.length === 0) return null;
              
              return (
                  <motion.div 
                    key={category._id} 
                    className="mb-6 sm:mb-8 lg:mb-12"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: categoryIndex * 0.1 }}
                  >
                    <motion.div 
                      className="flex items-center mb-4 sm:mb-6"
                      whileHover={{ x: 10 }}
                    >
                      <div 
                        className="w-2 h-8 sm:h-12 rounded-lg mr-3 sm:mr-4 shadow-lg"
                        style={{
                          backgroundColor: businessConfig?.theme?.buttonColor || '#f97316'
                        }}
                      >
                      </div>
                      <h2 className="text-lg sm:text-2xl font-bold text-slate-800">{category.name}</h2>
                      <div 
                        className="flex-1 h-px ml-4"
                        style={{
                          background: `linear-gradient(to right, ${businessConfig?.theme?.buttonColor || '#f97316'}40, transparent)`
                        }}
                      ></div>
                    </motion.div>
                    <motion.div 
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-8"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {categoryProducts.map((product, productIndex) => (
                        <ProductCard
                          key={product._id}
                          product={product}
                          addToCart={addToCart}
                          onToppingsOpen={onToppingsOpen}
                          onToppingsClose={onToppingsClose}
                        />
                      ))}
                    </motion.div>
                  </motion.div>
              );
            })
          ) : (
              // When a specific category is selected
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Category Header */}
                {categoriesWithProducts.filter(category => category._id === activeCategory).map(category => (
                  <motion.div 
                    key={category._id}
                    className="flex items-center mb-4 sm:mb-6"
                    whileHover={{ x: 10 }}
                  >
                    <div 
                      className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg"
                      style={{
                        backgroundColor: businessConfig?.theme?.buttonColor || '#f97316'
                      }}
                    >
                      <span className="text-sm sm:text-xl">{getCategoryEmoji(category.name)}</span>
                    </div>
                    <h2 className="text-lg sm:text-2xl font-bold text-slate-800">{category.name}</h2>
                    <div 
                      className="flex-1 h-px ml-4"
                      style={{
                        background: `linear-gradient(to right, ${businessConfig?.theme?.buttonColor || '#f97316'}40, transparent)`
                      }}
                    ></div>
                  </motion.div>
                ))}
                
                <motion.div 
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-8"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredProducts.map((product, index) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      addToCart={addToCart}
                      onToppingsOpen={onToppingsOpen}
                      onToppingsClose={onToppingsClose}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          // List View
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-2 sm:space-y-4"
          >
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200/50 flex overflow-hidden"
              >
                {/* Product Image */}
                <div className="w-16 h-16 sm:w-24 sm:h-24 relative flex-shrink-0">
                      {product.image ? (
                        <img 
                          src={product.image} 
                          alt={product.name}
                      className="w-full h-full object-contain"
                        />
                      ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
                      <span className="text-lg sm:text-2xl opacity-60">🍽️</span>
                        </div>
                      )}
                    </div>

                {/* Product Info */}
                <div className="p-3 sm:p-4 flex-1 flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-lg font-bold text-slate-800 mb-1 leading-tight">{product.name}</h3>
                    {product.description && (
                      <p className="text-xs sm:text-sm text-slate-600 line-clamp-1 mb-1 sm:mb-2 hidden sm:block">{product.description}</p>
                    )}
                    <span 
                      className="text-base sm:text-xl font-bold"
                      style={{
                        color: businessConfig?.theme?.buttonColor || '#f97316'
                      }}
                    >
                      ${Number(product.price).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>

                  <motion.button
                    onClick={() => handleShowToppings(product)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-8 h-8 sm:w-10 sm:h-10 text-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg ml-2 sm:ml-4 flex-shrink-0"
                    style={{
                      backgroundColor: businessConfig?.theme?.buttonColor || '#f97316',
                      color: businessConfig?.theme?.buttonTextColor || '#ffffff'
                    }}
                        aria-label="Agregar al carrito"
                      >
                    <span className="text-sm sm:text-lg">➕</span>
                  </motion.button>
                </div>
              </motion.div>
            ))}
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

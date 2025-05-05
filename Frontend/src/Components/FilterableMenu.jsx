import React, { useState, useEffect } from 'react';
import ProductCard from './Productcard';
import ProductToppingsSelector from './ProductToppingsSelector';
import { useBusinessConfig } from '../Context/BusinessContext';

/**
 * FilterableMenu Component
 * 
 * A component for displaying products with category filtering, search capabilities,
 * and view toggle options.
 * 
 * @param {Object} props Component props
 * @param {Array} props.products Array of product objects
 * @param {Array} props.categories Array of category objects
 * @param {Function} props.addToCart Function to add a product to cart
 * @param {Function} props.onToppingsOpen Function called when toppings selector opens
 * @param {Function} props.onToppingsClose Function called when toppings selector closes
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
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [selectedProduct, setSelectedProduct] = useState(null); // Track product for toppings selection
  const [showToppings, setShowToppings] = useState(false); // Control toppings modal visibility
  const { businessConfig } = useBusinessConfig();

  // Get category order from localStorage to maintain consistent ordering
  const getCategoryOrder = () => {
    try {
      const savedOrder = localStorage.getItem('categoryOrderSettings');
      return savedOrder ? JSON.parse(savedOrder) : {};
    } catch (error) {
      console.error('Error getting category order:', error);
      return {};
    }
  };

  // Sort categories based on saved order
  const getSortedCategories = (categories) => {
    const orderMap = getCategoryOrder();
    
    return [...categories].sort((a, b) => {
      const orderA = orderMap[a._id] !== undefined ? orderMap[a._id] : 999;
      const orderB = orderMap[b._id] !== undefined ? orderMap[b._id] : 999;
      return orderA - orderB;
    });
  };

  // Update filtered products when products, categories, active category, or search term changes
  useEffect(() => {
    let result = [...products];
    
    // Apply category filter
    if (activeCategory !== 'all') {
      result = result.filter(product => product.category === activeCategory);
    }
    
    // Apply search filter (case insensitive)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(product => 
        product.name.toLowerCase().includes(term) || 
        (product.description && product.description.toLowerCase().includes(term))
      );
    }
    
    setFilteredProducts(result);
  }, [products, categories, activeCategory, searchTerm]);

  // Create sorted category list with counts
  const categoriesWithCounts = getSortedCategories(categories).map(category => {
    const count = products.filter(product => product.category === category._id).length;
    return { ...category, count };
  });

  // Only display categories that have products
  const categoriesWithProducts = categoriesWithCounts.filter(category => category.count > 0);

  // Calculate total product count for "All" category
  const totalProductCount = products.length;

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Clear search input
  const clearSearch = () => {
    setSearchTerm('');
  };

  // Toggle view mode between grid and list
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

  // Custom list view for product display
  const ProductListItem = ({ product }) => {
    return (
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 flex">
        {/* Imagen del producto */}
        <div className="w-24 h-24 relative flex-shrink-0">
          {product.image ? (
            <img 
              src={product.image} 
              alt={product.name}
              className="w-full h-full object-cover rounded-l-lg"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 rounded-l-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Información del producto */}
        <div className="p-3 flex-1 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              {product.name}
            </h2>
            {product.description && (
              <p className="text-xs text-gray-600 line-clamp-2 mt-1">{product.description}</p>
            )}
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm font-bold text-black">
              {(() => {
                const price = Number(product.price);
                const options = { minimumFractionDigits: 0, maximumFractionDigits: 1 };
                return price.toLocaleString('es-CO', options);
              })()}
            </span>
            <button
              onClick={() => {
                // Siempre mostrar el modal de toppings, incluso si no hay opciones
                handleShowToppings(product);
              }}
              style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-colors duration-300"
              aria-label="Agregar al carrito"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto px-4 py-1">
      {/* Search and View Options Bar */}
      <div className="mb-4">
        {/* Search Bar with integrated view toggles */}
        <div className="relative flex w-full">
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full px-4 py-2 pl-10 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* Search icon */}
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 text-gray-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
              />
            </svg>
          </div>
          
          {/* View Toggle Buttons (positioned at the end of the search bar) */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">
            {/* Clear button (only show if there's text) */}
            {searchTerm && (
              <button 
                onClick={clearSearch}
                className="mx-1 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                </svg>
              </button>
            )}
            
            {/* Divider */}
            <div className="h-6 w-px bg-gray-300 mx-1"></div>
            
            {/* Grid View Button */}
            <button
              onClick={() => toggleViewMode('grid')}
              className={`p-1 rounded-md mx-1 ${
                viewMode === 'grid' 
                  ? 'text-blue-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              style={
                viewMode === 'grid' 
                  ? { color: businessConfig?.theme?.buttonColor || '#3B82F6' }
                  : { color: 'rgba(156, 163, 175, 1)', 
                      ':hover': { color: businessConfig?.theme?.buttonColor || '#3B82F6' } 
                    }
              }
              aria-label="Grid View"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" 
                />
              </svg>
            </button>
            
            {/* List View Button */}
            <button
              onClick={() => toggleViewMode('list')}
              className={`p-1 rounded-md mx-1 ${
                viewMode === 'list' 
                  ? 'text-blue-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              style={
                viewMode === 'list' 
                  ? { color: businessConfig?.theme?.buttonColor || '#3B82F6' }
                  : { color: 'rgba(156, 163, 175, 1)' }
              }
              onMouseOver={(e) => {
                if (viewMode !== 'list') {
                  e.currentTarget.style.color = businessConfig?.theme?.buttonColor || '#3B82F6';
                }
              }}
              onMouseOut={(e) => {
                if (viewMode !== 'list') {
                  e.currentTarget.style.color = 'rgba(156, 163, 175, 1)';
                }
              }}
              aria-label="List View"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 6h16M4 12h16M4 18h16" 
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="mb-6 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <div className="flex space-x-2 pb-2">
          {/* "All" category tab */}
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-md whitespace-nowrap transition-colors ${
              activeCategory === 'all'
                ? `bg-${businessConfig?.theme?.buttonColor || 'blue-600'} text-${businessConfig?.theme?.buttonTextColor || 'white'}`
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            style={
              activeCategory === 'all'
                ? {
                    backgroundColor: businessConfig?.theme?.buttonColor || '#3B82F6',
                    color: businessConfig?.theme?.buttonTextColor || '#FFFFFF'
                  }
                : {
                    ':hover': { 
                      backgroundColor: `${businessConfig?.theme?.buttonColor}33` || 'rgba(209, 213, 219, 1)'
                    }
                  }
            }
            onMouseOver={(e) => {
              if (activeCategory !== 'all') {
                e.currentTarget.style.backgroundColor = `${businessConfig?.theme?.buttonColor}33` || 'rgba(209, 213, 219, 1)';
              }
            }}
            onMouseOut={(e) => {
              if (activeCategory !== 'all') {
                e.currentTarget.style.backgroundColor = 'rgba(229, 231, 235, 1)';
              }
            }}
          >
            Todos ({totalProductCount})
          </button>
          
          {/* Category tabs */}
          {categoriesWithProducts.map(category => (
            <button
              key={category._id}
              onClick={() => setActiveCategory(category._id)}
              className={`px-4 py-2 rounded-md whitespace-nowrap transition-colors ${
                activeCategory === category._id
                  ? `bg-${businessConfig?.theme?.buttonColor || 'blue-600'} text-${businessConfig?.theme?.buttonTextColor || 'white'}`
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              style={
                activeCategory === category._id
                  ? {
                      backgroundColor: businessConfig?.theme?.buttonColor || '#3B82F6',
                      color: businessConfig?.theme?.buttonTextColor || '#FFFFFF'
                    }
                  : {}
              }
              onMouseOver={(e) => {
                if (activeCategory !== category._id) {
                  e.currentTarget.style.backgroundColor = `${businessConfig?.theme?.buttonColor}33` || 'rgba(209, 213, 219, 1)';
                }
              }}
              onMouseOut={(e) => {
                if (activeCategory !== category._id) {
                  e.currentTarget.style.backgroundColor = 'rgba(229, 231, 235, 1)';
                }
              }}
            >
              {category.name} ({category.count})
            </button>
          ))}
        </div>
      </div>

      {/* Products display - conditionally rendered based on viewMode */}
      {viewMode === 'grid' ? (
        <div>
          {activeCategory === 'all' ? (
            // When "All" is selected, group products by category
            categoriesWithProducts.map(category => {
              const categoryProducts = filteredProducts.filter(product => product.category === category._id);
              
              // Only render category if it has products after filtering
              if (categoryProducts.length === 0) return null;
              
              return (
                <div key={category._id} className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">{category.name}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {categoryProducts.map(product => (
                      <div key={product._id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100">
                        {/* Imagen del producto */}
                        <div className="w-full h-32 relative">
                          {product.image ? (
                            <img 
                              src={product.image} 
                              alt={product.name}
                              className="w-full h-full object-cover rounded-t-lg"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 rounded-t-lg flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Información del producto y botón */}
                        <div className="p-3 flex justify-between items-center">
                          <div className="flex-1 min-w-0 mr-2">
                            <h2 className="text-base font-semibold text-gray-800 truncate">
                              {product.name}
                            </h2>
                            <span className="text-sm font-bold text-black">
                              {(() => {
                                const price = Number(product.price);
                                const options = { minimumFractionDigits: 0, maximumFractionDigits: 1 };
                                return price.toLocaleString('es-CO', options);
                              })()}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              // Siempre mostrar el modal de toppings, incluso si no hay opciones
                              handleShowToppings(product);
                            }}
                            style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-colors duration-300"
                            aria-label="Agregar al carrito"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            // When a specific category is selected, show its products with the category title
            <div>
              {/* Display selected category title */}
              {categoriesWithProducts.filter(category => category._id === activeCategory).map(category => (
                <h2 key={category._id} className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">{category.name}</h2>
              ))}
              
              {/* Display products in grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {filteredProducts.map(product => (
                  <div key={product._id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100">
                    {/* Imagen del producto */}
                    <div className="w-full h-32 relative">
                      {product.image ? (
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-full h-full object-cover rounded-t-lg"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 rounded-t-lg flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Información del producto y botón */}
                    <div className="p-3 flex justify-between items-center">
                      <div className="flex-1 min-w-0 mr-2">
                        <h2 className="text-base font-semibold text-gray-800 truncate">
                          {product.name}
                        </h2>
                        <span className="text-sm font-bold text-black">
                          {(() => {
                            const price = Number(product.price);
                            const options = { minimumFractionDigits: 0, maximumFractionDigits: 1 };
                            return price.toLocaleString('es-CO', options);
                          })()}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          // Siempre mostrar el modal de toppings, incluso si no hay opciones
                          handleShowToppings(product);
                        }}
                        style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }}
                        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-colors duration-300"
                        aria-label="Agregar al carrito"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {activeCategory === 'all' ? (
            // When "All" is selected, group products by category in list view
            categoriesWithProducts.map(category => {
              const categoryProducts = filteredProducts.filter(product => product.category === category._id);
              
              // Only render category if it has products after filtering
              if (categoryProducts.length === 0) return null;
              
              return (
                <div key={category._id} className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">{category.name}</h2>
                  <div className="flex flex-col space-y-3">
                    {categoryProducts.map(product => (
                      <ProductListItem
                        key={product._id}
                        product={product}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            // When a specific category is selected in list view
            <div>
              {/* Display selected category title */}
              {categoriesWithProducts.filter(category => category._id === activeCategory).map(category => (
                <h2 key={category._id} className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">{category.name}</h2>
              ))}
              
              {/* Display products in list */}
              <div className="flex flex-col space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {filteredProducts.map(product => (
                  <ProductListItem
                    key={product._id}
                    product={product}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state when no products match the filter */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-8">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-12 w-12 mx-auto text-gray-400 mb-3" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <p className="text-gray-600">
            {searchTerm 
              ? `No se encontraron productos para "${searchTerm}"${activeCategory !== 'all' ? ' en esta categoría' : ''}.` 
              : 'No hay productos disponibles en esta categoría.'}
          </p>
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="mt-2 text-blue-600 hover:text-blue-800 hover:underline"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      )}

      {/* Toppings Selector Modal (shared between grid and list views) */}
      {showToppings && selectedProduct && (
        <div onClick={(e) => e.stopPropagation()} className="debugging-wrapper">
          <ProductToppingsSelector
            product={{
              ...selectedProduct,
              toppingGroups: Array.isArray(selectedProduct.toppingGroups) ? selectedProduct.toppingGroups : []
            }}
            onAddToCart={handleAddToCartWithToppings}
            onClose={handleCloseToppings}
          />
        </div>
      )}
    </div>
  );
};

export default FilterableMenu; 
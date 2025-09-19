import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../services/api';

const ProductOrderSelector = ({ products = [], categories = [], businessId, onOrderChange }) => {
  const [orderedProducts, setOrderedProducts] = useState(products);
  const [draggedItem, setDraggedItem] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [productsByCategory, setProductsByCategory] = useState({});

  useEffect(() => {
    setOrderedProducts(products);
    setHasChanges(false);
    
    // Agrupar productos por categoría
    const grouped = {};
    const uncategorized = [];
    
    products.forEach(product => {
      if (product.category) {
        const categoryId = typeof product.category === 'object' ? product.category._id : product.category;
        if (!grouped[categoryId]) {
          grouped[categoryId] = [];
        }
        grouped[categoryId].push(product);
      } else {
        uncategorized.push(product);
      }
    });
    
    // Si hay productos sin categoría, agregarlos
    if (uncategorized.length > 0) {
      grouped['uncategorized'] = uncategorized;
    }
    
    setProductsByCategory(grouped);
    
    // Expandir todas las categorías por defecto
    const initialExpanded = {};
    Object.keys(grouped).forEach(categoryId => {
      initialExpanded[categoryId] = true;
    });
    setExpandedCategories(initialExpanded);
  }, [products]);

  const handleDragStart = (e, categoryId, productIndex) => {
    setDraggedItem({ categoryId, productIndex });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.parentNode);
  };

  const handleDragOver = (e, categoryId, productIndex) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.categoryId !== categoryId || draggedItem.productIndex === productIndex) return;

    const newProductsByCategory = { ...productsByCategory };
    const categoryProducts = [...newProductsByCategory[categoryId]];
    
    const draggedProduct = categoryProducts[draggedItem.productIndex];
    categoryProducts.splice(draggedItem.productIndex, 1);
    categoryProducts.splice(productIndex, 0, draggedProduct);

    newProductsByCategory[categoryId] = categoryProducts;
    setProductsByCategory(newProductsByCategory);
    setDraggedItem({ categoryId, productIndex });
    setHasChanges(true);
    console.log('🔄 Cambios detectados en ProductOrderSelector');
  };

  const handleDragEnd = async () => {
    setDraggedItem(null);
    // Auto-guardar inmediatamente después del drag and drop
    if (hasChanges) {
      await saveOrder();
    }
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const saveOrder = async () => {
    setSaveLoading(true);
    setError(null);
    try {
      // Reconstruir el array completo de productos con el nuevo orden
      const allOrderedProducts = [];
      let globalIndex = 0;
      
      // Procesar cada categoría en orden
      Object.keys(productsByCategory).forEach(categoryId => {
        const categoryProducts = productsByCategory[categoryId];
        categoryProducts.forEach(product => {
          allOrderedProducts.push({
            _id: product._id,
            order: globalIndex
          });
          globalIndex++;
        });
      });

      await api.put('/products/reorder', { 
        businessId, 
        products: allOrderedProducts 
      }, {
        timeout: 15000 // 15 segundos de timeout
      });

      setSaveLoading(false);
      setSuccessMessage('✅ Orden guardado automáticamente');
      setHasChanges(false);
      
      // Reconstruir el array completo para el componente padre
      const reorderedProducts = [];
      Object.keys(productsByCategory).forEach(categoryId => {
        reorderedProducts.push(...productsByCategory[categoryId]);
      });
      
      // Notificar al componente padre del cambio
      if (onOrderChange) {
        onOrderChange(reorderedProducts);
      }
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error al guardar el orden:', error);
      setError('Error al guardar el orden de productos');
      setSaveLoading(false);
      setTimeout(() => setError(null), 3000);
    }
  };


  const getCategoryName = (categoryId) => {
    if (categoryId === 'uncategorized') return 'Sin Categoría';
    
    const category = categories.find(cat => cat._id === categoryId);
    return category ? category.name : 'Categoría Desconocida';
  };

  if (orderedProducts.length === 0) {
    return (
      <div className="p-6 bg-white rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
        <div className="text-4xl mb-3">📦</div>
        <p>No hay productos para reordenar.</p>
        <p className="text-sm mt-2">Agrega productos primero para poder reordenarlos.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <span className="mr-2">🔄</span>
            Reordenar Productos
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Arrastra y suelta para cambiar el orden en que aparecen los productos en el menú
          </p>
        </div>
        
      </div>

      {/* Messages */}
      <AnimatePresence>
        {saveLoading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-blue-100 text-blue-800 rounded-lg border border-blue-200"
          >
            💾 Guardando orden automáticamente...
          </motion.div>
        )}
        
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg border border-green-200"
          >
            ✅ {successMessage}
          </motion.div>
        )}
        
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg border border-red-200"
          >
            ❌ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Products List by Category */}
      <div className="space-y-4 max-h-[60vh] lg:max-h-[50vh] overflow-y-auto">
        {Object.keys(productsByCategory)
          .sort((a, b) => {
            // Ordenar categorías: uncategorized al final, resto por displayOrder
            if (a === 'uncategorized') return 1;
            if (b === 'uncategorized') return -1;
            
            const catA = categories.find(cat => cat._id === a);
            const catB = categories.find(cat => cat._id === b);
            
            const orderA = catA?.displayOrder !== undefined ? catA.displayOrder : 999;
            const orderB = catB?.displayOrder !== undefined ? catB.displayOrder : 999;
            
            return orderA - orderB;
          })
          .map(categoryId => {
          const categoryProducts = productsByCategory[categoryId];
          const isExpanded = expandedCategories[categoryId];
          
          return (
            <div key={categoryId} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Category Header */}
              <motion.div
                whileHover={{ backgroundColor: '#f3f4f6' }}
                className="flex items-center justify-between p-3 lg:p-4 bg-gray-50 border-b border-gray-200 cursor-pointer"
                onClick={() => toggleCategory(categoryId)}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-lg">
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                  <h3 className="font-semibold text-gray-800">{getCategoryName(categoryId)}</h3>
                  <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
                    {categoryProducts.length} productos
                  </span>
                </div>
              </motion.div>
              
              {/* Category Products */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 lg:p-4 space-y-2 lg:space-y-3">
                      <AnimatePresence>
                        {categoryProducts.map((product, productIndex) => (
                          <motion.div
                            key={product._id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            draggable
                            onDragStart={(e) => handleDragStart(e, categoryId, productIndex)}
                            onDragOver={(e) => handleDragOver(e, categoryId, productIndex)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center bg-white border border-gray-200 rounded-lg p-2 lg:p-3 shadow-sm cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-all duration-150 ${
                              draggedItem?.categoryId === categoryId && draggedItem?.productIndex === productIndex ? 'opacity-50' : ''
                            }`}
                          >
                            <GripVertical className="text-gray-400 mr-3 flex-shrink-0" size={16} />
                            
                            <div className="flex items-center flex-grow min-w-0">
                              <div className="bg-blue-100 text-blue-800 font-semibold text-xs px-2 py-1 rounded-full mr-3 flex-shrink-0">
                                #{productIndex + 1}
                              </div>
                              
                              <div className="flex items-center space-x-2 lg:space-x-3 flex-grow min-w-0">
                                {product.image && (
                                  <img 
                                    src={product.image} 
                                    alt={product.name}
                                    className="w-8 h-8 lg:w-10 lg:h-10 object-cover rounded-lg flex-shrink-0"
                                  />
                                )}
                                
                                <div className="flex-grow min-w-0">
                                  <h4 className="font-medium text-gray-800 truncate text-xs lg:text-sm">{product.name}</h4>
                                  {product.description && (
                                    <p className="text-xs text-gray-600 truncate">{product.description}</p>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-1 lg:space-x-2 flex-shrink-0">
                                  <span className="font-semibold text-green-600 text-xs lg:text-sm">
                                    ${product.price?.toLocaleString() || '0'}
                                  </span>
                                  
                                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    product.active !== false 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {product.active !== false ? '🟢' : '🔴'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-100 text-xs text-gray-600">
          Debug: hasChanges = {hasChanges.toString()}
        </div>
      )}
    </div>
  );
};

export default ProductOrderSelector;

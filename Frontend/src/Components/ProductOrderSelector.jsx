import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaGripVertical, FaChevronDown, FaChevronRight,
  FaSyncAlt, FaCheck, FaExclamationTriangle, FaBoxOpen, FaSortAmountDown
} from 'react-icons/fa';
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
    
    // Validar que products sea un array antes de usar forEach
    if (!Array.isArray(products)) {
      console.warn('ProductOrderSelector: products no es un array:', products);
      setProductsByCategory({});
      return;
    }
    
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

      await api.put('/products/products-reorder', { 
        businessId, 
        products: allOrderedProducts 
      }, {
        timeout: 15000 // 15 segundos de timeout
      });

      setSaveLoading(false);
      setSuccessMessage('Orden guardado correctamente');
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
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-10 text-center">
        <FaBoxOpen className="text-2xl text-slate-300 mb-2" />
        <p className="text-sm text-slate-500 font-medium">Sin productos para reordenar</p>
        <p className="text-xs text-slate-400 mt-1">Agrega productos primero</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <FaSortAmountDown className="text-blue-500 text-sm" />
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Reordenar Productos</h3>
          <p className="text-[11px] text-slate-500">Arrastra para cambiar el orden en el menú</p>
        </div>
      </div>

      {/* Status messages */}
      <AnimatePresence>
        {saveLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-blue-50 text-blue-700 text-xs font-medium flex items-center gap-2 border-b border-blue-100"
          >
            <FaSyncAlt className="text-[10px] animate-spin" /> Guardando...
          </motion.div>
        )}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-medium flex items-center gap-2 border-b border-emerald-100"
          >
            <FaCheck className="text-[10px]" /> {successMessage}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-red-50 text-red-700 text-xs font-medium flex items-center gap-2 border-b border-red-100"
          >
            <FaExclamationTriangle className="text-[10px]" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Categories */}
      <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100">
        {Object.keys(productsByCategory)
          .sort((a, b) => {
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
              <div key={categoryId}>
                {/* Category Header */}
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                  onClick={() => toggleCategory(categoryId)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded
                      ? <FaChevronDown className="text-[10px] text-slate-400 flex-shrink-0" />
                      : <FaChevronRight className="text-[10px] text-slate-400 flex-shrink-0" />
                    }
                    <span className="text-xs font-semibold text-slate-700 truncate">{getCategoryName(categoryId)}</span>
                  </div>
                  <span className="bg-blue-50 text-blue-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {categoryProducts.length}
                  </span>
                </button>

                {/* Products */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="py-1 px-2 space-y-0.5">
                        {categoryProducts.map((product, productIndex) => (
                          <div
                            key={product._id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, categoryId, productIndex)}
                            onDragOver={(e) => handleDragOver(e, categoryId, productIndex)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-all ${
                              draggedItem?.categoryId === categoryId && draggedItem?.productIndex === productIndex ? 'opacity-40 bg-blue-50' : ''
                            }`}
                          >
                            <FaGripVertical className="text-slate-300 text-[10px] flex-shrink-0" />

                            <span className="bg-slate-100 text-slate-500 font-semibold text-[10px] w-5 h-5 rounded flex items-center justify-center flex-shrink-0">
                              {productIndex + 1}
                            </span>

                            {product.image && (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-7 h-7 object-cover rounded flex-shrink-0"
                              />
                            )}

                            <span className="flex-1 min-w-0 text-xs font-medium text-slate-700 truncate">
                              {product.name}
                            </span>

                            <span className="text-xs font-semibold text-slate-500 flex-shrink-0">
                              ${(product.price || 0).toLocaleString()}
                            </span>

                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              product.active !== false ? 'bg-emerald-400' : 'bg-red-400'
                            }`} />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default ProductOrderSelector;

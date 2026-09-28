import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaGripVertical, FaChevronDown, FaChevronRight,
  FaSyncAlt, FaCheck, FaExclamationTriangle, FaBoxOpen, FaSortAmountDown,
  FaArrowUp, FaArrowDown
} from 'react-icons/fa';
import api from '../services/api';
import { pesos } from '../utils/pedidos';

const EMPTY_ARRAY = [];

const ProductOrderSelector = ({ products = EMPTY_ARRAY, categories = EMPTY_ARRAY, businessId, onOrderChange }) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [productsByCategory, setProductsByCategory] = useState({});
  const porCategoriaRef = useRef({});
  porCategoriaRef.current = productsByCategory;
  const timerGuardar = useRef(null);

  useEffect(() => {
    setHasChanges(false);

    // Agrupar productos por categoría
    const grouped = {};
    const uncategorized = [];

    if (!Array.isArray(products)) {
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

    if (uncategorized.length > 0) {
      grouped['uncategorized'] = uncategorized;
    }

    setProductsByCategory(grouped);

    // Expandir todas las categorías por defecto (sin cerrar las que el usuario ya cerró)
    setExpandedCategories(prev => {
      const next = {};
      Object.keys(grouped).forEach(categoryId => {
        next[categoryId] = prev[categoryId] ?? true;
      });
      return next;
    });
  }, [products]);

  useEffect(() => () => clearTimeout(timerGuardar.current), []);

  // Categorías en el mismo orden en que salen en el menú
  const categoriasOrdenadas = Object.keys(productsByCategory).sort((a, b) => {
    if (a === 'uncategorized') return 1;
    if (b === 'uncategorized') return -1;
    const catA = categories.find(cat => cat._id === a);
    const catB = categories.find(cat => cat._id === b);
    const orderA = catA?.displayOrder !== undefined ? catA.displayOrder : 999;
    const orderB = catB?.displayOrder !== undefined ? catB.displayOrder : 999;
    return orderA - orderB;
  });

  const handleDragStart = (e, categoryId, productIndex) => {
    setDraggedItem({ categoryId, productIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const moverDentro = (categoryId, desde, hasta) => {
    const lista = [...(porCategoriaRef.current[categoryId] || [])];
    if (hasta < 0 || hasta >= lista.length || desde === hasta) return false;
    const [item] = lista.splice(desde, 1);
    lista.splice(hasta, 0, item);
    const nuevo = { ...porCategoriaRef.current, [categoryId]: lista };
    porCategoriaRef.current = nuevo;
    setProductsByCategory(nuevo);
    setHasChanges(true);
    return true;
  };

  const handleDragOver = (e, categoryId, productIndex) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.categoryId !== categoryId || draggedItem.productIndex === productIndex) return;
    moverDentro(categoryId, draggedItem.productIndex, productIndex);
    setDraggedItem({ categoryId, productIndex });
  };

  const handleDragEnd = async () => {
    setDraggedItem(null);
    if (hasChanges) {
      await saveOrder();
    }
  };

  /* Flechas: arrastrar solo funciona con mouse. Los toques seguidos se
     juntan y se guarda una sola vez, para que dos guardados no se crucen. */
  const mover = (categoryId, index, delta) => {
    if (!moverDentro(categoryId, index, index + delta)) return;
    clearTimeout(timerGuardar.current);
    timerGuardar.current = setTimeout(() => saveOrder(), 700);
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const saveOrder = async () => {
    const grupos = porCategoriaRef.current;
    const orden = Object.keys(grupos).sort((a, b) => categoriasOrdenadas.indexOf(a) - categoriasOrdenadas.indexOf(b));
    setSaveLoading(true);
    setError(null);
    try {
      const reorderedProducts = [];
      orden.forEach(categoryId => reorderedProducts.push(...grupos[categoryId]));

      await api.put('/products/products-reorder', {
        businessId,
        products: reorderedProducts.map((product, order) => ({ _id: product._id, order }))
      }, {
        timeout: 15000
      });

      setSuccessMessage('Orden guardado');
      setHasChanges(false);
      if (onOrderChange) {
        onOrderChange(reorderedProducts.map((p, order) => ({ ...p, displayOrder: order })));
      }
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || (err.response ? 'No se pudo guardar el orden' : 'Sin conexión. Revisa el internet.'));
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaveLoading(false);
    }
  };

  const getCategoryName = (categoryId) => {
    if (categoryId === 'uncategorized') return 'Sin categoría';
    const category = categories.find(cat => cat._id === categoryId);
    return category ? category.name : 'Categoría eliminada';
  };

  if (!Array.isArray(products) || products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-10 text-center">
        <FaBoxOpen className="text-2xl text-slate-300 mb-2" />
        <p className="text-sm text-slate-500 font-medium">Sin productos para ordenar</p>
        <p className="text-xs text-slate-400 mt-1">Agrega productos primero</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-start gap-2">
        <FaSortAmountDown className="text-blue-500 text-sm mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Orden de los productos</h3>
          <p className="text-xs text-slate-500">Usa las flechas (o arrastra) para cambiar el orden dentro de cada categoría. Se guarda solo.</p>
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
            <FaSyncAlt className="text-2xs animate-spin" /> Guardando...
          </motion.div>
        )}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-medium flex items-center gap-2 border-b border-emerald-100"
          >
            <FaCheck className="text-2xs" /> {successMessage}
          </motion.div>
        )}
        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-red-50 text-red-700 text-sm font-medium flex items-center gap-2 border-b border-red-100"
          >
            <FaExclamationTriangle className="text-xs" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Categories */}
      <div className="divide-y divide-slate-100">
        {categoriasOrdenadas.map(categoryId => {
          const categoryProducts = productsByCategory[categoryId];
          const isExpanded = expandedCategories[categoryId];

          return (
            <div key={categoryId}>
              {/* Category Header */}
              <button
                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                onClick={() => toggleCategory(categoryId)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded
                    ? <FaChevronDown className="text-2xs text-slate-400 flex-shrink-0" />
                    : <FaChevronRight className="text-2xs text-slate-400 flex-shrink-0" />
                  }
                  <span className="text-sm font-semibold text-slate-700 break-words text-left">{getCategoryName(categoryId)}</span>
                </div>
                <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
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
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg lg:cursor-grab lg:active:cursor-grabbing hover:bg-slate-50 transition-all ${
                            draggedItem?.categoryId === categoryId && draggedItem?.productIndex === productIndex ? 'opacity-40 bg-blue-50' : ''
                          }`}
                        >
                          <FaGripVertical className="hidden lg:block text-slate-300 text-2xs flex-shrink-0" />

                          <span className="bg-slate-100 text-slate-500 font-semibold text-xs w-6 h-6 rounded flex items-center justify-center flex-shrink-0">
                            {productIndex + 1}
                          </span>

                          {product.image && (
                            <img
                              src={product.image}
                              alt=""
                              className="w-8 h-8 object-cover rounded flex-shrink-0"
                            />
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 break-words">{product.name}</p>
                            <p className="text-xs text-slate-500">
                              {pesos(product.price)}
                              {product.active === false && <span className="text-slate-400"> · no disponible</span>}
                            </p>
                          </div>

                          <button type="button" onClick={() => mover(categoryId, productIndex, -1)} disabled={productIndex === 0} aria-label="Subir"
                            className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center flex-shrink-0">
                            <FaArrowUp className="text-xs" />
                          </button>
                          <button type="button" onClick={() => mover(categoryId, productIndex, 1)} disabled={productIndex === categoryProducts.length - 1} aria-label="Bajar"
                            className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center flex-shrink-0">
                            <FaArrowDown className="text-xs" />
                          </button>
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

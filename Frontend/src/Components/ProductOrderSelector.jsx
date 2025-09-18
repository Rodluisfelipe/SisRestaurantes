import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Save, RotateCcw } from 'lucide-react';
import api from '../services/api';

const ProductOrderSelector = ({ products = [], businessId, onOrderChange }) => {
  const [orderedProducts, setOrderedProducts] = useState(products);
  const [draggedItem, setDraggedItem] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setOrderedProducts(products);
    setHasChanges(false);
  }, [products]);

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.parentNode);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    const items = [...orderedProducts];
    const draggedItemContent = items[draggedItem];
    items.splice(draggedItem, 1);
    items.splice(index, 0, draggedItemContent);

    setDraggedItem(index);
    setOrderedProducts(items);
    setHasChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const saveOrder = async () => {
    setSaveLoading(true);
    setError(null);
    try {
      const orderedProductsData = orderedProducts.map((product, index) => ({
        _id: product._id,
        order: index
      }));

      await api.put('/products/reorder', { 
        businessId, 
        products: orderedProductsData 
      });

      setSaveLoading(false);
      setSuccessMessage('Orden de productos guardado correctamente');
      setHasChanges(false);
      
      // Notificar al componente padre del cambio
      if (onOrderChange) {
        onOrderChange(orderedProducts);
      }
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error al guardar el orden:', error);
      setError('Error al guardar el orden de productos');
      setSaveLoading(false);
      setTimeout(() => setError(null), 3000);
    }
  };

  const resetOrder = () => {
    setOrderedProducts(products);
    setHasChanges(false);
    setError(null);
    setSuccessMessage('');
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
        
        {hasChanges && (
          <div className="flex items-center space-x-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetOrder}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
            >
              <RotateCcw size={16} />
              <span>Restablecer</span>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={saveOrder}
              disabled={saveLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
            >
              <Save size={16} />
              <span>{saveLoading ? 'Guardando...' : 'Guardar Orden'}</span>
            </motion.button>
          </div>
        )}
      </div>

      {/* Messages */}
      <AnimatePresence>
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

      {/* Products List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {orderedProducts.map((product, index) => (
            <motion.div
              key={product._id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-all duration-150 ${
                draggedItem === index ? 'opacity-50' : ''
              }`}
            >
              <GripVertical className="text-gray-400 mr-3 flex-shrink-0" size={20} />
              
              <div className="flex items-center flex-grow min-w-0">
                <div className="bg-blue-100 text-blue-800 font-semibold text-sm px-3 py-1 rounded-full mr-4 flex-shrink-0">
                  #{index + 1}
                </div>
                
                <div className="flex items-center space-x-4 flex-grow min-w-0">
                  {product.image && (
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  
                  <div className="flex-grow min-w-0">
                    <h4 className="font-medium text-gray-800 truncate">{product.name}</h4>
                    <p className="text-sm text-gray-600 truncate">{product.description}</p>
                  </div>
                  
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <span className="font-semibold text-green-600">
                      ${product.price?.toLocaleString() || '0'}
                    </span>
                    
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.active !== false 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {product.active !== false ? '🟢 Activo' : '🔴 Inactivo'}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {hasChanges && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ Tienes cambios sin guardar. Haz clic en "Guardar Orden" para aplicar los cambios.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductOrderSelector;

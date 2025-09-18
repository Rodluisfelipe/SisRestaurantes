import React, { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Componente para reordenar toppings seleccionados en el formulario de productos
 * 
 * @param {Array} selectedToppings - Lista de toppings seleccionados actualmente
 * @param {Function} onChange - Función llamada cuando cambia el orden
 * @param {Function} onRemove - Función llamada cuando se elimina un topping
 */
function ProductToppingOrderSelector({ selectedToppings = [], onChange, onRemove }) {
  const [draggedItem, setDraggedItem] = useState(null);

  // Si no hay toppings seleccionados
  if (!selectedToppings || selectedToppings.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center">
        <div className="text-gray-400 text-4xl mb-2">🧀</div>
        <p className="text-gray-500 text-sm">
          No hay toppings seleccionados. Selecciona algunos toppings arriba para poder reordenarlos.
        </p>
      </div>
    );
  }

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.parentNode);
    e.target.style.opacity = '0.4';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    
    if (draggedItem === index) {
      return;
    }
    
    // Reordenar los elementos
    let items = [...selectedToppings];
    const draggedItemContent = items[draggedItem];
    items.splice(draggedItem, 1);
    items.splice(index, 0, draggedItemContent);
    
    onChange(items);
    setDraggedItem(index);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedItem(null);
  };

  const handleRemove = (index) => {
    const newToppings = selectedToppings.filter((_, i) => i !== index);
    onChange(newToppings);
    if (onRemove) {
      onRemove(selectedToppings[index]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">
          Orden de Toppings Seleccionados
        </h4>
        <span className="text-xs text-gray-500">
          {selectedToppings.length} topping{selectedToppings.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="space-y-2">
        {selectedToppings.map((topping, index) => (
          <motion.div
            key={`${topping._id}-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`p-3 bg-white border-2 rounded-lg cursor-move transition-all duration-200 hover:shadow-md ${
              draggedItem === index 
                ? 'border-blue-400 shadow-lg' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Handle para arrastrar */}
                <div className="text-gray-400 hover:text-gray-600 cursor-move">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                  </svg>
                </div>
                
                {/* Número de orden */}
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                  {index + 1}
                </div>
                
                {/* Información del topping */}
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{topping.name}</div>
                  {topping.description && (
                    <div className="text-sm text-gray-600">{topping.description}</div>
                  )}
                  <div className="text-xs text-gray-500">
                    {topping.options?.length || 0} opciones
                  </div>
                </div>
              </div>
              
              {/* Botón de eliminar */}
              <button
                onClick={() => handleRemove(index)}
                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors duration-200"
                title="Eliminar topping"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
        💡 <strong>Tip:</strong> Arrastra y suelta para reordenar. El orden aquí será el mismo que verán los clientes en el menú.
      </div>
    </div>
  );
}

export default ProductToppingOrderSelector;

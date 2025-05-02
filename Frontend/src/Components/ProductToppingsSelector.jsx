import React, { useState } from 'react';

function ProductToppingsSelector({ product, onAddToCart, onClose }) {
  const [selectedToppings, setSelectedToppings] = useState({});
  const [totalPrice, setTotalPrice] = useState(product.price || 0);
  
  // Asegurarnos de que no haya grupos duplicados
  const uniqueToppingGroups = product.toppingGroups ? 
    Array.from(new Set(product.toppingGroups.map(g => g._id)))
      .map(id => product.toppingGroups.find(g => g._id === id))
    : [];

  const handleToppingChange = (groupId, optionId, isMultiple) => {
    setSelectedToppings(prev => {
      const newSelected = { ...prev };
      
      if (isMultiple) {
        // Para selección múltiple
        if (!newSelected[groupId]) {
          newSelected[groupId] = [optionId];
        } else if (newSelected[groupId].includes(optionId)) {
          // Remover la opción si ya está seleccionada
          newSelected[groupId] = newSelected[groupId].filter(id => id !== optionId);
          // Si el array queda vacío y no es requerido, eliminar el grupo
          const group = uniqueToppingGroups.find(g => g._id === groupId);
          if (newSelected[groupId].length === 0 && !group.isRequired) {
            delete newSelected[groupId];
          }
        } else {
          // Agregar nueva opción
          newSelected[groupId] = [...newSelected[groupId], optionId];
        }
      } else {
        // Para selección única
        if (newSelected[groupId]?.[0] === optionId) {
          // Si se selecciona la misma opción y no es requerido, deseleccionar
          const group = uniqueToppingGroups.find(g => g._id === groupId);
          if (!group.isRequired) {
            delete newSelected[groupId];
          }
        } else {
          // Seleccionar nueva opción
          newSelected[groupId] = [optionId];
        }
      }
      
      // Calcular el nuevo precio total
      let newTotal = product.price || 0;
      Object.entries(newSelected).forEach(([gId, selectedOpts]) => {
        const group = uniqueToppingGroups.find(g => g._id === gId);
        if (group) {
          selectedOpts.forEach(optId => {
            const option = group.options.find(o => o._id === optId);
            if (option) {
              newTotal += option.price || 0;
            }
          });
        }
      });
      setTotalPrice(newTotal);
      
      return newSelected;
    });
  };

  const handleSubmit = () => {
    // Validar que todas las opciones requeridas estén seleccionadas
    const isValid = uniqueToppingGroups.every(group => {
      if (group.isRequired) {
        return selectedToppings[group._id] && selectedToppings[group._id].length > 0;
      }
      return true;
    });

    if (!isValid) {
      alert('Por favor selecciona las opciones requeridas');
      return;
    }

    // Crear objeto con los detalles de los toppings seleccionados
    const selectedToppingsDetails = {};
    Object.entries(selectedToppings).forEach(([groupId, optionIds]) => {
      const group = uniqueToppingGroups.find(g => g._id === groupId);
      if (group) {
        selectedToppingsDetails[groupId] = {
          groupName: group.name,
          options: optionIds.map(optionId => {
            const option = group.options.find(o => o._id === optionId);
            return {
              id: optionId,
              name: option.name,
              price: option.price || 0
            };
          })
        };
      }
    });

    onAddToCart({
      ...product,
      selectedToppings: selectedToppingsDetails,
      finalPrice: totalPrice
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Cabecera con imagen */}
        <div className="relative h-48">
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
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4">
          <h2 className="text-xl font-bold text-gray-800 mb-4">{product.name}</h2>

          {/* Grupos de toppings */}
          <div className="space-y-6">
            {uniqueToppingGroups.map(group => (
              <div key={group._id} className="space-y-2">
                <h3 className="font-medium text-gray-800">
                  {group.name}
                  {group.isRequired && <span className="text-red-500 text-sm ml-1">*</span>}
                </h3>
                <p className="text-sm text-gray-500">{group.description}</p>
                
                <div className="space-y-2">
                  {group.options.map(option => (
                    <label 
                      key={`${group._id}-${option._id}`} 
                      className="flex items-center space-x-2"
                    >
                      <input
                        type={group.isMultipleChoice ? "checkbox" : "radio"}
                        name={`group-${group._id}`}
                        checked={selectedToppings[group._id]?.includes(option._id) || false}
                        onChange={() => handleToppingChange(group._id, option._id, group.isMultipleChoice)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">{option.name}</span>
                      {(option.price || 0) > 0 && (
                        <span className="text-sm text-gray-500">(+${option.price})</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Precio total y botón de agregar */}
          <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-800 font-medium">Total:</span>
              <span className="text-xl font-bold text-blue-600">${totalPrice.toFixed(2)}</span>
            </div>
            
            <button
              onClick={handleSubmit}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300"
            >
              Agregar al pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductToppingsSelector; 
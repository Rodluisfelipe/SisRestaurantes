import React from 'react';

/**
 * Componente para seleccionar toppings en el formulario de productos
 * 
 * @param {Array} toppingGroups - Lista de grupos de toppings disponibles
 * @param {Array} selectedToppings - Lista de toppings seleccionados actualmente
 * @param {Function} onChange - Función llamada cuando cambia la selección
 */
function ProductFormToppingSelector({ toppingGroups, selectedToppings = [], onChange }) {
  // Función para manejar cambios en los checkboxes
  const handleToggleTopping = (group, isSelected) => {
    // Si está seleccionado, agregar al array
    if (isSelected) {
      onChange([...selectedToppings, group]);
    } 
    // Si está deseleccionado, quitar del array
    else {
      onChange(selectedToppings.filter(t => t._id !== group._id));
    }
  };
  
  // Si no hay grupos de toppings disponibles
  if (!toppingGroups || toppingGroups.length === 0) {
    return (
      <div className="p-3 bg-gray-50 border rounded-md">
        <p className="text-gray-500 text-sm italic">
          No hay grupos de toppings disponibles.
        </p>
      </div>
    );
  }
  
  return (
    <div className="border rounded-md p-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {toppingGroups.map(group => {
          // Verificar si este grupo ya está seleccionado
          const isSelected = selectedToppings.some(item => item._id === group._id);
          
          return (
            <div 
              key={group._id} 
              className={`p-2 border rounded flex items-start ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}
            >
              <input
                type="checkbox"
                id={`topping-${group._id}`}
                checked={isSelected}
                onChange={e => handleToggleTopping(group, e.target.checked)}
                className="mt-1 mr-2"
              />
              <label htmlFor={`topping-${group._id}`} className="cursor-pointer flex-1">
                <div className="font-medium">{group.name}</div>
                {group.description && (
                  <div className="text-sm text-gray-600">{group.description}</div>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  {group.options?.length || 0} opciones
                </div>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProductFormToppingSelector; 
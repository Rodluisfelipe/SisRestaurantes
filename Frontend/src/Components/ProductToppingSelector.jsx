import React from 'react';

function ProductToppingSelector({ toppingGroups, selectedToppings, onChange }) {
  if (!toppingGroups || toppingGroups.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-gray-500 italic">No hay grupos de toppings disponibles</p>
      </div>
    );
  }

  const handleToppingChange = (group, isChecked) => {
    if (isChecked) {
      onChange([...selectedToppings, group]);
    } else {
      onChange(selectedToppings.filter(t => t._id !== group._id));
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-medium mb-3">Grupos de Toppings Disponibles</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
        {toppingGroups.map((group) => {
          const isSelected = selectedToppings.some(t => t._id === group._id);
          
          return (
            <div key={group._id} className="flex items-start border rounded p-3 hover:bg-gray-50">
              <input
                type="checkbox"
                id={`topping-${group._id}`}
                checked={isSelected}
                onChange={(e) => handleToppingChange(group, e.target.checked)}
                className="mt-1 mr-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor={`topping-${group._id}`} className="cursor-pointer flex-1">
                <div className="font-semibold text-gray-800">{group.name}</div>
                {group.description && (
                  <div className="text-sm text-gray-600 mt-1">{group.description}</div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {group.options?.length || 0} opciones • 
                  {group.isMultipleChoice ? ' Selección múltiple' : ' Selección única'} • 
                  {group.isRequired ? ' Obligatorio' : ' Opcional'}
                </div>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProductToppingSelector; 
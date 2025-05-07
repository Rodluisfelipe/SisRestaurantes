import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const ProductToppingsModal = ({ product, onAddToCart, onClose, isEditing = false, currentQuantity = 1 }) => {
  const [selectedToppings, setSelectedToppings] = useState({});
  const [totalPrice, setTotalPrice] = useState(product.price || 0);
  const [quantity, setQuantity] = useState(isEditing ? currentQuantity : 1);
  const [toppingGroups, setToppingGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});

  // Cargar los grupos de toppings del producto
  useEffect(() => {
    const fetchToppingGroups = async () => {
      setLoading(true);
      try {
        // Si el producto tiene toppingGroups como IDs, cargarlos
        if (product.toppingGroups && product.toppingGroups.length > 0) {
          // Evitar duplicación asegurándonos de que solo tengamos IDs únicos
          const uniqueToppingGroupIds = Array.from(new Set(product.toppingGroups));
          
          const response = await api.get(`/topping-groups?ids=${uniqueToppingGroupIds.join(',')}`);
          if (response.data) {
            setToppingGroups(response.data);
            
            // Expandir todos los grupos si son pocos
            if (response.data.length <= 3) {
              const initialExpandedState = {};
              response.data.forEach(group => {
                if (group && group._id) {
                  initialExpandedState[group._id] = true;
                }
              });
              setExpandedGroups(initialExpandedState);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching topping groups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchToppingGroups();
    
    // Si estamos en modo edición, inicializar las selecciones con los toppings actuales
    if (isEditing && product.selectedToppings) {
      initializeFromExistingToppings();
    }
  }, [product]);
  
  // Inicializar las selecciones desde los toppings existentes (para modo edición)
  const initializeFromExistingToppings = () => {
    // Esta función mapearía los toppings seleccionados previamente al formato
    // requerido por el componente
    // Para ahora, simplemente cargaremos el UI y dejaremos que el usuario reseleccione
    console.log("Editando toppings para producto:", product.name);
    
    if (!product.selectedToppings || !Array.isArray(product.selectedToppings)) {
      return;
    }
    
    // Crear un nuevo objeto para las selecciones
    const initialSelections = {};
    
    // Procesar cada grupo de toppings seleccionados
    product.selectedToppings.forEach(group => {
      if (!group || !group.groupId || !Array.isArray(group.options)) return;
      
      // Inicializar array para el grupo si no existe
      if (!initialSelections[group.groupId]) {
        initialSelections[group.groupId] = [];
      }
      
      // Agregar cada opción seleccionada al array del grupo correspondiente
      group.options.forEach(option => {
        if (!option || !option.optionId) return;
        
        // Si la opción es de un subgrupo
        if (option.subGroupId) {
          // Crear clave compuesta para el subgrupo
          const subGroupKey = `${group.groupId}_${option.subGroupId}`;
          
          // Inicializar array para el subgrupo si no existe
          if (!initialSelections[subGroupKey]) {
            initialSelections[subGroupKey] = [];
          }
          
          // Agregar opción al subgrupo
          initialSelections[subGroupKey].push(option.optionId);
        } else {
          // Es una opción del grupo principal
          initialSelections[group.groupId].push(option.optionId);
        }
      });
    });
    
    // Establecer las selecciones iniciales
    setSelectedToppings(initialSelections);
    console.log("Selecciones inicializadas:", initialSelections);
  };

  // Calcular el precio total cuando cambian las selecciones o la cantidad
  useEffect(() => {
    calculateTotal();
  }, [selectedToppings, quantity]);

  // Calcular el precio total
  const calculateTotal = () => {
    let basePrice = parseFloat(product.price) || 0;
    let extraPrice = 0;
    
    // Calcular precio adicional de toppings
    toppingGroups.forEach(group => {
      if (!group) return;
      
      const groupSelections = selectedToppings[group._id] || [];
      let hasSelections = groupSelections.length > 0;
      
      // Si tiene subgrupos, verificar selecciones en ellos
      if (Array.isArray(group.subGroups)) {
        group.subGroups.forEach(subGroup => {
          if (subGroup && subGroup._id) {
            const subGroupKey = `${group._id}_${subGroup._id}`;
            const subGroupSelections = selectedToppings[subGroupKey] || [];
            if (subGroupSelections.length > 0) {
              hasSelections = true;
            }
          }
        });
      }
      
      // Si hay selecciones, agregar el precio base del grupo
      if (hasSelections) {
        extraPrice += parseFloat(group.basePrice || 0);
      }
      
      // Calcular precios de las opciones seleccionadas
      if (Array.isArray(group.options)) {
        group.options.forEach(option => {
          if (option && option._id && groupSelections.includes(option._id)) {
            extraPrice += parseFloat(option.price || 0);
          }
        });
      }
      
      // Calcular precios de las opciones de subgrupos
      if (Array.isArray(group.subGroups)) {
        group.subGroups.forEach(subGroup => {
          if (subGroup && subGroup._id && Array.isArray(subGroup.options)) {
            const subGroupKey = `${group._id}_${subGroup._id}`;
            const subGroupSelections = selectedToppings[subGroupKey] || [];
            
            subGroup.options.forEach(option => {
              if (option && option._id && subGroupSelections.includes(option._id)) {
                extraPrice += parseFloat(option.price || 0);
              }
            });
          }
        });
      }
    });
    
    setTotalPrice((basePrice + extraPrice) * quantity);
  };

  // Manejar cambio en las opciones de toppings
  const handleOptionChange = (groupId, optionId, isSubGroup = false, subGroupId = null) => {
    setSelectedToppings(prev => {
      const newSelectedToppings = { ...prev };
      const key = isSubGroup ? `${groupId}_${subGroupId}` : groupId;
      
      // Inicializar array si no existe
      if (!newSelectedToppings[key]) {
        newSelectedToppings[key] = [];
      }
      
      // Encontrar el grupo
      const group = toppingGroups.find(g => g._id === groupId);
      
      // Determinar si es selección múltiple o única
      let isMultipleChoice = false;
      
      if (isSubGroup) {
        // Para subgrupos, busca las propiedades del subgrupo
        const subGroup = group?.subGroups?.find(sg => sg._id === subGroupId);
        isMultipleChoice = subGroup?.isMultipleChoice || false;
      } else {
        // Para grupos principales, usa la propiedad del grupo
        isMultipleChoice = group?.isMultipleChoice || false;
      }
      
      if (isMultipleChoice) {
        // Para selección múltiple, toggle la selección
        if (newSelectedToppings[key].includes(optionId)) {
          newSelectedToppings[key] = newSelectedToppings[key].filter(id => id !== optionId);
        } else {
          newSelectedToppings[key].push(optionId);
        }
      } else {
        // Para selección única, reemplazar la selección
        newSelectedToppings[key] = newSelectedToppings[key].includes(optionId) ? [] : [optionId];
      }
      
      return newSelectedToppings;
    });
  };

  // Limpiar todas las selecciones de un grupo (incluyendo subgrupos)
  const clearGroupSelections = (groupId, e) => {
    e.stopPropagation(); // Evitar que expanda/colapse el grupo
    
    setSelectedToppings(prev => {
      const newSelectedToppings = { ...prev };
      
      // Limpiar selecciones del grupo principal
      delete newSelectedToppings[groupId];
      
      // Limpiar selecciones de todos los subgrupos
      const group = toppingGroups.find(g => g && g._id === groupId);
      if (group && Array.isArray(group.subGroups)) {
        group.subGroups.forEach(subGroup => {
          if (subGroup && subGroup._id) {
            const subGroupKey = `${groupId}_${subGroup._id}`;
            delete newSelectedToppings[subGroupKey];
          }
        });
      }
      
      return newSelectedToppings;
    });
  };

  // Función para expandir/colapsar un grupo
  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Contar cuántas selecciones hay en un grupo (incluyendo subgrupos)
  const countSelections = (group) => {
    if (!group || !group._id) return 0;
    
    let count = 0;
    
    // Contar selecciones del grupo principal
    const mainSelections = selectedToppings[group._id] || [];
    count += mainSelections.length;
    
    // Contar selecciones de subgrupos
    if (Array.isArray(group.subGroups)) {
      group.subGroups.forEach(subGroup => {
        if (subGroup && subGroup._id) {
          const subGroupKey = `${group._id}_${subGroup._id}`;
          const subGroupSelections = selectedToppings[subGroupKey] || [];
          count += subGroupSelections.length;
        }
      });
    }
    
    return count;
  };

  // Preparar los datos de toppings para enviar al carrito
  const prepareSelectedToppingsData = () => {
    const result = [];
    
    toppingGroups.forEach(group => {
      if (!group || !group._id) return;
      
      const groupSelections = selectedToppings[group._id] || [];
      const hasMainSelections = groupSelections.length > 0;
      
      // Verificar selecciones de subgrupos
      const subGroupSelections = [];
      let hasSubGroupSelections = false;
      
      if (Array.isArray(group.subGroups)) {
        group.subGroups.forEach(subGroup => {
          if (subGroup && subGroup._id) {
            const subGroupKey = `${group._id}_${subGroup._id}`;
            const selections = selectedToppings[subGroupKey] || [];
            
            if (selections.length > 0) {
              hasSubGroupSelections = true;
              
              selections.forEach(optionId => {
                const option = subGroup.options?.find(o => o._id === optionId);
                if (option) {
                  subGroupSelections.push({
                    subGroupId: subGroup._id,
                    subGroupName: subGroup.name || 'Desconocido',
                    optionId,
                    name: option.name || 'Desconocida',
                    price: option.price || 0
                  });
                }
              });
            }
          }
        });
      }
      
      // Si hay selecciones en el grupo principal o en algún subgrupo
      if (hasMainSelections || hasSubGroupSelections) {
        const groupData = {
          groupId: group._id,
          groupName: group.name || 'Desconocido',
          options: []
        };
        
        // Agregar opciones seleccionadas del grupo principal
        if (hasMainSelections) {
          groupSelections.forEach(optionId => {
            const option = group.options?.find(o => o._id === optionId);
            if (option) {
              groupData.options.push({
                optionId,
                name: option.name || 'Desconocida',
                price: option.price || 0
              });
            }
          });
        }
        
        // Agregar opciones de subgrupos
        if (hasSubGroupSelections) {
          subGroupSelections.forEach(subOption => {
            groupData.options.push(subOption);
          });
        }
        
        result.push(groupData);
      }
    });
    
    return result;
  };

  // Actualizar la cantidad
  const updateQuantity = (delta) => {
    const newQuantity = Math.max(1, quantity + delta);
    setQuantity(newQuantity);
  };

  // Agregar al carrito sin toppings
  const addToCartWithoutToppings = () => {
    // Restaurar el precio original sin toppings
    const productToAdd = {
      ...product,
      selectedToppings: [], // Limpiar toppings
      finalPrice: parseFloat(product.price) // Usar precio base
    };

    if (isEditing) {
      // Si estamos editando, mantener la cantidad original
      onAddToCart(productToAdd, currentQuantity);
    } else {
      // Si es nuevo, usar la cantidad seleccionada
      onAddToCart(productToAdd, quantity);
    }
    onClose();
  };

  // Agregar al carrito con toppings
  const addToCartWithToppings = () => {
    const selectedToppingsData = prepareSelectedToppingsData();
    
    // Calcular precio final del producto con toppings
    const finalPrice = totalPrice / (isEditing ? currentQuantity : quantity);
    
    // Crear una versión modificada del producto con los toppings seleccionados
    const productWithToppings = {
      ...product,
      selectedToppings: selectedToppingsData,
      finalPrice: finalPrice
    };
    
    if (isEditing) {
      // Si estamos editando, mantener la cantidad original
      onAddToCart(productWithToppings, currentQuantity, selectedToppingsData);
    } else {
      // Si es nuevo, usar la cantidad seleccionada
      onAddToCart(productWithToppings, quantity, selectedToppingsData);
    }
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-100 py-2 px-3 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-base font-semibold text-gray-800">
          {isEditing ? 'Editar extras' : 'Agregar al pedido'}
        </h2>
        <button 
          onClick={onClose}
          className="text-gray-600 hover:text-gray-900"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="mb-2">
          <h3 className="text-base font-semibold text-gray-800">{product.name}</h3>
          {product.description && (
            <p className="text-gray-600 text-xs">{product.description}</p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-24">
            <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : (
          <div className="space-y-2">
            {toppingGroups.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 text-xs text-yellow-800">
                Este producto no tiene extras configurados.
              </div>
            ) : (
              toppingGroups.map(group => group && (
                <div key={group._id} className="border border-gray-200 rounded-md overflow-hidden">
                  <div
                    className="flex justify-between items-center py-2 px-3 bg-gray-50 cursor-pointer"
                    onClick={() => toggleGroup(group._id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-800 text-sm">{group.name}</h4>
                        <div className="flex items-center">
                          {countSelections(group) > 0 && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded-full mr-1">
                              {countSelections(group)}
                            </span>
                          )}
                          <button
                            onClick={(e) => clearGroupSelections(group._id, e)}
                            className="text-xs text-gray-600 hover:text-red-600 mr-1"
                          >
                            Limpiar
                          </button>
                          <svg
                            className={`h-4 w-4 text-gray-500 transition-transform ${expandedGroups[group._id] ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      {group.isMultipleChoice ? (
                        <p className="text-gray-500 text-xs">Múltiple</p>
                      ) : (
                        <p className="text-gray-500 text-xs">Única</p>
                      )}
                    </div>
                  </div>

                  {expandedGroups[group._id] && (
                    <div className="p-2 border-t border-gray-200">
                      {/* Opciones del grupo principal */}
                      {Array.isArray(group.options) && group.options.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {group.options.map(option => option && (
                            <div key={option._id} className="flex items-center text-sm">
                              <input
                                type={group.isMultipleChoice ? "checkbox" : "radio"}
                                id={`option-${option._id}`}
                                name={`group-${group._id}`}
                                checked={(selectedToppings[group._id] || []).includes(option._id)}
                                onChange={() => handleOptionChange(group._id, option._id)}
                                className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor={`option-${option._id}`} className="ml-2 block text-xs text-gray-700 cursor-pointer flex-1">
                                <div className="flex justify-between items-center w-full">
                                  <span>{option.name}</span>
                                  {parseFloat(option.price) > 0 && (
                                    <span className="font-medium">+${parseFloat(option.price).toFixed(2)}</span>
                                  )}
                                </div>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Subgrupos */}
                      {Array.isArray(group.subGroups) && group.subGroups.map(subGroup => subGroup && (
                        <div key={subGroup._id} className="border-t border-gray-100 pt-1 mt-1">
                          <h5 className="font-medium text-gray-700 text-xs mb-1">{subGroup.name}</h5>

                          <div className="space-y-1">
                            {Array.isArray(subGroup.options) && subGroup.options.map(option => option && (
                              <div key={option._id} className="flex items-center text-sm">
                                <input
                                  type={subGroup.isMultipleChoice ? "checkbox" : "radio"}
                                  id={`suboption-${option._id}`}
                                  name={`subgroup-${group._id}-${subGroup._id}`}
                                  checked={(selectedToppings[`${group._id}_${subGroup._id}`] || []).includes(option._id)}
                                  onChange={() => handleOptionChange(group._id, option._id, true, subGroup._id)}
                                  className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor={`suboption-${option._id}`} className="ml-2 block text-xs text-gray-700 cursor-pointer flex-1">
                                  <div className="flex justify-between items-center w-full">
                                    <span>{option.name}</span>
                                    {parseFloat(option.price) > 0 && (
                                      <span className="font-medium">+${parseFloat(option.price).toFixed(2)}</span>
                                    )}
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-2 bg-white">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center border border-gray-300 rounded-md">
            <button
              onClick={() => updateQuantity(-1)}
              className="px-2 py-1 text-gray-600 hover:bg-gray-100 text-sm"
              disabled={quantity <= 1}
            >
              -
            </button>
            <span className="px-2 py-1 text-center w-8 text-sm">{quantity}</span>
            <button
              onClick={() => updateQuantity(1)}
              className="px-2 py-1 text-gray-600 hover:bg-gray-100 text-sm"
            >
              +
            </button>
          </div>
          
          <div className="text-right">
            <p className="text-xs text-gray-600">Total:</p>
            <p className="text-base font-bold text-gray-900">${totalPrice.toFixed(2)}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {toppingGroups.length === 0 ? (
            <button
              onClick={addToCartWithoutToppings}
              className="w-full py-1.5 rounded-md font-medium text-sm bg-blue-600 text-white hover:bg-blue-700 col-span-2"
            >
              {isEditing ? 'Guardar cambios' : 'Agregar al pedido'}
            </button>
          ) : (
            <>
              <button
                onClick={addToCartWithoutToppings}
                className="py-1.5 rounded-md font-medium text-sm bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                Sin extras
              </button>
              
              <button
                onClick={addToCartWithToppings}
                className="py-1.5 rounded-md font-medium text-sm bg-blue-600 text-white hover:bg-blue-700"
              >
                {isEditing ? 'Guardar cambios' : 'Agregar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductToppingsModal; 
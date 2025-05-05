import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from "../Context/BusinessContext";

function ProductToppingsSelector({ product, onAddToCart, onClose }) {
  const [selectedToppings, setSelectedToppings] = useState({});
  const [totalPrice, setTotalPrice] = useState(product.price || 0);
  const [displayTotal, setDisplayTotal] = useState(product.price || 0);
  const [extraTotal, setExtraTotal] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  
  const { businessConfig } = useBusinessConfig();
  
  // Asegurarnos de que no haya grupos duplicados y que toppingGroups sea un array
  const uniqueToppingGroups = Array.isArray(product.toppingGroups) 
    ? Array.from(new Set(product.toppingGroups.map(g => g?._id)))
        .map(id => product.toppingGroups.find(g => g?._id === id))
        .filter(g => g) // Filtrar elementos nulos o undefined
    : [];

  console.log('Grupos de toppings disponibles:', uniqueToppingGroups.map(g => ({
    name: g.name, 
    basePrice: g.basePrice,
    hasSubGroups: g.subGroups && g.subGroups.length > 0,
    subGroups: g.subGroups ? g.subGroups.length : 0
  })));

  // Debug para ver los datos recibidos
  console.log('Datos enviados a ProductToppingsSelector:', {
    toppingGroups: uniqueToppingGroups,
    initialToppings: product.selectedToppings || []
  });

  useEffect(() => {
    console.log('ProductToppingsSelector montado');
    
    // Validar que product exista
    if (!product) {
      console.error('El producto es undefined o null');
      setError('Producto no válido');
      return;
    }
    
    // Expande todos los grupos por defecto si hay pocos
    if (uniqueToppingGroups.length > 0 && uniqueToppingGroups.length <= 3) {
      const initialExpandedState = {};
      uniqueToppingGroups.forEach(group => {
        if (group && group._id) {
          initialExpandedState[group._id] = true;
        }
      });
      setExpandedGroups(initialExpandedState);
    }
    
    try {
      // Inicializar estado con toppings previamente seleccionados
      if (product.selectedToppings && product.selectedToppings.length > 0) {
        const initialState = {};
        
        product.selectedToppings.forEach(item => {
          if (item.groupId) {
            // Para opciones principales
            initialState[item.groupId] = initialState[item.groupId] || [];
            if (item.optionId) {
              initialState[item.groupId].push(item.optionId);
            }
            
            // Para opciones de subgrupos
            if (item.subGroups && item.subGroups.length > 0) {
              item.subGroups.forEach(subItem => {
                if (subItem.subGroupId && subItem.optionId) {
                  const subGroupKey = `${item.groupId}_${subItem.subGroupId}`;
                  initialState[subGroupKey] = initialState[subGroupKey] || [];
                  initialState[subGroupKey].push(subItem.optionId);
                }
              });
            }
          }
        });
        
        setSelectedToppings(initialState);
      }
    } catch (error) {
      handleError(error);
    }
    
    // Registrar cuando el componente se desmonta
    return () => {
      console.log('ProductToppingsSelector desmontado');
    };
  }, []);

  useEffect(() => {
    try {
      calculateTotal();
    } catch (error) {
      handleError(error);
    }
  }, [selectedToppings, quantity]);

  const calculateTotal = () => {
    // Inicializar totales
    let basePriceTotal = 0;
    let optionsPriceTotal = 0;
    
    // Verificar si hay selecciones en cualquier grupo o subgrupo
    uniqueToppingGroups.forEach(group => {
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
        console.log(`Grupo ${group.name} tiene selecciones, agregando basePrice: ${group.basePrice || 0}`);
        basePriceTotal += Number(group.basePrice || 0);
      }
      
      // Calcular precios de las opciones seleccionadas
      if (Array.isArray(group.options)) {
        group.options.forEach(option => {
          if (option && option._id && groupSelections.includes(option._id)) {
            optionsPriceTotal += Number(option.price || 0);
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
                optionsPriceTotal += Number(option.price || 0);
              }
            });
          }
        });
      }
    });
    
    // Calcular el total extra (bases + opciones)
    const extraTotal = basePriceTotal + optionsPriceTotal;
    setExtraTotal(extraTotal);
    
    // Calcular el precio total (precio del producto + extras) * cantidad
    const finalTotal = (Number(product.price || 0) + extraTotal) * quantity;
    setTotalPrice(finalTotal);
    setDisplayTotal(finalTotal);
  };

  const handleOptionChange = (groupId, optionId, isSubGroup = false, subGroupId = null, isSingleChoice = false) => {
    setSelectedToppings(prev => {
      const newSelectedToppings = { ...prev };
      const key = isSubGroup ? `${groupId}_${subGroupId}` : groupId;
      
      // Verificar si ya existe el array para este grupo o subgrupo
      if (!newSelectedToppings[key]) {
        newSelectedToppings[key] = [];
      }
      
      // Determinar si es selección múltiple o única
      const group = uniqueToppingGroups.find(g => g && g._id === groupId);
      const isMultiple = isSubGroup 
        ? (subGroupId && group?.subGroups?.find(s => s?._id === subGroupId)?.isMultipleChoice) 
        : (group?.isMultipleChoice);
      
      if (!isMultiple) {
        // Para selección única
        newSelectedToppings[key] = newSelectedToppings[key].includes(optionId) ? [] : [optionId];
      } else {
        // Para selección múltiple
        if (newSelectedToppings[key].includes(optionId)) {
          newSelectedToppings[key] = newSelectedToppings[key].filter(id => id !== optionId);
        } else {
          newSelectedToppings[key].push(optionId);
        }
      }
      
      return newSelectedToppings;
    });
  };

  // Limpiar todas las selecciones de un grupo (incluyendo sus subgrupos)
  const clearGroupSelections = (groupId, e) => {
    // Detener la propagación para evitar que se expanda/contraiga el acordeón
    e.stopPropagation();
    
    setSelectedToppings(prev => {
      const newSelectedToppings = { ...prev };
      
      // Limpiar selecciones del grupo principal
      delete newSelectedToppings[groupId];
      
      // Limpiar selecciones de todos los subgrupos
      const group = uniqueToppingGroups.find(g => g && g._id === groupId);
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

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Función para contar las selecciones en un grupo (incluyendo subgrupos)
  const countSelections = (group) => {
    if (!group) return 0;
    
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

  const prepareSelectedToppingsData = () => {
    const result = [];
    
    uniqueToppingGroups.forEach(group => {
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
                subGroupSelections.push({
                  subGroupId: subGroup._id,
                  subGroupName: subGroup.name || 'Desconocido',
                  optionId,
                  optionName: option?.name || 'Desconocida',
                  price: option?.price || 0
                });
              });
            }
          }
        });
      }
      
      // Solo agregar el grupo si hay alguna selección
      if (hasMainSelections || hasSubGroupSelections) {
        const groupData = {
          groupId: group._id,
          groupName: group.name || 'Desconocido',
          basePrice: group.basePrice || 0
        };
        
        // Agregar opciones principales seleccionadas
        if (hasMainSelections) {
          groupData.options = groupSelections.map(optionId => {
            const option = group.options?.find(o => o._id === optionId);
            return {
              optionId,
              optionName: option?.name || 'Desconocida',
              price: option?.price || 0
            };
          });
        }
        
        // Agregar subgrupos si hay selecciones
        if (hasSubGroupSelections) {
          groupData.subGroups = subGroupSelections;
        }
        
        result.push(groupData);
      }
    });
    
    return result;
  };

  const handleError = (error) => {
    console.error('Error en ProductToppingsSelector:', error);
    setError('Ha ocurrido un error al procesar las opciones');
  };

  const handleAddToCart = () => {
    try {
      // Preparar los datos para añadir al carrito
      const selectedToppingsData = prepareSelectedToppingsData();
      
      // Crear un objeto con los datos del producto y sus opciones seleccionadas
      const productToAdd = {
        ...product,
        selectedToppings: selectedToppingsData,
        quantity: quantity,
        totalPrice: totalPrice
      };
      
      // Llamar a la función de callback
      onAddToCart(productToAdd);
    } catch (error) {
      handleError(error);
    }
  };

  const handleModalClick = (e) => {
    // Prevenir que los clics en el modal se propaguen y cierren el modal
    e.stopPropagation();
  };

  // Renderizar el modal con los toppings
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={handleModalClick}
      >
        {/* Encabezado del modal */}
        <div className="sticky top-0 z-10 bg-white p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 truncate">
            {product.name}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100 text-gray-500"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo del modal - Scrolleable */}
        <div className="overflow-y-auto flex-1 p-4">
          {/* Imagen del producto */}
          {product.image && (
            <div className="relative w-full h-40 mb-4 rounded-lg overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Descripción del producto */}
          {product.description && (
            <div className="mb-4">
              <p className="text-gray-600">{product.description}</p>
            </div>
          )}

          {/* Control de cantidad */}
          <div className="mb-4 flex items-center justify-between">
            <span className="text-gray-700 font-medium">Cantidad:</span>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => quantity > 1 && setQuantity(quantity - 1)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                -
              </button>
              <span className="px-4 py-1 font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                +
              </button>
            </div>
          </div>

          {/* Lista de grupos de toppings */}
          {uniqueToppingGroups.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Personalizar producto</h3>
              
              {uniqueToppingGroups.map((group, index) => (
                group && group._id ? (
                  <div
                    key={group._id}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Encabezado del grupo (acordeón) */}
                    <div
                      onClick={() => toggleGroup(group._id)}
                      className={`flex items-center justify-between p-3 cursor-pointer ${
                        expandedGroups[group._id] ? 'bg-blue-50 border-b' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <div>
                            <h4 className="font-medium">{group.name}</h4>
                            {group.description && (
                              <p className="text-sm text-gray-600">{group.description}</p>
                            )}
                          </div>
                          
                          {/* Indicador de selecciones */}
                          {countSelections(group) > 0 && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {countSelections(group)} {countSelections(group) === 1 ? 'selección' : 'selecciones'}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs mt-1 flex flex-wrap gap-2">
                          {group.isRequired && (
                            <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                              Obligatorio
                            </span>
                          )}
                          
                          {group.isMultipleChoice ? (
                            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                              Selección múltiple
                            </span>
                          ) : (
                            <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                              Selección única
                            </span>
                          )}
                          
                          {Number(group.basePrice) > 0 && (
                            <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                              +${group.basePrice}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        {/* Botón para limpiar selecciones */}
                        {countSelections(group) > 0 && (
                          <button
                            onClick={(e) => clearGroupSelections(group._id, e)}
                            className="mr-2 p-1 hover:bg-gray-200 rounded-full text-gray-500"
                            aria-label="Limpiar selecciones"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        
                        {/* Flecha indicadora */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-5 w-5 transform transition-transform ${expandedGroups[group._id] ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Contenido del grupo (opciones) */}
                    {expandedGroups[group._id] && (
                      <div className="p-3">
                        {/* Opciones principales */}
                        {Array.isArray(group.options) && group.options.length > 0 && (
                          <div className="space-y-2">
                            {group.options.map(option => (
                              option && option._id ? (
                                <div
                                  key={option._id}
                                  onClick={() => handleOptionChange(group._id, option._id)}
                                  className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                                    (selectedToppings[group._id] || []).includes(option._id)
                                      ? 'bg-blue-50 border border-blue-200'
                                      : 'hover:bg-gray-50 border border-gray-100'
                                  }`}
                                >
                                  <div className="flex items-center">
                                    {group.isMultipleChoice ? (
                                      <input
                                        type="checkbox"
                                        checked={(selectedToppings[group._id] || []).includes(option._id)}
                                        onChange={() => {}}
                                        className="mr-2 h-4 w-4 text-blue-600 rounded"
                                      />
                                    ) : (
                                      <input
                                        type="radio"
                                        checked={(selectedToppings[group._id] || []).includes(option._id)}
                                        onChange={() => {}}
                                        className="mr-2 h-4 w-4 text-blue-600"
                                      />
                                    )}
                                    <span>{option.name || 'Opción'}</span>
                                  </div>
                                  
                                  {Number(option.price) > 0 && (
                                    <span className="text-gray-700">+${option.price}</span>
                                  )}
                                </div>
                              ) : null
                            ))}
                          </div>
                        )}
                        
                        {/* Subgrupos */}
                        {Array.isArray(group.subGroups) && group.subGroups.length > 0 && (
                          <div className="mt-4 space-y-4">
                            {group.subGroups.map(subGroup => (
                              subGroup && subGroup._id ? (
                                <div key={subGroup._id} className="pl-3 border-l-2 border-gray-200">
                                  <h5 className="font-medium mb-2">{subGroup.name}</h5>
                                  
                                  {/* Opciones del subgrupo */}
                                  <div className="space-y-2">
                                    {Array.isArray(subGroup.options) && subGroup.options.map(option => (
                                      option && option._id ? (
                                        <div
                                          key={option._id}
                                          onClick={() => handleOptionChange(
                                            group._id,
                                            option._id,
                                            true,
                                            subGroup._id,
                                            !subGroup.isMultipleChoice
                                          )}
                                          className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                                            (selectedToppings[`${group._id}_${subGroup._id}`] || []).includes(option._id)
                                              ? 'bg-blue-50 border border-blue-200'
                                              : 'hover:bg-gray-50 border border-gray-100'
                                          }`}
                                        >
                                          <div className="flex items-center">
                                            {subGroup.isMultipleChoice ? (
                                              <input
                                                type="checkbox"
                                                checked={(selectedToppings[`${group._id}_${subGroup._id}`] || []).includes(option._id)}
                                                onChange={() => {}}
                                                className="mr-2 h-4 w-4 text-blue-600 rounded"
                                              />
                                            ) : (
                                              <input
                                                type="radio"
                                                checked={(selectedToppings[`${group._id}_${subGroup._id}`] || []).includes(option._id)}
                                                onChange={() => {}}
                                                className="mr-2 h-4 w-4 text-blue-600"
                                              />
                                            )}
                                            <span>{option.name || 'Opción'}</span>
                                          </div>
                                          
                                          {Number(option.price) > 0 && (
                                            <span className="text-gray-700">+${option.price}</span>
                                          )}
                                        </div>
                                      ) : null
                                    ))}
                                  </div>
                                </div>
                              ) : null
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 px-2 text-center rounded-lg bg-blue-50 border border-blue-100">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-12 w-12 text-blue-500 mb-3" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <p className="text-blue-700 font-medium mb-3">Este producto no requiere personalización adicional.</p>
              <p className="text-gray-600 text-sm">Puedes ajustar la cantidad y agregarlo directamente al carrito.</p>
            </div>
          )}
          
          {/* Mostrar error si hay */}
          {error && (
            <div className="mt-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          )}
        </div>
        
        {/* Pie del modal con precio y botón */}
        <div className="sticky bottom-0 z-10 bg-white border-t border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-700 font-medium">Precio total:</span>
            <span className="text-xl font-bold" style={{ color: businessConfig.theme?.primaryColor || '#3B82F6' }}>
              ${displayTotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
            </span>
          </div>
          
          <button
            onClick={handleAddToCart}
            className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center"
            style={{ backgroundColor: businessConfig.theme?.buttonColor || '#3B82F6', color: businessConfig.theme?.buttonTextColor || 'white' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z" />
              <path d="M16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductToppingsSelector; 
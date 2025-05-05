import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from "../Context/BusinessContext";

function ProductToppingsSelector({ product, onAddToCart, onClose }) {
  const [selectedToppings, setSelectedToppings] = useState({});
  const [totalPrice, setTotalPrice] = useState(product.price || 0);
  const [displayTotal, setDisplayTotal] = useState(product.price || 0);
  const [extraTotal, setExtraTotal] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [error, setError] = useState(null);
  
  const { businessConfig } = useBusinessConfig();
  
  // Asegurarnos de que no haya grupos duplicados
  const uniqueToppingGroups = product.toppingGroups ? 
    Array.from(new Set(product.toppingGroups.map(g => g._id)))
      .map(id => product.toppingGroups.find(g => g._id === id))
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
    
    // Validar que product y toppingGroups existan
    if (!product) {
      console.error('El producto es undefined o null');
      setError('Producto no válido');
      return;
    }
    
    if (!Array.isArray(product.toppingGroups)) {
      console.error('toppingGroups no es un array:', product.toppingGroups);
      setError('Grupo de toppings no válido');
      return;
    }
    
    console.log('Producto válido con toppingGroups:', product.toppingGroups.length);
    
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
  }, [selectedToppings]);

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
    
    console.log(`Total de precios base: $${basePriceTotal}`);
    console.log(`Total de precios de opciones: $${optionsPriceTotal}`);
    
    // Calcular el total extra (bases + opciones)
    const extraTotal = basePriceTotal + optionsPriceTotal;
    setExtraTotal(extraTotal);
    
    // Calcular el precio total (precio del producto + extras)
    const finalTotal = Number(product.price || 0) + extraTotal;
    setTotalPrice(finalTotal);
    setDisplayTotal(finalTotal);
    
    // IMPORTANTE: Ya no llamamos automáticamente a prepareSelectedToppingsData
    // o a onAddToCart aquí, lo haremos solo cuando el usuario haga clic en el botón
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

  const handleAddToCart = () => {
    // Esta función solo se ejecutará cuando el usuario haga clic en "Agregar al carrito"
    
    // Preparar los datos seleccionados
    const selectedToppingsDetails = [];
    
    uniqueToppingGroups.forEach(group => {
      if (!group) return;
      
      const groupId = group._id;
      const basePrice = Number(group.basePrice || 0);
      const mainSelections = selectedToppings[groupId] || [];
      
      // Recopilar selecciones de subgrupos
      const subGroupSelectionsData = [];
      let hasSubGroupSelections = false;
      
      if (Array.isArray(group.subGroups)) {
        group.subGroups.forEach(subGroup => {
          if (!subGroup || !subGroup._id) return;
          
          const subGroupKey = `${groupId}_${subGroup._id}`;
          const subGroupSelections = selectedToppings[subGroupKey] || [];
          
          subGroupSelections.forEach(optionId => {
            const option = (Array.isArray(subGroup.options) ? 
              subGroup.options.find(opt => opt && opt._id === optionId) : null);
            
            if (option) {
              hasSubGroupSelections = true;
              subGroupSelectionsData.push({
                subGroupId: subGroup._id,
                subGroupTitle: subGroup.title || 'Sin título',
                optionId,
                optionName: option.name || 'Sin nombre',
                price: Number(option.price || 0)
              });
            }
          });
        });
      }
      
      // Procesar selecciones del grupo principal
      if (mainSelections.length > 0) {
        mainSelections.forEach(optionId => {
          const option = (Array.isArray(group.options) ? 
            group.options.find(opt => opt && opt._id === optionId) : null);
          
          if (option) {
            selectedToppingsDetails.push({
              groupId,
              groupName: group.name || 'Sin nombre',
              basePrice: basePrice,
              optionId,
              optionName: option.name || 'Sin nombre',
              price: Number(option.price || 0),
              // Si hay selecciones en subgrupos, incluirlas
              subGroups: hasSubGroupSelections ? subGroupSelectionsData : []
            });
          }
        });
      } 
      // Si solo hay selecciones en subgrupos (no en el grupo principal)
      else if (hasSubGroupSelections) {
        selectedToppingsDetails.push({
          groupId,
          groupName: group.name || 'Sin nombre',
          basePrice: basePrice,
          subGroups: subGroupSelectionsData
        });
      }
    });
    
    console.log('Datos de toppings enviados al carrito:', selectedToppingsDetails);
    
    // Ahora sí llamamos a onAddToCart con los datos preparados
    onAddToCart({
      ...product,
      selectedToppings: selectedToppingsDetails,
      finalPrice: totalPrice
    });
  };

  // Capturar clics en el modal para evitar propagación
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  // Función de seguridad para manejar eventos
  const handleAction = (action) => (e) => {
    // Evitar propagación y comportamiento por defecto
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log(`Acción: ${action}`);
    
    // Ejemplo de llamada segura a onAddToCart
    if (action === 'addToCart') {
      try {
        onAddToCart(product);
      } catch (err) {
        console.error('Error al agregar al carrito:', err);
        setError('Error al agregar al carrito');
      }
    }
    
    // Ejemplo de llamada segura a onClose
    if (action === 'close') {
      try {
    onClose();
      } catch (err) {
        console.error('Error al cerrar:', err);
        setError('Error al cerrar');
      }
    }
  };

  // Si hay un error, mostrar un mensaje
  if (error) {
  return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-4">
          <h3 className="text-xl font-bold text-red-600 mb-2">Error</h3>
          <p className="mb-4">{error}</p>
          <button
            onClick={handleAction('close')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Cerrar
          </button>
        </div>
            </div>
    );
  }

  // Si no hay grupos de toppings, no mostrar nada
  if (uniqueToppingGroups.length === 0) {
    return null;
  }

  console.log("Datos enviados a ProductToppingsSelector:", { 
    toppingGroups: uniqueToppingGroups,
    initialToppings: selectedToppings
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-900 scrollbar-track-gray-200">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={handleModalClick}>
        {/* Encabezado */}
        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center z-10">
          <h2 className="text-xl font-bold">{product.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Imagen y descripción del producto */}
        <div className="border-b">
          {/* Imagen del producto */}
          {product.image && (
            <div className="w-full h-48 relative">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          {/* Descripción del producto */}
          <div className="p-4">
            <p className="text-gray-600">{product.description}</p>
            <p className="text-lg font-bold text-black mt-2">${Number(product.price || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</p>
          </div>
        </div>
        
        {/* Contenido - Grupos de Toppings */}
        <div className="p-4 scrollbar-thin scrollbar-thumb-gray-900 scrollbar-track-gray-200">
          <h3 className="text-lg font-semibold mb-4">Personaliza tu pedido</h3>
                
                <div className="space-y-2">
            {uniqueToppingGroups.map((group) => (
              group && group._id ? (
                <div key={group._id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Cabecera del grupo (siempre visible) */}
                  <div 
                    className="bg-gray-50 p-3 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleGroup(group._id)}
                  >
                    <div className="flex items-center">
                      <h3 className="font-medium text-gray-800">{group.name || "Sin nombre"}</h3>
                      
                      {/* Badge para mostrar cantidad de selecciones */}
                      {countSelections(group) > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {countSelections(group)}
                        </span>
                      )}
                      
                      {/* Badge para precio base si existe */}
                      {(Number(group.basePrice || 0) > 0) && (
                        <span className="ml-2 text-sm text-gray-600">
                          +{Number(group.basePrice || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                        </span>
                      )}
                      
                      {/* Badge para requerido */}
                      {group.isRequired && (
                        <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                          Requerido
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center">
                      {/* Botón para limpiar selecciones - Solo visible si hay selecciones */}
                      {countSelections(group) > 0 && (
                        <button
                          onClick={(e) => clearGroupSelections(group._id, e)}
                          className="mr-2 text-gray-500 hover:text-red-500"
                          title="Limpiar selecciones"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3H4" />
                          </svg>
                        </button>
                      )}
                      
                      {/* Icono de expansión */}
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-5 w-5 transition-transform ${expandedGroups[group._id] ? 'transform rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Contenido del grupo (visible solo si está expandido) */}
                  {expandedGroups[group._id] && (
                    <div className="p-3 border-t border-gray-200">
                      {group.description && (
                        <p className="text-sm text-gray-600 mb-3">{group.description}</p>
                      )}
                      
                      {/* Opciones del grupo principal */}
                      {Array.isArray(group.options) && group.options.length > 0 && (
                        <div className="mb-3">
                          {group.options.map((option) => (
                            option && option._id ? (
                              <div key={option._id} className="flex items-center mb-1 py-1">
                      <input
                        type={group.isMultipleChoice ? "checkbox" : "radio"}
                                  id={`option-${option._id}`}
                        name={`group-${group._id}`}
                                  checked={(selectedToppings[group._id] || []).includes(option._id)}
                                  onChange={() => handleOptionChange(group._id, option._id)}
                                  className="mr-2"
                                />
                                <label htmlFor={`option-${option._id}`} className="flex justify-between w-full text-sm">
                                  <span>{option.name || "Sin nombre"}</span>
                                  {Number(option.price || 0) > 0 && <span className="text-black">{Number(option.price || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</span>}
                                </label>
                              </div>
                            ) : null
                          ))}
                        </div>
                      )}
                      
                      {/* Subgrupos */}
                      {Array.isArray(group.subGroups) && group.subGroups.length > 0 && (
                        <div className="space-y-3">
                          {group.subGroups.map((subGroup) => (
                            subGroup && subGroup._id ? (
                              <div key={subGroup._id} className="pl-2 border-l-2 border-gray-200">
                                <div className="flex items-center">
                                  <h4 className="font-medium text-sm mb-1">{subGroup.title || "Sin título"}</h4>
                                  {/* Badge para indicar si es obligatorio */}
                                  {subGroup.isRequired && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                                      Requerido
                                    </span>
                                  )}
                                </div>
                                
                                {Array.isArray(subGroup.options) && subGroup.options.map((option) => (
                                  option && option._id ? (
                                    <div key={option._id} className="flex items-center mb-1 ml-2 py-1">
                                      <input
                                        type={subGroup.isMultipleChoice ? "checkbox" : "radio"}
                                        id={`suboption-${subGroup._id}-${option._id}`}
                                        name={`subgroup-${group._id}-${subGroup._id}`}
                                        checked={(selectedToppings[`${group._id}_${subGroup._id}`] || []).includes(option._id)}
                                        onChange={() => handleOptionChange(group._id, option._id, true, subGroup._id)}
                                        className="mr-2"
                                      />
                                      <label 
                                        htmlFor={`suboption-${subGroup._id}-${option._id}`} 
                                        className="flex justify-between w-full text-sm"
                                      >
                                        <span>{option.name || "Sin nombre"}</span>
                                        {Number(option.price || 0) > 0 && <span className="text-black">{Number(option.price || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</span>}
                    </label>
                                    </div>
                                  ) : null
                                ))}
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
        </div>
        
        {/* Pie */}
        <div className="sticky bottom-0 bg-white p-4 border-t shadow-md z-10">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">Precio base:</span>
            <span>${Number(product.price || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</span>
          </div>
          
          {extraTotal > 0 && (
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">Extras:</span>
              <span>${Number(extraTotal).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center mb-4 text-lg font-bold">
            <span>Total:</span>
            <span>${Number(displayTotal).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</span>
            </div>
            
            <button
            onClick={handleAddToCart}
            style={{ backgroundColor: businessConfig.theme.buttonColor, color: businessConfig.theme.buttonTextColor }} className="w-full py-3 rounded-md transition-colors"
            >
            Agregar al carrito
            </button>
        </div>
      </div>
    </div>
  );
}

export default ProductToppingsSelector; 
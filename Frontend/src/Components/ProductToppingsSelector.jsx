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
  const [isValid, setIsValid] = useState(false);
  const [scrollToRequired, setScrollToRequired] = useState(false);

  // Función para verificar si una opción es gratis
  const isFreeOption = (optionName) => {
    if (!optionName) return false;
    const name = optionName.toLowerCase();
    return name.includes('gratis') || name.includes('gratuito') || name.includes('sin costo') || name.includes('incluido');
  };
  
  const { businessConfig } = useBusinessConfig();
  
  // Asegurarnos de que no haya grupos duplicados y que toppingGroups sea un array
  // Ordenar según el orden guardado en el backend
  const getOrderedToppingGroups = () => {
    if (!Array.isArray(product.toppingGroups)) return [];
    
    // Si hay orden guardado en el backend, usarlo
    if (product.toppingGroupsOrder && Array.isArray(product.toppingGroupsOrder)) {
      return product.toppingGroupsOrder
        .sort((a, b) => a.order - b.order)
        .map(orderItem => {
          return product.toppingGroups.find(g => g?._id === orderItem.toppingGroupId);
        })
        .filter(g => g); // Filtrar elementos nulos o undefined
    }
    
    // Si no hay orden guardado, usar el orden por defecto
    return Array.from(new Set(product.toppingGroups.map(g => g?._id)))
        .map(id => product.toppingGroups.find(g => g?._id === id))
      .filter(g => g); // Filtrar elementos nulos o undefined
  };

  const uniqueToppingGroups = getOrderedToppingGroups();

  console.log('Grupos de toppings disponibles:', uniqueToppingGroups.map(g => ({
    name: g.name, 
    basePrice: g.basePrice,
    hasSubGroups: g.subGroups && g.subGroups.length > 0,
    subGroups: g.subGroups ? g.subGroups.length : 0
  })));

  // Validar en tiempo real cuando cambien las selecciones
  useEffect(() => {
    const validationErrors = validateRequiredToppings();
    setIsValid(validationErrors.length === 0);
    
    // No mostrar ningún mensaje de error
    setError(null);
  }, [selectedToppings, uniqueToppingGroups]);

  // Efecto para destacar visualmente el grupo cuando se hace scroll
  useEffect(() => {
    if (scrollToRequired) {
      // Remover el efecto después de 3 segundos
      const timer = setTimeout(() => {
        setScrollToRequired(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [scrollToRequired]);

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
      // Asegurar que el scroll se restaure si el componente se desmonta
      document.body.classList.remove('modal-open');
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
                  subGroupTitle: subGroup.title || 'Desconocido',
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
        // Para cada opción principal seleccionada, crear un objeto de topping
        if (hasMainSelections) {
          groupSelections.forEach(optionId => {
            const option = group.options?.find(o => o._id === optionId);
            result.push({
              groupName: group.name || 'Desconocido',
              optionName: option?.name || 'Desconocida',
              price: option?.price || 0,
              basePrice: group.basePrice || 0,
              subGroups: hasSubGroupSelections ? subGroupSelections : []
            });
          });
        } else if (hasSubGroupSelections) {
          // Si solo hay subgrupos, crear un topping con el grupo base
          result.push({
            groupName: group.name || 'Desconocido',
            optionName: '', // No hay opción principal
            price: 0,
            basePrice: group.basePrice || 0,
            subGroups: subGroupSelections
          });
        }
      }
    });
    
    return result;
  };

  const handleError = (error) => {
    console.error('Error en ProductToppingsSelector:', error);
    setError('Ha ocurrido un error al procesar las opciones');
  };

  // Función para validar toppings obligatorios
  const validateRequiredToppings = () => {
    const errors = [];
    
    uniqueToppingGroups.forEach(group => {
      // Verificar si el grupo principal es obligatorio
      if (group.isRequired) {
        const hasMainSelections = selectedToppings[group._id] && 
          selectedToppings[group._id].length > 0;
        
        // Verificar si hay subgrupos obligatorios
        const hasRequiredSubGroups = group.subGroups && 
          group.subGroups.some(subGroup => subGroup.isRequired);
        
        if (hasRequiredSubGroups) {
          // Si hay subgrupos obligatorios, verificar que al menos uno tenga selecciones
          const hasSubGroupSelections = group.subGroups.some(subGroup => {
            if (!subGroup.isRequired) return true; // Si no es obligatorio, no validar
            return selectedToppings[`${group._id}_${subGroup.title}`] && 
                   selectedToppings[`${group._id}_${subGroup.title}`].length > 0;
          });
          
          if (!hasMainSelections && !hasSubGroupSelections) {
            errors.push(`Debes seleccionar al menos una opción en "${group.name}"`);
          }
        } else if (!hasMainSelections) {
          // Si no hay subgrupos obligatorios pero el grupo principal es obligatorio
          errors.push(`Debes seleccionar al menos una opción en "${group.name}"`);
        }
      }
      
      // Verificar subgrupos obligatorios individualmente
      if (group.subGroups) {
        group.subGroups.forEach(subGroup => {
          if (subGroup.isRequired) {
            const subGroupKey = `${group._id}_${subGroup.title}`;
            const hasSubGroupSelection = selectedToppings[subGroupKey] && 
              selectedToppings[subGroupKey].length > 0;
            
            if (!hasSubGroupSelection) {
              errors.push(`Debes seleccionar al menos una opción en "${subGroup.title}"`);
            }
          }
        });
      }
    });
    
    return errors;
  };

  const handleAddToCart = () => {
    try {
      // Si no es válido, encontrar el siguiente grupo obligatorio que falte
      if (!isValid) {
        setError(null);
        
        // Encontrar el primer grupo obligatorio que no tenga selecciones
        const nextRequiredGroup = uniqueToppingGroups.find(group => {
          if (!group.isRequired) return false;
          
          // Verificar si el grupo principal tiene selecciones
          const hasMainSelections = selectedToppings[group._id] && 
            selectedToppings[group._id].length > 0;
          
          // Verificar si hay subgrupos obligatorios sin selecciones
          const hasRequiredSubGroups = group.subGroups && 
            group.subGroups.some(subGroup => subGroup.isRequired);
          
          if (hasRequiredSubGroups) {
            // Si hay subgrupos obligatorios, verificar que al menos uno tenga selecciones
            const hasSubGroupSelections = group.subGroups.some(subGroup => {
              if (!subGroup.isRequired) return true; // Si no es obligatorio, no validar
              return selectedToppings[`${group._id}_${subGroup.title}`] && 
                     selectedToppings[`${group._id}_${subGroup.title}`].length > 0;
            });
            
            return !hasMainSelections && !hasSubGroupSelections;
          } else {
            // Si no hay subgrupos obligatorios, verificar solo el grupo principal
            return !hasMainSelections;
          }
        });
        
        if (nextRequiredGroup) {
          // Expandir el grupo que falta
          const newExpandedGroups = { ...expandedGroups };
          newExpandedGroups[nextRequiredGroup._id] = true;
          setExpandedGroups(newExpandedGroups);
          
          // Activar scroll hacia el grupo que falta
          setScrollToRequired(true);
          
          // Hacer scroll al grupo que falta después de un pequeño delay
          setTimeout(() => {
            const element = document.getElementById(`group-${nextRequiredGroup._id}`);
            if (element) {
              element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
            }
          }, 100);
        }
        
        return;
      }
      
      // Si es válido, proceder normalmente
      setError(null);
      
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
      className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-40"
      onClick={onClose}
    >
        <div
          className="bg-white rounded-2xl max-w-lg w-full h-[90vh] sm:h-[92vh] md:h-[95vh] shadow-2xl border border-slate-200/50 backdrop-blur-lg flex flex-col"
          onClick={handleModalClick}
        >
        {/* Encabezado del modal */}
        <div className="sticky top-0 bg-gradient-to-r from-white to-slate-50 border-b border-slate-200 p-6 flex justify-between items-center z-10 backdrop-blur-lg rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: businessConfig.theme?.buttonColor || '#3B82F6' }}
            >
              <span className="text-white text-lg font-bold">🍽️</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Personalizar Producto</h2>
              <p className="text-sm text-slate-500">{product.name}</p>
            </div>
          </div>
          <button
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Cuerpo del modal - Scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 min-h-0">
          {/* Imagen del producto */}
          {product.image && (
            <div className="relative w-full h-40 mb-4 rounded-lg overflow-hidden bg-white">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-contain"
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
              <span className="px-4 py-1 font-medium text-gray-800">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                +
              </button>
            </div>
          </div>

          {/* Indicador de opciones adicionales */}
          {uniqueToppingGroups.length > 0 && (
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Opciones adicionales disponibles</p>
                    <p className="text-xs text-blue-600">Desliza hacia abajo para ver todas las opciones</p>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <svg className="w-4 h-4 text-blue-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="text-xs text-blue-500 font-medium">↓</span>
                </div>
              </div>
            </div>
          )}

          {/* Lista de grupos de toppings */}
          {uniqueToppingGroups.length > 0 ? (
            <div className="space-y-4">
              
              {uniqueToppingGroups.map((group, index) => (
                group && group._id ? (
                  <div
                    key={group._id}
                    id={`group-${group._id}`}
                    className={`bg-gradient-to-r from-slate-50 to-white rounded-xl p-4 mb-4 last:mb-0 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-200 ${
                      scrollToRequired && group.isRequired 
                        ? 'ring-2 ring-red-400 bg-red-50 shadow-lg' 
                        : ''
                    }`}
                  >
                    {/* Encabezado del grupo */}
                    <div
                      onClick={() => toggleGroup(group._id)}
                      className="flex items-center justify-between cursor-pointer mb-3"
                    >
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-gray-800">{group.name}</h4>
                            {group.description && (
                              <p className="text-sm text-gray-600">{group.description}</p>
                            )}
                              </div>
                              {/* Verificar si hay opciones gratis en el grupo principal */}
                              {group.options && group.options.some(option => isFreeOption(option.name)) && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full ml-2">
                                  🎉 Opciones gratis
                                </span>
                              )}
                              {/* Verificar si hay opciones gratis en subgrupos */}
                              {group.subGroups && group.subGroups.some(subGroup => 
                                subGroup.options && subGroup.options.some(option => isFreeOption(option.name))
                              ) && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full ml-2">
                                  🎉 Opciones gratis
                                </span>
                              )}
                            </div>
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
                      <div className="bg-white rounded-lg p-3 border border-slate-200/50">
                        {/* Opciones principales */}
                        {Array.isArray(group.options) && group.options.length > 0 && (
                          <div className="space-y-2">
                            {group.options.filter(option => option && option._id && option.active !== false).map(option => (
                                <div
                                  key={option._id}
                                  onClick={() => handleOptionChange(group._id, option._id)}
                                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                                    (selectedToppings[group._id] || []).includes(option._id)
                                      ? 'bg-blue-50 border border-blue-200 shadow-sm'
                                      : 'hover:bg-gray-50 border border-gray-200 hover:shadow-sm'
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
                                    <span className="text-gray-800">{option.name || 'Opción'}</span>
                                  </div>
                                  
                                  {isFreeOption(option.name) ? (
                                    <span className="text-green-600 font-medium">Gratis</span>
                                  ) : Number(option.price) > 0 ? (
                                    <span className="text-gray-700">+${option.price}</span>
                                  ) : null}
                                </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Subgrupos */}
                        {Array.isArray(group.subGroups) && group.subGroups.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {group.subGroups.filter(subGroup => subGroup && subGroup._id).map(subGroup => (
                                <div key={subGroup._id} className="bg-slate-50 rounded-lg p-3 border border-slate-200/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-medium text-gray-800">{subGroup.title}</h5>
                                    {/* Verificar si hay opciones gratis en este subgrupo */}
                                    {subGroup.options && subGroup.options.some(option => isFreeOption(option.name)) && (
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                        🎉 Opciones gratis
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Opciones del subgrupo */}
                                  <div className="space-y-2">
                                    {Array.isArray(subGroup.options) && subGroup.options.filter(option => option && option._id && option.active !== false).map(option => (
                                        <div
                                          key={option._id}
                                          onClick={() => handleOptionChange(
                                            group._id,
                                            option._id,
                                            true,
                                            subGroup._id,
                                            !subGroup.isMultipleChoice
                                          )}
                                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                                            (selectedToppings[`${group._id}_${subGroup._id}`] || []).includes(option._id)
                                              ? 'bg-blue-50 border border-blue-200 shadow-sm'
                                              : 'hover:bg-gray-50 border border-gray-200 hover:shadow-sm'
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
                                            <span className="text-gray-800">{option.name || 'Opción'}</span>
                                          </div>
                                          
                                          {isFreeOption(option.name) ? (
                                            <span className="text-green-600 font-medium">Gratis</span>
                                          ) : Number(option.price) > 0 ? (
                                            <span className="text-gray-700">+${option.price}</span>
                                          ) : null}
                                        </div>
                                    ))}
                                  </div>
                                </div>
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

          {/* Indicador de fin de opciones */}
          {uniqueToppingGroups.length > 0 && (
            <div className="mt-6 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm font-medium text-green-800">¡Has visto todas las opciones disponibles!</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Pie del modal con precio y botón */}
        <div className="border-t border-slate-200/80 bg-white p-6 space-y-4 shadow-xl rounded-b-2xl flex-shrink-0">
          <div className="flex justify-between items-center p-4 rounded-xl shadow-sm border border-slate-200/50" style={{ background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.063), rgba(0, 0, 0, 0.02))' }}>
            <div>
              <p className="text-sm text-slate-600">Total personalización</p>
              <p className="text-2xl font-bold text-slate-800">${displayTotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</p>
            </div>
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: businessConfig.theme?.buttonColor || '#3B82F6' }}
            >
              <span className="text-white text-xl">💰</span>
            </div>
          </div>
          
          
          <button
            onClick={handleAddToCart}
            className="w-full py-3 rounded-lg transition-colors duration-300 font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow"
            style={{ 
              backgroundColor: businessConfig.theme?.buttonColor || '#3B82F6', 
              color: businessConfig.theme?.buttonTextColor || 'white' 
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
            </svg>
            <span>
              {uniqueToppingGroups.length > 0 
                ? `Agregar al carrito ${extraTotal > 0 ? `(+$${extraTotal.toLocaleString()})` : ''}` 
                : 'Agregar al carrito'
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductToppingsSelector; 
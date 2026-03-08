import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from "../Context/BusinessContext";

function ProductToppingsSelector({ product, onAddToCart, onClose, compact = false }) {
  const [selectedToppings, setSelectedToppings] = useState({});
  const [totalPrice, setTotalPrice] = useState(product.price || 0);
  const [displayTotal, setDisplayTotal] = useState(product.price || 0);
  const [extraTotal, setExtraTotal] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isValid, setIsValid] = useState(false);
  const [scrollToRequired, setScrollToRequired] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);

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
    
    // In compact/POS mode expand ALL groups; otherwise expand if few
    if (compact && uniqueToppingGroups.length > 0) {
      const initialExpandedState = {};
      uniqueToppingGroups.forEach(group => {
        if (group && group._id) initialExpandedState[group._id] = true;
      });
      setExpandedGroups(initialExpandedState);
    } else if (uniqueToppingGroups.length > 0 && uniqueToppingGroups.length <= 3) {
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
      // totalPrice debe ser el precio UNITARIO (producto + extras), sin multiplicar por cantidad
      const unitPrice = (Number(product.price || 0) + (extraTotal || 0));
      const productToAdd = {
        ...product,
        selectedToppings: selectedToppingsData,
        quantity: quantity,
        totalPrice: unitPrice
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

  // Close only when tapping directly on the dark backdrop, not from scroll gestures
  const backdropRef = React.useRef(null);
  const handleBackdropPointerDown = (e) => {
    // Only close if the pointer landed exactly on the backdrop (not on the modal content)
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  // Renderizar el modal con los toppings
  const themeBtn = businessConfig.theme?.buttonColor || '#3B82F6';
  const themeTxt = businessConfig.theme?.buttonTextColor || '#ffffff';

  // ── Compact (POS) mode: flat, no scroll, chip-style options ──
  if (compact) {
    return (
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40"
        onMouseDown={handleBackdropPointerDown}
      >
        <div
          className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-2xl flex flex-col max-h-[90vh]"
          onClick={handleModalClick}
        >
          {/* Header: name + price + qty + close */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-slate-900 truncate">{product.name}</h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {/* Inline quantity */}
              <button onClick={() => quantity > 1 && setQuantity(quantity - 1)} className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all" style={quantity > 1 ? { backgroundColor: `${themeBtn}10`, color: themeBtn } : { backgroundColor: '#f1f5f9' }} disabled={quantity <= 1}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14"/></svg>
              </button>
              <span className="w-7 text-center font-black text-slate-800 tabular-nums">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all" style={{ backgroundColor: `${themeBtn}10`, color: themeBtn }}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors ml-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          {/* Body: topping groups as horizontal chip flows */}
          <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
            {uniqueToppingGroups.length > 0 ? (
              <div className="space-y-3">
                {uniqueToppingGroups.map(group => group && group._id ? (
                  <div key={group._id} id={`group-${group._id}`}>
                    {/* Group label */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{group.name}</span>
                      {group.isRequired && <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Requerido</span>}
                      {Number(group.basePrice) > 0 && <span className="text-[10px] font-bold text-emerald-600">+${group.basePrice?.toLocaleString()}</span>}
                      {countSelections(group) > 0 && (
                        <button onClick={(e) => clearGroupSelections(group._id, e)} className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors ml-auto">Limpiar</button>
                      )}
                    </div>

                    {/* Options as wrap chips */}
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(group.options) && group.options.filter(o => o && o._id && o.active !== false).map(option => {
                        const isSelected = (selectedToppings[group._id] || []).includes(option._id);
                        return (
                          <button
                            key={option._id}
                            onClick={() => handleOptionChange(group._id, option._id)}
                            className={`px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 border-2 ${
                              isSelected ? 'text-white shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                            style={isSelected ? { backgroundColor: themeBtn, borderColor: themeBtn } : undefined}
                          >
                            {option.name}
                            {!isFreeOption(option.name) && Number(option.price) > 0 && (
                              <span className={`ml-1 text-[11px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>+${option.price?.toLocaleString()}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Subgroups as chips too */}
                    {Array.isArray(group.subGroups) && group.subGroups.filter(s => s && s._id).map(subGroup => (
                      <div key={subGroup._id} className="mt-2">
                        <span className="text-[11px] font-bold text-slate-400 mb-1.5 block">{subGroup.title}</span>
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(subGroup.options) && subGroup.options.filter(o => o && o._id && o.active !== false).map(option => {
                            const isSelected = (selectedToppings[`${group._id}_${subGroup._id}`] || []).includes(option._id);
                            return (
                              <button
                                key={option._id}
                                onClick={() => handleOptionChange(group._id, option._id, true, subGroup._id, !subGroup.isMultipleChoice)}
                                className={`px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 border-2 ${
                                  isSelected ? 'text-white shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                }`}
                                style={isSelected ? { backgroundColor: themeBtn, borderColor: themeBtn } : undefined}
                              >
                                {option.name}
                                {!isFreeOption(option.name) && Number(option.price) > 0 && (
                                  <span className={`ml-1 text-[11px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>+${option.price?.toLocaleString()}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null)}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">Sin personalización</p>
            )}

            {error && (
              <div className="mt-3 flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Footer: total + add */}
          <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="flex-1">
              <p className="text-2xl font-black text-slate-900 tabular-nums">${displayTotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              {extraTotal > 0 && <p className="text-[11px] font-bold" style={{ color: themeBtn }}>+${extraTotal.toLocaleString()} extras</p>}
            </div>
            <button
              onClick={handleAddToCart}
              className={`px-6 py-3 rounded-xl font-bold text-[15px] flex items-center gap-2 transition-all active:scale-[0.97] shadow-lg ${isValid ? 'hover:shadow-xl' : 'opacity-70'}`}
              style={{ backgroundColor: themeBtn, color: themeTxt, boxShadow: isValid ? `0 8px 24px ${themeBtn}35` : undefined }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Agregar
              {quantity > 1 && <span className="opacity-70">× {quantity}</span>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Standard (menu) mode ──
  return (
    <>
    {/* ── Fullscreen image lightbox ── */}
    {imageExpanded && product.image && (
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={() => setImageExpanded(false)}
      >
        <button
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all flex items-center justify-center z-50"
          onClick={() => setImageExpanded(false)}
          aria-label="Cerrar imagen"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <img
          src={product.image}
          alt={product.name}
          className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <p className="absolute bottom-6 left-0 right-0 text-center text-white/70 text-sm font-medium">{product.name}</p>
      </div>
    )}

    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-40"
      onMouseDown={handleBackdropPointerDown}
      onTouchEnd={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
        <div
          className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl flex flex-col modal-h-full pb-safe"
          onClick={handleModalClick}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >

        {/* ── Header: product image hero + overlay info ── */}
        <div className="relative flex-shrink-0">
          {/* Drag indicator (mobile) */}
          <div className="sm:hidden flex justify-center pt-2.5 pb-1 absolute top-0 left-0 right-0 z-30">
            <div className="w-10 h-1 rounded-full bg-white/50" />
          </div>

          {product.image ? (
            <div className="relative h-44 sm:h-52 overflow-hidden rounded-t-3xl sm:rounded-t-2xl">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
              {/* Expand image button */}
              <button
                className="absolute top-3 left-3 w-8 h-8 rounded-xl bg-black/30 backdrop-blur-md text-white/90 hover:bg-black/50 transition-all flex items-center justify-center z-20"
                onClick={() => setImageExpanded(true)}
                aria-label="Ampliar imagen"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              </button>
              {/* Close button */}
              <button
                className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-black/30 backdrop-blur-md text-white/90 hover:bg-black/50 transition-all flex items-center justify-center z-20"
                onClick={onClose}
                aria-label="Cerrar"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
              {/* Product info over image */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h2 className="text-lg sm:text-xl font-extrabold text-white drop-shadow-lg leading-tight">{product.name}</h2>
                {product.description && (
                  <p className="text-[12px] sm:text-[13px] text-white/80 mt-1 line-clamp-2 leading-snug">{product.description}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="px-4 pt-4 pb-3 flex items-start justify-between border-b border-slate-100 rounded-t-3xl sm:rounded-t-2xl">
              <div className="flex items-center gap-3 min-w-0">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: `${themeBtn}12`, color: themeBtn }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v1m0 16v1m-8-9H3m18 0h-1M5.6 5.6l.7.7m12.1-.7l-.7.7M5.6 18.4l.7-.7m12.1.7l-.7-.7"/><circle cx="12" cy="12" r="4"/></svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">{product.name}</h2>
                  {product.description && (
                    <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-2 leading-snug">{product.description}</p>
                  )}
                </div>
              </div>
              <button
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all flex items-center justify-center flex-shrink-0 ml-2"
                onClick={onClose}
                aria-label="Cerrar"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* ── Body: scrollable ── */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 min-h-0">

          {/* Quantity stepper */}
          <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Cantidad</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => quantity > 1 && setQuantity(quantity - 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 transition-all active:scale-90"
                style={quantity > 1 ? { backgroundColor: `${themeBtn}10`, color: themeBtn } : { backgroundColor: '#f1f5f9' }}
                disabled={quantity <= 1}
                aria-label="Disminuir cantidad"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14"/></svg>
              </button>
              <span className="w-10 text-center font-bold text-slate-800 tabular-nums">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90"
                style={{ backgroundColor: `${themeBtn}10`, color: themeBtn }}
                aria-label="Aumentar cantidad"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>

          {/* Indicador de opciones adicionales */}
          {uniqueToppingGroups.length > 0 && (
            <div className="mb-4 flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 bg-slate-50/80">
              <div 
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${themeBtn}12`, color: themeBtn }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v1m0 16v1m-8-9H3m18 0h-1"/><circle cx="12" cy="12" r="4"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-700">Opciones adicionales disponibles</p>
                <p className="text-[11px] text-slate-400">Desliza hacia abajo para ver todas las opciones</p>
              </div>
              <svg className="w-4 h-4 text-slate-300 animate-bounce flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </div>
          )}

          {/* Lista de grupos de toppings */}
          {uniqueToppingGroups.length > 0 ? (
            <div className="space-y-3">
              {uniqueToppingGroups.map((group, index) => (
                group && group._id ? (
                  <div
                    key={group._id}
                    id={`group-${group._id}`}
                    className={`rounded-xl border overflow-hidden transition-all duration-300 ${
                      scrollToRequired && group.isRequired && !(selectedToppings[group._id]?.length > 0)
                        ? 'border-red-300 bg-red-50/50 shadow-md ring-1 ring-red-200' 
                        : countSelections(group) > 0
                          ? 'border-slate-200 bg-white shadow-sm'
                          : 'border-slate-150 bg-slate-50/50'
                    }`}
                  >
                    {/* Group header */}
                    <div
                      onClick={() => toggleGroup(group._id)}
                      className="flex items-center gap-3 p-3.5 cursor-pointer select-none"
                    >
                      {/* Icon */}
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ 
                          backgroundColor: countSelections(group) > 0 ? `${themeBtn}15` : '#f1f5f9',
                          color: countSelections(group) > 0 ? themeBtn : '#94a3b8'
                        }}
                      >
                        {group.isMultipleChoice ? (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12l2 2 4-4"/></svg>
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-800 truncate">{group.name}</h3>
                          {/* Free options badge */}
                          {(
                            (group.options && group.options.some(option => isFreeOption(option.name))) ||
                            (group.subGroups && group.subGroups.some(subGroup => 
                              subGroup.options && subGroup.options.some(option => isFreeOption(option.name))
                            ))
                          ) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 flex-shrink-0">
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>
                              Gratis
                            </span>
                          )}
                        </div>
                        {/* Tags row */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {group.isRequired ? (
                            <span className="text-[10px] font-semibold text-red-500">Obligatorio</span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400">Opcional</span>
                          )}
                          <span className="text-[8px] text-slate-300">●</span>
                          <span className="text-[10px] font-medium text-slate-400">
                            {group.isMultipleChoice ? 'Selección múltiple' : 'Selección única'}
                          </span>
                          {Number(group.basePrice) > 0 && (
                            <>
                              <span className="text-[8px] text-slate-300">●</span>
                              <span className="text-[10px] font-semibold text-emerald-600">+${group.basePrice?.toLocaleString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right side: count + clear + chevron */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {countSelections(group) > 0 && (
                          <>
                            <span 
                              className="inline-flex items-center justify-center text-[10px] font-bold rounded-full w-5 h-5"
                              style={{ backgroundColor: `${themeBtn}15`, color: themeBtn }}
                            >
                              {countSelections(group)}
                            </span>
                            <button
                              onClick={(e) => clearGroupSelections(group._id, e)}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              aria-label="Limpiar selecciones"
                            >
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          </>
                        )}
                        <svg
                          className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${expandedGroups[group._id] ? 'rotate-180' : ''}`}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                        >
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>
                    </div>
                    
                    {/* Expanded options */}
                    {expandedGroups[group._id] && (
                      <div className="px-3.5 pb-3.5 space-y-1.5">
                        {/* Main options */}
                        {Array.isArray(group.options) && group.options.length > 0 && (
                          <div className="space-y-1.5">
                            {group.options.filter(option => option && option._id && option.active !== false).map(option => {
                              const isSelected = (selectedToppings[group._id] || []).includes(option._id);
                              return (
                                <div
                                  key={option._id}
                                  onClick={() => handleOptionChange(group._id, option._id)}
                                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                                    isSelected
                                      ? 'bg-white shadow-sm border-2'
                                      : 'bg-white/60 hover:bg-white border border-slate-100 hover:border-slate-200'
                                  }`}
                                  style={isSelected ? { borderColor: `${themeBtn}40`, backgroundColor: `${themeBtn}05` } : undefined}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {/* Custom checkbox/radio */}
                                    <div
                                      className={`w-5 h-5 flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
                                        group.isMultipleChoice ? 'rounded-md' : 'rounded-full'
                                      }`}
                                      style={isSelected 
                                        ? { backgroundColor: themeBtn, borderColor: themeBtn } 
                                        : { backgroundColor: 'transparent', border: '2px solid #cbd5e1' }
                                      }
                                    >
                                      {isSelected && (
                                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={themeTxt} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                                      )}
                                    </div>
                                    <span className={`text-sm ${isSelected ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{option.name || 'Opción'}</span>
                                  </div>
                                  
                                  {isFreeOption(option.name) ? (
                                    <span className="text-[11px] font-bold text-emerald-500 flex-shrink-0">GRATIS</span>
                                  ) : Number(option.price) > 0 ? (
                                    <span className={`text-[12px] font-semibold flex-shrink-0 ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}>+${option.price?.toLocaleString()}</span>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Subgroups */}
                        {Array.isArray(group.subGroups) && group.subGroups.length > 0 && (
                          <div className="mt-2 space-y-2.5">
                            {group.subGroups.filter(subGroup => subGroup && subGroup._id).map(subGroup => (
                                <div key={subGroup._id} className="rounded-xl bg-slate-50/80 border border-slate-100 p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-bold text-[13px] text-slate-700">{subGroup.title}</h5>
                                    {subGroup.options && subGroup.options.some(option => isFreeOption(option.name)) && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>
                                        Gratis
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="space-y-1.5">
                                    {Array.isArray(subGroup.options) && subGroup.options.filter(option => option && option._id && option.active !== false).map(option => {
                                      const isSelected = (selectedToppings[`${group._id}_${subGroup._id}`] || []).includes(option._id);
                                      return (
                                        <div
                                          key={option._id}
                                          onClick={() => handleOptionChange(
                                            group._id,
                                            option._id,
                                            true,
                                            subGroup._id,
                                            !subGroup.isMultipleChoice
                                          )}
                                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                                            isSelected
                                              ? 'bg-white shadow-sm border-2'
                                              : 'bg-white/80 hover:bg-white border border-slate-100 hover:border-slate-200'
                                          }`}
                                          style={isSelected ? { borderColor: `${themeBtn}40`, backgroundColor: `${themeBtn}05` } : undefined}
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div
                                              className={`w-5 h-5 flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
                                                subGroup.isMultipleChoice ? 'rounded-md' : 'rounded-full'
                                              }`}
                                              style={isSelected 
                                                ? { backgroundColor: themeBtn, borderColor: themeBtn } 
                                                : { backgroundColor: 'transparent', border: '2px solid #cbd5e1' }
                                              }
                                            >
                                              {isSelected && (
                                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={themeTxt} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                                              )}
                                            </div>
                                            <span className={`text-sm ${isSelected ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{option.name || 'Opción'}</span>
                                          </div>
                                          
                                          {isFreeOption(option.name) ? (
                                            <span className="text-[11px] font-bold text-emerald-500 flex-shrink-0">GRATIS</span>
                                          ) : Number(option.price) > 0 ? (
                                            <span className={`text-[12px] font-semibold flex-shrink-0 ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}>+${option.price?.toLocaleString()}</span>
                                          ) : null}
                                        </div>
                                      );
                                    })}
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
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <p className="text-sm font-semibold text-slate-600">Sin personalización adicional</p>
              <p className="text-[12px] text-slate-400 mt-0.5">Ajusta la cantidad y agrega al carrito.</p>
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
        
        {/* ── Footer: price + add button ── */}
        <div className="border-t border-slate-100 bg-white px-4 py-3 sm:py-4 flex-shrink-0 rounded-b-2xl">
          {/* Price row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Total</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                ${displayTotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            {extraTotal > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-slate-400">Extras</p>
                <p className="text-sm font-bold" style={{ color: themeBtn }}>+${extraTotal.toLocaleString()}</p>
              </div>
            )}
          </div>
          
          {/* Add to cart button */}
          <button
            onClick={handleAddToCart}
            className={`w-full py-3.5 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-lg ${
              isValid ? 'hover:shadow-xl' : 'opacity-70'
            }`}
            style={{ 
              backgroundColor: themeBtn, 
              color: themeTxt,
              boxShadow: isValid ? `0 8px 24px ${themeBtn}35` : undefined
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
            <span>Agregar al carrito</span>
            {quantity > 1 && <span className="opacity-70">× {quantity}</span>}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

export default ProductToppingsSelector; 
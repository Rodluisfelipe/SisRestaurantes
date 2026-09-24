import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from "../Context/BusinessContext";
import api from "../services/api";
import { X, Maximize2, Star, AlertCircle, Heart } from "lucide-react";
import { Hoja, Boton, Cantidad } from "./ui";
import useFavoritos from "../hooks/useFavoritos";
import { negocioDeLaCuenta } from "../utils/cuentaCliente";

/* Un extra del grupo principal se pide por cantidad ("Carne extra ×3")
   cuando el grupo es de opción múltiple y el dueño lo permitió; si no dijo
   nada (allowRepeats null), los extras con precio sí y los gratis no: nadie
   pide tres veces "sin cebolla". */
const TOPE_POR_OPCION = 20;
function repiteEnGrupo(group, option) {
  if (!group?.isMultipleChoice) return false;
  if (group.allowRepeats === true) return true;
  if (group.allowRepeats === false) return false;
  return Number(option?.price) > 0;
}

function ProductToppingsSelector({ product, onAddToCart, onClose, compact = false }) {
  const [selectedToppings, setSelectedToppings] = useState({});
  const [totalPrice, setTotalPrice] = useState(product.price || 0);
  const [displayTotal, setDisplayTotal] = useState(product.price || 0);
  const [extraTotal, setExtraTotal] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const { esFavorito, alternar } = useFavoritos();
  // El corazón es del cliente en el menú; el POS web usa esta ficha sin él.
  const conFavoritos = !compact && !!negocioDeLaCuenta() && !!product?._id;
  const [isValid, setIsValid] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [scrollToRequired, setScrollToRequired] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  /* Galería: la principal es `image` y las demás llegan en `images`. En el
     menú solo se carga la principal; el resto llega al abrir el producto. */
  const fotos = React.useMemo(() => {
    const lista = [product.image, ...(Array.isArray(product.images) ? product.images : [])];
    return [...new Set(lista.filter(Boolean))];
  }, [product.image, product.images]);
  const [fotoActual, setFotoActual] = useState(0);
  const carruselRef = React.useRef(null);

  /* Tiendas: el cliente elige talla, color o fragancia antes de agregar. Los
     ejes los define el negocio, así que aquí no se asume ninguno. */
  const ejes = (Array.isArray(product.opciones) ? product.opciones : [])
    .filter((o) => o && o.nombre && Array.isArray(o.valores) && o.valores.length);
  const variantesActivas = (Array.isArray(product.variantes) ? product.variantes : [])
    .filter((v) => v && v.activo !== false && Array.isArray(v.valores));
  const [eleccion, setEleccion] = useState(() => ejes.map(() => ''));

  /* Arriba del todo, antes de cualquier efecto que lo use en su lista de
     dependencias. Esa lista se evalúa en cada render —no cuando el efecto
     corre— así que una constante declarada más abajo revienta la pantalla
     entera con "Cannot access before initialization". */
  const { businessConfig, businessId } = useBusinessConfig();

  /* El stock de las variantes solo limita si el producto tiene activado el
     control de inventario. Sin él —como en cualquier producto de MenuBy— el
     negocio no lleva cuentas y un cero significa "no lo he contado", no
     "se acabó".

     Va aquí arriba y no más abajo porque `sinStock` lo lee: declarada después,
     esa línea lanzaba "Cannot access before initialization" en cada render y
     la ficha de producto no abría nunca. */
  const controlaStock = product.trackStock === true;

  const varianteElegida = ejes.length
    ? variantesActivas.find((v) => v.valores.length === ejes.length && v.valores.every((valor, i) => valor === eleccion[i]))
    : null;
  const precioBase = (varianteElegida && varianteElegida.precio != null) ? varianteElegida.precio : (product.price || 0);
  const diferenciaVariante = precioBase - (product.price || 0);
  const faltaElegir = ejes.length > 0 && !varianteElegida;
  const sinStock = controlaStock && Boolean(varianteElegida) && Number(varianteElegida.stock) <= 0;

  /* Lo que opinó quien ya lo compró. Se pide al abrir la ficha y no con el
     menú entero: son datos que solo importan cuando alguien se detiene en un
     producto, y cargarlos para las 40 tarjetas sería pagar por nada. */
  const [opiniones, setOpiniones] = useState(null);
  useEffect(() => {
    if (!businessId || !product?._id) return;
    let vivo = true;
    api.get(`/reviews/productos?businessId=${businessId}&productId=${product._id}`)
      .then((res) => { if (vivo) setOpiniones(res.data?.[0] || null); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [businessId, product?._id]);

  /* Un valor se ve agotado si no queda ninguna variante con stock que lo
     incluya, contando lo que ya eligió el cliente en los otros ejes. */
  const valorDisponible = (indice, valor) => !controlaStock || variantesActivas.some(
    (v) => v.valores[indice] === valor &&
      Number(v.stock) > 0 &&
      eleccion.every((sel, j) => j === indice || !sel || v.valores[j] === sel)
  );

  const elegirValor = (indice, valor) =>
    setEleccion((previa) => previa.map((v, i) => (i === indice ? (v === valor ? '' : valor) : v)));

  // Al elegir un color, se muestra su foto.
  useEffect(() => {
    const foto = varianteElegida && varianteElegida.imagen;
    if (!foto) return;
    const i = fotos.indexOf(foto);
    if (i < 0) return;
    setFotoActual(i);
    const caja = carruselRef.current;
    if (caja) caja.scrollTo({ left: i * caja.clientWidth, behavior: 'smooth' });
  }, [varianteElegida, fotos]);

  // Función para verificar si una opción es gratis
  const isFreeOption = (optionName) => {
    if (!optionName) return false;
    const name = optionName.toLowerCase();
    return name.includes('gratis') || name.includes('gratuito') || name.includes('sin costo') || name.includes('incluido');
  };
  
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

  useEffect(() => {
    
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

  function calculateTotal() {
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
        basePriceTotal += Number(group.basePrice || 0);
      }
      
      // Calcular precios de las opciones seleccionadas
      if (Array.isArray(group.options)) {
        group.options.forEach(option => {
          if (!option || !option._id) return;
          // Por unidades: "Carne extra ×3" cobra tres veces.
          const count = groupSelections.filter(id => id === option._id).length;
          if (count > 0) optionsPriceTotal += Number(option.price || 0) * count;
        });
      }
      
      // Calcular precios de las opciones de subgrupos
      if (Array.isArray(group.subGroups)) {
        group.subGroups.forEach(subGroup => {
          if (subGroup && subGroup._id && Array.isArray(subGroup.options)) {
            const subGroupKey = `${group._id}_${subGroup._id}`;
            const subGroupSelections = selectedToppings[subGroupKey] || [];
            
            subGroup.options.forEach(option => {
              if (!option || !option._id) return;
              // Contar ocurrencias (no solo presencia) para que las repeticiones
              // en subgrupos con allowRepeats cobren cada una su precio.
              const count = subGroupSelections.filter(id => id === option._id).length;
              if (count > 0) optionsPriceTotal += Number(option.price || 0) * count;
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
  }

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
      const subGroup = isSubGroup ? group?.subGroups?.find(s => s?._id === subGroupId) : null;
      const isMultiple = isSubGroup ? subGroup?.isMultipleChoice : group?.isMultipleChoice;
      const maxSelections = isSubGroup ? subGroup?.maxSelections : group?.maxSelections;

      if (!isMultiple) {
        // Para selección única
        newSelectedToppings[key] = newSelectedToppings[key].includes(optionId) ? [] : [optionId];
      } else {
        // Para selección múltiple
        if (newSelectedToppings[key].includes(optionId)) {
          newSelectedToppings[key] = newSelectedToppings[key].filter(id => id !== optionId);
        } else if (maxSelections && newSelectedToppings[key].length >= maxSelections) {
          // Ya se alcanzó el tope de este subgrupo (ej: "máx 3 de 4 vegetales"); no agregar más.
          return prev;
        } else {
          newSelectedToppings[key] = [...newSelectedToppings[key], optionId];
        }
      }
      
      return newSelectedToppings;
    });
  };

  // Para subgrupos con allowRepeats: sumar/restar una unidad de una misma opción
  // (ej: "zanahoria x2"), en vez de solo incluirla/excluirla una vez.
  const handleRepeatCountChange = (groupId, subGroupId, optionId, delta) => {
    setSelectedToppings(prev => {
      const key = `${groupId}_${subGroupId}`;
      const current = prev[key] || [];

      if (delta > 0) {
        const group = uniqueToppingGroups.find(g => g && g._id === groupId);
        const subGroup = group?.subGroups?.find(s => s?._id === subGroupId);
        const maxSelections = subGroup?.maxSelections;
        if (maxSelections && current.length >= maxSelections) return prev;
        return { ...prev, [key]: [...current, optionId] };
      }

      const idx = current.lastIndexOf(optionId);
      if (idx === -1) return prev;
      return { ...prev, [key]: [...current.slice(0, idx), ...current.slice(idx + 1)] };
    });
  };

  const cambiarCantidadExtra = (groupId, optionId, delta) => {
    setSelectedToppings(prev => {
      const current = prev[groupId] || [];
      if (delta > 0) {
        const group = uniqueToppingGroups.find(g => g && g._id === groupId);
        if (group?.maxSelections && current.length >= group.maxSelections) return prev;
        if (current.filter(id => id === optionId).length >= TOPE_POR_OPCION) return prev;
        return { ...prev, [groupId]: [...current, optionId] };
      }
      const idx = current.lastIndexOf(optionId);
      if (idx === -1) return prev;
      return { ...prev, [groupId]: [...current.slice(0, idx), ...current.slice(idx + 1)] };
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
          /* Una entrada por unidad ("Carne extra ×3" son tres): así la cocina,
             las comandas y el cobro las cuentan sin saber de cantidades. El
             recargo del grupo y los subgrupos van solo en la primera, porque
             son del grupo y no de cada opción (ver precioDeOpciones). */
          groupSelections.forEach((optionId, i) => {
            const option = group.options?.find(o => o._id === optionId);
            result.push({
              groupName: group.name || 'Desconocido',
              optionName: option?.name || 'Desconocida',
              price: option?.price || 0,
              basePrice: i === 0 ? (group.basePrice || 0) : 0,
              subGroups: i === 0 && hasSubGroupSelections ? subGroupSelections : []
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

  function handleError(error) {
    console.error('Error en ProductToppingsSelector:', error);
    setError('Ha ocurrido un error al procesar las opciones');
  }

  // Función para validar toppings obligatorios
  function validateRequiredToppings() {
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
            return selectedToppings[`${group._id}_${subGroup._id}`] && 
                   selectedToppings[`${group._id}_${subGroup._id}`].length > 0;
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
            const subGroupKey = `${group._id}_${subGroup._id}`;
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
  }

  const handleAddToCart = () => {
    try {
      if (faltaElegir) {
        setError('Elige ' + ejes.map((e) => e.nombre.toLowerCase()).join(' y ') + ' antes de agregar');
        return;
      }
      if (sinStock) {
        setError('Esa combinación está agotada');
        return;
      }

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
              return selectedToppings[`${group._id}_${subGroup._id}`] && 
                     selectedToppings[`${group._id}_${subGroup._id}`].length > 0;
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
      const unitPrice = (Number(precioBase || 0) + (extraTotal || 0));
      const productToAdd = {
        ...product,
        selectedToppings: selectedToppingsData,
        quantity: quantity,
        totalPrice: unitPrice,
        ...(varianteElegida ? {
          // El precio de la variante manda sobre el del producto.
          price: precioBase,
          name: product.name + ' (' + varianteElegida.valores.join(' · ') + ')',
          variante: { valores: varianteElegida.valores, sku: varianteElegida.sku || '' }
        } : {})
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
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[130]"
        onMouseDown={handleBackdropPointerDown}
      >
        <div
          className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-2xl flex flex-col max-h-[90vh]"
          onClick={handleModalClick}
        >
          {/* Header: name + price + qty + close */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-slate-900 line-clamp-2">{product.name}</h2>
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
                      {group.isRequired && <span className="text-2xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Requerido</span>}
                      {Number(group.basePrice) > 0 && <span className="text-2xs font-bold text-emerald-600">+${group.basePrice?.toLocaleString()}</span>}
                      {countSelections(group) > 0 && (
                        <button onClick={(e) => clearGroupSelections(group._id, e)} className="text-2xs font-bold text-red-400 hover:text-red-600 transition-colors ml-auto">Limpiar</button>
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
                    {Array.isArray(group.subGroups) && group.subGroups.filter(s => s && s._id).map(subGroup => {
                      const subSelections = selectedToppings[`${group._id}_${subGroup._id}`] || [];
                      const atMax = subGroup.isMultipleChoice && subGroup.maxSelections > 0 && subSelections.length >= subGroup.maxSelections;
                      return (
                      <div key={subGroup._id} className="mt-2">
                        <span className="text-[11px] font-bold text-slate-400 mb-1.5 block">
                          {subGroup.title}
                          {subGroup.isMultipleChoice && subGroup.maxSelections > 0 && (
                            <span className={`ml-1.5 font-semibold ${atMax ? 'text-amber-500' : 'text-slate-300'}`}>
                              ({subSelections.length}/{subGroup.maxSelections})
                            </span>
                          )}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(subGroup.options) && subGroup.options.filter(o => o && o._id && o.active !== false).map(option => {
                            const count = subSelections.filter(id => id === option._id).length;
                            const isSelected = count > 0;

                            if (subGroup.allowRepeats) {
                              const canAdd = !atMax;
                              return (
                                <div
                                  key={option._id}
                                  className={`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl text-sm font-bold border-2 transition-all ${
                                    isSelected ? 'text-white shadow-md' : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                  style={isSelected ? { backgroundColor: themeBtn, borderColor: themeBtn } : undefined}
                                >
                                  <span>
                                    {option.name}
                                    {!isFreeOption(option.name) && Number(option.price) > 0 && (
                                      <span className={`ml-1 text-[11px] font-semibold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>+${option.price?.toLocaleString()}</span>
                                    )}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleRepeatCountChange(group._id, subGroup._id, option._id, -1)}
                                      disabled={count === 0}
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-colors ${
                                        count === 0 ? 'opacity-30 cursor-not-allowed' : isSelected ? 'bg-white/20 hover:bg-white/30' : 'bg-slate-100 hover:bg-slate-200'
                                      }`}
                                    >−</button>
                                    <span className="w-4 text-center tabular-nums">{count}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRepeatCountChange(group._id, subGroup._id, option._id, 1)}
                                      disabled={!canAdd}
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-colors ${
                                        !canAdd ? 'opacity-30 cursor-not-allowed' : isSelected ? 'bg-white/20 hover:bg-white/30' : 'bg-slate-100 hover:bg-slate-200'
                                      }`}
                                    >+</button>
                                  </div>
                                </div>
                              );
                            }

                            const disabled = atMax && !isSelected;
                            return (
                              <button
                                key={option._id}
                                onClick={() => !disabled && handleOptionChange(group._id, option._id, true, subGroup._id, !subGroup.isMultipleChoice)}
                                disabled={disabled}
                                className={`px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 border-2 ${
                                  isSelected ? 'text-white shadow-md' : disabled ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
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
                      );
                    })}
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

  /* Pesos colombianos sin decimales. */
  const pesosCO = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

  /* El color del negocio para textos (precios, "Ver más"). Un negocio de
     marca amarilla o clara pondría el precio ilegible sobre blanco: en ese
     caso el texto va en casi negro y el color queda para bordes y botón. */
  const colorLegible = (() => {
    const hex = String(themeBtn || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return '#0f172a';
    const [r, g, b] = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#0f172a' : themeBtn;
  })();

  /* "Elige tu bebida", no "Elige elige tu bebida": muchos grupos ya se llaman
     con el verbo, y se le quita antes de ponerlo. */
  const elegirQue = (nombre) => {
    const resto = String(nombre || '').trim().replace(/^elige\s+(tu|tus|el|la|los|las|un|una)?\s*/i, '');
    return `Elige ${resto || 'una opción'}`.toLowerCase().replace(/^e/, 'E');
  };

  /* El primer grupo obligatorio sin elegir, para que el botón diga qué falta. */
  const grupoPendiente = () => uniqueToppingGroups.find((group) => {
    if (!group?.isRequired) return false;
    const principal = (selectedToppings[group._id] || []).length > 0;
    const subOk = (group.subGroups || []).some((sg) => (selectedToppings[`${group._id}_${sg._id}`] || []).length > 0);
    return !principal && !subOk;
  });

  // ── Standard (menu) mode ──
  return (
    <>
    {/* ── Fullscreen image lightbox ── */}
    {imageExpanded && fotos[fotoActual] && (
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-md z-[140] flex items-center justify-center p-4"
        onClick={() => setImageExpanded(false)}
      >
        <button
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all flex items-center justify-center z-[141]"
          onClick={() => setImageExpanded(false)}
          aria-label="Cerrar imagen"
        >
          <X className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <img
          src={fotos[fotoActual]}
          alt={product.name}
          className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <p className="absolute bottom-6 left-0 right-0 text-center text-white/70 text-sm font-medium">{product.name}</p>
      </div>
    )}

      {/* La ficha de un producto.

          Pensada como la de los menús que mejor convierten: el nombre arriba
          y legible —no encima de la foto, sobre un degradado—, la foto entera
          con bordes redondeados, y cada grupo de opciones **abierto**, con
          casillas grandes y el precio de cada una en el color del negocio.
          Abajo, la cantidad y "Agregar · $total" juntos, que es donde está el
          pulgar.

          De la anterior se conserva lo que funcionaba: la galería que se
          desliza y se amplía, las opiniones, las tallas y colores de las
          tiendas, los subgrupos con máximo y repetibles, "GRATIS", y el aviso
          que lleva al grupo obligatorio que falta. */}
    {/* Los toques no deben subir hasta la tarjeta de atrás: allí un toque
        largo abre la vista previa del producto. */}
    <div onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
    <Hoja
      onCerrar={onClose}
      etiqueta={product.name}
      alto="completo"
      cabecera={
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <h2 className="flex-1 min-w-0 text-[22px] leading-tight font-black text-tinta tracking-tight">{product.name}</h2>
          {conFavoritos && (
            <button
              className="w-10 h-10 -mt-1 rounded-full flex items-center justify-center hover:bg-superficie-2 transition-colors flex-shrink-0"
              onClick={() => alternar(product._id)}
              aria-label={esFavorito(product._id) ? 'Quitar de mis favoritos' : 'Guardar en mis favoritos'}
              aria-pressed={esFavorito(product._id)}
            >
              <Heart
                className={`w-5 h-5 transition-transform active:scale-125 ${esFavorito(product._id) ? 'fill-red-500 text-red-500' : 'text-tinta-2'}`}
                strokeWidth={2.25}
              />
            </button>
          )}
          <button
            className="w-10 h-10 -mr-1.5 -mt-1 rounded-full flex items-center justify-center text-tinta-2 hover:bg-superficie-2 transition-colors flex-shrink-0"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" strokeWidth={2.25} />
          </button>
        </div>
      }
      pie={
        /* Cantidad y agregar, juntos y donde está el pulgar. */
        <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 border-t border-linea">
          <Cantidad valor={quantity} onCambiar={setQuantity} tamano="lg" />
          <Boton
            tamano="lg"
            mayusculas
            className={`flex-1 min-w-0 ${isValid && !faltaElegir && !sinStock ? 'shadow-flotante' : 'opacity-70'}`}
            onClick={handleAddToCart}
            disabled={sinStock}
            /* Mientras falta algo, el precio espera: el espacio es para decir qué falta. */
            final={isValid && !faltaElegir && !sinStock ? `· ${pesosCO(displayTotal + diferenciaVariante * quantity)}` : null}
          >
            {/* Si falta algo, el botón lo dice: tocarlo lleva al grupo que falta. */}
            {sinStock ? 'Agotado' : faltaElegir ? elegirQue(ejes.find((e, i) => !eleccion[i])?.nombre) : !isValid ? elegirQue(grupoPendiente()?.name) : 'Agregar'}
          </Boton>
        </div>
      }
    >
        <div className="px-5 pb-5">
          {/* La foto, entera y con bordes redondeados. Se desliza si hay varias
              y se amplía con el botón. */}
          {fotos.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl bg-slate-100">
              <div
                ref={carruselRef}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                onScroll={(e) => {
                  const ancho = e.currentTarget.clientWidth || 1;
                  setFotoActual(Math.round(e.currentTarget.scrollLeft / ancho));
                }}
              >
                {fotos.map((foto, i) => (
                  <img
                    key={foto + i}
                    src={foto}
                    alt={fotos.length > 1 ? `${product.name} · foto ${i + 1} de ${fotos.length}` : product.name}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    className="w-full flex-shrink-0 snap-center aspect-[4/3] object-cover"
                  />
                ))}
              </div>
              {fotos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/35 backdrop-blur-md">
                  {fotos.map((foto, i) => (
                    <span key={'punto-' + foto + i} className={`rounded-full transition-all ${i === fotoActual ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/55'}`} />
                  ))}
                </div>
              )}
              <button
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/35 backdrop-blur-md text-white flex items-center justify-center"
                onClick={() => setImageExpanded(true)}
                aria-label="Ampliar imagen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Precio y descripción */}
          <div className={fotos.length > 0 ? 'mt-4' : ''}>
            <p className="text-[17px] font-black tabular-nums" style={{ color: colorLegible }}>
              {pesosCO(precioBase)}
            </p>
            {product.description && (
              <div className="mt-1">
                <p className={`text-[15px] text-tinta-2 leading-relaxed ${expandedDesc ? '' : 'line-clamp-3'}`}>{product.description}</p>
                {product.description.length > 140 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedDesc(!expandedDesc); }}
                    className="text-[13px] font-bold mt-0.5"
                    style={{ color: colorLegible }}
                  >
                    {expandedDesc ? 'Ver menos' : 'Ver más'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Lo que dijo quien ya lo compró: decide la compra. */}
          {opiniones?.total > 0 && (
            <div className="mt-4 rounded-2xl border border-linea bg-superficie-2 p-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-black text-tinta tabular-nums">{opiniones.promedio}</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-3.5 h-3.5 ${opiniones.promedio >= n - 0.25 ? 'fill-yellow-400 text-yellow-400' : 'fill-slate-200 text-slate-200'}`} />
                  ))}
                </div>
                <span className="text-[12px] text-slate-400">{opiniones.total} {opiniones.total === 1 ? 'opinión' : 'opiniones'}</span>
              </div>
              {(opiniones.comentarios || []).slice(0, 2).map((c, i) => (
                <p key={i} className="mt-1.5 text-[13px] text-slate-600 leading-snug">
                  <span className="font-semibold text-slate-700">{c.nombre || 'Alguien'}:</span> “{c.texto}”
                </p>
              ))}
            </div>
          )}

          {/* Tiendas: talla, color, fragancia… antes que los extras. */}
          {ejes.map((eje, i) => (
            <section key={eje.nombre} className="mt-6">
              <Encabezado titulo={eje.nombre} nota={eleccion[i] ? eleccion[i] : 'Elige una'} obligatorio listo={Boolean(eleccion[i])} />
              <div className="flex flex-wrap gap-2">
                {eje.valores.map((valor) => {
                  const elegido = eleccion[i] === valor;
                  const hay = valorDisponible(i, valor);
                  return (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => elegirValor(i, valor)}
                      disabled={!hay && !elegido}
                      className={`min-w-[56px] h-11 px-4 rounded-full text-[14px] font-bold border-2 transition-all ${
                        hay || elegido ? '' : 'border-slate-100 text-slate-300 line-through cursor-not-allowed'
                      }`}
                      style={elegido
                        ? { borderColor: themeBtn, backgroundColor: `${themeBtn}14`, color: '#0f172a' }
                        : hay ? { borderColor: '#e2e8f0', color: '#334155' } : undefined}
                    >
                      {valor}
                    </button>
                  );
                })}
              </div>
              {i === ejes.length - 1 && varianteElegida && (
                <p className="mt-2 text-[12px] text-slate-400">
                  {!controlaStock ? 'Disponible' : Number(varianteElegida.stock) > 0
                    ? (Number(varianteElegida.stock) <= 5 ? `Quedan ${varianteElegida.stock}` : 'Disponible')
                    : 'Agotado'}
                  {varianteElegida.sku ? ` · ${varianteElegida.sku}` : ''}
                </p>
              )}
            </section>
          ))}

          {/* Los grupos de opciones, todos abiertos: plegados obligaban a
              tocar cada uno para descubrir qué había adentro. */}
          {uniqueToppingGroups.filter((g) => g && g._id).map((group) => {
            const seleccionadas = countSelections(group);
            const resaltado = scrollToRequired && group.isRequired && !(selectedToppings[group._id]?.length > 0);
            const gratisEnGrupo = (group.options || []).some((o) => isFreeOption(o.name));
            return (
              <section
                key={group._id}
                id={`group-${group._id}`}
                className={`mt-6 scroll-mt-4 transition-all ${resaltado ? 'rounded-2xl ring-2 ring-red-300 bg-red-50/50 p-3 -mx-3' : ''}`}
              >
                <Encabezado
                  titulo={group.name}
                  nota={[
                    group.isMultipleChoice
                      ? ((group.options || []).some((o) => repiteEnGrupo(group, o)) ? 'Pide las que quieras de cada una' : 'Puedes elegir varias')
                      : 'Elige una',
                    group.isMultipleChoice && group.maxSelections ? `máximo ${group.maxSelections}` : '',
                    Number(group.basePrice) > 0 ? `+${pesosCO(group.basePrice)}` : '',
                    gratisEnGrupo ? 'hay opciones gratis' : '',
                  ].filter(Boolean).join(' · ')}
                  obligatorio={group.isRequired}
                  listo={seleccionadas > 0}
                  onLimpiar={seleccionadas > 0 && !group.isRequired ? (e) => clearGroupSelections(group._id, e) : null}
                />

                <div className="space-y-2">
                  {(group.options || []).filter((o) => o && o._id && o.active !== false).map((option) => {
                    const elegidas = selectedToppings[group._id] || [];
                    if (repiteEnGrupo(group, option)) {
                      const count = elegidas.filter((id) => id === option._id).length;
                      const lleno = group.maxSelections && elegidas.length >= group.maxSelections;
                      return (
                        <Opcion
                          key={option._id}
                          nombre={option.name || 'Opción'}
                          imagen={option.image}
                          precio={Number(option.price) || 0}
                          gratis={isFreeOption(option.name)}
                          elegida={count > 0}
                          cantidad={count}
                          puedeSumar={!lleno && count < TOPE_POR_OPCION}
                          onMas={() => cambiarCantidadExtra(group._id, option._id, 1)}
                          onMenos={() => cambiarCantidadExtra(group._id, option._id, -1)}
                        />
                      );
                    }
                    return (
                      <Opcion
                        key={option._id}
                        nombre={option.name || 'Opción'}
                        imagen={option.image}
                        precio={Number(option.price) || 0}
                        gratis={isFreeOption(option.name)}
                        multiple={group.isMultipleChoice}
                        elegida={elegidas.includes(option._id)}
                        deshabilitada={!elegidas.includes(option._id) && !!group.maxSelections && elegidas.length >= group.maxSelections}
                        onTocar={() => handleOptionChange(group._id, option._id)}
                      />
                    );
                  })}
                </div>

                {(group.subGroups || []).filter((sg) => sg && sg._id).map((subGroup) => {
                  const subSelections = selectedToppings[`${group._id}_${subGroup._id}`] || [];
                  const atMax = subGroup.isMultipleChoice && subGroup.maxSelections > 0 && subSelections.length >= subGroup.maxSelections;
                  return (
                    <div key={subGroup._id} className="mt-4">
                      <p className="mb-2 text-[13px] font-bold text-slate-700">
                        {subGroup.title}
                        {subGroup.isMultipleChoice && subGroup.maxSelections > 0 && (
                          <span className={`ml-1.5 text-[12px] font-semibold ${atMax ? 'text-amber-600' : 'text-slate-400'}`}>
                            {subSelections.length} de {subGroup.maxSelections}
                          </span>
                        )}
                      </p>
                      <div className="space-y-2">
                        {(subGroup.options || []).filter((o) => o && o._id && o.active !== false).map((option) => {
                          const count = subSelections.filter((id) => id === option._id).length;
                          if (subGroup.allowRepeats) {
                            return (
                              <Opcion
                                key={option._id}
                                nombre={option.name || 'Opción'}
                                imagen={option.image}
                                precio={Number(option.price) || 0}
                                gratis={isFreeOption(option.name)}
                                elegida={count > 0}
                                cantidad={count}
                                puedeSumar={!atMax}
                                onMas={() => handleRepeatCountChange(group._id, subGroup._id, option._id, 1)}
                                onMenos={() => handleRepeatCountChange(group._id, subGroup._id, option._id, -1)}
                              />
                            );
                          }
                          const elegida = count > 0;
                          return (
                            <Opcion
                              key={option._id}
                              nombre={option.name || 'Opción'}
                              imagen={option.image}
                              precio={Number(option.price) || 0}
                              gratis={isFreeOption(option.name)}
                              multiple={subGroup.isMultipleChoice}
                              elegida={elegida}
                              deshabilitada={atMax && !elegida}
                              onTocar={() => handleOptionChange(group._id, option._id, true, subGroup._id, !subGroup.isMultipleChoice)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl">
              <AlertCircle className="w-4 h-4 text-peligro flex-shrink-0" />
              <p className="text-[14px] text-red-600">{error}</p>
            </div>
          )}
        </div>
    </Hoja>
    </div>
    </>
  );
}

export default ProductToppingsSelector;

/** El título de un grupo: en mayúsculas pequeñas, con lo que pide y su estado. */
function Encabezado({ titulo, nota, obligatorio, listo, onLimpiar }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-2.5">
      <div className="min-w-0">
        <h3 className="text-[13px] font-black uppercase tracking-[0.12em] text-slate-500">{titulo}</h3>
        {nota && <p className="text-[12.5px] text-slate-400 mt-0.5">{nota}</p>}
      </div>
      {obligatorio ? (
        <span className={`flex-shrink-0 text-[11.5px] font-bold px-2.5 py-1 rounded-full ${listo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {listo ? '✓ Listo' : 'Obligatorio'}
        </span>
      ) : onLimpiar ? (
        <button onClick={onLimpiar} className="flex-shrink-0 text-[12px] font-semibold text-slate-400 hover:text-slate-700">Quitar</button>
      ) : (
        <span className="flex-shrink-0 text-[12px] font-semibold text-slate-400">Opcional</span>
      )}
    </div>
  );
}

/**
 * Una opción: una casilla grande, a lo ancho, con el nombre en negrita, el
 * precio en el color del negocio y la marca a la derecha. Elegida, se tiñe
 * del color del negocio. Las repetibles llevan − y + en vez de la marca.
 */
function Opcion({ nombre, imagen, precio, gratis, multiple, elegida, deshabilitada, onTocar, cantidad, puedeSumar, onMas, onMenos }) {
  const { businessConfig } = useBusinessConfig();
  const color = businessConfig?.theme?.buttonColor || '#3B82F6';
  const repetible = typeof onMas === 'function';
  const precioTexto = gratis ? null : precio > 0 ? `+ $${Math.round(precio).toLocaleString('es-CO')}` : null;

  const contenido = (
    <>
      {imagen && <img src={imagen} alt="" loading="lazy" className="w-11 h-11 rounded-xl object-cover flex-shrink-0 bg-slate-100" />}
      <span className="flex-1 min-w-0 text-[15px] font-bold text-slate-900 leading-snug">{nombre}</span>
      {gratis && <span className="flex-shrink-0 text-[12px] font-black text-emerald-600">GRATIS</span>}
      {precioTexto && <span className="flex-shrink-0 text-[14px] font-black tabular-nums text-slate-700">{precioTexto}</span>}
    </>
  );

  const estilo = elegida
    ? { borderColor: color, backgroundColor: `${color}12` }
    : { borderColor: '#e2e8f0', backgroundColor: '#ffffff' };

  if (repetible) {
    /* En cero, solo "+" y la fila entera suma uno. Con más de uno, el
       subtotal de ese extra a la vista: "×3 · $15.000". */
    return (
      <div
        className="w-full min-h-[60px] flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 transition-colors"
        style={estilo}
        onClick={!cantidad && puedeSumar ? onMas : undefined}
        role={!cantidad ? 'button' : undefined}
      >
        {imagen && <img src={imagen} alt="" loading="lazy" className="w-11 h-11 rounded-xl object-cover flex-shrink-0 bg-slate-100" />}
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-slate-900 leading-snug">{nombre}</span>
          {gratis
            ? <span className="block text-[12px] font-black text-emerald-600">GRATIS</span>
            : precio > 0 && (
              <span className="block text-[13px] font-bold tabular-nums text-slate-600">
                + ${Math.round(precio).toLocaleString('es-CO')}
                {cantidad > 1 && <span className="text-slate-900"> · ×{cantidad} = ${Math.round(precio * cantidad).toLocaleString('es-CO')}</span>}
              </span>
            )}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {cantidad > 0 && (
            <>
              <button type="button" onClick={onMenos}
                className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-700 text-lg" aria-label={`Quitar un ${nombre}`}>−</button>
              <span className="w-7 text-center text-[16px] font-black tabular-nums" aria-live="polite">{cantidad}</span>
            </>
          )}
          <button type="button" onClick={onMas} disabled={!puedeSumar}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg disabled:opacity-30" style={{ backgroundColor: color }} aria-label={`Agregar un ${nombre}`}>+</button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onTocar}
      disabled={deshabilitada}
      aria-pressed={elegida}
      className="w-full min-h-[60px] flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 text-left transition-colors active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
      style={estilo}
    >
      {contenido}
      {/* Círculo si es una sola; cuadro si son varias. */}
      <span
        className={`w-6 h-6 flex-shrink-0 flex items-center justify-center border-2 ${multiple ? 'rounded-lg' : 'rounded-full'}`}
        style={elegida ? { borderColor: color, backgroundColor: multiple ? color : 'transparent' } : { borderColor: '#94a3b8' }}
      >
        {elegida && (multiple
          ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          : <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />)}
      </span>
    </button>
  );
}

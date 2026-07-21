import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheese, FaPlus, FaTrash, FaTag, FaAlignLeft, FaDollarSign, FaCog, FaListUl, FaExclamationTriangle, FaCheck, FaTimes, FaEdit, FaBoxOpen, FaSyncAlt, FaEye, FaEyeSlash, FaLayerGroup, FaImage } from 'react-icons/fa';
import ImageUploader from './Admin/ImageUploader';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/socket';

function ToppingGroupsManager() {
  const [toppingGroups, setToppingGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState({
    name: '',
    description: '',
    basePrice: 0,
    isMultipleChoice: false,
    isRequired: false,
    options: [],
    subGroups: []
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Qué opción tiene abierto el editor de foto: {kind:'opt', index} | {kind:'sub', si, oi}
  const [imageEditor, setImageEditor] = useState(null);
  const { businessId } = useBusinessConfig();

  useEffect(() => {
    fetchToppingGroups();
    // --- WebSocket: Conexión y listeners ---
    if (socket) {
      socket.connect();
      socket.emit('joinBusiness', businessId);
      socket.on('topping_groups_update', () => {
        fetchToppingGroups();
      });
    }
    return () => {
      if (socket) {
        socket.off('topping_groups_update');
      }
    };
    // --- Fin WebSocket ---
  }, [businessId]);

  const fetchToppingGroups = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/topping-groups?businessId=${businessId}`);
      
      const groupsWithSubGroups = response.data.map(group => ({
        ...group,
        basePrice: group.basePrice !== undefined ? Number(group.basePrice) : 0,
        subGroups: group.subGroups || []
      }));
      
      console.log('Grupos procesados en frontend:', groupsWithSubGroups.map(g => ({
        name: g.name,
        basePrice: g.basePrice,
        tipo: typeof g.basePrice
      })));
      
      setToppingGroups(groupsWithSubGroups);
      setError(null);
    } catch (err) {
      setError('Error al cargar los grupos de toppings');
      console.error('Error fetching topping groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const groupToSend = {
        ...currentGroup,
        basePrice: parseFloat(currentGroup.basePrice || 0),
        businessId
      };
      
      if (isEditing) {
        await api.put(`/topping-groups/${currentGroup._id}`, groupToSend);
      } else {
        await api.post('/topping-groups', groupToSend);
      }
      fetchToppingGroups();
      resetForm();
      setError(null); // Limpiar errores previos
    } catch (error) {
      console.error('Error al guardar el grupo de toppings:', error);
      
      // Mostrar mensaje de error específico
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else if (error.response?.data?.errors) {
        setError(`Errores de validación: ${error.response.data.errors.join(', ')}`);
      } else if (error.response?.status === 404) {
        setError('Grupo de toppings no encontrado');
      } else if (error.response?.status === 400) {
        setError('Datos inválidos. Por favor revisa la información');
      } else if (error.response?.status === 409) {
        setError('Ya existe un grupo con este nombre. Por favor usa un nombre diferente.');
      } else {
        setError('Error al guardar el grupo de toppings. Inténtalo de nuevo.');
      }
    }
  };

  const handleAddOption = () => {
    setCurrentGroup({
      ...currentGroup,
      options: [...currentGroup.options, { name: '', price: 0 }]
    });
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...currentGroup.options];
    if (field === 'price') {
      value = value === '' ? 0 : parseFloat(value);
    }
    newOptions[index] = { ...newOptions[index], [field]: value };
    setCurrentGroup({ ...currentGroup, options: newOptions });
  };

  const handleDeleteOption = (index) => {
    const newOptions = currentGroup.options.filter((_, i) => i !== index);
    setCurrentGroup({ ...currentGroup, options: newOptions });
  };

  const handleAddSubGroup = () => {
    setCurrentGroup({
      ...currentGroup,
      subGroups: [...currentGroup.subGroups, { title: '', options: [] }]
    });
  };

  const handleSubGroupTitleChange = (index, value) => {
    const newSubGroups = [...currentGroup.subGroups];
    newSubGroups[index] = { ...newSubGroups[index], title: value };
    setCurrentGroup({ ...currentGroup, subGroups: newSubGroups });
  };

  const handleAddSubGroupOption = (subGroupIndex) => {
    const newSubGroups = [...currentGroup.subGroups];
    newSubGroups[subGroupIndex].options = [
      ...newSubGroups[subGroupIndex].options,
      { name: '', price: 0 }
    ];
    setCurrentGroup({ ...currentGroup, subGroups: newSubGroups });
  };

  const handleSubGroupOptionChange = (subGroupIndex, optionIndex, field, value) => {
    const newSubGroups = [...currentGroup.subGroups];
    if (field === 'price') {
      value = value === '' ? 0 : parseFloat(value);
    }
    newSubGroups[subGroupIndex].options[optionIndex] = { 
      ...newSubGroups[subGroupIndex].options[optionIndex], 
      [field]: value 
    };
    setCurrentGroup({ ...currentGroup, subGroups: newSubGroups });
  };

  const handleDeleteSubGroupOption = (subGroupIndex, optionIndex) => {
    const newSubGroups = [...currentGroup.subGroups];
    newSubGroups[subGroupIndex].options = newSubGroups[subGroupIndex].options.filter(
      (_, i) => i !== optionIndex
    );
    setCurrentGroup({ ...currentGroup, subGroups: newSubGroups });
  };

  const handleDeleteSubGroup = (index) => {
    const newSubGroups = currentGroup.subGroups.filter((_, i) => i !== index);
    setCurrentGroup({ ...currentGroup, subGroups: newSubGroups });
  };

  const handleSubGroupPropertyChange = (subGroupIndex, property, value) => {
    setCurrentGroup(prev => {
      const updatedSubGroups = [...(prev.subGroups || [])];
      if (updatedSubGroups[subGroupIndex]) {
        updatedSubGroups[subGroupIndex] = { 
          ...updatedSubGroups[subGroupIndex], 
          [property]: value 
        };
      }
      return { ...prev, subGroups: updatedSubGroups };
    });
  };

  const resetForm = () => {
    setCurrentGroup({
      name: '',
      description: '',
      basePrice: 0,
      isMultipleChoice: false,
      isRequired: false,
      options: [],
      subGroups: []
    });
    setIsEditing(false);
  };

  const handleEdit = (group) => {
    const groupWithSubGroups = {
      ...group,
      subGroups: group.subGroups || []
    };
    setCurrentGroup(groupWithSubGroups);
    setIsEditing(true);
  };

  const handleToggleOption = async (groupId, optionId) => {
    try {
      await api.patch(`/topping-groups/${groupId}/options/${optionId}/toggle`);
      // Refrescar los grupos para mostrar el cambio
      fetchToppingGroups();
    } catch (error) {
      console.error('Error toggling option:', error);
      setError('Error al cambiar el estado de la opción');
    }
  };

  const handleDelete = async (groupId) => {
      try {
      await api.delete(`/topping-groups/${groupId}`);
      await fetchToppingGroups();
      } catch (error) {
      console.error('Error al eliminar grupo:', error);
      setError('Error al eliminar el grupo de toppings');
    }
  };

  // Fotos ya usadas en cualquier extra (guardados + el grupo que se edita ahora),
  // para reusarlas de un clic en vez de volver a subirlas.
  const usedImages = useMemo(() => {
    const set = new Set();
    const collect = (groups) => (groups || []).forEach(g => {
      (g.options || []).forEach(o => { if (o?.image) set.add(o.image); });
      (g.subGroups || []).forEach(sg => (sg?.options || []).forEach(o => { if (o?.image) set.add(o.image); }));
    });
    collect(toppingGroups);
    collect([currentGroup]);
    return Array.from(set);
  }, [toppingGroups, currentGroup]);

  // Galería para reusar una foto existente
  const ImageGallery = ({ current, onPick }) => {
    if (usedImages.length === 0) return null;
    return (
      <div className="mt-2">
        <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Reusar una foto ya usada</p>
        <div className="flex flex-wrap gap-1.5">
          {usedImages.map(url => (
            <button
              key={url}
              type="button"
              onClick={() => onPick(url)}
              className={`w-10 h-10 rounded-md overflow-hidden border-2 transition-all ${
                current === url ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300'
              }`}
              title="Usar esta foto"
            >
              <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Status messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 bg-red-50 text-red-700 text-xs font-medium flex items-center gap-2 rounded-lg border border-red-100"
          >
            <FaExclamationTriangle className="text-[10px] flex-shrink-0" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-400">
          <FaSyncAlt className="animate-spin mr-2 text-xs" /> Cargando extras...
        </div>
      ) : (
        <>
          {/* Create / Edit Form */}
          <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              {isEditing ? <FaEdit className="text-amber-500 text-sm" /> : <FaPlus className="text-blue-500 text-sm" />}
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  {isEditing ? 'Editar Grupo de Extras' : 'Nuevo Grupo de Extras'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isEditing ? 'Actualiza la información del grupo' : 'Crea un nuevo grupo de extras para tus productos'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                      <FaTag className="text-[10px] text-slate-400" /> Nombre del Grupo
                    </label>
                    <input
                      type="text"
                      value={currentGroup.name}
                      onChange={(e) => setCurrentGroup({ ...currentGroup, name: e.target.value })}
                      className="w-full rounded-xl lg:rounded-lg border border-slate-200 bg-white text-[14px] lg:text-sm text-slate-800 placeholder-slate-400 px-3 py-2.5 lg:py-2 focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-500/20 focus:border-transparent lg:focus:border-blue-400 transition-colors"
                      placeholder="Ej: Quesos, Salsas, Vegetales..."
                      required
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                      <FaAlignLeft className="text-[10px] text-slate-400" /> Descripción
                    </label>
                    <input
                      type="text"
                      value={currentGroup.description}
                      onChange={(e) => setCurrentGroup({ ...currentGroup, description: e.target.value })}
                      className="w-full rounded-xl lg:rounded-lg border border-slate-200 bg-white text-[14px] lg:text-sm text-slate-800 placeholder-slate-400 px-3 py-2.5 lg:py-2 focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-500/20 focus:border-transparent lg:focus:border-blue-400 transition-colors"
                      placeholder="Descripción opcional del grupo..."
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                      <FaDollarSign className="text-[10px] text-slate-400" /> Precio Base
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={currentGroup.basePrice || 0}
                        onChange={(e) => setCurrentGroup({
                          ...currentGroup,
                          basePrice: e.target.value === '' ? 0 : parseFloat(e.target.value)
                        })}
                        className="w-full rounded-xl lg:rounded-lg border border-slate-200 bg-white text-[14px] lg:text-sm text-slate-800 font-semibold pl-8 pr-3 py-2.5 lg:py-2 focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-500/20 focus:border-transparent lg:focus:border-blue-400 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Se aplica al seleccionar cualquier opción de este grupo</p>
                  </div>
                </div>

                {/* Right Column - Config */}
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                      <FaCog className="text-[10px] text-slate-400" /> Configuración
                    </h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                        <input
                          type="checkbox"
                          checked={currentGroup.isMultipleChoice}
                          onChange={(e) => setCurrentGroup({ ...currentGroup, isMultipleChoice: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-slate-700 block">Selección múltiple</span>
                          <span className="text-[11px] text-slate-400">Permite elegir varias opciones</span>
                        </div>
                      </label>
                      <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-red-300 transition-colors">
                        <input
                          type="checkbox"
                          checked={currentGroup.isRequired}
                          onChange={(e) => setCurrentGroup({ ...currentGroup, isRequired: e.target.checked })}
                          className="w-4 h-4 text-red-500 rounded border-slate-300 focus:ring-red-500"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-slate-700 block">Obligatorio</span>
                          <span className="text-[11px] text-slate-400">Debe elegir al menos una opción</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Options Section */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                  <FaListUl className="text-[10px] text-slate-400" /> Opciones del Grupo
                </h4>

                {currentGroup.options.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center bg-white rounded-lg border border-dashed border-slate-200">
                    <FaBoxOpen className="text-lg text-slate-300 mb-1" />
                    <p className="text-xs text-slate-500">Sin opciones agregadas</p>
                    <p className="text-[11px] text-slate-400">Agrega opciones para este grupo</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {currentGroup.options.map((option, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                        {/* Miniatura / botón de foto */}
                        <button
                          type="button"
                          onClick={() => setImageEditor(prev => (prev?.kind === 'opt' && prev.index === index) ? null : { kind: 'opt', index })}
                          className={`w-9 h-9 rounded-md border flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors ${
                            imageEditor?.kind === 'opt' && imageEditor.index === index ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300'
                          } bg-slate-50`}
                          title={option.image ? 'Cambiar foto' : 'Agregar foto'}
                        >
                          {option.image
                            ? <img src={option.image} alt="" className="w-full h-full object-cover" />
                            : <FaImage className="text-slate-300 text-xs" />}
                        </button>
                        <input
                          type="text"
                          value={option.name}
                          onChange={(e) => handleOptionChange(index, 'name', e.target.value)}
                          placeholder="Ej: Queso Cheddar..."
                          className="flex-1 min-w-0 rounded-md border border-slate-200 text-xs text-slate-800 placeholder-slate-400 px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                        />
                        <div className="relative w-24 flex-shrink-0">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400 text-[10px]">$</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={option.price}
                            onChange={(e) => handleOptionChange(index, 'price', e.target.value)}
                            placeholder="0"
                            className="w-full rounded-md border border-slate-200 text-xs text-slate-800 font-semibold pl-6 pr-2 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteOption(index)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                        >
                          <FaTimes className="text-[10px]" />
                        </button>

                        {imageEditor?.kind === 'opt' && imageEditor.index === index && (
                          <div className="w-full pt-2 mt-1 border-t border-slate-100">
                            <ImageUploader
                              value={option.image || ''}
                              onChange={(url) => handleOptionChange(index, 'image', url)}
                            />
                            <ImageGallery
                              current={option.image}
                              onPick={(url) => handleOptionChange(index, 'image', url)}
                            />
                            {option.image && (
                              <button
                                type="button"
                                onClick={() => handleOptionChange(index, 'image', '')}
                                className="mt-1.5 text-[11px] text-red-500 hover:text-red-600 font-medium"
                              >
                                Quitar foto
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="mt-2 w-full py-2 border border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <FaPlus className="text-[10px]" /> Agregar Opción
                </button>
              </div>

              {/* Subgroups Section */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                  <FaLayerGroup className="text-[10px] text-slate-400" /> Subgrupos
                </h4>

                {currentGroup.subGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center bg-white rounded-lg border border-dashed border-slate-200">
                    <FaBoxOpen className="text-lg text-slate-300 mb-1" />
                    <p className="text-xs text-slate-500">Sin subgrupos</p>
                    <p className="text-[11px] text-slate-400">Organiza mejor las opciones con subgrupos</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentGroup.subGroups.map((subGroup, subGroupIndex) => (
                      <div key={`subgroup-${subGroupIndex}`} className="bg-white rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={subGroup.title || ''}
                            onChange={(e) => handleSubGroupTitleChange(subGroupIndex, e.target.value)}
                            placeholder="Título del subgrupo"
                            className="flex-1 rounded-md border border-slate-200 text-xs text-slate-800 placeholder-slate-400 px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteSubGroup(subGroupIndex)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <FaTimes className="text-[10px]" />
                          </button>
                        </div>

                        <div className="flex gap-3 mb-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={subGroup.isMultipleChoice}
                              onChange={(e) => handleSubGroupPropertyChange(subGroupIndex, 'isMultipleChoice', e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-500 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <span className="text-[11px] text-slate-600">Múltiple</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={subGroup.isRequired}
                              onChange={(e) => handleSubGroupPropertyChange(subGroupIndex, 'isRequired', e.target.checked)}
                              className="w-3.5 h-3.5 text-red-500 rounded border-slate-300 focus:ring-red-500"
                            />
                            <span className="text-[11px] text-slate-600">Obligatorio</span>
                          </label>
                        </div>

                        <div className="pl-3 border-l-2 border-slate-200 space-y-1">
                          <p className="text-[11px] font-medium text-slate-500 mb-1">Opciones</p>
                          {subGroup.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setImageEditor(prev => (prev?.kind === 'sub' && prev.si === subGroupIndex && prev.oi === optionIndex) ? null : { kind: 'sub', si: subGroupIndex, oi: optionIndex })}
                                className={`w-8 h-8 rounded-md border flex items-center justify-center overflow-hidden flex-shrink-0 bg-slate-50 transition-colors ${
                                  imageEditor?.kind === 'sub' && imageEditor.si === subGroupIndex && imageEditor.oi === optionIndex
                                    ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300'
                                }`}
                                title={option.image ? 'Cambiar foto' : 'Agregar foto'}
                              >
                                {option.image
                                  ? <img src={option.image} alt="" className="w-full h-full object-cover" />
                                  : <FaImage className="text-slate-300 text-[10px]" />}
                              </button>
                              <input
                                type="text"
                                value={option.name}
                                onChange={(e) => handleSubGroupOptionChange(subGroupIndex, optionIndex, 'name', e.target.value)}
                                placeholder="Nombre"
                                className="flex-1 rounded-md border border-slate-200 text-xs text-slate-800 placeholder-slate-400 px-2 py-1 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                              />
                              <div className="relative w-20 flex-shrink-0">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400 text-[10px]">$</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={option.price}
                                  onChange={(e) => handleSubGroupOptionChange(subGroupIndex, optionIndex, 'price', e.target.value)}
                                  placeholder="0"
                                  className="w-full rounded-md border border-slate-200 text-xs text-slate-800 font-semibold pl-5 pr-1 py-1 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubGroupOption(subGroupIndex, optionIndex)}
                                className="p-1 text-red-400 hover:text-red-600 rounded transition-colors"
                              >
                                <FaTimes className="text-[9px]" />
                              </button>

                              {imageEditor?.kind === 'sub' && imageEditor.si === subGroupIndex && imageEditor.oi === optionIndex && (
                                <div className="w-full pt-2 mt-1 border-t border-slate-100">
                                  <ImageUploader
                                    value={option.image || ''}
                                    onChange={(url) => handleSubGroupOptionChange(subGroupIndex, optionIndex, 'image', url)}
                                  />
                                  <ImageGallery
                                    current={option.image}
                                    onPick={(url) => handleSubGroupOptionChange(subGroupIndex, optionIndex, 'image', url)}
                                  />
                                  {option.image && (
                                    <button
                                      type="button"
                                      onClick={() => handleSubGroupOptionChange(subGroupIndex, optionIndex, 'image', '')}
                                      className="mt-1.5 text-[11px] text-red-500 hover:text-red-600 font-medium"
                                    >
                                      Quitar foto
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleAddSubGroupOption(subGroupIndex)}
                            className="text-[11px] text-blue-500 hover:text-blue-600 font-medium mt-1"
                          >
                            + Agregar opción
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAddSubGroup}
                  className="mt-2 w-full py-2 border border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-purple-300 hover:text-purple-500 hover:bg-purple-50/50 transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <FaPlus className="text-[10px]" /> Agregar Subgrupo
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-2 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-red-500 lg:bg-blue-500 text-white py-2.5 lg:py-2 rounded-xl lg:rounded-lg hover:opacity-90 transition-colors text-[13px] lg:text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] lg:active:scale-100"
                >
                  {isEditing ? <FaEdit className="text-[10px]" /> : <FaPlus className="text-[10px]" />}
                  {isEditing ? 'Actualizar Grupo' : 'Crear Grupo'}
                </button>
              </div>
            </form>
          </div>

          {/* Existing Groups List */}
          <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <FaCheese className="text-amber-500 text-sm" />
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Grupos de Extras Existentes</h3>
                <p className="text-[11px] text-slate-500">Gestiona tus grupos de extras configurados</p>
              </div>
            </div>

            {toppingGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FaBoxOpen className="text-2xl text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 font-medium">Sin grupos de extras</p>
                <p className="text-xs text-slate-400 mt-1">Crea tu primer grupo para organizar los extras</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {toppingGroups.map((group) => (
                  <div key={group._id} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
                    {/* Group header row */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FaCheese className="text-amber-500 text-xs" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-800 truncate">{group.name}</h4>
                          {group.basePrice > 0 && (
                            <span className="text-[11px] text-emerald-600 font-medium">
                              ${group.basePrice.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(group)}
                          className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <FaEdit className="text-xs" />
                        </button>
                        <button
                          onClick={() => handleDelete(group._id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>

                    {group.description && (
                      <p className="text-[11px] text-slate-400 mb-1.5">{group.description}</p>
                    )}

                    {/* Badges */}
                    <div className="flex gap-1.5 mb-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        group.isMultipleChoice ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {group.isMultipleChoice ? 'Múltiple' : 'Única'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        group.isRequired ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {group.isRequired ? 'Obligatorio' : 'Opcional'}
                      </span>
                    </div>

                    {/* Main Options */}
                    {group.options && group.options.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Opciones</p>
                        <div className="space-y-0.5">
                          {group.options.map((option, idx) => (
                            <div key={idx} className={`flex items-center justify-between py-1 px-2 rounded text-xs ${
                              option.active !== false ? 'bg-slate-50' : 'bg-red-50/50 opacity-60'
                            }`}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`${option.active !== false ? 'text-slate-700' : 'text-red-500 line-through'} truncate`}>
                                  {option.name}
                                </span>
                                {option.active === false && (
                                  <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded flex-shrink-0">Agotado</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`font-semibold ${option.active !== false ? 'text-emerald-600' : 'text-red-400'}`}>
                                  ${option.price.toFixed(0)}
                                </span>
                                <button
                                  onClick={() => handleToggleOption(group._id, option._id)}
                                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                    option.active !== false
                                      ? 'text-emerald-500 hover:bg-emerald-50'
                                      : 'text-red-400 hover:bg-red-50'
                                  }`}
                                  title={option.active !== false ? 'Desactivar' : 'Activar'}
                                >
                                  {option.active !== false ? <FaEye className="text-[9px]" /> : <FaEyeSlash className="text-[9px]" />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Subgroups */}
                    {group.subGroups && group.subGroups.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Subgrupos</p>
                        <div className="space-y-1.5">
                          {group.subGroups.map((subGroup, idx) => (
                            <div key={`subgroup-${idx}`} className="bg-purple-50/50 rounded-lg p-2 border-l-2 border-purple-300">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-slate-700">{subGroup.title}</span>
                                <div className="flex gap-1">
                                  <span className="text-[9px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded">
                                    {subGroup.isMultipleChoice ? 'Múltiple' : 'Única'}
                                  </span>
                                  {subGroup.isRequired && (
                                    <span className="text-[9px] px-1 py-0.5 bg-red-100 text-red-600 rounded">Req</span>
                                  )}
                                </div>
                              </div>
                              {subGroup.options && subGroup.options.length > 0 && (
                                <div className="space-y-0.5">
                                  {subGroup.options.map((option, optIdx) => (
                                    <div key={`suboption-${optIdx}`} className={`flex items-center justify-between py-0.5 px-1.5 rounded text-[11px] ${
                                      option.active !== false ? 'bg-white' : 'bg-red-50/50 opacity-60'
                                    }`}>
                                      <div className="flex items-center gap-1 min-w-0">
                                        <span className="text-slate-300">•</span>
                                        <span className={`${option.active !== false ? 'text-slate-600' : 'text-red-500 line-through'} truncate`}>
                                          {option.name}
                                        </span>
                                        {option.active === false && (
                                          <span className="text-[8px] bg-red-100 text-red-600 px-1 rounded flex-shrink-0">Agotado</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className={`font-semibold ${option.active !== false ? 'text-emerald-600' : 'text-red-400'}`}>
                                          ${option.price.toFixed(0)}
                                        </span>
                                        <button
                                          onClick={() => handleToggleOption(group._id, option._id)}
                                          className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                                            option.active !== false
                                              ? 'text-emerald-500 hover:bg-emerald-50'
                                              : 'text-red-400 hover:bg-red-50'
                                          }`}
                                          title={option.active !== false ? 'Desactivar' : 'Activar'}
                                        >
                                          {option.active !== false ? <FaEye className="text-[8px]" /> : <FaEyeSlash className="text-[8px]" />}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ToppingGroupsManager;
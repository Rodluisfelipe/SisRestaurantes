import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const { businessId } = useBusinessConfig();

  useEffect(() => {
    fetchToppingGroups();
    // --- WebSocket: Conexión y listeners ---
    socket.connect();
    socket.emit('joinBusiness', businessId);
    socket.on('topping_groups_update', () => {
      fetchToppingGroups();
    });
    return () => {
      socket.emit('leaveBusiness', businessId);
      socket.off('topping_groups_update');
      socket.disconnect();
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
    } catch (error) {
      console.error('Error al guardar el grupo de toppings:', error);
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

  const handleDelete = async (groupId) => {
      try {
      await api.delete(`/topping-groups/${groupId}`);
      await fetchToppingGroups();
      } catch (error) {
      console.error('Error al eliminar grupo:', error);
      setError('Error al eliminar el grupo de toppings');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-2xl">🧀</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Gestión de Extras</h2>
        <p className="text-slate-600">Configura grupos de extras y complementos para tus productos</p>
      </motion.div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-2xl flex items-center space-x-3"
          >
            <span className="text-xl">❌</span>
            <span className="font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* Modern Form */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl p-8 border border-slate-200/50"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-2xl">{isEditing ? '✏️' : '✨'}</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                {isEditing ? 'Editar Grupo de Extras' : 'Nuevo Grupo de Extras'}
              </h3>
              <p className="text-slate-600">
                {isEditing ? 'Actualiza la información del grupo' : 'Crea un nuevo grupo de extras para tus productos'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Group Name */}
                  <div className="group">
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                      <span className="mr-2">🏷️</span>
                      Nombre del Grupo
                    </label>
            <input
              type="text"
              value={currentGroup.name}
              onChange={(e) => setCurrentGroup({ ...currentGroup, name: e.target.value })}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 text-lg transition-all duration-200 group-hover:border-slate-300"
                      placeholder="Ej: Quesos, Salsas, Vegetales..."
              required
            />
          </div>

                  {/* Description */}
                  <div className="group">
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                      <span className="mr-2">📝</span>
                      Descripción
                    </label>
            <input
              type="text"
              value={currentGroup.description}
              onChange={(e) => setCurrentGroup({ ...currentGroup, description: e.target.value })}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300"
                      placeholder="Descripción opcional del grupo..."
            />
          </div>

                  {/* Base Price */}
                  <div className="group">
                    <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                      <span className="mr-2">💰</span>
                      Precio Base
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4">
                        <span className="text-slate-500 font-medium">$</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentGroup.basePrice || 0}
                    onChange={(e) => setCurrentGroup({
                      ...currentGroup,
                      basePrice: e.target.value === '' ? 0 : parseFloat(e.target.value)
                    })}
                        className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 pl-12 pr-6 py-4 text-lg font-semibold transition-all duration-200 group-hover:border-slate-300"
                    placeholder="0.00"
                  />
                    </div>
                    <p className="mt-2 text-sm text-slate-500 flex items-center">
                      <span className="mr-1">💡</span>
                      Este precio se aplicará al seleccionar cualquier opción de este grupo
                    </p>
                  </div>
          </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Options */}
                  <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200">
                    <h4 className="flex items-center text-lg font-bold text-slate-900 mb-4">
                      <span className="mr-2">⚙️</span>
                      Configuración
                    </h4>
                    
                    <div className="space-y-4">
                      <div className="flex items-center p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors">
              <input
                type="checkbox"
                checked={currentGroup.isMultipleChoice}
                onChange={(e) => setCurrentGroup({ ...currentGroup, isMultipleChoice: e.target.checked })}
                          className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="ml-4">
                          <label className="text-sm font-semibold text-slate-900">Selección múltiple</label>
                          <p className="text-xs text-slate-500">Permite elegir varias opciones del grupo</p>
                        </div>
                        <span className="ml-auto text-xl">📋</span>
            </div>

                      <div className="flex items-center p-4 bg-white rounded-2xl border border-slate-200 hover:border-red-300 transition-colors">
              <input
                type="checkbox"
                checked={currentGroup.isRequired}
                onChange={(e) => setCurrentGroup({ ...currentGroup, isRequired: e.target.checked })}
                          className="w-5 h-5 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                        />
                        <div className="ml-4">
                          <label className="text-sm font-semibold text-slate-900">Obligatorio</label>
                          <p className="text-xs text-slate-500">El cliente debe elegir al menos una opción</p>
                        </div>
                        <span className="ml-auto text-xl">⚠️</span>
                      </div>
                    </div>
                  </div>
            </div>
          </div>

              {/* Modern Options Section */}
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200">
                  <h4 className="flex items-center text-lg font-bold text-slate-900 mb-4">
                    <span className="mr-2">🍟</span>
                    Opciones del Grupo
                  </h4>
                  
                  <div className="space-y-4">
                    {currentGroup.options.length === 0 ? (
                      <div className="text-center py-8 bg-white rounded-2xl border-2 border-dashed border-blue-300">
                        <span className="text-3xl mb-2 block">🍽️</span>
                        <p className="text-slate-600">No hay opciones agregadas</p>
                        <p className="text-sm text-slate-500">Agrega opciones para este grupo de extras</p>
                      </div>
                    ) : (
                      currentGroup.options.map((option, index) => (
                        <motion.div 
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex gap-3 p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors group"
                        >
                          <div className="flex-1">
                            <input
                              type="text"
                              value={option.name}
                              onChange={(e) => handleOptionChange(index, 'name', e.target.value)}
                              placeholder="Ej: Queso Cheddar, Salsa BBQ..."
                              className="w-full rounded-xl border-2 border-slate-200 bg-white/80 shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-4 py-3 transition-all duration-200"
                            />
                          </div>
                          <div className="w-32">
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <span className="text-slate-500 text-sm">$</span>
                              </div>
                              <input
                                type="number"
                                value={option.price}
                                onChange={(e) => handleOptionChange(index, 'price', e.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-xl border-2 border-slate-200 bg-white/80 shadow-sm focus:ring-4 focus:ring-green-500/20 focus:border-green-500 text-slate-900 placeholder-slate-400 pl-8 pr-3 py-3 font-semibold transition-all duration-200"
                              />
                            </div>
                          </div>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteOption(index)}
                            className="w-12 h-12 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl transition-colors flex items-center justify-center"
                          >
                            <span className="text-lg">🗑️</span>
                          </motion.button>
                        </motion.div>
                      ))
                    )}
                    
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAddOption}
                      className="w-full py-4 border-2 border-dashed border-blue-300 text-blue-600 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 font-semibold flex items-center justify-center space-x-2"
                    >
                      <span className="text-xl">➕</span>
                      <span>Agregar Opción</span>
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Modern Subgroups Section */}
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                  <h4 className="flex items-center text-lg font-bold text-slate-900 mb-4">
                    <span className="mr-2">🎯</span>
                    Subgrupos
                  </h4>
                  
                  <div className="space-y-4">
                    {currentGroup.subGroups.length === 0 ? (
                      <div className="text-center py-8 bg-white rounded-2xl border-2 border-dashed border-purple-300">
                        <span className="text-3xl mb-2 block">📋</span>
                        <p className="text-slate-600">No hay subgrupos creados</p>
                        <p className="text-sm text-slate-500">Los subgrupos te permiten organizar mejor las opciones</p>
                      </div>
                    ) : (
                      currentGroup.subGroups.map((subGroup, subGroupIndex) => (
                  <div key={`subgroup-${subGroupIndex}`} className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <input
                        type="text"
                        value={subGroup.title || ''}
                        onChange={(e) => handleSubGroupTitleChange(subGroupIndex, e.target.value)}
                        placeholder="Título del subgrupo"
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteSubGroup(subGroupIndex)}
                        className="ml-2 p-1 text-red-600 hover:text-red-800 bg-white rounded-full"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Controles para selección única/múltiple y obligatoriedad */}
                    <div className="flex gap-4 mb-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={subGroup.isMultipleChoice}
                          onChange={(e) => handleSubGroupPropertyChange(subGroupIndex, 'isMultipleChoice', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label className="ml-2 text-sm text-gray-700">Selección múltiple</label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={subGroup.isRequired}
                          onChange={(e) => handleSubGroupPropertyChange(subGroupIndex, 'isRequired', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label className="ml-2 text-sm text-gray-700">Obligatorio</label>
                      </div>
                    </div>
                    
                    {/* Opciones del subgrupo */}
                    <div className="pl-4 border-l-2 border-gray-300">
                      <p className="text-sm font-medium text-gray-700 mb-2">Opciones</p>
                      {subGroup.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={option.name}
                            onChange={(e) => handleSubGroupOptionChange(subGroupIndex, optionIndex, 'name', e.target.value)}
                            placeholder="Nombre de la opción"
                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            value={option.price}
                            onChange={(e) => handleSubGroupOptionChange(subGroupIndex, optionIndex, 'price', e.target.value)}
                            placeholder="Precio"
                            className="w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteSubGroupOption(subGroupIndex, optionIndex)}
                            className="p-2 text-red-600 hover:text-red-800"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleAddSubGroupOption(subGroupIndex)}
                        className="mt-1 px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        + Agregar opción
                      </button>
                    </div>
                  </div>
                      ))
                    )}
                    
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAddSubGroup}
                      className="w-full py-4 border-2 border-dashed border-purple-300 text-purple-600 rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 font-semibold flex items-center justify-center space-x-2"
                    >
                      <span className="text-xl">➕</span>
                      <span>Agregar Subgrupo</span>
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center space-x-4 pt-8 border-t border-slate-200">
                {isEditing && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={resetForm}
                    className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-2xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 font-semibold flex items-center space-x-2 shadow-lg"
                  >
                    <span>❌</span>
                    <span>Cancelar</span>
                  </motion.button>
                )}
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-semibold shadow-xl flex items-center space-x-2"
                >
                  <span>{isEditing ? '✏️' : '✨'}</span>
                  <span>{isEditing ? 'Actualizar' : 'Crear'} Grupo</span>
                </motion.button>
              </div>
            </form>
          </motion.div>

          {/* Modern Groups List */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Grupos de Extras Existentes</h3>
              <p className="text-slate-600">Gestiona tus grupos de extras configurados</p>
            </div>
            
            {toppingGroups.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl border-2 border-dashed border-slate-300"
              >
                <span className="text-4xl mb-4 block">🧀</span>
                <h4 className="text-xl font-semibold text-slate-700 mb-2">No hay grupos de extras</h4>
                <p className="text-slate-500">Crea tu primer grupo para organizar los extras de tus productos</p>
              </motion.div>
            ) : (
              <div className="grid gap-6">
                {toppingGroups.map((group, index) => (
                  <motion.div
                    key={group._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="group bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-lg border border-slate-200/50 overflow-hidden hover:shadow-xl transition-all duration-300"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-xl">🧀</span>
                          </div>
                          <div>
                            <h4 className="text-xl font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                              {group.name}
                            </h4>
                            {group.basePrice > 0 && (
                              <div className="flex items-center space-x-1 mt-1">
                                <span className="text-sm text-green-600 font-semibold">💰 Precio base:</span>
                                <span className="text-sm font-bold text-green-700">${group.basePrice.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleEdit(group)}
                            className="w-10 h-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl transition-colors flex items-center justify-center"
                          >
                            <span className="text-lg">✏️</span>
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDelete(group._id)}
                            className="w-10 h-10 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl transition-colors flex items-center justify-center"
                          >
                            <span className="text-lg">🗑️</span>
                          </motion.button>
                        </div>
                      </div>

                      {group.description && (
                        <p className="text-slate-600 mb-4 leading-relaxed">{group.description}</p>
                      )}
                      
                      {/* Configuration Badges */}
                      <div className="flex gap-2 mb-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          group.isMultipleChoice 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {group.isMultipleChoice ? '📋 Selección múltiple' : '🎯 Selección única'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          group.isRequired 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {group.isRequired ? '⚠️ Obligatorio' : '🔄 Opcional'}
                        </span>
                      </div>
                      
                      {/* Main Options */}
                      {group.options && group.options.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-semibold text-slate-700 mb-2 flex items-center">
                            <span className="mr-1">🍟</span>
                            Opciones principales:
                          </h5>
                          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                            {group.options.map((option, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1">
                                <span className="text-sm text-slate-700">{option.name}</span>
                                <span className="text-sm font-semibold text-green-600">${option.price.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Subgroups */}
                      {group.subGroups && group.subGroups.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold text-slate-700 mb-2 flex items-center">
                            <span className="mr-1">🎯</span>
                            Subgrupos:
                          </h5>
                          <div className="space-y-3">
                            {group.subGroups.map((subGroup, idx) => (
                              <div key={`subgroup-${idx}`} className="bg-purple-50 rounded-2xl p-4 border-l-4 border-purple-400">
                                <div className="flex items-center justify-between mb-2">
                                  <h6 className="font-medium text-slate-900">{subGroup.title}</h6>
                                  <div className="flex space-x-1">
                                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                                      {subGroup.isMultipleChoice ? 'Múltiple' : 'Única'}
                                    </span>
                                    {subGroup.isRequired && (
                                      <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                                        Obligatorio
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {subGroup.options && subGroup.options.length > 0 && (
                                  <div className="space-y-1">
                                    {subGroup.options.map((option, optIdx) => (
                                      <div key={`suboption-${optIdx}`} className="flex justify-between items-center py-1 text-sm">
                                        <span className="text-slate-600">• {option.name}</span>
                                        <span className="font-semibold text-green-600">${option.price.toFixed(2)}</span>
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
                    
                    {/* Hover Effect Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}

export default ToppingGroupsManager; 
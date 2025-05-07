import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import { socket } from '../services/api';

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

  if (error) {
    return (
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 animate-fade-in">
        {error}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></span>
        <span className="text-gray-600 text-lg font-semibold animate-pulse">Cargando grupos de toppings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">Gestión de Toppings</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre del grupo</label>
            <input
              type="text"
              value={currentGroup.name}
              onChange={(e) => setCurrentGroup({ ...currentGroup, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Descripción</label>
            <input
              type="text"
              value={currentGroup.description}
              onChange={(e) => setCurrentGroup({ ...currentGroup, description: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

              {/* Precio base del grupo */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Precio Base</label>
                <div className="relative mt-1 rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
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
                    className="pl-7 block w-full rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Este precio se aplicará al seleccionar cualquier opción de este grupo</p>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={currentGroup.isMultipleChoice}
                onChange={(e) => setCurrentGroup({ ...currentGroup, isMultipleChoice: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm text-gray-700">Selección múltiple</label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={currentGroup.isRequired}
                onChange={(e) => setCurrentGroup({ ...currentGroup, isRequired: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm text-gray-700">Obligatorio</label>
            </div>
          </div>

              {/* Opciones principales */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Opciones</label>
            {currentGroup.options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={option.name}
                  onChange={(e) => handleOptionChange(index, 'name', e.target.value)}
                  placeholder="Nombre de la opción"
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <input
                  type="number"
                  value={option.price}
                      onChange={(e) => handleOptionChange(index, 'price', e.target.value)}
                  placeholder="Precio"
                  className="w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteOption(index)}
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
              onClick={handleAddOption}
              className="mt-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              + Agregar opción
            </button>
          </div>

              {/* Subgrupos */}
              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium text-lg mb-2">Subgrupos</h3>
                {currentGroup.subGroups.map((subGroup, subGroupIndex) => (
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
                ))}
                <button
                  type="button"
                  onClick={handleAddSubGroup}
                  className="mt-2 px-4 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  + Agregar subgrupo
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {isEditing ? 'Actualizar' : 'Crear'} Grupo
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </form>

          {/* Lista de grupos existentes */}
      <div className="space-y-4">
            <h3 className="text-xl font-semibold">Grupos de Toppings</h3>
            {toppingGroups.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-lg">
                No hay grupos de toppings disponibles.
              </div>
            ) : (
              toppingGroups.map((group) => (
          <div key={group._id} className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                      <h4 className="font-medium">
                        {group.name}
                        {group.basePrice > 0 && ` • Precio base: $${group.basePrice.toFixed(2)}`}
                      </h4>
                      <p className="text-sm text-gray-600">{group.description}</p>
                      
                      {/* Características del grupo */}
                      <div className="flex gap-2 text-xs mt-1">
                        <span className={`px-2 py-0.5 rounded-full ${group.isMultipleChoice ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                          {group.isMultipleChoice ? 'Selección múltiple' : 'Selección única'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full ${group.isRequired ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          {group.isRequired ? 'Obligatorio' : 'Opcional'}
                        </span>
                      </div>
                      
                      {/* Opciones principales */}
                      <div className="mt-2">
                        <p className="text-sm font-medium">Opciones principales:</p>
                        <ul className="pl-4 text-sm">
                          {group.options.map((option, index) => (
                            <li key={index} className="flex justify-between">
                              <span>{option.name}</span>
                              <span>${option.price.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Subgrupos */}
                      {group.subGroups && group.subGroups.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium">Subgrupos:</p>
                          {group.subGroups.map((subGroup, index) => (
                            <div key={`subgroup-${index}`} className="ml-2 mt-1 pl-2 border-l-2 border-gray-200">
                              <p className="text-sm font-medium">
                                {subGroup.title}
                                <span className="text-xs ml-2">
                                  {subGroup.isMultipleChoice ? '(Múltiple)' : '(Única)'}
                                  {subGroup.isRequired ? ', Obligatorio' : ''}
                                </span>
                              </p>
                              <ul className="pl-4 text-sm">
                                {subGroup.options && subGroup.options.map((option, idx) => (
                                  <li key={`suboption-${idx}`} className="flex justify-between">
                                    <span>{option.name}</span>
                                    <span>${option.price.toFixed(2)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                </div>
                      )}
              </div>
                    
                    <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(group)}
                        className="p-2 text-blue-600 hover:text-blue-800"
                >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                </button>
                <button
                  onClick={() => handleDelete(group._id)}
                        className="p-2 text-red-600 hover:text-red-800"
                >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                </button>
              </div>
            </div>
            </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ToppingGroupsManager;
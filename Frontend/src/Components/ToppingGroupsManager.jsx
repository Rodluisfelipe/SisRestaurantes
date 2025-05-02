import React, { useState, useEffect } from 'react';
import api from '../services/api';

function ToppingGroupsManager() {
  const [toppingGroups, setToppingGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState({
    name: '',
    description: '',
    isMultipleChoice: false,
    isRequired: false,
    options: []
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchToppingGroups();
  }, []);

  const fetchToppingGroups = async () => {
    try {
      const response = await api.get('/topping-groups');
      setToppingGroups(response.data);
    } catch (error) {
      console.error('Error al cargar los grupos de toppings:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.put(`/topping-groups/${currentGroup._id}`, currentGroup);
      } else {
        await api.post('/topping-groups', currentGroup);
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

  const resetForm = () => {
    setCurrentGroup({
      name: '',
      description: '',
      isMultipleChoice: false,
      isRequired: false,
      options: []
    });
    setIsEditing(false);
  };

  const handleEdit = (group) => {
    setCurrentGroup(group);
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este grupo?')) {
      try {
        await api.delete(`/topping-groups/${id}`);
        fetchToppingGroups();
      } catch (error) {
        console.error('Error al eliminar el grupo:', error);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">Gestión de Toppings</h2>

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

          {/* Opciones */}
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
                  onChange={(e) => handleOptionChange(index, 'price', parseFloat(e.target.value))}
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

      {/* Lista de grupos */}
      <div className="space-y-4">
        {toppingGroups.map((group) => (
          <div key={group._id} className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{group.name}</h3>
                <p className="text-sm text-gray-500">{group.description}</p>
                <div className="mt-1 text-sm text-gray-500">
                  {group.isMultipleChoice ? 'Selección múltiple' : 'Selección única'} •
                  {group.isRequired ? ' Obligatorio' : ' Opcional'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(group)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(group._id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Eliminar
                </button>
              </div>
            </div>
            <div className="mt-2">
              <h4 className="text-sm font-medium text-gray-700">Opciones:</h4>
              <ul className="mt-1 space-y-1">
                {group.options.map((option, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    {option.name} {option.price > 0 ? `(+$${option.price})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ToppingGroupsManager; 
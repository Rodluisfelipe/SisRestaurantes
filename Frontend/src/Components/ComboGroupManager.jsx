import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';

export default function ComboGroupManager() {
  const [comboGroups, setComboGroups] = useState([]);
  const [currentCombo, setCurrentCombo] = useState({
    name: '',
    basePrice: 0,
    description: '',
    subGroups: []
  });
  const [showComboForm, setShowComboForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    loadComboGroups();
  }, []);

  const loadComboGroups = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_ENDPOINTS.COMBO_GROUPS}`);
      setComboGroups(response.data);
    } catch (error) {
      console.error('Error al cargar combos:', error);
      setError('Error al cargar combos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubGroup = () => {
    setCurrentCombo(prev => ({
      ...prev,
      subGroups: [...prev.subGroups, {
        name: '',
        isRequired: true,
        isMultipleChoice: false,
        maxSelections: 1,
        options: []
      }]
    }));
  };

  const handleAddOption = (subGroupIndex) => {
    const newSubGroups = [...currentCombo.subGroups];
    newSubGroups[subGroupIndex].options.push({
      name: '',
      additionalPrice: 0,
      available: true
    });
    setCurrentCombo({ ...currentCombo, subGroups: newSubGroups });
  };

  const handleSubGroupChange = (index, field, value) => {
    const newSubGroups = [...currentCombo.subGroups];
    newSubGroups[index][field] = value;
    setCurrentCombo({ ...currentCombo, subGroups: newSubGroups });
  };

  const handleOptionChange = (subGroupIndex, optionIndex, field, value) => {
    const newSubGroups = [...currentCombo.subGroups];
    newSubGroups[subGroupIndex].options[optionIndex][field] = value;
    setCurrentCombo({ ...currentCombo, subGroups: newSubGroups });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentCombo._id) {
        await axios.patch(`${API_ENDPOINTS.COMBO_GROUPS}/${currentCombo._id}`, currentCombo);
        setSuccessMessage('Combo actualizado exitosamente');
      } else {
        await axios.post(API_ENDPOINTS.COMBO_GROUPS, currentCombo);
        setSuccessMessage('Combo creado exitosamente');
      }
      loadComboGroups();
      setShowComboForm(false);
      setCurrentCombo({
        name: '',
        basePrice: 0,
        description: '',
        subGroups: []
      });
    } catch (error) {
      console.error('Error al guardar combo:', error);
      setError('Error al guardar combo');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></span>
        <span className="text-gray-600 text-lg font-semibold animate-pulse">Cargando combos...</span>
      </div>
    );
  }

  return (
    <div className="p-4">
      {error && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 animate-fade-in">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg z-50 animate-fade-in">
          {successMessage}
        </div>
      )}
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Gestión de Combos</h2>
        <button
          onClick={() => setShowComboForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Nuevo Combo
        </button>
      </div>

      {showComboForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {currentCombo._id ? 'Editar Combo' : 'Nuevo Combo'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Información básica del combo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Nombre del Combo</label>
                  <input
                    type="text"
                    value={currentCombo.name}
                    onChange={(e) => setCurrentCombo({...currentCombo, name: e.target.value})}
                    className="w-full border p-2 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">Precio Base</label>
                  <input
                    type="number"
                    value={currentCombo.basePrice}
                    onChange={(e) => setCurrentCombo({...currentCombo, basePrice: parseFloat(e.target.value)})}
                    className="w-full border p-2 rounded"
                    required
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1">Descripción</label>
                <textarea
                  value={currentCombo.description}
                  onChange={(e) => setCurrentCombo({...currentCombo, description: e.target.value})}
                  className="w-full border p-2 rounded"
                  rows="2"
                />
              </div>

              {/* Sección de Subgrupos */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold">Subgrupos</h4>
                  <button
                    type="button"
                    onClick={handleAddSubGroup}
                    className="bg-green-500 text-white px-3 py-1 rounded"
                  >
                    Agregar Subgrupo
                  </button>
                </div>

                {currentCombo.subGroups.map((subGroup, subGroupIndex) => (
                  <div key={subGroupIndex} className="border p-4 rounded mb-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block mb-1">Nombre del Subgrupo</label>
                        <input
                          type="text"
                          value={subGroup.name}
                          onChange={(e) => handleSubGroupChange(subGroupIndex, 'name', e.target.value)}
                          className="w-full border p-2 rounded"
                          required
                        />
                      </div>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={subGroup.isRequired}
                            onChange={(e) => handleSubGroupChange(subGroupIndex, 'isRequired', e.target.checked)}
                            className="mr-2"
                          />
                          Obligatorio
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={subGroup.isMultipleChoice}
                            onChange={(e) => handleSubGroupChange(subGroupIndex, 'isMultipleChoice', e.target.checked)}
                            className="mr-2"
                          />
                          Selección Múltiple
                        </label>
                      </div>
                    </div>

                    {subGroup.isMultipleChoice && (
                      <div className="mb-4">
                        <label className="block mb-1">Máximo de Selecciones</label>
                        <input
                          type="number"
                          value={subGroup.maxSelections}
                          onChange={(e) => handleSubGroupChange(subGroupIndex, 'maxSelections', parseInt(e.target.value))}
                          className="w-full border p-2 rounded"
                          min="1"
                        />
                      </div>
                    )}

                    {/* Opciones del Subgrupo */}
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-medium">Opciones</h5>
                        <button
                          type="button"
                          onClick={() => handleAddOption(subGroupIndex)}
                          className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                        >
                          Agregar Opción
                        </button>
                      </div>

                      {subGroup.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="grid grid-cols-2 gap-4 mb-2">
                          <input
                            type="text"
                            value={option.name}
                            onChange={(e) => handleOptionChange(subGroupIndex, optionIndex, 'name', e.target.value)}
                            placeholder="Nombre de la opción"
                            className="border p-2 rounded"
                            required
                          />
                          <input
                            type="number"
                            value={option.additionalPrice}
                            onChange={(e) => handleOptionChange(subGroupIndex, optionIndex, 'additionalPrice', parseFloat(e.target.value))}
                            placeholder="Precio adicional"
                            className="border p-2 rounded"
                            step="0.01"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowComboForm(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                  Guardar Combo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de Combos Existentes */}
      <div className="mt-8">
        {comboGroups.length === 0 && (
          <div className="text-center text-gray-400 py-8 text-lg">
            No hay combos registrados aún.
          </div>
        )}
        {comboGroups.map(combo => (
          <div key={combo._id} className="border p-4 rounded mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">{combo.name}</h3>
                <p className="text-gray-600">{combo.description}</p>
                <p className="font-semibold">Precio Base: ${combo.basePrice}</p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => {
                    setCurrentCombo(combo);
                    setShowComboForm(true);
                  }}
                  className="bg-yellow-500 text-white px-3 py-1 rounded"
                >
                  Editar
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm('¿Estás seguro de eliminar este combo?')) {
                      await axios.delete(`${API_ENDPOINTS.COMBO_GROUPS}/${combo._id}`);
                      loadComboGroups();
                    }
                  }}
                  className="bg-red-500 text-white px-3 py-1 rounded"
                >
                  Eliminar
                </button>
              </div>
            </div>

            {/* Mostrar Subgrupos */}
            <div className="mt-4 pl-4">
              {combo.subGroups.map((subGroup, index) => (
                <div key={index} className="mb-2">
                  <h4 className="font-semibold">{subGroup.name}</h4>
                  <p className="text-sm text-gray-600">
                    {subGroup.isRequired ? 'Obligatorio' : 'Opcional'} |
                    {subGroup.isMultipleChoice ? ` Múltiple (max: ${subGroup.maxSelections})` : ' Única selección'}
                  </p>
                  <ul className="pl-4">
                    {subGroup.options.map((option, optIndex) => (
                      <li key={optIndex}>
                        {option.name} {option.additionalPrice > 0 ? `(+$${option.additionalPrice})` : 
                                     option.additionalPrice < 0 ? `(-$${Math.abs(option.additionalPrice)})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
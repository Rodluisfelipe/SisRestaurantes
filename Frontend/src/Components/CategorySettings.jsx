import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useParams } from 'react-router-dom';
import { socket } from '../services/api';

const LOCAL_STORAGE_KEY = 'categoryOrderSettings';

// Modal de confirmación para eliminar categoría
const DeleteCategoryModal = ({ isOpen, onClose, onConfirm, category }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center mb-4 text-red-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold">Eliminar Categoría</h2>
        </div>
        <p className="text-gray-700 mb-6">
          ¿Estás seguro de que deseas eliminar la categoría <span className="font-bold">{category?.name}</span>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Eliminar Categoría
          </button>
        </div>
      </div>
    </div>
  );
};

const CategorySettings = () => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [sortMode, setSortMode] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const { businessId } = useParams();
  // Estado para el modal de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  useEffect(() => {
    fetchCategories();
    // --- WebSocket: Conexión y listeners ---
    socket.connect();
    socket.emit('joinBusiness', businessId);
    socket.on('categories_update', (data) => {
      if (data.type === 'created') {
        setCategories((prev) => [...prev, data.category]);
      } else if (data.type === 'updated') {
        setCategories((prev) => prev.map(cat => cat._id === data.category._id ? data.category : cat));
      } else if (data.type === 'deleted') {
        setCategories((prev) => prev.filter(cat => cat._id !== data.categoryId));
      }
    });
    return () => {
      socket.emit('leaveBusiness', businessId);
      socket.off('categories_update');
      socket.disconnect();
    };
    // --- Fin WebSocket ---
  }, [businessId]);

  // Obtiene el orden guardado de localStorage
  const getSavedOrder = () => {
    try {
      const savedOrder = localStorage.getItem(LOCAL_STORAGE_KEY);
      return savedOrder ? JSON.parse(savedOrder) : {};
    } catch (error) {
      console.error('Error al obtener orden guardado:', error);
      return {};
    }
  };

  // Guarda el orden en localStorage
  const saveOrderToStorage = (orderMap) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orderMap));
      return true;
    } catch (error) {
      console.error('Error al guardar orden:', error);
      return false;
    }
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/categories?businessId=${businessId}`);
      setCategories(response.data);
    } catch (error) {
      setError('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/categories', { ...newCategory, businessId });
      setNewCategory({ name: '', description: '' });
      setSuccessMessage('Categoría creada correctamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      if (error.response && error.response.status === 400 && error.response.data?.message?.includes('Ya existe una categoría')) {
        setError('Ya existe una categoría con ese nombre en este negocio.');
      } else {
        setError('Error al crear la categoría');
      }
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDelete = async (id) => {
    const category = categories.find(cat => cat._id === id);
    setCategoryToDelete(category);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await api.delete(`/categories/${categoryToDelete._id}`);
      // Eliminar la categoría del orden guardado
      const orderMap = getSavedOrder();
      if (orderMap[categoryToDelete._id]) {
        delete orderMap[categoryToDelete._id];
        saveOrderToStorage(orderMap);
      }
      setSuccessMessage('Categoría eliminada correctamente');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowDeleteModal(false);
      setCategoryToDelete(null);
      // Refrescar categorías
      fetchCategories();
    } catch (error) {
      console.error('Error al eliminar categoría:', error);
      setError('Error al eliminar la categoría');
      setTimeout(() => setError(null), 3000);
      setShowDeleteModal(false);
      setCategoryToDelete(null);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    // For Firefox compatibility
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.parentNode);
    e.target.style.opacity = '0.4';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    
    // If the item is dragged over itself, ignore
    if (draggedItem === index) {
      return;
    }
    
    // Filter out the currently dragged item
    let items = [...categories];
    const draggedItemContent = items[draggedItem];
    items.splice(draggedItem, 1);
    items.splice(index, 0, draggedItemContent);
    
    setCategories(items);
    setDraggedItem(index);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
  };

  const saveOrder = async () => {
    setSaveLoading(true);
    setError(null);
    
    try {
      // Guardar el nuevo orden en localStorage
      const orderMap = {};
      categories.forEach((category, index) => {
        orderMap[category._id] = index;
      });
      
      if (saveOrderToStorage(orderMap)) {
        // Simulamos un tiempo de guardado para mostrar el estado de carga
        setTimeout(() => {
          setSaveLoading(false);
          setSuccessMessage('Orden de categorías guardado correctamente');
          setSortMode(false);
          setTimeout(() => setSuccessMessage(''), 3000);
        }, 600);
      } else {
        throw new Error('No se pudo guardar el orden');
      }
    } catch (error) {
      console.error('Error al guardar el orden:', error);
      setError('Error al guardar el orden de categorías');
      setSaveLoading(false);
      setTimeout(() => setError(null), 3000);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Cargando categorías...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Gestión de Categorías</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}

      {/* Ordenar/Reordenar Toggle */}
      <div className="mb-4 flex justify-end">
        {sortMode ? (
          <div className="space-x-2">
            <button
              onClick={saveOrder}
              disabled={saveLoading}
              className={`px-4 py-2 ${saveLoading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg`}
            >
              {saveLoading ? 'Guardando...' : 'Guardar Orden'}
            </button>
            <button
              onClick={() => setSortMode(false)}
              disabled={saveLoading}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSortMode(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reordenar Categorías
          </button>
        )}
      </div>

      {sortMode ? (
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">
            Arrastra y suelta las categorías para cambiar su orden de aparición en el menú
          </p>
          <div className="space-y-2">
            {categories.map((category, index) => (
              <div
                key={category._id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="p-4 bg-gray-50 rounded-lg border-2 border-blue-200 cursor-move"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-800">{category.name}</h4>
                    {category.description && (
                      <p className="text-sm text-gray-600">{category.description}</p>
                    )}
                    <p className="text-xs text-gray-400">Orden: {index + 1}</p>
                  </div>
                  <div className="text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Formulario para nueva categoría */}
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Categoría
                </label>
                <input
                  type="text"
                  id="name"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full border border-gray-200 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  id="description"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  className="w-full border border-gray-200 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="2"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors duration-300"
              >
                Crear Categoría
              </button>
            </div>
          </form>

          {/* Lista de categorías */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">Categorías Existentes</h3>
            <div className="grid gap-4">
              {categories.map((category, index) => {
                // Obtener el orden guardado para esta categoría
                const orderMap = getSavedOrder();
                const displayOrder = orderMap[category._id] !== undefined ? orderMap[category._id] + 1 : 'No definido';
                
                return (
                  <div
                    key={category._id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <h4 className="font-medium text-gray-800">{category.name}</h4>
                      {category.description && (
                        <p className="text-sm text-gray-600">{category.description}</p>
                      )}
                      <p className="text-xs text-gray-400">Orden: {displayOrder}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(category._id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-300"
                    >
                      Eliminar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      <DeleteCategoryModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setCategoryToDelete(null); }}
        onConfirm={confirmDelete}
        category={categoryToDelete}
      />
    </div>
  );
};

export default CategorySettings; 
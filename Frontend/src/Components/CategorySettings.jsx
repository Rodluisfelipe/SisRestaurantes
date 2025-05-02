import React, { useState, useEffect } from 'react';
import api from '../services/api';

const CategorySettings = () => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      setError('Error al cargar las categorías');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/categories', newCategory);
      setNewCategory({ name: '', description: '' });
      setSuccessMessage('Categoría creada correctamente');
      fetchCategories();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error al crear categoría:', error);
      setError('Error al crear la categoría');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
      try {
        await api.delete(`/categories/${id}`);
        fetchCategories();
        setSuccessMessage('Categoría eliminada correctamente');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (error) {
        console.error('Error al eliminar categoría:', error);
        setError('Error al eliminar la categoría');
        setTimeout(() => setError(null), 3000);
      }
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
          {categories.map((category) => (
            <div
              key={category._id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <h4 className="font-medium text-gray-800">{category.name}</h4>
                {category.description && (
                  <p className="text-sm text-gray-600">{category.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(category._id)}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-300"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategorySettings; 
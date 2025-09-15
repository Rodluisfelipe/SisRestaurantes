import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Filter, MapPin, Clock, Star } from 'lucide-react';

const AdvancedSearch = ({ isOpen, onClose, onSearch }) => {
  const [filters, setFilters] = useState({
    query: '',
    category: 'all',
    rating: 0,
    priceRange: 'all',
    distance: 'all',
    isOpen: false,
    hasDelivery: false,
    hasTakeout: false
  });

  const categories = [
    { id: 'all', name: 'Todas las categorías' },
    { id: 'hamburguesas', name: 'Hamburguesas' },
    { id: 'pizza', name: 'Pizza' },
    { id: 'comida-rapida', name: 'Comida Rápida' },
    { id: 'asiatica', name: 'Asiática' },
    { id: 'mexicana', name: 'Mexicana' },
    { id: 'italiana', name: 'Italiana' },
    { id: 'cafe', name: 'Café' },
    { id: 'postres', name: 'Postres' },
    { id: 'bebidas', name: 'Bebidas' }
  ];

  const priceRanges = [
    { id: 'all', name: 'Cualquier precio' },
    { id: '1', name: '$ - Económico' },
    { id: '2', name: '$$ - Moderado' },
    { id: '3', name: '$$$ - Caro' },
    { id: '4', name: '$$$$ - Muy caro' }
  ];

  const distances = [
    { id: 'all', name: 'Cualquier distancia' },
    { id: '1', name: 'Menos de 1 km' },
    { id: '2', name: 'Menos de 2 km' },
    { id: '5', name: 'Menos de 5 km' },
    { id: '10', name: 'Menos de 10 km' }
  ];

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSearch = () => {
    onSearch(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({
      query: '',
      category: 'all',
      rating: 0,
      priceRange: 'all',
      distance: 'all',
      isOpen: false,
      hasDelivery: false,
      hasTakeout: false
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Búsqueda Avanzada</h2>
                  <p className="text-slate-600 text-sm">Encuentra el restaurante perfecto</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Búsqueda por texto */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                ¿Qué estás buscando?
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Nombre del restaurante, plato, ingrediente..."
                  value={filters.query}
                  onChange={(e) => handleFilterChange('query', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Categoría
              </label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Rating mínimo */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Calificación mínima
              </label>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleFilterChange('rating', star)}
                    className={`p-2 rounded-lg transition-colors ${
                      filters.rating >= star
                        ? 'text-yellow-500 bg-yellow-50'
                        : 'text-slate-300 hover:text-yellow-400'
                    }`}
                  >
                    <Star className={`w-6 h-6 ${filters.rating >= star ? 'fill-current' : ''}`} />
                  </button>
                ))}
                {filters.rating > 0 && (
                  <button
                    onClick={() => handleFilterChange('rating', 0)}
                    className="ml-2 text-sm text-slate-500 hover:text-slate-700"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Rango de precios */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Rango de precios
              </label>
              <select
                value={filters.priceRange}
                onChange={(e) => handleFilterChange('priceRange', e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {priceRanges.map(range => (
                  <option key={range.id} value={range.id}>
                    {range.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Distancia */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Distancia máxima
              </label>
              <select
                value={filters.distance}
                onChange={(e) => handleFilterChange('distance', e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {distances.map(distance => (
                  <option key={distance.id} value={distance.id}>
                    {distance.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Opciones adicionales */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Opciones adicionales
              </label>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={filters.isOpen}
                    onChange={(e) => handleFilterChange('isOpen', e.target.checked)}
                    className="w-5 h-5 text-blue-500 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-700">Solo restaurantes abiertos</span>
                  </div>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={filters.hasDelivery}
                    onChange={(e) => handleFilterChange('hasDelivery', e.target.checked)}
                    className="w-5 h-5 text-blue-500 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-700">Con delivery</span>
                  </div>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={filters.hasTakeout}
                    onChange={(e) => handleFilterChange('hasTakeout', e.target.checked)}
                    className="w-5 h-5 text-blue-500 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-700">Para llevar</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6 rounded-b-2xl">
            <div className="flex space-x-3">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-3 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium"
              >
                Limpiar filtros
              </button>
              <button
                onClick={handleSearch}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
              >
                Buscar restaurantes
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AdvancedSearch;

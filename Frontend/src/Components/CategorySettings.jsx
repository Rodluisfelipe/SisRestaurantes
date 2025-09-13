import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useParams } from 'react-router-dom';
import { socket } from '../services/socket';

const LOCAL_STORAGE_KEY = 'categoryOrderSettings';

// Modern Delete Category Modal
const DeleteCategoryModal = ({ isOpen, onClose, onConfirm, category }) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🗑️</span>
        </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Eliminar Categoría</h2>
            <p className="text-slate-600">
              ¿Estás seguro de que deseas eliminar la categoría{' '}
              <span className="font-bold text-red-600">{category?.name}</span>?{' '}
              Esta acción no se puede deshacer.
            </p>
          </div>
          
          <div className="flex space-x-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-2xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 font-semibold"
          >
            Cancelar
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl hover:from-red-600 hover:to-red-700 transition-all duration-200 font-semibold shadow-lg"
          >
              Eliminar
            </motion.button>
        </div>
        </motion.div>
      </div>
    </AnimatePresence>
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
    <div className="space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-2xl">📂</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Gestión de Categorías</h2>
        <p className="text-slate-600">Organiza tu menú por categorías para una mejor experiencia</p>
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
      
      {successMessage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-green-50 border-2 border-green-200 text-green-700 px-6 py-4 rounded-2xl flex items-center space-x-3"
          >
            <span className="text-xl">✅</span>
            <span className="font-medium">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sort Mode Toggle */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-end"
      >
        {sortMode ? (
          <div className="flex space-x-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={saveOrder}
              disabled={saveLoading}
              className={`px-6 py-3 ${saveLoading ? 'bg-gray-400' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'} text-white rounded-2xl font-semibold shadow-lg flex items-center space-x-2 transition-all duration-200`}
            >
              <span>{saveLoading ? '⏳' : '💾'}</span>
              <span>{saveLoading ? 'Guardando...' : 'Guardar Orden'}</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSortMode(false)}
              disabled={saveLoading}
              className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-2xl hover:bg-slate-50 hover:border-slate-400 font-semibold transition-all duration-200"
            >
              Cancelar
            </motion.button>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSortMode(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:from-blue-600 hover:to-purple-700 font-semibold shadow-lg flex items-center space-x-2 transition-all duration-200"
          >
            <span>🔄</span>
            <span>Reordenar Categorías</span>
          </motion.button>
        )}
      </motion.div>

      {sortMode ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl p-8 border border-blue-200"
        >
          <div className="text-center mb-6">
            <span className="text-3xl mb-2 block">🔄</span>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Reordenar Categorías</h3>
            <p className="text-slate-600">
            Arrastra y suelta las categorías para cambiar su orden de aparición en el menú
          </p>
          </div>
          
          <div className="space-y-3">
            {categories.map((category, index) => (
              <motion.div
                key={category._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="p-6 bg-white rounded-2xl border-2 border-blue-200 cursor-move hover:border-blue-300 hover:shadow-lg transition-all duration-200 group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">{category.name}</h4>
                    {category.description && (
                      <p className="text-slate-600 mt-1">{category.description}</p>
                    )}
                    <p className="text-sm text-blue-600 font-medium mt-2">Orden: {index + 1}</p>
                  </div>
                  <div className="text-blue-400 group-hover:text-blue-600 transition-colors">
                    <span className="text-2xl">⋮⋮</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ) : (
        <>
          {/* Modern Category Form */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl p-8 border border-slate-200/50"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-2xl">✨</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Nueva Categoría</h3>
              <p className="text-slate-600">Crea una nueva categoría para organizar tus productos</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                  <span className="mr-2">🏷️</span>
                  Nombre de la Categoría
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 text-lg transition-all duration-200 group-hover:border-slate-300"
                  placeholder="Ej: Hamburguesas, Bebidas, Postres..."
                  required
                />
              </div>
              
              <div className="group">
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-3">
                  <span className="mr-2">📝</span>
                  Descripción
                </label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-6 py-4 transition-all duration-200 group-hover:border-slate-300 resize-none"
                  rows="3"
                  placeholder="Descripción opcional de la categoría..."
                />
              </div>
              
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white py-4 rounded-2xl hover:from-green-600 hover:to-blue-700 transition-all duration-200 font-semibold shadow-xl flex items-center justify-center space-x-2"
              >
                <span>✨</span>
                <span>Crear Categoría</span>
              </motion.button>
            </form>
          </motion.div>

          {/* Modern Categories List */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Categorías Existentes</h3>
              <p className="text-slate-600">Gestiona las categorías de tu menú</p>
            </div>
            
            {categories.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl border-2 border-dashed border-slate-300"
              >
                <span className="text-4xl mb-4 block">📂</span>
                <h4 className="text-xl font-semibold text-slate-700 mb-2">No hay categorías</h4>
                <p className="text-slate-500">Crea tu primera categoría para organizar tu menú</p>
              </motion.div>
            ) : (
              <div className="grid gap-6">
              {categories.map((category, index) => {
                // Obtener el orden guardado para esta categoría
                const orderMap = getSavedOrder();
                const displayOrder = orderMap[category._id] !== undefined ? orderMap[category._id] + 1 : 'No definido';
                
                return (
                    <motion.div
                    key={category._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className="group bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-lg border border-slate-200/50 overflow-hidden hover:shadow-xl transition-all duration-300"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-xl">📂</span>
                              </div>
                    <div>
                                <h4 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {category.name}
                                </h4>
                                <p className="text-sm text-blue-600 font-medium">
                                  Orden: {displayOrder}
                                </p>
                              </div>
                            </div>
                            
                      {category.description && (
                              <p className="text-slate-600 leading-relaxed">
                                {category.description}
                              </p>
                      )}
                    </div>
                          
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                      onClick={() => handleDelete(category._id)}
                            className="ml-4 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl hover:from-red-600 hover:to-red-700 transition-all duration-200 font-semibold shadow-lg flex items-center space-x-2"
                          >
                            <span>🗑️</span>
                            <span>Eliminar</span>
                          </motion.button>
                        </div>
                  </div>
                      
                      {/* Hover Effect Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    </motion.div>
                );
              })}
            </div>
            )}
          </motion.div>
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
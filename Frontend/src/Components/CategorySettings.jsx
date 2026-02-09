import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaFolderOpen, FaPlus, FaTrash, FaTag, FaAlignLeft, FaGripVertical, FaSave, FaTimes, FaExclamationTriangle, FaCheck, FaSyncAlt, FaBoxOpen } from 'react-icons/fa';
import api from '../services/api';
import { useParams } from 'react-router-dom';
import { socket } from '../services/socket';

const LOCAL_STORAGE_KEY = 'categoryOrderSettings';

// Delete Category Modal
const DeleteCategoryModal = ({ isOpen, onClose, onConfirm, category }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-5 max-w-sm w-full mx-4 shadow-lg border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
            <FaExclamationTriangle className="text-red-500 text-sm" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Eliminar Categoría</h2>
            <p className="text-xs text-slate-500">Esta acción no se puede deshacer</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          ¿Eliminar <span className="font-semibold text-red-600">{category?.name}</span>?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-3 py-2 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Eliminar
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
    if (socket) {
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
    }
    return () => {
      if (socket) {
        socket.emit('leaveBusiness', businessId);
        socket.off('categories_update');
        socket.disconnect();
      }
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
      // Crear array de categorías con su nuevo orden
      const orderedCategories = categories.map((category, index) => ({
        _id: category._id,
        order: index
      }));
      
      // Enviar orden al backend
      await api.put('/categories/reorder', { 
        businessId, 
        categories: orderedCategories 
      });
      
      // También guardar en localStorage para compatibilidad con PC
      const orderMap = {};
      categories.forEach((category, index) => {
        orderMap[category._id] = index;
      });
      saveOrderToStorage(orderMap);
      
      setSaveLoading(false);
      setSuccessMessage('Orden de categorías guardado correctamente');
      setSortMode(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error al guardar el orden:', error);
      setError('Error al guardar el orden de categorías');
      setSaveLoading(false);
      setTimeout(() => setError(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-slate-400">
        <FaSyncAlt className="animate-spin mr-2 text-xs" /> Cargando categorías...
      </div>
    );
  }

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
            <FaExclamationTriangle className="text-[10px]" /> {error}
          </motion.div>
        )}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 bg-emerald-50 text-emerald-700 text-xs font-medium flex items-center gap-2 rounded-lg border border-emerald-100"
          >
            <FaCheck className="text-[10px]" /> {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sort mode toggle */}
      <div className="flex justify-end">
        {sortMode ? (
          <div className="flex gap-2">
            <button
              onClick={saveOrder}
              disabled={saveLoading}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                saveLoading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              <FaSave className="text-[10px]" />
              {saveLoading ? 'Guardando...' : 'Guardar Orden'}
            </button>
            <button
              onClick={() => setSortMode(false)}
              disabled={saveLoading}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSortMode(true)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <FaGripVertical className="text-[10px]" />
            Reordenar Categorías
          </button>
        )}
      </div>

      {sortMode ? (
        /* Reorder mode */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <FaGripVertical className="text-blue-500 text-sm" />
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Reordenar Categorías</h3>
              <p className="text-[11px] text-slate-500">Arrastra para cambiar el orden en el menú</p>
            </div>
          </div>
          <div className="p-2 space-y-1">
            {categories.map((category, index) => (
              <div
                key={category._id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors"
              >
                <FaGripVertical className="text-slate-300 text-[10px] flex-shrink-0" />
                <span className="bg-blue-50 text-blue-600 font-semibold text-[10px] w-5 h-5 rounded flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-700 truncate block">{category.name}</span>
                  {category.description && (
                    <span className="text-[11px] text-slate-400 truncate block">{category.description}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Create category form */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <FaPlus className="text-blue-500 text-sm" />
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Nueva Categoría</h3>
                <p className="text-[11px] text-slate-500">Crea una nueva categoría para organizar tus productos</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                  <FaTag className="text-[10px] text-slate-400" />
                  Nombre de la Categoría
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                  placeholder="Ej: Hamburguesas, Bebidas, Postres..."
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                  <FaAlignLeft className="text-[10px] text-slate-400" />
                  Descripción
                </label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors resize-none"
                  rows="2"
                  placeholder="Descripción opcional de la categoría..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <FaPlus className="text-[10px]" />
                Crear Categoría
              </button>
            </form>
          </div>

          {/* Existing categories list */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <FaFolderOpen className="text-blue-500 text-sm" />
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Categorías Existentes</h3>
                <p className="text-[11px] text-slate-500">Gestiona las categorías de tu menú</p>
              </div>
            </div>

            {categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FaBoxOpen className="text-2xl text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 font-medium">Sin categorías</p>
                <p className="text-xs text-slate-400 mt-1">Crea tu primera categoría para organizar tu menú</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {categories.map((category) => {
                  const orderMap = getSavedOrder();
                  const displayOrder = orderMap[category._id] !== undefined ? orderMap[category._id] + 1 : '—';

                  return (
                    <div
                      key={category._id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FaFolderOpen className="text-blue-500 text-xs" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-800 truncate">{category.name}</h4>
                          {category.description && (
                            <p className="text-[11px] text-slate-400 truncate">{category.description}</p>
                          )}
                        </div>
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0">
                          #{displayOrder}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(category._id)}
                        className="ml-3 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title="Eliminar"
                      >
                        <FaTrash className="text-xs" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import { useNavigate } from 'react-router-dom';

const POSHeader = ({ 
  onSearch, 
  selectedCategory, 
  setSelectedCategory, 
  showImages, 
  toggleDisplayMode 
}) => {
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { businessId } = useBusinessConfig();
  const navigate = useNavigate();

  // Cargar categorías
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        console.log('Fetching categories for businessId:', businessId);
        const response = await api.get(`/categories?businessId=${businessId}`);
        console.log('Categories response:', response.data);
        if (response.data && Array.isArray(response.data)) {
          setCategories(response.data);
          
          // Solo seleccionar la primera categoría si no hay categoría seleccionada
          // y respetando que 'all' es una selección válida
          if (response.data.length > 0 && selectedCategory !== 'all' && !selectedCategory) {
            console.log('Setting default category:', response.data[0]._id);
            setSelectedCategory(response.data[0]._id);
          }
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    
    fetchCategories();
  }, [businessId, selectedCategory, setSelectedCategory]);

  // Manejar cambio en búsqueda
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    onSearch(term);
  };

  // Manejar cambio de categoría
  const handleCategoryChange = (categoryId) => {
    console.log('Changing to category:', categoryId);
    setSelectedCategory(categoryId);
  };

  // Función auxiliar para comparar IDs (string o MongoDB ObjectId)
  const compareIds = (id1, id2) => {
    if (!id1 || !id2) return false;
    // Si alguno es null, devuelve true solo si ambos son null
    if (id1 === null && id2 === null) return true;
    if (id1 === null || id2 === null) return false;
    
    // Convertir a string para comparación segura
    const strId1 = typeof id1 === 'object' && id1._id ? id1._id.toString() : id1.toString();
    const strId2 = typeof id2 === 'object' && id2._id ? id2._id.toString() : id2.toString();
    return strId1 === strId2;
  };

  // Volver al panel de administración
  const handleBackToAdmin = () => {
    navigate(`/${businessId}/admin`);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 p-2 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {/* Botón de volver y título */}
        <div className="flex items-center">
          <button 
            onClick={handleBackToAdmin}
            className="mr-2 p-1 rounded hover:bg-gray-100"
            title="Volver al panel de administración"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-800">POS</h1>
        </div>
        
        {/* Selector de categorías (ahora en la primera fila) */}
        <div className="flex-1 overflow-x-auto flex items-center scrollbar-thin px-1">
          <button
            onClick={() => handleCategoryChange('all')}
            className={`whitespace-nowrap px-3 py-1 text-sm rounded-md mr-1 ${
              selectedCategory === 'all' || selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Todos
          </button>
          
          {categories.map((category) => (
            <button
              key={category._id}
              onClick={() => handleCategoryChange(category._id)}
              className={`whitespace-nowrap px-3 py-1 text-sm rounded-md mr-1 ${
                compareIds(selectedCategory, category._id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
        
        {/* Botones de control compactados */}
        <div className="flex items-center gap-2">
          {/* Búsqueda compacta */}
          <div className="relative w-48">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* Botón modo compacto/visual */}
          <button
            onClick={toggleDisplayMode}
            className="p-1 rounded-md hover:bg-gray-100"
            title={showImages ? "Cambiar a modo compacto" : "Cambiar a modo visual"}
          >
            {showImages ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default POSHeader;

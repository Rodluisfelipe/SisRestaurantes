import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import ProductToppingsModal from './ProductToppingsModal';

const ProductGrid = ({ searchTerm, selectedCategory, onAddToCart, showImages }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { businessId } = useBusinessConfig();
  const [favorites, setFavorites] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null); // Producto seleccionado para editar toppings
  const [categories, setCategories] = useState([]); // Añadir estado para almacenar las categorías

  // Cargar productos
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        console.log('Fetching products for businessId:', businessId);
        const response = await api.get(`/products?businessId=${businessId}`);
        console.log('Products response:', response);
        if (response.data && Array.isArray(response.data)) {
          console.log('Setting products state with:', response.data.length, 'products');
          setProducts(response.data);
          
          // Inicializar favoritos (los 8 productos más vendidos para ejemplo)
          // En una implementación real, esto vendría del backend
          const sortedByPopularity = [...response.data].sort(() => 0.5 - Math.random());
          setFavorites(sortedByPopularity.slice(0, 8));
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Cargar categorías
    const fetchCategories = async () => {
      try {
        const response = await api.get(`/categories?businessId=${businessId}`);
        if (response.data && Array.isArray(response.data)) {
          setCategories(response.data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    
    fetchProducts();
    fetchCategories();
  }, [businessId]);

  // Función para obtener el nombre de una categoría por su ID
  const getCategoryName = (categoryId) => {
    if (categoryId === 'uncategorized') return 'Sin categoría';
    
    const category = categories.find(cat => cat._id === categoryId);
    return category ? category.name : 'Categoría';
  };

  // Filtrar productos por categoría y término de búsqueda
  const filteredProducts = products.filter(product => {
    console.log('Filtering product:', product.name, 'Category:', product.category, 'Selected category:', selectedCategory);
    
    // Función auxiliar para comparar IDs (string o MongoDB ObjectId)
    const compareIds = (id1, id2) => {
      if (!id1 || !id2) return false;
      // Convertir a string para comparación segura
      const strId1 = typeof id1 === 'object' && id1._id ? id1._id.toString() : id1.toString();
      const strId2 = typeof id2 === 'object' && id2._id ? id2._id.toString() : id2.toString();
      return strId1 === strId2;
    };
    
    // Filtrar por categoría
    const matchesCategory = selectedCategory === 'all' || selectedCategory === null 
      ? true  // Mostrar todos los productos
      : compareIds(product.category, selectedCategory);
      
    // Filtrar por término de búsqueda
    const matchesSearch = searchTerm
      ? product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
      : true;
    
    const shouldInclude = matchesCategory && matchesSearch;
    console.log('Should include product?', shouldInclude);
    return shouldInclude;
  });

  // Verificar si es un producto favorito
  const isFavorite = (productId) => {
    return favorites.some(favProduct => favProduct._id === productId);
  };

  // Función para mostrar el modal de toppings
  const handleSelectToppings = (product) => {
    console.log("Seleccionando producto para toppings:", product);
    setSelectedProduct(product);
  };

  // Función para cerrar el modal de toppings
  const handleCloseModal = () => {
    console.log("Cerrando modal de toppings");
    setSelectedProduct(null);
  };

  // Agrupar productos por categoría para una mejor visualización
  const productsByCategory = filteredProducts.reduce((acc, product) => {
    const categoryId = product.category || 'uncategorized';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(product);
    return acc;
  }, {});

  // Renderizar un mensaje de carga
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Si no hay productos, mostrar un mensaje
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-gray-500 text-xl">No hay productos disponibles</p>
      </div>
    );
  }

  // Si hay búsqueda, mostrar resultados sin agrupar
  if (searchTerm) {
    if (filteredProducts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-gray-500 text-xl">No se encontraron productos que coincidan con "{searchTerm}"</p>
        </div>
      );
    }
    
    return (
      <>
        <div className={`grid ${showImages ? 'grid-cols-3' : 'grid-cols-4'} gap-4`}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onAddToCart={onAddToCart}
              isFavorite={isFavorite(product._id)}
              showImages={showImages}
              onSelectToppings={handleSelectToppings}
            />
          ))}
        </div>
        
        {/* Modal de selección de toppings */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-screen overflow-auto">
              <ProductToppingsModal
                product={selectedProduct}
                onAddToCart={onAddToCart}
                onClose={handleCloseModal}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Si estamos viendo la categoría "all", mostrar favoritos y luego todas las categorías
  if (selectedCategory === 'all' || !selectedCategory) {
    return (
      <>
        {/* Sección de favoritos */}
        {favorites.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Favoritos</h2>
            <div className={`grid ${showImages ? 'grid-cols-3' : 'grid-cols-4'} gap-4`}>
              {favorites.map(product => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onAddToCart={onAddToCart}
                  isFavorite={true}
                  showImages={showImages}
                  onSelectToppings={handleSelectToppings}
                />
              ))}
            </div>
          </div>
        )}

        {/* Agrupar productos por categoría */}
        {Object.entries(productsByCategory).map(([categoryId, categoryProducts]) => (
          <div key={categoryId} className="mb-8">
            <h2 className="text-lg font-semibold mb-4">{getCategoryName(categoryId)}</h2>
            <div className={`grid ${showImages ? 'grid-cols-3' : 'grid-cols-4'} gap-4`}>
              {categoryProducts.map(product => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onAddToCart={onAddToCart}
                  isFavorite={isFavorite(product._id)}
                  showImages={showImages}
                  onSelectToppings={handleSelectToppings}
                />
              ))}
            </div>
          </div>
        ))}
        
        {/* Modal de selección de toppings */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-screen overflow-auto">
              <ProductToppingsModal
                product={selectedProduct}
                onAddToCart={onAddToCart}
                onClose={handleCloseModal}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Si estamos viendo una categoría específica, mostrar solo esos productos
  return (
    <>
      <div className={`grid ${showImages ? 'grid-cols-3' : 'grid-cols-4'} gap-4`}>
        {filteredProducts.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            onAddToCart={onAddToCart}
            isFavorite={isFavorite(product._id)}
            showImages={showImages}
            onSelectToppings={handleSelectToppings}
          />
        ))}
      </div>
      
      {/* Modal de selección de toppings */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-screen overflow-auto">
            <ProductToppingsModal
              product={selectedProduct}
              onAddToCart={onAddToCart}
              onClose={handleCloseModal}
            />
          </div>
        </div>
      )}
    </>
  );
};

// Componente de tarjeta de producto
const ProductCard = ({ product, onAddToCart, isFavorite, showImages, onSelectToppings }) => {
  // Verificar si el producto tiene toppings
  const hasToppings = Array.isArray(product.toppingGroups) && product.toppingGroups.length > 0;
  
  const handleClick = () => {
    if (hasToppings) {
      // Si tiene toppings, mostrar el modal
      console.log("Abriendo modal de toppings para:", product.name);
      onSelectToppings(product);
    } else {
      // Si no tiene toppings, añadir directamente al carrito
      onAddToCart(product, 1);
    }
  };

  // Función específica para el botón de añadir
  const handleAddButtonClick = (e) => {
    e.stopPropagation(); // Detener la propagación para evitar que se active el onClick del div padre
    handleClick();
  };

  // Versión compacta (sin imágenes)
  if (!showImages) {
    return (
      <div 
        className="bg-white rounded-md shadow-sm overflow-hidden cursor-pointer hover:shadow transition-shadow duration-200 border border-gray-200"
        onClick={handleClick}
      >
        <div className="p-2">
          <h3 className="font-medium text-gray-800 truncate text-sm">{product.name}</h3>
          <div className="flex justify-between items-center mt-1">
            <p className="text-base font-semibold text-blue-600">${parseFloat(product.price).toFixed(2)}</p>
            <button 
              className="bg-blue-600 text-white rounded-full p-1 h-6 w-6 flex items-center justify-center"
              onClick={handleAddButtonClick}
              aria-label={hasToppings ? "Personalizar" : "Añadir al carrito"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          {hasToppings && (
            <span className="text-xs text-blue-600 flex items-center mt-1">
              <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Personalizable
            </span>
          )}
        </div>
      </div>
    );
  }

  // Versión visual (con imágenes)
  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200"
      onClick={handleClick}
    >
      <div className="relative">
        {product.image ? (
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-32 object-cover"
            onError={(e) => {
              e.target.src = 'https://placehold.co/300x200?text=Sin+imagen';
            }}
          />
        ) : (
          <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
            <span className="text-gray-500">Sin imagen</span>
          </div>
        )}
        
        {isFavorite && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-white p-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )}
        
        {/* Indicador de toppings */}
        {hasToppings && (
          <div className="absolute bottom-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
            Opciones
          </div>
        )}
      </div>
      
      <div className="p-3">
        <h3 className="font-semibold text-gray-800 truncate">{product.name}</h3>
        <div className="flex justify-between items-center mt-2">
          <p className="text-lg font-bold text-blue-600">${parseFloat(product.price).toFixed(2)}</p>
          <button 
            className="bg-blue-600 text-white rounded-full p-1"
            onClick={handleAddButtonClick}
            aria-label={hasToppings ? "Personalizar" : "Añadir al carrito"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductGrid;

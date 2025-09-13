import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

/**
 * Hook personalizado para manejo de productos
 * Extrae la lógica de gestión de productos del componente Admin
 */
const useProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [toppingGroups, setToppingGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { businessId } = useBusinessConfig();

  // Cargar datos iniciales
  const loadData = useCallback(async () => {
    if (!businessId) return;
    
    setLoading(true);
    try {
      const [productsRes, categoriesRes, toppingsRes] = await Promise.all([
        api.get(`/products?businessId=${businessId}`),
        api.get(`/categories?businessId=${businessId}`),
        api.get(`/topping-groups?businessId=${businessId}`)
      ]);

      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setToppingGroups(toppingsRes.data);
      setError(null);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Crear producto
  const createProduct = useCallback(async (productData) => {
    try {
      const response = await api.post('/products', {
        ...productData,
        businessId
      });
      
      setProducts(prev => [response.data, ...prev]);
      return { success: true, product: response.data };
    } catch (error) {
      console.error('Error creating product:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al crear el producto' 
      };
    }
  }, [businessId]);

  // Actualizar producto
  const updateProduct = useCallback(async (productId, productData) => {
    try {
      const response = await api.put(`/products/${productId}`, {
        ...productData,
        businessId
      });
      
      setProducts(prev => 
        prev.map(product => 
          product._id === productId ? response.data : product
        )
      );
      
      return { success: true, product: response.data };
    } catch (error) {
      console.error('Error updating product:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al actualizar el producto' 
      };
    }
  }, [businessId]);

  // Eliminar producto
  const deleteProduct = useCallback(async (productId) => {
    try {
      await api.delete(`/products/${productId}`);
      setProducts(prev => prev.filter(product => product._id !== productId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting product:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al eliminar el producto' 
      };
    }
  }, []);

  // Crear categoría
  const createCategory = useCallback(async (categoryData) => {
    try {
      const response = await api.post('/categories', {
        ...categoryData,
        businessId
      });
      
      setCategories(prev => [response.data, ...prev]);
      return { success: true, category: response.data };
    } catch (error) {
      console.error('Error creating category:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al crear la categoría' 
      };
    }
  }, [businessId]);

  // Actualizar categoría
  const updateCategory = useCallback(async (categoryId, categoryData) => {
    try {
      const response = await api.put(`/categories/${categoryId}`, {
        ...categoryData,
        businessId
      });
      
      setCategories(prev => 
        prev.map(category => 
          category._id === categoryId ? response.data : category
        )
      );
      
      return { success: true, category: response.data };
    } catch (error) {
      console.error('Error updating category:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al actualizar la categoría' 
      };
    }
  }, [businessId]);

  // Eliminar categoría
  const deleteCategory = useCallback(async (categoryId) => {
    try {
      await api.delete(`/categories/${categoryId}`);
      setCategories(prev => prev.filter(category => category._id !== categoryId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting category:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al eliminar la categoría' 
      };
    }
  }, []);

  // Crear grupo de toppings
  const createToppingGroup = useCallback(async (toppingData) => {
    try {
      const response = await api.post('/topping-groups', {
        ...toppingData,
        businessId
      });
      
      setToppingGroups(prev => [response.data, ...prev]);
      return { success: true, toppingGroup: response.data };
    } catch (error) {
      console.error('Error creating topping group:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al crear el grupo de ingredientes' 
      };
    }
  }, [businessId]);

  // Actualizar grupo de toppings
  const updateToppingGroup = useCallback(async (toppingId, toppingData) => {
    try {
      const response = await api.put(`/topping-groups/${toppingId}`, {
        ...toppingData,
        businessId
      });
      
      setToppingGroups(prev => 
        prev.map(topping => 
          topping._id === toppingId ? response.data : topping
        )
      );
      
      return { success: true, toppingGroup: response.data };
    } catch (error) {
      console.error('Error updating topping group:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al actualizar el grupo de ingredientes' 
      };
    }
  }, [businessId]);

  // Eliminar grupo de toppings
  const deleteToppingGroup = useCallback(async (toppingId) => {
    try {
      await api.delete(`/topping-groups/${toppingId}`);
      setToppingGroups(prev => prev.filter(topping => topping._id !== toppingId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting topping group:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error al eliminar el grupo de ingredientes' 
      };
    }
  }, []);

  return {
    // State
    products,
    categories,
    toppingGroups,
    loading,
    error,
    
    // Actions
    loadData,
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
    updateCategory,
    deleteCategory,
    createToppingGroup,
    updateToppingGroup,
    deleteToppingGroup,
  };
};

export default useProductManagement;

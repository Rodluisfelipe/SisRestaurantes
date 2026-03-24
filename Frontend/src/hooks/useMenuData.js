import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { socket } from '../services/socket';
import { isValidBusinessIdentifier } from '../utils/isValidObjectId';
import logger from '../utils/logger';

const CACHE_KEY_PREFIX = 'menuby_menu_';
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function getCachedMenu(businessId) {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${businessId}`);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${businessId}`);
      return null;
    }
    return cached;
  } catch { return null; }
}

function setCachedMenu(businessId, products, categories) {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${businessId}`, JSON.stringify({
      products, categories, ts: Date.now()
    }));
  } catch { /* storage full — ignore */ }
}

/**
 * Custom hook for loading menu data (products + categories) and keeping
 * them in sync via Socket.IO events.
 *
 * @param {string} businessId - Business identifier (ObjectId or slug)
 * @returns {object} { products, setProducts, categories, setCategories, loading, fetchError, retry }
 */
export default function useMenuData(businessId) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const fetchData = useCallback(async () => {
    const isValid = isValidBusinessIdentifier(businessId);
    if (!isValid) {
      logger.info('useMenuData - businessId not valid, skipping fetch');
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        api.get(`/products?businessId=${businessId}`),
        api.get(`/categories?businessId=${businessId}`)
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setCachedMenu(businessId, productsRes.data, categoriesRes.data);
    } catch (err) {
      logger.error('useMenuData - Error fetching data:', err);
      // Try to load from cache
      const cached = getCachedMenu(businessId);
      if (cached) {
        setProducts(cached.products);
        setCategories(cached.categories);
      }
      setFetchError(err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // Fetch on mount / businessId change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket.IO real-time sync for products and categories
  useEffect(() => {
    const isValid = isValidBusinessIdentifier(businessId);
    if (!isValid) return;

    if (socket && !socket.connected) {
      socket.connect();
    }
    if (socket) {
      socket.emit('joinBusiness', businessId);

      socket.on('products_update', (data) => {
        if (data.type === 'created') {
          setProducts(prev => [...prev, data.product]);
        } else if (data.type === 'deleted') {
          setProducts(prev => prev.filter(p => p._id !== data.productId));
        } else if (data.type === 'updated') {
          setProducts(prev => prev.map(p => p._id === data.product._id ? data.product : p));
        }
      });

      socket.on('categories_update', (data) => {
        if (data.type === 'created') {
          setCategories(prev => [...prev, data.category]);
        } else if (data.type === 'updated') {
          setCategories(prev => prev.map(cat => cat._id === data.category._id ? data.category : cat));
        } else if (data.type === 'deleted') {
          setCategories(prev => prev.filter(cat => cat._id !== data.categoryId));
        }
      });
    }

    return () => {
      if (socket) {
        socket.emit('leaveBusiness', businessId);
        socket.off('products_update');
        socket.off('categories_update');
      }
    };
  }, [businessId]);

  return { products, setProducts, categories, setCategories, loading, fetchError, retry: fetchData };
}

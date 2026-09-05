import { useState } from 'react';
import api from '../services/api';

// Convierte ISO/Date a valor de <input type="datetime-local"> en hora LOCAL.
function toLocalDatetimeInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Arma el objeto promo que espera el backend desde los campos planos del form.
function buildPromoPayload(form) {
  if (!form.promoActive) return { active: false, price: null, endsAt: null, label: '' };
  const price = (form.promoPrice !== '' && form.promoPrice != null && !isNaN(Number(form.promoPrice)))
    ? Number(form.promoPrice) : null;
  return {
    active: true,
    price,
    endsAt: form.promoEndsAt ? new Date(form.promoEndsAt).toISOString() : null,
    label: (form.promoLabel || '').slice(0, 40),
  };
}

/**
 * Custom hook que encapsula TODA la lógica de gestión de productos:
 * - CRUD (crear, editar, eliminar)
 * - Toggle activo/inactivo
 * - Toggle destacado + reordenar destacados
 * - Drag & drop de productos destacados
 * - Manejo de formulario (change, blur, price)
 * - Mensajes success/error
 *
 * Extraído de Admin.jsx (~400 líneas de handlers).
 */
export default function useProductHandlers({ businessId, products, setProducts, toppingGroups, loadData }) {
  const [form, setForm] = useState({
    name: '', description: '', price: '', category: '', image: '', toppingGroups: [],
    itemType: 'product', durationMinutes: ''
  });
  const [touchedFields, setTouchedFields] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [draggedFeaturedItem, setDraggedFeaturedItem] = useState(null);

  // --- Mensajes ---
  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showErrorMessage = (message) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  /**
   * Traduce un error de axios al mensaje que de verdad le sirve al negocio.
   *
   * Antes todo terminaba en "verifica que los campos esten completos", incluso
   * cuando el problema era que la sesion vencio o que el plan llego a su tope.
   * El dueño revisaba el formulario una y otra vez buscando un error que no
   * estaba ahi. El backend ya manda el motivo; solo habia que mostrarlo.
   */
  const mensajeDeError = (error, porDefecto) => {
    if (error?.code === 'ECONNABORTED') {
      return 'La conexion tardo demasiado. Revisa tu internet e intentalo de nuevo.';
    }
    if (!error?.response) {
      return 'No se pudo conectar con el servidor. Revisa tu internet.';
    }

    const { status, data } = error.response;

    if (status === 401) {
      return 'Tu sesion vencio. Vuelve a iniciar sesion para continuar.';
    }
    if (status === 403 && data?.code === 'PLAN_LIMIT_REACHED') {
      return data.message || 'Llegaste al limite de productos de tu plan.';
    }
    if (Array.isArray(data?.errors) && data.errors.length) {
      return data.errors.map(e => e.message || e).join(', ');
    }
    return data?.message || porDefecto;
  };

  // --- Formulario ---
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleBlur = (fieldName) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));
  };

  const handlePriceChange = (e) => {
    const cleanValue = e.target.value.replace(/[^0-9.,]/g, '');
    const formattedValue = cleanValue.replace(/,/g, '.');
    setForm(prev => ({ ...prev, price: formattedValue }));
  };

  const handleToppingGroupsChange = (selectedGroups) => {
    setForm({ ...form, toppingGroups: selectedGroups });
  };

  // --- Helpers para toppingGroups ---
  const extractToppingGroupIds = (groups) => {
    if (!groups || groups.length === 0) return [];
    return groups.map(tg => (typeof tg === 'object' && tg._id ? tg._id : tg));
  };

  const resetForm = () => {
    setForm({ name: '', description: '', price: '', category: '', image: '', toppingGroups: [], itemType: 'product', durationMinutes: '', trackStock: false, stock: '', lowStockAlert: '5' });
    setTouchedFields({});
    setEditingId(null);
    setEditingProduct(null);
  };

  // --- CRUD ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouchedFields({ name: true, price: true, category: true });

    if (!form.name.trim()) { showErrorMessage('El nombre del producto es obligatorio'); return; }
    const numericPrice = parseFloat(form.price.replace(/\./g, ''));
    if (!form.price || numericPrice <= 0 || isNaN(numericPrice)) { showErrorMessage('El precio debe ser mayor a 0'); return; }
    if (!form.category) { showErrorMessage('Debes seleccionar una categoría para el producto'); return; }

    const payload = {
      name: form.name,
      description: form.description,
      price: numericPrice,
      category: form.category,
      toppingGroups: extractToppingGroupIds(form.toppingGroups),
      businessId,
      trackStock: !!form.trackStock,
      stock: form.trackStock && form.stock !== '' ? parseInt(form.stock, 10) : null,
      lowStockAlert: form.trackStock && form.lowStockAlert !== '' ? parseInt(form.lowStockAlert, 10) : 5,
      promo: buildPromoPayload(form),
    };
    if (form.image) payload.image = form.image;
    if (form.itemType) payload.itemType = form.itemType;
    if (form.itemType === 'service' && form.durationMinutes) payload.durationMinutes = parseInt(form.durationMinutes, 10);

    try {
      if (editingId) {
        setShowConfirmModal(true);
      } else {
        const response = await api.post('/products', payload);
        showSuccessMessage('Producto creado exitosamente');
        resetForm();
        setTimeout(() => setShowProductModal(false), 500);
        setProducts(prev => [...prev, response.data]);
        setTimeout(() => loadData(), 800);
      }
    } catch (error) {
      console.error('Error:', error);
      showErrorMessage(mensajeDeError(error, 'No se pudo crear el producto. Revisa los datos e intentalo de nuevo.'));
    }
  };

  const confirmEdit = async () => {
    try {
      const toppingGroupIds = extractToppingGroupIds(form.toppingGroups);
      const formToSend = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price.replace(/\./g, '')),
        category: form.category,
        image: form.image,
        toppingGroups: toppingGroupIds,
        businessId,
        itemType: form.itemType || 'product',
        durationMinutes: form.itemType === 'service' ? (parseInt(form.durationMinutes, 10) || null) : null,
        trackStock: !!form.trackStock,
        stock: form.trackStock && form.stock !== '' ? parseInt(form.stock, 10) : null,
        lowStockAlert: form.trackStock && form.lowStockAlert !== '' ? parseInt(form.lowStockAlert, 10) : 5,
        promo: buildPromoPayload(form),
      };

      const response = await api.put(`/products/${editingId}`, formToSend);

      if (!response.data.toppingGroups || response.data.toppingGroups.length === 0) {
        setProducts(prev => prev.map(p => p._id === editingId ? { ...response.data, toppingGroups: toppingGroupIds } : p));
      } else {
        setProducts(prev => prev.map(p => p._id === editingId ? response.data : p));
      }

      resetForm();
      setShowConfirmModal(false);
      setTimeout(() => setShowProductModal(false), 500);
      showSuccessMessage('Producto actualizado correctamente');
      setTimeout(() => loadData(), 800);
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      // Antes esto fallaba en silencio: el usuario daba "Actualizar" y no
      // pasaba nada en pantalla, sin saber si habia guardado o no.
      showErrorMessage(mensajeDeError(error, 'No se pudo actualizar el producto.'));
      setShowConfirmModal(false);
    }
  };

  const handleEdit = (product) => {
    let processedToppingGroups = [];
    if (product.toppingGroups && Array.isArray(product.toppingGroups)) {
      if (product.toppingGroups.length > 0 && typeof product.toppingGroups[0] === 'object' && product.toppingGroups[0]._id) {
        processedToppingGroups = product.toppingGroups;
      } else {
        processedToppingGroups = product.toppingGroups
          .map(toppingId => toppingGroups.find(g => g._id === toppingId) || toppingId)
          .filter(Boolean);
      }
    }
    setEditingId(product._id);
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: product.category || '',
      image: product.image || '',
      toppingGroups: processedToppingGroups
    });
  };

  const handleDelete = async (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/products/${productToDelete._id}`);
      setProducts(products.filter(p => p._id !== productToDelete._id));
      showSuccessMessage('Producto eliminado exitosamente');
      setShowDeleteModal(false);
      setProductToDelete(null);
      setTimeout(() => loadData(), 500);
    } catch (error) {
      console.error('Error al eliminar el producto:', error);
      showErrorMessage(mensajeDeError(error, 'No se pudo eliminar el producto.'));
      setShowDeleteModal(false);
    }
  };

  // --- Toggle activo/inactivo ---
  const handleToggleProduct = async (productId) => {
    try {
      const response = await api.patch(`/products/${productId}/toggle`);
      const updatedProduct = response.data.product;
      setProducts(prev => prev.map(p => p._id === productId ? { ...p, active: updatedProduct.active } : p));
      showSuccessMessage(updatedProduct.active ? 'Producto activado correctamente' : 'Producto pausado correctamente');
    } catch (error) {
      console.error('Error al cambiar estado del producto:', error);
      showErrorMessage(mensajeDeError(error, 'No se pudo cambiar el estado del producto.'));
    }
  };

  // --- Destacados ---
  const handleToggleFeatured = async (productId) => {
    try {
      const response = await api.put(`/products/${productId}/toggle-featured`);
      setProducts(prev => prev.map(p =>
        p._id === productId
          ? { ...p, isFeatured: response.data.product.isFeatured, featuredOrder: response.data.product.featuredOrder }
          : p
      ));
      showSuccessMessage(response.data.product.isFeatured ? 'Producto marcado como destacado' : 'Producto removido de destacados');
    } catch (error) {
      console.error('Error al cambiar estado destacado:', error);
      showErrorMessage(error.response?.data?.message || 'Error al cambiar el estado destacado');
    }
  };

  const handleReorderFeatured = async (newOrder) => {
    try {
      const orderedIds = newOrder.map(p => p._id);
      if (!orderedIds || orderedIds.length === 0) { showErrorMessage('No hay productos para reordenar'); return; }
      await api.put('/products/reorder-featured', { orderedIds });
      setProducts(prev => prev.map(product => {
        const index = orderedIds.indexOf(product._id);
        return index !== -1 ? { ...product, featuredOrder: index + 1 } : product;
      }));
      showSuccessMessage('Orden de destacados actualizado');
    } catch (error) {
      console.error('Error al reordenar destacados:', error);
      showErrorMessage(error.response?.data?.message || 'Error al reordenar destacados');
    }
  };

  // --- Drag & Drop destacados ---
  const handleFeaturedDragStart = (e, index) => {
    setDraggedFeaturedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFeaturedDragOver = (e, index, featuredProducts) => {
    e.preventDefault();
    if (draggedFeaturedItem === null || draggedFeaturedItem === index) return;
    const newOrder = [...featuredProducts];
    const dragged = newOrder[draggedFeaturedItem];
    newOrder.splice(draggedFeaturedItem, 1);
    newOrder.splice(index, 0, dragged);
    setDraggedFeaturedItem(index);
    handleReorderFeatured(newOrder);
  };

  const handleFeaturedDragEnd = () => setDraggedFeaturedItem(null);

  // --- Alias helpers ---
  const editProduct = (product) => {
    setEditingId(product._id);
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: product.category,
      image: product.image,
      toppingGroups: product.toppingGroups || [],
      itemType: product.itemType || 'product',
      durationMinutes: product.durationMinutes ? product.durationMinutes.toString() : '',
      trackStock: product.trackStock || false,
      stock: product.stock !== null && product.stock !== undefined ? product.stock.toString() : '',
      lowStockAlert: product.lowStockAlert !== undefined ? product.lowStockAlert.toString() : '5',
      promoActive: !!product.promo?.active,
      promoPrice: product.promo?.price != null ? String(product.promo.price) : '',
      promoEndsAt: toLocalDatetimeInput(product.promo?.endsAt),
      promoLabel: product.promo?.label || '',
    });
    setTouchedFields({});
    setShowProductModal(true);
  };

  const deleteProduct = (productId) => {
    const product = products.find(p => p._id === productId);
    if (product) handleDelete(product);
  };

  const cancelEdit = () => { resetForm(); };
  const cancelDelete = () => { setShowDeleteModal(false); setProductToDelete(null); };

  return {
    // State
    form, setForm,
    touchedFields, setTouchedFields,
    editingId,
    editingProduct, setEditingProduct,
    showConfirmModal,
    showDeleteModal,
    productToDelete,
    successMessage, setSuccessMessage,
    errorMessage, setErrorMessage,
    showProductModal, setShowProductModal,
    draggedFeaturedItem,
    // Handlers
    handleSubmit, confirmEdit,
    handleChange, handleBlur, handlePriceChange, handleToppingGroupsChange,
    handleEdit, handleDelete, confirmDelete,
    handleToggleProduct, handleToggleFeatured,
    handleReorderFeatured,
    handleFeaturedDragStart, handleFeaturedDragOver, handleFeaturedDragEnd,
    editProduct, deleteProduct,
    cancelEdit, cancelDelete,
    showSuccessMessage, showErrorMessage,
  };
}

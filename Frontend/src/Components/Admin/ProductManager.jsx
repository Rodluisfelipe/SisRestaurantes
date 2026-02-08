import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProductFormToppingSelector from '../ProductFormToppingSelector';
import ProductToppingOrderSelector from '../ProductToppingOrderSelector';

/**
 * Modal wizard de Crear/Editar producto + Grid de productos.
 * Extraído de Admin.jsx (~500 líneas) para reducir el monolito.
 *
 * Props unificadas desde Admin.jsx — recibe todo el estado necesario.
 */
export default function ProductManager({
  products,
  categories,
  toppingGroups,
  form,
  setForm,
  touchedFields,
  setTouchedFields,
  editingProduct,
  setEditingProduct,
  showProductModal,
  setShowProductModal,
  handleSubmit,
  handleChange,
  handleBlur,
  handlePriceChange,
  handleToppingGroupsChange,
  editProduct,
  deleteProduct,
  handleToggleProduct,
  handleToggleFeatured,
  setActiveTab,
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showToppingsSection, setShowToppingsSection] = useState(false);
  const nameInputRef = useRef(null);
  const priceInputRef = useRef(null);
  const toppingsSectionRef = useRef(null);

  const openCreate = () => {
    setShowProductModal(true);
    setEditingProduct(null);
    setForm({ name: '', description: '', price: '', category: '', image: '', toppingGroups: [] });
    setTouchedFields({});
    setCurrentStep(1);
    setShowToppingsSection(false);
  };

  const safeProducts = Array.isArray(products) ? products : [];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Botón Volver - Solo móvil */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="font-medium">Volver al inicio</span>
      </button>

      {/* Create Product Button */}
      <motion.button
        onClick={openCreate}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 font-bold text-lg"
      >
        <span className="text-2xl">🍔</span>
        <span>Nuevo Producto</span>
        <span className="text-2xl">+</span>
      </motion.button>

      {/* Product Form Modal */}
      <AnimatePresence>
        {showProductModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => { setShowProductModal(false); setEditingProduct(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-b from-white to-slate-50 rounded-2xl shadow-2xl border border-slate-200/50 max-w-4xl w-full h-[95vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 px-6 py-4 shadow-lg relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.div 
                      initial={{ rotate: -10, scale: 0.9 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ type: "spring", delay: 0.1 }}
                      className="w-7 h-7 bg-white/25 rounded-lg flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/30"
                    >
                      <span className="text-base">{editingProduct ? '✏️' : '🍔'}</span>
                    </motion.div>
                    <h2 className="text-lg font-bold text-white drop-shadow-sm">
                      {editingProduct ? 'Editar Producto' : 'Crear Producto'}
                    </h2>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { setShowProductModal(false); setEditingProduct(null); setCurrentStep(1); }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white shadow-lg backdrop-blur-sm border border-white/30"
                  >
                    <span className="text-base font-light">×</span>
                  </motion.button>
                </div>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex-shrink-0">
                {[
                  { num: 1, label: 'Info Básica', icon: '📋' },
                  { num: 2, label: 'Precio e Imagen', icon: '💵' },
                  { num: 3, label: 'Extras', icon: '🍟' }
                ].map((step, idx) => (
                  <div key={step.num} className="flex items-center gap-2">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                        currentStep === step.num
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md scale-105'
                          : currentStep > step.num
                          ? 'bg-green-500 text-white shadow-sm'
                          : 'bg-white text-slate-400 border border-slate-200'
                      }`}
                    >
                      <span className="text-xs">{step.icon}</span>
                      <span className="text-[11px] font-semibold hidden sm:inline">{step.label}</span>
                      <span className={`text-[10px] font-bold ${currentStep >= step.num ? 'opacity-100' : 'opacity-50'}`}>
                        {currentStep > step.num ? '✓' : step.num}
                      </span>
                    </motion.div>
                    {idx < 2 && (
                      <div className={`h-0.5 w-8 transition-all ${currentStep > step.num ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3">
                  {/* Step 1 */}
                  {currentStep === 1 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                      <div className="text-center mb-3">
                        <h3 className="text-lg font-bold text-slate-800 mb-1">📋 Información Básica</h3>
                        <p className="text-sm text-slate-600">Completa los datos principales del producto</p>
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center text-sm font-semibold text-slate-700"><span className="mr-2">🏷️</span>Nombre del Producto*</label>
                        <input ref={nameInputRef} name="name" value={form.name} onChange={handleChange} onBlur={() => handleBlur('name')}
                          className={`w-full rounded-lg border-2 bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 placeholder-slate-400 px-3 py-2 text-sm transition-all ${touchedFields.name && !form.name.trim() ? 'border-red-400 bg-red-50/50' : 'border-slate-200'}`}
                          placeholder="Ej: Hamburguesa Clásica, Pizza Margarita..." required />
                        {touchedFields.name && !form.name.trim() && <p className="text-red-600 text-sm flex items-center gap-2 font-medium"><span>⚠️</span>Este campo es obligatorio</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center text-sm font-semibold text-slate-700"><span className="mr-2">📝</span>Descripción</label>
                        <textarea name="description" value={form.description} onChange={handleChange} rows="2"
                          className="w-full rounded-lg border-2 border-slate-200 bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 placeholder-slate-400 px-3 py-2 text-sm transition-all resize-none"
                          placeholder="Describe tu producto de forma atractiva..." />
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center text-sm font-semibold text-slate-700"><span className="mr-2">📂</span>Categoría*</label>
                        <select name="category" value={form.category} onChange={handleChange} onBlur={() => handleBlur('category')}
                          className={`w-full rounded-lg border-2 bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 px-3 py-2 text-sm transition-all cursor-pointer ${touchedFields.category && !form.category ? 'border-red-400 bg-red-50/50' : 'border-slate-200'}`}>
                          <option value="">Seleccionar categoría...</option>
                          {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                        </select>
                        {touchedFields.category && !form.category && <p className="text-red-600 text-sm flex items-center gap-2 font-medium"><span>⚠️</span>Selecciona una categoría</p>}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2 */}
                  {currentStep === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                      <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">💵 Precio e Imagen</h3>
                        <p className="text-slate-600">Define el precio y añade una imagen atractiva</p>
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-semibold text-slate-700"><span className="mr-2">💰</span>Precio*</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-4"><span className="text-slate-600 font-bold text-lg">$</span></div>
                          <input ref={priceInputRef} name="price" type="text" value={form.price} onChange={handlePriceChange} onBlur={() => handleBlur('price')}
                            className={`w-full rounded-xl border-2 bg-white focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 placeholder-slate-400 pl-12 pr-4 py-3 text-base font-bold transition-all shadow-sm hover:shadow-md ${touchedFields.price && (!form.price || parseFloat(form.price.replace(/\./g, '')) <= 0) ? 'border-red-400 bg-red-50/50' : 'border-slate-200'}`}
                            placeholder="29.000" required />
                        </div>
                        {touchedFields.price && (!form.price || parseFloat(form.price.replace(/\./g, '')) <= 0) && <p className="text-red-600 text-sm flex items-center gap-2 font-medium"><span>⚠️</span>Precio inválido</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-semibold text-slate-700"><span className="mr-2">🔗</span>URL de Imagen</label>
                        <input name="image" value={form.image} onChange={handleChange}
                          className="w-full rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 placeholder-slate-400 px-4 py-3 text-base transition-all"
                          placeholder="https://ejemplo.com/imagen-producto.jpg" />
                      </div>
                      {form.image && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                          className="relative w-full h-64 rounded-xl overflow-hidden border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100">
                          <img src={form.image} alt="Preview" className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                          <div style={{ display: 'none' }} className="w-full h-full flex flex-col items-center justify-center bg-slate-100">
                            <span className="text-6xl mb-3">🖼️</span>
                            <span className="text-base text-slate-500 font-medium">No se pudo cargar la imagen</span>
                          </div>
                          <div className="absolute top-3 right-3 bg-green-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">✓ Vista previa</div>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {/* Step 3 */}
                  {currentStep === 3 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                      <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">🍟 Extras Opcionales</h3>
                        <p className="text-slate-600">Selecciona los complementos que se pueden agregar</p>
                      </div>
                      <div ref={toppingsSectionRef} className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
                        <motion.button type="button" onClick={() => setShowToppingsSection(!showToppingsSection)}
                          whileHover={{ backgroundColor: 'rgb(248 250 252)' }} whileTap={{ scale: 0.99 }}
                          className="w-full flex items-center justify-between px-5 py-4 bg-white transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center"><span className="text-2xl">🧀</span></div>
                            <div className="text-left">
                              <span className="text-base font-bold text-slate-800 block">Extras Disponibles</span>
                              <span className="text-sm text-slate-500">Agrega complementos opcionales al producto</span>
                            </div>
                            {form.toppingGroups?.length > 0 && (
                              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                                className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm px-3 py-1.5 rounded-full font-bold shadow-md">
                                {form.toppingGroups.length} seleccionados
                              </motion.span>
                            )}
                          </div>
                          <motion.svg animate={{ rotate: showToppingsSection ? 180 : 0 }} transition={{ duration: 0.3 }}
                            className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </motion.svg>
                        </motion.button>
                        <AnimatePresence>
                          {showToppingsSection && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }} className="border-t-2 border-slate-200">
                              <div className="p-6 bg-slate-50/50 space-y-5">
                                <ProductFormToppingSelector toppingGroups={toppingGroups} selectedToppings={form.toppingGroups} onChange={handleToppingGroupsChange} />
                                {form.toppingGroups?.length > 0 && (
                                  <div className="pt-5 border-t-2 border-slate-200">
                                    <div className="flex items-center gap-3 mb-4">
                                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><span className="text-lg">🔄</span></div>
                                      <div>
                                        <span className="text-base font-bold text-slate-800 block">Orden de Extras</span>
                                        <span className="text-sm text-slate-500">Arrastra para reordenar</span>
                                      </div>
                                    </div>
                                    <ProductToppingOrderSelector selectedToppings={form.toppingGroups} onChange={handleToppingGroupsChange} />
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      {(!form.toppingGroups || form.toppingGroups.length === 0) && !showToppingsSection && (
                        <div className="text-center py-8 text-slate-500">
                          <p className="text-sm">No se han seleccionado extras. Haz clic arriba para agregar.</p>
                          <p className="text-xs mt-1">Esto es opcional - puedes continuar sin extras.</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </form>

              {/* Wizard Navigation */}
              <div className="border-t border-slate-200 bg-white p-4 shadow-lg flex-shrink-0">
                <div className="flex gap-3">
                  {currentStep > 1 && (
                    <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentStep(prev => prev - 1)}
                      className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-semibold flex items-center justify-center gap-2 text-sm">
                      <span className="text-xl">←</span><span>Anterior</span>
                    </motion.button>
                  )}
                  {editingProduct && currentStep === 1 && (
                    <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => { setEditingProduct(null); setForm({ name: '', description: '', price: '', category: '', image: '', toppingGroups: [] }); setTouchedFields({}); setCurrentStep(1); setShowToppingsSection(false); setShowProductModal(false); }}
                      className="flex-1 px-5 py-3 border-2 border-red-300 text-red-700 rounded-xl hover:bg-red-50 transition-all font-semibold flex items-center justify-center gap-2 text-base">
                      <span className="text-xl">❌</span><span>Cancelar</span>
                    </motion.button>
                  )}
                  {currentStep < 3 ? (
                    <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (currentStep === 1 && (!form.name.trim() || !form.category)) {
                          setTouchedFields(prev => ({ ...prev, name: true, category: true }));
                          return;
                        }
                        if (currentStep === 2 && (!form.price || parseFloat(form.price.replace(/\./g, '')) <= 0)) {
                          setTouchedFields(prev => ({ ...prev, price: true }));
                          return;
                        }
                        setCurrentStep(prev => prev + 1);
                      }}
                      className="flex-1 px-5 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all font-semibold shadow-lg flex items-center justify-center gap-2 text-base">
                      <span>Siguiente</span><span className="text-xl">→</span>
                    </motion.button>
                  ) : (
                    <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.preventDefault();
                        const modalContent = e.target.closest('.bg-gradient-to-b');
                        const formElement = modalContent?.querySelector('form');
                        if (formElement) formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                      }}
                      className="flex-1 px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all font-semibold shadow-lg flex items-center justify-center gap-2 text-base">
                      <span>{editingProduct ? '✏️' : '✨'}</span>
                      <span>{editingProduct ? 'Actualizar Producto' : 'Crear Producto'}</span>
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {safeProducts.map((product, index) => (
          <motion.div
            key={product._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className={`group rounded-xl shadow-lg border overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full ${
              product.active !== false ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200 opacity-75'
            }`}
          >
            <div className="relative overflow-hidden flex-shrink-0">
              <img src={product.image || 'https://placehold.co/400x300?text=🍔'} alt={product.name}
                className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
              <div className="absolute top-3 left-3">
                <div className="bg-green-500 text-white px-3 py-1 rounded-full font-bold shadow-md">
                  <span className="text-sm">${Number(product.price).toLocaleString('es-CO')}</span>
                </div>
              </div>
              <div className="absolute top-3 right-3 flex flex-col gap-2">
                {product.isFeatured && (
                  <div className="flex justify-end">
                    <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1">⭐ Destacado</span>
                  </div>
                )}
                <div className="flex justify-end">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold shadow-md ${product.active !== false ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {product.active !== false ? '🟢 Activo' : '🔴 Inactivo'}
                  </span>
                </div>
                {product.category && (
                  <div className="flex justify-end">
                    <span className="bg-white/90 backdrop-blur-sm text-gray-700 px-2 py-1 rounded-full text-xs font-medium shadow-md max-w-[100px] truncate">
                      📂 {categories.find(c => c._id === product.category)?.name || 'Sin categoría'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 flex-grow flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">{product.name}</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-2 flex-grow">{product.description}</p>
              <div className="grid grid-cols-2 gap-2 mt-auto">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => editProduct(product)}
                  className="bg-blue-500 text-white px-3 py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition-all shadow-md flex items-center justify-center gap-2">
                  <span className="text-base">✏️</span><span className="text-sm">Editar</span>
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleToggleProduct(product._id)}
                  className={`px-3 py-2.5 rounded-lg font-semibold transition-all shadow-md flex items-center justify-center gap-2 ${product.active !== false ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                  <span className="text-base">{product.active !== false ? '⏸️' : '▶️'}</span>
                  <span className="text-sm">{product.active !== false ? 'Pausar' : 'Activar'}</span>
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => deleteProduct(product._id)}
                  className="bg-red-500 text-white px-3 py-2.5 rounded-lg font-semibold hover:bg-red-600 transition-all shadow-md flex items-center justify-center gap-2">
                  <span className="text-base">🗑️</span><span className="text-sm">Eliminar</span>
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleToggleFeatured(product._id)}
                  className={`px-3 py-2.5 rounded-lg font-semibold transition-all shadow-md flex items-center justify-center gap-2 ${product.isFeatured ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                  <span className="text-base">⭐</span><span className="text-sm">{product.isFeatured ? 'Destacado' : 'Destacar'}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

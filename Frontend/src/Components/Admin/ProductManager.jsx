import { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ProductFormToppingSelector from '../ProductFormToppingSelector';
import ProductToppingOrderSelector from '../ProductToppingOrderSelector';
import ImageUploader from './ImageUploader';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import AI from './AdminIcons';
import {
  FaPlus, FaTimes, FaEdit, FaPause, FaPlay, FaTrash, FaStar,
  FaChevronLeft, FaChevronDown, FaChevronRight, FaCheck,
  FaTag, FaAlignLeft, FaFolderOpen, FaDollarSign, FaImage,
  FaCheese, FaGripVertical, FaExclamationTriangle, FaMagic, FaClock
} from 'react-icons/fa';

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
  enableBookings,
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showToppingsSection, setShowToppingsSection] = useState(false);
  const [aiNames, setAiNames] = useState([]);
  const [aiNamesLoading, setAiNamesLoading] = useState(false);
  const [showAiNames, setShowAiNames] = useState(false);
  const nameInputRef = useRef(null);
  const priceInputRef = useRef(null);
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  // Generate AI names
  const generateAiNames = async () => {
    const desc = form.description || form.name;
    if (!desc.trim()) return;
    setAiNamesLoading(true);
    setShowAiNames(true);
    try {
      const categoryName = categories.find(c => c._id === form.category)?.name || '';
      const res = await api.post('/ai-tools/generate-names', {
        description: desc.trim(),
        category: categoryName
      });
      setAiNames(res.data.names || []);
    } catch {
      setAiNames([]);
    } finally {
      setAiNamesLoading(false);
    }
  };

  const selectAiName = (name) => {
    setForm(prev => ({ ...prev, name }));
    setShowAiNames(false);
    setAiNames([]);
  };

  const openCreate = () => {
    setShowProductModal(true);
    setEditingProduct(null);
    setForm({ name: '', description: '', price: '', category: '', image: '', toppingGroups: [], itemType: 'product', durationMinutes: '' });
    setTouchedFields({});
    setCurrentStep(1);
    setShowToppingsSection(false);
  };

  const safeProducts = Array.isArray(products) ? products : [];

  return (
    <div className="space-y-4">
      {/* Botón Volver - Solo móvil */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className="lg:hidden flex items-center gap-2 text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm"
      >
        <FaChevronLeft className="text-xs" />
        <span className="font-medium">Volver</span>
      </button>

      {/* Create Product Button */}
      <button
        onClick={openCreate}
        className="flex items-center gap-2 bg-red-500 lg:bg-blue-600 hover:opacity-90 text-white px-4 py-2.5 lg:py-2 rounded-xl lg:rounded-lg transition-colors text-[13px] lg:text-sm font-semibold lg:font-medium shadow-sm active:scale-[0.97] lg:active:scale-100 w-full lg:w-auto justify-center lg:justify-start"
      >
        <FaPlus className="text-xs" />
        <span>{isService ? 'Nuevo Servicio' : 'Nuevo Producto'}</span>
      </button>

      {/* Product Form Modal */}
      <AnimatePresence>
        {showProductModal && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex lg:items-center items-end justify-center lg:p-4"
            onClick={() => { setShowProductModal(false); setEditingProduct(null); }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-2xl lg:rounded-xl shadow-xl border border-slate-100 lg:border-slate-200 max-w-2xl w-full max-h-[92vh] lg:max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    {editingProduct ? <FaEdit className="text-blue-500 text-xs" /> : <FaPlus className="text-blue-500 text-xs" />}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingProduct ? (isService ? 'Editar Servicio' : 'Editar Producto') : (isService ? 'Nuevo Servicio' : 'Nuevo Producto')}
                  </h2>
                </div>
                <button
                  onClick={() => { setShowProductModal(false); setEditingProduct(null); setCurrentStep(1); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <FaTimes className="text-sm" />
                </button>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                {[
                  { num: 1, label: 'Info' },
                  { num: 2, label: 'Precio' },
                  { num: 3, label: 'Extras' }
                ].map((step, idx) => (
                  <div key={step.num} className="flex items-center gap-1.5">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      currentStep === step.num
                        ? 'bg-blue-600 text-white'
                        : currentStep > step.num
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-white text-slate-400 border border-slate-200'
                    }`}>
                      <span className="text-[10px] font-bold">
                        {currentStep > step.num ? <FaCheck className="text-[9px]" /> : step.num}
                      </span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </div>
                    {idx < 2 && (
                      <div className={`h-px w-5 ${currentStep > step.num ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-4">
                  {/* Step 1 */}
                  {currentStep === 1 && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                            <FaTag className="text-slate-400 text-[10px]" />Nombre *
                          </label>
                          <button
                            type="button"
                            onClick={generateAiNames}
                            disabled={aiNamesLoading || (!form.description.trim() && !form.name.trim())}
                            className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-700 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors px-2 py-0.5 rounded-md hover:bg-violet-50"
                            title="La IA sugiere nombres creativos basados en la descripción"
                          >
                            {aiNamesLoading ? (
                              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" /></svg>
                            ) : (
                              <FaMagic className="text-[10px]" />
                            )}
                            {aiNamesLoading ? 'Generando...' : <><span className="inline-flex items-center gap-0.5">{AI.sparkle('w-3 h-3')} Sugerir nombres</span></>}
                          </button>
                        </div>
                        <input ref={nameInputRef} name="name" value={form.name} onChange={handleChange} onBlur={() => handleBlur('name')}
                          className={`w-full rounded-lg border bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-3 py-2 text-sm transition-all ${touchedFields.name && !form.name.trim() ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}
                          placeholder="Ej: Hamburguesa Clásica" required />
                        {touchedFields.name && !form.name.trim() && (
                          <p className="text-red-500 text-xs flex items-center gap-1"><FaExclamationTriangle className="text-[10px]" />Campo obligatorio</p>
                        )}
                        {/* AI Name Suggestions */}
                        <AnimatePresence>
                          {showAiNames && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-1.5 bg-violet-50 border border-violet-200 rounded-xl p-2.5 space-y-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide flex items-center gap-1">
                                    <FaMagic className="text-[8px]" /> Nombres sugeridos por IA
                                  </span>
                                  <button type="button" onClick={() => setShowAiNames(false)} className="text-violet-400 hover:text-violet-600">
                                    <FaTimes className="text-[10px]" />
                                  </button>
                                </div>
                                {aiNamesLoading ? (
                                  <div className="flex items-center gap-2 py-2 px-1">
                                    <svg className="w-4 h-4 animate-spin text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" /></svg>
                                    <span className="text-xs text-violet-500">Pensando nombres creativos...</span>
                                  </div>
                                ) : aiNames.length > 0 ? (
                                  aiNames.map((name, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => selectAiName(name)}
                                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-violet-100 rounded-lg transition-colors flex items-center justify-between group"
                                    >
                                      <span>{name}</span>
                                      <span className="text-[10px] text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">Usar</span>
                                    </button>
                                  ))
                                ) : (
                                  <p className="text-xs text-slate-500 py-1 px-1">No se pudieron generar nombres. Intenta agregar una descripción primero.</p>
                                )}
                                {aiNames.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={generateAiNames}
                                    className="w-full text-center text-[11px] text-violet-500 hover:text-violet-700 font-medium pt-1 transition-colors"
                                  >
                                    <span className="inline-flex items-center gap-0.5">{AI.arrowPath('w-3 h-3')} Generar más nombres</span>
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <FaAlignLeft className="text-slate-400 text-[10px]" />Descripción
                        </label>
                        <textarea name="description" value={form.description} onChange={handleChange} rows="2"
                          className="w-full rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400 px-3 py-2 text-sm transition-all resize-none"
                          placeholder={isService ? 'Describe tu servicio...' : 'Describe tu producto...'} />
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <FaFolderOpen className="text-slate-400 text-[10px]" />Categoría *
                        </label>
                        <select name="category" value={form.category} onChange={handleChange} onBlur={() => handleBlur('category')}
                          className={`w-full rounded-lg border bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900 px-3 py-2 text-sm transition-all cursor-pointer ${touchedFields.category && !form.category ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
                          <option value="">Seleccionar categoría...</option>
                          {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                        </select>
                        {touchedFields.category && !form.category && (
                          <p className="text-red-500 text-xs flex items-center gap-1"><FaExclamationTriangle className="text-[10px]" />Selecciona una categoría</p>
                        )}
                      </div>

                      {/* Item Type & Duration (only when bookings enabled) */}
                      {enableBookings && (
                        <>
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                              <FaTag className="text-slate-400 text-[10px]" />Tipo de artículo
                            </label>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setForm(prev => ({ ...prev, itemType: 'product', durationMinutes: '' }))}
                                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                                  form.itemType !== 'service' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}>
                                <span className="inline-flex items-center gap-1">{AI.cube('w-3.5 h-3.5')} Producto</span>
                              </button>
                              <button type="button" onClick={() => setForm(prev => ({ ...prev, itemType: 'service' }))}
                                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                                  form.itemType === 'service' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}>
                                <span className="inline-flex items-center gap-1">{AI.calendar('w-3.5 h-3.5')} Servicio</span>
                              </button>
                            </div>
                          </div>
                          {form.itemType === 'service' && (
                            <div className="space-y-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                                <FaClock className="text-slate-400 text-[10px]" />Duración del servicio *
                              </label>
                              <select name="durationMinutes" value={form.durationMinutes} onChange={handleChange}
                                className="w-full rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 px-3 py-2 text-sm transition-all cursor-pointer">
                                <option value="">Seleccionar duración...</option>
                                <option value="15">15 minutos</option>
                                <option value="30">30 minutos</option>
                                <option value="45">45 minutos</option>
                                <option value="60">1 hora</option>
                                <option value="90">1 hora 30 min</option>
                                <option value="120">2 horas</option>
                              </select>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Step 2 */}
                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <FaDollarSign className="text-slate-400 text-[10px]" />Precio *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-slate-500 font-semibold text-sm">$</span></div>
                          <input ref={priceInputRef} name="price" type="text" inputMode="decimal" value={form.price} onChange={handlePriceChange} onBlur={() => handleBlur('price')}
                            className={`w-full rounded-lg border bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400 pl-8 pr-3 py-2 text-sm font-semibold transition-all ${touchedFields.price && (!form.price || parseFloat(form.price.replace(/\./g, '')) <= 0) ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}
                            placeholder="29.000" required />
                        </div>
                        {touchedFields.price && (!form.price || parseFloat(form.price.replace(/\./g, '')) <= 0) && (
                          <p className="text-red-500 text-xs flex items-center gap-1"><FaExclamationTriangle className="text-[10px]" />Precio inválido</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <FaImage className="text-slate-400 text-[10px]" />{isService ? 'Imagen del servicio' : 'Imagen del producto'}
                        </label>
                        <ImageUploader
                          value={form.image}
                          onChange={(url) => setForm(prev => ({ ...prev, image: url }))}
                          folder="products"
                          maxWidth={800}
                          quality={80}
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 3 */}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <button type="button" onClick={() => setShowToppingsSection(!showToppingsSection)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                              <FaCheese className="text-orange-500 text-sm" />
                            </div>
                            <div className="text-left">
                              <span className="text-sm font-semibold text-slate-800 block">Extras Disponibles</span>
                              <span className="text-xs text-slate-500">Complementos opcionales</span>
                            </div>
                            {form.toppingGroups?.length > 0 && (
                              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                {form.toppingGroups.length}
                              </span>
                            )}
                          </div>
                          <FaChevronDown className={`text-xs text-slate-400 transition-transform duration-200 ${showToppingsSection ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {showToppingsSection && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }} className="border-t border-slate-200">
                              <div className="p-4 bg-slate-50/50 space-y-4">
                                <ProductFormToppingSelector toppingGroups={toppingGroups} selectedToppings={form.toppingGroups} onChange={handleToppingGroupsChange} />
                                {form.toppingGroups?.length > 0 && (
                                  <div className="pt-4 border-t border-slate-200">
                                    <div className="flex items-center gap-2 mb-3">
                                      <FaGripVertical className="text-slate-400 text-xs" />
                                      <span className="text-xs font-semibold text-slate-700">Orden de Extras</span>
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
                        <div className="text-center py-6 text-slate-400">
                          <p className="text-xs">Sin extras seleccionados. Esto es opcional.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </form>

              {/* Wizard Navigation */}
              <div className="border-t border-slate-100 bg-white px-5 py-3 flex-shrink-0">
                <div className="flex gap-2">
                  {currentStep > 1 && (
                    <button type="button"
                      onClick={() => setCurrentStep(prev => prev - 1)}
                      className="flex-1 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center justify-center gap-1.5">
                      <FaChevronLeft className="text-[10px]" /><span>Anterior</span>
                    </button>
                  )}
                  {editingProduct && currentStep === 1 && (
                    <button type="button"
                      onClick={() => { setEditingProduct(null); setForm({ name: '', description: '', price: '', category: '', image: '', toppingGroups: [] }); setTouchedFields({}); setCurrentStep(1); setShowToppingsSection(false); setShowProductModal(false); }}
                      className="flex-1 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium flex items-center justify-center gap-1.5">
                      <FaTimes className="text-[10px]" /><span>Cancelar</span>
                    </button>
                  )}
                  {currentStep < 3 ? (
                    <button type="button"
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
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-1.5">
                      <span>Siguiente</span><FaChevronRight className="text-[10px]" />
                    </button>
                  ) : (
                    <button type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSubmit(e);
                      }}
                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-1.5">
                      <FaCheck className="text-[10px]" />
                      <span>{editingProduct ? 'Actualizar' : (isService ? 'Crear Servicio' : 'Crear Producto')}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {safeProducts.map((product) => {
          const categoryName = categories.find(c => c._id === product.category)?.name || 'Sin categoría';
          const isActive = product.active !== false;

          return (
            <div
              key={product._id}
              className={`group rounded-2xl lg:rounded-xl border overflow-hidden transition-all hover:shadow-md flex flex-col active:scale-[0.98] lg:active:scale-100 ${
                isActive ? 'bg-white border-slate-100 lg:border-slate-200' : 'bg-slate-50 border-red-200 opacity-70'
              }`}
            >
              {/* Image */}
              <div className="relative h-36 overflow-hidden flex-shrink-0 bg-slate-100">
                <img
                  src={product.image || 'https://placehold.co/400x300?text=Sin+imagen'}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* Price badge */}
                <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm text-slate-900 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
                  ${Number(product.price).toLocaleString('es-CO')}
                </div>
                {/* Status badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  {product.isFeatured && (
                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-0.5">
                      <FaStar className="text-[8px]" /> Destacado
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-3 flex-grow flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">{product.name}</h3>
                </div>
                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-1.5">
                  <FaFolderOpen className="text-[8px]" /> {categoryName}
                </span>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 flex-grow mb-3">{product.description}</p>

                {/* Actions */}
                <div className="flex gap-1.5">
                  <button onClick={() => editProduct(product)}
                    className="flex-1 flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-2.5 min-h-[44px] rounded-lg text-[11px] font-medium transition-colors"
                    title="Editar">
                    <FaEdit className="text-[10px]" /><span>Editar</span>
                  </button>
                  <button onClick={() => handleToggleProduct(product._id)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-2.5 min-h-[44px] rounded-lg text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-600'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                    }`}
                    title={isActive ? 'Pausar' : 'Activar'}>
                    {isActive ? <FaPause className="text-[10px]" /> : <FaPlay className="text-[10px]" />}
                    <span>{isActive ? 'Pausar' : 'Activar'}</span>
                  </button>
                  <button onClick={() => deleteProduct(product._id)}
                    className="flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 p-2.5 min-h-[44px] rounded-lg transition-colors"
                    title="Eliminar">
                    <FaTrash className="text-[10px]" />
                  </button>
                  <button onClick={() => handleToggleFeatured(product._id)}
                    className={`flex items-center justify-center p-2.5 min-h-[44px] rounded-lg transition-colors ${
                      product.isFeatured
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-600'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-400'
                    }`}
                    title={product.isFeatured ? 'Quitar destacado' : 'Destacar'}>
                    <FaStar className="text-[10px]" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

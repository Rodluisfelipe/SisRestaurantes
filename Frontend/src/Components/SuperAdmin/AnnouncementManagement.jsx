import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BACKEND_URL } from '../../config';

const API_BASE = `${BACKEND_URL}/api`;
const IMG_BASE = BACKEND_URL;

const priorityOptions = [
  { value: 'low', label: 'Nota', icon: 'ℹ️', color: 'bg-gray-500' },
  { value: 'medium', label: 'Información', icon: '📢', color: 'bg-blue-500' },
  { value: 'high', label: 'Importante', icon: '⚠️', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgente', icon: '🚨', color: 'bg-red-500' },
];

function AnnouncementManagement() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', priority: 'medium', image: null });
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const getToken = () => localStorage.getItem('superadmin_token');

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/announcements`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Error al cargar anuncios');
      const data = await res.json();
      setAnnouncements(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const resetForm = () => {
    setForm({ title: '', body: '', priority: 'medium', image: null });
    setImagePreview(null);
    setEditingId(null);
    setShowForm(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no puede superar 5MB');
        return;
      }
      setForm(prev => ({ ...prev, image: file }));
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError('Título y contenido son requeridos');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', form.title.trim());
      formData.append('body', form.body.trim());
      formData.append('priority', form.priority);
      if (form.image instanceof File) {
        formData.append('image', form.image);
      }

      const url = editingId
        ? `${API_BASE}/announcements/${editingId}`
        : `${API_BASE}/announcements`;
      
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error al guardar');
      }

      setSuccess(editingId ? 'Anuncio actualizado' : 'Anuncio creado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
      resetForm();
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (announcement) => {
    setForm({
      title: announcement.title,
      body: announcement.body,
      priority: announcement.priority,
      image: null
    });
    if (announcement.image) {
      setImagePreview(`${IMG_BASE}${announcement.image}`);
    }
    setEditingId(announcement._id);
    setShowForm(true);
  };

  const handleToggleActive = async (id, currentState) => {
    try {
      const formData = new FormData();
      formData.append('isActive', !currentState);
      
      const res = await fetch(`${API_BASE}/announcements/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData
      });
      
      if (!res.ok) throw new Error('Error al cambiar estado');
      
      setSuccess(!currentState ? 'Anuncio activado' : 'Anuncio desactivado');
      setTimeout(() => setSuccess(''), 3000);
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este anuncio? Esta acción no se puede deshacer.')) return;
    
    try {
      const res = await fetch(`${API_BASE}/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (!res.ok) throw new Error('Error al eliminar');
      
      setSuccess('Anuncio eliminado');
      setTimeout(() => setSuccess(''), 3000);
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleViewDetail = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/announcements/${id}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Error al cargar detalle');
      const data = await res.json();
      setSelectedAnnouncement(data);
      setShowDetail(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const getPriorityConfig = (priority) => {
    return priorityOptions.find(p => p.value === priority) || priorityOptions[1];
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-200 dark:bg-red-500/20 border border-red-200 dark:border-red-500/50 text-red-200 px-4 py-3 rounded-xl flex items-center justify-between"
          >
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-300 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white ml-2">&times;</button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-green-500/20 border border-green-500/50 text-green-200 px-4 py-3 rounded-xl"
          >
            ✅ {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header + Create Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-slate-600 dark:text-white/60 text-sm">
            Crea anuncios que se mostrarán como popup en los dashboards de los negocios
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-5 py-2.5 bg-[#5FF9B4] text-[#051C2C] rounded-xl font-bold shadow-lg hover:bg-[#5FF9B4]/90 transition-colors flex items-center gap-2 whitespace-nowrap text-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Anuncio
        </motion.button>
      </div>

      {/* Create/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-[#2A3544] rounded-2xl p-5 sm:p-6 border border-[#333F50] space-y-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {editingId ? '✏️ Editar Anuncio' : '📝 Nuevo Anuncio'}
              </h3>

              {/* Title */}
              <div>
                <label className="block text-slate-800 dark:text-white/80 text-sm font-medium mb-1.5">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-[#1A2433] border border-[#333F50] text-slate-900 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5FF9B4] focus:border-transparent outline-none transition-all text-sm"
                  placeholder="Ej: Cambio de precio en la suscripción"
                  maxLength={150}
                  required
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-slate-800 dark:text-white/80 text-sm font-medium mb-1.5">Contenido *</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(prev => ({ ...prev, body: e.target.value }))}
                  className="w-full bg-[#1A2433] border border-[#333F50] text-slate-900 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5FF9B4] focus:border-transparent outline-none transition-all text-sm min-h-[120px] resize-y"
                  placeholder="Escribe el contenido del anuncio..."
                  maxLength={2000}
                  required
                />
                <p className="text-slate-500 dark:text-white/40 text-xs mt-1">{form.body.length}/2000</p>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-slate-800 dark:text-white/80 text-sm font-medium mb-1.5">Prioridad</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {priorityOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, priority: opt.value }))}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border-2 flex items-center justify-center gap-1.5 ${
                        form.priority === opt.value
                          ? `${opt.color} text-slate-900 dark:text-white border-transparent shadow-lg`
                          : 'bg-[#1A2433] text-slate-700 dark:text-white/70 border-[#333F50] hover:border-white/30'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="block text-slate-800 dark:text-white/80 text-sm font-medium mb-1.5">Imagen (opcional)</label>
                <div className="flex items-start gap-4">
                  <label className="flex-1 cursor-pointer">
                    <div className="bg-[#1A2433] border-2 border-dashed border-[#333F50] rounded-xl p-4 text-center hover:border-[#5FF9B4]/50 transition-colors">
                      <svg className="w-8 h-8 mx-auto text-slate-500 dark:text-white/40 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                      <p className="text-slate-600 dark:text-white/50 text-xs">Clic para subir imagen</p>
                      <p className="text-slate-500 dark:text-white/30 text-xs mt-1">JPG, PNG, WEBP (máx 5MB)</p>
                    </div>
                    <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
                  </label>
                  {imagePreview && (
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-[#333F50] shrink-0">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setForm(prev => ({ ...prev, image: null })); setImagePreview(null); }}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-slate-900 dark:text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#5FF9B4] text-[#051C2C] py-3 rounded-xl font-bold hover:bg-[#5FF9B4]/90 transition-colors disabled:opacity-50 text-sm"
                >
                  {submitting ? 'Guardando...' : (editingId ? 'Actualizar Anuncio' : 'Publicar Anuncio')}
                </motion.button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 bg-[#333F50] text-slate-900 dark:text-white rounded-xl hover:bg-[#333F50]/80 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Announcements List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-3 border-[#5FF9B4] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-600 dark:text-white/50 text-sm">Cargando anuncios...</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl mb-4 block">📭</span>
          <p className="text-slate-600 dark:text-white/60 text-lg font-medium">No hay anuncios creados</p>
          <p className="text-slate-500 dark:text-white/40 text-sm mt-1">Crea tu primer anuncio para notificar a los negocios</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann, idx) => {
            const pConfig = getPriorityConfig(ann.priority);
            return (
              <motion.div
                key={ann._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-[#2A3544] rounded-xl border border-[#333F50] overflow-hidden hover:border-[#5FF9B4]/30 transition-colors ${!ann.isActive ? 'opacity-60' : ''}`}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pConfig.color} text-slate-900 dark:text-white`}>
                          {pConfig.icon} {pConfig.label}
                        </span>
                        {!ann.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-600 text-gray-300">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <h4 className="text-slate-900 dark:text-white font-bold text-base truncate">{ann.title}</h4>
                      <p className="text-slate-600 dark:text-white/50 text-sm mt-1 line-clamp-2">{ann.body}</p>
                      <p className="text-slate-500 dark:text-white/30 text-xs mt-2">
                        {new Date(ann.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    {/* Right: Stats + Image thumbnail */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {ann.image && (
                        <img
                          src={`${IMG_BASE}${ann.image}`}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover border border-[#333F50]"
                        />
                      )}
                      {/* Seen stats */}
                      <button
                        onClick={() => handleViewDetail(ann._id)}
                        className="flex items-center gap-1.5 text-xs group"
                        title="Ver quién lo ha visto"
                      >
                        <svg className="w-4 h-4 text-slate-500 dark:text-white/40 group-hover:text-[#5FF9B4] transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-slate-600 dark:text-white/50 group-hover:text-[#5FF9B4] transition-colors font-medium">
                          {ann.seenCount}/{ann.totalBusinesses}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          ann.seenPercentage >= 80 ? 'bg-green-500/20 text-green-400' :
                          ann.seenPercentage >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-200 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                        }`}>
                          {ann.seenPercentage}%
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#333F50]">
                    <button
                      onClick={() => handleEdit(ann)}
                      className="px-3 py-1.5 bg-cyan-200 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-200 dark:hover:bg-cyan-500/30 transition-colors"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(ann._id, ann.isActive)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        ann.isActive
                          ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {ann.isActive ? '⏸ Desactivar' : '▶️ Activar'}
                    </button>
                    <button
                      onClick={() => handleViewDetail(ann._id)}
                      className="px-3 py-1.5 bg-[#5FF9B4]/20 text-[#5FF9B4] rounded-lg text-xs font-medium hover:bg-[#5FF9B4]/30 transition-colors"
                    >
                      👁 Detalle
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => handleDelete(ann._id)}
                      className="px-3 py-1.5 bg-red-200 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors"
                    >
                      🗑 Eliminar
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetail && selectedAnnouncement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDetail(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A2433] rounded-2xl border border-[#333F50] w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 sm:p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedAnnouncement.title}</h3>
                    <p className="text-slate-500 dark:text-white/40 text-xs mt-1">
                      {new Date(selectedAnnouncement.createdAt).toLocaleDateString('es-CO', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDetail(false)}
                    className="w-8 h-8 rounded-full bg-[#333F50] text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Image */}
                {selectedAnnouncement.image && (
                  <img
                    src={`${IMG_BASE}${selectedAnnouncement.image}`}
                    alt=""
                    className="w-full rounded-xl object-contain max-h-48 bg-[#333F50] mb-4"
                  />
                )}

                {/* Body */}
                <p className="text-slate-700 dark:text-white/70 text-sm whitespace-pre-line mb-6">{selectedAnnouncement.body}</p>

                {/* Seen Stats */}
                <div className="bg-[#2A3544] rounded-xl p-4 border border-[#333F50]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-slate-900 dark:text-white font-bold text-sm">Lectura por negocios</h4>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      selectedAnnouncement.seenPercentage >= 80 ? 'bg-green-500/20 text-green-400' :
                      selectedAnnouncement.seenPercentage >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-200 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                    }`}>
                      {selectedAnnouncement.seenCount}/{selectedAnnouncement.totalBusinesses} ({selectedAnnouncement.seenPercentage}%)
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-[#333F50] rounded-full h-2 mb-4">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        selectedAnnouncement.seenPercentage >= 80 ? 'bg-green-400' :
                        selectedAnnouncement.seenPercentage >= 40 ? 'bg-yellow-400' :
                        'bg-red-400'
                      }`}
                      style={{ width: `${selectedAnnouncement.seenPercentage}%` }}
                    />
                  </div>

                  {/* Seen List */}
                  {selectedAnnouncement.seenBy && selectedAnnouncement.seenBy.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedAnnouncement.seenBy.map((seen, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-[#333F50] last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-green-400 text-sm">✓</span>
                            <div>
                              <p className="text-slate-900 dark:text-white text-sm font-medium">
                                {seen.businessId?.restaurantName || 'Negocio'}
                              </p>
                              <p className="text-slate-500 dark:text-white/40 text-xs">
                                {seen.adminId?.name || seen.adminId?.email || ''}
                              </p>
                            </div>
                          </div>
                          <p className="text-slate-500 dark:text-white/40 text-xs">
                            {new Date(seen.seenAt).toLocaleDateString('es-CO', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 dark:text-white/40 text-sm text-center py-4">
                      Ningún negocio ha visto este anuncio aún
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AnnouncementManagement;

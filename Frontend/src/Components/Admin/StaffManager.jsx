import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUserPlus, FaTrash, FaUsers, FaEye, FaEyeSlash, FaTimes, FaCamera, FaSave, FaToggleOn, FaToggleOff, FaClock, FaPercent, FaDollarSign, FaEdit, FaCheck } from 'react-icons/fa';
import api from '../../services/api';

const ROLE_LABELS = { staff: 'Cajero', manager: 'Gerente' };
const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_SCHEDULE = DAYS.reduce((acc, d) => {
  acc[d.key] = { isOpen: false, openTime: '09:00', closeTime: '18:00' };
  return acc;
}, {});

// ── Edit Profile Modal ──
const EditProfileModal = ({ member, businessId, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: member.name || '',
    phone: member.phone || '',
    specialty: member.specialty || '',
    bio: member.bio || '',
    profileImage: member.profileImage || '',
    isPublic: member.isPublic || false,
    commissionType: member.commissionType || 'none',
    commissionValue: member.commissionValue || 0,
    schedule: member.schedule || { ...DEFAULT_SCHEDULE },
    servicesOffered: member.servicesOffered || [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [services, setServices] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');

  // Fetch available services/products
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await api.get(`/products?businessId=${businessId}`);
        const products = res.data.products || res.data || [];
        setServices(products.filter(p => p.itemType === 'service' || !p.itemType));
      } catch { /* empty */ }
    };
    fetchServices();
  }, [businessId]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'staff');
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { businessId }
      });
      setForm(f => ({ ...f, profileImage: res.data.url }));
    } catch (err) {
      setError('Error al subir imagen');
    }
    setUploading(false);
  };

  const handleScheduleChange = (day, field, value) => {
    setForm(f => ({
      ...f,
      schedule: {
        ...f.schedule,
        [day]: { ...(f.schedule[day] || DEFAULT_SCHEDULE[day]), [field]: value }
      }
    }));
  };

  const toggleService = (productId) => {
    setForm(f => {
      const current = f.servicesOffered || [];
      const id = typeof productId === 'object' ? productId._id || productId : productId;
      return {
        ...f,
        servicesOffered: current.includes(id) ? current.filter(s => s !== id) : [...current, id]
      };
    });
  };

  const handleSave = async () => {
    setError('');
    if (form.commissionType === 'percentage' && form.commissionValue > 100) {
      setError('El porcentaje de comisión no puede exceder 100%');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, businessId };
      // Clean schedule: only send days that are configured
      if (payload.schedule) {
        const hasAnyDay = Object.values(payload.schedule).some(d => d.isOpen);
        if (!hasAnyDay) payload.schedule = null;
      }
      await api.patch(`/auth/staff/${member._id}`, payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Error al guardar');
    }
    setSaving(false);
  };

  const tabs = [
    { id: 'profile', label: 'Perfil' },
    { id: 'schedule', label: 'Horario' },
    { id: 'commission', label: 'Comisión' },
    { id: 'services', label: 'Servicios' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex lg:items-center items-end justify-center lg:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-t-2xl lg:rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] lg:max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Editar perfil</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <FaTimes className="text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2.5 text-xs font-semibold transition-colors relative ${
                activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── Profile Tab ── */}
          {activeTab === 'profile' && (
            <>
              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                  {form.profileImage ? (
                    <img src={form.profileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-2xl font-bold">
                      {(form.name || member.username || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                    <FaCamera className="text-white text-sm" />
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">{member.username}</p>
                  <p className="text-xs text-slate-400">{ROLE_LABELS[member.role] || member.role}</p>
                  {uploading && <p className="text-xs text-blue-500 mt-1">Subiendo imagen...</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre</label>
                  <input
                    type="text" value={form.name} maxLength={100}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-200 focus:border-transparent lg:focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Especialidad</label>
                  <input
                    type="text" value={form.specialty} maxLength={100}
                    placeholder="Ej: Estilista, Chef, Terapeuta"
                    onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-200 focus:border-transparent lg:focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono</label>
                <input
                  type="tel" value={form.phone || ''} maxLength={30}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-200 focus:border-transparent lg:focus:border-blue-400"
                  inputMode="tel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Bio</label>
                <textarea
                  value={form.bio || ''} maxLength={500}
                  placeholder="Breve descripción del profesional..."
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-200 focus:border-transparent lg:focus:border-blue-400 resize-none"
                />
                <p className="text-[10px] text-slate-300 text-right mt-0.5">{(form.bio || '').length}/500</p>
              </div>

              {/* Public toggle */}
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isPublic: !f.isPublic }))}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors ${
                  form.isPublic ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                {form.isPublic ? <FaToggleOn className="text-blue-500 text-xl" /> : <FaToggleOff className="text-slate-300 text-xl" />}
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-700">Perfil público</p>
                  <p className="text-xs text-slate-400">Los clientes pueden seleccionar a este profesional al agendar</p>
                </div>
              </button>
            </>
          )}

          {/* ── Schedule Tab ── */}
          {activeTab === 'schedule' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 mb-2">
                Horario propio del profesional. Si no se configura, se usará el horario del negocio.
              </p>
              {DAYS.map(({ key, label }) => {
                const day = form.schedule?.[key] || DEFAULT_SCHEDULE[key];
                return (
                  <div key={key} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    day.isOpen ? 'border-blue-100 bg-blue-50/50' : 'border-slate-100 bg-slate-50'
                  }`}>
                    <button
                      type="button"
                      onClick={() => handleScheduleChange(key, 'isOpen', !day.isOpen)}
                      className="flex-shrink-0"
                    >
                      {day.isOpen
                        ? <FaToggleOn className="text-blue-500 text-lg" />
                        : <FaToggleOff className="text-slate-300 text-lg" />
                      }
                    </button>
                    <span className="text-sm font-medium text-slate-700 w-20">{label}</span>
                    {day.isOpen && (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time" value={day.openTime}
                          onChange={e => handleScheduleChange(key, 'openTime', e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                        />
                        <span className="text-xs text-slate-400">a</span>
                        <input
                          type="time" value={day.closeTime}
                          onChange={e => handleScheduleChange(key, 'closeTime', e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                        />
                      </div>
                    )}
                    {!day.isOpen && <span className="text-xs text-slate-400">Cerrado</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Commission Tab ── */}
          {activeTab === 'commission' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Tipo de comisión</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'none', label: 'Sin comisión', icon: null },
                    { value: 'percentage', label: 'Porcentaje', icon: <FaPercent size={10} /> },
                    { value: 'fixed', label: 'Valor fijo', icon: <FaDollarSign size={10} /> },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, commissionType: opt.value }))}
                      className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-colors flex items-center justify-center gap-1 ${
                        form.commissionType === opt.value
                          ? 'border-blue-300 bg-blue-50 text-blue-600'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.commissionType !== 'none' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {form.commissionType === 'percentage' ? 'Porcentaje (%)' : 'Valor fijo ($)'}
                  </label>
                  <input
                    type="number"
                    value={form.commissionValue}
                    onChange={e => setForm(f => ({ ...f, commissionValue: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    min={0}
                    max={form.commissionType === 'percentage' ? 100 : undefined}
                    step={form.commissionType === 'percentage' ? 0.5 : 100}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-200 focus:border-transparent lg:focus:border-blue-400"
                    inputMode="decimal"
                  />
                  {form.commissionType === 'percentage' && (
                    <p className="text-xs text-slate-400 mt-1">Se calcula sobre el monto final de cada cita completada</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Services Tab ── */}
          {activeTab === 'services' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 mb-2">
                Selecciona los servicios que ofrece este profesional. Los clientes podrán filtrarlo por servicio.
              </p>
              {services.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No hay servicios/productos registrados</p>
              ) : (
                services.map(svc => {
                  const svcId = svc._id;
                  const isSelected = (form.servicesOffered || []).includes(svcId);
                  return (
                    <button
                      key={svcId}
                      type="button"
                      onClick={() => toggleService(svcId)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                        isSelected ? 'border-blue-200 bg-blue-50' : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                      }`}>
                        {isSelected && <FaCheck className="text-white text-[8px]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{svc.name}</p>
                        {svc.price > 0 && <p className="text-xs text-slate-400">${svc.price.toLocaleString()}</p>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {error && <p className="text-red-500 text-xs font-medium px-5 pb-2">{error}</p>}
        <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            <FaSave size={12} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main Component ──
const StaffManager = ({ businessId }) => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'staff' });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [editMember, setEditMember] = useState(null);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get(`/auth/staff?businessId=${businessId}`);
      setStaff(res.data.staff || []);
    } catch { /* empty */ }
    setLoading(false);
  }, [businessId]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim() || !form.password.trim()) {
      setError('Usuario y contraseña son requeridos');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/staff', { ...form, businessId });
      setForm({ username: '', password: '', name: '', role: 'staff' });
      setShowForm(false);
      fetchStaff();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear usuario');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/auth/staff/${id}?businessId=${businessId}`);
      setStaff(prev => prev.filter(s => s._id !== id));
      setDeleteId(null);
    } catch { /* empty */ }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg lg:text-xl font-bold text-slate-800 flex items-center gap-2">
            <FaUsers className="text-blue-500" /> Equipo
          </h2>
          <p className="hidden lg:block text-sm text-slate-400 mt-0.5">Crea cuentas para cajeros y personal</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); }}
          className="flex items-center gap-2 px-4 py-2.5 lg:py-2 bg-red-500 lg:bg-blue-500 text-white text-[13px] lg:text-sm font-semibold rounded-xl lg:rounded-lg hover:opacity-90 transition-colors active:scale-[0.97] lg:active:scale-100"
        >
          <FaUserPlus /> Nuevo
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleCreate}
            className="bg-white rounded-2xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-sm p-4 lg:p-5 mb-6 space-y-4 overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: María Cajera"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 lg:py-2 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-200 focus:border-transparent lg:focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2.5 lg:py-2 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-200 focus:border-transparent lg:focus:border-blue-400"
                >
                  <option value="staff">Cajero</option>
                  <option value="manager">Gerente</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Usuario (email)</label>
                <input
                  type="text"
                  placeholder="cajera@restaurante.com"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-200 focus:border-transparent lg:focus:border-blue-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-xl lg:rounded-lg text-[14px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:focus:ring-blue-200 focus:border-transparent lg:focus:border-blue-400"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Staff list */}
      {staff.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-8 text-center">
          <FaUsers className="text-3xl text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">Aún no tienes miembros en tu equipo</p>
          <p className="text-slate-400 text-xs mt-1">Crea un usuario para que tus cajeros puedan acceder al sistema</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map(member => (
            <motion.div
              key={member._id}
              layout
              className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none p-4 flex items-center justify-between group hover:shadow-sm transition-shadow cursor-pointer active:scale-[0.98] lg:active:scale-100"
              onClick={() => setEditMember(member)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {member.profileImage ? (
                    <img src={member.profileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-blue-500 font-bold text-sm">
                      {(member.name || member.username).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{member.name || member.username}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">{member.username}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      member.role === 'manager'
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {ROLE_LABELS[member.role] || member.role}
                    </span>
                    {member.specialty && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
                        {member.specialty}
                      </span>
                    )}
                    {member.isPublic && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                        Público
                      </span>
                    )}
                    {member.commissionType && member.commissionType !== 'none' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                        {member.commissionType === 'percentage' ? `${member.commissionValue}%` : `$${member.commissionValue}`}
                      </span>
                    )}
                  </div>
                  {member.lastLogin && (
                    <p className="text-[10px] text-slate-300 mt-0.5">
                      Último acceso: {new Date(member.lastLogin).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditMember(member); }}
                  className="p-2 text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                  title="Editar"
                >
                  <FaEdit size={13} />
                </button>
                {deleteId === member._id ? (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <span className="text-xs text-red-500 font-medium">¿Eliminar?</span>
                    <button
                      onClick={() => handleDelete(member._id)}
                      className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600"
                    >
                      Sí
                    </button>
                    <button
                      onClick={() => setDeleteId(null)}
                      className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteId(member._id); }}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Eliminar"
                  >
                    <FaTrash size={13} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info card */}
      <div className="mt-6 bg-blue-50 rounded-xl border border-blue-100 p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">¿Cómo funciona?</p>
        <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
          <li><strong>Cajero:</strong> Solo ve Pedidos, POS y Cierres de Caja. No puede cambiar el menú ni la configuración.</li>
          <li><strong>Gerente:</strong> Acceso ampliado a reportes y gestión operativa (próximamente).</li>
          <li>Los usuarios inician sesión con su correo y contraseña en la página de login normal.</li>
          <li><strong>Perfil público:</strong> Haz clic en un miembro para editar su perfil, horario, comisión y servicios.</li>
        </ul>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {editMember && (
          <EditProfileModal
            member={editMember}
            businessId={businessId}
            onClose={() => setEditMember(null)}
            onSaved={() => { setEditMember(null); fetchStaff(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffManager;

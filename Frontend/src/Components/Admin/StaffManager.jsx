import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUserPlus, FaTrash, FaUsers, FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../../services/api';

const ROLE_LABELS = { staff: 'Cajero', manager: 'Gerente' };

const StaffManager = ({ businessId }) => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'staff' });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/auth/staff');
      setStaff(res.data.staff || []);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, []);

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
      await api.post('/auth/staff', form);
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
      await api.delete(`/auth/staff/${id}`);
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
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FaUsers className="text-blue-500" /> Equipo
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Crea cuentas para cajeros y personal</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
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
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6 space-y-4 overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: María Cajera"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
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
                    className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
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
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
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
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between group hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 font-bold text-sm">
                  {(member.name || member.username).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{member.name || member.username}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{member.username}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      member.role === 'manager'
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {ROLE_LABELS[member.role] || member.role}
                    </span>
                  </div>
                  {member.lastLogin && (
                    <p className="text-[10px] text-slate-300 mt-0.5">
                      Último acceso: {new Date(member.lastLogin).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>

              {deleteId === member._id ? (
                <div className="flex items-center gap-2">
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
                  onClick={() => setDeleteId(member._id)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  title="Eliminar"
                >
                  <FaTrash size={13} />
                </button>
              )}
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
        </ul>
      </div>
    </div>
  );
};

export default StaffManager;

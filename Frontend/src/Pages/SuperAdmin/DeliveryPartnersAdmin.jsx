import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '../../services/api';

// Superadmin token va explícito (los endpoints están en /api/delivery-partners/admin, no en /api/superadmin)
const saCfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('superadmin_token')}` } });

export default function DeliveryPartnersAdmin() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // partner being edited (password/active)

  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    commissionType: 'percent', commissionValue: '', coverageAreas: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/delivery-partners/admin/list', saCfg());
      setPartners(res.data);
    } catch (err) {
      toast.error('Error cargando partners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => setForm({ name: '', email: '', password: '', phone: '', commissionType: 'percent', commissionValue: '', coverageAreas: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || form.password.length < 6) {
      return toast.error('Nombre, email y contraseña (mín. 6) son obligatorios');
    }
    setSaving(true);
    try {
      await api.post('/delivery-partners/admin/create', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim(),
        commissionType: form.commissionType,
        commissionValue: Number(form.commissionValue) || 0,
        coverageAreas: form.coverageAreas.split(',').map(s => s.trim()).filter(Boolean),
      }, saCfg());
      toast.success('Empresa creada');
      resetForm();
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear empresa');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p) => {
    try {
      await api.patch(`/delivery-partners/admin/${p._id}`, { active: !p.active }, saCfg());
      toast.success(p.active ? 'Empresa desactivada' : 'Empresa activada');
      load();
    } catch { toast.error('Error al actualizar'); }
  };

  const resetPassword = async (p) => {
    const pwd = editing?.password || '';
    if (pwd.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres');
    try {
      await api.patch(`/delivery-partners/admin/${p._id}`, { password: pwd }, saCfg());
      toast.success('Contraseña actualizada');
      setEditing(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const input = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Empresas de reparto</h2>
          <p className="text-sm text-slate-500 mt-0.5">Crea las cuentas que entran al portal <span className="text-slate-600 font-mono">/partner</span></p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          {showCreate ? 'Cerrar' : '+ Nueva empresa'}
        </button>
      </div>

      {/* Cómo funciona */}
      <div className="mb-6 bg-blue-500/[0.06] border border-blue-400/20 rounded-xl p-4 text-sm text-blue-200/80">
        <p className="font-semibold text-blue-200 mb-1">¿Cómo se registran los partners?</p>
        No se auto-registran. Tú creas aquí la empresa con su <strong>email y contraseña</strong>. Luego la empresa entra a
        <span className="font-mono text-blue-100"> menuby.tech/partner</span> con esas credenciales, ve los pedidos que los restaurantes le ofrecen y los acepta.
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.form
            onSubmit={handleCreate}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre de la empresa</label>
                <input className={`${input} mt-1.5`} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rappi, Picap, Domi Express…" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Teléfono</label>
                <input className={`${input} mt-1.5`} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="3001234567" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email (ingreso)</label>
                <input type="email" className={`${input} mt-1.5`} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="empresa@reparto.com" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contraseña</label>
                <input type="text" className={`${input} mt-1.5`} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="mín. 6 caracteres" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comisión</label>
                <div className="flex gap-2 mt-1.5">
                  <select className={`${input} w-28`} value={form.commissionType} onChange={e => setForm(f => ({ ...f, commissionType: e.target.value }))}>
                    <option value="percent">%</option>
                    <option value="fixed">$ fijo</option>
                  </select>
                  <input type="number" min="0" className={input} value={form.commissionValue} onChange={e => setForm(f => ({ ...f, commissionValue: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Zonas de cobertura</label>
                <input className={`${input} mt-1.5`} value={form.coverageAreas} onChange={e => setForm(f => ({ ...f, coverageAreas: e.target.value }))} placeholder="Bogotá, Chapinero (separadas por coma)" />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button type="submit" disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-slate-800 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60">
                  {saving ? 'Creando…' : 'Crear empresa'}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" /></div>
      ) : partners.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl py-14 text-center text-slate-500 text-sm">
          Aún no hay empresas de reparto. Crea la primera con "+ Nueva empresa".
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map(p => (
            <div key={p._id} className={`bg-slate-50 border rounded-xl p-4 ${p.active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800">{p.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{p.email}{p.phone ? ` · ${p.phone}` : ''}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>{p.totalDeliveries || 0} entregas</span>
                    <span>Comisión: {p.commissionType === 'fixed' ? `$${(p.commissionValue||0).toLocaleString('es-CO')}` : `${p.commissionValue||0}%`}</span>
                    {p.coverageAreas?.length > 0 && <span>{p.coverageAreas.join(', ')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(editing?._id === p._id ? null : { _id: p._id, password: '' })} className="text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg transition-colors">
                    Cambiar contraseña
                  </button>
                  <button onClick={() => toggleActive(p)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${p.active ? 'text-rose-300 bg-rose-500/10 hover:bg-rose-500/20' : 'text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'}`}>
                    {p.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>

              {editing?._id === p._id && (
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2">
                  <input
                    type="text"
                    className={input}
                    placeholder="Nueva contraseña (mín. 6)"
                    value={editing.password}
                    onChange={e => setEditing({ ...editing, password: e.target.value })}
                  />
                  <button onClick={() => resetPassword(p)} className="bg-white text-slate-900 font-semibold text-sm px-4 py-2.5 rounded-lg whitespace-nowrap">Guardar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../Context/AuthContext';
import { toast } from 'sonner';

const EMPTY_FORM = { businessName: '', slug: '', branchLabel: '', whatsappNumber: '', useSharedMenu: false, cloneMenu: true };

function slugify(str) {
  return str.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function BranchManager({ businessId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [hasBrand, setHasBrand] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/branches').then(({ data }) => {
      setBranches(data.branches || []);
      setHasBrand(data.hasBrand || false);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.businessName.trim()) return setMsg({ type: 'error', text: 'El nombre es requerido' });
    if (!form.slug.trim()) return setMsg({ type: 'error', text: 'El slug es requerido' });
    setSaving(true);
    setMsg(null);
    try {
      const { data } = await api.post('/branches', form);
      // Update token & user in storage so BranchSwitcher picks up new branches
      const updatedUser = { ...user, role: 'brand_admin', branches: data.branches };
      sessionStorage.setItem('accessToken', data.token);
      localStorage.setItem('accessToken', data.token);
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setBranches(data.branches);
      setHasBrand(true);
      setShowForm(false);
      setForm(EMPTY_FORM);
      const cloneNote = data.cloneStats ? ` Se copiaron ${data.cloneStats.products} productos y ${data.cloneStats.categories} categorías.` : '';
      setMsg({ type: 'ok', text: `Sucursal "${form.businessName}" creada.${cloneNote} Ya puedes cambiar a ella desde el selector de arriba.` });
      // Reload so BranchSwitcher and token update
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.message || 'Error al crear la sucursal' });
    } finally {
      setSaving(false);
    }
  };

  const currentBranch = branches.find(b => String(b._id) === String(user?.businessId));

  if (loading) return <div className="text-slate-400 text-sm p-4">Cargando sucursales…</div>;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Mis Sucursales</h2>
        <p className="text-sm text-slate-500 mt-1">
          Abre nuevas ubicaciones de tu negocio. Cada sucursal tiene su propio enlace de menú, WhatsApp y pedidos.
        </p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Subscription note */}
      <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
        <svg className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-indigo-700">
          Cada sucursal adicional tiene un costo del <strong>90% del plan base</strong> (10% de descuento). La nueva sucursal inicia en plan Free hasta activar su suscripción.
        </p>
      </div>

      {/* Branch list */}
      <div className="space-y-3">
        {branches.map(branch => {
          const isActive = String(branch._id) === String(user?.businessId);
          return (
            <div key={branch._id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isActive ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
              <div className={`w-3 h-3 rounded-full shrink-0 ${branch.isMainBranch ? 'bg-indigo-500' : 'bg-slate-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">{branch.branchLabel || branch.businessName}</span>
                  {branch.isMainBranch && <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">Principal</span>}
                  {branch.useSharedMenu && <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">Menú compartido</span>}
                  {isActive && <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">Aquí ahora</span>}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">menuby.tech/{branch.slug}</div>
              </div>
              {!isActive && (
                <button
                  onClick={async () => {
                    try {
                      const { data } = await api.post('/auth/switch-branch', { targetBusinessId: branch._id });
                      const updatedUser = { ...user, businessId: branch._id };
                      sessionStorage.setItem('accessToken', data.token);
                      localStorage.setItem('accessToken', data.token);
                      sessionStorage.setItem('user', JSON.stringify(updatedUser));
                      localStorage.setItem('user', JSON.stringify(updatedUser));
                      navigate(`/${branch.slug}/admin`, { replace: true });
                      window.location.reload();
                    } catch (err) {
                      toast.error(err?.response?.data?.message || 'No se pudo cambiar de sucursal.');
                    }
                  }}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                >
                  Ir a esta
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new branch */}
      {!showForm ? (
        <button
          onClick={() => { setShowForm(true); setMsg(null); }}
          className="w-full flex items-center justify-center gap-2.5 py-3 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 font-semibold text-sm hover:border-indigo-400 hover:bg-indigo-50 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Abrir nueva sucursal
        </button>
      ) : (
        <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-4">
          <h3 className="font-bold text-slate-800">Nueva sucursal</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre de la sucursal</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Ej: Fraise Norte, Sucursal Centro…"
                value={form.businessName}
                onChange={e => setForm(f => ({
                  ...f,
                  businessName: e.target.value,
                  slug: slugify(e.target.value),
                  branchLabel: e.target.value,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Slug (URL del menú)</label>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400">
                <span className="px-2 py-2.5 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap">menuby.tech/</span>
                <input
                  className="flex-1 px-2 py-2.5 text-sm font-mono focus:outline-none"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Etiqueta (nombre corto)</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Norte, Sur, CC Andino…"
                value={form.branchLabel}
                onChange={e => setForm(f => ({ ...f, branchLabel: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">WhatsApp de la sucursal (opcional)</label>
              <input
                type="tel"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="3001234567"
                value={form.whatsappNumber}
                onChange={e => setForm(f => ({ ...f, whatsappNumber: e.target.value }))}
              />
            </div>

            {/* Menu strategy */}
            <div className="col-span-2 space-y-2">
              <div className="text-xs font-semibold text-slate-600 mb-1">Menú de la nueva sucursal</div>

              <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${!form.useSharedMenu && form.cloneMenu ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="menuMode" checked={!form.useSharedMenu && form.cloneMenu}
                  onChange={() => setForm(f => ({ ...f, useSharedMenu: false, cloneMenu: true }))}
                  className="accent-indigo-600 w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-700">Copiar el menú actual</div>
                  <div className="text-xs text-slate-400">Se clonan todos los productos y categorías. Después puedes ajustar precios, desactivar productos o agregar nuevos en esta sucursal independientemente.</div>
                </div>
              </label>

              <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${form.useSharedMenu ? 'border-amber-300 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="menuMode" checked={form.useSharedMenu}
                  onChange={() => setForm(f => ({ ...f, useSharedMenu: true, cloneMenu: false }))}
                  className="accent-amber-500 w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-700">Menú compartido (en tiempo real)</div>
                  <div className="text-xs text-slate-400">Muestra exactamente los mismos productos que la sucursal principal. Cualquier cambio allá se refleja aquí al instante. Sin diferencias de precio ni disponibilidad.</div>
                </div>
              </label>

              <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${!form.useSharedMenu && !form.cloneMenu ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="menuMode" checked={!form.useSharedMenu && !form.cloneMenu}
                  onChange={() => setForm(f => ({ ...f, useSharedMenu: false, cloneMenu: false }))}
                  className="accent-slate-500 w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-700">Empezar vacío</div>
                  <div className="text-xs text-slate-400">Crea el menú desde cero para esta sucursal.</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? 'Creando…' : 'Crear sucursal'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

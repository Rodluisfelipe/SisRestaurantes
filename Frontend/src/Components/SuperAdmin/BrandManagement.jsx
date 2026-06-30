import { useState, useEffect, useCallback } from 'react';
import superadminApi from '../../services/superadminApi';

const EMPTY_BRAND = { name: '', slug: '' };
const EMPTY_ADMIN = { username: '', password: '', name: '' };

export default function BrandManagement() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // brandId
  const [expandedData, setExpandedData] = useState({}); // brandId -> { branches }
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(null); // brand object
  const [createForm, setCreateForm] = useState(EMPTY_BRAND);
  const [assignForm, setAssignForm] = useState({ businessIds: [], mainBranchId: '', sharedMenuBranchIds: [] });
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [createAdmin, setCreateAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await superadminApi.get('/brands');
      setBrands(data);
    } catch (e) {
      setMsg({ type: 'error', text: 'Error cargando marcas' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadBusinesses = async () => {
    if (allBusinesses.length) return;
    const { data } = await superadminApi.get('/business?limit=200&page=1');
    setAllBusinesses(data.businesses || data || []);
  };

  const expandBrand = async (brandId) => {
    if (expanded === brandId) { setExpanded(null); return; }
    setExpanded(brandId);
    if (!expandedData[brandId]) {
      const { data } = await superadminApi.get(`/brands/${brandId}`);
      setExpandedData(prev => ({ ...prev, [brandId]: data }));
    }
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.slug) return setMsg({ type: 'error', text: 'Nombre y slug requeridos' });
    setSaving(true);
    try {
      await superadminApi.post('/brands', createForm);
      setShowCreate(false);
      setCreateForm(EMPTY_BRAND);
      setMsg({ type: 'ok', text: 'Marca creada' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Error al crear' });
    } finally {
      setSaving(false);
    }
  };

  const openAssign = async (brand) => {
    await loadBusinesses();
    setShowAssign(brand);
    // Pre-fill with current branches if loaded
    const current = expandedData[brand._id];
    if (current?.branches?.length) {
      const ids = current.branches.map(b => String(b._id));
      const mainId = current.branches.find(b => b.isMainBranch)?._id || '';
      const sharedIds = current.branches.filter(b => b.useSharedMenu).map(b => String(b._id));
      setAssignForm({ businessIds: ids, mainBranchId: String(mainId), sharedMenuBranchIds: sharedIds });
    } else {
      setAssignForm({ businessIds: [], mainBranchId: '', sharedMenuBranchIds: [] });
    }
    setAdminForm(EMPTY_ADMIN);
    setCreateAdmin(false);
  };

  const toggleBiz = (id) => {
    const sid = String(id);
    setAssignForm(f => ({
      ...f,
      businessIds: f.businessIds.includes(sid) ? f.businessIds.filter(x => x !== sid) : [...f.businessIds, sid],
      mainBranchId: f.mainBranchId === sid && f.businessIds.includes(sid) ? '' : f.mainBranchId,
    }));
  };

  const handleAssign = async () => {
    if (!assignForm.businessIds.length) return setMsg({ type: 'error', text: 'Selecciona al menos un negocio' });
    if (!assignForm.mainBranchId) return setMsg({ type: 'error', text: 'Elige la sucursal principal' });
    if (createAdmin && (!adminForm.username || !adminForm.password)) {
      return setMsg({ type: 'error', text: 'Username y contraseña requeridos para el admin' });
    }
    setSaving(true);
    try {
      const payload = {
        ...assignForm,
        ...(createAdmin && adminForm.username ? { brandAdmin: adminForm } : {}),
      };
      await superadminApi.post(`/brands/${showAssign._id}/assign`, payload);
      setExpandedData(prev => { const next = { ...prev }; delete next[showAssign._id]; return next; });
      setShowAssign(null);
      setMsg({ type: 'ok', text: 'Sucursales asignadas correctamente' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Error al asignar' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (brand) => {
    if (!window.confirm(`¿Eliminar la marca "${brand.name}"? Los negocios quedarán sin marca.`)) return;
    try {
      await superadminApi.delete(`/brands/${brand._id}`);
      setMsg({ type: 'ok', text: 'Marca eliminada' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Marcas / Multi-Sucursal</h2>
          <p className="text-sm text-slate-500">Agrupa negocios en marcas para habilitar el selector de sucursales.</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setMsg(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <span className="text-base leading-none">+</span> Nueva Marca
        </button>
      </div>

      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Cargando marcas…</div>
      ) : brands.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-3">🏪</div>
          <p className="font-medium">Sin marcas todavía</p>
          <p className="text-sm mt-1">Crea una marca para agrupar sucursales.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {brands.map(brand => (
            <div key={brand._id} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 bg-white hover:bg-slate-50 transition-colors">
                <button onClick={() => expandBrand(brand._id)} className="flex-1 flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <span className="text-indigo-600 font-bold text-sm">{brand.name[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{brand.name}</div>
                    <div className="text-xs text-slate-400">{brand.slug} · {brand.branchCount} sucursal{brand.branchCount !== 1 ? 'es' : ''}</div>
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 ml-auto mr-3 transition-transform ${expanded === brand._id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { openAssign(brand); setMsg(null); }} className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
                    Asignar
                  </button>
                  <button onClick={() => handleDelete(brand)} className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                    Eliminar
                  </button>
                </div>
              </div>

              {expanded === brand._id && expandedData[brand._id] && (
                <div className="border-t border-slate-100 px-5 py-3 bg-slate-50">
                  {expandedData[brand._id].branches?.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin sucursales asignadas aún.</p>
                  ) : (
                    <div className="space-y-2">
                      {expandedData[brand._id].branches.map(b => (
                        <div key={b._id} className="flex items-center gap-3 text-sm">
                          <div className={`w-2 h-2 rounded-full ${b.isMainBranch ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                          <span className="font-medium text-slate-700">{b.branchLabel || b.businessName}</span>
                          {b.isMainBranch && <span className="text-xs text-indigo-500 font-medium">(principal)</span>}
                          {b.useSharedMenu && <span className="text-xs text-amber-500 font-medium">(menú compartido)</span>}
                          <span className="text-xs text-slate-400 ml-auto">{b.slug}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Brand Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-800 mb-4">Nueva Marca</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Fraise, Wok, La Italiana…"
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Slug (identificador único)</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="fraise"
                  value={createForm.slug}
                  onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
                {saving ? 'Creando…' : 'Crear Marca'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-base font-bold text-slate-800 mb-1">Asignar sucursales</h3>
            <p className="text-sm text-slate-500 mb-5">Marca: <strong>{showAssign.name}</strong></p>

            <div className="mb-5">
              <div className="text-xs font-semibold text-slate-600 mb-2">Selecciona los negocios de esta marca:</div>
              <div className="space-y-1 max-h-52 overflow-y-auto border border-slate-200 rounded-lg p-2">
                {allBusinesses.map(biz => {
                  const id = String(biz._id);
                  const checked = assignForm.businessIds.includes(id);
                  const isMain = assignForm.mainBranchId === id;
                  const isShared = assignForm.sharedMenuBranchIds.includes(id);
                  return (
                    <div key={id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-indigo-50' : 'hover:bg-slate-50'}`} onClick={() => toggleBiz(id)}>
                      <input type="checkbox" readOnly checked={checked} className="accent-indigo-600" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-700">{biz.businessName}</span>
                        <span className="text-xs text-slate-400 ml-2">{biz.slug}</span>
                      </div>
                      {checked && (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setAssignForm(f => ({ ...f, mainBranchId: isMain ? '' : id, sharedMenuBranchIds: f.sharedMenuBranchIds.filter(x => x !== id) }))}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isMain ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100'}`}
                          >
                            Principal
                          </button>
                          {!isMain && (
                            <button
                              onClick={() => setAssignForm(f => ({ ...f, sharedMenuBranchIds: isShared ? f.sharedMenuBranchIds.filter(x => x !== id) : [...f.sharedMenuBranchIds, id] }))}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isShared ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-amber-100'}`}
                            >
                              Menú compartido
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {assignForm.mainBranchId && (
                <p className="text-xs text-slate-500 mt-2">
                  Principal: <strong>{allBusinesses.find(b => String(b._id) === assignForm.mainBranchId)?.businessName}</strong>
                  {assignForm.sharedMenuBranchIds.length > 0 && <> · {assignForm.sharedMenuBranchIds.length} con menú compartido</>}
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2.5 cursor-pointer mb-3">
                <input type="checkbox" checked={createAdmin} onChange={e => setCreateAdmin(e.target.checked)} className="accent-indigo-600" />
                <span className="text-sm font-semibold text-slate-700">Crear / actualizar usuario Brand Admin</span>
              </label>
              {createAdmin && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Username</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={adminForm.username} onChange={e => setAdminForm(f => ({ ...f, username: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Contraseña</label>
                    <input type="password" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={adminForm.password} onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre (opcional)</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={adminForm.name} onChange={e => setAdminForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAssign(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleAssign} disabled={saving} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

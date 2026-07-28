import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import ImageUploader from './ImageUploader';

const FREQUENCY_LABELS = {
  once: 'Una sola vez',
  session: 'Una vez por visita',
  daily: 'Una vez al día',
  always: 'Siempre',
};

const FORMATS = [
  { id: 'modal', label: 'Modal centrado', preview: 'center' },
  { id: 'bar-top', label: 'Barra arriba', preview: 'top' },
  { id: 'bar-bottom', label: 'Barra abajo', preview: 'bottom' },
  { id: 'toast', label: 'Toast esquina', preview: 'corner' },
  { id: 'fullscreen', label: 'Pantalla completa', preview: 'full' },
];

const LEAD_FIELDS = [
  { key: 'name', label: 'Nombre' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'birthday', label: 'Cumpleaños' },
];

const EMPTY_FIELDS = { name: { on: false, required: false }, email: { on: false, required: false }, phone: { on: false, required: false }, birthday: { on: false, required: false } };

const EMPTY_FORM = {
  title: '',
  body: '',
  image: '',
  format: 'modal',
  ctaText: '',
  ctaUrl: '',
  active: true,
  frequency: 'session',
  delaySeconds: 1,
  startsAt: '',
  endsAt: '',
  // formulario de captura
  formEnabled: false,
  formTitle: '',
  formFields: { ...EMPTY_FIELDS },
  submitText: 'Enviar',
  successMessage: '¡Gracias! Te contactaremos pronto.',
};

// Mini preview del formato para el selector
const FormatGlyph = ({ preview }) => {
  const base = 'absolute bg-current rounded-sm';
  return (
    <div className="relative w-full h-9 rounded-md bg-slate-100 overflow-hidden text-slate-400">
      {preview === 'center' && <span className={`${base} left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-5`} />}
      {preview === 'top' && <span className={`${base} left-1 right-1 top-1 h-2`} />}
      {preview === 'bottom' && <span className={`${base} left-1 right-1 bottom-1 h-2`} />}
      {preview === 'corner' && <span className={`${base} right-1 bottom-1 w-5 h-4`} />}
      {preview === 'full' && <span className={`${base} inset-1`} />}
    </div>
  );
};

const toInputDate = (d) => {
  if (!d) return '';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; }
};

const StatPill = ({ label, value, color }) => (
  <div className="flex-1 min-w-0 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
    <p className={`text-lg font-black tabular-nums ${color || 'text-slate-800'}`}>{value}</p>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
  </div>
);

export default function AdminPopups() {
  const { businessConfig } = useBusinessConfig();
  const businessId = businessConfig?._id;
  const themeColor = businessConfig?.theme?.buttonColor || '#E8002D';

  const [popups, setPopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | {} (nuevo) | popup (editar)
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!businessId) return;
    setLoading(true);
    api.get(`/menu-popups?businessId=${businessId}`)
      .then(res => setPopups(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPopups([]))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const views = popups.reduce((s, p) => s + (p.views || 0), 0);
    const clicks = popups.reduce((s, p) => s + (p.clicks || 0), 0);
    const activeCount = popups.filter(p => p.active).length;
    const ctr = views > 0 ? Math.round((clicks / views) * 100) : 0;
    return { views, clicks, activeCount, ctr };
  }, [popups]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setError('');
    setEditing({});
  };

  const openEdit = (p) => {
    const fields = { ...EMPTY_FIELDS };
    (p.form?.fields || []).forEach(f => {
      if (fields[f.key]) fields[f.key] = { on: true, required: !!f.required };
    });
    setForm({
      title: p.title || '',
      body: p.body || '',
      image: p.image || '',
      format: p.format || 'modal',
      ctaText: p.ctaText || '',
      ctaUrl: p.ctaUrl || '',
      active: p.active !== false,
      frequency: p.frequency || 'session',
      delaySeconds: p.delaySeconds ?? 1,
      startsAt: toInputDate(p.startsAt),
      endsAt: toInputDate(p.endsAt),
      formEnabled: !!p.form?.enabled,
      formTitle: p.form?.title || '',
      formFields: fields,
      submitText: p.form?.submitText || 'Enviar',
      successMessage: p.form?.successMessage || '¡Gracias! Te contactaremos pronto.',
    });
    setError('');
    setEditing(p);
  };

  const closeEditor = () => { setEditing(null); setError(''); };

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true);
    setError('');
    const formFields = LEAD_FIELDS
      .filter(f => form.formFields[f.key]?.on)
      .map(f => ({ key: f.key, label: f.label, required: !!form.formFields[f.key]?.required }));
    const payload = {
      businessId,
      title: form.title.trim(),
      body: form.body.trim(),
      image: form.image || null,
      format: form.format,
      ctaText: form.ctaText.trim(),
      ctaUrl: form.ctaUrl.trim(),
      active: form.active,
      frequency: form.frequency,
      delaySeconds: Number(form.delaySeconds) || 0,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      form: {
        enabled: form.formEnabled,
        title: form.formTitle.trim(),
        fields: formFields,
        submitText: form.submitText.trim() || 'Enviar',
        successMessage: form.successMessage.trim() || '¡Gracias!',
      },
    };
    try {
      if (editing && editing._id) {
        await api.patch(`/menu-popups/${editing._id}`, payload);
      } else {
        await api.post('/menu-popups', payload);
      }
      closeEditor();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p) => {
    // Optimista
    setPopups(prev => prev.map(x => x._id === p._id ? { ...x, active: !x.active } : x));
    try {
      await api.patch(`/menu-popups/${p._id}`, { businessId, active: !p.active });
    } catch {
      load();
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Eliminar el anuncio "${p.title}"?`)) return;
    setPopups(prev => prev.filter(x => x._id !== p._id));
    try {
      await api.delete(`/menu-popups/${p._id}?businessId=${businessId}`);
    } catch {
      load();
    }
  };

  // ── Visor de contactos capturados ──
  const [leadsPopup, setLeadsPopup] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  const openLeads = async (p) => {
    setLeadsPopup(p); setLeads([]); setLeadsLoading(true);
    try {
      const res = await api.get(`/menu-popups/${p._id}/leads?businessId=${businessId}`);
      setLeads(Array.isArray(res.data) ? res.data : []);
    } catch { setLeads([]); }
    finally { setLeadsLoading(false); }
  };

  const exportLeadsCsv = async (p) => {
    try {
      const res = await api.get(`/menu-popups/${p._id}/leads?businessId=${businessId}&format=csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = `contactos-${p._id}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-black text-slate-800">Anuncios del menú</h1>
          <p className="text-sm text-slate-500 mt-0.5">Popups para promocionar productos, novedades o promociones. Míde vistas y clics.</p>
        </div>
        <button
          onClick={openNew}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow-sm active:scale-95 transition-transform"
          style={{ backgroundColor: themeColor }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nuevo
        </button>
      </div>

      {/* Resumen de estadísticas */}
      {popups.length > 0 && (
        <div className="flex gap-2 mb-5">
          <StatPill label="Activos" value={totals.activeCount} color="text-emerald-600" />
          <StatPill label="Vistas" value={totals.views.toLocaleString()} />
          <StatPill label="Clics" value={totals.clicks.toLocaleString()} />
          <StatPill label="CTR" value={`${totals.ctr}%`} color="text-blue-600" />
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Cargando…</div>
      ) : popups.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 11-5.8-1.6" /></svg>
          </div>
          <p className="text-slate-600 font-bold">Aún no tienes anuncios</p>
          <p className="text-sm text-slate-400 mt-1">Crea tu primer popup para promocionar en el menú.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {popups.map(p => {
            const ctr = p.views > 0 ? Math.round((p.clicks / p.views) * 100) : 0;
            return (
              <div key={p._id} className="rounded-2xl border border-slate-200 bg-white p-3.5 flex gap-3.5">
                {/* Miniatura */}
                {p.image ? (
                  <img src={p.image} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100" />
                ) : (
                  <div className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: `${themeColor}14` }}>
                    <svg className="w-6 h-6" style={{ color: themeColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 14v-3z" /></svg>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 truncate">{p.title}</h3>
                    <span className={`shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-full ${p.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {p.active ? 'Activo' : 'Pausado'}
                    </span>
                  </div>
                  {p.body && <p className="text-[13px] text-slate-500 line-clamp-1 mt-0.5">{p.body}</p>}
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-400 font-semibold">
                    <span>{FORMATS.find(f => f.id === p.format)?.label || 'Modal'}</span>
                    <span className="text-slate-300">·</span>
                    <span>👁 {(p.views || 0).toLocaleString()}</span>
                    <span>🖱 {(p.clicks || 0).toLocaleString()}</span>
                    <span className="text-blue-500">CTR {ctr}%</span>
                    {p.form?.enabled && (
                      <button onClick={() => openLeads(p)} className="text-fuchsia-600 hover:underline">📝 {(p.submissions || 0).toLocaleString()} contactos</button>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-col items-end justify-between shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer" title={p.active ? 'Pausar' : 'Activar'}>
                    <input type="checkbox" checked={!!p.active} onChange={() => toggleActive(p)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Editar">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={closeEditor}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
              <h2 className="font-black text-slate-800">{editing._id ? 'Editar anuncio' : 'Nuevo anuncio'}</h2>
              <button onClick={closeEditor} className="p-2 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Título *</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} maxLength={120} placeholder="Ej: ¡2x1 en hamburguesas hoy!" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Mensaje</label>
                <textarea value={form.body} onChange={e => set('body', e.target.value)} maxLength={600} rows={3} placeholder="Describe la promoción o novedad…" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Imagen (opcional)</label>
                <ImageUploader value={form.image} onChange={(url) => set('image', url)} folder="popups" previewClassName="w-full h-32" previewFit="cover" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Formato</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {FORMATS.map(f => {
                    const active = form.format === f.id;
                    return (
                      <button key={f.id} type="button" onClick={() => set('format', f.id)}
                        className={`p-2 rounded-xl border-2 transition-all text-center ${active ? 'shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                        style={active ? { borderColor: themeColor } : { borderColor: undefined }}>
                        <FormatGlyph preview={f.preview} />
                        <p className="text-[10px] font-bold text-slate-500 mt-1 leading-tight">{f.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Texto del botón</label>
                  <input value={form.ctaText} onChange={e => set('ctaText', e.target.value)} maxLength={40} placeholder="Ver promoción" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Enlace del botón</label>
                  <input value={form.ctaUrl} onChange={e => set('ctaUrl', e.target.value)} placeholder="https://… (opcional)" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Frecuencia</label>
                  <select value={form.frequency} onChange={e => set('frequency', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }}>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Retraso (segundos)</label>
                  <input type="number" min={0} max={60} value={form.delaySeconds} onChange={e => set('delaySeconds', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Inicia (opcional)</label>
                  <input type="date" value={form.startsAt} onChange={e => set('startsAt', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Termina (opcional)</label>
                  <input type="date" value={form.endsAt} onChange={e => set('endsAt', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                </div>
              </div>

              {/* Formulario de captura de datos */}
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-bold text-slate-700">Recoger datos del cliente</span>
                    <p className="text-[11px] text-slate-400">Muestra un formulario debajo del anuncio</p>
                  </div>
                  <input type="checkbox" checked={form.formEnabled} onChange={e => set('formEnabled', e.target.checked)} className="w-5 h-5 rounded" style={{ accentColor: themeColor }} />
                </label>

                {form.formEnabled && (
                  <div className="space-y-3 pt-1">
                    <input value={form.formTitle} onChange={e => set('formTitle', e.target.value)} maxLength={120} placeholder="Título del formulario (ej: Únete a nuestro club)" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />

                    <div className="space-y-1.5">
                      {LEAD_FIELDS.map(f => {
                        const cfg = form.formFields[f.key] || { on: false, required: false };
                        return (
                          <div key={f.key} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <input type="checkbox" checked={cfg.on} onChange={e => set('formFields', { ...form.formFields, [f.key]: { ...cfg, on: e.target.checked } })} className="w-4 h-4 rounded" style={{ accentColor: themeColor }} />
                              <span className="text-sm font-semibold text-slate-600">{f.label}</span>
                            </label>
                            {cfg.on && (
                              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-400 font-bold">
                                <input type="checkbox" checked={cfg.required} onChange={e => set('formFields', { ...form.formFields, [f.key]: { ...cfg, required: e.target.checked } })} className="w-3.5 h-3.5 rounded" style={{ accentColor: themeColor }} />
                                Obligatorio
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Texto del botón</label>
                        <input value={form.submitText} onChange={e => set('submitText', e.target.value)} maxLength={40} placeholder="Enviar" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Mensaje de agradecimiento</label>
                      <input value={form.successMessage} onChange={e => set('successMessage', e.target.value)} maxLength={200} placeholder="¡Gracias! Te contactaremos pronto." className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': `${themeColor}40` }} />
                    </div>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: themeColor }} />
                <span className="text-sm font-semibold text-slate-600">Activo (visible en el menú)</span>
              </label>

              {error && <p className="text-sm text-red-500 font-semibold">{error}</p>}
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-2 shrink-0">
              <button onClick={closeEditor} className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-60" style={{ backgroundColor: themeColor }}>
                {saving ? 'Guardando…' : editing._id ? 'Guardar cambios' : 'Crear anuncio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor de contactos */}
      {leadsPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={() => setLeadsPopup(null)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <h2 className="font-black text-slate-800 truncate">Contactos</h2>
                <p className="text-[11px] text-slate-400 truncate">{leadsPopup.title}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {leads.length > 0 && (
                  <button onClick={() => exportLeadsCsv(leadsPopup)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    CSV
                  </button>
                )}
                <button onClick={() => setLeadsPopup(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-4">
              {leadsLoading ? (
                <p className="py-12 text-center text-slate-400 text-sm">Cargando…</p>
              ) : leads.length === 0 ? (
                <p className="py-12 text-center text-slate-400 text-sm">Aún no hay contactos capturados.</p>
              ) : (
                <div className="space-y-2">
                  {leads.map(l => (
                    <div key={l._id} className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-800 text-sm truncate">{l.name || l.email || l.phone || 'Sin nombre'}</p>
                        <span className="text-[10px] text-slate-400 shrink-0">{new Date(l.createdAt).toLocaleDateString('es-CO')}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[12px] text-slate-500">
                        {l.email && <span>✉ {l.email}</span>}
                        {l.phone && <span>📞 {l.phone}</span>}
                        {l.birthday && <span>🎂 {l.birthday}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

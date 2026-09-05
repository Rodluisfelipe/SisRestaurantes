import { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'sonner';

export default function LinkPageSettings({ businessId }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    tagline: '',
    description: '',
    socialMedia: { instagram: { url: '', isVisible: true }, facebook: { url: '', isVisible: true }, tiktok: { url: '', isVisible: true } },
    extraLink: { url: '', isVisible: true },
  });

  useEffect(() => {
    api.get(`/business-config?businessId=${businessId}`)
      .then(r => {
        const d = r.data;
        setConfig(d);
        setForm({
          tagline: d.tagline || '',
          description: d.description || '',
          socialMedia: {
            instagram: { url: d.socialMedia?.instagram?.url || '', isVisible: true },
            facebook: { url: d.socialMedia?.facebook?.url || '', isVisible: true },
            tiktok: { url: d.socialMedia?.tiktok?.url || '', isVisible: true },
          },
          extraLink: { url: d.extraLink?.url || '', isVisible: d.extraLink?.isVisible ?? true },
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/business-config', {
        businessId,
        tagline: form.tagline,
        description: form.description,
        socialMedia: form.socialMedia,
        extraLink: form.extraLink,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      // Antes fallaba en silencio a proposito y el usuario no veia ningun
      // cambio: creia haber guardado su pagina de enlaces.
      toast.error(err?.response?.data?.message || 'No se pudo guardar la pagina de enlaces.');
    } finally {
      setSaving(false);
    }
  };

  const slug = config?.slug;
  const linkUrl = slug ? `${window.location.origin}/menubylink/${slug}` : null;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-10">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Mi Link</h2>
        <p className="text-sm text-slate-500 mt-1">Tu página pública tipo Linktree — compártela en redes sociales y bio.</p>
      </div>

      {/* Preview link */}
      {linkUrl && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-indigo-400 font-medium mb-0.5">Tu enlace</p>
            <p className="text-sm font-semibold text-indigo-700 truncate">{linkUrl}</p>
          </div>
          <a
            href={`/menubylink/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            Ver ↗
          </a>
          <button
            onClick={() => navigator.clipboard?.writeText(linkUrl)}
            className="shrink-0 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Copiar
          </button>
        </div>
      )}

      {/* Tagline */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Frase corta (tagline)</label>
        <input
          type="text"
          maxLength={80}
          value={form.tagline}
          onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
          placeholder="ej. La mejor pizza de la ciudad"
          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <p className="text-xs text-slate-400 mt-1">{form.tagline.length}/80 caracteres</p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripción</label>
        <textarea
          maxLength={300}
          rows={3}
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Cuéntale a tus clientes quiénes son..."
          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <p className="text-xs text-slate-400 mt-1">{form.description.length}/300 caracteres</p>
      </div>

      {/* Social media */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Redes sociales</label>
        <div className="space-y-2">
          {[
            { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/tu_usuario' },
            { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/tu_pagina' },
            { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@tu_usuario' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-500 font-medium shrink-0">{label}</span>
              <input
                type="url"
                value={form.socialMedia[key]?.url || ''}
                onChange={e => setForm(f => ({
                  ...f,
                  socialMedia: { ...f.socialMedia, [key]: { ...f.socialMedia[key], url: e.target.value } }
                }))}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Extra link */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Enlace extra</label>
        <input
          type="url"
          value={form.extraLink.url}
          onChange={e => setForm(f => ({ ...f, extraLink: { ...f.extraLink, url: e.target.value } }))}
          placeholder="https://tu-tienda.com o cualquier enlace"
          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <p className="text-xs text-slate-400 mt-1">Aparece como botón de enlace en tu página.</p>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3 rounded-2xl font-bold text-sm transition-all ${
          saved
            ? 'bg-emerald-500 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg active:scale-95'
        } disabled:opacity-60`}
      >
        {saved ? '¡Guardado!' : saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  );
}

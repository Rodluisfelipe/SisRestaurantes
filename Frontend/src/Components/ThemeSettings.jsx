import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessConfig } from '../Context/BusinessContext';

const COLOR_PRESETS = [
  { color: '#f97316', label: 'Naranja' },
  { color: '#ef4444', label: 'Rojo' },
  { color: '#ec4899', label: 'Rosa' },
  { color: '#8b5cf6', label: 'Violeta' },
  { color: '#3b82f6', label: 'Azul' },
  { color: '#06b6d4', label: 'Cyan' },
  { color: '#10b981', label: 'Esmeralda' },
  { color: '#84cc16', label: 'Lima' },
  { color: '#eab308', label: 'Amarillo' },
  { color: '#78716c', label: 'Piedra' },
  { color: '#1e293b', label: 'Slate' },
  { color: '#000000', label: 'Negro' },
];

const FONT_OPTIONS = [
  { id: '', label: 'Por defecto', family: 'system-ui, sans-serif', description: 'Fuente del sistema' },
  { id: 'inter', label: 'Inter', family: "'Inter', sans-serif", description: 'Moderna y limpia' },
  { id: 'playfair', label: 'Playfair Display', family: "'Playfair Display', serif", description: 'Elegante con serifas' },
  { id: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif", description: 'Redondeada y amigable' },
  { id: 'lora', label: 'Lora', family: "'Lora', serif", description: 'Clásica y refinada' },
  { id: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif", description: 'Geométrica y bold' },
];

const ThemeSettings = () => {
  const { businessConfig, updateConfig } = useBusinessConfig();
  const businessId = businessConfig._id || businessConfig.businessId;
  
  const [theme, setTheme] = useState({
    buttonColor: '#2563eb',
    buttonTextColor: '#ffffff',
    primaryColor: '',
    menuFont: '',
    collapsedMenu: false
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    if (businessConfig.theme) {
      setTheme({
        buttonColor: businessConfig.theme.buttonColor || '#2563eb',
        buttonTextColor: businessConfig.theme.buttonTextColor || '#ffffff',
        primaryColor: businessConfig.theme.primaryColor || '',
        menuFont: businessConfig.theme.menuFont || '',
        collapsedMenu: businessConfig.theme.collapsedMenu || false
      });
    }
  }, [businessConfig]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTheme(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      await updateConfig({ ...businessConfig, theme, businessId });
      setMessage({ text: 'Tema actualizado correctamente', type: 'success' });
    } catch (error) {
      setMessage({ text: 'Error al actualizar el tema', type: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const activeFont = FONT_OPTIONS.find(f => f.id === theme.menuFont) || FONT_OPTIONS[0];
  const activePrimary = theme.primaryColor || theme.buttonColor || '#f97316';

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <svg className="w-6 h-6 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
        </div>
        <h2 className="text-xl lg:text-2xl font-bold text-slate-900 mb-1">Personalización</h2>
        <p className="text-sm text-slate-500">Color y tipografía de tu menú digital</p>
      </motion.div>

      {/* Message */}
      <AnimatePresence>
        {message.text && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl border flex items-center gap-2 text-sm font-medium ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {message.type === 'success'
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />}
            </svg>
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onSubmit={handleSubmit} className="space-y-6">

        {/* ── PRIMARY COLOR ── */}
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: activePrimary + '15' }}>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: activePrimary }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Color primario</h3>
              <p className="text-[11px] text-slate-400">Acentos, botones y enlaces en tu menú</p>
            </div>
          </div>

          {/* Preset palette */}
          <div className="grid grid-cols-6 gap-2 mb-4">
            {COLOR_PRESETS.map(preset => {
              const isActive = (theme.primaryColor || theme.buttonColor) === preset.color;
              return (
                <button key={preset.color} type="button"
                  onClick={() => setTheme(prev => ({ ...prev, primaryColor: preset.color, buttonColor: preset.color }))}
                  className={`relative aspect-square rounded-xl border-2 transition-all duration-200 group ${
                    isActive ? 'border-slate-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.color }}
                  title={preset.label}>
                  {isActive && (
                    <svg className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom color input */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <input type="color" name="primaryColor" value={theme.primaryColor || theme.buttonColor}
                onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value, buttonColor: e.target.value }))}
                className="w-10 h-10 rounded-lg border-2 border-slate-200 cursor-pointer" />
            </div>
            <input type="text" value={theme.primaryColor || theme.buttonColor}
              onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value, buttonColor: e.target.value }))}
              placeholder="#f97316"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none" />
          </div>
        </div>

        {/* ── BUTTON TEXT COLOR ── */}
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Color de texto de botones</h3>
              <p className="text-[11px] text-slate-400">Color del texto dentro de los botones</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="color" name="buttonTextColor" value={theme.buttonTextColor}
              onChange={handleInputChange}
              className="w-10 h-10 rounded-lg border-2 border-slate-200 cursor-pointer" />
            <input type="text" name="buttonTextColor" value={theme.buttonTextColor}
              onChange={handleInputChange}
              placeholder="#ffffff"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none" />
          </div>
        </div>

        {/* ── FONT PICKER ── */}
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-500">Aa</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tipografía del menú</h3>
              <p className="text-[11px] text-slate-400">Fuente que verán tus clientes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {FONT_OPTIONS.map(font => {
              const isActive = theme.menuFont === font.id;
              return (
                <button key={font.id} type="button"
                  onClick={() => setTheme(prev => ({ ...prev, menuFont: font.id }))}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                    isActive
                      ? 'border-blue-400 bg-blue-50/50 shadow-sm'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                  }`}>
                    {isActive && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-slate-800" style={{ fontFamily: font.family }}>{font.label}</span>
                    <span className="block text-[10px] text-slate-400">{font.description}</span>
                  </div>
                  <span className="text-lg text-slate-300 shrink-0" style={{ fontFamily: font.family }}>Abc</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── MENU LAYOUT (collapsed categories) ── */}
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5M3.75 12h16.5M3.75 18.75h16.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Diseño del menú</h3>
              <p className="text-[11px] text-slate-400">Cómo se organizan tus categorías y productos</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Expandido */}
            <button type="button"
              onClick={() => setTheme(prev => ({ ...prev, collapsedMenu: false }))}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                !theme.collapsedMenu ? 'border-blue-400 bg-blue-50/40 shadow-sm' : 'border-slate-100 hover:border-slate-200'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800">Expandido</span>
                {!theme.collapsedMenu && (
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                )}
              </div>
              <div className="space-y-1">
                <div className="h-1.5 w-8 rounded-full bg-slate-300" />
                <div className="grid grid-cols-3 gap-0.5">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-4 rounded bg-slate-200" />)}
                </div>
                <div className="h-1.5 w-8 rounded-full bg-slate-300 mt-1" />
                <div className="grid grid-cols-3 gap-0.5">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-4 rounded bg-slate-200" />)}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-snug">Todo visible en scroll continuo</p>
            </button>

            {/* Colapsado */}
            <button type="button"
              onClick={() => setTheme(prev => ({ ...prev, collapsedMenu: true }))}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                theme.collapsedMenu ? 'border-blue-400 bg-blue-50/40 shadow-sm' : 'border-slate-100 hover:border-slate-200'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800">Colapsado</span>
                {theme.collapsedMenu && (
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                )}
              </div>
              <div className="space-y-1.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="h-3 flex-1 rounded bg-slate-200" />
                    <svg className="w-2.5 h-2.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-snug">Índice de categorías; el cliente entra a cada una</p>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            💡 Recomendado para cartas con <strong className="text-slate-500">muchos productos</strong>: el cliente ve primero los nombres de las categorías y entra a la que le interesa.
          </p>
        </div>

        {/* ── PREVIEW ── */}
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4 text-center">Vista previa</h3>
          <div className="bg-slate-50 rounded-xl p-4 space-y-3" style={{ fontFamily: activeFont.family }}>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800">{businessConfig?.businessName || 'Mi Negocio'}</p>
              <p className="text-xs text-slate-400">Menú Digital</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-200" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">Producto ejemplo</p>
                <p className="text-xs text-slate-400">Descripción del producto</p>
              </div>
              <span className="text-sm font-bold" style={{ color: activePrimary }}>$12.000</span>
            </div>
            <div className="flex gap-2 justify-center">
              <button type="button" className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
                style={{ backgroundColor: activePrimary, color: theme.buttonTextColor }}>
                Agregar al carrito
              </button>
              <button type="button" className="px-4 py-2 rounded-lg text-xs font-semibold border transition-colors"
                style={{ borderColor: activePrimary + '40', color: activePrimary }}>
                Ver menú
              </button>
            </div>
          </div>
        </div>

        {/* ── SAVE ── */}
        <div className="flex justify-center pt-2">
          <motion.button type="submit" disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.98 }}
            className={`w-full lg:w-auto px-8 py-3 rounded-xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
              loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}>
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Guardar cambios
              </>
            )}
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
};

export default ThemeSettings; 
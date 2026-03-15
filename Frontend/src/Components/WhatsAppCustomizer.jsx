import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Save, RotateCcw, ChevronUp, ChevronDown, Copy, Check, Lock } from 'lucide-react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

// Metadata de cada módulo (solo UI — el backend guarda id, enabled, order)
const MODULE_META = {
  header:        { icon: '🧾', label: 'Encabezado',            desc: 'Nombre del negocio',                required: true },
  orderType:     { icon: '🏍️', label: 'Tipo de pedido',        desc: 'Domicilio / Para llevar / En sitio' },
  customerName:  { icon: '👤', label: 'Nombre del cliente',     desc: 'Nombre de quien ordena' },
  address:       { icon: '📍', label: 'Dirección y zona',       desc: 'Dirección con zona de entrega' },
  phone:         { icon: '📞', label: 'Teléfono',               desc: 'Número de contacto del cliente' },
  paymentMethod: { icon: '💳', label: 'Método de pago',         desc: 'Forma de pago seleccionada' },
  products:      { icon: '🛒', label: 'Productos',              desc: 'Items con extras detallados',        required: true },
  totals:        { icon: '💰', label: 'Totales',                desc: 'Subtotal, envío, cupón y total',     required: true },
  customMessage: { icon: '✍️', label: 'Mensaje personalizado',  desc: 'Agrega tu mensaje al final',         hasText: true },
};

const DEFAULT_MODULES = [
  { id: 'header', enabled: true, order: 0 },
  { id: 'orderType', enabled: true, order: 1 },
  { id: 'customerName', enabled: true, order: 2 },
  { id: 'address', enabled: true, order: 3 },
  { id: 'phone', enabled: true, order: 4 },
  { id: 'paymentMethod', enabled: true, order: 5 },
  { id: 'products', enabled: true, order: 6 },
  { id: 'totals', enabled: true, order: 7 },
  { id: 'customMessage', enabled: false, order: 8 },
];

const WhatsAppCustomizer = () => {
  const { businessConfig, businessId } = useBusinessConfig();
  const [modules, setModules] = useState(DEFAULT_MODULES);
  const [customMessage, setCustomMessage] = useState('');
  const [originalState, setOriginalState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [previewTab, setPreviewTab] = useState('delivery');

  const businessName = businessConfig?.businessName || 'Mi Negocio';

  // Cargar configuración del template
  useEffect(() => {
    if (!businessId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/whatsapp-templates?businessId=${businessId}`);
        const data = res.data;
        const mods = data.modules?.length > 0
          ? [...data.modules].sort((a, b) => a.order - b.order)
          : DEFAULT_MODULES;
        const cm = data.customMessage || '';
        setModules(mods);
        setCustomMessage(cm);
        setOriginalState(JSON.stringify({ modules: mods, customMessage: cm }));
      } catch {
        setOriginalState(JSON.stringify({ modules: DEFAULT_MODULES, customMessage: '' }));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId]);

  const toggleModule = (id) => {
    if (MODULE_META[id]?.required) return;
    setModules(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  };

  const moveModule = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= modules.length) return;
    const arr = [...modules];
    [arr[index], arr[ni]] = [arr[ni], arr[index]];
    setModules(arr.map((m, i) => ({ ...m, order: i })));
  };

  const saveTemplate = async () => {
    if (!businessId) {
      setError('No se pudo identificar el negocio');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/whatsapp-templates', {
        businessId,
        modules: modules.map((m, i) => ({ id: m.id, enabled: m.enabled, order: i })),
        customMessage,
      });
      setOriginalState(JSON.stringify({ modules, customMessage }));
      setSuccess('Configuración guardada');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Error al guardar');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = () => {
    setModules([...DEFAULT_MODULES]);
    setCustomMessage('');
  };

  const hasChanges = JSON.stringify({ modules, customMessage }) !== originalState;

  // Generar texto de un módulo para la vista previa
  const getPreview = useCallback((moduleId) => {
    const payLabel = businessConfig?.paymentMethods
      ? (businessConfig.paymentMethods.nequi?.enabled ? 'Nequi' : businessConfig.paymentMethods.daviplata?.enabled ? 'Daviplata' : 'Efectivo')
      : (businessConfig?.paymentInfo?.nequi ? 'Nequi' : 'Efectivo');
    const hasZones = businessConfig?.deliveryZones?.length > 0;
    const isDel = previewTab === 'delivery';
    const isSite = previewTab === 'inSite';
    const map = {
      header: `🧾 *${businessName}*`,
      orderType: isDel ? '🏍️ Domicilio' : isSite ? (businessConfig?.businessType === 'hotel' ? '🏨 Hab. 4' : '🍽️ Mesa 4') : '🛒 Para llevar',
      customerName: '👤 Juan Pérez',
      address: isDel ? `📍 Calle 123 #45-67${hasZones ? ' (Centro)' : ''}` : null,
      phone: isDel ? '📞 +573001234567' : null,
      paymentMethod: `💳 Pago: ${payLabel}`,
      products: '2x *Hamburguesa Especial* · $26,000\n   ﹥ Proteína: Carne doble +$3,000\n   ﹥ Tipo de pan: Artesanal +$1,000\n1x *Coca-Cola 400ml* · $5,000',
      totals: isDel ? 'Subtotal: $39,000\nEnvío: $5,000\n*Total: $44,000*' : '*Total: $35,000*',
      customMessage: customMessage || null,
    };
    return map[moduleId] ?? null;
  }, [businessName, businessConfig, previewTab, customMessage]);

  // Construir vista previa completa
  const previewText = useMemo(() => {
    const SEP = new Set(['products', 'totals', 'customMessage']);
    const lines = [];
    for (const mod of [...modules].sort((a, b) => a.order - b.order)) {
      if (!mod.enabled) continue;
      const c = getPreview(mod.id);
      if (c === null) continue;
      if (SEP.has(mod.id) && lines.length > 0) lines.push('');
      lines.push(c);
    }
    return lines.join('\n');
  }, [modules, getPreview]);

  const copyPreview = async () => {
    try { await navigator.clipboard.writeText(previewText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  // Renderizar negrita de WhatsApp (*texto*)
  const fmtLine = (line, i) => {
    const p = []; let r = line, k = 0;
    while (r.length > 0) {
      const s = r.indexOf('*');
      if (s === -1) { p.push(<span key={k++}>{r}</span>); break; }
      const e = r.indexOf('*', s + 1);
      if (e === -1) { p.push(<span key={k++}>{r}</span>); break; }
      if (s > 0) p.push(<span key={k++}>{r.substring(0, s)}</span>);
      p.push(<strong key={k++}>{r.substring(s + 1, e)}</strong>);
      r = r.substring(e + 1);
    }
    return <div key={i}>{p.length ? p : '\u00A0'}</div>;
  };

  if (loading) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="text-green-600" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Personalizar Mensaje WhatsApp</h3>
            <p className="text-sm text-gray-500">Configura qué información incluir y en qué orden</p>
          </div>
        </div>
      </div>

      {/* Notificaciones */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-6 mt-4 p-3 bg-green-50 text-green-800 rounded-lg border border-green-200 text-sm">
            ✅ {success}
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-6 mt-4 p-3 bg-red-50 text-red-800 rounded-lg border border-red-200 text-sm">
            ❌ {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6 grid lg:grid-cols-2 gap-6">
        {/* Editor de módulos */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">📦 Módulos del mensaje</h4>
          <p className="text-xs text-gray-500">Activa, desactiva y reordena las secciones</p>

          <div className="space-y-2">
            {modules.map((mod, idx) => {
              const meta = MODULE_META[mod.id];
              if (!meta) return null;
              return (
                <motion.div key={mod.id} layout
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    mod.enabled ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-60'
                  }`}
                >
                  {/* Flechas de orden */}
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveModule(idx, -1)} disabled={idx === 0}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                      <ChevronUp size={14} />
                    </button>
                    <button onClick={() => moveModule(idx, 1)} disabled={idx === modules.length - 1}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  <span className="text-lg">{meta.icon}</span>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{meta.label}</div>
                    <div className="text-xs text-gray-500 truncate">{meta.desc}</div>
                  </div>

                  {meta.required ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">
                      <Lock size={12} /> Requerido
                    </div>
                  ) : (
                    <button onClick={() => toggleModule(mod.id)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        mod.enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        mod.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Textarea de mensaje personalizado */}
          {modules.find(m => m.id === 'customMessage')?.enabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">✍️ Tu mensaje personalizado</label>
              <textarea
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={3}
                placeholder="Ej: ¡Gracias por tu pedido! 🙏"
              />
            </motion.div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <motion.button whileTap={{ scale: 0.95 }} onClick={resetTemplate}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <RotateCcw size={14} /> Restaurar
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={saveTemplate} disabled={saving || !hasChanges}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                hasChanges ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}>
              <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
            </motion.button>
          </div>

          {hasChanges && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">⚠️ Tienes cambios sin guardar</p>
            </div>
          )}
        </div>

        {/* Vista previa */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">👁️ Vista previa</h4>
            <motion.button whileTap={{ scale: 0.95 }} onClick={copyPreview}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition-colors">
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? '¡Copiado!' : 'Copiar'}
            </motion.button>
          </div>

          {/* Tabs tipo de pedido */}
          <div className="flex gap-2">
            {[
              { id: 'delivery', label: '🏍️ Domicilio' },
              { id: 'takeaway', label: '🛒 Para llevar' },
              { id: 'inSite', label: '🍽️ En sitio' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setPreviewTab(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  previewTab === tab.id
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Burbuja de WhatsApp */}
          <div className="bg-[#e5ddd5] rounded-xl p-4 min-h-[300px]">
            <div className="max-w-sm">
              <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm">
                <div className="text-[13px] text-gray-800 leading-relaxed font-sans">
                  {previewText.split('\n').map((line, i) => fmtLine(line, i))}
                </div>
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-gray-400">
                    {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '🧾', text: 'Formato recibo compacto' },
              { icon: '🔀', text: 'Orden personalizable' },
              { icon: '🛒', text: 'Extras detallados' },
              { icon: '🏍️', text: 'Adapta al tipo de pedido' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-sm">{f.icon}</span>
                <span className="text-xs text-gray-600">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppCustomizer;

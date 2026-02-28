import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Copy, Check } from 'lucide-react';
import { useBusinessConfig } from '../Context/BusinessContext';

/**
 * WhatsApp Message Preview
 * Shows the admin a read-only preview of the compact receipt-style
 * message that customers send when ordering via WhatsApp.
 */
const WhatsAppCustomizer = () => {
  const { businessConfig } = useBusinessConfig();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('delivery');

  const businessName = businessConfig?.businessName || 'Mi Restaurante';
  const paymentLabel = businessConfig?.paymentInfo?.nequi ? 'Nequi' : businessConfig?.paymentInfo?.daviplata ? 'Daviplata' : 'Efectivo';

  const previews = {
    delivery: `🧾 *${businessName}*\n🏍️ Domicilio\n👤 Juan Pérez\n📍 Calle 123 #45-67${businessConfig?.deliveryZones?.length ? ' (Centro)' : ''}\n📞 +573001234567\n💳 Pago: ${paymentLabel}\n\n2x *Hamburguesa Especial* · $30,000\n   ﹥ Proteína: Carne doble +$3,000\n   ﹥ Tipo de pan: Artesanal +$1,000\n1x *Coca-Cola 400ml* · $5,000\n\nSubtotal: $39,000\nEnvío: $5,000\n*Total: $44,000*`,
    takeaway: `🧾 *${businessName}*\n🛒 Para llevar\n👤 María García\n💵 Pago: Efectivo\n\n1x *Bandeja Paisa* · $18,000\n1x *Limonada Natural* · $5,000\n\n*Total: $23,000*`,
    inSite: `🧾 *${businessName}*\n🍽️ Mesa 4\n👤 Carlos López\n\n3x *Pizza Margarita* · $45,000\n   ﹥ Tamaño: Familiar +$8,000\n2x *Cerveza* · $12,000\n\n*Total: $65,000*`,
  };

  const tabs = [
    { id: 'delivery', label: '🏍️ Domicilio' },
    { id: 'takeaway', label: '🛒 Para llevar' },
    { id: 'inSite', label: '🍽️ En sitio' },
  ];

  const currentPreview = previews[activeTab];

  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(currentPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { /* silent */ }
  };

  // Render WhatsApp-style formatting (*bold*)
  const formatLine = (line, lineIdx) => {
    const parts = [];
    let rest = line;
    let k = 0;
    while (rest.length > 0) {
      const s = rest.indexOf('*');
      if (s === -1) { parts.push(<span key={k++}>{rest}</span>); break; }
      const e = rest.indexOf('*', s + 1);
      if (e === -1) { parts.push(<span key={k++}>{rest}</span>); break; }
      if (s > 0) parts.push(<span key={k++}>{rest.substring(0, s)}</span>);
      parts.push(<strong key={k++}>{rest.substring(s + 1, e)}</strong>);
      rest = rest.substring(e + 1);
    }
    return <div key={lineIdx}>{parts.length ? parts : '\u00A0'}</div>;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="text-green-600" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Mensaje de WhatsApp</h3>
            <p className="text-sm text-gray-500">Así reciben tus clientes el pedido por WhatsApp</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="mx-6 mt-5 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
        <span className="text-lg mt-0.5">✅</span>
        <div>
          <p className="text-sm font-medium text-green-900">Formato optimizado automáticamente</p>
          <p className="text-xs text-green-700 mt-0.5">
            El mensaje se genera con un formato compacto estilo recibo. Incluye datos del cliente, productos con extras, método de pago y total.
          </p>
        </div>
      </div>

      {/* Tab selector */}
      <div className="px-6 mt-4 flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* WhatsApp-style preview */}
      <div className="p-6">
        <div className="bg-[#e5ddd5] rounded-xl p-4">
          <div className="max-w-sm">
            <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm">
              <div className="text-[13px] text-gray-800 leading-relaxed font-sans">
                {currentPreview.split('\n').map((line, i) => formatLine(line, i))}
              </div>
              <div className="flex justify-end mt-1">
                <span className="text-[10px] text-gray-400">
                  {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={copyPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? '¡Copiado!' : 'Copiar ejemplo'}
          </motion.button>
        </div>
      </div>

      {/* Features */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '🧾', text: 'Estilo recibo compacto' },
            { icon: '💳', text: 'Método de pago incluido' },
            { icon: '📍', text: 'Zona de entrega visible' },
            { icon: '🏷️', text: 'Cupones y descuentos' },
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
  );
};

export default WhatsAppCustomizer;

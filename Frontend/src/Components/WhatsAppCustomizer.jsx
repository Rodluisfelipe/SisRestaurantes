import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save, 
  RotateCcw, 
  Eye, 
  MessageSquare, 
  Clock, 
  User, 
  ShoppingBag, 
  Calculator,
  Building2,
  Copy,
  Check
} from 'lucide-react';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';

const WhatsAppCustomizer = () => {
  const { businessConfig, businessId } = useBusinessConfig();
  const [template, setTemplate] = useState('');
  const [originalTemplate, setOriginalTemplate] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Variables disponibles con sus descripciones
  const variables = [
    {
      name: '{{customerInfo}}',
      label: 'Datos del Cliente',
      icon: <User size={16} />,
      description: 'Nombre, teléfono, dirección del cliente',
      example: '*Nombre:* Juan Pérez\n*Teléfono:* +573001234567\n*Dirección:* Calle 123 #45-67'
    },
    {
      name: '{{orderDetails}}',
      label: 'Detalle del Pedido',
      icon: <ShoppingBag size={16} />,
      description: 'Lista de productos con cantidades y extras',
      example: '1. 2x Hamburguesa Especial\n   Precio unitario: $15.000\n   *Adicionales:*\n   • Carne extra (+$3.000)\n   *Subtotal:* $33.000'
    },
    {
      name: '{{orderSummary}}',
      label: 'Resumen Total',
      icon: <Calculator size={16} />,
      description: 'Cantidad de productos y total a pagar',
      example: '*Productos:* 2\n*Cantidad total:* 3 items\n*TOTAL A PAGAR:* $48.000'
    },
    {
      name: '{{businessName}}',
      label: 'Nombre del Negocio',
      icon: <Building2 size={16} />,
      description: 'Nombre de tu restaurante',
      example: businessConfig?.businessName || 'Mi Restaurante'
    },
    {
      name: '{{timestamp}}',
      label: 'Fecha y Hora',
      icon: <Clock size={16} />,
      description: 'Fecha y hora del pedido',
      example: 'Fecha: 18/12/2024 - 14:30'
    }
  ];

  useEffect(() => {
    loadTemplate();
  }, [businessId]);

  useEffect(() => {
    generatePreview();
  }, [template, businessConfig]);

  const loadTemplate = async () => {
    if (!businessId) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/whatsapp-templates?businessId=${businessId}`);
      const templateData = response.data.messageTemplate || getDefaultTemplate();
      setTemplate(templateData);
      setOriginalTemplate(templateData);
    } catch (err) {
      console.error('Error loading template:', err);
      const defaultTemplate = getDefaultTemplate();
      setTemplate(defaultTemplate);
      setOriginalTemplate(defaultTemplate);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultTemplate = () => {
    return `*** DATOS DEL CLIENTE ***
{{customerInfo}}
------------------------

*** DETALLE DEL PEDIDO ***
{{orderDetails}}

*** RESUMEN ***
{{orderSummary}}
------------------------

¡Gracias por tu pedido en {{businessName}}!
Tu orden será procesada inmediatamente.

{{timestamp}}`;
  };

  const generatePreview = () => {
    if (!template) return;

    let preview = template;
    
    // Reemplazar variables con ejemplos
    variables.forEach(variable => {
      const regex = new RegExp(variable.name.replace(/[{}]/g, '\\$&'), 'g');
      preview = preview.replace(regex, variable.example);
    });

    setPreviewMessage(preview);
  };

  const insertVariable = (variableName) => {
    const textarea = document.getElementById('template-textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const newTemplate = template.substring(0, start) + variableName + template.substring(end);
    setTemplate(newTemplate);
    
    // Restaurar el foco y posición del cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variableName.length, start + variableName.length);
    }, 0);
  };

  const saveTemplate = async () => {
    setSaving(true);
    setError('');
    
    try {
      await api.post('/whatsapp-templates', {
        businessId,
        messageTemplate: template
      });
      
      setOriginalTemplate(template);
      setSuccessMessage('Template guardado correctamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving template:', err);
      setError('Error al guardar el template');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = () => {
    const defaultTemplate = getDefaultTemplate();
    setTemplate(defaultTemplate);
  };

  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const hasChanges = template !== originalTemplate;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <MessageSquare className="mr-3 text-green-600" size={24} />
            Personalizar Mensaje WhatsApp
          </h3>
          <p className="text-gray-600 mt-1">
            Personaliza el formato del mensaje que se envía por WhatsApp para pedidos delivery
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowPreview(!showPreview)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
              showPreview 
                ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Eye size={16} />
            <span>{showPreview ? 'Ocultar' : 'Mostrar'} Vista Previa</span>
          </motion.button>
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg border border-green-200"
          >
            ✅ {successMessage}
          </motion.div>
        )}
        
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg border border-red-200"
          >
            ❌ {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Editor Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              📝 Editor de Template
            </label>
            
            {/* Variables Toolbar */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">🏷️ Variables Disponibles:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {variables.map((variable, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => insertVariable(variable.name)}
                    className="flex items-center space-x-2 p-2 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                    title={variable.description}
                  >
                    <div className="text-blue-600">{variable.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {variable.label}
                      </div>
                      <div className="text-xs text-gray-500 font-mono truncate">
                        {variable.name}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            <textarea
              id="template-textarea"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full h-80 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Escribe tu template personalizado aquí..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetTemplate}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
            >
              <RotateCcw size={16} />
              <span>Restaurar Predeterminado</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={saveTemplate}
              disabled={saving || !hasChanges}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                hasChanges 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save size={16} />
              <span>{saving ? 'Guardando...' : 'Guardar Template'}</span>
            </motion.button>
          </div>

          {hasChanges && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Tienes cambios sin guardar. Haz clic en "Guardar Template" para aplicar los cambios.
              </p>
            </div>
          )}
        </div>

        {/* Preview Section */}
        {showPreview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700">
                👁️ Vista Previa del Mensaje
              </label>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={copyPreview}
                className="flex items-center space-x-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </motion.button>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <MessageSquare className="text-white" size={16} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">WhatsApp</div>
                    <div className="text-xs text-gray-500">Vista previa del mensaje</div>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                    {previewMessage}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppCustomizer;

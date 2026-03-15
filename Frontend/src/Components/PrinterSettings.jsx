import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useBusinessConfig } from '../Context/BusinessContext';
import {
  FaPrint, FaSave, FaSyncAlt, FaCheckCircle, FaQrcode, FaRuler, FaEye
} from 'react-icons/fa';

// Inline ticket preview styles
const previewStyles = (paperWidth) => ({
  center: { textAlign: 'center', fontWeight: '900', color: '#000' },
  divider: { borderTop: '2px dashed #000', margin: '6px 0' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: '900', fontSize: '13px', color: '#000' },
  itemName: { fontWeight: '900', fontSize: '14px', color: '#000' },
  topping: { paddingLeft: '6px', fontSize: '12px', fontWeight: '900', color: '#000' },
});

const qrUrl = (url, size = 120) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png`;

export default function PrinterSettings() {
  const { businessConfig, businessId } = useBusinessConfig();
  const [paperSize, setPaperSize] = useState(businessConfig?.printerSettings?.paperSize || '55');
  const [showQR, setShowQR] = useState(businessConfig?.printerSettings?.showQR !== false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (businessConfig?.printerSettings) {
      setPaperSize(businessConfig.printerSettings.paperSize || '55');
      setShowQR(businessConfig.printerSettings.showQR !== false);
    }
  }, [businessConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/business-config', {
        businessId,
        printerSettings: { paperSize, showQR }
      });
      setSuccess('Configuración de impresora guardada');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving printer settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const slug = businessConfig?.slug || '';
  const menuLink = slug ? `https://menuby.tech/${slug}` : '';
  const businessName = businessConfig?.businessName || 'Mi Negocio';
  const businessAddress = businessConfig?.address || '';
  const businessPhone = businessConfig?.whatsappNumber || '';
  const nit = businessConfig?.nit || '';
  const S = previewStyles(paperSize);
  const widthPx = paperSize === '58' ? '210px' : '200px';

  return (
    <div className="space-y-4">
      {/* Settings Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
            <FaPrint className="text-[10px] text-slate-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Configuración de Impresora</h3>
        </div>

        <div className="p-4 space-y-5">
          {/* Paper Size */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <FaRuler className="inline text-[9px] mr-1" />
              Tamaño del papel
            </label>
            <div className="flex gap-3">
              {['55', '58'].map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPaperSize(size)}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 text-center transition-all ${
                    paperSize === size
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-lg font-black">{size}mm</span>
                  <span className="block text-[10px] mt-0.5 opacity-70">
                    {size === '55' ? 'Compacto' : 'Estándar'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* QR Toggle */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <FaQrcode className="inline text-[9px] mr-1" />
              Código QR del menú
            </label>
            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                showQR
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <FaQrcode className="text-sm" />
                <span className="text-xs font-bold">{showQR ? 'QR visible en comanda' : 'QR oculto en comanda'}</span>
              </div>
              <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${showQR ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${showQR ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              saving ? 'bg-slate-300 text-slate-500' : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
          >
            {saving ? <><FaSyncAlt className="animate-spin text-[10px]" /> Guardando...</> : <><FaSave className="text-[10px]" /> Guardar Configuración</>}
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
            <FaEye className="text-[10px] text-slate-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Vista Previa de Comanda</h3>
          <span className="text-[10px] text-slate-400 ml-auto">{paperSize}mm</span>
        </div>

        <div className="p-4 flex justify-center">
          <div
            className="bg-white border-2 border-slate-300 rounded-lg p-3 font-mono text-xs font-black"
            style={{ width: widthPx, color: '#000' }}
          >
            {/* Hanger */}
            <div style={{ height: '14px' }} />

            <div style={{ ...S.center, fontSize: '16px', marginBottom: '2px' }}>{businessName}</div>
            {businessAddress && <div style={{ ...S.center, fontSize: '10px' }}>{businessAddress}</div>}
            {businessPhone && <div style={{ ...S.center, fontSize: '10px' }}>Tel: {businessPhone}</div>}
            {nit && <div style={{ ...S.center, fontSize: '10px' }}>NIT: {nit}</div>}

            <div style={S.divider} />

            <div style={S.row}><span>Orden:</span><span>#001</span></div>
            <div style={S.row}><span>Fecha:</span><span>{new Date().toLocaleDateString('es-CO')}</span></div>
            <div style={S.row}><span>Hora:</span><span>{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span></div>

            <div style={S.divider} />

            <div style={{ marginBottom: '4px' }}>
              <div style={S.row}><span style={S.itemName}>2x Hamburguesa</span><span>$24.000</span></div>
              <div style={S.topping}>+ Queso extra ($2.000)</div>
            </div>
            <div style={{ marginBottom: '4px' }}>
              <div style={S.row}><span style={S.itemName}>1x Papas Fritas</span><span>$8.000</span></div>
            </div>

            <div style={S.divider} />

            <div style={{ ...S.row, fontSize: '16px' }}>
              <span>TOTAL</span>
              <span style={{ fontSize: '18px', fontWeight: '900' }}>$32.000</span>
            </div>

            <div style={S.divider} />
            <div style={{ ...S.center, marginTop: '4px', fontSize: '12px' }}>¡Gracias por su compra!</div>

            {showQR && menuLink && (
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <div style={{ ...S.center, fontSize: '11px', marginBottom: '4px' }}>¡Pide desde tu celular!</div>
                <img src={qrUrl(menuLink, 120)} alt="QR" width="100" height="100" style={{ display: 'block', margin: '0 auto' }} />
                <div style={{ ...S.center, fontSize: '10px', marginTop: '4px' }}>Escanea y pide con descuento</div>
                <div style={{ textAlign: 'center', fontSize: '9px', fontWeight: '900', color: '#000', marginTop: '2px' }}>{menuLink}</div>
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: '900', color: '#333', marginTop: '6px' }}>
              Gracias por usar MenuBy ❤️
            </div>
            <div style={{ textAlign: 'center', fontSize: '9px', fontWeight: 'bold', color: '#555', marginTop: '1px' }}>
              menuby.tech
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }} className="fixed top-20 right-4 z-50">
            <div className="bg-white border border-emerald-200 px-4 py-3 rounded-xl flex items-center gap-2">
              <FaCheckCircle className="text-xs text-emerald-500" />
              <p className="text-xs font-medium text-slate-700">{success}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

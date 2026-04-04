import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import { FaPrint, FaKey, FaCopy, FaCheck, FaTrash, FaDownload, FaCircle } from 'react-icons/fa';

export default function PrintAgentConfig() {
  const { businessConfig, businessId } = useBusinessConfig();
  const [printKey, setPrintKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (businessConfig?.printAgentKey) {
      setPrintKey(businessConfig.printAgentKey);
    }
  }, [businessConfig]);

  const handleGenerateKey = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/print-agent/generate-key');
      setPrintKey(res.data.key);
      setSuccess('Clave generada. Cópiala y pégala en el Print Agent.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error generando clave');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!window.confirm('¿Revocar la clave? El Print Agent dejará de funcionar hasta generar una nueva.')) return;
    setLoading(true);
    setError(null);
    try {
      await api.delete('/print-agent/revoke-key');
      setPrintKey('');
      setSuccess('Clave revocada');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error revocando clave');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(printKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestPrint = async () => {
    setLoading(true);
    try {
      await api.post('/print-agent/test-print');
      setSuccess('Prueba enviada. Si el agente está conectado, se imprimirá un ticket.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error enviando prueba');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const hasKey = !!printKey;
  const maskedKey = hasKey ? printKey.slice(0, 8) + '••••••••' + printKey.slice(-8) : '';

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-4">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="w-6 h-6 bg-emerald-50 rounded-lg flex items-center justify-center">
          <FaPrint className="text-[10px] text-emerald-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Print Agent — Auto Impresión</h3>
        {hasKey && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            <FaCircle className="text-[5px]" /> Activo
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Description */}
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            El <strong>Print Agent</strong> es un programa que instalas en el PC del restaurante.
            Imprime automáticamente un ticket cada vez que llega un nuevo pedido.
            No necesitas tocar nada — el ticket sale solo.
          </p>
        </div>

        {/* Steps */}
        {!hasKey ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">1</span>
              <div>
                <p className="text-sm font-semibold text-slate-800">Genera una clave de conexión</p>
                <p className="text-xs text-slate-500 mt-0.5">Esta clave permite que el programa se conecte a tu negocio de forma segura.</p>
              </div>
            </div>
            <button
              onClick={handleGenerateKey}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <FaKey className="text-xs" />
              {loading ? 'Generando...' : 'Generar Clave'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Key display */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Tu clave de conexión
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-100 rounded-lg px-3 py-2.5 font-mono text-xs text-slate-700 tracking-wider truncate">
                  {maskedKey}
                </div>
                <button
                  onClick={handleCopy}
                  className={`flex-shrink-0 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    copied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {copied ? <FaCheck /> : <FaCopy />}
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-blue-800">¿Cómo conectar?</p>
              <ol className="text-xs text-blue-700 space-y-1.5 list-decimal pl-4">
                <li>
                  <strong>Copia la clave</strong> con el botón de arriba
                </li>
                <li>
                  Abre <strong>menuby-print.exe</strong> en el PC del restaurante
                </li>
                <li>
                  Pega la clave cuando el programa la pida
                </li>
                <li>
                  Selecciona tu impresora y ¡listo!
                </li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleTestPrint}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                <FaPrint className="text-[10px]" />
                Enviar Prueba
              </button>
              <button
                onClick={handleRevokeKey}
                disabled={loading}
                className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <FaTrash className="text-[10px]" />
                Revocar
              </button>
            </div>

            {/* Regenerate */}
            <button
              onClick={handleGenerateKey}
              disabled={loading}
              className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
            >
              ¿Cambiar de PC? Genera una nueva clave
            </button>
          </div>
        )}

        {/* Messages */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-2 rounded-lg"
            >
              ✅ {success}
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 text-red-600 text-xs font-semibold px-3 py-2 rounded-lg"
            >
              ❌ {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

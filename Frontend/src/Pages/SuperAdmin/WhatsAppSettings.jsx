import { useState, useEffect, useCallback } from 'react';
import superadminApi from '../../services/superadminApi';

const STATE_CONFIG = {
  disabled: { label: 'Desactivado', color: 'text-slate-400', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  connecting: { label: 'Conectando...', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-400 animate-pulse' },
  qr: { label: 'Esperando escaneo', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-400 animate-pulse' },
  open: { label: 'Conectado', color: 'text-green-600', bg: 'bg-green-50', dot: 'bg-green-400' },
  closed: { label: 'Desconectado', color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-400' },
};

export default function WhatsAppSettings() {
  const [data, setData] = useState({ state: 'disabled', qrDataUrl: null });
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await superadminApi.get('/whatsapp/status');
      setData(res.data);
    } catch {
      setData({ state: 'disabled', qrDataUrl: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 5s while waiting for QR scan or connection
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleLogout = async () => {
    if (!confirm('¿Eliminar la sesión de WhatsApp? Tendrás que escanear el QR de nuevo.')) return;
    setLogoutLoading(true);
    try {
      const res = await superadminApi.post('/whatsapp/logout');
      setMsg(res.data.message || 'Sesión eliminada');
      fetchStatus();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Error al cerrar sesión');
    } finally {
      setLogoutLoading(false);
    }
  };

  const cfg = STATE_CONFIG[data.state] || STATE_CONFIG.disabled;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Estado actual */}
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${cfg.bg} border-current/10`}>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.state === 'open' && 'El número de MenuBy está activo y enviando notificaciones.'}
            {data.state === 'qr' && 'Escanea el código QR con WhatsApp del número de MenuBy.'}
            {data.state === 'connecting' && 'Conectando con WhatsApp...'}
            {data.state === 'closed' && 'La sesión fue cerrada. El servidor intentará reconectar.'}
            {data.state === 'disabled' && 'Activa WHATSAPP_ENABLED=true en el .env del servidor para usar esta función.'}
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          title="Actualizar"
        >
          ↻
        </button>
      </div>

      {/* QR para escanear */}
      {data.state === 'qr' && data.qrDataUrl && (
        <div className="flex flex-col items-center gap-4 p-6 bg-white border border-slate-200 rounded-xl">
          <p className="text-sm font-semibold text-slate-900">Escanea con WhatsApp</p>
          <img
            src={data.qrDataUrl}
            alt="WhatsApp QR"
            className="w-64 h-64 rounded-xl border border-slate-200"
          />
          <ol className="text-xs text-slate-500 space-y-1 text-left list-decimal list-inside">
            <li>Abre WhatsApp en el teléfono del número de MenuBy</li>
            <li>Ve a <strong>Configuración → Dispositivos vinculados</strong></li>
            <li>Toca <strong>Vincular dispositivo</strong> y escanea este código</li>
          </ol>
          <p className="text-[11px] text-slate-400">El QR se actualiza automáticamente cada 5 segundos</p>
        </div>
      )}

      {/* Conectado — info */}
      {data.state === 'open' && (
        <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-slate-900">Notificaciones activas</p>
          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Cambios de estado de pedidos → WhatsApp al cliente
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Recordatorios de reservas 24h y 1h antes
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-300">○</span> Mensajes de proveedores B2B (próximamente)
            </div>
          </div>
        </div>
      )}

      {/* Instrucciones para activar */}
      {data.state === 'disabled' && (
        <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-slate-900">Cómo activar</p>
          <div className="bg-slate-50 rounded-lg p-3 font-mono text-xs text-slate-600 space-y-1">
            <p className="text-slate-400"># En el servidor:</p>
            <p>echo "WHATSAPP_ENABLED=true" &gt;&gt; /opt/sisrestaurantes/Backend/.env</p>
            <p className="text-slate-400"># Luego reiniciar el contenedor:</p>
            <p>docker compose restart backend</p>
          </div>
          <p className="text-xs text-slate-400">
            Usa el número de teléfono de MenuBy para evitar que los restaurantes tengan riesgo de baneo.
          </p>
        </div>
      )}

      {msg && (
        <div className="text-sm text-center text-slate-500 py-2">{msg}</div>
      )}

      {/* Cerrar sesión */}
      {(data.state === 'open' || data.state === 'closed') && (
        <div className="flex justify-end">
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50 transition-colors"
          >
            {logoutLoading ? 'Cerrando...' : 'Cerrar sesión de WhatsApp'}
          </button>
        </div>
      )}
    </div>
  );
}

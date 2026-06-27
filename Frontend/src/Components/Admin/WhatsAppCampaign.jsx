import { useState, useEffect } from 'react';
import api from '../../services/api';

const MAX_CHARS = 1000;

function formatMinutes(m) {
  if (m < 1) return 'menos de 1 min';
  if (m === 1) return '~1 min';
  return `~${m} min`;
}

function timeUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function WhatsAppCampaign({ businessId }) {
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoadingStats(true);
      const res = await api.get('/whatsapp-campaign/stats');
      setStats(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Error al cargar estadísticas');
    } finally {
      setLoadingStats(false);
    }
  }

  async function handleSend() {
    if (!message.trim() || message.trim().length < 10) {
      setError('El mensaje debe tener al menos 10 caracteres');
      return;
    }
    setSending(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post('/whatsapp-campaign/send', { message });
      setResult(res.data);
      setMessage('');
      fetchStats();
    } catch (e) {
      setError(e.response?.data?.message || 'Error al enviar la campaña');
    } finally {
      setSending(false);
    }
  }

  const previewText = stats ? [
    `📢 *${stats.businessName}*`,
    '',
    message.trim() || '(tu mensaje aquí)',
    '',
    `🔗 Ver menú: ${stats.menuLink}`,
    '',
    `_Para no recibir más mensajes, responde "STOP"_`
  ].join('\n') : '';

  const waitTime = timeUntil(stats?.nextAllowed);
  const estimatedMinutes = stats ? Math.ceil(stats.eligibleCount / 15) : 0;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Campaña WhatsApp</h2>
        <p className="text-sm text-slate-500 mt-0.5">Envía un mensaje promocional a todos tus clientes con teléfono registrado</p>
      </div>

      {/* Stats cards */}
      {loadingStats ? (
        <div className="flex items-center justify-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.eligibleCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Clientes elegibles</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{formatMinutes(estimatedMinutes)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Tiempo estimado</p>
          </div>
          <div className={`col-span-2 sm:col-span-1 border rounded-xl p-3 text-center ${stats.canSend ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-sm font-semibold ${stats.canSend ? 'text-green-700' : 'text-amber-700'}`}>
              {stats.canSend ? '✅ Disponible' : `⏳ ${waitTime} restante`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.canSend
                ? stats.lastCampaign ? `Última: ${new Date(stats.lastCampaign).toLocaleDateString('es-CO')}` : 'Primera campaña'
                : `Cooldown ${stats.cooldownHours}h`}
            </p>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <label className="block text-sm font-semibold text-slate-900">
          Tu mensaje
          <span className={`ml-2 text-xs font-normal ${message.length > MAX_CHARS * 0.9 ? 'text-red-500' : 'text-slate-400'}`}>
            {message.length}/{MAX_CHARS}
          </span>
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value.slice(0, MAX_CHARS))}
          placeholder="Ej: 🎉 ¡Esta semana tenemos 2×1 en hamburguesas! Válido de lunes a jueves. Te esperamos."
          rows={5}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent placeholder:text-slate-300"
        />
        <p className="text-xs text-slate-400">
          💡 Sé directo y agrega una oferta o motivo para visitar. El link a tu menú se adjunta automáticamente.
        </p>
      </div>

      {/* Preview */}
      {message.trim() && stats && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vista previa del mensaje</p>
          <div className="bg-[#dcf8c6] rounded-xl rounded-tl-none px-4 py-3 text-sm whitespace-pre-wrap text-slate-800 max-w-xs shadow-sm">
            {previewText}
          </div>
          <p className="text-xs text-slate-400 ml-1">Así verán el mensaje tus clientes en WhatsApp</p>
        </div>
      )}

      {/* Error / Success */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-green-800">🚀 Campaña enviada</p>
          <p className="text-xs text-green-700">{result.message}</p>
        </div>
      )}

      {/* Send button */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {stats?.eligibleCount > 0
            ? `Se enviará a ${stats.eligibleCount} cliente${stats.eligibleCount !== 1 ? 's' : ''}`
            : 'No hay clientes con teléfono registrado'}
        </p>
        <button
          onClick={handleSend}
          disabled={sending || !stats?.canSend || !message.trim() || message.trim().length < 10 || stats?.eligibleCount === 0}
          className="flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar campaña
            </>
          )}
        </button>
      </div>

      {/* Opt-out note */}
      <p className="text-xs text-slate-400 text-center border-t border-slate-100 pt-4">
        Los clientes que respondan "STOP" son excluidos automáticamente de futuras campañas.
        Cooldown de {stats?.cooldownHours || 24}h entre campañas para proteger el número de MenuBy.
      </p>
    </div>
  );
}

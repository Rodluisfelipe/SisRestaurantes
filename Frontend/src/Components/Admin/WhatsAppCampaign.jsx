import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { CheckCircle2, Clock, Rocket } from 'lucide-react';

const MAX_CHARS = 1000;

function formatMinutes(m) {
  if (m < 1) return 'menos de 1 min';
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

function daysAgo(dateStr) {
  if (!dateStr) return Infinity;
  return (Date.now() - new Date(dateStr)) / 86400000;
}

const STATUS_LABEL = { vip: 'VIP', active: 'Activo', inactive: 'Inactivo' };
const STATUS_COLOR = {
  vip:      'bg-yellow-100 text-yellow-800',
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-500',
};

const QUICK_FILTERS = [
  { id: 'all',      label: 'Todos',         fn: () => true },
  { id: 'vip',      label: 'VIP',           fn: c => c.status === 'vip' },
  { id: 'active',   label: 'Activos',       fn: c => c.status === 'active' || c.status === 'vip' },
  { id: 'recent30', label: 'Últimos 30d',   fn: c => daysAgo(c.lastOrderDate) <= 30 },
  { id: 'recent90', label: 'Últimos 90d',   fn: c => daysAgo(c.lastOrderDate) <= 90 },
];

export default function WhatsAppCampaign({ businessId }) {
  const [stats, setStats]           = useState(null);
  const [customers, setCustomers]   = useState([]);
  const [selected, setSelected]     = useState(null); // null = todos, Set = selección manual
  const [quickFilter, setQuickFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [message, setMessage]       = useState('');
  const [sending, setSending]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(true);
  const [showList, setShowList]     = useState(false);

  useEffect(() => {
    Promise.all([fetchStats(), fetchCustomers()]);
  }, []);

  async function fetchStats() {
    try {
      const res = await api.get('/whatsapp-campaign/stats', { params: { businessId } });
      setStats(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Error al cargar estadísticas');
    }
  }

  async function fetchCustomers() {
    try {
      const res = await api.get('/whatsapp-campaign/customers', { params: { businessId } });
      setCustomers(res.data.customers || []);
    } catch {}
    finally { setLoading(false); }
  }

  // Apply quick filter + search
  const filtered = useMemo(() => {
    const qf = QUICK_FILTERS.find(f => f.id === quickFilter) || QUICK_FILTERS[0];
    return customers.filter(c => {
      if (!qf.fn(c)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return c.name?.toLowerCase().includes(q) || c.phone?.includes(q);
    });
  }, [customers, quickFilter, search]);

  // When quick filter changes, apply it as a selection
  function applyQuickFilter(filterId) {
    setQuickFilter(filterId);
    if (filterId === 'all') {
      setSelected(null); // null = enviar a todos
    } else {
      const qf = QUICK_FILTERS.find(f => f.id === filterId);
      const ids = new Set(customers.filter(qf.fn).map(c => c._id));
      setSelected(ids);
    }
  }

  function toggleOne(id) {
    setQuickFilter('manual');
    setSelected(prev => {
      const next = new Set(prev || customers.map(c => c._id));
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected === null || selected.size === customers.length) {
      setSelected(new Set()); // deselect all
      setQuickFilter('manual');
    } else {
      setSelected(null); // select all
      setQuickFilter('all');
    }
  }

  const selectedCount = selected === null ? customers.length : selected.size;
  const estimatedMinutes = Math.ceil(selectedCount / 15);

  async function handleSend() {
    if (!message.trim() || message.trim().length < 10) {
      setError('El mensaje debe tener al menos 10 caracteres');
      return;
    }
    if (selectedCount === 0) {
      setError('Selecciona al menos un contacto');
      return;
    }
    setSending(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        message,
        businessId,
        selectedIds: selected === null ? undefined : [...selected]
      };
      const res = await api.post('/whatsapp-campaign/send', payload);
      setResult(res.data);
      setMessage('');
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

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Campaña WhatsApp</h2>
        <p className="text-sm text-slate-500 mt-0.5">Envía un mensaje promocional a clientes seleccionados</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{selectedCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Seleccionados</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{formatMinutes(estimatedMinutes)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Tiempo estimado</p>
          </div>
          <div className={`border rounded-xl p-3 text-center ${stats.canSend ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-sm font-semibold inline-flex items-center justify-center gap-1 ${stats.canSend ? 'text-green-700' : 'text-amber-700'}`}>
              {stats.canSend ? <><CheckCircle2 className="w-4 h-4" /> Disponible</> : <><Clock className="w-4 h-4" /> {waitTime}</>}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.canSend
                ? stats.lastCampaign ? `Última: ${new Date(stats.lastCampaign).toLocaleDateString('es-CO')}` : 'Primera campaña'
                : `Cooldown ${stats.cooldownHours}h`}
            </p>
          </div>
        </div>
      )}

      {/* Contact selector */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Header row */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setShowList(v => !v)}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="text-sm font-semibold text-slate-900">
              Contactos — {selectedCount} de {customers.length} seleccionados
            </span>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${showList ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {showList && (
          <div className="border-t border-slate-100">
            {/* Quick filter chips */}
            <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-slate-100">
              {QUICK_FILTERS.map(f => {
                const count = f.id === 'all' ? customers.length : customers.filter(f.fn).length;
                const active = quickFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => applyQuickFilter(f.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      active
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-green-400'
                    }`}
                  >
                    {f.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search + select all */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono..."
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button
                onClick={toggleAll}
                className="text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap transition-colors"
              >
                {selected === null || selected.size === customers.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            {/* Customer list */}
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">No hay contactos con esos filtros</p>
              ) : filtered.map(c => {
                const isChecked = selected === null || selected.has(c._id);
                return (
                  <label
                    key={c._id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${isChecked ? '' : 'opacity-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(c._id)}
                      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-400"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{c.name}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[c.status] || STATUS_COLOR.active}`}>
                          {STATUS_LABEL[c.status] || 'Activo'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{c.phone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">{c.totalOrders} ped.</p>
                      {c.lastOrderDate && (
                        <p className="text-[10px] text-slate-400">
                          {Math.round(daysAgo(c.lastOrderDate))}d atrás
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Message composer */}
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
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400 placeholder:text-slate-300"
        />
        <p className="text-xs text-slate-400">
          💡 El link a tu menú se adjunta automáticamente al final del mensaje.
        </p>
      </div>

      {/* Preview */}
      {message.trim() && stats && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vista previa</p>
          <div className="bg-[#dcf8c6] rounded-xl rounded-tl-none px-4 py-3 text-sm whitespace-pre-wrap text-slate-800 max-w-xs shadow-sm">
            {previewText}
          </div>
        </div>
      )}

      {/* Error / Success */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-green-800 inline-flex items-center gap-1.5"><Rocket className="w-4 h-4" /> Campaña enviada</p>
          <p className="text-xs text-green-700">{result.message}</p>
        </div>
      )}

      {/* Send button */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {selectedCount > 0
            ? `Se enviará a ${selectedCount} contacto${selectedCount !== 1 ? 's' : ''}`
            : 'Selecciona al menos un contacto'}
        </p>
        <button
          onClick={handleSend}
          disabled={sending || !stats?.canSend || !message.trim() || message.trim().length < 10 || selectedCount === 0}
          className="flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar a {selectedCount} contacto{selectedCount !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center border-t border-slate-100 pt-4">
        Clientes que respondan "STOP" quedan excluidos de futuras campañas · Cooldown de {stats?.cooldownHours || 24}h entre envíos
      </p>
    </div>
  );
}

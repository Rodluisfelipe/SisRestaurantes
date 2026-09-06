import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import {
  FaLink, FaQrcode, FaChartBar, FaPlus, FaTrash, FaDownload,
  FaCopy, FaSpinner, FaStore, FaShoppingBag, FaMotorcycle, FaGlobe
} from 'react-icons/fa';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import SpotifyConfig from './SpotifyConfig';

/**
 * "Sigue tus ventas" — enlaces marcados, sus QR y de dónde viene cada venta.
 *
 * El dato de origen ya se guardaba en cada pedido desde hace tiempo, pero el
 * único reporte que lo mostraba vivía dentro del módulo de WhatsApp y exigía
 * ese complemento de pago. Un negocio podía llevar meses acumulando la
 * información y no tener forma de verla.
 */

const TIPOS = {
  inSite:   { label: 'Solo en sitio',    Icon: FaStore,       ayuda: 'El menú muestra únicamente "En mesa"' },
  takeaway: { label: 'Solo para recoger', Icon: FaShoppingBag, ayuda: 'El menú muestra únicamente "Para llevar"' },
  delivery: { label: 'Solo domicilio',   Icon: FaMotorcycle,  ayuda: 'El menú muestra únicamente "Domicilio"' },
  '':       { label: 'Todas las opciones', Icon: FaGlobe,      ayuda: 'El cliente elige como siempre' },
};

const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

export default function SalesTracking({ businessId }) {
  const { businessConfig } = useBusinessConfig();
  const slug = businessConfig?.slug || '';
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://menuby.tech';

  const [enlaces, setEnlaces] = useState([]);
  const [reporte, setReporte] = useState(null);
  const [dias, setDias] = useState(30);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', forzarTipo: '' });
  const [qrAbierto, setQrAbierto] = useState(null);

  const urlDe = useCallback(
    (enlace) => `${base}/${slug}?source=${encodeURIComponent(enlace.source)}`,
    [base, slug]
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [le, lr] = await Promise.all([
        api.get(`/tracked-links?businessId=${businessId}`),
        api.get(`/tracked-links/reporte?businessId=${businessId}&dias=${dias}`),
      ]);
      setEnlaces(le.data || []);
      setReporte(lr.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudieron cargar tus enlaces.');
    } finally {
      setCargando(false);
    }
  }, [businessId, dias]);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    if (!nuevo.nombre.trim()) { toast.error('Ponle un nombre al enlace'); return; }
    setCreando(true);
    try {
      await api.post('/tracked-links', {
        businessId,
        nombre: nuevo.nombre.trim(),
        forzarTipo: nuevo.forzarTipo || null,
      });
      setNuevo({ nombre: '', forzarTipo: '' });
      toast.success('Enlace creado');
      cargar();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo crear el enlace.');
    } finally {
      setCreando(false);
    }
  };

  const cambiarTipo = async (enlace, forzarTipo) => {
    try {
      await api.put(`/tracked-links/${enlace._id}`, { businessId, forzarTipo: forzarTipo || null });
      setEnlaces(prev => prev.map(e => e._id === enlace._id ? { ...e, forzarTipo: forzarTipo || null } : e));
      toast.success('Listo — los QR ya impresos siguen sirviendo');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo actualizar el enlace.');
    }
  };

  const eliminar = async (enlace) => {
    if (!confirm(`¿Eliminar "${enlace.nombre}"? Los QR que lo usen dejarán de estar marcados.`)) return;
    try {
      await api.delete(`/tracked-links/${enlace._id}?businessId=${businessId}`);
      toast.success('Enlace eliminado');
      cargar();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo eliminar el enlace.');
    }
  };

  const copiar = async (enlace) => {
    try {
      await navigator.clipboard.writeText(urlDe(enlace));
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar. Selecciónalo a mano.');
    }
  };

  if (!slug) {
    return <div className="p-6 text-center text-sm text-slate-500">Configura primero el enlace de tu negocio.</div>;
  }

  return (
    <div className="space-y-4">
      {/* ── Reporte ── */}
      <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FaChartBar className="text-blue-500 text-sm flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800">De dónde vienen tus ventas</h3>
              {reporte?.totales && (
                <p className="text-[11px] text-slate-500">
                  {reporte.totales.pedidos} pedidos · {pesos(reporte.totales.ventas)}
                </p>
              )}
            </div>
          </div>
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 flex-shrink-0"
          >
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
            <option value={365}>1 año</option>
          </select>
        </div>

        {cargando ? (
          <div className="py-10 text-center text-slate-400"><FaSpinner className="animate-spin mx-auto" /></div>
        ) : !reporte?.origenes?.length ? (
          <div className="py-8 px-4 text-center">
            <p className="text-sm font-medium text-slate-600">Todavía no hay ventas que medir</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Comparte los enlaces de abajo y acá verás cuántos pedidos y cuánta plata trajo cada canal.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2.5">
            {reporte.origenes.map((o) => {
              const mayor = Math.max(...reporte.origenes.map(x => x.ventas), 1);
              const pct = Math.round((o.ventas / mayor) * 100);
              return (
                <div key={o.origen}>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-[13px] font-semibold text-slate-700 truncate">{o.nombre}</span>
                    <span className="text-[13px] font-bold text-slate-800 tabular-nums flex-shrink-0">{pesos(o.ventas)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {o.pedidos} pedidos · ticket promedio {pesos(o.ticketPromedio)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Enlaces ── */}
      <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FaLink className="text-emerald-500 text-sm" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Tus enlaces</h3>
            <p className="text-[11px] text-slate-500">Cada uno tiene su QR y se mide por separado</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {enlaces.map((enlace) => {
            const tipo = TIPOS[enlace.forzarTipo || ''];
            const Icono = tipo.Icon;
            return (
              <div key={enlace._id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icono className="text-slate-400 text-xs flex-shrink-0" />
                      <span className="text-sm font-semibold text-slate-800 truncate">{enlace.nombre}</span>
                      {enlace.predefinido && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium flex-shrink-0">base</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">{urlDe(enlace)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => copiar(enlace)} title="Copiar enlace"
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                      <FaCopy className="text-xs" />
                    </button>
                    <button onClick={() => setQrAbierto(enlace)} title="Ver QR"
                      className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <FaQrcode className="text-xs" />
                    </button>
                    {!enlace.predefinido && (
                      <button onClick={() => eliminar(enlace)} title="Eliminar"
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <FaTrash className="text-xs" />
                      </button>
                    )}
                  </div>
                </div>

                <select
                  value={enlace.forzarTipo || ''}
                  onChange={(e) => cambiarTipo(enlace, e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 text-slate-600"
                >
                  {Object.entries(TIPOS).map(([valor, t]) => (
                    <option key={valor} value={valor}>{t.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">{tipo.ayuda}</p>

                {enlace.forzarTipo === 'inSite' && <SpotifyConfig businessId={businessId} />}
              </div>
            );
          })}
        </div>

        {/* Crear */}
        <div className="p-4 bg-slate-50/60 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-600 mb-2">Nuevo enlace</p>
          <input
            type="text"
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            placeholder="Ej: Instagram, Volante enero, Mesa 4..."
            className="w-full rounded-lg border border-slate-200 text-sm px-3 py-2 mb-2"
          />
          <select
            value={nuevo.forzarTipo}
            onChange={(e) => setNuevo({ ...nuevo, forzarTipo: e.target.value })}
            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 text-slate-600 mb-2"
          >
            {Object.entries(TIPOS).map(([valor, t]) => (
              <option key={valor} value={valor}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={crear}
            disabled={creando}
            className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {creando ? <FaSpinner className="animate-spin text-xs" /> : <FaPlus className="text-xs" />}
            Crear enlace
          </button>
        </div>
      </div>

      {qrAbierto && (
        <ModalQR enlace={qrAbierto} url={urlDe(qrAbierto)} onClose={() => setQrAbierto(null)} />
      )}
    </div>
  );
}

/** Modal con el QR y su descarga en PNG. */
function ModalQR({ enlace, url, onClose }) {
  const ref = useRef(null);

  const descargar = () => {
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas) { toast.error('No se pudo generar la imagen del QR.'); return; }
    const enlaceDescarga = document.createElement('a');
    enlaceDescarga.download = `qr-${enlace.source}.png`;
    enlaceDescarga.href = canvas.toDataURL('image/png');
    enlaceDescarga.click();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-xs w-full p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-slate-800 mb-1">{enlace.nombre}</h3>
        <p className="text-[11px] text-slate-400 mb-4 break-all">{url}</p>

        <div ref={ref} className="flex justify-center mb-4 p-3 bg-white rounded-xl border border-slate-100">
          {/* Nivel de corrección alto: un QR pegado en una mesa se raya, se
              moja y le cae salsa; con H sigue leyéndose con daño parcial. */}
          <QRCodeCanvas value={url} size={200} level="H" includeMargin />
        </div>

        <button onClick={descargar}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors mb-2">
          <FaDownload className="text-xs" /> Descargar PNG
        </button>
        <button onClick={onClose} className="w-full py-2 text-xs text-slate-500 hover:text-slate-700">Cerrar</button>
      </div>
    </div>
  );
}

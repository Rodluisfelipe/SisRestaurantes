import { useCallback, useEffect, useState } from 'react';
import superadminApi from '../../services/superadminApi';
import { SAEmptyState, SAToast } from './ui';

/**
 * Faltas de los domiciliarios y sus reclamos.
 *
 * Solo se anotan faltas que son culpa del domi (dejar vencer una oferta que su
 * app SÍ mostró, aceptar solo y no arrancar, no entregar sin llegar donde el
 * cliente, GPS falso). Si reclama, aquí se le da la razón (se anula y deja de
 * contar para su nivel) o se mantiene. "Día difícil" anula todas las de un día.
 */
const PESTANAS = [
  { id: 'en_revision', texto: 'Reclamos por revisar', color: 'bg-amber-100 text-amber-700' },
  { id: 'vigente', texto: 'Vigentes', color: 'bg-rose-100 text-rose-700' },
  { id: 'anulada', texto: 'Anuladas', color: 'bg-emerald-100 text-emerald-700' },
];

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

export default function FaltasDomis() {
  const [estado, setEstado] = useState('en_revision');
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState({ faltas: [], conteos: {} });
  const [cargando, setCargando] = useState(true);
  const [respuestas, setRespuestas] = useState({});
  const [ocupado, setOcupado] = useState(null);
  const [dia, setDia] = useState(hoyBogota());
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });
  const avisar = (message, type = 'success') => setToast({ visible: true, type, message });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await superadminApi.get('/red/faltas', { params: { estado, q } });
      setDatos(data);
    } catch (e) {
      avisar(e?.response?.data?.message || 'No se pudo cargar', 'error');
    } finally {
      setCargando(false);
    }
  }, [estado, q]);

  useEffect(() => { const t = setTimeout(cargar, q ? 300 : 0); return () => clearTimeout(t); }, [cargar, q]);

  const resolver = async (f, anular) => {
    setOcupado(f.id);
    try {
      await superadminApi.post(`/red/faltas/${f.id}/resolver`, { anular, respuesta: respuestas[f.id] || undefined });
      avisar(anular ? 'Falta anulada: ya no cuenta' : 'La falta se mantiene');
      cargar();
    } catch (e) {
      avisar(e?.response?.data?.message || 'No se pudo', 'error');
    } finally {
      setOcupado(null);
    }
  };

  const perdonarDia = async () => {
    if (!window.confirm(`¿Anular TODAS las faltas del ${dia}? Úsalo para días difíciles (lluvia fuerte, paro, caída del sistema).`)) return;
    try {
      const { data } = await superadminApi.post('/red/faltas/perdonar-dia', { fecha: dia });
      avisar(`${data.anuladas} ${data.anuladas === 1 ? 'falta anulada' : 'faltas anuladas'}`);
      cargar();
    } catch (e) {
      avisar(e?.response?.data?.message || 'No se pudo', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {PESTANAS.map((t) => (
            <button key={t.id} onClick={() => setEstado(t.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${estado === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.texto}
              {(datos.conteos?.[t.id] || 0) > 0 && <span className={`px-1.5 py-0.5 text-2xs font-bold rounded-full ${t.color}`}>{datos.conteos[t.id]}</span>}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por celular"
          className="h-9 w-56 max-w-full px-3 rounded-lg border border-slate-200 text-xs" />
      </div>

      <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-slate-50 border border-slate-200">
        <span className="text-xs text-slate-600 font-semibold">Día difícil:</span>
        <input type="date" value={dia} max={hoyBogota()} onChange={(e) => setDia(e.target.value)} className="h-8 px-2 rounded-lg border border-slate-200 text-xs" />
        <button onClick={perdonarDia} className="h-8 px-3 rounded-lg bg-slate-900 text-white text-[11px] font-bold">Anular las faltas de ese día</button>
        <span className="text-2xs text-slate-400">Lluvia fuerte, paro, caída del sistema…</span>
      </div>

      {cargando ? (
        <div className="space-y-2 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white border border-slate-200 rounded-xl" />)}</div>
      ) : datos.faltas.length === 0 ? (
        <SAEmptyState title={estado === 'en_revision' ? 'No hay reclamos por revisar' : 'No hay faltas en esta lista'} subtitle="Cuando un domi reclame una falta desde la app, aparece aquí." />
      ) : (
        <div className="space-y-2">
          {datos.faltas.map((f) => (
            <div key={f.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-start gap-3">
                {f.foto
                  ? <img src={f.foto} alt="" className="w-10 h-10 rounded-full object-cover" />
                  : <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">{(f.nombre || '?').slice(0, 1)}</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{f.nombre} <span className="text-slate-400 font-normal text-xs">· {f.telefono}</span></p>
                  <p className="text-xs text-slate-700">{f.motivo}</p>
                  <p className="text-2xs text-slate-400">{fecha(f.at)}{f.pedido ? ` · pedido #${f.pedido}` : ''}{f.negocio ? ` · ${f.negocio}` : ''}</p>
                </div>
              </div>
              {f.reclamo?.nota && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-900">
                  <b>Reclamo:</b> {f.reclamo.nota}
                  {f.reclamo.respuesta && <p className="text-slate-600 mt-1"><b>Respuesta:</b> {f.reclamo.respuesta}{f.reclamo.resueltoPor ? ` (${f.reclamo.resueltoPor})` : ''}</p>}
                </div>
              )}
              {f.estado !== 'anulada' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={respuestas[f.id] || ''} onChange={(e) => setRespuestas((r) => ({ ...r, [f.id]: e.target.value }))} maxLength={300}
                    placeholder="Respuesta para el domi (opcional)" className="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-slate-200 text-xs" />
                  {f.estado === 'en_revision' && (
                    <button disabled={ocupado === f.id} onClick={() => resolver(f, false)} className="h-9 px-3 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-bold disabled:opacity-50">Mantener</button>
                  )}
                  <button disabled={ocupado === f.id} onClick={() => resolver(f, true)} className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50">Anular falta</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <SAToast {...toast} onClose={() => setToast((t) => ({ ...t, visible: false }))} />
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import superadminApi from '../../services/superadminApi';
import { SAModal, SAEmptyState, SAToast } from './ui';

/**
 * Red MenuBy: los domiciliarios independientes que se registraron solos.
 *
 * El superadmin revisa documento y selfie (se ven por enlaces que vencen en
 * 5 minutos: son privados), aprueba o rechaza con un motivo que el domi va a
 * leer tal cual, y le asigna los negocios para los que reparte. Un
 * independiente aprobado sin negocios asignados no recibe nada.
 */
const PESTANAS = [
  { id: 'pendiente', texto: 'En revisión', color: 'bg-amber-100 text-amber-700' },
  { id: 'aprobado', texto: 'Aprobados', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'rechazado', texto: 'Rechazados', color: 'bg-rose-100 text-rose-700' },
  { id: 'suspendido', texto: 'Suspendidos', color: 'bg-slate-200 text-slate-700' },
];
const DOC = { cc: 'Cédula', ce: 'Cédula de extranjería', ppt: 'PPT', pasaporte: 'Pasaporte' };
const VEH = { moto: 'Moto', bicicleta: 'Bicicleta', carro: 'Carro', a_pie: 'A pie' };
const MOTIVOS_RECHAZO = [
  'La foto del documento está borrosa o cortada',
  'La selfie no coincide con el documento',
  'Falta el reverso del documento',
  'El documento está vencido',
  'El nombre no coincide con el documento',
];

const hace = (iso) => {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

export default function RedRepartidores() {
  const [estado, setEstado] = useState('pendiente');
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState({ repartidores: [], conteos: {} });
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(null);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });
  const avisar = (message, type = 'success') => setToast({ visible: true, type, message });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await superadminApi.get('/red/repartidores', { params: { estado, q } });
      setDatos(data);
    } catch (e) {
      avisar(e?.response?.data?.message || 'No se pudo cargar la lista', 'error');
    } finally {
      setCargando(false);
    }
  }, [estado, q]);

  useEffect(() => { const t = setTimeout(cargar, q ? 300 : 0); return () => clearTimeout(t); }, [cargar, q]);

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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, celular o documento"
          className="h-9 w-72 max-w-full px-3 rounded-lg border border-slate-200 text-xs" />
      </div>

      {cargando ? (
        <div className="grid sm:grid-cols-2 gap-2 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />)}</div>
      ) : datos.repartidores.length === 0 ? (
        <SAEmptyState
          title={estado === 'pendiente' ? 'Nadie esperando revisión' : 'No hay repartidores en esta lista'}
          description={estado === 'pendiente' ? 'Cuando alguien se registre desde la app de domiciliarios, aparece aquí.' : 'Cambia de pestaña o busca por nombre.'}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {datos.repartidores.map((r) => (
            <button key={r.id} onClick={() => setAbierto(r)}
              className="text-left p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center text-[15px] font-bold text-red-700 shrink-0">
                {(r.nombre || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{r.nombre}</p>
                <p className="text-[11px] text-slate-500 truncate">{r.telefono} · {DOC[r.documento?.tipo] || '—'} {r.documento?.numero}</p>
                <p className="text-[11px] text-slate-500 truncate">{VEH[r.vehiculo?.tipo] || '—'}{r.vehiculo?.placa ? ` · ${r.vehiculo.placa}` : ''} · enviado {hace(r.enviadoAt)}</p>
                {r.estado === 'aprobado' && (
                  <p className={`text-[11px] mt-1 font-semibold ${r.negocios.length ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {r.negocios.length ? `Reparte para ${r.negocios.length} ${r.negocios.length === 1 ? 'negocio' : 'negocios'}` : 'Sin negocios asignados: no recibe pedidos'}
                    {r.enLinea ? ' · conectado' : ''}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Detalle repartidor={abierto} alCerrar={() => setAbierto(null)} alCambiar={(m) => { avisar(m); cargar(); }} alError={(m) => avisar(m, 'error')} />
      <SAToast {...toast} onClose={() => setToast((t) => ({ ...t, visible: false }))} />
    </div>
  );
}

function Detalle({ repartidor: r, alCerrar, alCambiar, alError }) {
  const [fotos, setFotos] = useState(null);
  const [grande, setGrande] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [modo, setModo] = useState(null); // 'rechazar' | 'suspender'
  const [ocupado, setOcupado] = useState(false);
  const [negocios, setNegocios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);

  useEffect(() => {
    if (!r) return;
    setFotos(null); setModo(null); setMotivo(''); setNegocios(r.negocios || []); setBusqueda('');
    superadminApi.get(`/red/repartidores/${r.id}/documentos`).then(({ data }) => setFotos(data)).catch(() => setFotos({}));
  }, [r]);

  useEffect(() => {
    if (!busqueda.trim()) { setResultados([]); return undefined; }
    const t = setTimeout(() => {
      superadminApi.get('/red/negocios', { params: { q: busqueda } }).then(({ data }) => setResultados(data)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  if (!r) return null;

  const decidir = async (accion) => {
    setOcupado(true);
    try {
      await superadminApi.post(`/red/repartidores/${r.id}/${accion}`, accion === 'aprobar' ? {} : { motivo });
      alCambiar({ aprobar: `${r.nombre} aprobado`, rechazar: 'Registro devuelto con el motivo', suspender: `${r.nombre} suspendido` }[accion]);
      alCerrar();
    } catch (e) {
      alError(e?.response?.data?.message || 'No se pudo');
    } finally {
      setOcupado(false);
    }
  };

  const guardarNegocios = async () => {
    setOcupado(true);
    try {
      await superadminApi.put(`/red/repartidores/${r.id}/negocios`, { negocios: negocios.map((n) => n.id) });
      alCambiar('Negocios asignados');
      alCerrar();
    } catch (e) {
      alError(e?.response?.data?.message || 'No se pudo guardar');
    } finally {
      setOcupado(false);
    }
  };

  const cambiosNegocios = JSON.stringify(negocios.map((n) => n.id).sort()) !== JSON.stringify((r.negocios || []).map((n) => n.id).sort());

  return (
    <SAModal isOpen={!!r} onClose={alCerrar} title={r.nombre} subtitle={`${r.telefono}${r.email ? ` · ${r.email}` : ''} · ${DOC[r.documento?.tipo] || ''} ${r.documento?.numero || ''}`} width="max-w-2xl">
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Dato titulo="Estado" valor={PESTANAS.find((p) => p.id === r.estado)?.texto || r.estado} />
          <Dato titulo="Vehículo" valor={`${VEH[r.vehiculo?.tipo] || '—'}${r.vehiculo?.placa ? ` · ${r.vehiculo.placa}` : ''}`} />
          <Dato titulo="Entregas" valor={r.entregas} />
          <Dato titulo="Calificación" valor={`★ ${Number(r.calificacion || 5).toFixed(1)}`} />
        </div>

        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Documentos (privados · el enlace vence en 5 min)</p>
          <div className="grid grid-cols-3 gap-2">
            {[['frente', 'Documento (frente)'], ['reverso', 'Documento (reverso)'], ['selfie', 'Selfie']].map(([k, t]) => (
              <button key={k} onClick={() => fotos?.[k] && setGrande({ src: fotos[k], t })} className="text-left">
                <div className="aspect-[4/3] rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                  {fotos === null ? <span className="text-2xs text-slate-400">Cargando…</span>
                    : fotos[k] ? <img src={fotos[k]} alt={t} className="w-full h-full object-cover" />
                    : <span className="text-2xs text-slate-400">{k === 'reverso' && r.documento?.tipo === 'pasaporte' ? 'No aplica' : 'Sin foto'}</span>}
                </div>
                <p className="text-2xs text-slate-500 mt-1">{t}</p>
              </button>
            ))}
          </div>
        </div>

        {r.motivo && <p className="text-xs text-rose-600">Último motivo: {r.motivo}</p>}
        {r.revisadoAt && <p className="text-2xs text-slate-400">Revisado {hace(r.revisadoAt)}{r.revisadoPor ? ` por ${r.revisadoPor}` : ''}</p>}

        {r.estado === 'aprobado' && (
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-bold text-slate-700">Negocios para los que reparte</p>
            <div className="flex flex-wrap gap-1.5">
              {negocios.length === 0 && <span className="text-xs text-amber-700">Ninguno todavía: sin esto no recibe pedidos.</span>}
              {negocios.map((n) => (
                <span key={n.id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-slate-900 text-white text-[11px] font-semibold">
                  {n.nombre}
                  <button onClick={() => setNegocios((l) => l.filter((x) => x.id !== n.id))} className="w-5 h-5 rounded-full hover:bg-white/20" aria-label={`Quitar ${n.nombre}`}>×</button>
                </span>
              ))}
            </div>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar negocio para agregar…" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs" />
            {resultados.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
                {resultados.filter((n) => !negocios.some((x) => x.id === n.id)).map((n) => (
                  <button key={n.id} onClick={() => { setNegocios((l) => [...l, n]); setBusqueda(''); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs">
                    <span className="font-semibold text-slate-800">{n.nombre}</span> <span className="text-slate-400">/{n.slug}</span>
                    {n.direccion && <span className="block text-2xs text-slate-400 truncate">{n.direccion}</span>}
                  </button>
                ))}
              </div>
            )}
            {cambiosNegocios && (
              <button disabled={ocupado} onClick={guardarNegocios} className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50">Guardar negocios</button>
            )}
          </div>
        )}

        {modo && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-rose-700">{modo === 'rechazar' ? 'Motivo (el domi lo va a leer)' : 'Motivo de la suspensión'}</p>
            {modo === 'rechazar' && (
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_RECHAZO.map((m) => (
                  <button key={m} onClick={() => setMotivo(m)} className={`px-2 py-1 rounded-md text-2xs border ${motivo === m ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-700 border-rose-200'}`}>{m}</button>
                ))}
              </div>
            )}
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={2} className="w-full px-3 py-2 rounded-lg border border-rose-200 text-xs" />
            <div className="flex gap-2">
              <button onClick={() => { setModo(null); setMotivo(''); }} className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs font-semibold">Cancelar</button>
              <button disabled={ocupado || motivo.trim().length < 4} onClick={() => decidir(modo)} className="h-9 px-4 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-50">
                {modo === 'rechazar' ? 'Devolver registro' : 'Suspender'}
              </button>
            </div>
          </div>
        )}

        {!modo && (
          <div className="flex flex-wrap gap-2 justify-end pt-1">
            {r.estado === 'pendiente' && <button onClick={() => setModo('rechazar')} className="h-10 px-4 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold">Rechazar</button>}
            {r.estado === 'aprobado' && <button onClick={() => setModo('suspender')} className="h-10 px-4 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold">Suspender</button>}
            {['pendiente', 'rechazado', 'suspendido'].includes(r.estado) && (
              <button disabled={ocupado} onClick={() => decidir('aprobar')} className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50">
                {r.estado === 'suspendido' ? 'Reactivar' : 'Aprobar'}
              </button>
            )}
          </div>
        )}
      </div>

      {grande && (
        <div className="fixed inset-0 z-[70] bg-black/85 flex flex-col items-center justify-center p-4" onClick={() => setGrande(null)}>
          <img src={grande.src} alt={grande.t} className="max-w-full max-h-[85vh] rounded-lg" />
          <p className="text-white text-sm mt-3">{grande.t}</p>
        </div>
      )}
    </SAModal>
  );
}

function Dato({ titulo, valor }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-2xs text-slate-400 uppercase tracking-wide font-bold">{titulo}</p>
      <p className="text-[12.5px] font-semibold text-slate-800 mt-0.5">{valor}</p>
    </div>
  );
}

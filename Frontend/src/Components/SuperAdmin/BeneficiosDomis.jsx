import { useCallback, useEffect, useState } from 'react';
import superadminApi from '../../services/superadminApi';
import { SAModal, SAEmptyState, SAToast } from './ui';

/**
 * Beneficios para los domiciliarios: título, descripción, enlace y una imagen
 * pequeña. Los domis los ven en MenuBy Go y los canjean con su código único
 * (MB-XXXXXX); el canje queda en firme cuando lo confirman desde su correo.
 *
 * El enlace puede ser la página del aliado o una propia: la app le agrega
 * ?codigo=MB-XXXXXX para que llegue con el código del domi ya puesto.
 */
const VACIO = { titulo: '', descripcion: '', enlace: '', activo: true };

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

export default function BeneficiosDomis() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null); // null | 'nuevo' | beneficio
  const [canjes, setCanjes] = useState(null); // beneficio cuyos canjes se ven
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });
  const avisar = (message, type = 'success') => setToast({ visible: true, type, message });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await superadminApi.get('/red/beneficios');
      setLista(data);
    } catch (e) {
      avisar(e?.response?.data?.message || 'No se pudo cargar', 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const borrar = async (b) => {
    if (!window.confirm(`¿Borrar "${b.titulo}"? Los domis dejan de verlo. Los canjes hechos se conservan.`)) return;
    try {
      await superadminApi.delete(`/red/beneficios/${b.id}`);
      avisar('Beneficio borrado');
      cargar();
    } catch (e) {
      avisar(e?.response?.data?.message || 'No se pudo borrar', 'error');
    }
  };

  const alternar = async (b) => {
    try {
      await superadminApi.patch(`/red/beneficios/${b.id}`, { activo: !b.activo });
      avisar(b.activo ? 'Oculto para los domis' : 'Visible para los domis');
      cargar();
    } catch (e) {
      avisar(e?.response?.data?.message || 'No se pudo cambiar', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-slate-500 max-w-xl">
          Lo que publiques aquí lo ven todos los domis en MenuBy Go → Yo → Beneficios. Lo canjean con su código único y lo confirman desde su correo.
        </p>
        <button onClick={() => setEditando('nuevo')} className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold">
          + Nuevo beneficio
        </button>
      </div>

      {cargando ? (
        <div className="grid sm:grid-cols-2 gap-3 animate-pulse">{[...Array(2)].map((_, i) => <div key={i} className="h-40 bg-white border border-slate-200 rounded-xl" />)}</div>
      ) : lista.length === 0 ? (
        <SAEmptyState title="Todavía no hay beneficios" subtitle="Crea el primero: un descuento, un convenio, lo que quieras ofrecerle a los domis." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {lista.map((b) => (
            <div key={b.id} className={`bg-white border rounded-xl overflow-hidden ${b.activo ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'}`}>
              {b.imagen && <img src={b.imagen} alt="" className="w-full h-28 object-cover bg-slate-100" />}
              <div className="p-3 space-y-1.5">
                <div className="flex items-start gap-2">
                  <p className="text-sm font-semibold text-slate-900 flex-1">{b.titulo}</p>
                  {!b.activo && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-2xs font-bold">Oculto</span>}
                </div>
                {b.descripcion && <p className="text-xs text-slate-500 line-clamp-2">{b.descripcion}</p>}
                {b.enlace && <a href={b.enlace} target="_blank" rel="noreferrer" className="block text-[11px] text-blue-600 truncate">{b.enlace}</a>}
                <button onClick={() => setCanjes(b)} className="text-[11px] font-semibold text-emerald-700 hover:underline">
                  {b.canjes.confirmados} {b.canjes.confirmados === 1 ? 'canje' : 'canjes'}{b.canjes.pendientes ? ` · ${b.canjes.pendientes} sin confirmar` : ''} →
                </button>
                <div className="flex gap-1.5 pt-1">
                  <button onClick={() => setEditando(b)} className="h-8 px-3 rounded-lg border border-slate-200 text-[11px] font-semibold">Editar</button>
                  <button onClick={() => alternar(b)} className="h-8 px-3 rounded-lg border border-slate-200 text-[11px] font-semibold">{b.activo ? 'Ocultar' : 'Mostrar'}</button>
                  <button onClick={() => borrar(b)} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-700 text-[11px] font-semibold ml-auto">Borrar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Formulario
        beneficio={editando}
        alCerrar={() => setEditando(null)}
        alGuardar={(m) => { avisar(m); setEditando(null); cargar(); }}
        alError={(m) => avisar(m, 'error')}
      />
      <Canjes beneficio={canjes} alCerrar={() => setCanjes(null)} />
      <SAToast {...toast} onClose={() => setToast((t) => ({ ...t, visible: false }))} />
    </div>
  );
}

function Formulario({ beneficio, alCerrar, alGuardar, alError }) {
  const nuevo = beneficio === 'nuevo';
  const [form, setForm] = useState(VACIO);
  const [imagen, setImagen] = useState(null);
  const [vista, setVista] = useState(null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!beneficio) return;
    setForm(nuevo ? VACIO : { titulo: beneficio.titulo, descripcion: beneficio.descripcion || '', enlace: beneficio.enlace || '', activo: beneficio.activo });
    setImagen(null);
    setVista(nuevo ? null : beneficio.imagen || null);
    setQuitarImagen(false);
  }, [beneficio, nuevo]);

  if (!beneficio) return null;

  const elegirImagen = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { alError('La imagen no puede pasar de 5 MB'); return; }
    setImagen(f);
    setVista(URL.createObjectURL(f));
    setQuitarImagen(false);
  };

  const guardar = async () => {
    setOcupado(true);
    try {
      const datos = new FormData();
      datos.append('titulo', form.titulo.trim());
      datos.append('descripcion', form.descripcion.trim());
      datos.append('enlace', form.enlace.trim());
      datos.append('activo', String(form.activo));
      if (imagen) datos.append('imagen', imagen);
      if (quitarImagen) datos.append('quitarImagen', 'true');
      const cfg = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (nuevo) await superadminApi.post('/red/beneficios', datos, cfg);
      else await superadminApi.patch(`/red/beneficios/${beneficio.id}`, datos, cfg);
      alGuardar(nuevo ? 'Beneficio publicado' : 'Beneficio guardado');
    } catch (e) {
      alError(e?.response?.data?.message || 'No se pudo guardar');
    } finally {
      setOcupado(false);
    }
  };

  const valido = form.titulo.trim().length >= 3 && (!form.enlace.trim() || /^https?:\/\/\S+$/i.test(form.enlace.trim()));

  return (
    <SAModal isOpen={!!beneficio} onClose={alCerrar} title={nuevo ? 'Nuevo beneficio' : 'Editar beneficio'} width="max-w-lg">
      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Título</span>
          <input value={form.titulo} maxLength={80} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Cambio de aceite gratis"
            className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Descripción</span>
          <textarea value={form.descripcion} maxLength={600} rows={3} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Dónde, cómo y hasta cuándo aplica"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Enlace</span>
          <input value={form.enlace} maxLength={500} onChange={(e) => setForm({ ...form, enlace: e.target.value })} placeholder="https://…"
            className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" />
          <span className="text-2xs text-slate-400">La app le agrega <b>?codigo=MB-XXXXXX</b> con el código del domi.</span>
        </label>
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Imagen (pequeña)</span>
          <div className="mt-1 flex items-center gap-3">
            {vista ? (
              <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-slate-200">
                <img src={vista} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setImagen(null); setVista(null); setQuitarImagen(!nuevo); }}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white text-xs" aria-label="Quitar imagen">×</button>
              </div>
            ) : null}
            <label className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold flex items-center cursor-pointer hover:bg-slate-50">
              {vista ? 'Cambiar imagen' : 'Subir imagen'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirImagen} className="hidden" />
            </label>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
          Visible para los domis
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={alCerrar} className="h-10 px-4 rounded-lg border border-slate-200 text-xs font-semibold">Cancelar</button>
          <button disabled={!valido || ocupado} onClick={guardar} className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50">
            {ocupado ? 'Guardando…' : nuevo ? 'Publicar' : 'Guardar'}
          </button>
        </div>
      </div>
    </SAModal>
  );
}

function Canjes({ beneficio, alCerrar }) {
  const [lista, setLista] = useState(null);

  useEffect(() => {
    if (!beneficio) return;
    setLista(null);
    superadminApi.get(`/red/beneficios/${beneficio.id}/canjes`).then(({ data }) => setLista(data)).catch(() => setLista([]));
  }, [beneficio]);

  if (!beneficio) return null;
  return (
    <SAModal isOpen={!!beneficio} onClose={alCerrar} title="Canjes" subtitle={beneficio.titulo} width="max-w-2xl">
      {lista === null ? <p className="text-xs text-slate-400">Cargando…</p>
        : lista.length === 0 ? <p className="text-xs text-slate-500">Nadie lo ha canjeado todavía.</p>
        : (
          <div className="divide-y divide-slate-100">
            {lista.map((c) => (
              <div key={c.id} className="py-2 flex items-center gap-3 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{c.nombre} <span className="text-slate-400 font-normal">· {c.codigo}</span></p>
                  <p className="text-2xs text-slate-500 truncate">{c.telefono} · {c.correo} · desde {c.origen === 'web' ? 'la página' : 'la app'} · {fecha(c.pedidoAt)}</p>
                </div>
                {c.estado === 'confirmado'
                  ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-2xs font-bold">Confirmado · {c.comprobante}</span>
                  : <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-2xs font-bold">Sin confirmar</span>}
              </div>
            ))}
          </div>
        )}
    </SAModal>
  );
}

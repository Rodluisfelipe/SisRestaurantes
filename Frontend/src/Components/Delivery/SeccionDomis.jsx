import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FaMotorcycle, FaPlus, FaTimes } from 'react-icons/fa';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import CuadreDomis from './CuadreDomis';

/**
 * Domiciliarios (MenuBy Go).
 *
 * Los domis entran a la app MenuBy Go con su celular y un PIN de 4 números.
 * Aquí el negocio los agrega, ve quién está conectado y quién va en ruta, y
 * más abajo cuadra el efectivo y define cómo les paga.
 *
 * Si alguien ya usa MenuBy Go con otro negocio, al agregarlo entra con su PIN
 * de siempre: el PIN es de la persona, no de cada negocio.
 */
const haceCuanto = (iso) => {
  if (!iso) return 'nunca se ha conectado';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'visto ahora';
  if (min < 60) return `visto hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `visto hace ${h} h`;
  const d = Math.round(h / 24);
  return `visto hace ${d} ${d === 1 ? 'día' : 'días'}`;
};
const celular = (t) => String(t || '').replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');

function Avatar({ d }) {
  if (d.foto) return <img src={d.foto} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />;
  return <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-[15px] font-bold text-slate-500 shrink-0">{(d.nombre || '?')[0]}</div>;
}

function Estado({ d }) {
  if (!d.activo) return <span className="text-slate-400">Desactivado</span>;
  if (!d.enLinea) return <span className="text-slate-400">○ Desconectado · {haceCuanto(d.ultimaVez)}</span>;
  if (d.pedidosActivos > 0) return <span className="text-sky-600">● En ruta · lleva {d.pedidosActivos} {d.pedidosActivos === 1 ? 'pedido' : 'pedidos'} tuyos</span>;
  return <span className="text-emerald-600">● Conectado, libre</span>;
}

function FormularioNuevo({ alCrear, alCerrar }) {
  const { businessId } = useBusinessConfig();
  const [f, setF] = useState({ nombre: '', telefono: '', pin: '' });
  const [enviando, setEnviando] = useState(false);
  const poner = (k) => (e) => setF((x) => ({ ...x, [k]: k === 'nombre' ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, k === 'pin' ? 4 : 10) }));

  const guardar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const { data } = await api.post('/domi-app/negocio/domis', { ...f, businessId });
      toast.success(data.yaTeniaCuenta
        ? `${f.nombre} ya usaba MenuBy Go: entra con su celular y su PIN de siempre.`
        : data.reactivado ? `${f.nombre} está activo otra vez.` : `Listo. ${f.nombre} entra a MenuBy Go con su celular y el PIN ${f.pin}.`);
      alCrear();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo agregar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] font-bold text-slate-800">Agregar domiciliario</p>
        <button type="button" onClick={alCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-slate-200"><FaTimes className="text-slate-400" /></button>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <label className="text-[12px] font-semibold text-slate-600">Nombre
          <input value={f.nombre} onChange={poner('nombre')} required minLength={3} placeholder="Carlos Rojas"
            className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13.5px] font-medium text-slate-800" />
        </label>
        <label className="text-[12px] font-semibold text-slate-600">Celular
          <input value={f.telefono} onChange={poner('telefono')} required inputMode="numeric" placeholder="300 123 4567"
            className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13.5px] font-medium text-slate-800" />
        </label>
        <label className="text-[12px] font-semibold text-slate-600">PIN (4 números)
          <input value={f.pin} onChange={poner('pin')} inputMode="numeric" placeholder="4826"
            className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13.5px] font-medium tracking-[0.3em] text-slate-800" />
        </label>
      </div>
      <p className="text-[11.5px] text-slate-500">
        Con ese celular y PIN entra a la app <b>MenuBy Go</b>. Si ya la usa con otro negocio, deja el PIN vacío: entra con el suyo de siempre.
      </p>
      <button disabled={enviando} className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[13px] font-bold">
        {enviando ? 'Guardando…' : 'Agregar'}
      </button>
    </form>
  );
}

function FilaDomi({ d, editable, alCambiar }) {
  const { businessId } = useBusinessConfig();
  const [menu, setMenu] = useState(false);

  const activar = async () => {
    try {
      await api.patch(`/domi-app/negocio/domis/${d.id}`, { activo: !d.activo, businessId });
      toast.success(d.activo ? `${d.nombre} desactivado: ya no recibe tus pedidos.` : `${d.nombre} activo otra vez.`);
      alCambiar();
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo cambiar.');
    }
    setMenu(false);
  };
  const cambiarPin = async () => {
    setMenu(false);
    const pin = window.prompt(`Nuevo PIN de 4 números para ${d.nombre}:`);
    if (!pin) return;
    try {
      await api.post(`/domi-app/negocio/domis/${d.id}/pin`, { pin: pin.trim(), businessId });
      toast.success(`PIN cambiado. ${d.nombre} entra con el nuevo PIN.`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo cambiar el PIN.');
    }
  };
  const renombrar = async () => {
    setMenu(false);
    const nombre = window.prompt('Nombre del domiciliario:', d.nombre);
    if (!nombre || nombre.trim() === d.nombre) return;
    try {
      await api.patch(`/domi-app/negocio/domis/${d.id}`, { nombre, businessId });
      alCambiar();
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo cambiar el nombre.');
    }
  };

  return (
    <div className={`flex items-center gap-3 px-4 lg:px-6 py-3.5 ${d.activo ? '' : 'opacity-60'}`}>
      <Avatar d={d} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-slate-800 truncate">
          {d.nombre}{d.tipo === 'red' && <span className="ml-1.5 text-2xs font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">Red MenuBy</span>}
        </p>
        <p className="text-[11.5px] font-semibold"><Estado d={d} /></p>
        <p className="text-[11px] text-slate-400">
          {celular(d.telefono)} · {d.entregasHoy} {d.entregasHoy === 1 ? 'entrega' : 'entregas'} hoy
        </p>
      </div>
      {editable && (
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="h-9 px-3 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50">Opciones</button>
          {menu && (
            <div className="absolute right-0 top-10 z-10 w-48 rounded-xl border border-slate-100 bg-white shadow-lg py-1 text-[13px]">
              <button onClick={renombrar} className="w-full text-left px-3 py-2 hover:bg-slate-50">Cambiar nombre</button>
              {d.activo && <button onClick={cambiarPin} className="w-full text-left px-3 py-2 hover:bg-slate-50">Cambiar PIN</button>}
              <button onClick={activar} className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${d.activo ? 'text-red-600' : 'text-emerald-700'}`}>
                {d.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SeccionDomis() {
  // businessId en cada llamada: desde el superadmin la sesión no trae negocio
  const { businessId } = useBusinessConfig();
  const [datos, setDatos] = useState(null);
  const [nuevo, setNuevo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/domi-app/negocio/domis', { params: { businessId } });
      setDatos(data);
    } catch {
      setDatos({ propios: [], red: [], maxActivos: 1 });
    }
  }, [businessId]);

  // Cada 15 s: quién se conecta y quién sale a ruta
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  const activos = (datos?.propios || []).filter((d) => d.activo);
  const inactivos = (datos?.propios || []).filter((d) => !d.activo);
  const conectados = [...activos, ...(datos?.red || [])].filter((d) => d.enLinea).length;
  const enRuta = [...activos, ...(datos?.red || [])].filter((d) => d.pedidosActivos > 0).length;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2"><FaMotorcycle className="text-red-500" /> Domiciliarios</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Entran a la app MenuBy Go con su celular y PIN. Los pedidos se les envían desde la tarjeta del pedido.</p>
          </div>
          <div className="flex items-center gap-2">
            {datos && (
              <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-2xs font-bold uppercase tracking-wide text-emerald-700">Conectados</p>
                <p className="text-[15px] font-extrabold text-emerald-800">{conectados}{enRuta ? <span className="text-[11px] font-bold text-sky-700"> · {enRuta} en ruta</span> : null}</p>
              </div>
            )}
            {!nuevo && (
              <button onClick={() => setNuevo(true)} className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-bold flex items-center gap-2">
                <FaPlus className="text-[11px]" /> Agregar
              </button>
            )}
          </div>
        </div>

        {nuevo && <div className="px-4 lg:px-6 py-4 border-b border-slate-100"><FormularioNuevo alCrear={() => { setNuevo(false); cargar(); }} alCerrar={() => setNuevo(false)} /></div>}

        {datos === null && <p className="px-6 py-8 text-center text-[13px] text-slate-400">Cargando…</p>}
        {datos && !activos.length && !datos.red.length && !nuevo && (
          <div className="px-6 py-10 text-center space-y-2">
            <p className="text-[14px] font-bold text-slate-700">Aún no tienes domiciliarios</p>
            <p className="text-[12.5px] text-slate-500">Agrégalos con su nombre, celular y un PIN. Ellos descargan <b>MenuBy Go</b> y entran con esos datos.</p>
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {activos.map((d) => <FilaDomi key={d.id} d={d} editable alCambiar={cargar} />)}
        </div>

        {datos?.red?.length > 0 && (
          <>
            <p className="px-4 lg:px-6 pt-4 pb-1 text-[12px] font-bold text-slate-700">Red MenuBy <span className="font-normal text-slate-400">· independientes que MenuBy asignó a tu negocio; se les ofrece y aceptan</span></p>
            <div className="divide-y divide-slate-50">
              {datos.red.map((d) => <FilaDomi key={d.id} d={d} />)}
            </div>
          </>
        )}

        {inactivos.length > 0 && (
          <details className="px-4 lg:px-6 py-3 border-t border-slate-100">
            <summary className="text-[12px] font-bold text-slate-500 cursor-pointer">Desactivados ({inactivos.length})</summary>
            <div className="divide-y divide-slate-50 -mx-4 lg:-mx-6">
              {inactivos.map((d) => <FilaDomi key={d.id} d={d} editable alCambiar={cargar} />)}
            </div>
          </details>
        )}
      </div>

      {/* Cuadre de efectivo, cómo se les paga y fotos del local */}
      <CuadreDomis />
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FaMotorcycle, FaBolt, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import { Hoja } from '../ui';

/**
 * Enviar un pedido a un domiciliario (MenuBy Go).
 *
 * - Tus domiciliarios: se le asigna directo; le suena y aparece en su ruta.
 * - Red MenuBy (los que MenuBy le asignó al negocio): se le ofrece y él
 *   acepta o rechaza.
 * - Empresas de reparto: se le ofrece a la empresa.
 * - "El más cercano": la asignación automática, aunque el negocio esté en manual.
 *
 * Mientras está abierta se actualiza sola: se ve cuando el domi acepta.
 */
const haceCuanto = (iso) => {
  if (!iso) return 'sin conexión reciente';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'visto ahora';
  if (min < 60) return `visto hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `visto hace ${h} h` : 'hace más de un día';
};

function Avatar({ nombre, foto }) {
  if (foto) return <img src={foto} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />;
  return <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[14px] font-bold text-slate-500 shrink-0">{(nombre || '?')[0]}</div>;
}

function Estado({ d, maxActivos }) {
  if (!d.enLinea) return <span className="text-slate-400">○ Desconectado · {haceCuanto(d.ultimaVez)}</span>;
  if (d.cargaTotal > 0) {
    const lleno = d.cargaTotal >= maxActivos;
    return <span className={lleno ? 'text-amber-600' : 'text-sky-600'}>● En ruta · lleva {d.cargaTotal}{lleno ? ' (lleno)' : ''}</span>;
  }
  return <span className="text-emerald-600">● Conectado, libre</span>;
}

function Fila({ d, accion, textoAccion, ocupado, maxActivos, etiqueta }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${d.enLinea ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/60'}`}>
      <Avatar nombre={d.nombre} foto={d.foto} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-slate-800 truncate">
          {d.nombre}{etiqueta && <span className="ml-1.5 text-2xs font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">{etiqueta}</span>}
        </p>
        <p className="text-[11.5px] font-semibold"><Estado d={d} maxActivos={maxActivos} /></p>
        <p className="text-[11px] text-slate-400">
          {d.kmAlLocal != null ? `${String(d.kmAlLocal).replace('.', ',')} km del local · ` : ''}{d.entregasHoy} {d.entregasHoy === 1 ? 'entrega' : 'entregas'} hoy
        </p>
      </div>
      <button
        onClick={accion}
        disabled={ocupado}
        className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[12px] font-bold shrink-0"
      >
        {textoAccion}
      </button>
    </div>
  );
}

export default function EnviarADomi({ order, onClose, onIrADomis }) {
  // businessId en cada llamada: desde el superadmin la sesión no trae negocio
  const { businessConfig, businessId } = useBusinessConfig();
  const negocio = { params: { businessId } };
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    if (!order?._id) return;
    try {
      const { data } = await api.get(`/domi-app/negocio/pedidos/${order._id}/domis`, negocio);
      setDatos(data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo cargar la lista de domiciliarios.');
    }
  }, [order?._id, businessId]);

  // Al abrir y cada 5 s: así se ve cuando el domi acepta o se conecta
  useEffect(() => {
    if (!order) return undefined;
    setDatos(null);
    cargar();
    const t = setInterval(cargar, 5000);
    return () => clearInterval(t);
  }, [order, cargar]);

  const hacer = async (fn, exito) => {
    setOcupado(true);
    try {
      const { data } = await fn();
      toast.success(typeof exito === 'function' ? exito(data) : exito);
      await cargar();
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo. Intenta de nuevo.');
    } finally {
      setOcupado(false);
    }
  };

  const asignar = (d) => hacer(
    () => api.post(`/domi-app/negocio/pedidos/${order._id}/asignar`, { driverId: d.id, businessId }),
    (r) => (r.estado === 'asignado' ? `${d.nombre} lleva el pedido #${order.orderNumber}` : `Se le ofreció a ${d.nombre}: espera que acepte`),
  );
  const automatico = () => hacer(
    () => api.post(`/domi-app/negocio/pedidos/${order._id}/automatico`, { businessId }),
    (r) => `Se le ofreció a ${r.nombre || 'el domiciliario más cercano'}`,
  );
  const quitar = () => {
    if (!window.confirm('¿Quitarle este pedido al domiciliario?')) return;
    hacer(() => api.post(`/domi-app/negocio/pedidos/${order._id}/quitar`, { businessId }), 'Pedido sin domiciliario');
  };
  const ofrecerEmpresa = (e) => hacer(
    () => api.post(`/delivery-admin/restaurants/${businessConfig.slug}/orders/${order._id}/assign-partner`, { partnerId: e.id }),
    `Se le ofreció a ${e.nombre}`,
  );

  const actual = datos?.actual;
  const nadie = datos && !datos.propios.length && !datos.red.length;

  return (
    <Hoja
      abierta={!!order}
      onCerrar={onClose}
      etiqueta="Enviar a domiciliario"
      ancho="max-w-lg"
      cabecera={(
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-slate-800 flex items-center gap-2"><FaMotorcycle className="text-red-500" /> Enviar a domiciliario</h2>
            {order && (
              <p className="text-[12.5px] text-slate-500 mt-0.5 truncate">
                <b>#{order.orderNumber}</b> · {order.customerName}
                {order.address && <span className="flex items-center gap-1 mt-0.5"><FaMapMarkerAlt className="text-red-400 shrink-0" /> <span className="truncate">{order.address}</span></span>}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-lg hover:bg-slate-100"><FaTimes className="text-slate-400" /></button>
        </div>
      )}
    >
      <div className="px-5 py-4 space-y-4">
        {error && <p className="text-[13px] text-red-600 font-semibold">{error}</p>}
        {!datos && !error && <p className="text-center text-[13px] text-slate-400 py-8">Cargando…</p>}

        {/* Quién lo lleva ahora */}
        {actual && (
          <div className={`rounded-2xl p-4 flex items-center gap-3 ${actual.estado === 'asignado' ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
            <Avatar nombre={actual.nombre} foto={actual.foto} />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-slate-800 truncate">
                {actual.estado === 'asignado' ? `Lo lleva ${actual.nombre}` : `Esperando que ${actual.nombre} acepte…`}
              </p>
              <p className="text-[11.5px] text-slate-500">
                {actual.estado === 'asignado'
                  ? (actual.recogido ? 'Ya lo recogió: va hacia el cliente.' : 'Aún no lo ha recogido. Puedes cambiarlo abajo.')
                  : 'Si no acepta a tiempo, elige otro.'}
              </p>
            </div>
            {!actual.recogido && (
              <button onClick={quitar} disabled={ocupado} className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-bold text-slate-600 hover:bg-slate-50 shrink-0">
                {actual.estado === 'asignado' ? 'Quitar' : 'Cancelar'}
              </button>
            )}
          </div>
        )}

        {datos && !actual?.recogido && (
          <>
            {/* El más cercano */}
            {!actual && !nadie && (
              <button
                onClick={automatico}
                disabled={ocupado}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-left disabled:opacity-50"
              >
                <span className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0"><FaBolt /></span>
                <span>
                  <span className="block text-[13.5px] font-bold text-slate-800">Al más cercano que esté conectado</span>
                  <span className="block text-[11.5px] text-slate-500">Le suena en MenuBy Go y lo acepta. Si no, pasa al siguiente.</span>
                </span>
              </button>
            )}

            {datos.propios.length > 0 && (
              <div className="space-y-2">
                <p className="text-[12px] font-bold text-slate-700">Tus domiciliarios <span className="font-normal text-slate-400">· se les asigna directo</span></p>
                {datos.propios.map((d) => (
                  <Fila key={d.id} d={d} maxActivos={datos.maxActivos} ocupado={ocupado || actual?.id === d.id}
                    textoAccion={actual?.id === d.id ? 'Lo lleva' : actual ? 'Cambiar' : 'Asignar'} accion={() => asignar(d)} />
                ))}
              </div>
            )}

            {datos.red.length > 0 && (
              <div className="space-y-2">
                <p className="text-[12px] font-bold text-slate-700">Red MenuBy <span className="font-normal text-slate-400">· se les ofrece y aceptan</span></p>
                {datos.red.map((d) => (
                  <Fila key={d.id} d={d} etiqueta="Red" maxActivos={datos.maxActivos} ocupado={ocupado || !!actual}
                    textoAccion={actual?.id === d.id ? 'Ofrecido' : 'Ofrecer'} accion={() => asignar(d)} />
                ))}
              </div>
            )}

            {datos.empresas.length > 0 && !actual && (
              <div className="space-y-2">
                <p className="text-[12px] font-bold text-slate-700">Empresas de reparto</p>
                {datos.empresas.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">🚚</div>
                    <p className="flex-1 text-[13.5px] font-bold text-slate-800 truncate">{e.nombre}</p>
                    <button onClick={() => ofrecerEmpresa(e)} disabled={ocupado} className="h-9 px-4 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-700 hover:bg-slate-50">Ofrecer</button>
                  </div>
                ))}
              </div>
            )}

            {nadie && (
              <div className="text-center py-6 space-y-3">
                <p className="text-[13px] text-slate-500">Aún no tienes domiciliarios en MenuBy Go.</p>
                {onIrADomis && (
                  <button onClick={onIrADomis} className="h-10 px-5 rounded-xl bg-slate-900 text-white text-[13px] font-bold">Agregar domiciliarios</button>
                )}
              </div>
            )}

            {!datos.pedido.tieneUbicacion && (
              <p className="text-[11.5px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                Este pedido no tiene la ubicación del cliente en el mapa: el domiciliario se guiará por la dirección escrita.
              </p>
            )}
          </>
        )}
      </div>
    </Hoja>
  );
}

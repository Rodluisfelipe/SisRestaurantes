import React, { useEffect, useRef, useState } from 'react';
import { FaMotorcycle, FaMapMarkerAlt, FaCamera } from 'react-icons/fa';
import api from '../services/api';

/* ¿Está encendida la integración con Activos? Se pregunta una sola vez y lo
   comparten todas las fichas de pedido. */
let promesaConfig = null;
function integracionHabilitada(businessId) {
  if (!promesaConfig) {
    promesaConfig = api.get('/delivery-activos/estado-config', { params: { businessId } })
      .then((r) => !!r.data?.habilitado)
      .catch(() => false);
  }
  return promesaConfig;
}

const ETIQUETA = {
  buscando_repartidor: 'Buscando repartidor…',
  asignado: 'Repartidor asignado',
  en_camino: 'En camino al local',
  en_el_local: 'En el local',
  recogido: 'Recogido, en ruta al cliente',
  entregado: 'Entregado',
  sin_repartidor: 'No se consiguió repartidor',
  desconocido: '—',
};
const COLOR = {
  entregado: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  sin_repartidor: 'bg-red-50 border-red-200 text-red-700',
};

/**
 * "Solicitar domiciliario" con Activos, para un pedido a domicilio.
 * Solo aparece si el negocio tiene la integración habilitada.
 */
export default function DomiciliarioActivos({ order, onActualizar }) {
  const [habilitado, setHabilitado] = useState(false);
  const [minutos, setMinutos] = useState(15);
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState('');
  const [estado, setEstado] = useState(null);
  const timer = useRef(null);

  const entregaId = order?.activos?.entregaId;

  useEffect(() => { let v = true; integracionHabilitada(order?.businessId).then((h) => v && setHabilitado(h)); return () => { v = false; }; }, [order?.businessId]);

  // Mientras haya entrega, consultar el estado cada 12 s
  useEffect(() => {
    if (!habilitado || !entregaId) return undefined;
    const consultar = async () => {
      try {
        const { data } = await api.get(`/delivery-activos/estado/${order._id}`, { params: { businessId: order.businessId } });
        if (data?.solicitado) setEstado(data);
      } catch { /* reintenta */ }
    };
    consultar();
    timer.current = setInterval(consultar, 12000);
    return () => clearInterval(timer.current);
  }, [habilitado, entregaId, order?._id, order?.businessId]);

  if (!habilitado || order?.orderType !== 'delivery') return null;

  const solicitar = async (e) => {
    e.stopPropagation();
    if (pidiendo) return;
    if (!window.confirm('Se pedirá un domiciliario a Activos. Sale un repartidor real. ¿Continuar?')) return;
    setPidiendo(true); setError('');
    try {
      await api.post('/delivery-activos/solicitar', { orderId: order._id, businessId: order.businessId, minutosPreparacion: minutos });
      onActualizar?.();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo pedir el domiciliario.');
    } finally {
      setPidiendo(false);
    }
  };

  // Ya solicitado → mostrar estado
  if (entregaId) {
    const s = estado?.estado || 'buscando_repartidor';
    return (
      <div className={`mt-2 rounded-lg border px-2.5 py-2 ${COLOR[s] || 'bg-slate-50 border-slate-200 text-slate-700'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 text-[12px] font-bold">
          <FaMotorcycle className="text-2xs shrink-0" /> Activos: {ETIQUETA[s] || s}
        </div>
        {estado?.repartidor && (
          <p className="text-[11px] mt-0.5">
            {estado.repartidor}{estado.vehiculo ? ` · ${estado.vehiculo}` : ''}{estado.telefonoRepartidor ? ` · ${estado.telefonoRepartidor}` : ''}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1">
          {estado?.distanciaKm !== null && estado?.distanciaKm !== undefined && <span className="text-[11px]">{estado.distanciaKm.toFixed(1)} km</span>}
          {estado?.fotoEvidencia && (
            <a href={estado.fotoEvidencia} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold inline-flex items-center gap-1 text-blue-600">
              <FaCamera className="text-2xs" /> Evidencia
            </a>
          )}
        </div>
      </div>
    );
  }

  // Aún no solicitado → botón
  return (
    <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={solicitar}
        disabled={pidiendo}
        className="flex-1 h-9 rounded-lg bg-slate-900 text-white text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <FaMotorcycle className="text-xs" /> {pidiendo ? 'Pidiendo…' : 'Solicitar domiciliario'}
      </button>
      <label className="flex items-center gap-1 text-[11px] text-slate-500">
        <input
          type="number" min="1" max="90" value={minutos}
          onChange={(e) => setMinutos(parseInt(e.target.value, 10) || 15)}
          className="w-12 h-9 text-center rounded-lg border border-slate-200 text-[12px] font-semibold"
        /> min
      </label>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
